"""Unit tests for Design Coordinator."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Architecture,
    ArchitectureStyle,
    Component,
    DataFlow,
    DiagramReference,
    DiagramType,
    ImplementationPlan,
    ImplementationTask,
    ComplexityLevel,
    Phase,
    TechSurvey,
    TechnologyChoice,
    Risk,
    RiskLevel,
)
from src.workers.agents.design.coordinator import (
    DesignCoordinator,
    DesignCoordinatorError,
    EvidenceBundle,
)


@pytest.fixture
def mock_llm_client() -> MagicMock:
    """Create mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    return client


@pytest.fixture
def mock_artifact_writer() -> MagicMock:
    """Create mock artifact writer."""
    writer = MagicMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/test.json")
    return writer


@pytest.fixture
def mock_hitl_dispatcher() -> MagicMock:
    """Create mock HITL dispatcher."""
    dispatcher = MagicMock()
    dispatcher.submit = AsyncMock(return_value="hitl-request-123")
    return dispatcher


@pytest.fixture
def default_config() -> DesignConfig:
    """Create default config for testing."""
    return DesignConfig(
        max_retries=1,
        retry_delay_seconds=0.01,
    )


@pytest.fixture
def agent_context() -> AgentContext:
    """Create test agent context."""
    return AgentContext(
        session_id="test-session-123",
        task_id="task-456",
        tenant_id="test-tenant",
        workspace_path="/test/workspace",
    )


@pytest.fixture
def sample_tech_survey() -> TechSurvey:
    """Create sample tech survey."""
    return TechSurvey.create(
        prd_reference="PRD-001",
        technologies=[
            TechnologyChoice(
                category="language",
                selected="Python 3.11+",
                alternatives=["Go", "Node.js"],
                rationale="Team expertise",
            ),
            TechnologyChoice(
                category="database",
                selected="PostgreSQL",
                alternatives=["MySQL"],
                rationale="Required by infra",
            ),
        ],
        risk_assessment=[
            Risk(
                id="RISK-001",
                description="GIL limitations",
                level=RiskLevel.MEDIUM,
                mitigation="Use multiprocessing",
            )
        ],
        recommendations=["Use FastAPI"],
    )


@pytest.fixture
def sample_architecture() -> Architecture:
    """Create sample architecture."""
    return Architecture.create(
        style=ArchitectureStyle.MODULAR_MONOLITH,
        components=[
            Component(
                name="APIGateway",
                responsibility="Handle HTTP requests",
                technology="FastAPI",
            ),
            Component(
                name="UserService",
                responsibility="Manage users",
                technology="Python",
            ),
        ],
        data_flows=[
            DataFlow(
                source="APIGateway",
                target="UserService",
                data_type="UserRequest",
                protocol="direct",
            )
        ],
        deployment_model="Container-based",
        diagrams=[
            DiagramReference(
                diagram_type=DiagramType.COMPONENT,
                title="System Overview",
                mermaid_code="graph TB\n    A-->B",
            )
        ],
        tech_survey_reference="TECH-001",
        security_considerations=["Use HTTPS", "Implement JWT"],
    )


@pytest.fixture
def sample_implementation_plan() -> ImplementationPlan:
    """Create sample implementation plan."""
    return ImplementationPlan.create(
        architecture_reference="ARCH-001",
        phases=[
            Phase(name="Phase 1: Setup", task_ids=["T001"], order=1),
            Phase(name="Phase 2: Core", task_ids=["T002", "T003"], order=2),
        ],
        tasks=[
            ImplementationTask(
                id="T001",
                title="Setup infrastructure",
                description="Initial setup",
                component="Infrastructure",
                estimated_complexity=ComplexityLevel.MEDIUM,
            ),
            ImplementationTask(
                id="T002",
                title="Implement User model",
                description="Create User entity",
                component="UserService",
                dependencies=["T001"],
                estimated_complexity=ComplexityLevel.MEDIUM,
            ),
            ImplementationTask(
                id="T003",
                title="Implement User API",
                description="REST endpoints",
                component="UserService",
                dependencies=["T002"],
                estimated_complexity=ComplexityLevel.LARGE,
            ),
        ],
        critical_path=["T001", "T002", "T003"],
    )


class TestEvidenceBundle:
    """Tests for EvidenceBundle."""

    def test_to_dict(self) -> None:
        """Test evidence bundle serialization."""
        bundle = EvidenceBundle(
            gate_type="hitl-2",
            artifacts=["/path/to/artifact.json"],
            summary="Test summary",
            metadata={"key": "value"},
        )

        result = bundle.to_dict()

        assert result["gate_type"] == "hitl-2"
        assert result["artifacts"] == ["/path/to/artifact.json"]
        assert result["summary"] == "Test summary"
        assert result["metadata"] == {"key": "value"}


class TestDesignCoordinatorInit:
    """Tests for Design Coordinator initialization."""

    def test_init_creates_agents(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test that coordinator creates all agents."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        assert coordinator._surveyor is not None
        assert coordinator._architect is not None
        assert coordinator._planner is not None

    def test_get_agent_statuses(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
    ) -> None:
        """Test getting agent statuses."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        statuses = coordinator.get_agent_statuses()

        assert "surveyor_agent" in statuses
        assert "architect_agent" in statuses
        assert "planner_agent" in statuses


class TestDesignCoordinatorRun:
    """Tests for Design Coordinator run method."""

    @pytest.mark.asyncio
    async def test_run_success_skip_hitl(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_tech_survey: TechSurvey,
        sample_architecture: Architecture,
        sample_implementation_plan: ImplementationPlan,
    ) -> None:
        """Test successful run with HITL skipped."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        # Mock all agent execute methods
        with patch.object(
            coordinator._surveyor, 'execute',
            new_callable=AsyncMock
        ) as mock_surveyor, patch.object(
            coordinator._architect, 'execute',
            new_callable=AsyncMock
        ) as mock_architect, patch.object(
            coordinator._planner, 'execute',
            new_callable=AsyncMock
        ) as mock_planner, patch.object(
            coordinator, '_load_tech_survey',
            new_callable=AsyncMock
        ) as mock_load_survey, patch.object(
            coordinator, '_load_architecture',
            new_callable=AsyncMock
        ) as mock_load_arch, patch.object(
            coordinator, '_load_implementation_plan',
            new_callable=AsyncMock
        ) as mock_load_plan:

            mock_surveyor.return_value = AgentResult(
                success=True,
                agent_type="surveyor_agent",
                task_id=agent_context.task_id,
                artifact_paths=["/artifacts/survey.json"],
            )
            mock_architect.return_value = AgentResult(
                success=True,
                agent_type="architect_agent",
                task_id=agent_context.task_id,
                artifact_paths=["/artifacts/arch.json"],
            )
            mock_planner.return_value = AgentResult(
                success=True,
                agent_type="planner_agent",
                task_id=agent_context.task_id,
                artifact_paths=["/artifacts/plan.json"],
            )

            mock_load_survey.return_value = sample_tech_survey
            mock_load_arch.return_value = sample_architecture
            mock_load_plan.return_value = sample_implementation_plan

            result = await coordinator.run(
                context=agent_context,
                prd_content="Build a user management system",
                skip_hitl=True,
            )

            assert result.success is True
            assert result.tech_survey is not None
            assert result.architecture is not None
            assert result.implementation_plan is not None

    @pytest.mark.asyncio
    async def test_run_surveyor_failure(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test run fails when surveyor fails."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        with patch.object(
            coordinator._surveyor, 'execute',
            new_callable=AsyncMock
        ) as mock_surveyor:
            mock_surveyor.return_value = AgentResult(
                success=False,
                agent_type="surveyor_agent",
                task_id=agent_context.task_id,
                error_message="Failed to analyze PRD",
            )

            result = await coordinator.run(
                context=agent_context,
                prd_content="PRD content",
                skip_hitl=True,
            )

            assert result.success is False
            assert "Surveyor" in result.error_message

    @pytest.mark.asyncio
    async def test_run_with_hitl2_submission(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        mock_hitl_dispatcher: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_tech_survey: TechSurvey,
        sample_architecture: Architecture,
    ) -> None:
        """Test run submits to HITL-2 and returns pending."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
            hitl_dispatcher=mock_hitl_dispatcher,
        )

        with patch.object(
            coordinator._surveyor, 'execute',
            new_callable=AsyncMock
        ) as mock_surveyor, patch.object(
            coordinator._architect, 'execute',
            new_callable=AsyncMock
        ) as mock_architect, patch.object(
            coordinator, '_load_tech_survey',
            new_callable=AsyncMock
        ) as mock_load_survey, patch.object(
            coordinator, '_load_architecture',
            new_callable=AsyncMock
        ) as mock_load_arch:

            mock_surveyor.return_value = AgentResult(
                success=True,
                agent_type="surveyor_agent",
                task_id=agent_context.task_id,
                artifact_paths=["/artifacts/survey.json"],
            )
            mock_architect.return_value = AgentResult(
                success=True,
                agent_type="architect_agent",
                task_id=agent_context.task_id,
                artifact_paths=["/artifacts/arch.json"],
            )
            mock_load_survey.return_value = sample_tech_survey
            mock_load_arch.return_value = sample_architecture

            result = await coordinator.run(
                context=agent_context,
                prd_content="PRD content",
            )

            # Should return pending HITL-2
            assert result.success is True
            assert result.hitl2_request_id == "hitl-request-123"
            assert result.metadata.get("status") == "pending_hitl2"

            # Verify HITL dispatcher was called
            mock_hitl_dispatcher.submit.assert_called_once()
            call_kwargs = mock_hitl_dispatcher.submit.call_args.kwargs
            assert call_kwargs["gate_type"] == "hitl-2"


class TestDesignCoordinatorEvidenceBundles:
    """Tests for evidence bundle creation."""

    def test_create_hitl2_bundle(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        sample_tech_survey: TechSurvey,
        sample_architecture: Architecture,
    ) -> None:
        """Test HITL-2 evidence bundle creation."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        bundle = coordinator._create_hitl2_bundle(
            tech_survey=sample_tech_survey,
            architecture=sample_architecture,
            artifact_paths=["/path/survey.json", "/path/arch.json"],
        )

        assert bundle.gate_type == "hitl-2"
        assert len(bundle.artifacts) == 2
        assert "Architecture Design Review" in bundle.summary
        assert bundle.metadata["component_count"] == 2
        assert bundle.metadata["technology_count"] == 2

    def test_create_hitl3_bundle(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        sample_implementation_plan: ImplementationPlan,
    ) -> None:
        """Test HITL-3 evidence bundle creation."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        bundle = coordinator._create_hitl3_bundle(
            implementation_plan=sample_implementation_plan,
            artifact_paths=["/path/plan.json"],
        )

        assert bundle.gate_type == "hitl-3"
        assert len(bundle.artifacts) == 1
        assert "Implementation Plan Review" in bundle.summary
        assert bundle.metadata["task_count"] == 3
        assert bundle.metadata["phase_count"] == 2


class TestDesignCoordinatorResume:
    """Tests for resuming from HITL approval."""

    @pytest.mark.asyncio
    async def test_run_from_hitl2_approval(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
        sample_tech_survey: TechSurvey,
        sample_architecture: Architecture,
        sample_implementation_plan: ImplementationPlan,
    ) -> None:
        """Test resuming workflow after HITL-2 approval."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        with patch.object(
            coordinator._planner, 'execute',
            new_callable=AsyncMock
        ) as mock_planner, patch.object(
            coordinator, '_load_implementation_plan',
            new_callable=AsyncMock
        ) as mock_load_plan:

            mock_planner.return_value = AgentResult(
                success=True,
                agent_type="planner_agent",
                task_id=agent_context.task_id,
                artifact_paths=["/artifacts/plan.json"],
            )
            mock_load_plan.return_value = sample_implementation_plan

            result = await coordinator.run_from_hitl2_approval(
                context=agent_context,
                tech_survey=sample_tech_survey,
                architecture=sample_architecture,
                prd_content="PRD content",
                skip_hitl=True,
            )

            assert result.success is True
            assert result.implementation_plan is not None
            mock_planner.assert_called_once()


class TestDesignCoordinatorRejection:
    """Tests for handling HITL rejections."""

    @pytest.mark.asyncio
    async def test_handle_rejection(
        self,
        mock_llm_client: MagicMock,
        mock_artifact_writer: MagicMock,
        default_config: DesignConfig,
        agent_context: AgentContext,
    ) -> None:
        """Test handling HITL rejection."""
        coordinator = DesignCoordinator(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=default_config,
        )

        result = await coordinator.handle_rejection(
            context=agent_context,
            gate_type="hitl-2",
            feedback="Architecture needs more detail on security",
        )

        assert result.success is False
        assert "hitl-2" in result.error_message
        assert "security" in result.error_message
