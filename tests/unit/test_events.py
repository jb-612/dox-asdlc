"""Unit tests for event models.

Tests the ASDLCEvent model, EventType enum, and related data structures.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from uuid import uuid4

from src.core.events import (
    EventType,
    ASDLCEvent,
    HandlerResult,
    RecoveryResult,
    generate_idempotency_key,
)


class TestEventType:
    """Tests for EventType enum."""

    def test_all_event_types_defined(self):
        """Verify all expected event types are defined."""
        expected_types = [
            "session_started",
            "session_completed",
            "task_created",
            "task_dispatched",
            "task_completed",
            "task_failed",
            "gate_requested",
            "gate_approved",
            "gate_rejected",
            "agent_started",
            "agent_completed",
            "agent_error",
            "patch_created",
            "patch_applied",
            "patch_rejected",
        ]

        for event_type in expected_types:
            assert hasattr(EventType, event_type.upper()), f"Missing {event_type}"

    def test_event_type_string_values(self):
        """Event types have snake_case string values."""
        assert EventType.TASK_CREATED.value == "task_created"
        assert EventType.GATE_APPROVED.value == "gate_approved"


class TestASDLCEvent:
    """Tests for ASDLCEvent model."""

    def test_create_minimal_event(self):
        """Create event with only required fields."""
        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
        )

        assert event.event_type == EventType.TASK_CREATED
        assert event.session_id == "session-123"
        assert event.event_id is None
        assert event.epic_id is None
        assert event.task_id is None
        assert event.mode == "normal"

    def test_create_full_event(self):
        """Create event with all fields."""
        now = datetime.now(timezone.utc)
        event = ASDLCEvent(
            event_id="evt-001",
            event_type=EventType.PATCH_APPLIED,
            session_id="session-123",
            epic_id="epic-456",
            task_id="task-789",
            git_sha="abc123def",
            artifact_paths=["/patches/task-789.patch"],
            mode="rlm",
            tenant_id="acme-corp",
            timestamp=now,
            idempotency_key="idem-001",
            metadata={"source": "coding-agent"},
        )

        assert event.event_id == "evt-001"
        assert event.epic_id == "epic-456"
        assert event.task_id == "task-789"
        assert event.git_sha == "abc123def"
        assert event.artifact_paths == ["/patches/task-789.patch"]
        assert event.mode == "rlm"
        assert event.tenant_id == "acme-corp"
        assert event.metadata == {"source": "coding-agent"}

    def test_event_requires_session_id(self):
        """Event creation fails without session_id."""
        with pytest.raises(ValueError):
            ASDLCEvent(
                event_type=EventType.TASK_CREATED,
                session_id="",  # Empty string should fail
                timestamp=datetime.now(timezone.utc),
            )

    def test_event_serialization(self):
        """Event can be serialized to dict."""
        event = ASDLCEvent(
            event_type=EventType.TASK_CREATED,
            session_id="session-123",
            timestamp=datetime.now(timezone.utc),
        )

        data = event.to_stream_dict()

        assert "event_type" in data
        assert data["event_type"] == "task_created"
        assert data["session_id"] == "session-123"
        assert "timestamp" in data

    def test_event_deserialization(self):
        """Event can be created from stream dict."""
        data = {
            "event_type": "task_created",
            "session_id": "session-123",
            "epic_id": "epic-001",
            "timestamp": "2026-01-22T10:00:00+00:00",
        }

        event = ASDLCEvent.from_stream_dict("evt-001", data)

        assert event.event_id == "evt-001"
        assert event.event_type == EventType.TASK_CREATED
        assert event.session_id == "session-123"
        assert event.epic_id == "epic-001"

    def test_artifact_paths_serialization(self):
        """Artifact paths are serialized as comma-separated string."""
        event = ASDLCEvent(
            event_type=EventType.TASK_COMPLETED,
            session_id="session-123",
            artifact_paths=["/path/a", "/path/b", "/path/c"],
            timestamp=datetime.now(timezone.utc),
        )

        data = event.to_stream_dict()
        assert data["artifact_paths"] == "/path/a,/path/b,/path/c"

    def test_artifact_paths_deserialization(self):
        """Artifact paths are deserialized from comma-separated string."""
        data = {
            "event_type": "task_completed",
            "session_id": "session-123",
            "artifact_paths": "/path/a,/path/b",
            "timestamp": "2026-01-22T10:00:00+00:00",
        }

        event = ASDLCEvent.from_stream_dict("evt-001", data)
        assert event.artifact_paths == ["/path/a", "/path/b"]


class TestHandlerResult:
    """Tests for HandlerResult dataclass."""

    def test_success_result(self):
        """Create successful handler result."""
        result = HandlerResult(success=True)

        assert result.success is True
        assert result.should_retry is False
        assert result.error_message is None
        assert result.artifact_paths == []

    def test_retry_result(self):
        """Create result that should be retried."""
        result = HandlerResult(
            success=False,
            should_retry=True,
            error_message="Temporary failure",
        )

        assert result.success is False
        assert result.should_retry is True
        assert result.error_message == "Temporary failure"

    def test_permanent_failure_result(self):
        """Create permanent failure result."""
        result = HandlerResult(
            success=False,
            should_retry=False,
            error_message="Invalid input",
        )

        assert result.success is False
        assert result.should_retry is False


class TestRecoveryResult:
    """Tests for RecoveryResult dataclass."""

    def test_recovery_result_fields(self):
        """RecoveryResult has all required fields."""
        result = RecoveryResult(
            processed=10,
            skipped=3,
            failed=1,
            claimed=2,
        )

        assert result.processed == 10
        assert result.skipped == 3
        assert result.failed == 1
        assert result.claimed == 2

    def test_recovery_result_total(self):
        """RecoveryResult total property."""
        result = RecoveryResult(
            processed=10,
            skipped=3,
            failed=1,
            claimed=2,
        )

        assert result.total == 16  # 10 + 3 + 1 + 2


class TestIdempotencyKey:
    """Tests for idempotency key generation."""

    def test_generate_idempotency_key(self):
        """Generate idempotency key from event data."""
        key = generate_idempotency_key(
            event_type="task_created",
            session_id="session-123",
            task_id="task-456",
        )

        assert key is not None
        assert len(key) > 0

    def test_idempotency_key_is_deterministic(self):
        """Same inputs produce same key."""
        key1 = generate_idempotency_key(
            event_type="task_created",
            session_id="session-123",
            task_id="task-456",
        )
        key2 = generate_idempotency_key(
            event_type="task_created",
            session_id="session-123",
            task_id="task-456",
        )

        assert key1 == key2

    def test_different_inputs_produce_different_keys(self):
        """Different inputs produce different keys."""
        key1 = generate_idempotency_key(
            event_type="task_created",
            session_id="session-123",
            task_id="task-456",
        )
        key2 = generate_idempotency_key(
            event_type="task_created",
            session_id="session-123",
            task_id="task-789",  # Different task
        )

        assert key1 != key2

    def test_idempotency_key_without_task_id(self):
        """Key can be generated without task_id."""
        key = generate_idempotency_key(
            event_type="session_started",
            session_id="session-123",
        )

        assert key is not None
