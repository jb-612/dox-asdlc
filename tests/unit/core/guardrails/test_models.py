"""Unit tests for guardrails data models.

Tests cover Guideline, GuidelineCondition, GuidelineAction, TaskContext
dataclasses, GuidelineCategory and ActionType enums, serialization
round-trips, and frozen immutability.
"""

from __future__ import annotations

import dataclasses
from datetime import datetime, timezone

import pytest

from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
)


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def _make_condition(**overrides: object) -> GuidelineCondition:
    """Create a GuidelineCondition with sensible defaults, overrideable."""
    defaults: dict = {
        "agents": ["backend"],
        "domains": ["P01"],
        "actions": ["implement"],
        "paths": ["src/workers/*"],
        "events": ["commit"],
        "gate_types": ["mandatory"],
        "custom": {"key": "value"},
    }
    defaults.update(overrides)
    return GuidelineCondition(**defaults)


def _make_action(**overrides: object) -> GuidelineAction:
    """Create a GuidelineAction with sensible defaults, overrideable."""
    defaults: dict = {
        "type": ActionType.INSTRUCTION,
        "instruction": "Follow TDD protocol.",
        "tools_allowed": ["Bash(python*)"],
        "tools_denied": ["Bash(rm*)"],
        "gate_type": "mandatory",
        "gate_threshold": "high",
        "max_files": 10,
        "require_tests": True,
        "require_review": True,
        "parameters": {"timeout": 30},
    }
    defaults.update(overrides)
    return GuidelineAction(**defaults)


def _make_guideline(**overrides: object) -> Guideline:
    """Create a Guideline with sensible defaults, overrideable."""
    now = datetime(2026, 2, 5, 10, 0, 0, tzinfo=timezone.utc)
    defaults: dict = {
        "id": "test-guideline-001",
        "name": "Test Guideline",
        "description": "A test guideline for unit tests.",
        "enabled": True,
        "category": GuidelineCategory.TDD_PROTOCOL,
        "priority": 500,
        "condition": _make_condition(),
        "action": _make_action(),
        "metadata": {"source": "unit-test"},
        "version": 1,
        "created_at": now,
        "updated_at": now,
        "created_by": "test-user",
    }
    defaults.update(overrides)
    return Guideline(**defaults)


# ===========================================================================
# GuidelineCategory enum tests
# ===========================================================================

class TestGuidelineCategory:
    """Tests for the GuidelineCategory enum."""

    def test_all_expected_values_exist(self) -> None:
        """All required category values are present."""
        expected = {
            "cognitive_isolation",
            "hitl_gate",
            "tdd_protocol",
            "context_constraint",
            "audit_telemetry",
            "security",
            "custom",
        }
        actual = {member.value for member in GuidelineCategory}
        assert actual == expected

    def test_is_string_enum(self) -> None:
        """GuidelineCategory members are strings."""
        assert isinstance(GuidelineCategory.COGNITIVE_ISOLATION, str)
        assert GuidelineCategory.COGNITIVE_ISOLATION == "cognitive_isolation"

    def test_from_value(self) -> None:
        """Category can be constructed from its string value."""
        assert GuidelineCategory("tdd_protocol") is GuidelineCategory.TDD_PROTOCOL

    def test_invalid_value_raises(self) -> None:
        """Invalid string raises ValueError."""
        with pytest.raises(ValueError):
            GuidelineCategory("nonexistent_category")


# ===========================================================================
# ActionType enum tests
# ===========================================================================

class TestActionType:
    """Tests for the ActionType enum."""

    def test_all_expected_values_exist(self) -> None:
        """All required action type values are present."""
        expected = {
            "instruction",
            "tool_restriction",
            "hitl_gate",
            "constraint",
            "telemetry",
        }
        actual = {member.value for member in ActionType}
        assert actual == expected

    def test_is_string_enum(self) -> None:
        """ActionType members are strings."""
        assert isinstance(ActionType.INSTRUCTION, str)
        assert ActionType.INSTRUCTION == "instruction"

    def test_from_value(self) -> None:
        """ActionType can be constructed from its string value."""
        assert ActionType("tool_restriction") is ActionType.TOOL_RESTRICTION

    def test_invalid_value_raises(self) -> None:
        """Invalid string raises ValueError."""
        with pytest.raises(ValueError):
            ActionType("nonexistent_type")


# ===========================================================================
# GuidelineCondition tests
# ===========================================================================

class TestGuidelineCondition:
    """Tests for GuidelineCondition dataclass."""

    def test_creation_with_all_fields(self) -> None:
        """Condition can be created with every field specified."""
        cond = _make_condition()
        assert cond.agents == ["backend"]
        assert cond.domains == ["P01"]
        assert cond.actions == ["implement"]
        assert cond.paths == ["src/workers/*"]
        assert cond.events == ["commit"]
        assert cond.gate_types == ["mandatory"]
        assert cond.custom == {"key": "value"}

    def test_creation_with_no_fields(self) -> None:
        """Condition defaults all fields to None (wildcard)."""
        cond = GuidelineCondition()
        assert cond.agents is None
        assert cond.domains is None
        assert cond.actions is None
        assert cond.paths is None
        assert cond.events is None
        assert cond.gate_types is None
        assert cond.custom is None

    def test_creation_with_partial_fields(self) -> None:
        """Condition can be created with a subset of fields."""
        cond = GuidelineCondition(agents=["frontend"], domains=["P05"])
        assert cond.agents == ["frontend"]
        assert cond.domains == ["P05"]
        assert cond.actions is None

    def test_multiple_agents(self) -> None:
        """Condition supports multiple agents (OR within list)."""
        cond = GuidelineCondition(agents=["backend", "orchestrator"])
        assert len(cond.agents) == 2

    def test_frozen_immutability(self) -> None:
        """Condition is immutable (frozen dataclass)."""
        cond = _make_condition()
        with pytest.raises(dataclasses.FrozenInstanceError):
            cond.agents = ["new"]  # type: ignore[misc]

    def test_to_dict(self) -> None:
        """to_dict produces a plain dictionary."""
        cond = _make_condition()
        d = cond.to_dict()
        assert isinstance(d, dict)
        assert d["agents"] == ["backend"]
        assert d["domains"] == ["P01"]
        assert d["custom"] == {"key": "value"}

    def test_to_dict_excludes_none(self) -> None:
        """to_dict excludes None values for clean serialization."""
        cond = GuidelineCondition(agents=["backend"])
        d = cond.to_dict()
        assert d["agents"] == ["backend"]
        # None fields should not be present in output
        assert "domains" not in d or d["domains"] is None

    def test_from_dict_round_trip(self) -> None:
        """from_dict(to_dict(x)) produces an equal object."""
        original = _make_condition()
        rebuilt = GuidelineCondition.from_dict(original.to_dict())
        assert rebuilt == original

    def test_from_dict_with_missing_keys(self) -> None:
        """from_dict handles missing optional keys gracefully."""
        data: dict = {"agents": ["backend"]}
        cond = GuidelineCondition.from_dict(data)
        assert cond.agents == ["backend"]
        assert cond.domains is None


# ===========================================================================
# GuidelineAction tests
# ===========================================================================

class TestGuidelineAction:
    """Tests for GuidelineAction dataclass."""

    def test_creation_with_all_fields(self) -> None:
        """Action can be created with every field."""
        action = _make_action()
        assert action.type == ActionType.INSTRUCTION
        assert action.instruction == "Follow TDD protocol."
        assert action.tools_allowed == ["Bash(python*)"]
        assert action.tools_denied == ["Bash(rm*)"]
        assert action.gate_type == "mandatory"
        assert action.gate_threshold == "high"
        assert action.max_files == 10
        assert action.require_tests is True
        assert action.require_review is True
        assert action.parameters == {"timeout": 30}

    def test_creation_instruction_type(self) -> None:
        """Action with INSTRUCTION type needs only instruction text."""
        action = GuidelineAction(
            type=ActionType.INSTRUCTION,
            instruction="Always write tests first.",
        )
        assert action.type == ActionType.INSTRUCTION
        assert action.instruction == "Always write tests first."
        assert action.tools_allowed is None

    def test_creation_tool_restriction_type(self) -> None:
        """Action with TOOL_RESTRICTION type uses tools_allowed/denied."""
        action = GuidelineAction(
            type=ActionType.TOOL_RESTRICTION,
            tools_allowed=["Bash(python*)", "Bash(pip*)"],
            tools_denied=["Bash(rm*)", "Bash(sudo*)"],
        )
        assert action.type == ActionType.TOOL_RESTRICTION
        assert len(action.tools_allowed) == 2
        assert len(action.tools_denied) == 2

    def test_creation_hitl_gate_type(self) -> None:
        """Action with HITL_GATE type uses gate_type and threshold."""
        action = GuidelineAction(
            type=ActionType.HITL_GATE,
            gate_type="devops_invocation",
            gate_threshold="mandatory",
        )
        assert action.type == ActionType.HITL_GATE
        assert action.gate_type == "devops_invocation"
        assert action.gate_threshold == "mandatory"

    def test_creation_constraint_type(self) -> None:
        """Action with CONSTRAINT type uses max_files and require flags."""
        action = GuidelineAction(
            type=ActionType.CONSTRAINT,
            max_files=5,
            require_tests=True,
            require_review=False,
        )
        assert action.type == ActionType.CONSTRAINT
        assert action.max_files == 5
        assert action.require_tests is True
        assert action.require_review is False

    def test_creation_telemetry_type(self) -> None:
        """Action with TELEMETRY type can use parameters dict."""
        action = GuidelineAction(
            type=ActionType.TELEMETRY,
            parameters={"log_level": "debug", "metrics_enabled": True},
        )
        assert action.type == ActionType.TELEMETRY
        assert action.parameters["log_level"] == "debug"

    def test_frozen_immutability(self) -> None:
        """Action is immutable (frozen dataclass)."""
        action = _make_action()
        with pytest.raises(dataclasses.FrozenInstanceError):
            action.instruction = "changed"  # type: ignore[misc]

    def test_to_dict(self) -> None:
        """to_dict produces a plain dictionary with enum as value."""
        action = _make_action()
        d = action.to_dict()
        assert isinstance(d, dict)
        # ActionType should be serialized as its string value
        assert d["type"] == "instruction"
        assert d["instruction"] == "Follow TDD protocol."
        assert d["tools_allowed"] == ["Bash(python*)"]

    def test_from_dict_round_trip(self) -> None:
        """from_dict(to_dict(x)) produces an equal object."""
        original = _make_action()
        rebuilt = GuidelineAction.from_dict(original.to_dict())
        assert rebuilt == original

    def test_from_dict_with_enum_value(self) -> None:
        """from_dict accepts enum string values."""
        data = {"type": "tool_restriction", "tools_denied": ["Bash(rm*)"]}
        action = GuidelineAction.from_dict(data)
        assert action.type == ActionType.TOOL_RESTRICTION

    def test_from_dict_with_enum_name(self) -> None:
        """from_dict also accepts enum names (upper case)."""
        data = {"type": "TOOL_RESTRICTION"}
        action = GuidelineAction.from_dict(data)
        assert action.type == ActionType.TOOL_RESTRICTION


# ===========================================================================
# Guideline tests
# ===========================================================================

class TestGuideline:
    """Tests for the Guideline dataclass."""

    def test_creation_with_all_fields(self) -> None:
        """Guideline can be created with all required fields."""
        g = _make_guideline()
        assert g.id == "test-guideline-001"
        assert g.name == "Test Guideline"
        assert g.description == "A test guideline for unit tests."
        assert g.enabled is True
        assert g.category == GuidelineCategory.TDD_PROTOCOL
        assert g.priority == 500
        assert isinstance(g.condition, GuidelineCondition)
        assert isinstance(g.action, GuidelineAction)
        assert g.metadata == {"source": "unit-test"}
        assert g.version == 1
        assert isinstance(g.created_at, datetime)
        assert isinstance(g.updated_at, datetime)
        assert g.created_by == "test-user"

    def test_priority_boundary_zero(self) -> None:
        """Priority of 0 is valid (lowest)."""
        g = _make_guideline(priority=0)
        assert g.priority == 0

    def test_priority_boundary_thousand(self) -> None:
        """Priority of 1000 is valid (highest)."""
        g = _make_guideline(priority=1000)
        assert g.priority == 1000

    def test_disabled_guideline(self) -> None:
        """Guideline can be created in disabled state."""
        g = _make_guideline(enabled=False)
        assert g.enabled is False

    def test_frozen_immutability(self) -> None:
        """Guideline is immutable (frozen dataclass)."""
        g = _make_guideline()
        with pytest.raises(dataclasses.FrozenInstanceError):
            g.name = "changed"  # type: ignore[misc]

    def test_frozen_immutability_nested(self) -> None:
        """Top-level field reassignment is blocked on frozen guideline."""
        g = _make_guideline()
        with pytest.raises(dataclasses.FrozenInstanceError):
            g.condition = GuidelineCondition()  # type: ignore[misc]

    def test_to_dict(self) -> None:
        """to_dict serializes all fields correctly."""
        g = _make_guideline()
        d = g.to_dict()

        assert isinstance(d, dict)
        assert d["id"] == "test-guideline-001"
        assert d["name"] == "Test Guideline"
        assert d["enabled"] is True
        # Category should be serialized as string value
        assert d["category"] == "tdd_protocol"
        assert d["priority"] == 500
        # Nested objects are dicts
        assert isinstance(d["condition"], dict)
        assert isinstance(d["action"], dict)
        # Datetime should be ISO format string
        assert isinstance(d["created_at"], str)
        assert isinstance(d["updated_at"], str)
        assert d["version"] == 1
        assert d["created_by"] == "test-user"

    def test_to_dict_datetime_iso_format(self) -> None:
        """to_dict serializes datetime as ISO 8601 string."""
        now = datetime(2026, 2, 5, 10, 30, 45, tzinfo=timezone.utc)
        g = _make_guideline(created_at=now, updated_at=now)
        d = g.to_dict()
        assert d["created_at"] == now.isoformat()
        assert d["updated_at"] == now.isoformat()

    def test_from_dict_round_trip(self) -> None:
        """from_dict(to_dict(x)) produces an equal object."""
        original = _make_guideline()
        rebuilt = Guideline.from_dict(original.to_dict())
        assert rebuilt == original

    def test_from_dict_with_category_value(self) -> None:
        """from_dict accepts category as string value."""
        d = _make_guideline().to_dict()
        d["category"] = "security"
        g = Guideline.from_dict(d)
        assert g.category == GuidelineCategory.SECURITY

    def test_from_dict_with_category_name(self) -> None:
        """from_dict also accepts category enum name."""
        d = _make_guideline().to_dict()
        d["category"] = "SECURITY"
        g = Guideline.from_dict(d)
        assert g.category == GuidelineCategory.SECURITY

    def test_from_dict_parses_datetime_string(self) -> None:
        """from_dict parses ISO datetime strings back to datetime."""
        d = _make_guideline().to_dict()
        g = Guideline.from_dict(d)
        assert isinstance(g.created_at, datetime)
        assert isinstance(g.updated_at, datetime)

    def test_different_categories(self) -> None:
        """Guidelines can use any category."""
        for cat in GuidelineCategory:
            g = _make_guideline(category=cat)
            assert g.category == cat

    def test_metadata_dict(self) -> None:
        """Metadata supports arbitrary key-value pairs."""
        meta = {"source": "bootstrap", "rule_file": "pm-cli.md", "version": 2}
        g = _make_guideline(metadata=meta)
        assert g.metadata["rule_file"] == "pm-cli.md"


# ===========================================================================
# TaskContext tests
# ===========================================================================

class TestTaskContext:
    """Tests for the TaskContext dataclass."""

    def test_creation_with_agent_only(self) -> None:
        """TaskContext requires only the agent field."""
        ctx = TaskContext(agent="backend")
        assert ctx.agent == "backend"
        assert ctx.domain is None
        assert ctx.action is None
        assert ctx.paths is None
        assert ctx.event is None
        assert ctx.gate_type is None
        assert ctx.tenant_id is None
        assert ctx.session_id is None
        assert ctx.metadata is None

    def test_creation_with_all_fields(self) -> None:
        """TaskContext can be created with every field."""
        ctx = TaskContext(
            agent="frontend",
            domain="P05",
            action="implement",
            paths=["src/hitl_ui/App.tsx"],
            event="commit",
            gate_type="advisory",
            tenant_id="tenant-1",
            session_id="session-abc",
            metadata={"extra": "info"},
        )
        assert ctx.agent == "frontend"
        assert ctx.domain == "P05"
        assert ctx.action == "implement"
        assert ctx.paths == ["src/hitl_ui/App.tsx"]
        assert ctx.event == "commit"
        assert ctx.gate_type == "advisory"
        assert ctx.tenant_id == "tenant-1"
        assert ctx.session_id == "session-abc"
        assert ctx.metadata == {"extra": "info"}

    def test_frozen_immutability(self) -> None:
        """TaskContext is immutable (frozen dataclass)."""
        ctx = TaskContext(agent="backend")
        with pytest.raises(dataclasses.FrozenInstanceError):
            ctx.agent = "frontend"  # type: ignore[misc]

    def test_to_dict(self) -> None:
        """to_dict produces a plain dictionary."""
        ctx = TaskContext(
            agent="backend",
            domain="P01",
            action="implement",
        )
        d = ctx.to_dict()
        assert isinstance(d, dict)
        assert d["agent"] == "backend"
        assert d["domain"] == "P01"
        assert d["action"] == "implement"

    def test_from_dict_round_trip(self) -> None:
        """from_dict(to_dict(x)) produces an equal object."""
        original = TaskContext(
            agent="devops",
            domain="P06",
            action="deploy",
            paths=["docker/workers/Dockerfile"],
            event="deploy",
            gate_type="mandatory",
            tenant_id="t-42",
            session_id="s-99",
            metadata={"env": "staging"},
        )
        rebuilt = TaskContext.from_dict(original.to_dict())
        assert rebuilt == original

    def test_from_dict_minimal(self) -> None:
        """from_dict works with only required fields."""
        data = {"agent": "planner"}
        ctx = TaskContext.from_dict(data)
        assert ctx.agent == "planner"
        assert ctx.domain is None

    def test_multiple_paths(self) -> None:
        """TaskContext supports multiple file paths."""
        ctx = TaskContext(
            agent="backend",
            paths=["src/workers/a.py", "src/workers/b.py", "src/core/c.py"],
        )
        assert len(ctx.paths) == 3


# ===========================================================================
# Cross-cutting / integration-style tests
# ===========================================================================

class TestSerializationRoundTrips:
    """Round-trip tests ensuring to_dict -> from_dict fidelity."""

    def test_guideline_full_round_trip(self) -> None:
        """Full Guideline with nested condition/action survives round-trip."""
        original = _make_guideline()
        serialized = original.to_dict()
        deserialized = Guideline.from_dict(serialized)
        assert deserialized == original

    def test_guideline_with_empty_condition(self) -> None:
        """Guideline with wildcard condition (all None) round-trips."""
        original = _make_guideline(condition=GuidelineCondition())
        serialized = original.to_dict()
        deserialized = Guideline.from_dict(serialized)
        assert deserialized == original
        assert deserialized.condition.agents is None

    def test_guideline_with_minimal_action(self) -> None:
        """Guideline with minimal action round-trips."""
        action = GuidelineAction(type=ActionType.INSTRUCTION)
        original = _make_guideline(action=action)
        serialized = original.to_dict()
        deserialized = Guideline.from_dict(serialized)
        assert deserialized == original

    def test_task_context_empty_metadata(self) -> None:
        """TaskContext with None metadata round-trips."""
        original = TaskContext(agent="reviewer")
        serialized = original.to_dict()
        deserialized = TaskContext.from_dict(serialized)
        assert deserialized == original

    def test_guideline_condition_custom_dict(self) -> None:
        """Custom dict in condition is preserved through round-trip."""
        custom = {"min_coverage": 80, "lang": "python"}
        cond = GuidelineCondition(custom=custom)
        rebuilt = GuidelineCondition.from_dict(cond.to_dict())
        assert rebuilt.custom == custom

    def test_guideline_action_parameters_dict(self) -> None:
        """Parameters dict in action is preserved through round-trip."""
        params = {"timeout": 60, "retries": 3, "flag": True}
        action = GuidelineAction(
            type=ActionType.TELEMETRY,
            parameters=params,
        )
        rebuilt = GuidelineAction.from_dict(action.to_dict())
        assert rebuilt.parameters == params
