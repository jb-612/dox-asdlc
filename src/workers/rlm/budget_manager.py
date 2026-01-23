"""Sub-call budget management for RLM exploration.

Tracks and enforces limits on sub-calls to control costs and prevent runaway
exploration loops.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from src.core.exceptions import BudgetExceededError

logger = logging.getLogger(__name__)


@dataclass
class BudgetSnapshot:
    """Point-in-time snapshot of budget state.

    Attributes:
        total_used: Total sub-calls used
        iteration_used: Sub-calls used in current iteration
        remaining: Remaining sub-calls in budget
        timestamp: When the snapshot was taken
    """

    total_used: int
    iteration_used: int
    remaining: int
    timestamp: datetime


@dataclass
class SubCallBudgetManager:
    """Tracks and enforces sub-call limits for RLM exploration.

    The budget manager tracks both total and per-iteration sub-call usage,
    preventing excessive API calls during exploration.

    Attributes:
        max_total: Maximum total sub-calls allowed
        max_per_iteration: Maximum sub-calls per exploration iteration
        total_used: Total sub-calls used so far
        iteration_used: Sub-calls used in current iteration
        iteration_count: Number of iterations completed

    Example:
        budget = SubCallBudgetManager(max_total=50, max_per_iteration=8)

        # Before each call
        if budget.can_make_call():
            budget.record_call()
            # ... make the call

        # At the end of each iteration
        budget.reset_iteration()
    """

    max_total: int = 50
    max_per_iteration: int = 8
    total_used: int = field(default=0, init=False)
    iteration_used: int = field(default=0, init=False)
    iteration_count: int = field(default=0, init=False)
    _history: list[BudgetSnapshot] = field(default_factory=list, init=False)

    def __post_init__(self) -> None:
        """Validate configuration."""
        if self.max_total < 1:
            raise ValueError("max_total must be at least 1")
        if self.max_per_iteration < 1:
            raise ValueError("max_per_iteration must be at least 1")
        if self.max_per_iteration > self.max_total:
            raise ValueError("max_per_iteration cannot exceed max_total")

    @property
    def remaining(self) -> int:
        """Return the number of remaining sub-calls."""
        return self.max_total - self.total_used

    @property
    def iteration_remaining(self) -> int:
        """Return remaining sub-calls in current iteration."""
        return self.max_per_iteration - self.iteration_used

    @property
    def is_exhausted(self) -> bool:
        """Check if total budget is exhausted."""
        return self.total_used >= self.max_total

    @property
    def iteration_exhausted(self) -> bool:
        """Check if iteration budget is exhausted."""
        return self.iteration_used >= self.max_per_iteration

    def can_make_call(self, count: int = 1) -> bool:
        """Check if a call (or multiple calls) can be made within budget.

        Args:
            count: Number of calls to check (default: 1)

        Returns:
            True if the call(s) can be made within both total and iteration limits
        """
        if count < 1:
            return False
        total_ok = (self.total_used + count) <= self.max_total
        iteration_ok = (self.iteration_used + count) <= self.max_per_iteration
        return total_ok and iteration_ok

    def record_call(self, count: int = 1) -> None:
        """Record that sub-call(s) were made.

        Args:
            count: Number of sub-calls made (default: 1)

        Raises:
            BudgetExceededError: If the call would exceed the budget
        """
        if count < 1:
            return

        if not self.can_make_call(count):
            logger.warning(
                f"Budget exceeded: total={self.total_used}/{self.max_total}, "
                f"iteration={self.iteration_used}/{self.max_per_iteration}, "
                f"requested={count}"
            )
            raise BudgetExceededError(
                message=f"Cannot make {count} sub-call(s): budget exceeded",
                budget_limit=self.max_total,
                subcalls_used=self.total_used,
            )

        self.total_used += count
        self.iteration_used += count

        logger.debug(
            f"Recorded {count} sub-call(s): total={self.total_used}/{self.max_total}, "
            f"iteration={self.iteration_used}/{self.max_per_iteration}"
        )

    def record_call_if_allowed(self, count: int = 1) -> bool:
        """Record sub-call(s) if within budget, otherwise return False.

        Unlike record_call(), this method does not raise an exception.

        Args:
            count: Number of sub-calls to record

        Returns:
            True if the call was recorded, False if budget exceeded
        """
        if not self.can_make_call(count):
            return False
        self.total_used += count
        self.iteration_used += count
        return True

    def reset_iteration(self) -> None:
        """Reset the iteration counter and start a new iteration.

        Call this at the end of each exploration iteration to allow
        sub-calls for the next iteration.
        """
        # Save snapshot before reset
        self._history.append(self.snapshot())

        self.iteration_count += 1
        self.iteration_used = 0

        logger.debug(
            f"Reset iteration: starting iteration {self.iteration_count}, "
            f"total_used={self.total_used}/{self.max_total}"
        )

    def snapshot(self) -> BudgetSnapshot:
        """Take a snapshot of current budget state.

        Returns:
            BudgetSnapshot with current state
        """
        return BudgetSnapshot(
            total_used=self.total_used,
            iteration_used=self.iteration_used,
            remaining=self.remaining,
            timestamp=datetime.now(timezone.utc),
        )

    def get_history(self) -> list[BudgetSnapshot]:
        """Return history of iteration snapshots.

        Returns:
            List of snapshots taken at each iteration reset
        """
        return list(self._history)

    def require_budget(self, count: int = 1) -> None:
        """Assert that budget is available, raising if not.

        Use this as a precondition check before starting operations
        that require sub-calls.

        Args:
            count: Number of sub-calls required

        Raises:
            BudgetExceededError: If insufficient budget
        """
        if not self.can_make_call(count):
            raise BudgetExceededError(
                message=f"Insufficient budget for {count} sub-call(s)",
                budget_limit=self.max_total,
                subcalls_used=self.total_used,
            )

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization.

        Returns:
            Dictionary representation
        """
        return {
            "max_total": self.max_total,
            "max_per_iteration": self.max_per_iteration,
            "total_used": self.total_used,
            "iteration_used": self.iteration_used,
            "iteration_count": self.iteration_count,
            "remaining": self.remaining,
            "iteration_remaining": self.iteration_remaining,
            "is_exhausted": self.is_exhausted,
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"SubCallBudgetManager("
            f"total={self.total_used}/{self.max_total}, "
            f"iter={self.iteration_used}/{self.max_per_iteration}, "
            f"remaining={self.remaining})"
        )
