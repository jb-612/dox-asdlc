"""Unit tests for condition matching logic in GuardrailsEvaluator.

Tests cover:
- _condition_matches() private method with all field types
- AND logic across fields (all non-None must match)
- OR logic within list fields (any item matches)
- Wildcard behavior for None and empty list fields
- Path glob pattern matching via fnmatch
- matched_fields tracking
- get_context() integration with condition matching and priority sorting
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
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

def _make_condition(**overrides: object) -> GuidelineCondition:
    """Create a GuidelineCondition with all fields None (wildcard) by default."""
    defaults: dict[str, Any] = {}
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


def _make_evaluator(store: AsyncMock | None = None) -> GuardrailsEvaluator:
    """Create a GuardrailsEvaluator with a mock store."""
    if store is None:
        store = _make_mock_store()
    return GuardrailsEvaluator(store=store)


# ===========================================================================
# _condition_matches() - single field matching
# ===========================================================================


class TestSingleFieldMatching:
    """Tests for individual field matching in _condition_matches."""

    def test_single_agent_match(self) -> None:
        """condition.agents=['backend'], context.agent='backend' matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=["backend"])
        context = _make_context(agent="backend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "agents" in matched_fields

    def test_multiple_agents_or_logic(self) -> None:
        """condition.agents=['backend', 'frontend'], context.agent='frontend' matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=["backend", "frontend"])
        context = _make_context(agent="frontend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "agents" in matched_fields

    def test_agent_mismatch(self) -> None:
        """condition.agents=['backend'], context.agent='frontend' does not match."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=["backend"])
        context = _make_context(agent="frontend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()

    def test_domain_matching(self) -> None:
        """condition.domains=['P01'], context.domain='P01' matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(domains=["P01"])
        context = _make_context(domain="P01")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "domains" in matched_fields

    def test_domain_mismatch(self) -> None:
        """condition.domains=['P01'], context.domain='P05' does not match."""
        evaluator = _make_evaluator()
        condition = _make_condition(domains=["P01"])
        context = _make_context(domain="P05")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()

    def test_action_matching(self) -> None:
        """condition.actions=['implement', 'test'], context.action='test' matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(actions=["implement", "test"])
        context = _make_context(action="test")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "actions" in matched_fields

    def test_event_matching(self) -> None:
        """condition.events=['commit'], context.event='commit' matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(events=["commit"])
        context = _make_context(event="commit")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "events" in matched_fields

    def test_gate_type_matching(self) -> None:
        """condition.gate_types=['mandatory'], context.gate_type='mandatory' matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(gate_types=["mandatory"])
        context = _make_context(gate_type="mandatory")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "gate_types" in matched_fields


# ===========================================================================
# _condition_matches() - path glob matching
# ===========================================================================


class TestPathGlobMatching:
    """Tests for path glob pattern matching in _condition_matches."""

    def test_path_glob_match(self) -> None:
        """condition.paths=['src/workers/*'], context.paths=['src/workers/pool.py'] matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(paths=["src/workers/*"])
        context = _make_context(paths=["src/workers/pool.py"])

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "paths" in matched_fields

    def test_path_glob_mismatch(self) -> None:
        """condition.paths=['src/workers/*'], context.paths=['src/hitl_ui/foo.tsx'] no match."""
        evaluator = _make_evaluator()
        condition = _make_condition(paths=["src/workers/*"])
        context = _make_context(paths=["src/hitl_ui/foo.tsx"])

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()

    def test_path_multiple_patterns(self) -> None:
        """Multiple condition patterns, one matches a context path."""
        evaluator = _make_evaluator()
        condition = _make_condition(
            paths=["src/workers/*", "src/orchestrator/*"]
        )
        context = _make_context(paths=["src/orchestrator/main.py"])

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "paths" in matched_fields

    def test_path_multiple_context_paths_one_matches(self) -> None:
        """Multiple context paths, at least one matches a condition pattern."""
        evaluator = _make_evaluator()
        condition = _make_condition(paths=["src/workers/*"])
        context = _make_context(
            paths=["src/hitl_ui/foo.tsx", "src/workers/pool.py"]
        )

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "paths" in matched_fields

    def test_path_recursive_glob(self) -> None:
        """Recursive glob pattern 'src/**' should match nested files."""
        evaluator = _make_evaluator()
        condition = _make_condition(paths=["src/workers/*.py"])
        context = _make_context(paths=["src/workers/deep.py"])

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "paths" in matched_fields


# ===========================================================================
# _condition_matches() - AND logic across fields
# ===========================================================================


class TestAndLogicAcrossFields:
    """Tests for AND logic across multiple condition fields."""

    def test_multiple_conditions_and_logic(self) -> None:
        """Both agents and domains specified; both must match."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=["backend"], domains=["P01"])
        context = _make_context(agent="backend", domain="P01")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "agents" in matched_fields
        assert "domains" in matched_fields

    def test_partial_and_logic_fails(self) -> None:
        """Agents match but domains do not; overall no match."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=["backend"], domains=["P05"])
        context = _make_context(agent="backend", domain="P01")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()

    def test_three_fields_all_match(self) -> None:
        """Three non-None fields all match -> overall match."""
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            domains=["P01"],
            actions=["implement"],
        )
        context = _make_context(
            agent="backend", domain="P01", action="implement"
        )

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert set(matched_fields) == {"agents", "domains", "actions"}

    def test_three_fields_one_fails(self) -> None:
        """Three non-None fields but one fails -> overall no match."""
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            domains=["P01"],
            actions=["review"],  # does not match "implement"
        )
        context = _make_context(
            agent="backend", domain="P01", action="implement"
        )

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()


# ===========================================================================
# _condition_matches() - wildcard and edge cases
# ===========================================================================


class TestWildcardAndEdgeCases:
    """Tests for None/empty wildcard behavior and edge cases."""

    def test_empty_condition_matches_all(self) -> None:
        """GuidelineCondition() with all None matches any context."""
        evaluator = _make_evaluator()
        condition = GuidelineCondition()
        context = _make_context(agent="backend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert matched_fields == ()

    def test_none_fields_are_wildcards(self) -> None:
        """condition.agents=None means wildcard; not added to matched_fields."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=None, domains=["P01"])
        context = _make_context(agent="backend", domain="P01")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        # agents is None -> wildcard, only domains should be in matched_fields
        assert "agents" not in matched_fields
        assert "domains" in matched_fields

    def test_empty_list_is_wildcard(self) -> None:
        """condition.agents=[] treated same as None (wildcard)."""
        evaluator = _make_evaluator()
        condition = _make_condition(agents=[], domains=["P01"])
        context = _make_context(agent="frontend", domain="P01")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "agents" not in matched_fields
        assert "domains" in matched_fields

    def test_context_field_none_condition_has_value(self) -> None:
        """condition.domains=['P01'], context.domain=None -> no match."""
        evaluator = _make_evaluator()
        condition = _make_condition(domains=["P01"])
        context = _make_context(domain=None)

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()

    def test_context_paths_none_condition_has_paths(self) -> None:
        """condition.paths=['src/*'], context.paths=None -> no match."""
        evaluator = _make_evaluator()
        condition = _make_condition(paths=["src/*"])
        context = _make_context(paths=None)

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()

    def test_context_event_none_condition_has_event(self) -> None:
        """condition.events=['commit'], context.event=None -> no match."""
        evaluator = _make_evaluator()
        condition = _make_condition(events=["commit"])
        context = _make_context(event=None)

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is False
        assert matched_fields == ()


# ===========================================================================
# _condition_matches() - matched_fields tracking
# ===========================================================================


class TestMatchedFieldsTracking:
    """Tests for verifying matched_fields contains correct field names."""

    def test_matched_fields_tracked(self) -> None:
        """matched_fields tuple contains correct field names for all matched."""
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            domains=["P01"],
            actions=["implement"],
            events=["commit"],
            gate_types=["mandatory"],
        )
        context = _make_context(
            agent="backend",
            domain="P01",
            action="implement",
            event="commit",
            gate_type="mandatory",
        )

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert set(matched_fields) == {
            "agents",
            "domains",
            "actions",
            "events",
            "gate_types",
        }

    def test_matched_fields_includes_paths(self) -> None:
        """matched_fields includes 'paths' when path condition matches."""
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            paths=["src/workers/*.py"],
        )
        context = _make_context(
            agent="backend",
            paths=["src/workers/pool.py"],
        )

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert set(matched_fields) == {"agents", "paths"}

    def test_matched_fields_empty_for_all_wildcards(self) -> None:
        """With all wildcard conditions, matched_fields is empty tuple."""
        evaluator = _make_evaluator()
        condition = GuidelineCondition()
        context = _make_context()

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert matched_fields == ()


# ===========================================================================
# get_context() integration with condition matching
# ===========================================================================


class TestGetContextIntegration:
    """Tests for get_context() using condition matching logic."""

    @pytest.mark.asyncio
    async def test_get_context_filters_by_condition(self) -> None:
        """get_context returns only guidelines matching the context."""
        matching_guideline = _make_guideline(
            id="g-match",
            condition=_make_condition(agents=["backend"]),
            priority=500,
        )
        non_matching_guideline = _make_guideline(
            id="g-nomatch",
            condition=_make_condition(agents=["frontend"]),
            priority=600,
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = (
            [matching_guideline, non_matching_guideline],
            2,
        )
        evaluator = GuardrailsEvaluator(store=store)
        context = _make_context(agent="backend")

        result = await evaluator.get_context(context)

        assert isinstance(result, EvaluatedContext)
        assert len(result.matched_guidelines) == 1
        assert result.matched_guidelines[0].guideline.id == "g-match"

    @pytest.mark.asyncio
    async def test_get_context_sorts_by_priority(self) -> None:
        """Higher priority guidelines appear first in results."""
        low_priority = _make_guideline(
            id="g-low",
            condition=_make_condition(agents=["backend"]),
            priority=100,
        )
        high_priority = _make_guideline(
            id="g-high",
            condition=_make_condition(agents=["backend"]),
            priority=900,
        )
        mid_priority = _make_guideline(
            id="g-mid",
            condition=_make_condition(agents=["backend"]),
            priority=500,
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = (
            [low_priority, high_priority, mid_priority],
            3,
        )
        evaluator = GuardrailsEvaluator(store=store)
        context = _make_context(agent="backend")

        result = await evaluator.get_context(context)

        assert len(result.matched_guidelines) == 3
        priorities = [
            eg.guideline.priority for eg in result.matched_guidelines
        ]
        assert priorities == [900, 500, 100]

    @pytest.mark.asyncio
    async def test_get_context_no_matches_returns_empty(self) -> None:
        """get_context with no matching guidelines returns empty tuple."""
        guideline = _make_guideline(
            id="g-frontend",
            condition=_make_condition(agents=["frontend"]),
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = ([guideline], 1)
        evaluator = GuardrailsEvaluator(store=store)
        context = _make_context(agent="backend")

        result = await evaluator.get_context(context)

        assert len(result.matched_guidelines) == 0
        assert result.matched_guidelines == ()

    @pytest.mark.asyncio
    async def test_get_context_match_score_calculation(self) -> None:
        """match_score is calculated as len(matched_fields) / total_non_none_fields."""
        guideline_two_fields = _make_guideline(
            id="g-two",
            condition=_make_condition(agents=["backend"], domains=["P01"]),
            priority=500,
        )
        guideline_wildcard = _make_guideline(
            id="g-wildcard",
            condition=GuidelineCondition(),
            priority=400,
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = (
            [guideline_two_fields, guideline_wildcard],
            2,
        )
        evaluator = GuardrailsEvaluator(store=store)
        context = _make_context(agent="backend", domain="P01")

        result = await evaluator.get_context(context)

        assert len(result.matched_guidelines) == 2

        # Guideline with two matched fields: 2/2 = 1.0
        two_field_match = [
            eg for eg in result.matched_guidelines if eg.guideline.id == "g-two"
        ][0]
        assert two_field_match.match_score == 1.0
        assert set(two_field_match.matched_fields) == {"agents", "domains"}

        # Wildcard guideline: 0 non-none fields, defaults to 1.0 (perfect match)
        wildcard_match = [
            eg
            for eg in result.matched_guidelines
            if eg.guideline.id == "g-wildcard"
        ][0]
        assert wildcard_match.match_score == 1.0
        assert wildcard_match.matched_fields == ()


# ===========================================================================
# _condition_matches() - custom condition field semantics
# ===========================================================================


class TestCustomConditionSemantics:
    """Tests for the `custom` field on GuidelineCondition.

    The `custom` field exists for future extensibility.  The current
    evaluator implementation intentionally ignores it during condition
    matching -- it is neither checked nor counted as a non-wildcard field.
    These tests document this behavior explicitly.
    """

    def test_custom_empty_dict_still_matches(self) -> None:
        """A guideline with custom={} matches (custom is ignored by evaluator).

        The custom field with an empty dict should not affect matching at all.
        """
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            custom={},  # Empty custom dict
        )
        context = _make_context(agent="backend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "agents" in matched_fields
        # custom is not treated as a matchable field
        assert "custom" not in matched_fields

    def test_custom_with_values_still_matches(self) -> None:
        """A guideline with custom={"key": "value"} still matches.

        The custom field is intentionally ignored by the evaluator.
        This documents current behavior: custom is for future extensibility
        and has no effect on condition matching today.
        """
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            custom={"project_type": "microservice", "team": "platform"},
        )
        context = _make_context(agent="backend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "agents" in matched_fields
        # custom is not a matched field
        assert "custom" not in matched_fields

    def test_custom_does_not_affect_match_score(self) -> None:
        """The custom field does not contribute to the match score denominator.

        Since custom is ignored by the evaluator, it should not appear in
        the count of non-None fields used for score calculation.
        """
        evaluator = _make_evaluator()
        # Condition with 1 real field (agents) and custom data
        condition_with_custom = _make_condition(
            agents=["backend"],
            custom={"some_key": "some_value"},
        )
        # Condition with 1 real field (agents) and no custom data
        condition_without_custom = _make_condition(
            agents=["backend"],
        )

        # Both should have the same non-None field count (just agents=1)
        count_with = evaluator._count_non_none_fields(condition_with_custom)
        count_without = evaluator._count_non_none_fields(condition_without_custom)

        assert count_with == count_without == 1

    def test_custom_none_is_wildcard_like_other_fields(self) -> None:
        """custom=None behaves like other None fields -- effectively a wildcard.

        This is the default state for the custom field.
        """
        evaluator = _make_evaluator()
        condition = _make_condition(
            agents=["backend"],
            custom=None,  # Explicit None
        )
        context = _make_context(agent="backend")

        matches, matched_fields = evaluator._condition_matches(condition, context)

        assert matches is True
        assert "custom" not in matched_fields

    @pytest.mark.asyncio
    async def test_custom_field_in_full_evaluation_flow(self) -> None:
        """Guidelines with custom field participate in full get_context() evaluation.

        The custom field should not prevent a guideline from being matched
        or affect its priority ordering.
        """
        g_with_custom = _make_guideline(
            id="g-custom",
            priority=500,
            condition=_make_condition(
                agents=["backend"],
                custom={"feature_flag": "experimental"},
            ),
            action=_make_action(instruction="Custom guideline rule."),
        )
        g_without_custom = _make_guideline(
            id="g-no-custom",
            priority=600,
            condition=_make_condition(agents=["backend"]),
            action=_make_action(instruction="Standard guideline rule."),
        )

        store = _make_mock_store()
        store.list_guidelines.return_value = (
            [g_with_custom, g_without_custom],
            2,
        )
        evaluator = GuardrailsEvaluator(store=store)
        context = _make_context(agent="backend")

        result = await evaluator.get_context(context)

        # Both guidelines should match
        assert len(result.matched_guidelines) == 2
        # Higher priority first
        assert result.matched_guidelines[0].guideline.id == "g-no-custom"
        assert result.matched_guidelines[1].guideline.id == "g-custom"
        # Both should have score 1.0 (agents matched fully)
        assert result.matched_guidelines[0].match_score == 1.0
        assert result.matched_guidelines[1].match_score == 1.0
