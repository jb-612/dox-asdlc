"""Evaluates guidelines against task context.

Provides :class:`GuardrailsEvaluator` which accepts a
:class:`~src.infrastructure.guardrails.guardrails_store.GuardrailsStore`
and evaluates which guidelines apply to a given
:class:`~src.core.guardrails.models.TaskContext`.

Also provides :class:`StaticGuardrailsStore` which reads guidelines from
a local JSON file, enabling offline/workstation usage without Elasticsearch.

This module is the core of the guardrails evaluation pipeline.  Condition
matching (T06), conflict resolution (T07), and full evaluation flow (T08)
will be added incrementally.
"""

from __future__ import annotations

import fnmatch
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.core.guardrails.models import (
    EvaluatedContext,
    EvaluatedGuideline,
    GateDecision,
    Guideline,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
)
from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

logger = logging.getLogger(__name__)

MAX_STATIC_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_INSTRUCTION_LENGTH = 10000  # Per-guideline instruction limit
MAX_COMBINED_LENGTH = 50000  # Total combined instruction limit


class StaticGuardrailsStore:
    """A read-only guidelines store backed by a local JSON file.

    Provides enough of the GuardrailsStore interface to work with
    GuardrailsEvaluator when Elasticsearch is unavailable.

    Args:
        file_path: Path to the static guidelines JSON file.
    """

    def __init__(self, file_path: str | Path) -> None:
        self._file_path = Path(file_path)
        self._guidelines: list[Guideline] | None = None
        self._last_mtime: float | None = None

    def _load(self) -> list[Guideline]:
        """Load guidelines from the JSON file, reloading if modified."""
        try:
            current_mtime = self._file_path.stat().st_mtime
        except OSError:
            if self._guidelines is not None:
                return self._guidelines
            self._guidelines = []
            return self._guidelines

        # Return cached if file hasn't changed
        if (
            self._guidelines is not None
            and self._last_mtime is not None
            and current_mtime == self._last_mtime
        ):
            return self._guidelines

        try:
            file_size = self._file_path.stat().st_size
            if file_size > MAX_STATIC_FILE_SIZE:
                logger.warning(
                    "Static guidelines file too large (%d bytes, max %d): %s",
                    file_size, MAX_STATIC_FILE_SIZE, self._file_path,
                )
                self._guidelines = []
                self._last_mtime = current_mtime
                return self._guidelines
            data = json.loads(self._file_path.read_text(encoding="utf-8"))
            self._guidelines = [Guideline.from_dict(g) for g in data]
            self._last_mtime = current_mtime
        except (json.JSONDecodeError, OSError, ValueError, KeyError, TypeError) as exc:
            logger.warning("Failed to load static guidelines from %s: %s", self._file_path, exc)
            self._guidelines = []
            self._last_mtime = current_mtime
        return self._guidelines

    async def list_guidelines(
        self,
        category: GuidelineCategory | None = None,
        enabled: bool | None = None,
        page: int = 1,
        page_size: int = 1000,
    ) -> tuple[list[Guideline], int]:
        """Return guidelines from the static file, filtered by enabled status.

        Args:
            category: Optional category filter.
            enabled: Optional enabled-state filter.
            page: Ignored (all results returned).
            page_size: Ignored (all results returned).

        Returns:
            A tuple of (guidelines, total_count).
        """
        all_guidelines = self._load()
        filtered = all_guidelines
        if enabled is not None:
            filtered = [g for g in filtered if g.enabled == enabled]
        if category is not None:
            filtered = [g for g in filtered if g.category == category]
        return filtered, len(filtered)

    async def log_audit_entry(self, entry: dict[str, Any]) -> str:
        """No-op audit logging for static store.

        Args:
            entry: The audit entry (ignored).

        Returns:
            A generated UUID string.
        """
        return str(uuid.uuid4())


class GuardrailsEvaluator:
    """Evaluates guidelines against task context.

    Takes a :class:`GuardrailsStore` and evaluates which guidelines apply
    to a given :class:`TaskContext`.

    Args:
        store: The guardrails store for guideline retrieval and audit logging.
        cache_ttl: Time-to-live for cached guidelines in seconds. Default 60.0.
                   Set to 0.0 to disable caching.

    Example:
        ```python
        evaluator = GuardrailsEvaluator(store=my_store)
        result = await evaluator.get_context(task_context)
        ```
    """

    def __init__(self, store: GuardrailsStore | StaticGuardrailsStore, cache_ttl: float = 60.0) -> None:
        self._store = store
        self._cache_ttl = cache_ttl
        self._cached_guidelines: list[Guideline] | None = None
        self._cache_timestamp: datetime | None = None

    @staticmethod
    def _is_safe_path(path: str) -> bool:
        """Reject paths containing directory traversal."""
        parts = path.replace("\\", "/").split("/")
        return ".." not in parts

    def _count_non_none_fields(self, condition: GuidelineCondition) -> int:
        """Count the number of non-None/non-empty fields in a condition.

        This is used to calculate the match score denominator.

        Args:
            condition: The guideline condition to count.

        Returns:
            The count of non-None, non-empty fields.
        """
        count = 0
        if condition.agents:
            count += 1
        if condition.domains:
            count += 1
        if condition.actions:
            count += 1
        if condition.paths:
            count += 1
        if condition.events:
            count += 1
        if condition.gate_types:
            count += 1
        return count

    def _condition_matches(
        self,
        condition: GuidelineCondition,
        context: TaskContext,
    ) -> tuple[bool, tuple[str, ...]]:
        """Check if a condition matches the given context.

        Returns ``(matches, matched_fields)`` where:

        - *matches*: ``True`` if **all** specified condition fields match
          (AND logic).
        - *matched_fields*: tuple of field names that were checked and
          matched.

        Rules:

        - ``None`` or empty-list condition fields act as wildcards (always
          match, not counted as a matched field).
        - List fields use OR logic (any item in the list matching the
          context value is sufficient).
        - All non-wildcard condition fields must match for the overall
          result to be ``True`` (AND logic).
        - Path matching uses :func:`fnmatch.fnmatch` for glob patterns.

        Args:
            condition: The guideline condition to evaluate.
            context: The task context to evaluate against.

        Returns:
            A tuple of ``(matches, matched_fields)``.
        """
        matched: list[str] = []

        # Define simple (scalar) field mappings:
        #   (condition_field_name, condition_value, context_value)
        scalar_checks: list[tuple[str, list[str] | None, str | None]] = [
            ("agents", condition.agents, context.agent),
            ("domains", condition.domains, context.domain),
            ("actions", condition.actions, context.action),
            ("events", condition.events, context.event),
            ("gate_types", condition.gate_types, context.gate_type),
        ]

        for field_name, cond_values, ctx_value in scalar_checks:
            # Wildcard: None or empty list -> skip
            if not cond_values:
                continue
            # Condition specifies values but context field is None -> no match
            if ctx_value is None:
                return False, ()
            # OR logic: any condition value matching context value
            if ctx_value in cond_values:
                matched.append(field_name)
            else:
                return False, ()

        # Path matching (list-to-list with glob patterns)
        cond_paths = condition.paths
        if cond_paths:
            # Condition has path patterns but context has no paths -> no match
            if not context.paths:
                return False, ()
            # Filter out unsafe paths containing directory traversal
            safe_cond = [p for p in cond_paths if self._is_safe_path(p)]
            safe_ctx = [p for p in context.paths if self._is_safe_path(p)]
            if not safe_cond or not safe_ctx:
                return False, ()
            # OR logic: any context path matching any condition pattern
            path_matched = any(
                fnmatch.fnmatch(ctx_path, pattern)
                for pattern in safe_cond
                for ctx_path in safe_ctx
            )
            if path_matched:
                matched.append("paths")
            else:
                return False, ()

        return True, tuple(matched)

    @staticmethod
    def _sanitize_instruction(instruction: str) -> str:
        """Sanitize a guideline instruction to prevent prompt injection."""
        if len(instruction) > MAX_INSTRUCTION_LENGTH:
            instruction = instruction[:MAX_INSTRUCTION_LENGTH] + "... [truncated]"
        return instruction

    def _resolve_conflicts(
        self,
        matched: list[EvaluatedGuideline],
        context: TaskContext,
    ) -> EvaluatedContext:
        """Resolve conflicts between matched guidelines.

        Guidelines are sorted by priority (highest first) using a stable
        sort so that equal-priority items retain their original order.
        Tool lists are merged as unions, with ``tools_denied`` always
        winning over ``tools_allowed`` (if a tool appears in both sets it
        is removed from allowed).  HITL gates are collected as a union of
        unique gate types.  Instructions are concatenated in priority
        order separated by double newlines.

        Args:
            matched: List of evaluated guidelines (may be unsorted).
            context: The task context being evaluated.

        Returns:
            A fully resolved :class:`EvaluatedContext`.
        """
        # Stable sort by priority descending
        sorted_matched = sorted(
            matched, key=lambda eg: eg.guideline.priority, reverse=True
        )

        instructions: list[str] = []
        tools_allowed: set[str] = set()
        tools_denied: set[str] = set()
        hitl_gates: set[str] = set()

        for eg in sorted_matched:
            action = eg.guideline.action

            if action.instruction:
                instructions.append(self._sanitize_instruction(action.instruction))

            if action.tools_allowed is not None:
                tools_allowed.update(action.tools_allowed)

            if action.tools_denied is not None:
                tools_denied.update(action.tools_denied)

            if action.gate_type is not None:
                hitl_gates.add(action.gate_type)

        # Deny always wins over allow
        final_tools_allowed = tools_allowed - tools_denied

        combined = "\n\n".join(instructions)
        if len(combined) > MAX_COMBINED_LENGTH:
            combined = combined[:MAX_COMBINED_LENGTH] + "\n\n[... additional instructions truncated]"

        return EvaluatedContext(
            context=context,
            matched_guidelines=tuple(sorted_matched),
            combined_instruction=combined,
            tools_allowed=tuple(sorted(final_tools_allowed)),
            tools_denied=tuple(sorted(tools_denied)),
            hitl_gates=tuple(sorted(hitl_gates)),
        )

    def invalidate_cache(self) -> None:
        """Invalidate the cached guidelines.

        Forces the next call to :meth:`get_context` to fetch fresh
        guidelines from the store.
        """
        self._cached_guidelines = None
        self._cache_timestamp = None

    async def get_context(self, context: TaskContext) -> EvaluatedContext:
        """Evaluate all enabled guidelines against the given context.

        Returns an :class:`EvaluatedContext` with matched guidelines sorted
        by priority, combined instructions, and aggregated tool lists.

        Condition matching filters guidelines whose conditions match the
        context.  Conflict resolution merges tool lists and instructions
        across matched guidelines.  Guidelines are cached with a
        configurable TTL to reduce Elasticsearch queries.

        Args:
            context: The task context to evaluate against.

        Returns:
            An EvaluatedContext containing matched guidelines and
            aggregated results.
        """
        # Check cache validity
        now = datetime.now(timezone.utc)
        cache_valid = False

        if self._cache_ttl > 0.0 and self._cached_guidelines is not None:
            if self._cache_timestamp is not None:
                elapsed = (now - self._cache_timestamp).total_seconds()
                cache_valid = elapsed < self._cache_ttl

        # Fetch from store if cache invalid
        if cache_valid:
            guidelines = self._cached_guidelines
        else:
            guidelines, total = await self._store.list_guidelines(
                enabled=True, page_size=10000
            )
            if total > len(guidelines):
                logger.warning(
                    "Evaluator fetched %d of %d enabled guidelines; "
                    "some may be missed. Consider increasing page_size.",
                    len(guidelines),
                    total,
                )
            # Update cache
            if self._cache_ttl > 0.0:
                self._cached_guidelines = guidelines
                self._cache_timestamp = now

        matched: list[EvaluatedGuideline] = []
        for guideline in guidelines:
            matches, matched_fields = self._condition_matches(
                guideline.condition, context
            )
            if matches:
                # Calculate match_score as matched_fields / total_non_none_fields
                total_fields = self._count_non_none_fields(guideline.condition)
                match_score = (
                    len(matched_fields) / total_fields if total_fields > 0 else 1.0
                )

                matched.append(
                    EvaluatedGuideline(
                        guideline=guideline,
                        match_score=match_score,
                        matched_fields=matched_fields,
                    )
                )

        return self._resolve_conflicts(matched, context)

    async def log_decision(self, decision: GateDecision) -> str:
        """Log a HITL gate decision to the audit index.

        Constructs an audit entry from the decision and persists it
        via the store.

        Args:
            decision: The gate decision to log.

        Returns:
            The audit entry ID.
        """
        entry: dict[str, Any] = {
            "event_type": "gate_decision",
            "guideline_id": decision.guideline_id,
            "gate_type": decision.gate_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "decision": {
                "result": decision.result,
                "reason": decision.reason,
                "user_response": decision.user_response,
            },
        }
        if decision.context:
            entry["context"] = {
                "agent": decision.context.agent,
                "domain": decision.context.domain,
                "action": decision.context.action,
                "session_id": decision.context.session_id,
            }
        return await self._store.log_audit_entry(entry)
