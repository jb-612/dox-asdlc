"""Unit tests for GuardrailsEvaluator and new result dataclasses.

Tests cover:
- EvaluatedGuideline, EvaluatedContext, GateDecision dataclasses
- GuardrailsEvaluator initialization with dependency injection
- get_context() skeleton returning EvaluatedContext
- log_decision() calling the audit store
"""

from __future__ import annotations

import dataclasses
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.core.guardrails.models import (
    ActionType,
    EvaluatedContext,
    EvaluatedGuideline,
    GateDecision,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
)
from src.core.guardrails.evaluator import GuardrailsEvaluator


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def _make_condition(**overrides: object) -> GuidelineCondition:
    """Create a GuidelineCondition with sensible defaults."""
    defaults: dict[str, Any] = {
        "agents": ["backend"],
        "domains": ["P01"],
        "actions": ["implement"],
    }
    defaults.update(overrides)
    return GuidelineCondition(**defaults)


def _make_action(**overrides: object) -> GuidelineAction:
    """Create a GuidelineAction with sensible defaults."""
    defaults: dict[str, Any] = {
        "type": ActionType.INSTRUCTION,
        "instruction": "Follow TDD protocol.",
    }
    defaults.update(overrides)
    return GuidelineAction(**defaults)


def _make_guideline(**overrides: object) -> Guideline:
    """Create a Guideline with sensible defaults."""
    now = datetime(2026, 2, 5, 10, 0, 0, tzinfo=timezone.utc)
    defaults: dict[str, Any] = {
        "id": "test-guideline-001",
        "name": "Test Guideline",
        "description": "A test guideline.",
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


def _make_context(**overrides: object) -> TaskContext:
    """Create a TaskContext with sensible defaults."""
    defaults: dict[str, Any] = {
        "agent": "backend",
        "domain": "P01",
        "action": "implement",
        "session_id": "session-test-001",
    }
    defaults.update(overrides)
    return TaskContext(**defaults)


def _make_mock_store() -> AsyncMock:
    """Create a mock GuardrailsStore with default async responses."""
    store = AsyncMock()
    store.list_guidelines = AsyncMock(return_value=([], 0))
    store.log_audit_entry = AsyncMock(return_value="audit-entry-001")
    return store


# ===========================================================================
# EvaluatedGuideline dataclass tests
# ===========================================================================

class TestEvaluatedGuideline:
    """Tests for the EvaluatedGuideline frozen dataclass."""

    def test_creation_with_defaults(self) -> None:
        """EvaluatedGuideline can be created with only guideline; defaults apply."""
        guideline = _make_guideline()
        eg = EvaluatedGuideline(guideline=guideline)
        assert eg.guideline is guideline
        assert eg.match_score == 1.0
        assert eg.matched_fields == ()

    def test_creation_with_all_fields(self) -> None:
        """EvaluatedGuideline can be created with all fields specified."""
        guideline = _make_guideline()
        eg = EvaluatedGuideline(
            guideline=guideline,
            match_score=0.75,
            matched_fields=("agents", "domains"),
        )
        assert eg.match_score == 0.75
        assert eg.matched_fields == ("agents", "domains")

    def test_frozen_immutability(self) -> None:
        """EvaluatedGuideline is frozen (immutable)."""
        eg = EvaluatedGuideline(guideline=_make_guideline())
        with pytest.raises(dataclasses.FrozenInstanceError):
            eg.match_score = 0.5  # type: ignore[misc]

    def test_to_dict(self) -> None:
        """to_dict serializes all fields correctly."""
        guideline = _make_guideline()
        eg = EvaluatedGuideline(
            guideline=guideline,
            match_score=0.9,
            matched_fields=("agents",),
        )
        d = eg.to_dict()
        assert isinstance(d, dict)
        assert d["match_score"] == 0.9
        assert d["matched_fields"] == ["agents"]
        assert isinstance(d["guideline"], dict)
        assert d["guideline"]["id"] == "test-guideline-001"

    def test_from_dict_round_trip(self) -> None:
        """from_dict(to_dict(x)) produces an equal object."""
        original = EvaluatedGuideline(
            guideline=_make_guideline(),
            match_score=0.8,
            matched_fields=("agents", "domains"),
        )
        rebuilt = EvaluatedGuideline.from_dict(original.to_dict())
        assert rebuilt == original

    def test_from_dict_with_defaults(self) -> None:
        """from_dict handles missing optional fields by using defaults."""
        guideline = _make_guideline()
        data = {"guideline": guideline.to_dict()}
        eg = EvaluatedGuideline.from_dict(data)
        assert eg.match_score == 1.0
        assert eg.matched_fields == ()


# ===========================================================================
# EvaluatedContext dataclass tests
# ===========================================================================

class TestEvaluatedContext:
    """Tests for the EvaluatedContext frozen dataclass."""

    def test_creation_with_defaults(self) -> None:
        """EvaluatedContext can be created with only context; defaults apply."""
        ctx = _make_context()
        ec = EvaluatedContext(context=ctx)
        assert ec.context is ctx
        assert ec.matched_guidelines == ()
        assert ec.combined_instruction == ""
        assert ec.tools_allowed == ()
        assert ec.tools_denied == ()
        assert ec.hitl_gates == ()

    def test_creation_with_matched_guidelines(self) -> None:
        """EvaluatedContext holds a tuple of matched guidelines."""
        ctx = _make_context()
        eg1 = EvaluatedGuideline(guideline=_make_guideline(id="g1"))
        eg2 = EvaluatedGuideline(guideline=_make_guideline(id="g2"))
        ec = EvaluatedContext(
            context=ctx,
            matched_guidelines=(eg1, eg2),
            combined_instruction="Do this. Then that.",
            tools_allowed=("python", "pip"),
            tools_denied=("rm",),
            hitl_gates=("devops_invocation",),
        )
        assert len(ec.matched_guidelines) == 2
        assert ec.combined_instruction == "Do this. Then that."
        assert ec.tools_allowed == ("python", "pip")
        assert ec.tools_denied == ("rm",)
        assert ec.hitl_gates == ("devops_invocation",)

    def test_frozen_immutability(self) -> None:
        """EvaluatedContext is frozen (immutable)."""
        ec = EvaluatedContext(context=_make_context())
        with pytest.raises(dataclasses.FrozenInstanceError):
            ec.combined_instruction = "changed"  # type: ignore[misc]

    def test_to_dict(self) -> None:
        """to_dict serializes all fields correctly."""
        ctx = _make_context()
        eg = EvaluatedGuideline(
            guideline=_make_guideline(),
            match_score=1.0,
            matched_fields=("agents",),
        )
        ec = EvaluatedContext(
            context=ctx,
            matched_guidelines=(eg,),
            combined_instruction="Follow TDD.",
            tools_allowed=("python",),
            tools_denied=("rm",),
            hitl_gates=("gate1",),
        )
        d = ec.to_dict()
        assert isinstance(d, dict)
        assert d["combined_instruction"] == "Follow TDD."
        assert d["tools_allowed"] == ["python"]
        assert d["tools_denied"] == ["rm"]
        assert d["hitl_gates"] == ["gate1"]
        assert len(d["matched_guidelines"]) == 1
        assert isinstance(d["context"], dict)
        assert d["context"]["agent"] == "backend"

    def test_to_dict_empty(self) -> None:
        """to_dict works with default empty values."""
        ec = EvaluatedContext(context=_make_context())
        d = ec.to_dict()
        assert d["matched_guidelines"] == []
        assert d["combined_instruction"] == ""
        assert d["tools_allowed"] == []
        assert d["tools_denied"] == []
        assert d["hitl_gates"] == []


# ===========================================================================
# GateDecision dataclass tests
# ===========================================================================

class TestGateDecision:
    """Tests for the GateDecision frozen dataclass."""

    def test_creation_with_all_fields(self) -> None:
        """GateDecision can be created with all fields."""
        ctx = _make_context()
        gd = GateDecision(
            guideline_id="g-001",
            gate_type="devops_invocation",
            result="approved",
            reason="User confirmed deployment.",
            user_response="Y",
            context=ctx,
        )
        assert gd.guideline_id == "g-001"
        assert gd.gate_type == "devops_invocation"
        assert gd.result == "approved"
        assert gd.reason == "User confirmed deployment."
        assert gd.user_response == "Y"
        assert gd.context is ctx

    def test_creation_with_defaults(self) -> None:
        """GateDecision defaults reason/user_response to empty, context to None."""
        gd = GateDecision(
            guideline_id="g-002",
            gate_type="protected_path",
            result="rejected",
        )
        assert gd.reason == ""
        assert gd.user_response == ""
        assert gd.context is None

    def test_frozen_immutability(self) -> None:
        """GateDecision is frozen (immutable)."""
        gd = GateDecision(
            guideline_id="g-001",
            gate_type="test",
            result="approved",
        )
        with pytest.raises(dataclasses.FrozenInstanceError):
            gd.result = "rejected"  # type: ignore[misc]

    def test_to_dict_with_context(self) -> None:
        """to_dict includes context when present."""
        ctx = _make_context()
        gd = GateDecision(
            guideline_id="g-001",
            gate_type="devops_invocation",
            result="approved",
            reason="Confirmed.",
            user_response="Y",
            context=ctx,
        )
        d = gd.to_dict()
        assert isinstance(d, dict)
        assert d["guideline_id"] == "g-001"
        assert d["gate_type"] == "devops_invocation"
        assert d["result"] == "approved"
        assert d["reason"] == "Confirmed."
        assert d["user_response"] == "Y"
        assert "context" in d
        assert d["context"]["agent"] == "backend"

    def test_to_dict_without_context(self) -> None:
        """to_dict omits context key when context is None."""
        gd = GateDecision(
            guideline_id="g-002",
            gate_type="protected_path",
            result="rejected",
        )
        d = gd.to_dict()
        assert "context" not in d
        assert d["guideline_id"] == "g-002"
        assert d["result"] == "rejected"
        assert d["reason"] == ""
        assert d["user_response"] == ""


# ===========================================================================
# GuardrailsEvaluator tests
# ===========================================================================

class TestGuardrailsEvaluatorInit:
    """Tests for GuardrailsEvaluator initialization."""

    def test_evaluator_initialization(self) -> None:
        """Evaluator accepts a GuardrailsStore and stores it."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        assert evaluator._store is store

    def test_evaluator_store_is_accessible(self) -> None:
        """The internal store reference is the same object passed in."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        assert evaluator._store is store


class TestGuardrailsEvaluatorGetContext:
    """Tests for GuardrailsEvaluator.get_context()."""

    @pytest.mark.asyncio
    async def test_get_context_returns_evaluated_context(self) -> None:
        """get_context returns an EvaluatedContext with the given TaskContext."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        ctx = _make_context()

        result = await evaluator.get_context(ctx)

        assert isinstance(result, EvaluatedContext)
        assert result.context is ctx

    @pytest.mark.asyncio
    async def test_get_context_fetches_enabled_guidelines(self) -> None:
        """get_context calls store.list_guidelines with enabled=True."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        ctx = _make_context()

        await evaluator.get_context(ctx)

        store.list_guidelines.assert_awaited_once_with(
            enabled=True, page_size=1000
        )

    @pytest.mark.asyncio
    async def test_get_context_empty_store_returns_empty_matches(self) -> None:
        """get_context with empty store returns no matched guidelines."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        ctx = _make_context()

        result = await evaluator.get_context(ctx)

        assert result.matched_guidelines == ()
        assert result.combined_instruction == ""


class TestGuardrailsEvaluatorLogDecision:
    """Tests for GuardrailsEvaluator.log_decision()."""

    @pytest.mark.asyncio
    async def test_log_decision_calls_store(self) -> None:
        """log_decision calls store.log_audit_entry with correct structure."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        decision = GateDecision(
            guideline_id="g-001",
            gate_type="devops_invocation",
            result="approved",
            reason="Confirmed.",
            user_response="Y",
        )

        await evaluator.log_decision(decision)

        store.log_audit_entry.assert_awaited_once()
        entry = store.log_audit_entry.call_args[0][0]
        assert entry["event_type"] == "gate_decision"
        assert entry["guideline_id"] == "g-001"
        assert entry["gate_type"] == "devops_invocation"
        assert "timestamp" in entry
        assert entry["decision"]["result"] == "approved"
        assert entry["decision"]["reason"] == "Confirmed."
        assert entry["decision"]["user_response"] == "Y"

    @pytest.mark.asyncio
    async def test_log_decision_includes_gate_type_in_audit_entry(self) -> None:
        """gate_type is included as a top-level field in the audit entry."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        decision = GateDecision(
            guideline_id="g-gate",
            gate_type="protected_path_commit",
            result="approved",
            reason="User confirmed",
        )

        await evaluator.log_decision(decision)

        entry = store.log_audit_entry.call_args[0][0]
        assert entry["gate_type"] == "protected_path_commit"

    @pytest.mark.asyncio
    async def test_log_decision_returns_audit_id(self) -> None:
        """log_decision returns the ID from store.log_audit_entry."""
        store = _make_mock_store()
        store.log_audit_entry.return_value = "audit-xyz-789"
        evaluator = GuardrailsEvaluator(store=store)
        decision = GateDecision(
            guideline_id="g-001",
            gate_type="test",
            result="approved",
        )

        result = await evaluator.log_decision(decision)

        assert result == "audit-xyz-789"

    @pytest.mark.asyncio
    async def test_log_decision_includes_context(self) -> None:
        """When decision has context, it is included in the audit entry."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        ctx = _make_context(
            agent="backend",
            domain="P01",
            action="implement",
            session_id="session-abc",
        )
        decision = GateDecision(
            guideline_id="g-001",
            gate_type="devops_invocation",
            result="approved",
            context=ctx,
        )

        await evaluator.log_decision(decision)

        entry = store.log_audit_entry.call_args[0][0]
        assert "context" in entry
        assert entry["context"]["agent"] == "backend"
        assert entry["context"]["domain"] == "P01"
        assert entry["context"]["action"] == "implement"
        assert entry["context"]["session_id"] == "session-abc"

    @pytest.mark.asyncio
    async def test_log_decision_without_context(self) -> None:
        """When decision has no context, entry has no context key."""
        store = _make_mock_store()
        evaluator = GuardrailsEvaluator(store=store)
        decision = GateDecision(
            guideline_id="g-002",
            gate_type="protected_path",
            result="rejected",
        )

        await evaluator.log_decision(decision)

        entry = store.log_audit_entry.call_args[0][0]
        assert "context" not in entry
