"""Pydantic models for CLI coordination messages."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class MessageType(str, Enum):
    """Types of coordination messages between CLI instances."""

    # Review workflow
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    REVIEW_COMPLETE = "REVIEW_COMPLETE"
    REVIEW_FAILED = "REVIEW_FAILED"

    # Contract management
    CONTRACT_CHANGE_PROPOSED = "CONTRACT_CHANGE_PROPOSED"
    CONTRACT_REVIEW_NEEDED = "CONTRACT_REVIEW_NEEDED"
    CONTRACT_FEEDBACK = "CONTRACT_FEEDBACK"
    CONTRACT_APPROVED = "CONTRACT_APPROVED"
    CONTRACT_REJECTED = "CONTRACT_REJECTED"

    # Meta file changes
    META_CHANGE_REQUEST = "META_CHANGE_REQUEST"
    META_CHANGE_COMPLETE = "META_CHANGE_COMPLETE"

    # General coordination
    INTERFACE_UPDATE = "INTERFACE_UPDATE"
    BLOCKING_ISSUE = "BLOCKING_ISSUE"
    GENERAL = "GENERAL"

    # Status updates
    STATUS_UPDATE = "STATUS_UPDATE"
    HEARTBEAT = "HEARTBEAT"

    # Notifications
    NOTIFICATION = "NOTIFICATION"


class MessagePayload(BaseModel):
    """Payload content for coordination messages."""

    subject: str = Field(..., description="Brief subject line for the message")
    description: str = Field(..., description="Detailed message content")

    def to_dict(self) -> dict[str, str]:
        """Convert to dictionary for JSON serialization."""
        return {"subject": self.subject, "description": self.description}


class CoordinationMessage(BaseModel):
    """A coordination message between CLI instances."""

    id: str = Field(..., description="Unique message identifier (msg-{uuid8})")
    type: MessageType = Field(..., description="Type of coordination message")
    from_instance: str = Field(..., alias="from", description="Sender instance ID")
    to_instance: str = Field(..., alias="to", description="Target instance ID or 'all'")
    timestamp: datetime = Field(..., description="Message creation timestamp (UTC)")
    requires_ack: bool = Field(default=True, description="Whether acknowledgment is required")
    acknowledged: bool = Field(default=False, description="Whether message has been acknowledged")
    payload: MessagePayload = Field(..., description="Message content")

    # Acknowledgment fields (optional, set when acknowledged)
    ack_by: str | None = Field(default=None, description="Instance that acknowledged")
    ack_timestamp: datetime | None = Field(default=None, description="When acknowledged")
    ack_comment: str | None = Field(default=None, description="Optional ack comment")

    model_config = {
        "populate_by_name": True,  # Allow both 'from' and 'from_instance'
        "json_encoders": {
            datetime: lambda v: v.isoformat() + "Z" if v else None,
        },
    }

    @field_validator("timestamp", "ack_timestamp", mode="before")
    @classmethod
    def parse_timestamp(cls, v: Any) -> datetime | None:
        """Parse timestamp from ISO format string."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            # Handle Z suffix
            if v.endswith("Z"):
                v = v[:-1] + "+00:00"
            return datetime.fromisoformat(v)
        return v

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary matching filesystem JSON format."""
        result: dict[str, Any] = {
            "id": self.id,
            "type": self.type.value,
            "from": self.from_instance,
            "to": self.to_instance,
            "timestamp": self.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "requires_ack": self.requires_ack,
            "acknowledged": self.acknowledged,
            "payload": self.payload.to_dict(),
        }
        if self.ack_by:
            result["ack_by"] = self.ack_by
        if self.ack_timestamp:
            result["ack_timestamp"] = self.ack_timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        if self.ack_comment:
            result["ack_comment"] = self.ack_comment
        return result

    def to_json(self) -> str:
        """Convert to JSON string."""
        import json

        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CoordinationMessage:
        """Create from dictionary (filesystem JSON format)."""
        # Handle 'from' -> 'from_instance' mapping
        if "from" in data and "from_instance" not in data:
            data = {**data, "from_instance": data["from"]}
        if "to" in data and "to_instance" not in data:
            data = {**data, "to_instance": data["to"]}

        # Convert payload dict to MessagePayload
        if isinstance(data.get("payload"), dict):
            data = {**data, "payload": MessagePayload(**data["payload"])}

        return cls(**data)


class MessageQuery(BaseModel):
    """Query parameters for filtering coordination messages."""

    to_instance: str | None = Field(default=None, description="Filter by target instance")
    from_instance: str | None = Field(default=None, description="Filter by sender instance")
    msg_type: MessageType | None = Field(default=None, description="Filter by message type")
    pending_only: bool = Field(default=False, description="Only unacknowledged messages")
    since: datetime | None = Field(default=None, description="Messages after this timestamp")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum results")

    @field_validator("since", mode="before")
    @classmethod
    def parse_since(cls, v: Any) -> datetime | None:
        """Parse since timestamp."""
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            if v.endswith("Z"):
                v = v[:-1] + "+00:00"
            return datetime.fromisoformat(v)
        return v


class NotificationEvent(BaseModel):
    """Real-time notification event from pub/sub."""

    event: str = Field(default="message_published", description="Event type")
    message_id: str = Field(..., description="ID of the published message")
    msg_type: MessageType = Field(..., description="Type of the message")
    from_instance: str = Field(..., description="Sender instance")
    to_instance: str = Field(..., description="Target instance")
    requires_ack: bool = Field(..., description="Whether ack is required")
    timestamp: datetime = Field(..., description="Event timestamp")

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "event": self.event,
            "message_id": self.message_id,
            "type": self.msg_type.value,
            "from": self.from_instance,
            "to": self.to_instance,
            "requires_ack": self.requires_ack,
            "timestamp": self.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        import json

        return json.dumps(self.to_dict())

    @classmethod
    def from_message(cls, msg: CoordinationMessage) -> NotificationEvent:
        """Create notification event from a coordination message."""
        return cls(
            event="message_published",
            message_id=msg.id,
            msg_type=msg.type,
            from_instance=msg.from_instance,
            to_instance=msg.to_instance,
            requires_ack=msg.requires_ack,
            timestamp=msg.timestamp,
        )

    @classmethod
    def from_json(cls, json_str: str) -> NotificationEvent:
        """Create notification event from JSON string.

        Args:
            json_str: JSON string representation of a notification event

        Returns:
            NotificationEvent instance

        Raises:
            ValueError: If JSON is invalid or missing required fields
        """
        import json

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}") from e

        # Parse timestamp
        timestamp_str = data.get("timestamp", "")
        if timestamp_str.endswith("Z"):
            timestamp_str = timestamp_str[:-1] + "+00:00"
        timestamp = datetime.fromisoformat(timestamp_str)

        return cls(
            event=data.get("event", "message_published"),
            message_id=data["message_id"],
            msg_type=MessageType(data["type"]),
            from_instance=data["from"],
            to_instance=data["to"],
            requires_ack=data["requires_ack"],
            timestamp=timestamp,
        )


class PresenceInfo(BaseModel):
    """Instance presence information."""

    instance_id: str = Field(..., description="CLI instance identifier")
    active: bool = Field(default=True, description="Whether instance is active")
    last_heartbeat: datetime = Field(..., description="Last heartbeat timestamp")
    session_id: str | None = Field(default=None, description="Current session ID")

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "instance_id": self.instance_id,
            "active": self.active,
            "last_heartbeat": self.last_heartbeat.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "session_id": self.session_id,
        }

    def is_stale(self, timeout_minutes: int = 5) -> bool:
        """Check if presence is stale (no heartbeat within timeout)."""

        now = datetime.now(UTC)
        # Make last_heartbeat timezone-aware if it isn't
        last_hb = self.last_heartbeat
        if last_hb.tzinfo is None:
            last_hb = last_hb.replace(tzinfo=UTC)
        delta = now - last_hb
        return delta.total_seconds() > timeout_minutes * 60


class CoordinationStats(BaseModel):
    """Statistics about the coordination system."""

    total_messages: int = Field(default=0, description="Total message count")
    pending_messages: int = Field(default=0, description="Unacknowledged messages")
    messages_by_type: dict[str, int] = Field(
        default_factory=dict, description="Message counts by type"
    )
    active_instances: int = Field(default=0, description="Number of active instances")
    instance_names: list[str] = Field(
        default_factory=list, description="Names of active instances"
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "total_messages": self.total_messages,
            "pending_messages": self.pending_messages,
            "messages_by_type": self.messages_by_type,
            "active_instances": self.active_instances,
            "instance_names": self.instance_names,
        }
