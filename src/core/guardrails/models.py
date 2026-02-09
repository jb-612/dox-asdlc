"""Data models for the guardrails configuration system.

Provides Guideline, GuidelineCondition, GuidelineAction, and TaskContext
frozen dataclasses with serialization support, plus GuidelineCategory and
ActionType enums.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class GuidelineCategory(str, Enum):
    """Categories for organizing guidelines."""

    COGNITIVE_ISOLATION = "cognitive_isolation"
    HITL_GATE = "hitl_gate"
    TDD_PROTOCOL = "tdd_protocol"
    CONTEXT_CONSTRAINT = "context_constraint"
    AUDIT_TELEMETRY = "audit_telemetry"
    SECURITY = "security"
    CUSTOM = "custom"


class ActionType(str, Enum):
    """Types of actions a guideline can specify."""

    INSTRUCTION = "instruction"
    TOOL_RESTRICTION = "tool_restriction"
    HITL_GATE = "hitl_gate"
    CONSTRAINT = "constraint"
    TELEMETRY = "telemetry"


def _parse_enum(enum_cls: type[Enum], value: str | Enum) -> Enum:
    """Parse an enum from its value or name string.

    Args:
        enum_cls: The enum class to parse into.
        value: Either a string (value or name) or an existing enum member.

    Returns:
        The matching enum member.

    Raises:
        ValueError: If the value does not match any member.
    """
    if isinstance(value, enum_cls):
        return value
    # Try by value first
    try:
        return enum_cls(value)
    except ValueError:
        pass
    # Try by name (upper case)
    try:
        return enum_cls[value.upper() if isinstance(value, str) else value]
    except (KeyError, AttributeError):
        pass
    raise ValueError(f"{value!r} is not a valid {enum_cls.__name__}")


def _parse_datetime(value: str | datetime) -> datetime:
    """Parse an ISO 8601 datetime string or pass through a datetime object.

    Args:
        value: An ISO datetime string or datetime instance.

    Returns:
        A datetime object.
    """
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value)


@dataclass(frozen=True)
class GuidelineCondition:
    """Conditions that determine when a guideline applies.

    All specified fields must match (AND logic).
    Lists within fields use OR logic (any match).
    None means wildcard (matches anything).
    """

    agents: list[str] | None = None
    domains: list[str] | None = None
    actions: list[str] | None = None
    paths: list[str] | None = None
    events: list[str] | None = None
    gate_types: list[str] | None = None
    custom: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert condition to dictionary for JSON serialization.

        Returns:
            Dictionary representation. None-valued fields are excluded.
        """
        result: dict[str, Any] = {}
        if self.agents is not None:
            result["agents"] = list(self.agents)
        if self.domains is not None:
            result["domains"] = list(self.domains)
        if self.actions is not None:
            result["actions"] = list(self.actions)
        if self.paths is not None:
            result["paths"] = list(self.paths)
        if self.events is not None:
            result["events"] = list(self.events)
        if self.gate_types is not None:
            result["gate_types"] = list(self.gate_types)
        if self.custom is not None:
            result["custom"] = dict(self.custom)
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GuidelineCondition:
        """Create a GuidelineCondition from a dictionary.

        Args:
            data: Dictionary containing condition fields.

        Returns:
            GuidelineCondition instance.
        """
        return cls(
            agents=data.get("agents"),
            domains=data.get("domains"),
            actions=data.get("actions"),
            paths=data.get("paths"),
            events=data.get("events"),
            gate_types=data.get("gate_types"),
            custom=data.get("custom"),
        )


@dataclass(frozen=True)
class GuidelineAction:
    """Actions to take when a guideline's condition matches."""

    type: ActionType
    instruction: str | None = None
    tools_allowed: list[str] | None = None
    tools_denied: list[str] | None = None
    gate_type: str | None = None
    gate_threshold: str | None = None
    max_files: int | None = None
    require_tests: bool | None = None
    require_review: bool | None = None
    parameters: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert action to dictionary for JSON serialization.

        Returns:
            Dictionary representation. Enum is serialized as its value.
            None-valued fields are excluded.
        """
        result: dict[str, Any] = {"type": self.type.value}
        if self.instruction is not None:
            result["instruction"] = self.instruction
        if self.tools_allowed is not None:
            result["tools_allowed"] = list(self.tools_allowed)
        if self.tools_denied is not None:
            result["tools_denied"] = list(self.tools_denied)
        if self.gate_type is not None:
            result["gate_type"] = self.gate_type
        if self.gate_threshold is not None:
            result["gate_threshold"] = self.gate_threshold
        if self.max_files is not None:
            result["max_files"] = self.max_files
        if self.require_tests is not None:
            result["require_tests"] = self.require_tests
        if self.require_review is not None:
            result["require_review"] = self.require_review
        if self.parameters is not None:
            result["parameters"] = dict(self.parameters)
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GuidelineAction:
        """Create a GuidelineAction from a dictionary.

        Args:
            data: Dictionary containing action fields.
                  The ``type`` field accepts enum values or names.

        Returns:
            GuidelineAction instance.
        """
        return cls(
            type=_parse_enum(ActionType, data["type"]),  # type: ignore[arg-type]
            instruction=data.get("instruction"),
            tools_allowed=data.get("tools_allowed"),
            tools_denied=data.get("tools_denied"),
            gate_type=data.get("gate_type"),
            gate_threshold=data.get("gate_threshold"),
            max_files=data.get("max_files"),
            require_tests=data.get("require_tests"),
            require_review=data.get("require_review"),
            parameters=data.get("parameters"),
        )


@dataclass(frozen=True)
class Guideline:
    """A contextually-conditional guideline for agent behavior.

    Guidelines are modular rules that activate based on conditions,
    following Parlant's alignment modeling pattern.

    Attributes:
        id: Unique identifier (e.g. ``"cognitive-planner"``).
        name: Human-readable name.
        description: Detailed description of the guideline's purpose.
        enabled: Master enable/disable toggle.
        category: Category for grouping and filtering.
        priority: Priority for conflict resolution (0-1000, higher wins).
        condition: When the guideline applies.
        action: What to do when condition matches.
        metadata: Additional metadata for extensibility.
        version: Version number for optimistic locking.
        created_at: Creation timestamp.
        updated_at: Last update timestamp.
        created_by: Creator identifier.
    """

    id: str
    name: str
    description: str
    enabled: bool
    category: GuidelineCategory
    priority: int
    condition: GuidelineCondition
    action: GuidelineAction
    metadata: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: str

    def to_dict(self) -> dict[str, Any]:
        """Convert guideline to dictionary for JSON serialization.

        Returns:
            Dictionary representation.  Enums are serialized as their
            string values and datetimes as ISO 8601 strings.
        """
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "enabled": self.enabled,
            "category": self.category.value,
            "priority": self.priority,
            "condition": self.condition.to_dict(),
            "action": self.action.to_dict(),
            "metadata": dict(self.metadata),
            "version": self.version,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "created_by": self.created_by,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Guideline:
        """Create a Guideline from a dictionary.

        Args:
            data: Dictionary containing guideline fields.
                  Accepts enum values or names for ``category``.
                  Accepts ISO datetime strings for timestamps.

        Returns:
            Guideline instance.
        """
        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            enabled=data["enabled"],
            category=_parse_enum(GuidelineCategory, data["category"]),  # type: ignore[arg-type]
            priority=data["priority"],
            condition=GuidelineCondition.from_dict(data["condition"]),
            action=GuidelineAction.from_dict(data["action"]),
            metadata=data.get("metadata", {}),
            version=data["version"],
            created_at=_parse_datetime(data["created_at"]),
            updated_at=_parse_datetime(data["updated_at"]),
            created_by=data["created_by"],
        )


@dataclass(frozen=True)
class TaskContext:
    """Context for a task being evaluated against guidelines.

    This is the input to the GuardrailsEvaluator.  The ``agent`` field
    is required; all other fields are optional and default to None
    (wildcard).

    Attributes:
        agent: Current agent role (e.g. ``"backend"``).
        domain: Domain identifier (e.g. ``"P01"``).
        action: Action type (e.g. ``"implement"``).
        paths: File paths being accessed.
        event: Triggering event (e.g. ``"commit"``).
        gate_type: Current HITL gate type.
        tenant_id: Tenant identifier for multi-tenancy.
        session_id: Session identifier.
        metadata: Additional context metadata.
    """

    agent: str
    domain: str | None = None
    action: str | None = None
    paths: list[str] | None = None
    event: str | None = None
    gate_type: str | None = None
    tenant_id: str | None = None
    session_id: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert task context to dictionary for JSON serialization.

        Returns:
            Dictionary representation.  None-valued fields are excluded
            except for ``agent`` which is always present.
        """
        result: dict[str, Any] = {"agent": self.agent}
        if self.domain is not None:
            result["domain"] = self.domain
        if self.action is not None:
            result["action"] = self.action
        if self.paths is not None:
            result["paths"] = list(self.paths)
        if self.event is not None:
            result["event"] = self.event
        if self.gate_type is not None:
            result["gate_type"] = self.gate_type
        if self.tenant_id is not None:
            result["tenant_id"] = self.tenant_id
        if self.session_id is not None:
            result["session_id"] = self.session_id
        if self.metadata is not None:
            result["metadata"] = dict(self.metadata)
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TaskContext:
        """Create a TaskContext from a dictionary.

        Args:
            data: Dictionary containing context fields.

        Returns:
            TaskContext instance.
        """
        return cls(
            agent=data["agent"],
            domain=data.get("domain"),
            action=data.get("action"),
            paths=data.get("paths"),
            event=data.get("event"),
            gate_type=data.get("gate_type"),
            tenant_id=data.get("tenant_id"),
            session_id=data.get("session_id"),
            metadata=data.get("metadata"),
        )


@dataclass(frozen=True)
class EvaluatedGuideline:
    """A guideline that matched the current context.

    Attributes:
        guideline: The matched guideline.
        match_score: How well the condition matched (0-1).
        matched_fields: Which condition fields matched.
    """

    guideline: Guideline
    match_score: float = 1.0
    matched_fields: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dictionary representation with guideline serialized
            and matched_fields as a list.
        """
        return {
            "guideline": self.guideline.to_dict(),
            "match_score": self.match_score,
            "matched_fields": list(self.matched_fields),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> EvaluatedGuideline:
        """Create an EvaluatedGuideline from a dictionary.

        Args:
            data: Dictionary containing evaluated guideline fields.

        Returns:
            EvaluatedGuideline instance.
        """
        return cls(
            guideline=Guideline.from_dict(data["guideline"]),
            match_score=data.get("match_score", 1.0),
            matched_fields=tuple(data.get("matched_fields", ())),
        )


@dataclass(frozen=True)
class EvaluatedContext:
    """Result of evaluating guidelines for a context.

    Attributes:
        context: The input task context that was evaluated.
        matched_guidelines: Guidelines that matched, sorted by priority.
        combined_instruction: Merged instruction text from all matches.
        tools_allowed: Aggregated allowed tool patterns.
        tools_denied: Aggregated denied tool patterns.
        hitl_gates: HITL gate types required by matched guidelines.
    """

    context: TaskContext
    matched_guidelines: tuple[EvaluatedGuideline, ...] = ()
    combined_instruction: str = ""
    tools_allowed: tuple[str, ...] = ()
    tools_denied: tuple[str, ...] = ()
    hitl_gates: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dictionary representation with all tuple fields as lists.
        """
        return {
            "context": self.context.to_dict(),
            "matched_guidelines": [g.to_dict() for g in self.matched_guidelines],
            "combined_instruction": self.combined_instruction,
            "tools_allowed": list(self.tools_allowed),
            "tools_denied": list(self.tools_denied),
            "hitl_gates": list(self.hitl_gates),
        }


@dataclass(frozen=True)
class GateDecision:
    """A HITL gate decision record.

    Attributes:
        guideline_id: ID of the guideline that triggered the gate.
        gate_type: Type of HITL gate (e.g. ``"devops_invocation"``).
        result: Decision result: ``"approved"``, ``"rejected"``, or ``"skipped"``.
        reason: Human-readable reason for the decision.
        user_response: Raw user response text.
        context: Optional task context at the time of decision.
    """

    guideline_id: str
    gate_type: str
    result: str
    reason: str = ""
    user_response: str = ""
    context: TaskContext | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dictionary representation.  The ``context`` key is only
            included when the context is not None.
        """
        d: dict[str, Any] = {
            "guideline_id": self.guideline_id,
            "gate_type": self.gate_type,
            "result": self.result,
            "reason": self.reason,
            "user_response": self.user_response,
        }
        if self.context:
            d["context"] = self.context.to_dict()
        return d
