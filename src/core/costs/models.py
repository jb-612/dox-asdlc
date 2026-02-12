"""Data models for the agent cost tracking system.

Provides CostRecord and CostFilter frozen dataclasses with
serialization support for tracking API token usage and costs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CostRecord:
    """A single cost record for an API call.

    Attributes:
        id: Unique identifier for the cost record.
        timestamp: Unix timestamp of the API call.
        session_id: Claude session identifier.
        agent_id: Agent role that made the call.
        model: Model name used for the call.
        input_tokens: Number of input tokens consumed.
        output_tokens: Number of output tokens generated.
        estimated_cost_usd: Estimated cost in USD.
        tool_name: Tool that triggered the call (optional).
        hook_event_id: Hook event ID from telemetry (optional).
    """

    id: str
    timestamp: float
    session_id: str
    agent_id: str
    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    tool_name: str | None = None
    hook_event_id: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert cost record to dictionary for JSON serialization.

        Returns:
            Dictionary representation with all fields included.
        """
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "session_id": self.session_id,
            "agent_id": self.agent_id,
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "estimated_cost_usd": self.estimated_cost_usd,
            "tool_name": self.tool_name,
            "hook_event_id": self.hook_event_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CostRecord:
        """Create a CostRecord from a dictionary.

        Args:
            data: Dictionary containing cost record fields.

        Returns:
            CostRecord instance.
        """
        return cls(
            id=data["id"],
            timestamp=data["timestamp"],
            session_id=data["session_id"],
            agent_id=data["agent_id"],
            model=data["model"],
            input_tokens=data["input_tokens"],
            output_tokens=data["output_tokens"],
            estimated_cost_usd=data["estimated_cost_usd"],
            tool_name=data.get("tool_name"),
            hook_event_id=data.get("hook_event_id"),
        )


@dataclass(frozen=True)
class CostFilter:
    """Filter criteria for querying cost records.

    All fields default to None (no filter). Multiple non-None
    fields are combined with AND logic.

    Attributes:
        agent_id: Filter by agent role.
        session_id: Filter by session identifier.
        model: Filter by model name.
        date_from: Unix timestamp lower bound (inclusive).
        date_to: Unix timestamp upper bound (inclusive).
    """

    agent_id: str | None = None
    session_id: str | None = None
    model: str | None = None
    date_from: float | None = None
    date_to: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert filter to dictionary for JSON serialization.

        Returns:
            Dictionary representation. None-valued fields are excluded.
        """
        result: dict[str, Any] = {}
        if self.agent_id is not None:
            result["agent_id"] = self.agent_id
        if self.session_id is not None:
            result["session_id"] = self.session_id
        if self.model is not None:
            result["model"] = self.model
        if self.date_from is not None:
            result["date_from"] = self.date_from
        if self.date_to is not None:
            result["date_to"] = self.date_to
        return result

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CostFilter:
        """Create a CostFilter from a dictionary.

        Args:
            data: Dictionary containing filter fields.

        Returns:
            CostFilter instance.
        """
        return cls(
            agent_id=data.get("agent_id"),
            session_id=data.get("session_id"),
            model=data.get("model"),
            date_from=data.get("date_from"),
            date_to=data.get("date_to"),
        )
