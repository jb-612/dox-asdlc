"""Tests for DevOps activity Pydantic models.

Tests model validation, serialization, and camelCase alias mapping.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from src.orchestrator.api.models.devops_activity import (
    DevOpsActivity,
    DevOpsActivityResponse,
    DevOpsActivityStatus,
    DevOpsStep,
    DevOpsStepStatus,
)


class TestDevOpsStepStatus:
    """Tests for DevOpsStepStatus enum."""

    def test_valid_statuses(self) -> None:
        """Test all valid step status values."""
        assert DevOpsStepStatus.PENDING == "pending"
        assert DevOpsStepStatus.RUNNING == "running"
        assert DevOpsStepStatus.COMPLETED == "completed"
        assert DevOpsStepStatus.FAILED == "failed"

    def test_status_values(self) -> None:
        """Test that status values are lowercase strings."""
        for status in DevOpsStepStatus:
            assert status.value == status.value.lower()


class TestDevOpsActivityStatus:
    """Tests for DevOpsActivityStatus enum."""

    def test_valid_statuses(self) -> None:
        """Test all valid activity status values."""
        assert DevOpsActivityStatus.IN_PROGRESS == "in_progress"
        assert DevOpsActivityStatus.COMPLETED == "completed"
        assert DevOpsActivityStatus.FAILED == "failed"


class TestDevOpsStep:
    """Tests for DevOpsStep model."""

    def test_minimal_step(self) -> None:
        """Test creating a step with required fields only."""
        step = DevOpsStep(
            name="Build image",
            status=DevOpsStepStatus.PENDING,
        )
        assert step.name == "Build image"
        assert step.status == DevOpsStepStatus.PENDING
        assert step.started_at is None
        assert step.completed_at is None
        assert step.error is None

    def test_full_step(self) -> None:
        """Test creating a step with all fields."""
        now = datetime.now(timezone.utc)
        step = DevOpsStep(
            name="Push to registry",
            status=DevOpsStepStatus.COMPLETED,
            started_at=now,
            completed_at=now,
            error=None,
        )
        assert step.name == "Push to registry"
        assert step.status == DevOpsStepStatus.COMPLETED
        assert step.started_at == now
        assert step.completed_at == now

    def test_failed_step_with_error(self) -> None:
        """Test creating a failed step with error message."""
        step = DevOpsStep(
            name="Deploy to K8s",
            status=DevOpsStepStatus.FAILED,
            error="Connection refused",
        )
        assert step.status == DevOpsStepStatus.FAILED
        assert step.error == "Connection refused"

    def test_step_camelcase_serialization(self) -> None:
        """Test that step serializes with camelCase field names."""
        now = datetime.now(timezone.utc)
        step = DevOpsStep(
            name="Test step",
            status=DevOpsStepStatus.RUNNING,
            started_at=now,
            completed_at=now,
        )
        data = step.model_dump(by_alias=True)
        assert "startedAt" in data
        assert "completedAt" in data
        assert "started_at" not in data
        assert "completed_at" not in data

    def test_step_from_camelcase(self) -> None:
        """Test creating step from camelCase data."""
        now = datetime.now(timezone.utc)
        step = DevOpsStep(
            name="Test step",
            status=DevOpsStepStatus.COMPLETED,
            startedAt=now,  # type: ignore[call-arg]
            completedAt=now,  # type: ignore[call-arg]
        )
        assert step.started_at == now
        assert step.completed_at == now


class TestDevOpsActivity:
    """Tests for DevOpsActivity model."""

    def test_minimal_activity(self) -> None:
        """Test creating an activity with required fields only."""
        now = datetime.now(timezone.utc)
        activity = DevOpsActivity(
            id="act-12345",
            operation="Deploy application",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            steps=[],
        )
        assert activity.id == "act-12345"
        assert activity.operation == "Deploy application"
        assert activity.status == DevOpsActivityStatus.IN_PROGRESS
        assert activity.started_at == now
        assert activity.completed_at is None
        assert activity.steps == []

    def test_full_activity_with_steps(self) -> None:
        """Test creating an activity with steps."""
        now = datetime.now(timezone.utc)
        steps = [
            DevOpsStep(
                name="Build",
                status=DevOpsStepStatus.COMPLETED,
                started_at=now,
                completed_at=now,
            ),
            DevOpsStep(
                name="Push",
                status=DevOpsStepStatus.RUNNING,
                started_at=now,
            ),
            DevOpsStep(
                name="Deploy",
                status=DevOpsStepStatus.PENDING,
            ),
        ]
        activity = DevOpsActivity(
            id="act-67890",
            operation="Full deployment",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            steps=steps,
        )
        assert len(activity.steps) == 3
        assert activity.steps[0].name == "Build"
        assert activity.steps[1].name == "Push"
        assert activity.steps[2].name == "Deploy"

    def test_completed_activity(self) -> None:
        """Test creating a completed activity."""
        start = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        end = datetime(2025, 1, 1, 12, 5, 0, tzinfo=timezone.utc)
        activity = DevOpsActivity(
            id="act-complete",
            operation="Scale workers",
            status=DevOpsActivityStatus.COMPLETED,
            started_at=start,
            completed_at=end,
            steps=[
                DevOpsStep(
                    name="Scale up",
                    status=DevOpsStepStatus.COMPLETED,
                    started_at=start,
                    completed_at=end,
                ),
            ],
        )
        assert activity.status == DevOpsActivityStatus.COMPLETED
        assert activity.completed_at == end

    def test_activity_camelcase_serialization(self) -> None:
        """Test that activity serializes with camelCase field names."""
        now = datetime.now(timezone.utc)
        activity = DevOpsActivity(
            id="act-camel",
            operation="Test",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            completed_at=now,
            steps=[],
        )
        data = activity.model_dump(by_alias=True)
        assert "startedAt" in data
        assert "completedAt" in data
        assert "started_at" not in data
        assert "completed_at" not in data

    def test_activity_from_camelcase(self) -> None:
        """Test creating activity from camelCase data."""
        now = datetime.now(timezone.utc)
        activity = DevOpsActivity(
            id="act-from-camel",
            operation="Test",
            status=DevOpsActivityStatus.COMPLETED,
            startedAt=now,  # type: ignore[call-arg]
            completedAt=now,  # type: ignore[call-arg]
            steps=[],
        )
        assert activity.started_at == now
        assert activity.completed_at == now

    def test_activity_missing_required_field(self) -> None:
        """Test that missing required fields raise validation error."""
        with pytest.raises(ValidationError):
            DevOpsActivity(
                id="act-invalid",
                operation="Test",
                status=DevOpsActivityStatus.IN_PROGRESS,
                # Missing started_at
                steps=[],
            )  # type: ignore[call-arg]


class TestDevOpsActivityResponse:
    """Tests for DevOpsActivityResponse model."""

    def test_empty_response(self) -> None:
        """Test response with no activities."""
        response = DevOpsActivityResponse(
            current=None,
            recent=[],
        )
        assert response.current is None
        assert response.recent == []

    def test_response_with_current(self) -> None:
        """Test response with current activity."""
        now = datetime.now(timezone.utc)
        current = DevOpsActivity(
            id="act-current",
            operation="Active deploy",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            steps=[],
        )
        response = DevOpsActivityResponse(
            current=current,
            recent=[],
        )
        assert response.current is not None
        assert response.current.id == "act-current"

    def test_response_with_recent(self) -> None:
        """Test response with recent activities."""
        now = datetime.now(timezone.utc)
        recent = [
            DevOpsActivity(
                id=f"act-{i}",
                operation=f"Operation {i}",
                status=DevOpsActivityStatus.COMPLETED,
                started_at=now,
                completed_at=now,
                steps=[],
            )
            for i in range(3)
        ]
        response = DevOpsActivityResponse(
            current=None,
            recent=recent,
        )
        assert len(response.recent) == 3
        assert response.recent[0].id == "act-0"

    def test_full_response(self) -> None:
        """Test response with both current and recent activities."""
        now = datetime.now(timezone.utc)
        current = DevOpsActivity(
            id="act-running",
            operation="Current operation",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            steps=[
                DevOpsStep(name="Step 1", status=DevOpsStepStatus.COMPLETED),
                DevOpsStep(name="Step 2", status=DevOpsStepStatus.RUNNING),
            ],
        )
        recent = [
            DevOpsActivity(
                id="act-past",
                operation="Past operation",
                status=DevOpsActivityStatus.COMPLETED,
                started_at=now,
                completed_at=now,
                steps=[],
            )
        ]
        response = DevOpsActivityResponse(
            current=current,
            recent=recent,
        )
        assert response.current is not None
        assert len(response.current.steps) == 2
        assert len(response.recent) == 1
