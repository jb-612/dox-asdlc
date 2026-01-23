"""Unit tests for RLM data models."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from src.workers.rlm.models import (
    Citation,
    ExplorationStep,
    ExplorationTrajectory,
    Finding,
    GrepMatch,
    RLMResult,
    RLMUsage,
    ToolCall,
)


class TestToolCall:
    """Tests for ToolCall model."""

    def test_create_tool_call(self) -> None:
        """Test creating a ToolCall instance."""
        now = datetime.now(timezone.utc)
        tc = ToolCall(
            tool_name="read_file",
            arguments={"path": "src/main.py"},
            result="file content here",
            duration_ms=150.5,
            timestamp=now,
        )

        assert tc.tool_name == "read_file"
        assert tc.arguments == {"path": "src/main.py"}
        assert tc.result == "file content here"
        assert tc.duration_ms == 150.5
        assert tc.timestamp == now

    def test_tool_call_to_dict(self) -> None:
        """Test serialization to dictionary."""
        now = datetime.now(timezone.utc)
        tc = ToolCall(
            tool_name="grep",
            arguments={"pattern": "TODO"},
            result="matches found",
            duration_ms=200.0,
            timestamp=now,
        )

        d = tc.to_dict()
        assert d["tool_name"] == "grep"
        assert d["arguments"] == {"pattern": "TODO"}
        assert d["result"] == "matches found"
        assert d["duration_ms"] == 200.0
        assert d["timestamp"] == now.isoformat()

    def test_tool_call_from_dict(self) -> None:
        """Test deserialization from dictionary."""
        now = datetime.now(timezone.utc)
        data = {
            "tool_name": "list_files",
            "arguments": {"directory": "/src"},
            "result": "file1.py\nfile2.py",
            "duration_ms": 50.0,
            "timestamp": now.isoformat(),
        }

        tc = ToolCall.from_dict(data)
        assert tc.tool_name == "list_files"
        assert tc.arguments == {"directory": "/src"}
        assert tc.result == "file1.py\nfile2.py"
        assert tc.duration_ms == 50.0

    def test_tool_call_roundtrip(self) -> None:
        """Test serialization/deserialization roundtrip."""
        now = datetime.now(timezone.utc)
        original = ToolCall(
            tool_name="parse_ast",
            arguments={"file": "test.py"},
            result="AST data",
            duration_ms=300.0,
            timestamp=now,
        )

        restored = ToolCall.from_dict(original.to_dict())
        assert restored.tool_name == original.tool_name
        assert restored.arguments == original.arguments
        assert restored.result == original.result
        assert restored.duration_ms == original.duration_ms


class TestGrepMatch:
    """Tests for GrepMatch model."""

    def test_create_grep_match(self) -> None:
        """Test creating a GrepMatch instance."""
        gm = GrepMatch(
            file_path="src/main.py",
            line_number=42,
            line_content="def main():",
            context_before=["# Entry point"],
            context_after=["    pass"],
        )

        assert gm.file_path == "src/main.py"
        assert gm.line_number == 42
        assert gm.line_content == "def main():"
        assert gm.context_before == ["# Entry point"]
        assert gm.context_after == ["    pass"]

    def test_grep_match_default_context(self) -> None:
        """Test default empty context lists."""
        gm = GrepMatch(
            file_path="test.py",
            line_number=1,
            line_content="import os",
        )

        assert gm.context_before == []
        assert gm.context_after == []

    def test_grep_match_roundtrip(self) -> None:
        """Test serialization roundtrip."""
        original = GrepMatch(
            file_path="config.py",
            line_number=10,
            line_content="DEBUG = True",
            context_before=["# Settings", ""],
            context_after=["", "# Database"],
        )

        restored = GrepMatch.from_dict(original.to_dict())
        assert restored.file_path == original.file_path
        assert restored.line_number == original.line_number
        assert restored.line_content == original.line_content
        assert restored.context_before == original.context_before
        assert restored.context_after == original.context_after


class TestCitation:
    """Tests for Citation model."""

    def test_create_citation(self) -> None:
        """Test creating a Citation instance."""
        c = Citation(
            file_path="src/core.py",
            line_start=10,
            line_end=20,
            content_hash="abc123",
            snippet="def process():",
        )

        assert c.file_path == "src/core.py"
        assert c.line_start == 10
        assert c.line_end == 20
        assert c.content_hash == "abc123"
        assert c.snippet == "def process():"

    def test_citation_from_content(self) -> None:
        """Test creating Citation from content."""
        content = "def hello():\n    print('Hello')"
        c = Citation.from_content(
            file_path="hello.py",
            line_start=1,
            line_end=2,
            content=content,
        )

        assert c.file_path == "hello.py"
        assert c.line_start == 1
        assert c.line_end == 2
        assert len(c.content_hash) == 64  # SHA-256 hex length
        assert c.snippet == content

    def test_citation_from_content_long_truncates(self) -> None:
        """Test that long content is truncated in snippet."""
        content = "x" * 300
        c = Citation.from_content(
            file_path="long.txt",
            line_start=1,
            line_end=10,
            content=content,
        )

        assert len(c.snippet) == 203  # 200 + "..."
        assert c.snippet.endswith("...")

    def test_citation_roundtrip(self) -> None:
        """Test serialization roundtrip."""
        original = Citation(
            file_path="test.py",
            line_start=5,
            line_end=15,
            content_hash="def456",
            snippet="code here",
        )

        restored = Citation.from_dict(original.to_dict())
        assert restored.file_path == original.file_path
        assert restored.line_start == original.line_start
        assert restored.line_end == original.line_end
        assert restored.content_hash == original.content_hash
        assert restored.snippet == original.snippet


class TestFinding:
    """Tests for Finding model."""

    def test_create_finding(self) -> None:
        """Test creating a Finding instance."""
        f = Finding(
            description="Found deprecated API usage",
            evidence="api.old_method() at line 42",
            source_file="src/api.py",
            line_range=(40, 45),
            confidence=0.85,
            tags=["deprecation", "api"],
        )

        assert f.description == "Found deprecated API usage"
        assert f.evidence == "api.old_method() at line 42"
        assert f.source_file == "src/api.py"
        assert f.line_range == (40, 45)
        assert f.confidence == 0.85
        assert f.tags == ["deprecation", "api"]

    def test_finding_default_values(self) -> None:
        """Test default values."""
        f = Finding(
            description="Simple finding",
            evidence="some code",
            source_file="file.py",
        )

        assert f.line_range is None
        assert f.confidence == 1.0
        assert f.tags == []

    def test_finding_invalid_confidence_low(self) -> None:
        """Test validation rejects confidence < 0."""
        with pytest.raises(ValueError, match="Confidence must be"):
            Finding(
                description="test",
                evidence="test",
                source_file="test.py",
                confidence=-0.1,
            )

    def test_finding_invalid_confidence_high(self) -> None:
        """Test validation rejects confidence > 1."""
        with pytest.raises(ValueError, match="Confidence must be"):
            Finding(
                description="test",
                evidence="test",
                source_file="test.py",
                confidence=1.1,
            )

    def test_finding_roundtrip(self) -> None:
        """Test serialization roundtrip."""
        original = Finding(
            description="Test finding",
            evidence="evidence here",
            source_file="code.py",
            line_range=(1, 10),
            confidence=0.75,
            tags=["test"],
        )

        restored = Finding.from_dict(original.to_dict())
        assert restored.description == original.description
        assert restored.evidence == original.evidence
        assert restored.source_file == original.source_file
        assert restored.line_range == original.line_range
        assert restored.confidence == original.confidence
        assert restored.tags == original.tags


class TestExplorationStep:
    """Tests for ExplorationStep model."""

    def test_create_exploration_step(self) -> None:
        """Test creating an ExplorationStep instance."""
        now = datetime.now(timezone.utc)
        tc = ToolCall(
            tool_name="read_file",
            arguments={"path": "main.py"},
            result="content",
            duration_ms=100.0,
            timestamp=now,
        )

        step = ExplorationStep(
            iteration=0,
            thought="Looking at the main file first",
            tool_calls=[tc],
            findings_so_far=["Found entry point"],
            next_direction="Explore imports",
            subcalls_used=1,
        )

        assert step.iteration == 0
        assert step.thought == "Looking at the main file first"
        assert len(step.tool_calls) == 1
        assert step.tool_calls[0].tool_name == "read_file"
        assert step.findings_so_far == ["Found entry point"]
        assert step.next_direction == "Explore imports"
        assert step.subcalls_used == 1

    def test_exploration_step_roundtrip(self) -> None:
        """Test serialization roundtrip."""
        now = datetime.now(timezone.utc)
        original = ExplorationStep(
            iteration=2,
            thought="Deep dive",
            tool_calls=[
                ToolCall("grep", {"pattern": "error"}, "no matches", 50.0, now)
            ],
            findings_so_far=["item1", "item2"],
            next_direction="Check tests",
            subcalls_used=3,
        )

        restored = ExplorationStep.from_dict(original.to_dict())
        assert restored.iteration == original.iteration
        assert restored.thought == original.thought
        assert len(restored.tool_calls) == len(original.tool_calls)
        assert restored.findings_so_far == original.findings_so_far
        assert restored.next_direction == original.next_direction
        assert restored.subcalls_used == original.subcalls_used


class TestExplorationTrajectory:
    """Tests for ExplorationTrajectory model."""

    def test_create_trajectory(self) -> None:
        """Test creating an ExplorationTrajectory."""
        start = datetime(2026, 1, 23, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 1, 23, 10, 5, 0, tzinfo=timezone.utc)

        traj = ExplorationTrajectory(
            steps=[],
            start_time=start,
            end_time=end,
            total_subcalls=25,
            cached_hits=5,
            query="Find all error handlers",
            context_hints=["src/errors.py"],
        )

        assert traj.start_time == start
        assert traj.end_time == end
        assert traj.total_subcalls == 25
        assert traj.cached_hits == 5
        assert traj.query == "Find all error handlers"
        assert traj.context_hints == ["src/errors.py"]

    def test_trajectory_duration_seconds(self) -> None:
        """Test duration_seconds property."""
        start = datetime(2026, 1, 23, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 1, 23, 10, 2, 30, tzinfo=timezone.utc)

        traj = ExplorationTrajectory(
            steps=[],
            start_time=start,
            end_time=end,
            total_subcalls=10,
            cached_hits=2,
            query="test",
        )

        assert traj.duration_seconds == 150.0  # 2.5 minutes

    def test_trajectory_duration_none_when_incomplete(self) -> None:
        """Test duration is None when end_time is None."""
        start = datetime(2026, 1, 23, 10, 0, 0, tzinfo=timezone.utc)

        traj = ExplorationTrajectory(
            steps=[],
            start_time=start,
            end_time=None,
            total_subcalls=5,
            cached_hits=1,
            query="test",
        )

        assert traj.duration_seconds is None

    def test_trajectory_iteration_count(self) -> None:
        """Test iteration_count property."""
        now = datetime.now(timezone.utc)
        steps = [
            ExplorationStep(0, "thought1", [], [], "", 1),
            ExplorationStep(1, "thought2", [], [], "", 2),
            ExplorationStep(2, "thought3", [], [], "", 1),
        ]

        traj = ExplorationTrajectory(
            steps=steps,
            start_time=now,
            end_time=now,
            total_subcalls=4,
            cached_hits=0,
            query="test",
        )

        assert traj.iteration_count == 3

    def test_trajectory_json_roundtrip(self) -> None:
        """Test JSON serialization roundtrip."""
        start = datetime(2026, 1, 23, 10, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 1, 23, 10, 5, 0, tzinfo=timezone.utc)

        original = ExplorationTrajectory(
            steps=[
                ExplorationStep(0, "initial", [], ["finding1"], "next", 2)
            ],
            start_time=start,
            end_time=end,
            total_subcalls=10,
            cached_hits=3,
            query="Find handlers",
            context_hints=["hint.py"],
        )

        json_str = original.to_json()
        restored = ExplorationTrajectory.from_json(json_str)

        assert restored.total_subcalls == original.total_subcalls
        assert restored.cached_hits == original.cached_hits
        assert restored.query == original.query
        assert len(restored.steps) == len(original.steps)


class TestRLMUsage:
    """Tests for RLMUsage model."""

    def test_create_usage(self) -> None:
        """Test creating an RLMUsage instance."""
        usage = RLMUsage(
            subcall_count=30,
            cached_subcalls=10,
            total_tokens=45000,
            wall_time_seconds=120.5,
            model_calls=25,
            budget_limit=50,
            budget_remaining=20,
        )

        assert usage.subcall_count == 30
        assert usage.cached_subcalls == 10
        assert usage.total_tokens == 45000
        assert usage.wall_time_seconds == 120.5
        assert usage.model_calls == 25
        assert usage.budget_limit == 50
        assert usage.budget_remaining == 20

    def test_cache_hit_rate(self) -> None:
        """Test cache_hit_rate property."""
        usage = RLMUsage(
            subcall_count=100,
            cached_subcalls=25,
            total_tokens=10000,
            wall_time_seconds=60.0,
            model_calls=75,
        )

        assert usage.cache_hit_rate == 25.0

    def test_cache_hit_rate_zero_calls(self) -> None:
        """Test cache_hit_rate with zero calls."""
        usage = RLMUsage(
            subcall_count=0,
            cached_subcalls=0,
            total_tokens=0,
            wall_time_seconds=0.0,
            model_calls=0,
        )

        assert usage.cache_hit_rate == 0.0

    def test_budget_used_percentage(self) -> None:
        """Test budget_used_percentage property."""
        usage = RLMUsage(
            subcall_count=30,
            cached_subcalls=5,
            total_tokens=20000,
            wall_time_seconds=90.0,
            model_calls=25,
            budget_limit=50,
            budget_remaining=20,
        )

        assert usage.budget_used_percentage == 60.0  # (50-20)/50 * 100

    def test_usage_roundtrip(self) -> None:
        """Test serialization roundtrip."""
        original = RLMUsage(
            subcall_count=40,
            cached_subcalls=12,
            total_tokens=50000,
            wall_time_seconds=200.0,
            model_calls=28,
            budget_limit=50,
            budget_remaining=10,
        )

        restored = RLMUsage.from_dict(original.to_dict())
        assert restored.subcall_count == original.subcall_count
        assert restored.cached_subcalls == original.cached_subcalls
        assert restored.total_tokens == original.total_tokens
        assert restored.wall_time_seconds == original.wall_time_seconds
        assert restored.model_calls == original.model_calls
        assert restored.budget_limit == original.budget_limit
        assert restored.budget_remaining == original.budget_remaining


class TestRLMResult:
    """Tests for RLMResult model."""

    def _make_trajectory(self) -> ExplorationTrajectory:
        """Create a sample trajectory for tests."""
        now = datetime.now(timezone.utc)
        return ExplorationTrajectory(
            steps=[],
            start_time=now,
            end_time=now,
            total_subcalls=10,
            cached_hits=2,
            query="test query",
        )

    def _make_usage(self) -> RLMUsage:
        """Create a sample usage for tests."""
        return RLMUsage(
            subcall_count=10,
            cached_subcalls=2,
            total_tokens=5000,
            wall_time_seconds=30.0,
            model_calls=8,
        )

    def test_create_result_success(self) -> None:
        """Test creating a successful RLMResult."""
        result = RLMResult(
            task_id="task-123",
            success=True,
            findings=[
                Finding(
                    description="Found issue",
                    evidence="code here",
                    source_file="file.py",
                )
            ],
            synthesis="Summary of findings",
            trajectory=self._make_trajectory(),
            usage=self._make_usage(),
            citations=[
                Citation(
                    file_path="file.py",
                    line_start=1,
                    line_end=10,
                    content_hash="abc",
                )
            ],
        )

        assert result.task_id == "task-123"
        assert result.success is True
        assert len(result.findings) == 1
        assert result.synthesis == "Summary of findings"
        assert result.error is None

    def test_create_result_failure(self) -> None:
        """Test creating a failure RLMResult using factory method."""
        result = RLMResult.failure(
            task_id="task-456",
            error="Budget exceeded",
            trajectory=self._make_trajectory(),
            usage=self._make_usage(),
        )

        assert result.task_id == "task-456"
        assert result.success is False
        assert result.findings == []
        assert result.synthesis == ""
        assert result.citations == []
        assert result.error == "Budget exceeded"

    def test_result_json_roundtrip(self) -> None:
        """Test JSON serialization roundtrip."""
        original = RLMResult(
            task_id="task-789",
            success=True,
            findings=[
                Finding(
                    description="Finding 1",
                    evidence="Evidence 1",
                    source_file="a.py",
                    confidence=0.9,
                )
            ],
            synthesis="Final synthesis",
            trajectory=self._make_trajectory(),
            usage=self._make_usage(),
            citations=[
                Citation.from_content("a.py", 1, 5, "some content")
            ],
        )

        json_str = original.to_json()
        restored = RLMResult.from_json(json_str)

        assert restored.task_id == original.task_id
        assert restored.success == original.success
        assert len(restored.findings) == len(original.findings)
        assert restored.synthesis == original.synthesis
        assert restored.error == original.error

    def test_result_to_dict_includes_all_fields(self) -> None:
        """Test that to_dict includes all expected fields."""
        result = RLMResult(
            task_id="task-abc",
            success=True,
            findings=[],
            synthesis="summary",
            trajectory=self._make_trajectory(),
            usage=self._make_usage(),
            citations=[],
            error=None,
        )

        d = result.to_dict()
        expected_keys = {
            "task_id",
            "success",
            "findings",
            "synthesis",
            "trajectory",
            "usage",
            "citations",
            "error",
        }
        assert set(d.keys()) == expected_keys
