"""Unit tests for Design Agents package initialization."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest


class TestDesignPackageImports:
    """Tests for package imports."""

    def test_import_config(self) -> None:
        """Test importing configuration classes."""
        from src.workers.agents.design import DesignConfig, ConfigValidationError

        assert DesignConfig is not None
        assert ConfigValidationError is not None

    def test_import_tech_survey_models(self) -> None:
        """Test importing tech survey models."""
        from src.workers.agents.design import (
            TechnologyChoice,
            TechSurvey,
            Risk,
            RiskLevel,
        )

        assert TechnologyChoice is not None
        assert TechSurvey is not None
        assert Risk is not None
        assert RiskLevel is not None

    def test_import_architecture_models(self) -> None:
        """Test importing architecture models."""
        from src.workers.agents.design import (
            Component,
            Interface,
            DataFlow,
            DiagramReference,
            DiagramType,
            Architecture,
            ArchitectureStyle,
        )

        assert Component is not None
        assert Interface is not None
        assert DataFlow is not None
        assert DiagramReference is not None
        assert DiagramType is not None
        assert Architecture is not None
        assert ArchitectureStyle is not None

    def test_import_plan_models(self) -> None:
        """Test importing implementation plan models."""
        from src.workers.agents.design import (
            ImplementationTask,
            Phase,
            ComplexityLevel,
            ImplementationPlan,
        )

        assert ImplementationTask is not None
        assert Phase is not None
        assert ComplexityLevel is not None
        assert ImplementationPlan is not None

    def test_import_result_model(self) -> None:
        """Test importing result model."""
        from src.workers.agents.design import DesignResult

        assert DesignResult is not None

    def test_import_agents(self) -> None:
        """Test importing agent classes."""
        from src.workers.agents.design import (
            SurveyorAgent,
            SurveyorAgentError,
            ArchitectAgent,
            ArchitectAgentError,
            PlannerAgent,
        )

        assert SurveyorAgent is not None
        assert SurveyorAgentError is not None
        assert ArchitectAgent is not None
        assert ArchitectAgentError is not None
        assert PlannerAgent is not None

    def test_import_coordinator(self) -> None:
        """Test importing coordinator classes."""
        from src.workers.agents.design import (
            DesignCoordinator,
            DesignCoordinatorError,
            EvidenceBundle,
        )

        assert DesignCoordinator is not None
        assert DesignCoordinatorError is not None
        assert EvidenceBundle is not None


class TestAgentMetadata:
    """Tests for agent metadata."""

    def test_agent_metadata_exists(self) -> None:
        """Test that AGENT_METADATA is defined."""
        from src.workers.agents.design import AGENT_METADATA

        assert isinstance(AGENT_METADATA, dict)

    def test_surveyor_metadata(self) -> None:
        """Test surveyor agent metadata."""
        from src.workers.agents.design import AGENT_METADATA, SurveyorAgent

        assert "surveyor_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["surveyor_agent"]

        assert metadata["class"] is SurveyorAgent
        assert metadata["phase"] == "design"
        assert "description" in metadata
        assert "inputs" in metadata
        assert "outputs" in metadata
        assert "capabilities" in metadata

    def test_architect_metadata(self) -> None:
        """Test architect agent metadata."""
        from src.workers.agents.design import AGENT_METADATA, ArchitectAgent

        assert "architect_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["architect_agent"]

        assert metadata["class"] is ArchitectAgent
        assert metadata["phase"] == "design"
        assert "diagram_generation" in metadata["capabilities"]

    def test_planner_metadata(self) -> None:
        """Test planner agent metadata."""
        from src.workers.agents.design import AGENT_METADATA, PlannerAgent

        assert "planner_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["planner_agent"]

        assert metadata["class"] is PlannerAgent
        assert metadata["phase"] == "design"
        assert "critical_path" in metadata["capabilities"]


class TestAgentRegistration:
    """Tests for agent registration function."""

    def test_register_design_agents(self) -> None:
        """Test registering design agents with dispatcher."""
        from src.workers.agents.design import register_design_agents

        # Create mock dispatcher
        dispatcher = MagicMock()
        dispatcher.register_agent_type = MagicMock()

        # Register agents
        register_design_agents(dispatcher)

        # Verify registration calls
        assert dispatcher.register_agent_type.call_count == 3

        # Get call args
        call_args = [
            call.kwargs["agent_type"]
            for call in dispatcher.register_agent_type.call_args_list
        ]

        assert "surveyor_agent" in call_args
        assert "architect_agent" in call_args
        assert "planner_agent" in call_args


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_surveyor_agent(self) -> None:
        """Test creating surveyor agent via factory."""
        from src.workers.agents.design import create_surveyor_agent, SurveyorAgent

        mock_llm = MagicMock()
        mock_writer = MagicMock()

        agent = create_surveyor_agent(
            llm_client=mock_llm,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, SurveyorAgent)

    def test_create_surveyor_agent_with_options(self) -> None:
        """Test creating surveyor agent with all options."""
        from src.workers.agents.design import (
            create_surveyor_agent,
            SurveyorAgent,
            DesignConfig,
        )

        mock_llm = MagicMock()
        mock_writer = MagicMock()
        mock_rlm = MagicMock()
        mock_mapper = MagicMock()
        config = DesignConfig()

        agent = create_surveyor_agent(
            llm_client=mock_llm,
            artifact_writer=mock_writer,
            config=config,
            rlm_integration=mock_rlm,
            repo_mapper=mock_mapper,
        )

        assert isinstance(agent, SurveyorAgent)

    def test_create_architect_agent(self) -> None:
        """Test creating architect agent via factory."""
        from src.workers.agents.design import create_architect_agent, ArchitectAgent

        mock_llm = MagicMock()
        mock_writer = MagicMock()

        agent = create_architect_agent(
            llm_client=mock_llm,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, ArchitectAgent)

    def test_create_planner_agent(self) -> None:
        """Test creating planner agent via factory."""
        from src.workers.agents.design import create_planner_agent, PlannerAgent

        mock_llm = MagicMock()
        mock_writer = MagicMock()

        agent = create_planner_agent(
            llm_client=mock_llm,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, PlannerAgent)

    def test_create_design_coordinator(self) -> None:
        """Test creating design coordinator via factory."""
        from src.workers.agents.design import (
            create_design_coordinator,
            DesignCoordinator,
        )

        mock_llm = MagicMock()
        mock_writer = MagicMock()

        coordinator = create_design_coordinator(
            llm_client=mock_llm,
            artifact_writer=mock_writer,
        )

        assert isinstance(coordinator, DesignCoordinator)

    def test_create_design_coordinator_with_options(self) -> None:
        """Test creating design coordinator with all options."""
        from src.workers.agents.design import (
            create_design_coordinator,
            DesignCoordinator,
            DesignConfig,
        )

        mock_llm = MagicMock()
        mock_writer = MagicMock()
        mock_hitl = MagicMock()
        mock_rlm = MagicMock()
        mock_mapper = MagicMock()
        config = DesignConfig()

        coordinator = create_design_coordinator(
            llm_client=mock_llm,
            artifact_writer=mock_writer,
            hitl_dispatcher=mock_hitl,
            config=config,
            rlm_integration=mock_rlm,
            repo_mapper=mock_mapper,
        )

        assert isinstance(coordinator, DesignCoordinator)


class TestAllExports:
    """Tests for __all__ exports."""

    def test_all_exports_valid(self) -> None:
        """Test that all items in __all__ are importable."""
        from src.workers.agents import design

        for name in design.__all__:
            assert hasattr(design, name), f"{name} in __all__ but not exported"

    def test_all_contains_expected_items(self) -> None:
        """Test that __all__ contains key items."""
        from src.workers.agents.design import __all__

        expected = [
            "DesignConfig",
            "SurveyorAgent",
            "ArchitectAgent",
            "PlannerAgent",
            "DesignCoordinator",
            "DesignResult",
            "TechSurvey",
            "Architecture",
            "ImplementationPlan",
        ]

        for item in expected:
            assert item in __all__, f"{item} not in __all__"
