"""Task state machine for aSDLC workflow.

Defines the valid task states and transitions according to the
aSDLC workflow specification.
"""

from __future__ import annotations

from enum import Enum
from typing import Set

from src.core.exceptions import TaskStateError


class TaskState(str, Enum):
    """All possible states for a task in the aSDLC workflow."""

    PENDING = "pending"           # Created but not started
    IN_PROGRESS = "in_progress"   # Agent working on it
    TESTING = "testing"           # Running tests
    REVIEW = "review"             # Code review in progress
    BLOCKED_HITL = "blocked_hitl" # Waiting for human approval
    COMPLETE = "complete"         # Done
    FAILED = "failed"             # Permanently failed


class TaskStateMachine:
    """Manages valid task state transitions.

    Enforces the aSDLC workflow state diagram:

        PENDING ──────────────────┐
           │                      │
           ▼                      ▼
      IN_PROGRESS ───────────► FAILED
           │     ◄────────────────┘
           │         (retry)      │
           ▼                      │
        TESTING ─────────────────►│
           │                      │
           ▼                      │
        REVIEW ──────────────────►│
           │                      │
           ▼                      │
      BLOCKED_HITL ──────────────►│
           │                      │
           ▼                      │
        COMPLETE ◄────────────────┘

    Key transitions:
    - PENDING → IN_PROGRESS: Work begins
    - IN_PROGRESS → TESTING: Code written, tests running
    - TESTING → REVIEW: Tests pass, review begins
    - TESTING → IN_PROGRESS: Tests fail, retry
    - REVIEW → BLOCKED_HITL: Awaiting human approval
    - BLOCKED_HITL → COMPLETE: Approved
    - BLOCKED_HITL → IN_PROGRESS: Rejected, retry
    - Any → FAILED: Unrecoverable error
    - FAILED → PENDING: Manual retry
    """

    # Valid transitions from each state
    TRANSITIONS: dict[TaskState, set[TaskState]] = {
        TaskState.PENDING: {TaskState.IN_PROGRESS, TaskState.FAILED},
        TaskState.IN_PROGRESS: {
            TaskState.TESTING,
            TaskState.FAILED,
            TaskState.BLOCKED_HITL,  # Direct to HITL for simple tasks
        },
        TaskState.TESTING: {
            TaskState.REVIEW,
            TaskState.IN_PROGRESS,  # Tests failed, retry
            TaskState.FAILED,
        },
        TaskState.REVIEW: {
            TaskState.BLOCKED_HITL,
            TaskState.IN_PROGRESS,  # Review changes needed
            TaskState.FAILED,
        },
        TaskState.BLOCKED_HITL: {
            TaskState.COMPLETE,     # Approved
            TaskState.IN_PROGRESS,  # Rejected, retry
            TaskState.FAILED,
        },
        TaskState.COMPLETE: set(),  # Terminal state
        TaskState.FAILED: {TaskState.PENDING},  # Allow retry from failed
    }

    def can_transition(self, from_state: TaskState, to_state: TaskState) -> bool:
        """Check if a state transition is valid.

        Args:
            from_state: The current state.
            to_state: The target state.

        Returns:
            True if the transition is valid, False otherwise.
        """
        valid_targets = self.TRANSITIONS.get(from_state, set())
        return to_state in valid_targets

    def validate_transition(
        self,
        from_state: TaskState,
        to_state: TaskState,
    ) -> None:
        """Validate a state transition, raising if invalid.

        Args:
            from_state: The current state.
            to_state: The target state.

        Raises:
            TaskStateError: If the transition is not valid.
        """
        if not self.can_transition(from_state, to_state):
            valid_targets = self.TRANSITIONS.get(from_state, set())
            raise TaskStateError(
                f"Invalid transition: {from_state.value} → {to_state.value}",
                details={
                    "from_state": from_state.value,
                    "to_state": to_state.value,
                    "valid_targets": [s.value for s in valid_targets],
                },
            )

    def get_valid_transitions(self, from_state: TaskState) -> set[TaskState]:
        """Get all valid target states from the given state.

        Args:
            from_state: The current state.

        Returns:
            Set of valid target states.
        """
        return self.TRANSITIONS.get(from_state, set()).copy()

    def is_terminal(self, state: TaskState) -> bool:
        """Check if a state is terminal (no transitions out).

        Args:
            state: The state to check.

        Returns:
            True if the state is terminal.
        """
        return len(self.TRANSITIONS.get(state, set())) == 0

    def is_blocked(self, state: TaskState) -> bool:
        """Check if a state indicates the task is blocked.

        Args:
            state: The state to check.

        Returns:
            True if the task is blocked (awaiting external action).
        """
        return state in (TaskState.BLOCKED_HITL,)


# Singleton instance for convenience
_state_machine = TaskStateMachine()


def can_transition(from_state: TaskState, to_state: TaskState) -> bool:
    """Check if a state transition is valid (module-level convenience)."""
    return _state_machine.can_transition(from_state, to_state)


def validate_transition(from_state: TaskState, to_state: TaskState) -> None:
    """Validate a state transition (module-level convenience)."""
    _state_machine.validate_transition(from_state, to_state)
