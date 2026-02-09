"""Unit tests for priority and conflict resolution in GuardrailsEvaluator.

Tests cover:
- _resolve_conflicts() method behavior
- Priority sorting (highest first)
- tools_allowed merge (union of all)
- tools_denied merge (union of all)
- Deny overrides allow (tools in both denied and allowed removed from allowed)
- Instruction concatenation in priority order
- HITL gate combination (union of all gate_types)
- Same-priority deterministic ordering (stable sort)
- Single guideline passthrough
- No matches empty result
- Mixed action types
- None action fields skipped
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from src.core.guardrails.evaluator import GuardrailsEvaluator
from src.core.guardrails.models import (
    ActionType,
    EvaluatedContext,
    EvaluatedGuideline,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
)


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

_DEFAULT_TS = datetime(2026, 1, 1, tzinfo=timezone.utc)


def make_guideline(
    id: str = "test",
    priority: int = 500,
    instruction: str | None = None,
    tools_allowed: list[str] | None = None,
    tools_denied: list[str] | None = None,
    gate_type: str | None = None,
    **kw: object,
) -> Guideline:
    """Create a Guideline with minimal boilerplate for conflict resolution tests."""
    action_type = ActionType.INSTRUCTION
    if tools_allowed or tools_denied:
        action_type = ActionType.TOOL_RESTRICTION
    if gate_type:
        action_type = ActionType.HITL_GATE

    return Guideline(
        id=id,
        name=f"Guideline {id}",
        description="test",
        enabled=True,
        category=GuidelineCategory.CUSTOM,
        priority=priority,
        condition=GuidelineCondition(),
        action=GuidelineAction(
            type=action_type,
            instruction=instruction,
            tools_allowed=tools_allowed,
            tools_denied=tools_denied,
            gate_type=gate_type,
        ),
        metadata={},
        version=1,
        created_at=_DEFAULT_TS,
        updated_at=_DEFAULT_TS,
        created_by="test",
        **kw,
    )


def make_evaluated(
    guideline: Guideline,
    matched_fields: tuple[str, ...] = (),
) -> EvaluatedGuideline:
    """Wrap a Guideline in an EvaluatedGuideline with default match_score."""
    return EvaluatedGuideline(guideline=guideline, matched_fields=matched_fields)


def _make_mock_store() -> AsyncMock:
    """Create a mock GuardrailsStore with default async responses."""
    store = AsyncMock()
    store.list_guidelines = AsyncMock(return_value=([], 0))
    store.log_audit_entry = AsyncMock(return_value="audit-entry-001")
    return store


def _make_evaluator(store: AsyncMock | None = None) -> GuardrailsEvaluator:
    """Create a GuardrailsEvaluator with a mock store."""
    if store is None:
        store = _make_mock_store()
    return GuardrailsEvaluator(store=store)


def _make_context(**overrides: object) -> TaskContext:
    """Create a TaskContext with sensible defaults."""
    defaults = {
        "agent": "backend",
        "domain": "P01",
        "action": "implement",
        "session_id": "session-test-001",
    }
    defaults.update(overrides)
    return TaskContext(**defaults)


# ===========================================================================
# _resolve_conflicts() - priority sorting
# ===========================================================================


class TestPrioritySorting:
    """Tests for priority-based ordering in conflict resolution."""

    def test_priority_sorting(self) -> None:
        """Higher priority guidelines appear first in matched_guidelines."""
        evaluator = _make_evaluator()
        low = make_guideline(id="low", priority=100, instruction="low")
        high = make_guideline(id="high", priority=900, instruction="high")
        mid = make_guideline(id="mid", priority=500, instruction="mid")

        # Pass unsorted to verify _resolve_conflicts sorts internally
        matched = [
            make_evaluated(low),
            make_evaluated(high),
            make_evaluated(mid),
        ]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        assert isinstance(result, EvaluatedContext)
        ids = [eg.guideline.id for eg in result.matched_guidelines]
        assert ids == ["high", "mid", "low"]

    def test_same_priority_handling(self) -> None:
        """Guidelines with same priority maintain stable insertion order."""
        evaluator = _make_evaluator()
        g_a = make_guideline(id="alpha", priority=500, instruction="alpha")
        g_b = make_guideline(id="bravo", priority=500, instruction="bravo")
        g_c = make_guideline(id="charlie", priority=500, instruction="charlie")

        matched = [
            make_evaluated(g_a),
            make_evaluated(g_b),
            make_evaluated(g_c),
        ]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        ids = [eg.guideline.id for eg in result.matched_guidelines]
        # Stable sort: original insertion order preserved for equal priorities
        assert ids == ["alpha", "bravo", "charlie"]


# ===========================================================================
# _resolve_conflicts() - tools_allowed merge
# ===========================================================================


class TestToolsAllowedMerge:
    """Tests for merging tools_allowed across guidelines."""

    def test_tools_allowed_merge(self) -> None:
        """Union of tools_allowed from multiple guidelines."""
        evaluator = _make_evaluator()
        g1 = make_guideline(id="g1", priority=800, tools_allowed=["Read", "Write"])
        g2 = make_guideline(id="g2", priority=600, tools_allowed=["Write", "Bash"])

        matched = [make_evaluated(g1), make_evaluated(g2)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        assert set(result.tools_allowed) == {"Read", "Write", "Bash"}


# ===========================================================================
# _resolve_conflicts() - tools_denied merge
# ===========================================================================


class TestToolsDeniedMerge:
    """Tests for merging tools_denied across guidelines."""

    def test_tools_denied_merge(self) -> None:
        """Union of tools_denied from multiple guidelines."""
        evaluator = _make_evaluator()
        g1 = make_guideline(id="g1", priority=800, tools_denied=["Bash"])
        g2 = make_guideline(id="g2", priority=600, tools_denied=["Bash", "Write"])

        matched = [make_evaluated(g1), make_evaluated(g2)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        assert set(result.tools_denied) == {"Bash", "Write"}


# ===========================================================================
# _resolve_conflicts() - deny overrides allow
# ===========================================================================


class TestDenyOverridesAllow:
    """Tests that tools_denied always wins over tools_allowed."""

    def test_deny_overrides_allow(self) -> None:
        """A tool in both allowed and denied is removed from allowed."""
        evaluator = _make_evaluator()
        g_allow = make_guideline(
            id="g-allow",
            priority=800,
            tools_allowed=["Read", "Write", "Bash"],
        )
        g_deny = make_guideline(
            id="g-deny",
            priority=600,
            tools_denied=["Bash", "Edit"],
        )

        matched = [make_evaluated(g_allow), make_evaluated(g_deny)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        # Bash is in both -> removed from allowed
        assert set(result.tools_allowed) == {"Read", "Write"}
        assert set(result.tools_denied) == {"Bash", "Edit"}


# ===========================================================================
# _resolve_conflicts() - instruction concatenation
# ===========================================================================


class TestInstructionConcatenation:
    """Tests for instruction merging in priority order."""

    def test_instruction_concatenation(self) -> None:
        """Instructions joined by double newline in priority order (high first)."""
        evaluator = _make_evaluator()
        g_high = make_guideline(
            id="g-high", priority=900, instruction="Follow TDD."
        )
        g_low = make_guideline(
            id="g-low", priority=100, instruction="Use type hints."
        )

        matched = [make_evaluated(g_low), make_evaluated(g_high)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        assert result.combined_instruction == "Follow TDD.\n\nUse type hints."


# ===========================================================================
# _resolve_conflicts() - HITL gate combination
# ===========================================================================


class TestHitlGateCombination:
    """Tests for HITL gate aggregation."""

    def test_hitl_gate_combination(self) -> None:
        """All gate_types from matched guidelines are collected."""
        evaluator = _make_evaluator()
        g1 = make_guideline(id="g1", priority=800, gate_type="devops_invocation")
        g2 = make_guideline(id="g2", priority=600, gate_type="protected_path")
        g3 = make_guideline(id="g3", priority=400, gate_type="devops_invocation")

        matched = [make_evaluated(g1), make_evaluated(g2), make_evaluated(g3)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        # Union of unique gate types
        assert set(result.hitl_gates) == {"devops_invocation", "protected_path"}


# ===========================================================================
# _resolve_conflicts() - edge cases
# ===========================================================================


class TestEdgeCases:
    """Tests for edge cases in conflict resolution."""

    def test_single_guideline_no_conflict(self) -> None:
        """Single match passes through unchanged."""
        evaluator = _make_evaluator()
        g = make_guideline(
            id="solo",
            priority=750,
            instruction="Be careful.",
            tools_allowed=["Read"],
        )

        matched = [make_evaluated(g)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        assert len(result.matched_guidelines) == 1
        assert result.matched_guidelines[0].guideline.id == "solo"
        assert result.combined_instruction == "Be careful."
        assert set(result.tools_allowed) == {"Read"}
        assert result.tools_denied == ()
        assert result.hitl_gates == ()

    def test_no_matches_empty_result(self) -> None:
        """Empty matched list produces empty EvaluatedContext."""
        evaluator = _make_evaluator()
        ctx = _make_context()
        result = evaluator._resolve_conflicts([], ctx)

        assert result.matched_guidelines == ()
        assert result.combined_instruction == ""
        assert result.tools_allowed == ()
        assert result.tools_denied == ()
        assert result.hitl_gates == ()
        assert result.context == ctx

    def test_mixed_action_types(self) -> None:
        """Guidelines with different action types all contribute their fields."""
        evaluator = _make_evaluator()
        g_instr = make_guideline(
            id="g-instr", priority=900, instruction="Follow TDD."
        )
        g_tool = make_guideline(
            id="g-tool",
            priority=700,
            tools_allowed=["Read"],
            tools_denied=["Bash"],
        )
        g_gate = make_guideline(
            id="g-gate", priority=500, gate_type="devops_invocation"
        )

        matched = [
            make_evaluated(g_instr),
            make_evaluated(g_tool),
            make_evaluated(g_gate),
        ]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        assert result.combined_instruction == "Follow TDD."
        assert set(result.tools_allowed) == {"Read"}
        assert set(result.tools_denied) == {"Bash"}
        assert set(result.hitl_gates) == {"devops_invocation"}

    def test_none_action_fields_skipped(self) -> None:
        """Guidelines with None instruction/tools do not contribute to merged result."""
        evaluator = _make_evaluator()
        # g1 has instruction only
        g1 = make_guideline(id="g1", priority=800, instruction="Step 1.")
        # g2 has no instruction, no tools, no gate
        g2 = make_guideline(id="g2", priority=600)
        # g3 has instruction
        g3 = make_guideline(id="g3", priority=400, instruction="Step 2.")

        matched = [make_evaluated(g1), make_evaluated(g2), make_evaluated(g3)]
        ctx = _make_context()
        result = evaluator._resolve_conflicts(matched, ctx)

        # g2 has no instruction -> should not appear in combined
        assert result.combined_instruction == "Step 1.\n\nStep 2."
        assert result.tools_allowed == ()
        assert result.tools_denied == ()
        assert result.hitl_gates == ()


# ===========================================================================
# get_context() integration with _resolve_conflicts()
# ===========================================================================


class TestGetContextWithConflictResolution:
    """Tests that get_context() uses _resolve_conflicts() to build full result."""

    @pytest.mark.asyncio
    async def test_get_context_applies_conflict_resolution(self) -> None:
        """get_context() returns fully resolved EvaluatedContext."""
        g_high = Guideline(
            id="g-high",
            name="High",
            description="test",
            enabled=True,
            category=GuidelineCategory.CUSTOM,
            priority=900,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.INSTRUCTION,
                instruction="High priority instruction.",
            ),
            metadata={},
            version=1,
            created_at=_DEFAULT_TS,
            updated_at=_DEFAULT_TS,
            created_by="test",
        )
        g_low = Guideline(
            id="g-low",
            name="Low",
            description="test",
            enabled=True,
            category=GuidelineCategory.CUSTOM,
            priority=100,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.INSTRUCTION,
                instruction="Low priority instruction.",
            ),
            metadata={},
            version=1,
            created_at=_DEFAULT_TS,
            updated_at=_DEFAULT_TS,
            created_by="test",
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = ([g_high, g_low], 2)
        evaluator = GuardrailsEvaluator(store=store)
        ctx = _make_context(agent="backend")

        result = await evaluator.get_context(ctx)

        assert isinstance(result, EvaluatedContext)
        assert len(result.matched_guidelines) == 2
        assert result.matched_guidelines[0].guideline.id == "g-high"
        assert result.matched_guidelines[1].guideline.id == "g-low"
        assert result.combined_instruction == (
            "High priority instruction.\n\nLow priority instruction."
        )

    @pytest.mark.asyncio
    async def test_get_context_resolves_tool_conflicts(self) -> None:
        """get_context() merges tools and applies deny-overrides-allow."""
        g_allow = Guideline(
            id="g-allow",
            name="Allow",
            description="test",
            enabled=True,
            category=GuidelineCategory.CUSTOM,
            priority=800,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.TOOL_RESTRICTION,
                tools_allowed=["Read", "Write", "Bash"],
            ),
            metadata={},
            version=1,
            created_at=_DEFAULT_TS,
            updated_at=_DEFAULT_TS,
            created_by="test",
        )
        g_deny = Guideline(
            id="g-deny",
            name="Deny",
            description="test",
            enabled=True,
            category=GuidelineCategory.CUSTOM,
            priority=600,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.TOOL_RESTRICTION,
                tools_denied=["Bash"],
            ),
            metadata={},
            version=1,
            created_at=_DEFAULT_TS,
            updated_at=_DEFAULT_TS,
            created_by="test",
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = ([g_allow, g_deny], 2)
        evaluator = GuardrailsEvaluator(store=store)
        ctx = _make_context(agent="backend")

        result = await evaluator.get_context(ctx)

        assert set(result.tools_allowed) == {"Read", "Write"}
        assert set(result.tools_denied) == {"Bash"}
