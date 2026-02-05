"""Tests for coordination data models."""

import json
from datetime import datetime, timezone

import pytest

from src.infrastructure.coordination.types import (
    MessageType,
    MessagePayload,
    CoordinationMessage,
    MessageQuery,
    NotificationEvent,
    PresenceInfo,
    CoordinationStats,
)


class TestMessageType:
    """Tests for MessageType enum."""

    def test_all_message_types_defined(self) -> None:
        """Test that all message types are defined."""
        expected_types = {
            "READY_FOR_REVIEW",
            "REVIEW_COMPLETE",
            "REVIEW_FAILED",
            "CONTRACT_CHANGE_PROPOSED",
            "CONTRACT_REVIEW_NEEDED",
            "CONTRACT_FEEDBACK",
            "CONTRACT_APPROVED",
            "CONTRACT_REJECTED",
            "META_CHANGE_REQUEST",
            "META_CHANGE_COMPLETE",
            "INTERFACE_UPDATE",
            "BLOCKING_ISSUE",
            "GENERAL",
            "STATUS_UPDATE",
            "HEARTBEAT",
            "NOTIFICATION",
            # DevOps coordination
            "DEVOPS_STARTED",
            "DEVOPS_STEP_UPDATE",
            "DEVOPS_COMPLETE",
            "DEVOPS_FAILED",
            # Session lifecycle
            "SESSION_START",
            "SESSION_END",
            # Swarm coordination
            "SWARM_STARTED",
            "SWARM_REVIEWER_COMPLETE",
            "SWARM_COMPLETE",
            "SWARM_FAILED",
        }
        actual_types = {t.value for t in MessageType}
        assert actual_types == expected_types

    def test_message_type_is_string_enum(self) -> None:
        """Test that MessageType values are strings."""
        assert MessageType.READY_FOR_REVIEW.value == "READY_FOR_REVIEW"
        assert isinstance(MessageType.GENERAL.value, str)

    def test_devops_message_types_exist(self) -> None:
        """Test that all DevOps coordination message types are defined."""
        assert MessageType.DEVOPS_STARTED.value == "DEVOPS_STARTED"
        assert MessageType.DEVOPS_STEP_UPDATE.value == "DEVOPS_STEP_UPDATE"
        assert MessageType.DEVOPS_COMPLETE.value == "DEVOPS_COMPLETE"
        assert MessageType.DEVOPS_FAILED.value == "DEVOPS_FAILED"

    def test_devops_started_in_coordination_message(self) -> None:
        """Test that DEVOPS_STARTED can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-devops-test",
            type=MessageType.DEVOPS_STARTED,
            from_instance="devops",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 27, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(
                subject="K8s Deployment Started",
                description="Starting deployment of helm chart"
            ),
        )
        assert msg.type == MessageType.DEVOPS_STARTED
        assert msg.to_dict()["type"] == "DEVOPS_STARTED"

    def test_devops_step_update_in_coordination_message(self) -> None:
        """Test that DEVOPS_STEP_UPDATE can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-devops-step",
            type=MessageType.DEVOPS_STEP_UPDATE,
            from_instance="devops",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 27, 12, 1, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Step: Apply manifests",
                description="Applying Kubernetes manifests to cluster"
            ),
        )
        assert msg.type == MessageType.DEVOPS_STEP_UPDATE
        assert msg.to_dict()["type"] == "DEVOPS_STEP_UPDATE"

    def test_devops_complete_in_coordination_message(self) -> None:
        """Test that DEVOPS_COMPLETE can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-devops-done",
            type=MessageType.DEVOPS_COMPLETE,
            from_instance="devops",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 27, 12, 5, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(
                subject="Deployment Complete",
                description="Successfully deployed helm chart to cluster"
            ),
        )
        assert msg.type == MessageType.DEVOPS_COMPLETE
        assert msg.to_dict()["type"] == "DEVOPS_COMPLETE"

    def test_devops_failed_in_coordination_message(self) -> None:
        """Test that DEVOPS_FAILED can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-devops-fail",
            type=MessageType.DEVOPS_FAILED,
            from_instance="devops",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 27, 12, 3, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(
                subject="Deployment Failed",
                description="Error: insufficient resources in cluster"
            ),
        )
        assert msg.type == MessageType.DEVOPS_FAILED
        assert msg.to_dict()["type"] == "DEVOPS_FAILED"

    def test_devops_message_json_serialization(self) -> None:
        """Test that DEVOPS message types serialize to JSON correctly."""
        msg = CoordinationMessage(
            id="msg-devops-json",
            type=MessageType.DEVOPS_STARTED,
            from_instance="devops",
            to_instance="all",
            timestamp=datetime(2026, 1, 27, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Operation started",
                description="DevOps operation in progress"
            ),
        )
        json_str = msg.to_json()
        parsed = json.loads(json_str)
        assert parsed["type"] == "DEVOPS_STARTED"
        assert parsed["from"] == "devops"

    def test_session_start_message_type_exists(self) -> None:
        """Test that SESSION_START message type is defined."""
        assert MessageType.SESSION_START.value == "SESSION_START"

    def test_session_end_message_type_exists(self) -> None:
        """Test that SESSION_END message type is defined."""
        assert MessageType.SESSION_END.value == "SESSION_END"

    def test_session_start_in_coordination_message(self) -> None:
        """Test that SESSION_START can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-session-start",
            type=MessageType.SESSION_START,
            from_instance="backend",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 10, 0, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Session started",
                description="Backend agent session started in worktree"
            ),
        )
        assert msg.type == MessageType.SESSION_START
        assert msg.to_dict()["type"] == "SESSION_START"

    def test_session_end_in_coordination_message(self) -> None:
        """Test that SESSION_END can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-session-end",
            type=MessageType.SESSION_END,
            from_instance="backend",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Session ended",
                description="Backend agent session ended gracefully"
            ),
        )
        assert msg.type == MessageType.SESSION_END
        assert msg.to_dict()["type"] == "SESSION_END"

    def test_session_message_json_serialization(self) -> None:
        """Test that SESSION message types serialize to JSON correctly."""
        msg = CoordinationMessage(
            id="msg-session-json",
            type=MessageType.SESSION_START,
            from_instance="frontend",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 10, 0, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Session started",
                description="Frontend agent starting up"
            ),
        )
        json_str = msg.to_json()
        parsed = json.loads(json_str)
        assert parsed["type"] == "SESSION_START"
        assert parsed["from"] == "frontend"

    def test_swarm_message_types_exist(self) -> None:
        """Test that all swarm coordination message types are defined."""
        assert MessageType.SWARM_STARTED.value == "SWARM_STARTED"
        assert MessageType.SWARM_REVIEWER_COMPLETE.value == "SWARM_REVIEWER_COMPLETE"
        assert MessageType.SWARM_COMPLETE.value == "SWARM_COMPLETE"
        assert MessageType.SWARM_FAILED.value == "SWARM_FAILED"

    def test_swarm_started_in_coordination_message(self) -> None:
        """Test that SWARM_STARTED can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-swarm-start",
            type=MessageType.SWARM_STARTED,
            from_instance="orchestrator",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 10, 0, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Swarm review started",
                description="Starting parallel review swarm for src/workers/"
            ),
        )
        assert msg.type == MessageType.SWARM_STARTED
        assert msg.to_dict()["type"] == "SWARM_STARTED"

    def test_swarm_reviewer_complete_in_coordination_message(self) -> None:
        """Test that SWARM_REVIEWER_COMPLETE can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-swarm-reviewer",
            type=MessageType.SWARM_REVIEWER_COMPLETE,
            from_instance="backend",
            to_instance="orchestrator",
            timestamp=datetime(2026, 2, 5, 10, 5, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Security reviewer complete",
                description="Security review completed with 3 findings"
            ),
        )
        assert msg.type == MessageType.SWARM_REVIEWER_COMPLETE
        assert msg.to_dict()["type"] == "SWARM_REVIEWER_COMPLETE"

    def test_swarm_complete_in_coordination_message(self) -> None:
        """Test that SWARM_COMPLETE can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-swarm-done",
            type=MessageType.SWARM_COMPLETE,
            from_instance="orchestrator",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 10, 10, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(
                subject="Swarm review complete",
                description="All reviewers completed with 5 total findings"
            ),
        )
        assert msg.type == MessageType.SWARM_COMPLETE
        assert msg.to_dict()["type"] == "SWARM_COMPLETE"

    def test_swarm_failed_in_coordination_message(self) -> None:
        """Test that SWARM_FAILED can be used in CoordinationMessage."""
        msg = CoordinationMessage(
            id="msg-swarm-fail",
            type=MessageType.SWARM_FAILED,
            from_instance="orchestrator",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 10, 3, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(
                subject="Swarm review failed",
                description="Error: All reviewers timed out"
            ),
        )
        assert msg.type == MessageType.SWARM_FAILED
        assert msg.to_dict()["type"] == "SWARM_FAILED"

    def test_swarm_message_json_serialization(self) -> None:
        """Test that SWARM message types serialize to JSON correctly."""
        msg = CoordinationMessage(
            id="msg-swarm-json",
            type=MessageType.SWARM_STARTED,
            from_instance="orchestrator",
            to_instance="all",
            timestamp=datetime(2026, 2, 5, 10, 0, 0, tzinfo=timezone.utc),
            requires_ack=False,
            payload=MessagePayload(
                subject="Swarm started",
                description="Parallel review swarm in progress"
            ),
        )
        json_str = msg.to_json()
        parsed = json.loads(json_str)
        assert parsed["type"] == "SWARM_STARTED"
        assert parsed["from"] == "orchestrator"


class TestMessagePayload:
    """Tests for MessagePayload model."""

    def test_create_payload(self) -> None:
        """Test creating a payload."""
        payload = MessagePayload(subject="Test Subject", description="Test description")
        assert payload.subject == "Test Subject"
        assert payload.description == "Test description"

    def test_payload_to_dict(self) -> None:
        """Test payload serialization."""
        payload = MessagePayload(subject="Subject", description="Desc")
        result = payload.to_dict()
        assert result == {"subject": "Subject", "description": "Desc"}


class TestCoordinationMessage:
    """Tests for CoordinationMessage model."""

    @pytest.fixture
    def sample_message_dict(self) -> dict:
        """Sample message in filesystem JSON format."""
        return {
            "id": "msg-abc12345",
            "type": "READY_FOR_REVIEW",
            "from": "backend",
            "to": "orchestrator",
            "timestamp": "2026-01-23T12:00:00Z",
            "requires_ack": True,
            "acknowledged": False,
            "payload": {
                "subject": "agent/P03-F02",
                "description": "Ready for review",
            },
        }

    def test_create_message_from_dict(self, sample_message_dict: dict) -> None:
        """Test creating message from filesystem JSON format."""
        msg = CoordinationMessage.from_dict(sample_message_dict)

        assert msg.id == "msg-abc12345"
        assert msg.type == MessageType.READY_FOR_REVIEW
        assert msg.from_instance == "backend"
        assert msg.to_instance == "orchestrator"
        assert msg.requires_ack is True
        assert msg.acknowledged is False
        assert msg.payload.subject == "agent/P03-F02"

    def test_create_message_with_all_fields(self) -> None:
        """Test creating message with all fields including ack."""
        msg = CoordinationMessage(
            id="msg-test123",
            type=MessageType.REVIEW_COMPLETE,
            from_instance="orchestrator",
            to_instance="backend",
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=True,
            acknowledged=True,
            payload=MessagePayload(subject="Test", description="Test desc"),
            ack_by="backend",
            ack_timestamp=datetime(2026, 1, 23, 12, 5, 0, tzinfo=timezone.utc),
            ack_comment="Acknowledged",
        )

        assert msg.ack_by == "backend"
        assert msg.ack_comment == "Acknowledged"

    def test_message_to_dict_format(self, sample_message_dict: dict) -> None:
        """Test that to_dict produces filesystem-compatible format."""
        msg = CoordinationMessage.from_dict(sample_message_dict)
        result = msg.to_dict()

        assert result["id"] == "msg-abc12345"
        assert result["type"] == "READY_FOR_REVIEW"
        assert result["from"] == "backend"
        assert result["to"] == "orchestrator"
        assert result["timestamp"] == "2026-01-23T12:00:00Z"
        assert result["requires_ack"] is True
        assert result["acknowledged"] is False
        assert result["payload"]["subject"] == "agent/P03-F02"

    def test_message_to_json(self, sample_message_dict: dict) -> None:
        """Test JSON serialization."""
        msg = CoordinationMessage.from_dict(sample_message_dict)
        json_str = msg.to_json()

        # Should be valid JSON
        parsed = json.loads(json_str)
        assert parsed["id"] == "msg-abc12345"

    def test_message_with_ack_fields_to_dict(self) -> None:
        """Test that ack fields are included when present."""
        msg = CoordinationMessage(
            id="msg-test",
            type=MessageType.GENERAL,
            from_instance="frontend",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=True,
            acknowledged=True,
            payload=MessagePayload(subject="S", description="D"),
            ack_by="orchestrator",
            ack_timestamp=datetime(2026, 1, 23, 12, 1, 0, tzinfo=timezone.utc),
        )

        result = msg.to_dict()
        assert result["ack_by"] == "orchestrator"
        assert result["ack_timestamp"] == "2026-01-23T12:01:00Z"

    def test_timestamp_parsing_with_z_suffix(self) -> None:
        """Test that timestamps with Z suffix are parsed correctly."""
        data = {
            "id": "msg-test",
            "type": "GENERAL",
            "from": "test",
            "to": "test",
            "timestamp": "2026-01-23T12:00:00Z",
            "payload": {"subject": "S", "description": "D"},
        }
        msg = CoordinationMessage.from_dict(data)
        assert msg.timestamp.year == 2026
        assert msg.timestamp.month == 1
        assert msg.timestamp.day == 23


class TestMessageQuery:
    """Tests for MessageQuery model."""

    def test_create_empty_query(self) -> None:
        """Test creating query with defaults."""
        query = MessageQuery()
        assert query.to_instance is None
        assert query.from_instance is None
        assert query.msg_type is None
        assert query.pending_only is False
        assert query.limit == 100

    def test_create_query_with_filters(self) -> None:
        """Test creating query with all filters."""
        query = MessageQuery(
            to_instance="orchestrator",
            from_instance="backend",
            msg_type=MessageType.READY_FOR_REVIEW,
            pending_only=True,
            since=datetime(2026, 1, 23, tzinfo=timezone.utc),
            limit=50,
        )

        assert query.to_instance == "orchestrator"
        assert query.from_instance == "backend"
        assert query.msg_type == MessageType.READY_FOR_REVIEW
        assert query.pending_only is True
        assert query.limit == 50

    def test_query_limit_validation(self) -> None:
        """Test that limit is validated."""
        with pytest.raises(ValueError):
            MessageQuery(limit=0)

        with pytest.raises(ValueError):
            MessageQuery(limit=1001)

    def test_query_since_parsing(self) -> None:
        """Test that since timestamp is parsed."""
        query = MessageQuery(since="2026-01-23T00:00:00Z")
        assert query.since is not None
        assert query.since.year == 2026


class TestNotificationEvent:
    """Tests for NotificationEvent model."""

    def test_create_notification(self) -> None:
        """Test creating notification event."""
        event = NotificationEvent(
            event="message_published",
            message_id="msg-123",
            msg_type=MessageType.READY_FOR_REVIEW,
            from_instance="backend",
            to_instance="orchestrator",
            requires_ack=True,
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

        assert event.event == "message_published"
        assert event.message_id == "msg-123"

    def test_notification_to_dict(self) -> None:
        """Test notification serialization."""
        event = NotificationEvent(
            message_id="msg-123",
            msg_type=MessageType.GENERAL,
            from_instance="frontend",
            to_instance="all",
            requires_ack=False,
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

        result = event.to_dict()
        assert result["message_id"] == "msg-123"
        assert result["type"] == "GENERAL"
        assert result["from"] == "frontend"
        assert result["to"] == "all"

    def test_notification_from_message(self) -> None:
        """Test creating notification from message."""
        msg = CoordinationMessage(
            id="msg-456",
            type=MessageType.REVIEW_COMPLETE,
            from_instance="orchestrator",
            to_instance="backend",
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(subject="S", description="D"),
        )

        event = NotificationEvent.from_message(msg)
        assert event.message_id == "msg-456"
        assert event.msg_type == MessageType.REVIEW_COMPLETE
        assert event.from_instance == "orchestrator"

    def test_notification_to_json(self) -> None:
        """Test JSON serialization."""
        event = NotificationEvent(
            message_id="msg-test",
            msg_type=MessageType.GENERAL,
            from_instance="test",
            to_instance="test",
            requires_ack=False,
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

        json_str = event.to_json()
        parsed = json.loads(json_str)
        assert parsed["message_id"] == "msg-test"

    def test_notification_from_json_valid(self) -> None:
        """Test deserializing notification from valid JSON."""
        json_str = json.dumps({
            "event": "message_published",
            "message_id": "msg-fromjson",
            "type": "READY_FOR_REVIEW",
            "from": "backend",
            "to": "orchestrator",
            "requires_ack": True,
            "timestamp": "2026-01-23T12:00:00Z",
        })

        event = NotificationEvent.from_json(json_str)

        assert event.event == "message_published"
        assert event.message_id == "msg-fromjson"
        assert event.msg_type == MessageType.READY_FOR_REVIEW
        assert event.from_instance == "backend"
        assert event.to_instance == "orchestrator"
        assert event.requires_ack is True
        assert event.timestamp.year == 2026

    def test_notification_from_json_invalid_json(self) -> None:
        """Test that invalid JSON raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            NotificationEvent.from_json("not valid json {")
        assert "Invalid JSON" in str(exc_info.value)

    def test_notification_from_json_missing_fields(self) -> None:
        """Test that missing required fields raises error."""
        json_str = json.dumps({"event": "message_published"})
        with pytest.raises((KeyError, ValueError)):
            NotificationEvent.from_json(json_str)

    def test_notification_json_round_trip(self) -> None:
        """Test notification survives to_json -> from_json round-trip."""
        original = NotificationEvent(
            event="message_published",
            message_id="msg-roundtrip",
            msg_type=MessageType.CONTRACT_APPROVED,
            from_instance="orchestrator",
            to_instance="all",
            requires_ack=False,
            timestamp=datetime(2026, 1, 23, 15, 30, 45, tzinfo=timezone.utc),
        )

        json_str = original.to_json()
        restored = NotificationEvent.from_json(json_str)

        assert restored.event == original.event
        assert restored.message_id == original.message_id
        assert restored.msg_type == original.msg_type
        assert restored.from_instance == original.from_instance
        assert restored.to_instance == original.to_instance
        assert restored.requires_ack == original.requires_ack


class TestPresenceInfo:
    """Tests for PresenceInfo model."""

    def test_create_presence(self) -> None:
        """Test creating presence info."""
        presence = PresenceInfo(
            instance_id="backend",
            active=True,
            last_heartbeat=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            session_id="session-abc",
        )

        assert presence.instance_id == "backend"
        assert presence.active is True
        assert presence.session_id == "session-abc"

    def test_presence_to_dict(self) -> None:
        """Test presence serialization."""
        presence = PresenceInfo(
            instance_id="frontend",
            active=True,
            last_heartbeat=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
        )

        result = presence.to_dict()
        assert result["instance_id"] == "frontend"
        assert result["active"] is True
        assert result["last_heartbeat"] == "2026-01-23T12:00:00Z"

    def test_presence_is_stale_fresh(self) -> None:
        """Test that recent heartbeat is not stale."""
        presence = PresenceInfo(
            instance_id="test",
            last_heartbeat=datetime.now(timezone.utc),
        )

        assert presence.is_stale(timeout_minutes=5) is False

    def test_presence_is_stale_old(self) -> None:
        """Test that old heartbeat is stale."""
        from datetime import timedelta

        old_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        presence = PresenceInfo(
            instance_id="test",
            last_heartbeat=old_time,
        )

        assert presence.is_stale(timeout_minutes=5) is True


class TestCoordinationStats:
    """Tests for CoordinationStats model."""

    def test_create_stats(self) -> None:
        """Test creating stats."""
        stats = CoordinationStats(
            total_messages=100,
            pending_messages=5,
            messages_by_type={"GENERAL": 50, "READY_FOR_REVIEW": 30},
            active_instances=3,
            instance_names=["backend", "frontend", "orchestrator"],
        )

        assert stats.total_messages == 100
        assert stats.pending_messages == 5
        assert stats.active_instances == 3

    def test_stats_defaults(self) -> None:
        """Test stats with default values."""
        stats = CoordinationStats()
        assert stats.total_messages == 0
        assert stats.pending_messages == 0
        assert stats.messages_by_type == {}
        assert stats.active_instances == 0
        assert stats.instance_names == []

    def test_stats_to_dict(self) -> None:
        """Test stats serialization."""
        stats = CoordinationStats(
            total_messages=10,
            pending_messages=2,
            active_instances=1,
            instance_names=["test"],
        )

        result = stats.to_dict()
        assert result["total_messages"] == 10
        assert result["pending_messages"] == 2


class TestJsonRoundTrip:
    """Tests for JSON serialization round-trip."""

    def test_message_round_trip(self) -> None:
        """Test message survives JSON round-trip."""
        original = {
            "id": "msg-roundtrip",
            "type": "BLOCKING_ISSUE",
            "from": "backend",
            "to": "orchestrator",
            "timestamp": "2026-01-23T12:00:00Z",
            "requires_ack": True,
            "acknowledged": False,
            "payload": {
                "subject": "Test Subject",
                "description": "Test description with\nnewlines",
            },
        }

        msg = CoordinationMessage.from_dict(original)
        json_str = msg.to_json()
        parsed = json.loads(json_str)

        # Verify key fields survive
        assert parsed["id"] == original["id"]
        assert parsed["type"] == original["type"]
        assert parsed["from"] == original["from"]
        assert parsed["payload"]["description"] == original["payload"]["description"]
