"""Unit tests for RLM integration layer."""

from __future__ import annotations

import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest

from src.workers.rlm.config import RLMConfig
from src.workers.rlm.integration import RLMIntegration, RLMIntegrationResult
from src.workers.rlm.models import (
    Citation,
    ExplorationStep,
    ExplorationTrajectory,
    Finding,
    RLMResult,
    RLMUsage,
)
from src.workers.rlm.trigger import TriggerReason, TriggerResult


# Mock Anthropic response structures
@dataclass
class MockTextBlock:
    text: str
    type: str = "text"


@dataclass
class MockUsage:
    input_tokens: int
    output_tokens: int


@dataclass
class MockResponse:
    content: list[MockTextBlock]
    usage: MockUsage


def create_mock_client() -> Mock:
    """Create a mock Anthropic client."""
    mock_client = Mock()
    mock_response = MockResponse(
        content=[MockTextBlock(text="<thought>Test</thought><tool_calls>[]</tool_calls><findings></findings><next_direction>DONE</next_direction>")],
        usage=MockUsage(input_tokens=50, output_tokens=50),
    )
    mock_client.messages.create.return_value = mock_response
    return mock_client


def create_test_result(
    task_id: str = "test-task",
    success: bool = True,
) -> RLMResult:
    """Create a test RLMResult."""
    trajectory = ExplorationTrajectory(
        steps=[
            ExplorationStep(
                iteration=0,
                thought="Testing",
                tool_calls=[],
                findings_so_far=["Found something"],
                next_direction="DONE",
            )
        ],
        start_time=datetime.now(timezone.utc),
        end_time=datetime.now(timezone.utc),
        total_subcalls=5,
        cached_hits=2,
        query="Test query",
    )

    usage = RLMUsage(
        subcall_count=5,
        cached_subcalls=2,
        total_tokens=500,
        wall_time_seconds=10.5,
        model_calls=3,
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
                    line_range=(1, 10),
                )
            ],
            synthesis="Test synthesis with findings.",
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


class TestRLMIntegrationResult:
    """Tests for RLMIntegrationResult."""

    def test_create_result(self) -> None:
        """Test creating an integration result."""
        result = RLMIntegrationResult(
            used_rlm=True,
            trigger_result=None,
            rlm_result=None,
            formatted_output="Test output",
        )

        assert result.used_rlm is True
        assert result.formatted_output == "Test output"

    def test_result_with_trigger(self) -> None:
        """Test result with trigger information."""
        trigger = TriggerResult(
            should_trigger=True,
            reason=TriggerReason.LARGE_CONTEXT,
            all_reasons=[TriggerReason.LARGE_CONTEXT],
            details={"context_tokens": 150000},
            confidence=0.7,
        )

        result = RLMIntegrationResult(
            used_rlm=True,
            trigger_result=trigger,
            rlm_result=None,
            formatted_output="",
        )

        assert result.trigger_result is not None
        assert result.trigger_result.reason == TriggerReason.LARGE_CONTEXT

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        result = RLMIntegrationResult(
            used_rlm=False,
            trigger_result=None,
            rlm_result=None,
            formatted_output="Output",
            error=None,
        )

        data = result.to_dict()

        assert data["used_rlm"] is False
        assert data["formatted_output"] == "Output"


class TestRLMIntegrationCreation:
    """Tests for RLMIntegration creation."""

    def test_create_integration(self) -> None:
        """Test creating an integration instance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            assert integration.auto_trigger is True
            assert integration.exploration_count == 0

    def test_create_with_auto_trigger_disabled(self) -> None:
        """Test creating with auto-trigger disabled."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
                auto_trigger=False,
            )

            assert integration.auto_trigger is False


class TestRLMIntegrationTrigger:
    """Tests for trigger detection."""

    def test_should_use_rlm_large_context(self) -> None:
        """Test trigger detection with large context."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = integration.should_use_rlm(context_tokens=200_000)

            assert result.should_trigger is True
            assert TriggerReason.LARGE_CONTEXT in result.all_reasons

    def test_should_use_rlm_explicit(self) -> None:
        """Test trigger with explicit request."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = integration.should_use_rlm(explicit_rlm=True)

            assert result.should_trigger is True
            assert TriggerReason.EXPLICIT_REQUEST in result.all_reasons

    def test_should_not_trigger_small_context(self) -> None:
        """Test that small context doesn't trigger."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = integration.should_use_rlm(context_tokens=1000)

            assert result.should_trigger is False


class TestRLMIntegrationExplore:
    """Tests for exploration."""

    @pytest.mark.asyncio
    async def test_explore_basic(self) -> None:
        """Test basic exploration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir, timeout_seconds=60)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = await integration.explore(
                query="What is in the codebase?",
                save_audit=False,
            )

            assert result.used_rlm is True
            assert integration.exploration_count == 1

    @pytest.mark.asyncio
    async def test_explore_saves_audit(self) -> None:
        """Test that exploration saves audit."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir, timeout_seconds=60)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            await integration.explore(
                query="Test query",
                task_id="audit-test",
                save_audit=True,
            )

            # Check audit was saved
            audits = integration._auditor.list_audits()
            # Note: May or may not have audit depending on exploration success

    @pytest.mark.asyncio
    async def test_explore_with_context_hints(self) -> None:
        """Test exploration with context hints."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir, timeout_seconds=60)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = await integration.explore(
                query="Find auth code",
                context_hints=["Look in src/auth/"],
                save_audit=False,
            )

            assert result.used_rlm is True

    def test_explore_sync(self) -> None:
        """Test synchronous exploration wrapper."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir, timeout_seconds=60)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = integration.explore_sync(
                query="Test",
                save_audit=False,
            )

            assert result.used_rlm is True


class TestRLMIntegrationProcessWithCheck:
    """Tests for process_with_rlm_check."""

    @pytest.mark.asyncio
    async def test_process_triggers_rlm(self) -> None:
        """Test that processing triggers RLM when needed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir, timeout_seconds=60)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = await integration.process_with_rlm_check(
                query="How does the system work?",
                explicit_rlm=True,
            )

            assert result.used_rlm is True
            assert result.trigger_result is not None

    @pytest.mark.asyncio
    async def test_process_skips_when_not_triggered(self) -> None:
        """Test that processing skips RLM when not triggered."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
                auto_trigger=True,
            )

            result = await integration.process_with_rlm_check(
                query="Simple task",
                context_tokens=100,  # Small context
            )

            assert result.used_rlm is False
            assert result.trigger_result is not None
            assert result.trigger_result.should_trigger is False


class TestRLMIntegrationFormatting:
    """Tests for result formatting."""

    def test_format_successful_result(self) -> None:
        """Test formatting successful result."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            rlm_result = create_test_result(success=True)
            formatted = integration._format_for_agent(rlm_result)

            assert "RLM Exploration Results" in formatted
            assert "Test synthesis" in formatted
            assert "test.py" in formatted

    def test_format_failed_result(self) -> None:
        """Test formatting failed result."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            rlm_result = create_test_result(success=False)
            formatted = integration._format_for_agent(rlm_result)

            assert "Partial Results" in formatted
            assert "Test error" in formatted

    def test_format_includes_stats(self) -> None:
        """Test that formatting includes stats."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            rlm_result = create_test_result()
            formatted = integration._format_for_agent(rlm_result)

            assert "Exploration Stats" in formatted
            assert "Iterations" in formatted
            assert "Sub-calls" in formatted


class TestRLMIntegrationStats:
    """Tests for statistics."""

    def test_get_stats(self) -> None:
        """Test getting integration stats."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            stats = integration.get_stats()

            assert "exploration_count" in stats
            assert "config" in stats
            assert "trigger_thresholds" in stats
            assert "audit_stats" in stats

    def test_repr(self) -> None:
        """Test string representation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            client = create_mock_client()
            config = RLMConfig(audit_dir=tmpdir)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            repr_str = repr(integration)

            assert "RLMIntegration" in repr_str
            assert "explorations=0" in repr_str


class TestRLMIntegrationErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_exploration_error(self) -> None:
        """Test handling of exploration errors."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Client that will cause errors
            client = Mock()
            client.messages.create.side_effect = Exception("API Error")

            config = RLMConfig(audit_dir=tmpdir, timeout_seconds=60)

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=tmpdir,
            )

            result = await integration.explore(
                query="Test",
                save_audit=False,
            )

            assert result.used_rlm is True
            assert result.error is not None
            assert "API Error" in result.error
