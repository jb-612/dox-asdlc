"""Unit tests for DiscoveryCoordinator."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.discovery.config import DiscoveryConfig
from src.workers.agents.discovery.coordinator import (
    DiscoveryCoordinator,
    ProjectContext,
    run_discovery_workflow,
)
from src.workers.agents.discovery.models import (
    AcceptanceCriteria,
    AcceptanceCriterion,
    PRDDocument,
    PRDSection,
    Requirement,
)


@pytest.fixture
def mock_backend():
    """Create a mock agent backend."""
    from src.workers.agents.backends.base import BackendResult

    backend = AsyncMock()
    backend.backend_name = "mock"
    backend.execute = AsyncMock(return_value=BackendResult(
        success=True,
        output="{}",
        structured_output={},
    ))
    backend.health_check = AsyncMock(return_value=True)
    return backend


@pytest.fixture
def mock_artifact_writer(tmp_path):
    """Create a mock artifact writer."""
    writer = MagicMock()
    writer.workspace_path = str(tmp_path)

    async def write_artifact(**kwargs):
        path = tmp_path / kwargs.get("filename", "artifact.json")
        content = kwargs.get("content", "{}")
        if isinstance(content, dict):
            content = json.dumps(content)
        path.write_text(content)
        return str(path)

    writer.write_artifact = AsyncMock(side_effect=write_artifact)
    return writer


@pytest.fixture
def mock_hitl_dispatcher():
    """Create a mock HITL dispatcher."""
    dispatcher = MagicMock()
    dispatcher.request_gate = AsyncMock()
    return dispatcher


@pytest.fixture
def agent_context():
    """Create a test agent context."""
    return AgentContext(
        session_id="test-session",
        task_id="test-task",
        tenant_id="default",
        workspace_path="/tmp/workspace",
    )


@pytest.fixture
def project_context():
    """Create a test project context."""
    return ProjectContext(
        name="Test Project",
        description="A test project",
        git_sha="abc123",
    )


@pytest.fixture
def config():
    """Create test configuration."""
    return DiscoveryConfig(max_retries=1, retry_delay_seconds=0)


@pytest.fixture
def sample_prd():
    """Create a sample PRD document."""
    return PRDDocument.create(
        title="Test PRD",
        executive_summary="Test summary",
        objectives=PRDSection(title="Objectives", content="Test objectives"),
        scope=PRDSection(title="Scope", content="Test scope"),
        sections=[
            PRDSection(
                title="Functional Requirements",
                content="Test",
                requirements=[
                    Requirement(id="REQ-001", description="Test requirement"),
                ],
            )
        ],
    )


@pytest.fixture
def sample_acceptance():
    """Create sample acceptance criteria."""
    return AcceptanceCriteria.create(
        prd_version="1.0.0",
        criteria=[
            AcceptanceCriterion(
                id="AC-001",
                requirement_ids=["REQ-001"],
                given="state",
                when="action",
                then="result",
            ),
        ],
        requirement_ids=["REQ-001"],
    )


class TestDiscoveryCoordinator:
    """Tests for DiscoveryCoordinator."""

    def test_coordinator_initializes_agents(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that coordinator initializes PRD and Acceptance agents."""
        coordinator = DiscoveryCoordinator(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert coordinator.prd_agent is not None
        assert coordinator.acceptance_agent is not None
        assert coordinator.prd_agent.agent_type == "prd_agent"
        assert coordinator.acceptance_agent.agent_type == "acceptance_agent"

    @pytest.mark.asyncio
    async def test_run_discovery_calls_agents_in_sequence(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        project_context,
        config,
        sample_prd,
        sample_acceptance,
        tmp_path,
    ) -> None:
        """Test that run_discovery calls PRD agent then Acceptance agent."""
        # Write PRD artifact
        prd_path = tmp_path / "prd.json"
        prd_path.write_text(sample_prd.to_json())

        # Write acceptance artifact
        acceptance_path = tmp_path / "acceptance.json"
        acceptance_path.write_text(sample_acceptance.to_json())

        coordinator = DiscoveryCoordinator(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        # Mock agents
        coordinator._prd_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="prd_agent",
                task_id="test-task",
                artifact_paths=[str(prd_path)],
            )
        )

        coordinator._acceptance_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="acceptance_agent",
                task_id="test-task",
                artifact_paths=[str(acceptance_path)],
            )
        )

        result = await coordinator.run_discovery(
            user_input="Build a test system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        assert result.success is True
        assert coordinator._prd_agent.execute.called
        assert coordinator._acceptance_agent.execute.called

    @pytest.mark.asyncio
    async def test_run_discovery_fails_when_prd_agent_fails(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        project_context,
        config,
    ) -> None:
        """Test that run_discovery fails when PRD agent fails."""
        coordinator = DiscoveryCoordinator(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        # Mock PRD agent failure
        coordinator._prd_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=False,
                agent_type="prd_agent",
                task_id="test-task",
                error_message="PRD generation failed",
            )
        )

        # Also mock acceptance agent to check if it was called
        coordinator._acceptance_agent.execute = AsyncMock()

        result = await coordinator.run_discovery(
            user_input="Build a test system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        assert result.success is False
        assert "PRD generation failed" in result.error_message
        # Acceptance agent should not be called
        assert not coordinator._acceptance_agent.execute.called

    @pytest.mark.asyncio
    async def test_run_discovery_fails_when_acceptance_agent_fails(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        project_context,
        config,
        sample_prd,
        tmp_path,
    ) -> None:
        """Test that run_discovery fails when Acceptance agent fails."""
        # Write PRD artifact
        prd_path = tmp_path / "prd.json"
        prd_path.write_text(sample_prd.to_json())

        coordinator = DiscoveryCoordinator(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        coordinator._prd_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="prd_agent",
                task_id="test-task",
                artifact_paths=[str(prd_path)],
            )
        )

        coordinator._acceptance_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=False,
                agent_type="acceptance_agent",
                task_id="test-task",
                error_message="Criteria generation failed",
            )
        )

        result = await coordinator.run_discovery(
            user_input="Build a test system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        assert result.success is False
        assert "Acceptance criteria generation failed" in result.error_message

    @pytest.mark.asyncio
    async def test_run_discovery_submits_to_hitl_when_enabled(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_hitl_dispatcher,
        agent_context,
        project_context,
        config,
        sample_prd,
        sample_acceptance,
        tmp_path,
    ) -> None:
        """Test that run_discovery submits to HITL gate when enabled."""
        # Write artifacts
        prd_path = tmp_path / "prd.json"
        prd_path.write_text(sample_prd.to_json())

        acceptance_path = tmp_path / "acceptance.json"
        acceptance_path.write_text(sample_acceptance.to_json())

        # Mock gate request response
        mock_gate_request = MagicMock()
        mock_gate_request.request_id = "gate-123"
        mock_hitl_dispatcher.request_gate.return_value = mock_gate_request

        coordinator = DiscoveryCoordinator(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            hitl_dispatcher=mock_hitl_dispatcher,
            config=config,
        )

        coordinator._prd_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="prd_agent",
                task_id="test-task",
                artifact_paths=[str(prd_path)],
            )
        )

        coordinator._acceptance_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="acceptance_agent",
                task_id="test-task",
                artifact_paths=[str(acceptance_path)],
            )
        )

        result = await coordinator.run_discovery(
            user_input="Build a test system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=True,
        )

        assert result.success is True
        assert result.gate_request_id == "gate-123"
        assert mock_hitl_dispatcher.request_gate.called

    @pytest.mark.asyncio
    async def test_run_discovery_skips_hitl_when_disabled(
        self,
        mock_backend,
        mock_artifact_writer,
        mock_hitl_dispatcher,
        agent_context,
        project_context,
        config,
        sample_prd,
        sample_acceptance,
        tmp_path,
    ) -> None:
        """Test that run_discovery skips HITL submission when disabled."""
        # Write artifacts
        prd_path = tmp_path / "prd.json"
        prd_path.write_text(sample_prd.to_json())

        acceptance_path = tmp_path / "acceptance.json"
        acceptance_path.write_text(sample_acceptance.to_json())

        coordinator = DiscoveryCoordinator(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            hitl_dispatcher=mock_hitl_dispatcher,
            config=config,
        )

        coordinator._prd_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="prd_agent",
                task_id="test-task",
                artifact_paths=[str(prd_path)],
            )
        )

        coordinator._acceptance_agent.execute = AsyncMock(
            return_value=AgentResult(
                success=True,
                agent_type="acceptance_agent",
                task_id="test-task",
                artifact_paths=[str(acceptance_path)],
            )
        )

        result = await coordinator.run_discovery(
            user_input="Build a test system",
            project_context=project_context,
            context=agent_context,
            submit_to_hitl=False,
        )

        assert result.success is True
        assert result.gate_request_id is None
        assert not mock_hitl_dispatcher.request_gate.called


class TestProjectContext:
    """Tests for ProjectContext."""

    def test_project_context_creation(self) -> None:
        """Test that ProjectContext can be created."""
        ctx = ProjectContext(
            name="Test Project",
            description="A test",
            existing_docs_path="/docs",
            git_sha="abc123",
        )

        assert ctx.name == "Test Project"
        assert ctx.description == "A test"
        assert ctx.git_sha == "abc123"

    def test_project_context_defaults(self) -> None:
        """Test that ProjectContext has sensible defaults."""
        ctx = ProjectContext(name="Test")

        assert ctx.name == "Test"
        assert ctx.description == ""
        assert ctx.git_sha == ""


class TestRunDiscoveryWorkflow:
    """Tests for run_discovery_workflow convenience function."""

    @pytest.mark.asyncio
    async def test_run_discovery_workflow_creates_coordinator(
        self,
        mock_backend,
        mock_artifact_writer,
        sample_prd,
        sample_acceptance,
        tmp_path,
    ) -> None:
        """Test that run_discovery_workflow creates and uses coordinator."""
        # Write artifacts
        prd_path = tmp_path / "prd.json"
        prd_path.write_text(sample_prd.to_json())

        acceptance_path = tmp_path / "acceptance.json"
        acceptance_path.write_text(sample_acceptance.to_json())

        with patch.object(
            DiscoveryCoordinator,
            "run_discovery",
            new_callable=AsyncMock,
        ) as mock_run:
            from src.workers.agents.discovery.models import DiscoveryResult

            mock_run.return_value = DiscoveryResult.succeeded(
                prd=sample_prd,
                acceptance_criteria=sample_acceptance,
            )

            result = await run_discovery_workflow(
                user_input="Build something",
                project_name="Test",
                session_id="session-1",
                task_id="task-1",
                workspace_path="/tmp",
                backend=mock_backend,
                artifact_writer=mock_artifact_writer,
                submit_to_hitl=False,
            )

            assert result.success is True
            assert mock_run.called
