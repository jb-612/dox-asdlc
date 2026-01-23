"""Data models for RLM (Recursive LLM) exploration.

Defines all dataclasses used by the RLM system for tracking exploration
state, findings, and execution metrics.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ToolCall:
    """Record of a tool invocation during exploration.

    Attributes:
        tool_name: Name of the tool that was called
        arguments: Arguments passed to the tool
        result: Result returned by the tool
        duration_ms: Execution duration in milliseconds
        timestamp: When the call was made
    """

    tool_name: str
    arguments: dict[str, Any]
    result: str
    duration_ms: float
    timestamp: datetime

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "result": self.result,
            "duration_ms": self.duration_ms,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ToolCall:
        """Create ToolCall from dictionary."""
        return cls(
            tool_name=data["tool_name"],
            arguments=data["arguments"],
            result=data["result"],
            duration_ms=data["duration_ms"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )


@dataclass
class GrepMatch:
    """Result from a grep/search operation.

    Attributes:
        file_path: Path to the file containing the match
        line_number: Line number of the match
        line_content: Content of the matching line
        context_before: Lines before the match
        context_after: Lines after the match
    """

    file_path: str
    line_number: int
    line_content: str
    context_before: list[str] = field(default_factory=list)
    context_after: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "line_content": self.line_content,
            "context_before": self.context_before,
            "context_after": self.context_after,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> GrepMatch:
        """Create GrepMatch from dictionary."""
        return cls(
            file_path=data["file_path"],
            line_number=data["line_number"],
            line_content=data["line_content"],
            context_before=data.get("context_before", []),
            context_after=data.get("context_after", []),
        )


@dataclass
class Citation:
    """Citation to source material found during exploration.

    Attributes:
        file_path: Path to the source file
        line_start: Starting line number (1-indexed)
        line_end: Ending line number (1-indexed)
        content_hash: SHA-256 hash of the cited content
        snippet: Optional preview of the cited content
    """

    file_path: str
    line_start: int
    line_end: int
    content_hash: str
    snippet: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "content_hash": self.content_hash,
            "snippet": self.snippet,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Citation:
        """Create Citation from dictionary."""
        return cls(
            file_path=data["file_path"],
            line_start=data["line_start"],
            line_end=data["line_end"],
            content_hash=data["content_hash"],
            snippet=data.get("snippet"),
        )

    @classmethod
    def from_content(
        cls,
        file_path: str,
        line_start: int,
        line_end: int,
        content: str,
    ) -> Citation:
        """Create Citation from content, computing the hash.

        Args:
            file_path: Path to the source file
            line_start: Starting line number
            line_end: Ending line number
            content: The content being cited

        Returns:
            Citation with computed content hash
        """
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        snippet = content[:200] + "..." if len(content) > 200 else content
        return cls(
            file_path=file_path,
            line_start=line_start,
            line_end=line_end,
            content_hash=content_hash,
            snippet=snippet,
        )


@dataclass
class Finding:
    """Individual finding from exploration.

    Attributes:
        description: Human-readable description of the finding
        evidence: Supporting evidence (code, text, etc.)
        source_file: File where the finding was made
        line_range: Optional (start, end) line numbers
        confidence: Confidence score from 0.0 to 1.0
        tags: Optional categorization tags
    """

    description: str
    evidence: str
    source_file: str
    line_range: tuple[int, int] | None = None
    confidence: float = 1.0
    tags: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Validate confidence is in valid range."""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"Confidence must be 0.0-1.0, got {self.confidence}")

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "description": self.description,
            "evidence": self.evidence,
            "source_file": self.source_file,
            "line_range": list(self.line_range) if self.line_range else None,
            "confidence": self.confidence,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Finding:
        """Create Finding from dictionary."""
        line_range = data.get("line_range")
        return cls(
            description=data["description"],
            evidence=data["evidence"],
            source_file=data["source_file"],
            line_range=tuple(line_range) if line_range else None,
            confidence=data.get("confidence", 1.0),
            tags=data.get("tags", []),
        )


@dataclass
class ExplorationStep:
    """Single step in the exploration trajectory.

    Attributes:
        iteration: Iteration number (0-indexed)
        thought: Agent's reasoning for this step
        tool_calls: List of tool calls made in this step
        findings_so_far: Summary of findings accumulated
        next_direction: Planned direction for next step
        subcalls_used: Number of sub-calls used in this step
    """

    iteration: int
    thought: str
    tool_calls: list[ToolCall]
    findings_so_far: list[str]
    next_direction: str
    subcalls_used: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "iteration": self.iteration,
            "thought": self.thought,
            "tool_calls": [tc.to_dict() for tc in self.tool_calls],
            "findings_so_far": self.findings_so_far,
            "next_direction": self.next_direction,
            "subcalls_used": self.subcalls_used,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ExplorationStep:
        """Create ExplorationStep from dictionary."""
        return cls(
            iteration=data["iteration"],
            thought=data["thought"],
            tool_calls=[ToolCall.from_dict(tc) for tc in data.get("tool_calls", [])],
            findings_so_far=data.get("findings_so_far", []),
            next_direction=data.get("next_direction", ""),
            subcalls_used=data.get("subcalls_used", 0),
        )


@dataclass
class ExplorationTrajectory:
    """Records the full exploration path.

    Attributes:
        steps: List of exploration steps
        start_time: When exploration started
        end_time: When exploration ended (None if in progress)
        total_subcalls: Total sub-calls made
        cached_hits: Number of cache hits
        query: Original exploration query
        context_hints: Initial context hints provided
    """

    steps: list[ExplorationStep]
    start_time: datetime
    end_time: datetime | None
    total_subcalls: int
    cached_hits: int
    query: str
    context_hints: list[str] = field(default_factory=list)

    @property
    def duration_seconds(self) -> float | None:
        """Calculate duration in seconds, or None if not complete."""
        if self.end_time is None:
            return None
        return (self.end_time - self.start_time).total_seconds()

    @property
    def iteration_count(self) -> int:
        """Return the number of iterations completed."""
        return len(self.steps)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "steps": [step.to_dict() for step in self.steps],
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "total_subcalls": self.total_subcalls,
            "cached_hits": self.cached_hits,
            "query": self.query,
            "context_hints": self.context_hints,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ExplorationTrajectory:
        """Create ExplorationTrajectory from dictionary."""
        end_time = data.get("end_time")
        return cls(
            steps=[ExplorationStep.from_dict(s) for s in data.get("steps", [])],
            start_time=datetime.fromisoformat(data["start_time"]),
            end_time=datetime.fromisoformat(end_time) if end_time else None,
            total_subcalls=data.get("total_subcalls", 0),
            cached_hits=data.get("cached_hits", 0),
            query=data.get("query", ""),
            context_hints=data.get("context_hints", []),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> ExplorationTrajectory:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))


@dataclass
class RLMUsage:
    """Resource usage metrics for RLM execution.

    Attributes:
        subcall_count: Total number of sub-calls made
        cached_subcalls: Number of sub-calls served from cache
        total_tokens: Total tokens used across all calls
        wall_time_seconds: Wall clock time for execution
        model_calls: Number of LLM model API calls
        budget_limit: Maximum sub-calls allowed
        budget_remaining: Sub-calls remaining in budget
    """

    subcall_count: int
    cached_subcalls: int
    total_tokens: int
    wall_time_seconds: float
    model_calls: int
    budget_limit: int = 50
    budget_remaining: int = 50

    @property
    def cache_hit_rate(self) -> float:
        """Calculate cache hit rate as a percentage."""
        if self.subcall_count == 0:
            return 0.0
        return (self.cached_subcalls / self.subcall_count) * 100

    @property
    def budget_used_percentage(self) -> float:
        """Calculate percentage of budget used."""
        if self.budget_limit == 0:
            return 0.0
        return ((self.budget_limit - self.budget_remaining) / self.budget_limit) * 100

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "subcall_count": self.subcall_count,
            "cached_subcalls": self.cached_subcalls,
            "total_tokens": self.total_tokens,
            "wall_time_seconds": self.wall_time_seconds,
            "model_calls": self.model_calls,
            "budget_limit": self.budget_limit,
            "budget_remaining": self.budget_remaining,
            "cache_hit_rate": self.cache_hit_rate,
            "budget_used_percentage": self.budget_used_percentage,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RLMUsage:
        """Create RLMUsage from dictionary."""
        return cls(
            subcall_count=data["subcall_count"],
            cached_subcalls=data["cached_subcalls"],
            total_tokens=data["total_tokens"],
            wall_time_seconds=data["wall_time_seconds"],
            model_calls=data["model_calls"],
            budget_limit=data.get("budget_limit", 50),
            budget_remaining=data.get("budget_remaining", 50),
        )


@dataclass
class RLMResult:
    """Result from RLM exploration.

    Attributes:
        task_id: Unique identifier for this exploration
        success: Whether exploration completed successfully
        findings: List of findings discovered
        synthesis: Final summarized answer
        trajectory: Full exploration path
        usage: Resource usage metrics
        citations: List of citations to source material
        error: Error message if exploration failed
    """

    task_id: str
    success: bool
    findings: list[Finding]
    synthesis: str
    trajectory: ExplorationTrajectory
    usage: RLMUsage
    citations: list[Citation]
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "task_id": self.task_id,
            "success": self.success,
            "findings": [f.to_dict() for f in self.findings],
            "synthesis": self.synthesis,
            "trajectory": self.trajectory.to_dict(),
            "usage": self.usage.to_dict(),
            "citations": [c.to_dict() for c in self.citations],
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RLMResult:
        """Create RLMResult from dictionary."""
        return cls(
            task_id=data["task_id"],
            success=data["success"],
            findings=[Finding.from_dict(f) for f in data.get("findings", [])],
            synthesis=data.get("synthesis", ""),
            trajectory=ExplorationTrajectory.from_dict(data["trajectory"]),
            usage=RLMUsage.from_dict(data["usage"]),
            citations=[Citation.from_dict(c) for c in data.get("citations", [])],
            error=data.get("error"),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> RLMResult:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    @classmethod
    def failure(
        cls,
        task_id: str,
        error: str,
        trajectory: ExplorationTrajectory,
        usage: RLMUsage,
    ) -> RLMResult:
        """Create a failure result.

        Args:
            task_id: Task identifier
            error: Error message
            trajectory: Exploration trajectory up to failure
            usage: Resource usage at time of failure

        Returns:
            RLMResult indicating failure
        """
        return cls(
            task_id=task_id,
            success=False,
            findings=[],
            synthesis="",
            trajectory=trajectory,
            usage=usage,
            citations=[],
            error=error,
        )
