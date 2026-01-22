"""Unit tests for agent protocols.

Tests the AgentResult dataclass and BaseAgent protocol.
"""

from __future__ import annotations

import pytest
from typing import Any, runtime_checkable, Protocol

from src.workers.agents.protocols import AgentResult, BaseAgent, AgentContext


class TestAgentResult:
    """Tests for AgentResult dataclass."""

    def test_success_result(self):
        """AgentResult for successful execution."""
        result = AgentResult(
            success=True,
            agent_type="stub",
            task_id="task-123",
        )

        assert result.success is True
        assert result.agent_type == "stub"
        assert result.task_id == "task-123"
        assert result.error_message is None
        assert result.artifact_paths == []
        assert result.metadata == {}

    def test_failure_result(self):
        """AgentResult for failed execution."""
        result = AgentResult(
            success=False,
            agent_type="coding",
            task_id="task-456",
            error_message="Compilation failed",
            should_retry=True,
        )

        assert result.success is False
        assert result.error_message == "Compilation failed"
        assert result.should_retry is True

    def test_result_with_artifacts(self):
        """AgentResult with artifact paths."""
        result = AgentResult(
            success=True,
            agent_type="coding",
            task_id="task-789",
            artifact_paths=["/artifacts/patch.diff", "/artifacts/report.md"],
            metadata={"lines_changed": 42},
        )

        assert len(result.artifact_paths) == 2
        assert "/artifacts/patch.diff" in result.artifact_paths
        assert result.metadata["lines_changed"] == 42

    def test_result_defaults(self):
        """AgentResult has sensible defaults."""
        result = AgentResult(
            success=True,
            agent_type="test",
            task_id="task-001",
        )

        assert result.should_retry is False
        assert result.error_message is None
        assert result.artifact_paths == []
        assert result.metadata == {}


class TestAgentContext:
    """Tests for AgentContext dataclass."""

    def test_context_creation(self):
        """AgentContext holds execution context."""
        context = AgentContext(
            session_id="session-abc",
            task_id="task-123",
            tenant_id="acme-corp",
            workspace_path="/app/workspace",
        )

        assert context.session_id == "session-abc"
        assert context.task_id == "task-123"
        assert context.tenant_id == "acme-corp"
        assert context.workspace_path == "/app/workspace"
        assert context.context_pack is None

    def test_context_with_context_pack(self):
        """AgentContext with context pack data."""
        context_pack = {"files": ["main.py", "utils.py"]}
        context = AgentContext(
            session_id="session-abc",
            task_id="task-123",
            tenant_id="acme-corp",
            workspace_path="/app/workspace",
            context_pack=context_pack,
        )

        assert context.context_pack == context_pack

    def test_context_optional_metadata(self):
        """AgentContext accepts optional metadata."""
        context = AgentContext(
            session_id="session-abc",
            task_id="task-123",
            tenant_id="default",
            workspace_path="/app/workspace",
            metadata={"git_sha": "abc123"},
        )

        assert context.metadata["git_sha"] == "abc123"


class TestBaseAgentProtocol:
    """Tests for BaseAgent protocol."""

    def test_protocol_is_runtime_checkable(self):
        """BaseAgent protocol can be checked at runtime."""
        # The protocol should be runtime_checkable
        assert hasattr(BaseAgent, "__protocol_attrs__") or isinstance(
            BaseAgent, type
        )

    def test_minimal_agent_implementation(self):
        """A minimal agent can satisfy the BaseAgent protocol."""

        class MinimalAgent:
            """Minimal agent implementation."""

            @property
            def agent_type(self) -> str:
                return "minimal"

            async def execute(
                self, context: AgentContext, event_metadata: dict[str, Any]
            ) -> AgentResult:
                return AgentResult(
                    success=True,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                )

        agent = MinimalAgent()
        assert agent.agent_type == "minimal"
        # Protocol conformance can be verified at runtime
        assert isinstance(agent, BaseAgent)

    def test_agent_with_all_methods(self):
        """Agent with all optional methods."""

        class FullAgent:
            """Agent with all methods."""

            @property
            def agent_type(self) -> str:
                return "full"

            async def execute(
                self, context: AgentContext, event_metadata: dict[str, Any]
            ) -> AgentResult:
                return AgentResult(
                    success=True,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                )

            async def validate_context(self, context: AgentContext) -> bool:
                return context.task_id is not None

            async def cleanup(self, context: AgentContext) -> None:
                pass

        agent = FullAgent()
        assert isinstance(agent, BaseAgent)
