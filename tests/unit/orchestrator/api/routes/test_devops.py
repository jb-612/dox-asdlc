"""Tests for DevOps activity API endpoints.

Tests the REST API endpoints for DevOps activity tracking.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.api.models.devops_activity import (
    DevOpsActivity,
    DevOpsActivityResponse,
    DevOpsActivityStatus,
    DevOpsStep,
    DevOpsStepStatus,
)
from src.orchestrator.api.routes.devops import router, get_devops_service


@pytest.fixture
def mock_service() -> AsyncMock:
    """Create a mock DevOps activity service."""
    service = AsyncMock()
    return service


@pytest.fixture
def client(mock_service: AsyncMock) -> TestClient:
    """Create test client with mocked service."""
    app = FastAPI()
    app.include_router(router)

    # Override the service dependency
    app.dependency_overrides[get_devops_service] = lambda: mock_service

    return TestClient(app)


class TestGetDevOpsActivity:
    """Tests for GET /api/devops/activity endpoint."""

    def test_get_activity_empty(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity when no operations exist."""
        mock_service.get_activity.return_value = DevOpsActivityResponse(
            current=None,
            recent=[],
        )

        response = client.get("/api/devops/activity")

        assert response.status_code == 200
        data = response.json()
        assert data["current"] is None
        assert data["recent"] == []

    def test_get_activity_with_current(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity with a current operation."""
        now = datetime.now(timezone.utc)
        current = DevOpsActivity(
            id="act-123",
            operation="Deploy application",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            steps=[
                DevOpsStep(name="Build", status=DevOpsStepStatus.COMPLETED),
                DevOpsStep(name="Push", status=DevOpsStepStatus.RUNNING),
                DevOpsStep(name="Deploy", status=DevOpsStepStatus.PENDING),
            ],
        )
        mock_service.get_activity.return_value = DevOpsActivityResponse(
            current=current,
            recent=[],
        )

        response = client.get("/api/devops/activity")

        assert response.status_code == 200
        data = response.json()
        assert data["current"] is not None
        assert data["current"]["id"] == "act-123"
        assert data["current"]["operation"] == "Deploy application"
        assert data["current"]["status"] == "in_progress"
        assert len(data["current"]["steps"]) == 3

    def test_get_activity_with_recent(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity with recent operations."""
        now = datetime.now(timezone.utc)
        recent = [
            DevOpsActivity(
                id=f"act-{i}",
                operation=f"Operation {i}",
                status=DevOpsActivityStatus.COMPLETED,
                started_at=now - timedelta(hours=i),
                completed_at=now - timedelta(hours=i) + timedelta(minutes=5),
                steps=[],
            )
            for i in range(3)
        ]
        mock_service.get_activity.return_value = DevOpsActivityResponse(
            current=None,
            recent=recent,
        )

        response = client.get("/api/devops/activity")

        assert response.status_code == 200
        data = response.json()
        assert data["current"] is None
        assert len(data["recent"]) == 3
        assert data["recent"][0]["id"] == "act-0"

    def test_get_activity_camelcase_response(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test that response uses camelCase field names."""
        now = datetime.now(timezone.utc)
        completed_at = now + timedelta(minutes=5)
        current = DevOpsActivity(
            id="act-camel",
            operation="Test camelCase",
            status=DevOpsActivityStatus.COMPLETED,
            started_at=now,
            completed_at=completed_at,
            steps=[
                DevOpsStep(
                    name="Step 1",
                    status=DevOpsStepStatus.COMPLETED,
                    started_at=now,
                    completed_at=completed_at,
                ),
            ],
        )
        mock_service.get_activity.return_value = DevOpsActivityResponse(
            current=current,
            recent=[],
        )

        response = client.get("/api/devops/activity")

        assert response.status_code == 200
        data = response.json()

        # Check activity uses camelCase
        assert "startedAt" in data["current"]
        assert "completedAt" in data["current"]
        assert "started_at" not in data["current"]
        assert "completed_at" not in data["current"]

        # Check step uses camelCase
        step = data["current"]["steps"][0]
        assert "startedAt" in step
        assert "completedAt" in step

    def test_get_activity_with_limit(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity with limit parameter."""
        mock_service.get_activity.return_value = DevOpsActivityResponse(
            current=None,
            recent=[],
        )

        response = client.get("/api/devops/activity?limit=5")

        assert response.status_code == 200
        mock_service.get_activity.assert_called_once_with(limit=5)

    def test_get_activity_invalid_limit(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity with invalid limit parameter."""
        response = client.get("/api/devops/activity?limit=-1")

        assert response.status_code == 422  # Validation error

    def test_get_activity_limit_too_large(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity with limit too large."""
        response = client.get("/api/devops/activity?limit=1000")

        assert response.status_code == 422  # Validation error

    def test_get_activity_service_error(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test handling of service errors."""
        mock_service.get_activity.side_effect = Exception("Service unavailable")

        response = client.get("/api/devops/activity")

        assert response.status_code == 503
        data = response.json()
        assert "error" in data["detail"].lower()

    def test_get_activity_failed_operation_with_error(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting activity with a failed operation that has error details."""
        now = datetime.now(timezone.utc)
        recent = [
            DevOpsActivity(
                id="act-failed",
                operation="Failed deploy",
                status=DevOpsActivityStatus.FAILED,
                started_at=now - timedelta(minutes=10),
                completed_at=now - timedelta(minutes=5),
                steps=[
                    DevOpsStep(
                        name="Deploy",
                        status=DevOpsStepStatus.FAILED,
                        started_at=now - timedelta(minutes=10),
                        completed_at=now - timedelta(minutes=5),
                        error="Connection timeout",
                    ),
                ],
            )
        ]
        mock_service.get_activity.return_value = DevOpsActivityResponse(
            current=None,
            recent=recent,
        )

        response = client.get("/api/devops/activity")

        assert response.status_code == 200
        data = response.json()
        assert data["recent"][0]["status"] == "failed"
        assert data["recent"][0]["steps"][0]["error"] == "Connection timeout"


class TestGetCurrentActivity:
    """Tests for GET /api/devops/activity/current endpoint."""

    def test_get_current_no_activity(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting current activity when none exists."""
        mock_service.get_current_activity.return_value = None

        response = client.get("/api/devops/activity/current")

        assert response.status_code == 200
        data = response.json()
        assert data["current"] is None

    def test_get_current_with_activity(
        self, client: TestClient, mock_service: AsyncMock
    ) -> None:
        """Test getting current activity when one exists."""
        now = datetime.now(timezone.utc)
        current = DevOpsActivity(
            id="act-current",
            operation="Current operation",
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=now,
            steps=[],
        )
        mock_service.get_current_activity.return_value = current

        response = client.get("/api/devops/activity/current")

        assert response.status_code == 200
        data = response.json()
        assert data["current"] is not None
        assert data["current"]["id"] == "act-current"
