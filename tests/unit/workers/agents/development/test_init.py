"""Unit tests for Development Agents package initialization."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest


class TestDevelopmentPackageImports:
    """Tests for package imports."""

    def test_import_config(self) -> None:
        """Test importing configuration classes."""
        from src.workers.agents.development import DevelopmentConfig, ConfigValidationError

        assert DevelopmentConfig is not None
        assert ConfigValidationError is not None

    def test_import_test_models(self) -> None:
        """Test importing test-related models."""
        from src.workers.agents.development import (
            TestType,
            TestCase,
            TestSuite,
        )

        assert TestType is not None
        assert TestCase is not None
        assert TestSuite is not None

    def test_import_implementation_models(self) -> None:
        """Test importing implementation models."""
        from src.workers.agents.development import (
            CodeFile,
            Implementation,
        )

        assert CodeFile is not None
        assert Implementation is not None

    def test_import_test_result_models(self) -> None:
        """Test importing test result models."""
        from src.workers.agents.development import (
            TestResult,
            TestRunResult,
        )

        assert TestResult is not None
        assert TestRunResult is not None

    def test_import_review_models(self) -> None:
        """Test importing review models."""
        from src.workers.agents.development import (
            IssueSeverity,
            ReviewIssue,
            CodeReview,
        )

        assert IssueSeverity is not None
        assert ReviewIssue is not None
        assert CodeReview is not None

    def test_import_debug_models(self) -> None:
        """Test importing debug models."""
        from src.workers.agents.development import (
            CodeChange,
            DebugAnalysis,
        )

        assert CodeChange is not None
        assert DebugAnalysis is not None

    def test_import_result_model(self) -> None:
        """Test importing result model."""
        from src.workers.agents.development import DevelopmentResult

        assert DevelopmentResult is not None

    def test_import_agents(self) -> None:
        """Test importing agent classes."""
        from src.workers.agents.development import (
            UTestAgent,
            UTestAgentError,
            CodingAgent,
            CodingAgentError,
            DebuggerAgent,
            DebuggerAgentError,
            ReviewerAgent,
            ReviewerAgentError,
        )

        assert UTestAgent is not None
        assert UTestAgentError is not None
        assert CodingAgent is not None
        assert CodingAgentError is not None
        assert DebuggerAgent is not None
        assert DebuggerAgentError is not None
        assert ReviewerAgent is not None
        assert ReviewerAgentError is not None

    def test_import_orchestrator(self) -> None:
        """Test importing TDD orchestrator classes."""
        from src.workers.agents.development import (
            TDDOrchestrator,
            TDDOrchestratorError,
        )

        assert TDDOrchestrator is not None
        assert TDDOrchestratorError is not None

    def test_import_test_runner(self) -> None:
        """Test importing test runner classes."""
        from src.workers.agents.development import (
            TestRunner,
            TestRunnerError,
            TestTimeoutError,
        )

        assert TestRunner is not None
        assert TestRunnerError is not None
        assert TestTimeoutError is not None


class TestAgentMetadata:
    """Tests for agent metadata."""

    def test_agent_metadata_exists(self) -> None:
        """Test that AGENT_METADATA is defined."""
        from src.workers.agents.development import AGENT_METADATA

        assert isinstance(AGENT_METADATA, dict)

    def test_utest_metadata(self) -> None:
        """Test UTest agent metadata."""
        from src.workers.agents.development import AGENT_METADATA, UTestAgent

        assert "utest_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["utest_agent"]

        assert metadata["class"] is UTestAgent
        assert metadata["phase"] == "development"
        assert "description" in metadata
        assert "inputs" in metadata
        assert "outputs" in metadata
        assert "capabilities" in metadata
        assert "test_generation" in metadata["capabilities"]

    def test_coding_metadata(self) -> None:
        """Test Coding agent metadata."""
        from src.workers.agents.development import AGENT_METADATA, CodingAgent

        assert "coding_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["coding_agent"]

        assert metadata["class"] is CodingAgent
        assert metadata["phase"] == "development"
        assert "implementation" in metadata["capabilities"]

    def test_debugger_metadata(self) -> None:
        """Test Debugger agent metadata."""
        from src.workers.agents.development import AGENT_METADATA, DebuggerAgent

        assert "debugger_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["debugger_agent"]

        assert metadata["class"] is DebuggerAgent
        assert metadata["phase"] == "development"
        assert "failure_analysis" in metadata["capabilities"]

    def test_reviewer_metadata(self) -> None:
        """Test Reviewer agent metadata."""
        from src.workers.agents.development import AGENT_METADATA, ReviewerAgent

        assert "reviewer_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["reviewer_agent"]

        assert metadata["class"] is ReviewerAgent
        assert metadata["phase"] == "development"
        assert "security_scan" in metadata["capabilities"]


class TestAgentRegistration:
    """Tests for agent registration function."""

    def test_register_development_agents(self) -> None:
        """Test registering development agents with dispatcher."""
        from src.workers.agents.development import register_development_agents

        # Create mock dispatcher
        dispatcher = MagicMock()
        dispatcher.register_agent_type = MagicMock()

        # Register agents
        register_development_agents(dispatcher)

        # Verify registration calls (4 agents)
        assert dispatcher.register_agent_type.call_count == 4

        # Get call args
        call_args = [
            call.kwargs["agent_type"]
            for call in dispatcher.register_agent_type.call_args_list
        ]

        assert "utest_agent" in call_args
        assert "coding_agent" in call_args
        assert "debugger_agent" in call_args
        assert "reviewer_agent" in call_args


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_utest_agent(self) -> None:
        """Test creating UTest agent via factory."""
        from src.workers.agents.development import create_utest_agent, UTestAgent

        mock_backend = MagicMock()
        mock_writer = MagicMock()

        agent = create_utest_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, UTestAgent)

    def test_create_utest_agent_with_config(self) -> None:
        """Test creating UTest agent with custom config."""
        from src.workers.agents.development import (
            create_utest_agent,
            UTestAgent,
            DevelopmentConfig,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        config = DevelopmentConfig()

        agent = create_utest_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, UTestAgent)

    def test_create_coding_agent(self) -> None:
        """Test creating Coding agent via factory."""
        from src.workers.agents.development import create_coding_agent, CodingAgent

        mock_backend = MagicMock()
        mock_backend.backend_name = "mock"
        mock_writer = MagicMock()

        agent = create_coding_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, CodingAgent)

    def test_create_coding_agent_with_config(self) -> None:
        """Test creating Coding agent with custom config."""
        from src.workers.agents.development import (
            create_coding_agent,
            CodingAgent,
            DevelopmentConfig,
        )

        mock_backend = MagicMock()
        mock_backend.backend_name = "mock"
        mock_writer = MagicMock()
        config = DevelopmentConfig()

        agent = create_coding_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, CodingAgent)

    def test_create_debugger_agent(self) -> None:
        """Test creating Debugger agent via factory."""
        from src.workers.agents.development import create_debugger_agent, DebuggerAgent

        mock_backend = MagicMock()
        mock_writer = MagicMock()

        agent = create_debugger_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, DebuggerAgent)

    def test_create_debugger_agent_with_config(self) -> None:
        """Test creating Debugger agent with custom config."""
        from src.workers.agents.development import (
            create_debugger_agent,
            DebuggerAgent,
            DevelopmentConfig,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        config = DevelopmentConfig()

        agent = create_debugger_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, DebuggerAgent)

    def test_create_reviewer_agent(self) -> None:
        """Test creating Reviewer agent via factory."""
        from src.workers.agents.development import create_reviewer_agent, ReviewerAgent

        mock_backend = MagicMock()
        mock_writer = MagicMock()

        agent = create_reviewer_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, ReviewerAgent)

    def test_create_reviewer_agent_with_config(self) -> None:
        """Test creating Reviewer agent with custom config."""
        from src.workers.agents.development import (
            create_reviewer_agent,
            ReviewerAgent,
            DevelopmentConfig,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        config = DevelopmentConfig()

        agent = create_reviewer_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, ReviewerAgent)

    def test_create_tdd_orchestrator(self) -> None:
        """Test creating TDD orchestrator via factory."""
        from src.workers.agents.development import (
            create_tdd_orchestrator,
            TDDOrchestrator,
        )

        mock_utest = MagicMock()
        mock_coding = MagicMock()
        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()
        mock_runner = MagicMock()

        orchestrator = create_tdd_orchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
        )

        assert isinstance(orchestrator, TDDOrchestrator)

    def test_create_tdd_orchestrator_with_options(self) -> None:
        """Test creating TDD orchestrator with all options."""
        from src.workers.agents.development import (
            create_tdd_orchestrator,
            TDDOrchestrator,
            DevelopmentConfig,
        )

        mock_utest = MagicMock()
        mock_coding = MagicMock()
        mock_debugger = MagicMock()
        mock_reviewer = MagicMock()
        mock_runner = MagicMock()
        mock_hitl = MagicMock()
        config = DevelopmentConfig()

        orchestrator = create_tdd_orchestrator(
            utest_agent=mock_utest,
            coding_agent=mock_coding,
            debugger_agent=mock_debugger,
            reviewer_agent=mock_reviewer,
            test_runner=mock_runner,
            config=config,
            hitl_dispatcher=mock_hitl,
        )

        assert isinstance(orchestrator, TDDOrchestrator)


class TestAllExports:
    """Tests for __all__ exports."""

    def test_all_exports_valid(self) -> None:
        """Test that all items in __all__ are importable."""
        from src.workers.agents import development

        for name in development.__all__:
            assert hasattr(development, name), f"{name} in __all__ but not exported"

    def test_all_contains_expected_items(self) -> None:
        """Test that __all__ contains key items."""
        from src.workers.agents.development import __all__

        expected = [
            # Config
            "DevelopmentConfig",
            "ConfigValidationError",
            # Models
            "TestType",
            "TestCase",
            "TestSuite",
            "CodeFile",
            "Implementation",
            "TestResult",
            "TestRunResult",
            "IssueSeverity",
            "ReviewIssue",
            "CodeReview",
            "CodeChange",
            "DebugAnalysis",
            "DevelopmentResult",
            # Agents
            "UTestAgent",
            "UTestAgentError",
            "CodingAgent",
            "CodingAgentError",
            "DebuggerAgent",
            "DebuggerAgentError",
            "ReviewerAgent",
            "ReviewerAgentError",
            # Orchestrator
            "TDDOrchestrator",
            "TDDOrchestratorError",
            # Test runner
            "TestRunner",
            "TestRunnerError",
            "TestTimeoutError",
        ]

        for item in expected:
            assert item in __all__, f"{item} not in __all__"
