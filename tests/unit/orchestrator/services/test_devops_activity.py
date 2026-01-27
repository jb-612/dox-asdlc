"""Tests for DevOps activity service.

Tests the service that reads coordination messages to track DevOps operations.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.api.models.devops_activity import (
    DevOpsActivity,
    DevOpsActivityResponse,
    DevOpsActivityStatus,
    DevOpsStep,
    DevOpsStepStatus,
)
from src.orchestrator.services.devops_activity import DevOpsActivityService
from src.infrastructure.coordination.types import (
    CoordinationMessage,
    MessagePayload,
    MessageType,
)


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock Redis client."""
    return AsyncMock()


@pytest.fixture
def mock_coordination_client() -> AsyncMock:
    """Create a mock coordination client."""
    client = AsyncMock()
    client.get_messages = AsyncMock(return_value=[])
    client.health_check = AsyncMock(return_value={"connected": True, "status": "healthy"})
    return client


@pytest.fixture
def service(mock_coordination_client: AsyncMock) -> DevOpsActivityService:
    """Create a DevOpsActivityService with mocked coordination client."""
    svc = DevOpsActivityService()
    svc._client = mock_coordination_client
    return svc


def create_coordination_message(
    msg_type: MessageType,
    subject: str,
    description: str,
    timestamp: datetime | None = None,
    message_id: str | None = None,
) -> CoordinationMessage:
    """Helper to create coordination messages for testing."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    if message_id is None:
        message_id = f"msg-{timestamp.timestamp():.0f}"

    return CoordinationMessage(
        id=message_id,
        type=msg_type,
        from_instance="devops",
        to_instance="all",
        timestamp=timestamp,
        requires_ack=False,
        acknowledged=False,
        payload=MessagePayload(subject=subject, description=description),
    )


class TestDevOpsActivityService:
    """Tests for DevOpsActivityService."""

    @pytest.mark.asyncio
    async def test_get_activity_no_messages(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_activity when no coordination messages exist."""
        mock_coordination_client.get_messages.return_value = []

        response = await service.get_activity()

        assert response.current is None
        assert response.recent == []

    @pytest.mark.asyncio
    async def test_get_activity_current_operation(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_activity with a current in-progress operation."""
        now = datetime.now(timezone.utc)

        # DEVOPS_STARTED message with steps in description
        started_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Deploying application",
            description='{"activity_id": "act-123", "operation": "Deploy v2.0", "steps": ["Build", "Push", "Deploy"]}',
            timestamp=now,
            message_id="msg-started",
        )

        # DEVOPS_STEP_UPDATE for first step completed
        step_update_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STEP_UPDATE,
            subject="Step completed: Build",
            description='{"activity_id": "act-123", "step": "Build", "status": "completed"}',
            timestamp=now + timedelta(seconds=30),
            message_id="msg-step-1",
        )

        mock_coordination_client.get_messages.return_value = [started_msg, step_update_msg]

        response = await service.get_activity()

        assert response.current is not None
        assert response.current.id == "act-123"
        assert response.current.operation == "Deploy v2.0"
        assert response.current.status == DevOpsActivityStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_get_activity_completed_operation(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_activity with a completed operation in recent list."""
        now = datetime.now(timezone.utc)

        # DEVOPS_STARTED message
        started_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Deploying application",
            description='{"activity_id": "act-456", "operation": "Deploy v1.0", "steps": ["Build"]}',
            timestamp=now - timedelta(minutes=10),
            message_id="msg-started-456",
        )

        # DEVOPS_COMPLETE message
        complete_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_COMPLETE,
            subject="Deployment completed",
            description='{"activity_id": "act-456", "status": "completed"}',
            timestamp=now - timedelta(minutes=5),
            message_id="msg-complete-456",
        )

        mock_coordination_client.get_messages.return_value = [started_msg, complete_msg]

        response = await service.get_activity()

        assert response.current is None  # No active operation
        assert len(response.recent) == 1
        assert response.recent[0].id == "act-456"
        assert response.recent[0].status == DevOpsActivityStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_get_activity_failed_operation(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_activity with a failed operation."""
        now = datetime.now(timezone.utc)

        # DEVOPS_STARTED message
        started_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Deploying application",
            description='{"activity_id": "act-789", "operation": "Deploy v3.0", "steps": ["Build", "Push"]}',
            timestamp=now - timedelta(minutes=10),
            message_id="msg-started-789",
        )

        # DEVOPS_FAILED message
        failed_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_FAILED,
            subject="Deployment failed",
            description='{"activity_id": "act-789", "status": "failed", "error": "Connection refused"}',
            timestamp=now - timedelta(minutes=5),
            message_id="msg-failed-789",
        )

        mock_coordination_client.get_messages.return_value = [started_msg, failed_msg]

        response = await service.get_activity()

        assert response.current is None
        assert len(response.recent) == 1
        assert response.recent[0].id == "act-789"
        assert response.recent[0].status == DevOpsActivityStatus.FAILED

    @pytest.mark.asyncio
    async def test_get_activity_multiple_recent(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_activity with multiple recent operations."""
        now = datetime.now(timezone.utc)

        messages = []
        for i in range(3):
            # Started message
            started = create_coordination_message(
                msg_type=MessageType.DEVOPS_STARTED,
                subject=f"Operation {i}",
                description=f'{{"activity_id": "act-{i}", "operation": "Op {i}", "steps": ["Step1"]}}',
                timestamp=now - timedelta(minutes=30 - i*5),
                message_id=f"msg-started-{i}",
            )
            messages.append(started)

            # Complete message
            complete = create_coordination_message(
                msg_type=MessageType.DEVOPS_COMPLETE,
                subject=f"Operation {i} completed",
                description=f'{{"activity_id": "act-{i}", "status": "completed"}}',
                timestamp=now - timedelta(minutes=25 - i*5),
                message_id=f"msg-complete-{i}",
            )
            messages.append(complete)

        mock_coordination_client.get_messages.return_value = messages

        response = await service.get_activity()

        assert response.current is None
        assert len(response.recent) == 3
        # Should be sorted by timestamp descending (most recent first)
        assert response.recent[0].id == "act-2"
        assert response.recent[1].id == "act-1"
        assert response.recent[2].id == "act-0"

    @pytest.mark.asyncio
    async def test_get_activity_limit_recent(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test that get_activity respects the limit parameter."""
        now = datetime.now(timezone.utc)

        messages = []
        for i in range(15):  # Create 15 operations
            started = create_coordination_message(
                msg_type=MessageType.DEVOPS_STARTED,
                subject=f"Operation {i}",
                description=f'{{"activity_id": "act-{i}", "operation": "Op {i}", "steps": []}}',
                timestamp=now - timedelta(minutes=30 - i),
                message_id=f"msg-started-{i}",
            )
            complete = create_coordination_message(
                msg_type=MessageType.DEVOPS_COMPLETE,
                subject=f"Operation {i} completed",
                description=f'{{"activity_id": "act-{i}", "status": "completed"}}',
                timestamp=now - timedelta(minutes=25 - i),
                message_id=f"msg-complete-{i}",
            )
            messages.extend([started, complete])

        mock_coordination_client.get_messages.return_value = messages

        response = await service.get_activity(limit=5)

        assert len(response.recent) == 5

    @pytest.mark.asyncio
    async def test_get_activity_step_updates(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test that step updates are properly aggregated."""
        now = datetime.now(timezone.utc)

        # DEVOPS_STARTED with steps
        started_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Deploying application",
            description='{"activity_id": "act-steps", "operation": "Full Deploy", "steps": ["Build", "Push", "Deploy"]}',
            timestamp=now,
            message_id="msg-started-steps",
        )

        # Step updates
        step1_complete = create_coordination_message(
            msg_type=MessageType.DEVOPS_STEP_UPDATE,
            subject="Step completed: Build",
            description='{"activity_id": "act-steps", "step": "Build", "status": "completed"}',
            timestamp=now + timedelta(seconds=10),
            message_id="msg-step-1",
        )

        step2_running = create_coordination_message(
            msg_type=MessageType.DEVOPS_STEP_UPDATE,
            subject="Step running: Push",
            description='{"activity_id": "act-steps", "step": "Push", "status": "running"}',
            timestamp=now + timedelta(seconds=20),
            message_id="msg-step-2",
        )

        mock_coordination_client.get_messages.return_value = [
            started_msg, step1_complete, step2_running
        ]

        response = await service.get_activity()

        assert response.current is not None
        assert len(response.current.steps) == 3

        # Check step statuses
        steps_by_name = {s.name: s for s in response.current.steps}
        assert steps_by_name["Build"].status == DevOpsStepStatus.COMPLETED
        assert steps_by_name["Push"].status == DevOpsStepStatus.RUNNING
        assert steps_by_name["Deploy"].status == DevOpsStepStatus.PENDING

    @pytest.mark.asyncio
    async def test_get_activity_coordination_unavailable(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test graceful handling when coordination MCP is unavailable."""
        from src.core.exceptions import CoordinationError

        mock_coordination_client.get_messages.side_effect = CoordinationError(
            "Redis connection failed"
        )

        response = await service.get_activity()

        # Should return empty response, not raise exception
        assert response.current is None
        assert response.recent == []

    @pytest.mark.asyncio
    async def test_get_activity_malformed_message(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test handling of malformed message descriptions."""
        now = datetime.now(timezone.utc)

        # Valid message
        valid_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Valid operation",
            description='{"activity_id": "act-valid", "operation": "Valid Op", "steps": []}',
            timestamp=now,
            message_id="msg-valid",
        )

        # Malformed message (invalid JSON)
        malformed_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Malformed operation",
            description='not valid json',
            timestamp=now - timedelta(minutes=5),
            message_id="msg-malformed",
        )

        mock_coordination_client.get_messages.return_value = [valid_msg, malformed_msg]

        response = await service.get_activity()

        # Should still include valid activity
        assert response.current is not None
        assert response.current.id == "act-valid"

    @pytest.mark.asyncio
    async def test_get_current_activity(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_current_activity method."""
        now = datetime.now(timezone.utc)

        started_msg = create_coordination_message(
            msg_type=MessageType.DEVOPS_STARTED,
            subject="Current operation",
            description='{"activity_id": "act-current", "operation": "Current Op", "steps": ["Step1"]}',
            timestamp=now,
            message_id="msg-current",
        )

        mock_coordination_client.get_messages.return_value = [started_msg]

        current = await service.get_current_activity()

        assert current is not None
        assert current.id == "act-current"
        assert current.status == DevOpsActivityStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_get_recent_activities(
        self, service: DevOpsActivityService, mock_coordination_client: AsyncMock
    ) -> None:
        """Test get_recent_activities method."""
        now = datetime.now(timezone.utc)

        messages = []
        for i in range(3):
            started = create_coordination_message(
                msg_type=MessageType.DEVOPS_STARTED,
                subject=f"Operation {i}",
                description=f'{{"activity_id": "act-{i}", "operation": "Op {i}", "steps": []}}',
                timestamp=now - timedelta(minutes=30 - i*5),
                message_id=f"msg-started-{i}",
            )
            complete = create_coordination_message(
                msg_type=MessageType.DEVOPS_COMPLETE,
                subject=f"Operation {i} completed",
                description=f'{{"activity_id": "act-{i}", "status": "completed"}}',
                timestamp=now - timedelta(minutes=25 - i*5),
                message_id=f"msg-complete-{i}",
            )
            messages.extend([started, complete])

        mock_coordination_client.get_messages.return_value = messages

        recent = await service.get_recent_activities(limit=2)

        assert len(recent) == 2
        assert recent[0].id == "act-2"  # Most recent first


class TestDevOpsActivityServiceInitialization:
    """Tests for service initialization."""

    @pytest.mark.asyncio
    async def test_service_creates_client_on_demand(self) -> None:
        """Test that service creates coordination client on first use."""
        service = DevOpsActivityService()

        # Client should not be created yet
        assert service._client is None

        # Mock the client creation
        with patch(
            "src.orchestrator.services.devops_activity.CoordinationClient"
        ) as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_messages = AsyncMock(return_value=[])
            mock_client_class.return_value = mock_client

            # Accessing client should create it
            with patch(
                "src.orchestrator.services.devops_activity.get_coordination_config"
            ), patch(
                "src.orchestrator.services.devops_activity.redis.from_url"
            ) as mock_redis:
                mock_redis.return_value = AsyncMock()

                # This should trigger client creation
                await service.get_activity()
