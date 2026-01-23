"""Unit tests for RLMAuditor."""

from __future__ import annotations

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

from src.workers.rlm.audit import AuditEntry, RLMAuditor
from src.workers.rlm.models import (
    Citation,
    ExplorationStep,
    ExplorationTrajectory,
    Finding,
    RLMResult,
    RLMUsage,
    ToolCall,
)


def create_test_result(
    task_id: str = "test-task-123",
    success: bool = True,
    query: str = "Test query",
) -> RLMResult:
    """Create a test RLMResult."""
    trajectory = ExplorationTrajectory(
        steps=[
            ExplorationStep(
                iteration=0,
                thought="Testing",
                tool_calls=[],
                findings_so_far=["Found something"],
                next_direction="Continue",
            )
        ],
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        total_subcalls=5,
        cached_hits=2,
        query=query,
        context_hints=["hint1"],
    )

    usage = RLMUsage(
        subcall_count=5,
        cached_subcalls=2,
        total_tokens=500,
        wall_time_seconds=10.5,
        model_calls=3,
        budget_limit=50,
        budget_remaining=45,
    )

    if success:
        return RLMResult(
            task_id=task_id,
            success=True,
            findings=[
                Finding(
                    description="Test finding",
                    evidence="code here",
                    source_file="test.py",
                )
            ],
            synthesis="Test synthesis",
            trajectory=trajectory,
            usage=usage,
            citations=[
                Citation(
                    file_path="test.py",
                    line_start=1,
                    line_end=10,
                    content_hash="abc123",
                )
            ],
        )
    else:
        return RLMResult.failure(
            task_id=task_id,
            error="Test error",
            trajectory=trajectory,
            usage=usage,
        )


class TestAuditEntry:
    """Tests for AuditEntry dataclass."""

    def test_create_entry(self) -> None:
        """Test creating an audit entry."""
        entry = AuditEntry(
            task_id="task-123",
            timestamp=datetime.now(timezone.utc),
            query="Test query",
            success=True,
            findings_count=3,
            iterations=5,
            subcalls_used=10,
            wall_time_seconds=25.5,
            file_path="/path/to/audit.json",
        )

        assert entry.task_id == "task-123"
        assert entry.success is True
        assert entry.findings_count == 3

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        timestamp = datetime.now(timezone.utc)
        entry = AuditEntry(
            task_id="task-123",
            timestamp=timestamp,
            query="Query",
            success=True,
            findings_count=2,
            iterations=3,
            subcalls_used=5,
            wall_time_seconds=10.0,
            file_path="/path/to/file.json",
        )

        data = entry.to_dict()

        assert data["task_id"] == "task-123"
        assert data["timestamp"] == timestamp.isoformat()
        assert data["success"] is True

    def test_from_dict(self) -> None:
        """Test creation from dictionary."""
        timestamp = datetime.now(timezone.utc)
        data = {
            "task_id": "task-123",
            "timestamp": timestamp.isoformat(),
            "query": "Query",
            "success": False,
            "findings_count": 0,
            "iterations": 2,
            "subcalls_used": 3,
            "wall_time_seconds": 5.0,
            "file_path": "/path/file.json",
        }

        entry = AuditEntry.from_dict(data)

        assert entry.task_id == "task-123"
        assert entry.success is False


class TestRLMAuditorCreation:
    """Tests for RLMAuditor creation."""

    def test_create_with_defaults(self) -> None:
        """Test creating auditor with defaults."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            assert auditor.audit_dir == tmpdir
            assert auditor.index_file == "index.json"

    def test_creates_directory(self) -> None:
        """Test that auditor creates directory if needed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            new_dir = Path(tmpdir) / "new" / "audit"
            auditor = RLMAuditor(audit_dir=str(new_dir))

            assert new_dir.exists()


class TestRLMAuditorSave:
    """Tests for saving audit data."""

    def test_save_result(self) -> None:
        """Test saving an RLM result."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            result = create_test_result()

            file_path = auditor.save_result(result)

            assert Path(file_path).exists()
            assert result.task_id in file_path

    def test_save_creates_index(self) -> None:
        """Test that saving creates index entry."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            result = create_test_result()

            auditor.save_result(result)

            index_path = Path(tmpdir) / "index.json"
            assert index_path.exists()

            with open(index_path) as f:
                index = json.load(f)
                assert len(index) == 1
                assert index[0]["task_id"] == result.task_id

    def test_save_multiple_results(self) -> None:
        """Test saving multiple results."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            for i in range(3):
                result = create_test_result(task_id=f"task-{i}")
                auditor.save_result(result)

            entries = auditor.list_audits()
            assert len(entries) == 3

    def test_save_trajectory(self) -> None:
        """Test saving just a trajectory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            result = create_test_result()

            file_path = auditor.save_trajectory(result.trajectory, "traj-123")

            assert Path(file_path).exists()
            assert "trajectory" in file_path


class TestRLMAuditorLoad:
    """Tests for loading audit data."""

    def test_load_result(self) -> None:
        """Test loading a result by task ID."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            original = create_test_result()
            auditor.save_result(original)

            loaded = auditor.load_result(original.task_id)

            assert loaded is not None
            assert loaded.task_id == original.task_id
            assert loaded.success == original.success
            assert len(loaded.findings) == len(original.findings)

    def test_load_nonexistent_result(self) -> None:
        """Test loading a nonexistent result."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            loaded = auditor.load_result("nonexistent-task")

            assert loaded is None

    def test_load_result_from_file(self) -> None:
        """Test loading from a specific file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            result = create_test_result()
            file_path = auditor.save_result(result)

            loaded = auditor.load_result_from_file(file_path)

            assert loaded is not None
            assert loaded.task_id == result.task_id

    def test_load_trajectory(self) -> None:
        """Test loading just a trajectory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            result = create_test_result()
            auditor.save_result(result)

            trajectory = auditor.load_trajectory(result.task_id)

            assert trajectory is not None
            assert trajectory.query == result.trajectory.query

    def test_load_most_recent_for_task_id(self) -> None:
        """Test that loading gets most recent for duplicate task IDs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            # Save same task ID twice with different queries
            result1 = create_test_result(task_id="dup-task", query="First")
            auditor.save_result(result1)

            result2 = create_test_result(task_id="dup-task", query="Second")
            auditor.save_result(result2)

            loaded = auditor.load_result("dup-task")

            assert loaded is not None
            assert loaded.trajectory.query == "Second"


class TestRLMAuditorList:
    """Tests for listing audits."""

    def test_list_audits(self) -> None:
        """Test listing all audits."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            for i in range(5):
                auditor.save_result(create_test_result(task_id=f"task-{i}"))

            entries = auditor.list_audits()

            assert len(entries) == 5

    def test_list_audits_with_limit(self) -> None:
        """Test listing with limit."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            for i in range(5):
                auditor.save_result(create_test_result(task_id=f"task-{i}"))

            entries = auditor.list_audits(limit=3)

            assert len(entries) == 3

    def test_list_audits_newest_first(self) -> None:
        """Test that listing returns newest first."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            auditor.save_result(create_test_result(task_id="first"))
            auditor.save_result(create_test_result(task_id="second"))
            auditor.save_result(create_test_result(task_id="third"))

            entries = auditor.list_audits()

            assert entries[0].task_id == "third"
            assert entries[2].task_id == "first"

    def test_list_audits_success_only(self) -> None:
        """Test filtering to successful audits only."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            auditor.save_result(create_test_result(task_id="success-1", success=True))
            auditor.save_result(create_test_result(task_id="fail-1", success=False))
            auditor.save_result(create_test_result(task_id="success-2", success=True))

            entries = auditor.list_audits(success_only=True)

            assert len(entries) == 2
            assert all(e.success for e in entries)

    def test_get_audit_by_task_id(self) -> None:
        """Test getting audit entry by task ID."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            auditor.save_result(create_test_result(task_id="target-task"))

            entry = auditor.get_audit_by_task_id("target-task")

            assert entry is not None
            assert entry.task_id == "target-task"

    def test_get_nonexistent_audit(self) -> None:
        """Test getting nonexistent audit entry."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            entry = auditor.get_audit_by_task_id("nonexistent")

            assert entry is None


class TestRLMAuditorDelete:
    """Tests for deleting audits."""

    def test_delete_audit(self) -> None:
        """Test deleting an audit."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            auditor.save_result(create_test_result(task_id="to-delete"))
            auditor.save_result(create_test_result(task_id="to-keep"))

            deleted = auditor.delete_audit("to-delete")

            assert deleted is True
            assert len(auditor.list_audits()) == 1
            assert auditor.get_audit_by_task_id("to-delete") is None

    def test_delete_nonexistent(self) -> None:
        """Test deleting nonexistent audit."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            deleted = auditor.delete_audit("nonexistent")

            assert deleted is False

    def test_clear_all(self) -> None:
        """Test clearing all audits."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            for i in range(5):
                auditor.save_result(create_test_result(task_id=f"task-{i}"))

            count = auditor.clear_all()

            assert count == 5
            assert len(auditor.list_audits()) == 0


class TestRLMAuditorStats:
    """Tests for audit statistics."""

    def test_get_stats(self) -> None:
        """Test getting audit statistics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            auditor.save_result(create_test_result(task_id="s1", success=True))
            auditor.save_result(create_test_result(task_id="s2", success=True))
            auditor.save_result(create_test_result(task_id="f1", success=False))

            stats = auditor.get_stats()

            assert stats["total_audits"] == 3
            assert stats["successful"] == 2
            assert stats["failed"] == 1
            assert stats["success_rate"] == pytest.approx(66.67, rel=0.1)

    def test_get_stats_empty(self) -> None:
        """Test getting stats when empty."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)

            stats = auditor.get_stats()

            assert stats["total_audits"] == 0
            assert stats["success_rate"] == 0.0


class TestRLMAuditorPersistence:
    """Tests for persistence across instances."""

    def test_index_persists(self) -> None:
        """Test that index persists across instances."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # First instance
            auditor1 = RLMAuditor(audit_dir=tmpdir)
            auditor1.save_result(create_test_result(task_id="task-1"))
            auditor1.save_result(create_test_result(task_id="task-2"))

            # New instance
            auditor2 = RLMAuditor(audit_dir=tmpdir)

            entries = auditor2.list_audits()
            assert len(entries) == 2

    def test_load_from_previous_instance(self) -> None:
        """Test loading data saved by previous instance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Save with first instance
            auditor1 = RLMAuditor(audit_dir=tmpdir)
            original = create_test_result()
            auditor1.save_result(original)

            # Load with new instance
            auditor2 = RLMAuditor(audit_dir=tmpdir)
            loaded = auditor2.load_result(original.task_id)

            assert loaded is not None
            assert loaded.task_id == original.task_id


class TestRLMAuditorRepr:
    """Tests for string representation."""

    def test_repr(self) -> None:
        """Test string representation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            auditor = RLMAuditor(audit_dir=tmpdir)
            auditor.save_result(create_test_result())

            repr_str = repr(auditor)

            assert "RLMAuditor" in repr_str
            assert "entries=1" in repr_str
