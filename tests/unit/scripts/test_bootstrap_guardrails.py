"""Tests for the bootstrap_guardrails script.

Validates that default guidelines are properly generated from project
rules and can be upserted into the GuardrailsStore idempotently.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.guardrails.exceptions import GuidelineNotFoundError
from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
)


# ---------------------------------------------------------------------------
# Import the module under test
# ---------------------------------------------------------------------------

from scripts.bootstrap_guardrails import get_default_guidelines, upsert_guidelines


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

AGENT_ROLES = ["backend", "frontend", "orchestrator", "devops", "test-writer", "debugger"]

MANDATORY_HITL_GATES = [
    "devops_invocation",
    "protected_path_commit",
    "contract_change",
    "destructive_workstation_op",
]


# ---------------------------------------------------------------------------
# get_default_guidelines() tests
# ---------------------------------------------------------------------------


class TestGetDefaultGuidelines:
    """Tests for the get_default_guidelines function."""

    def test_returns_nonempty_list(self) -> None:
        """get_default_guidelines returns a non-empty list."""
        guidelines = get_default_guidelines()
        assert len(guidelines) > 0

    def test_all_items_are_guideline_instances(self) -> None:
        """Every item in the returned list is a Guideline dataclass."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert isinstance(g, Guideline), f"Expected Guideline, got {type(g)}"

    def test_no_duplicate_ids(self) -> None:
        """All guideline IDs are unique."""
        guidelines = get_default_guidelines()
        ids = [g.id for g in guidelines]
        assert len(ids) == len(set(ids)), (
            f"Duplicate IDs found: {[x for x in ids if ids.count(x) > 1]}"
        )

    def test_all_have_valid_category(self) -> None:
        """Every guideline has a valid GuidelineCategory."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert isinstance(g.category, GuidelineCategory), (
                f"Guideline {g.id} has invalid category: {g.category}"
            )

    def test_all_have_valid_action_type(self) -> None:
        """Every guideline action has a valid ActionType."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert isinstance(g.action.type, ActionType), (
                f"Guideline {g.id} has invalid action type: {g.action.type}"
            )

    def test_all_have_condition(self) -> None:
        """Every guideline has a non-None condition."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert isinstance(g.condition, GuidelineCondition), (
                f"Guideline {g.id} has invalid condition: {g.condition}"
            )

    def test_all_have_created_by_bootstrap(self) -> None:
        """Every guideline has created_by set to 'bootstrap'."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert g.created_by == "bootstrap", (
                f"Guideline {g.id} has created_by={g.created_by!r}"
            )

    def test_all_have_version_1(self) -> None:
        """Every bootstrap guideline starts at version 1."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert g.version == 1, (
                f"Guideline {g.id} has version={g.version}"
            )

    def test_all_are_enabled(self) -> None:
        """Every bootstrap guideline is enabled by default."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert g.enabled is True, (
                f"Guideline {g.id} is not enabled"
            )

    def test_all_have_datetime_fields(self) -> None:
        """Every guideline has valid datetime created_at and updated_at."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert isinstance(g.created_at, datetime), (
                f"Guideline {g.id} created_at is not datetime"
            )
            assert isinstance(g.updated_at, datetime), (
                f"Guideline {g.id} updated_at is not datetime"
            )

    def test_all_have_priority_in_range(self) -> None:
        """All priorities are within the valid 0-1000 range."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            assert 0 <= g.priority <= 1000, (
                f"Guideline {g.id} has priority={g.priority} out of range"
            )

    def test_guidelines_are_serializable(self) -> None:
        """Every guideline can round-trip through to_dict/from_dict."""
        guidelines = get_default_guidelines()
        for g in guidelines:
            d = g.to_dict()
            restored = Guideline.from_dict(d)
            assert restored.id == g.id
            assert restored.category == g.category
            assert restored.action.type == g.action.type


class TestCognitiveIsolationGuidelines:
    """Tests for cognitive isolation guidelines (one per agent role)."""

    def _get_cognitive_guidelines(self) -> list[Guideline]:
        return [
            g for g in get_default_guidelines()
            if g.category == GuidelineCategory.COGNITIVE_ISOLATION
        ]

    def test_exists_for_all_agent_roles(self) -> None:
        """There is one cognitive isolation guideline per agent role."""
        guidelines = self._get_cognitive_guidelines()
        agent_sets = set()
        for g in guidelines:
            assert g.condition.agents is not None
            for agent in g.condition.agents:
                agent_sets.add(agent)
        for role in AGENT_ROLES:
            assert role in agent_sets, (
                f"Missing cognitive isolation guideline for agent: {role}"
            )

    def test_category_is_cognitive_isolation(self) -> None:
        """All cognitive isolation guidelines have correct category."""
        for g in self._get_cognitive_guidelines():
            assert g.category == GuidelineCategory.COGNITIVE_ISOLATION

    def test_action_type_is_tool_restriction(self) -> None:
        """Cognitive isolation guidelines use TOOL_RESTRICTION action."""
        for g in self._get_cognitive_guidelines():
            assert g.action.type == ActionType.TOOL_RESTRICTION, (
                f"Guideline {g.id} action type is {g.action.type}"
            )

    def test_priority_is_900(self) -> None:
        """Cognitive isolation guidelines have priority 900."""
        for g in self._get_cognitive_guidelines():
            assert g.priority == 900, (
                f"Guideline {g.id} has priority={g.priority}, expected 900"
            )

    def test_has_path_instructions(self) -> None:
        """Each cognitive isolation guideline has an instruction with path info."""
        for g in self._get_cognitive_guidelines():
            assert g.action.instruction is not None
            assert len(g.action.instruction) > 0, (
                f"Guideline {g.id} has empty instruction"
            )


class TestHITLGateGuidelines:
    """Tests for HITL gate guidelines."""

    def _get_hitl_guidelines(self) -> list[Guideline]:
        return [
            g for g in get_default_guidelines()
            if g.category == GuidelineCategory.HITL_GATE
        ]

    def test_at_least_four_hitl_guidelines(self) -> None:
        """There are at least 4 HITL gate guidelines (mandatory gates)."""
        guidelines = self._get_hitl_guidelines()
        assert len(guidelines) >= 4, (
            f"Expected at least 4 HITL guidelines, got {len(guidelines)}"
        )

    def test_category_is_hitl_gate(self) -> None:
        """All HITL gate guidelines have correct category."""
        for g in self._get_hitl_guidelines():
            assert g.category == GuidelineCategory.HITL_GATE

    def test_action_type_is_hitl_gate(self) -> None:
        """HITL gate guidelines use HITL_GATE action type."""
        for g in self._get_hitl_guidelines():
            assert g.action.type == ActionType.HITL_GATE, (
                f"Guideline {g.id} action type is {g.action.type}"
            )

    def test_priority_is_at_least_940(self) -> None:
        """HITL gate guidelines have priority >= 940 (mandatory=950, advisory=940)."""
        for g in self._get_hitl_guidelines():
            assert g.priority >= 940, (
                f"Guideline {g.id} has priority={g.priority}, expected >= 940"
            )

    def test_each_has_gate_type(self) -> None:
        """Each HITL gate guideline specifies a gate_type in the action."""
        for g in self._get_hitl_guidelines():
            assert g.action.gate_type is not None, (
                f"Guideline {g.id} missing gate_type"
            )

    def test_covers_mandatory_gates(self) -> None:
        """HITL guidelines cover all mandatory gate types."""
        guidelines = self._get_hitl_guidelines()
        gate_types = {g.action.gate_type for g in guidelines}
        for gate in MANDATORY_HITL_GATES:
            assert gate in gate_types, (
                f"Missing HITL guideline for mandatory gate: {gate}"
            )


class TestTDDProtocolGuideline:
    """Tests for the TDD protocol guideline."""

    def _get_tdd_guidelines(self) -> list[Guideline]:
        return [
            g for g in get_default_guidelines()
            if g.category == GuidelineCategory.TDD_PROTOCOL
        ]

    def test_tdd_guideline_exists(self) -> None:
        """At least one TDD protocol guideline exists."""
        guidelines = self._get_tdd_guidelines()
        assert len(guidelines) >= 1

    def test_category_is_tdd_protocol(self) -> None:
        """TDD guideline has the correct category."""
        for g in self._get_tdd_guidelines():
            assert g.category == GuidelineCategory.TDD_PROTOCOL

    def test_action_type_is_constraint_or_instruction(self) -> None:
        """TDD guidelines use CONSTRAINT or INSTRUCTION action type."""
        allowed = {ActionType.CONSTRAINT, ActionType.INSTRUCTION}
        for g in self._get_tdd_guidelines():
            assert g.action.type in allowed, (
                f"Guideline {g.id} action type is {g.action.type}, "
                f"expected one of {allowed}"
            )

    def test_require_tests_is_true(self) -> None:
        """TDD guideline has require_tests=True."""
        for g in self._get_tdd_guidelines():
            assert g.action.require_tests is True, (
                f"Guideline {g.id} require_tests is not True"
            )

    def test_priority_in_tdd_range(self) -> None:
        """TDD guidelines have priority in 800-810 range."""
        for g in self._get_tdd_guidelines():
            assert 800 <= g.priority <= 810, (
                f"Guideline {g.id} has priority={g.priority}, expected 800-810"
            )

    def test_condition_includes_implementation_actions(self) -> None:
        """TDD guideline condition includes implementation actions."""
        for g in self._get_tdd_guidelines():
            assert g.condition.actions is not None
            assert len(g.condition.actions) > 0, (
                f"Guideline {g.id} has no actions in condition"
            )


class TestContextConstraintGuidelines:
    """Tests for context constraint guidelines."""

    def _get_context_guidelines(self) -> list[Guideline]:
        return [
            g for g in get_default_guidelines()
            if g.category == GuidelineCategory.CONTEXT_CONSTRAINT
        ]

    def test_at_least_two_context_guidelines(self) -> None:
        """At least 2 context constraint guidelines exist."""
        guidelines = self._get_context_guidelines()
        assert len(guidelines) >= 2, (
            f"Expected at least 2 context constraint guidelines, "
            f"got {len(guidelines)}"
        )

    def test_category_is_context_constraint(self) -> None:
        """All context constraint guidelines have correct category."""
        for g in self._get_context_guidelines():
            assert g.category == GuidelineCategory.CONTEXT_CONSTRAINT

    def test_priority_is_700(self) -> None:
        """Context constraint guidelines have priority 700."""
        for g in self._get_context_guidelines():
            assert g.priority == 700, (
                f"Guideline {g.id} has priority={g.priority}, expected 700"
            )


# ---------------------------------------------------------------------------
# upsert_guidelines() tests
# ---------------------------------------------------------------------------


class TestUpsertGuidelines:
    """Tests for the upsert_guidelines function."""

    def _make_guideline(self, gid: str = "test-guideline") -> Guideline:
        """Create a minimal test guideline."""
        now = datetime.now(timezone.utc)
        return Guideline(
            id=gid,
            name="Test Guideline",
            description="A test guideline.",
            enabled=True,
            category=GuidelineCategory.CUSTOM,
            priority=500,
            condition=GuidelineCondition(),
            action=GuidelineAction(type=ActionType.INSTRUCTION, instruction="test"),
            metadata={},
            version=1,
            created_at=now,
            updated_at=now,
            created_by="bootstrap",
        )

    @pytest.mark.asyncio
    async def test_creates_new_guidelines(self) -> None:
        """upsert_guidelines creates guidelines that do not exist."""
        store = AsyncMock()
        store.get_guideline = AsyncMock(
            side_effect=GuidelineNotFoundError("test-1")
        )
        store.create_guideline = AsyncMock()

        guidelines = [self._make_guideline("test-1")]
        result = await upsert_guidelines(store, guidelines)

        store.create_guideline.assert_called_once()
        assert result["created"] == 1
        assert result["skipped"] == 0
        assert result["errors"] == 0

    @pytest.mark.asyncio
    async def test_skips_existing_guidelines(self) -> None:
        """upsert_guidelines skips guidelines that already exist."""
        existing = self._make_guideline("existing-1")
        store = AsyncMock()
        store.get_guideline = AsyncMock(return_value=existing)

        guidelines = [self._make_guideline("existing-1")]
        result = await upsert_guidelines(store, guidelines)

        store.create_guideline.assert_not_called()
        assert result["created"] == 0
        assert result["skipped"] == 1
        assert result["errors"] == 0

    @pytest.mark.asyncio
    async def test_handles_errors_gracefully(self) -> None:
        """upsert_guidelines increments error count on failures."""
        store = AsyncMock()
        store.get_guideline = AsyncMock(
            side_effect=GuidelineNotFoundError("err-1")
        )
        store.create_guideline = AsyncMock(
            side_effect=RuntimeError("ES connection failed")
        )

        guidelines = [self._make_guideline("err-1")]
        result = await upsert_guidelines(store, guidelines)

        assert result["errors"] == 1
        assert result["created"] == 0

    @pytest.mark.asyncio
    async def test_returns_correct_mixed_counts(self) -> None:
        """upsert_guidelines returns correct counts with mixed outcomes."""
        existing = self._make_guideline("exists")

        def side_effect(gid: str) -> Guideline:
            if gid == "exists":
                return existing
            raise GuidelineNotFoundError(gid)

        store = AsyncMock()
        store.get_guideline = AsyncMock(side_effect=side_effect)
        store.create_guideline = AsyncMock()

        guidelines = [
            self._make_guideline("exists"),
            self._make_guideline("new-1"),
            self._make_guideline("new-2"),
        ]
        result = await upsert_guidelines(store, guidelines)

        assert result["created"] == 2
        assert result["skipped"] == 1
        assert result["errors"] == 0

    @pytest.mark.asyncio
    async def test_dry_run_does_not_call_store(self) -> None:
        """Dry run mode does not call any store methods."""
        store = AsyncMock()

        guidelines = [self._make_guideline("dry-1")]
        result = await upsert_guidelines(store, guidelines, dry_run=True)

        store.get_guideline.assert_not_called()
        store.create_guideline.assert_not_called()
        assert result["created"] == 0
        assert result["skipped"] == 0
        assert result["errors"] == 0
        assert result["dry_run"] is True

    @pytest.mark.asyncio
    async def test_empty_list_returns_zero_counts(self) -> None:
        """upsert_guidelines with empty list returns all-zero counts."""
        store = AsyncMock()

        result = await upsert_guidelines(store, [])

        assert result["created"] == 0
        assert result["skipped"] == 0
        assert result["errors"] == 0
