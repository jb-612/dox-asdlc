"""Audit trail generation for RLM exploration.

Provides persistence and replay capabilities for exploration trajectories.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.workers.rlm.models import (
    ExplorationTrajectory,
    RLMResult,
    RLMUsage,
)

logger = logging.getLogger(__name__)


@dataclass
class AuditEntry:
    """Single audit log entry.

    Attributes:
        task_id: Task identifier
        timestamp: When the audit was created
        query: Original exploration query
        success: Whether exploration succeeded
        findings_count: Number of findings
        iterations: Number of iterations
        subcalls_used: Total sub-calls made
        wall_time_seconds: Total wall time
        file_path: Path to saved audit file
    """

    task_id: str
    timestamp: datetime
    query: str
    success: bool
    findings_count: int
    iterations: int
    subcalls_used: int
    wall_time_seconds: float
    file_path: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "task_id": self.task_id,
            "timestamp": self.timestamp.isoformat(),
            "query": self.query,
            "success": self.success,
            "findings_count": self.findings_count,
            "iterations": self.iterations,
            "subcalls_used": self.subcalls_used,
            "wall_time_seconds": self.wall_time_seconds,
            "file_path": self.file_path,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AuditEntry:
        """Create from dictionary."""
        return cls(
            task_id=data["task_id"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            query=data["query"],
            success=data["success"],
            findings_count=data["findings_count"],
            iterations=data["iterations"],
            subcalls_used=data["subcalls_used"],
            wall_time_seconds=data["wall_time_seconds"],
            file_path=data["file_path"],
        )


@dataclass
class RLMAuditor:
    """Audit trail generator for RLM exploration.

    Saves exploration results and trajectories for analysis and replay.

    Attributes:
        audit_dir: Directory for saving audit files
        index_file: Path to the audit index file

    Example:
        auditor = RLMAuditor(audit_dir="telemetry/rlm")

        # Save a result
        auditor.save_result(result)

        # Load for analysis
        trajectory = auditor.load_trajectory(task_id)

        # List all audits
        entries = auditor.list_audits()
    """

    audit_dir: str = "telemetry/rlm"
    index_file: str = "index.json"
    _index: list[AuditEntry] = field(default_factory=list, init=False)
    _loaded: bool = field(default=False, init=False)

    def __post_init__(self) -> None:
        """Ensure audit directory exists."""
        self._ensure_dir()

    def _ensure_dir(self) -> Path:
        """Ensure audit directory exists."""
        path = Path(self.audit_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _get_index_path(self) -> Path:
        """Get path to index file."""
        return Path(self.audit_dir) / self.index_file

    def _load_index(self) -> None:
        """Load audit index from disk."""
        if self._loaded:
            return

        index_path = self._get_index_path()
        if index_path.exists():
            try:
                with open(index_path) as f:
                    data = json.load(f)
                    self._index = [AuditEntry.from_dict(e) for e in data]
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Failed to load audit index: {e}")
                self._index = []
        else:
            self._index = []

        self._loaded = True

    def _save_index(self) -> None:
        """Save audit index to disk."""
        index_path = self._get_index_path()
        with open(index_path, "w") as f:
            json.dump([e.to_dict() for e in self._index], f, indent=2)

    def save_result(self, result: RLMResult) -> str:
        """Save an RLM result to the audit trail.

        Args:
            result: The RLMResult to save

        Returns:
            Path to the saved file
        """
        self._ensure_dir()
        self._load_index()

        # Generate filename
        timestamp = datetime.now(timezone.utc)
        safe_task_id = result.task_id.replace("/", "_").replace("\\", "_")
        filename = f"{timestamp.strftime('%Y%m%d_%H%M%S')}_{safe_task_id}.json"
        file_path = Path(self.audit_dir) / filename

        # Save full result
        with open(file_path, "w") as f:
            json.dump(result.to_dict(), f, indent=2)

        # Create index entry
        entry = AuditEntry(
            task_id=result.task_id,
            timestamp=timestamp,
            query=result.trajectory.query,
            success=result.success,
            findings_count=len(result.findings),
            iterations=len(result.trajectory.steps),
            subcalls_used=result.usage.subcall_count,
            wall_time_seconds=result.usage.wall_time_seconds,
            file_path=str(file_path),
        )

        self._index.append(entry)
        self._save_index()

        logger.info(f"Saved audit for task {result.task_id} to {file_path}")

        return str(file_path)

    def save_trajectory(self, trajectory: ExplorationTrajectory, task_id: str) -> str:
        """Save just an exploration trajectory.

        Args:
            trajectory: The trajectory to save
            task_id: Task identifier

        Returns:
            Path to the saved file
        """
        self._ensure_dir()
        self._load_index()

        timestamp = datetime.now(timezone.utc)
        safe_task_id = task_id.replace("/", "_").replace("\\", "_")
        filename = f"{timestamp.strftime('%Y%m%d_%H%M%S')}_{safe_task_id}_trajectory.json"
        file_path = Path(self.audit_dir) / filename

        with open(file_path, "w") as f:
            json.dump(trajectory.to_dict(), f, indent=2)

        logger.info(f"Saved trajectory for task {task_id} to {file_path}")

        return str(file_path)

    def load_result(self, task_id: str) -> RLMResult | None:
        """Load an RLM result by task ID.

        Args:
            task_id: Task identifier to load

        Returns:
            RLMResult if found, None otherwise
        """
        self._load_index()

        # Find entry in index
        entry = None
        for e in reversed(self._index):  # Most recent first
            if e.task_id == task_id:
                entry = e
                break

        if entry is None:
            logger.warning(f"No audit found for task {task_id}")
            return None

        return self.load_result_from_file(entry.file_path)

    def load_result_from_file(self, file_path: str) -> RLMResult | None:
        """Load an RLM result from a specific file.

        Args:
            file_path: Path to the audit file

        Returns:
            RLMResult if successful, None otherwise
        """
        path = Path(file_path)
        if not path.exists():
            logger.warning(f"Audit file not found: {file_path}")
            return None

        try:
            with open(path) as f:
                data = json.load(f)
                return RLMResult.from_dict(data)
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Failed to load audit from {file_path}: {e}")
            return None

    def load_trajectory(self, task_id: str) -> ExplorationTrajectory | None:
        """Load an exploration trajectory by task ID.

        Args:
            task_id: Task identifier

        Returns:
            ExplorationTrajectory if found, None otherwise
        """
        result = self.load_result(task_id)
        if result:
            return result.trajectory
        return None

    def list_audits(
        self,
        limit: int | None = None,
        success_only: bool = False,
    ) -> list[AuditEntry]:
        """List audit entries.

        Args:
            limit: Maximum number to return (newest first)
            success_only: Only return successful explorations

        Returns:
            List of AuditEntry objects
        """
        self._load_index()

        entries = list(reversed(self._index))  # Newest first

        if success_only:
            entries = [e for e in entries if e.success]

        if limit:
            entries = entries[:limit]

        return entries

    def get_audit_by_task_id(self, task_id: str) -> AuditEntry | None:
        """Get audit entry by task ID.

        Args:
            task_id: Task identifier

        Returns:
            AuditEntry if found, None otherwise
        """
        self._load_index()

        for entry in reversed(self._index):
            if entry.task_id == task_id:
                return entry
        return None

    def delete_audit(self, task_id: str) -> bool:
        """Delete an audit entry and its file.

        Args:
            task_id: Task identifier to delete

        Returns:
            True if deleted, False if not found
        """
        self._load_index()

        for i, entry in enumerate(self._index):
            if entry.task_id == task_id:
                # Delete file
                path = Path(entry.file_path)
                if path.exists():
                    path.unlink()

                # Remove from index
                del self._index[i]
                self._save_index()

                logger.info(f"Deleted audit for task {task_id}")
                return True

        return False

    def get_stats(self) -> dict[str, Any]:
        """Get audit statistics.

        Returns:
            Dictionary with audit statistics
        """
        self._load_index()

        if not self._index:
            return {
                "total_audits": 0,
                "successful": 0,
                "failed": 0,
                "success_rate": 0.0,
                "avg_iterations": 0.0,
                "avg_wall_time": 0.0,
            }

        successful = sum(1 for e in self._index if e.success)
        total_iterations = sum(e.iterations for e in self._index)
        total_wall_time = sum(e.wall_time_seconds for e in self._index)

        return {
            "total_audits": len(self._index),
            "successful": successful,
            "failed": len(self._index) - successful,
            "success_rate": (successful / len(self._index)) * 100,
            "avg_iterations": total_iterations / len(self._index),
            "avg_wall_time": total_wall_time / len(self._index),
            "total_subcalls": sum(e.subcalls_used for e in self._index),
            "total_findings": sum(e.findings_count for e in self._index),
        }

    def clear_all(self) -> int:
        """Clear all audit files and index.

        Returns:
            Number of entries cleared
        """
        self._load_index()
        count = len(self._index)

        # Delete all files
        for entry in self._index:
            path = Path(entry.file_path)
            if path.exists():
                path.unlink()

        # Clear index
        self._index = []
        self._save_index()

        logger.info(f"Cleared {count} audit entries")
        return count

    def __repr__(self) -> str:
        """Return string representation."""
        self._load_index()
        return f"RLMAuditor(dir={self.audit_dir}, entries={len(self._index)})"
