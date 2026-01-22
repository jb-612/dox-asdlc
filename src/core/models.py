"""Core domain models for aSDLC.

Shared models used across multiple modules.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AgentRole(str, Enum):
    """Agent role for context generation."""

    CODING = "coding"
    TESTING = "testing"
    REVIEWING = "reviewing"
    DEBUGGING = "debugging"
    DESIGNING = "designing"


@dataclass
class FileContent:
    """Content of a file in a context pack.

    Attributes:
        file_path: Path to the file (relative to repo root)
        content: Full or partial file content
        relevance_score: Score indicating relevance to task (0.0-1.0)
        start_line: Starting line number if partial content
        end_line: Ending line number if partial content
        symbols: List of symbol names defined in this file
    """

    file_path: str
    content: str
    relevance_score: float = 1.0
    start_line: int | None = None
    end_line: int | None = None
    symbols: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "file_path": self.file_path,
            "content": self.content,
            "relevance_score": self.relevance_score,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "symbols": self.symbols,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> FileContent:
        """Create from dictionary."""
        return cls(
            file_path=data["file_path"],
            content=data["content"],
            relevance_score=data.get("relevance_score", 1.0),
            start_line=data.get("start_line"),
            end_line=data.get("end_line"),
            symbols=data.get("symbols", []),
        )


@dataclass
class ContextPack:
    """Context pack for agent task execution.

    Contains relevant code files and metadata for a specific task.

    Attributes:
        task_description: Natural language description of the task
        files: List of file contents with relevance scores
        role: Agent role this pack was generated for
        token_count: Actual token count of the context
        token_budget: Token budget that was applied
        metadata: Additional metadata (git_sha, repo_path, etc.)
    """

    task_description: str
    files: list[FileContent]
    role: AgentRole
    token_count: int
    token_budget: int
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "task_description": self.task_description,
            "files": [f.to_dict() for f in self.files],
            "role": self.role.value,
            "token_count": self.token_count,
            "token_budget": self.token_budget,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ContextPack:
        """Create from dictionary."""
        return cls(
            task_description=data["task_description"],
            files=[FileContent.from_dict(f) for f in data["files"]],
            role=AgentRole(data["role"]),
            token_count=data["token_count"],
            token_budget=data["token_budget"],
            metadata=data.get("metadata", {}),
        )
