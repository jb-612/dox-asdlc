"""Unit tests for task state machine.

Tests the TaskState enum and TaskStateMachine transition logic.
"""

from __future__ import annotations

import pytest

from src.core.exceptions import TaskStateError


class TestTaskState:
    """Tests for TaskState enum."""

    def test_all_states_defined(self):
        """Verify all expected states are defined."""
        from src.orchestrator.state_machine import TaskState

        expected_states = [
            "pending",
            "in_progress",
            "testing",
            "review",
            "blocked_hitl",
            "complete",
            "failed",
        ]

        for state in expected_states:
            assert hasattr(TaskState, state.upper()), f"Missing {state}"

    def test_state_values_are_lowercase(self):
        """State values are lowercase strings."""
        from src.orchestrator.state_machine import TaskState

        assert TaskState.PENDING.value == "pending"
        assert TaskState.IN_PROGRESS.value == "in_progress"
        assert TaskState.BLOCKED_HITL.value == "blocked_hitl"


class TestTaskStateMachine:
    """Tests for TaskStateMachine transitions."""

    def test_valid_transition_pending_to_in_progress(self):
        """PENDING → IN_PROGRESS is valid."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.PENDING, TaskState.IN_PROGRESS) is True

    def test_valid_transition_pending_to_failed(self):
        """PENDING → FAILED is valid."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.PENDING, TaskState.FAILED) is True

    def test_valid_transition_in_progress_to_testing(self):
        """IN_PROGRESS → TESTING is valid."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.IN_PROGRESS, TaskState.TESTING) is True

    def test_valid_transition_in_progress_to_blocked_hitl(self):
        """IN_PROGRESS → BLOCKED_HITL is valid."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(
            TaskState.IN_PROGRESS, TaskState.BLOCKED_HITL
        ) is True

    def test_valid_transition_testing_to_review(self):
        """TESTING → REVIEW is valid."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.TESTING, TaskState.REVIEW) is True

    def test_valid_transition_testing_to_in_progress(self):
        """TESTING → IN_PROGRESS is valid (test failed, retry)."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.TESTING, TaskState.IN_PROGRESS) is True

    def test_valid_transition_review_to_blocked_hitl(self):
        """REVIEW → BLOCKED_HITL is valid."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.REVIEW, TaskState.BLOCKED_HITL) is True

    def test_valid_transition_blocked_hitl_to_complete(self):
        """BLOCKED_HITL → COMPLETE is valid (approved)."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(
            TaskState.BLOCKED_HITL, TaskState.COMPLETE
        ) is True

    def test_valid_transition_blocked_hitl_to_in_progress(self):
        """BLOCKED_HITL → IN_PROGRESS is valid (rejected, retry)."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(
            TaskState.BLOCKED_HITL, TaskState.IN_PROGRESS
        ) is True

    def test_valid_transition_failed_to_pending(self):
        """FAILED → PENDING is valid (retry)."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.FAILED, TaskState.PENDING) is True

    def test_invalid_transition_complete_to_anything(self):
        """COMPLETE is terminal - cannot transition out."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        for state in TaskState:
            if state != TaskState.COMPLETE:
                assert machine.can_transition(TaskState.COMPLETE, state) is False

    def test_invalid_transition_pending_to_complete(self):
        """PENDING → COMPLETE is invalid (must go through workflow)."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        assert machine.can_transition(TaskState.PENDING, TaskState.COMPLETE) is False

    def test_invalid_transition_raises_error(self):
        """Invalid transition raises TaskStateError."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()

        with pytest.raises(TaskStateError) as exc_info:
            machine.validate_transition(TaskState.PENDING, TaskState.COMPLETE)

        assert "Invalid transition" in str(exc_info.value.message)

    def test_valid_transition_passes_validation(self):
        """Valid transition does not raise error."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()

        # Should not raise
        machine.validate_transition(TaskState.PENDING, TaskState.IN_PROGRESS)


class TestStateMachineNextStates:
    """Tests for getting available next states."""

    def test_next_states_from_pending(self):
        """PENDING can go to IN_PROGRESS or FAILED."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        next_states = machine.get_valid_transitions(TaskState.PENDING)

        assert TaskState.IN_PROGRESS in next_states
        assert TaskState.FAILED in next_states
        assert len(next_states) == 2

    def test_next_states_from_complete(self):
        """COMPLETE has no valid transitions."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        next_states = machine.get_valid_transitions(TaskState.COMPLETE)

        assert len(next_states) == 0

    def test_next_states_from_in_progress(self):
        """IN_PROGRESS has multiple valid transitions."""
        from src.orchestrator.state_machine import TaskState, TaskStateMachine

        machine = TaskStateMachine()
        next_states = machine.get_valid_transitions(TaskState.IN_PROGRESS)

        assert TaskState.TESTING in next_states
        assert TaskState.FAILED in next_states
        assert TaskState.BLOCKED_HITL in next_states
