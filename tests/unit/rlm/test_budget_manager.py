"""Unit tests for SubCallBudgetManager."""

from __future__ import annotations

import pytest

from src.core.exceptions import BudgetExceededError
from src.workers.rlm.budget_manager import SubCallBudgetManager


class TestSubCallBudgetManagerInit:
    """Tests for initialization and validation."""

    def test_create_with_defaults(self) -> None:
        """Test creating with default values."""
        budget = SubCallBudgetManager()
        assert budget.max_total == 50
        assert budget.max_per_iteration == 8
        assert budget.total_used == 0
        assert budget.iteration_used == 0

    def test_create_with_custom_values(self) -> None:
        """Test creating with custom limits."""
        budget = SubCallBudgetManager(max_total=100, max_per_iteration=10)
        assert budget.max_total == 100
        assert budget.max_per_iteration == 10

    def test_invalid_max_total_zero(self) -> None:
        """Test validation rejects zero max_total."""
        with pytest.raises(ValueError, match="max_total must be at least 1"):
            SubCallBudgetManager(max_total=0, max_per_iteration=5)

    def test_invalid_max_total_negative(self) -> None:
        """Test validation rejects negative max_total."""
        with pytest.raises(ValueError, match="max_total must be at least 1"):
            SubCallBudgetManager(max_total=-1, max_per_iteration=5)

    def test_invalid_max_per_iteration_zero(self) -> None:
        """Test validation rejects zero max_per_iteration."""
        with pytest.raises(ValueError, match="max_per_iteration must be at least 1"):
            SubCallBudgetManager(max_total=50, max_per_iteration=0)

    def test_invalid_per_iteration_exceeds_total(self) -> None:
        """Test validation rejects per_iteration > total."""
        with pytest.raises(ValueError, match="cannot exceed max_total"):
            SubCallBudgetManager(max_total=10, max_per_iteration=20)


class TestCanMakeCall:
    """Tests for can_make_call method."""

    def test_can_make_call_fresh_budget(self) -> None:
        """Test can_make_call with fresh budget."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)
        assert budget.can_make_call() is True
        assert budget.can_make_call(5) is True

    def test_can_make_call_at_iteration_limit(self) -> None:
        """Test can_make_call at iteration limit."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=5)
        budget.total_used = 5
        budget.iteration_used = 5

        assert budget.can_make_call() is False
        assert budget.can_make_call(1) is False

    def test_can_make_call_at_total_limit(self) -> None:
        """Test can_make_call at total limit."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)
        budget.total_used = 10

        assert budget.can_make_call() is False

    def test_can_make_call_multiple(self) -> None:
        """Test can_make_call with multiple calls."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)
        budget.total_used = 8

        assert budget.can_make_call(2) is True
        assert budget.can_make_call(3) is False

    def test_can_make_call_zero_or_negative(self) -> None:
        """Test can_make_call with invalid counts."""
        budget = SubCallBudgetManager()
        assert budget.can_make_call(0) is False
        assert budget.can_make_call(-1) is False


class TestRecordCall:
    """Tests for record_call method."""

    def test_record_single_call(self) -> None:
        """Test recording a single call."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)
        budget.record_call()

        assert budget.total_used == 1
        assert budget.iteration_used == 1

    def test_record_multiple_calls(self) -> None:
        """Test recording multiple calls at once."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)
        budget.record_call(3)

        assert budget.total_used == 3
        assert budget.iteration_used == 3

    def test_record_call_exceeds_total(self) -> None:
        """Test record_call raises when exceeding total budget."""
        budget = SubCallBudgetManager(max_total=5, max_per_iteration=5)
        budget.total_used = 4

        with pytest.raises(BudgetExceededError):
            budget.record_call(2)

    def test_record_call_exceeds_iteration(self) -> None:
        """Test record_call raises when exceeding iteration budget."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=5)
        budget.iteration_used = 4

        with pytest.raises(BudgetExceededError):
            budget.record_call(2)

    def test_record_call_zero_is_noop(self) -> None:
        """Test record_call with zero count does nothing."""
        budget = SubCallBudgetManager()
        budget.record_call(0)
        assert budget.total_used == 0

    def test_record_call_negative_is_noop(self) -> None:
        """Test record_call with negative count does nothing."""
        budget = SubCallBudgetManager()
        budget.record_call(-1)
        assert budget.total_used == 0


class TestRecordCallIfAllowed:
    """Tests for record_call_if_allowed method."""

    def test_returns_true_when_allowed(self) -> None:
        """Test returns True and records when allowed."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)

        result = budget.record_call_if_allowed()
        assert result is True
        assert budget.total_used == 1

    def test_returns_false_when_budget_exceeded(self) -> None:
        """Test returns False without recording when exceeded."""
        budget = SubCallBudgetManager(max_total=5, max_per_iteration=5)
        budget.total_used = 5

        result = budget.record_call_if_allowed()
        assert result is False
        assert budget.total_used == 5  # Unchanged

    def test_no_exception_on_budget_exceeded(self) -> None:
        """Test no exception is raised when budget exceeded."""
        budget = SubCallBudgetManager(max_total=1, max_per_iteration=1)
        budget.total_used = 1

        # Should not raise
        result = budget.record_call_if_allowed()
        assert result is False


class TestResetIteration:
    """Tests for reset_iteration method."""

    def test_reset_clears_iteration_used(self) -> None:
        """Test reset clears iteration counter."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=5)
        budget.iteration_used = 5

        budget.reset_iteration()
        assert budget.iteration_used == 0

    def test_reset_preserves_total_used(self) -> None:
        """Test reset preserves total counter."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=5)
        budget.total_used = 10
        budget.iteration_used = 5

        budget.reset_iteration()
        assert budget.total_used == 10  # Preserved

    def test_reset_increments_iteration_count(self) -> None:
        """Test reset increments iteration counter."""
        budget = SubCallBudgetManager()

        assert budget.iteration_count == 0
        budget.reset_iteration()
        assert budget.iteration_count == 1
        budget.reset_iteration()
        assert budget.iteration_count == 2

    def test_reset_saves_history(self) -> None:
        """Test reset saves snapshot to history."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=5)
        budget.record_call(3)

        budget.reset_iteration()
        history = budget.get_history()

        assert len(history) == 1
        assert history[0].total_used == 3
        assert history[0].iteration_used == 3


class TestProperties:
    """Tests for computed properties."""

    def test_remaining(self) -> None:
        """Test remaining property."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=8)
        assert budget.remaining == 50

        budget.total_used = 30
        assert budget.remaining == 20

    def test_iteration_remaining(self) -> None:
        """Test iteration_remaining property."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=8)
        assert budget.iteration_remaining == 8

        budget.iteration_used = 3
        assert budget.iteration_remaining == 5

    def test_is_exhausted(self) -> None:
        """Test is_exhausted property."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)
        assert budget.is_exhausted is False

        budget.total_used = 10
        assert budget.is_exhausted is True

    def test_iteration_exhausted(self) -> None:
        """Test iteration_exhausted property."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=5)
        assert budget.iteration_exhausted is False

        budget.iteration_used = 5
        assert budget.iteration_exhausted is True


class TestRequireBudget:
    """Tests for require_budget method."""

    def test_require_budget_succeeds_when_available(self) -> None:
        """Test require_budget passes when budget available."""
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=5)

        # Should not raise
        budget.require_budget(5)

    def test_require_budget_raises_when_exceeded(self) -> None:
        """Test require_budget raises when budget exceeded."""
        budget = SubCallBudgetManager(max_total=5, max_per_iteration=5)
        budget.total_used = 4

        with pytest.raises(BudgetExceededError) as exc_info:
            budget.require_budget(2)

        assert exc_info.value.budget_limit == 5
        assert exc_info.value.subcalls_used == 4


class TestSnapshot:
    """Tests for snapshot method."""

    def test_snapshot_captures_state(self) -> None:
        """Test snapshot captures current state."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=8)
        budget.total_used = 15
        budget.iteration_used = 3

        snapshot = budget.snapshot()

        assert snapshot.total_used == 15
        assert snapshot.iteration_used == 3
        assert snapshot.remaining == 35
        assert snapshot.timestamp is not None

    def test_snapshot_is_independent(self) -> None:
        """Test snapshot is independent of later changes."""
        budget = SubCallBudgetManager()
        snapshot1 = budget.snapshot()

        budget.record_call(5)
        snapshot2 = budget.snapshot()

        assert snapshot1.total_used == 0
        assert snapshot2.total_used == 5


class TestToDict:
    """Tests for to_dict method."""

    def test_to_dict_includes_all_fields(self) -> None:
        """Test to_dict includes all expected fields."""
        budget = SubCallBudgetManager(max_total=100, max_per_iteration=10)
        budget.total_used = 25
        budget.iteration_used = 5
        budget.iteration_count = 3

        d = budget.to_dict()

        assert d["max_total"] == 100
        assert d["max_per_iteration"] == 10
        assert d["total_used"] == 25
        assert d["iteration_used"] == 5
        assert d["iteration_count"] == 3
        assert d["remaining"] == 75
        assert d["iteration_remaining"] == 5
        assert d["is_exhausted"] is False


class TestRepr:
    """Tests for __repr__ method."""

    def test_repr(self) -> None:
        """Test string representation."""
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=8)
        budget.total_used = 20
        budget.iteration_used = 5

        repr_str = repr(budget)

        assert "20/50" in repr_str
        assert "5/8" in repr_str
        assert "remaining=30" in repr_str
