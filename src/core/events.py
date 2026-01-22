"""Event models for aSDLC orchestration.

Defines event types, the ASDLCEvent model, and related data structures
for Redis Streams event coordination.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class EventType(str, Enum):
    """All event types in the aSDLC workflow."""

    # Session lifecycle
    SESSION_STARTED = "session_started"
    SESSION_COMPLETED = "session_completed"

    # Task lifecycle
    TASK_CREATED = "task_created"
    TASK_DISPATCHED = "task_dispatched"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"

    # HITL gate events
    GATE_REQUESTED = "gate_requested"
    GATE_APPROVED = "gate_approved"
    GATE_REJECTED = "gate_rejected"
    GATE_EXPIRED = "gate_expired"

    # Agent execution events
    AGENT_STARTED = "agent_started"
    AGENT_COMPLETED = "agent_completed"
    AGENT_ERROR = "agent_error"

    # Patch/artifact events
    PATCH_CREATED = "patch_created"
    PATCH_APPLIED = "patch_applied"
    PATCH_REJECTED = "patch_rejected"


@dataclass
class ASDLCEvent:
    """Base event model for aSDLC event stream.

    All events in the system conform to this model for consistent
    processing and validation.
    """

    event_type: EventType
    session_id: str
    timestamp: datetime
    event_id: str | None = None  # Assigned by Redis
    epic_id: str | None = None
    task_id: str | None = None
    git_sha: str | None = None
    artifact_paths: list[str] = field(default_factory=list)
    mode: str = "normal"  # "normal" or "rlm"
    tenant_id: str | None = None
    idempotency_key: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validate event after initialization."""
        if not self.session_id or not self.session_id.strip():
            raise ValueError("session_id is required and cannot be empty")

        # Convert string event_type to enum if needed
        if isinstance(self.event_type, str):
            self.event_type = EventType(self.event_type)

        # Ensure timestamp is timezone-aware
        if self.timestamp.tzinfo is None:
            self.timestamp = self.timestamp.replace(tzinfo=timezone.utc)

    def to_stream_dict(self) -> dict[str, str]:
        """Convert event to dict for Redis stream storage.

        Redis streams store string values, so we serialize appropriately.
        """
        data: dict[str, str] = {
            "event_type": self.event_type.value,
            "session_id": self.session_id,
            "timestamp": self.timestamp.isoformat(),
            "mode": self.mode,
        }

        if self.epic_id:
            data["epic_id"] = self.epic_id
        if self.task_id:
            data["task_id"] = self.task_id
        if self.git_sha:
            data["git_sha"] = self.git_sha
        if self.artifact_paths:
            data["artifact_paths"] = ",".join(self.artifact_paths)
        if self.tenant_id:
            data["tenant_id"] = self.tenant_id
        if self.idempotency_key:
            data["idempotency_key"] = self.idempotency_key
        if self.metadata:
            # Store metadata as JSON string
            import json
            data["metadata"] = json.dumps(self.metadata)

        return data

    @classmethod
    def from_stream_dict(
        cls,
        event_id: str,
        data: dict[str, Any],
    ) -> ASDLCEvent:
        """Create event from Redis stream entry.

        Args:
            event_id: The Redis stream entry ID.
            data: The field-value dict from the stream.

        Returns:
            ASDLCEvent instance.
        """
        # Parse artifact_paths from comma-separated string
        artifact_paths_str = data.get("artifact_paths", "")
        if isinstance(artifact_paths_str, str) and artifact_paths_str:
            artifact_paths = artifact_paths_str.split(",")
        else:
            artifact_paths = []

        # Parse timestamp
        timestamp_str = data.get("timestamp", "")
        if timestamp_str:
            timestamp = datetime.fromisoformat(timestamp_str)
        else:
            timestamp = datetime.now(timezone.utc)

        # Parse metadata
        metadata_str = data.get("metadata", "")
        if metadata_str:
            import json
            try:
                metadata = json.loads(metadata_str)
            except (json.JSONDecodeError, TypeError):
                metadata = {}
        else:
            metadata = {}

        return cls(
            event_id=event_id,
            event_type=EventType(data.get("event_type", "task_created")),
            session_id=data.get("session_id", ""),
            epic_id=data.get("epic_id"),
            task_id=data.get("task_id"),
            git_sha=data.get("git_sha"),
            artifact_paths=artifact_paths,
            mode=data.get("mode", "normal"),
            tenant_id=data.get("tenant_id"),
            timestamp=timestamp,
            idempotency_key=data.get("idempotency_key"),
            metadata=metadata,
        )


@dataclass
class HandlerResult:
    """Result from an event handler.

    Indicates whether processing succeeded and whether the event
    should be acknowledged or retried.
    """

    success: bool
    should_retry: bool = False
    error_message: str | None = None
    artifact_paths: list[str] = field(default_factory=list)


@dataclass
class RecoveryResult:
    """Result from recovery processing.

    Reports statistics from recovering pending events after restart.
    """

    processed: int
    skipped: int  # Already processed (idempotent)
    failed: int
    claimed: int  # From dead consumers

    @property
    def total(self) -> int:
        """Total events handled during recovery."""
        return self.processed + self.skipped + self.failed + self.claimed


def generate_idempotency_key(
    event_type: str,
    session_id: str,
    task_id: str | None = None,
    epic_id: str | None = None,
    extra: str | None = None,
) -> str:
    """Generate a deterministic idempotency key for an event.

    The key is a hash of the event's identifying information,
    ensuring the same event always produces the same key.

    Args:
        event_type: The type of event.
        session_id: The session identifier.
        task_id: Optional task identifier.
        epic_id: Optional epic identifier.
        extra: Optional extra data to include in the hash.

    Returns:
        A deterministic hex string key.
    """
    components = [event_type, session_id]

    if task_id:
        components.append(task_id)
    if epic_id:
        components.append(epic_id)
    if extra:
        components.append(extra)

    content = ":".join(components)
    return hashlib.sha256(content.encode()).hexdigest()[:32]
