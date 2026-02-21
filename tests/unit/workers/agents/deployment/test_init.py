"""Unit tests for Deployment Agents package initialization."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest


class TestDeploymentPackageImports:
    """Tests for package imports."""

    def test_import_config(self) -> None:
        """Test importing configuration classes."""
        from src.workers.agents.deployment import (
            DeploymentConfig,
            DeploymentConfigValidationError,
            DeploymentStrategy,
        )

        assert DeploymentConfig is not None
        assert DeploymentConfigValidationError is not None
        assert DeploymentStrategy is not None

    def test_import_models(self) -> None:
        """Test importing model classes."""
        from src.workers.agents.deployment import (
            ArtifactType,
            ArtifactReference,
            ReleaseManifest,
            StepType,
            DeploymentStep,
            HealthCheckType,
            HealthCheck,
            DeploymentPlan,
            MetricType,
            MetricDefinition,
            AlertSeverity,
            AlertRule,
            DashboardConfig,
            MonitoringConfig,
        )

        assert ArtifactType is not None
        assert ArtifactReference is not None
        assert ReleaseManifest is not None
        assert StepType is not None
        assert DeploymentStep is not None
        assert HealthCheckType is not None
        assert HealthCheck is not None
        assert DeploymentPlan is not None
        assert MetricType is not None
        assert MetricDefinition is not None
        assert AlertSeverity is not None
        assert AlertRule is not None
        assert DashboardConfig is not None
        assert MonitoringConfig is not None

    def test_import_release_agent(self) -> None:
        """Test importing ReleaseAgent classes."""
        from src.workers.agents.deployment import (
            ReleaseAgent,
            ReleaseAgentError,
        )

        assert ReleaseAgent is not None
        assert ReleaseAgentError is not None

    def test_import_deployment_agent(self) -> None:
        """Test importing DeploymentAgent classes."""
        from src.workers.agents.deployment import (
            DeploymentAgent,
            DeploymentAgentError,
        )

        assert DeploymentAgent is not None
        assert DeploymentAgentError is not None

    def test_import_monitor_agent(self) -> None:
        """Test importing MonitorAgent classes."""
        from src.workers.agents.deployment import (
            MonitorAgent,
            MonitorAgentError,
        )

        assert MonitorAgent is not None
        assert MonitorAgentError is not None

    def test_import_coordinator(self) -> None:
        """Test importing coordinator classes."""
        from src.workers.agents.deployment import (
            ValidationDeploymentCoordinator,
            ValidationDeploymentCoordinatorError,
            EvidenceBundle,
            ValidationResult,
            DeploymentResult,
            RejectionResult,
        )

        assert ValidationDeploymentCoordinator is not None
        assert ValidationDeploymentCoordinatorError is not None
        assert EvidenceBundle is not None
        assert ValidationResult is not None
        assert DeploymentResult is not None
        assert RejectionResult is not None


class TestAgentMetadata:
    """Tests for agent metadata."""

    def test_agent_metadata_exists(self) -> None:
        """Test that AGENT_METADATA is defined."""
        from src.workers.agents.deployment import AGENT_METADATA

        assert isinstance(AGENT_METADATA, dict)

    def test_release_agent_metadata(self) -> None:
        """Test ReleaseAgent metadata."""
        from src.workers.agents.deployment import AGENT_METADATA, ReleaseAgent

        assert "release_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["release_agent"]

        assert metadata["class"] is ReleaseAgent
        assert metadata["phase"] == "deployment"
        assert "description" in metadata
        assert "inputs" in metadata
        assert "outputs" in metadata
        assert "capabilities" in metadata
        assert "manifest_generation" in metadata["capabilities"]

    def test_deployment_agent_metadata(self) -> None:
        """Test DeploymentAgent metadata."""
        from src.workers.agents.deployment import AGENT_METADATA, DeploymentAgent

        assert "deployment_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["deployment_agent"]

        assert metadata["class"] is DeploymentAgent
        assert metadata["phase"] == "deployment"
        assert "deployment_planning" in metadata["capabilities"]

    def test_monitor_agent_metadata(self) -> None:
        """Test MonitorAgent metadata."""
        from src.workers.agents.deployment import AGENT_METADATA, MonitorAgent

        assert "monitor_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["monitor_agent"]

        assert metadata["class"] is MonitorAgent
        assert metadata["phase"] == "deployment"
        assert "monitoring_config" in metadata["capabilities"]


class TestAgentRegistration:
    """Tests for agent registration function."""

    def test_register_deployment_agents(self) -> None:
        """Test registering deployment agents with dispatcher."""
        from src.workers.agents.deployment import register_deployment_agents

        # Create mock dispatcher
        dispatcher = MagicMock()
        dispatcher.register_agent_type = MagicMock()

        # Register agents
        register_deployment_agents(dispatcher)

        # Verify registration calls (3 agents)
        assert dispatcher.register_agent_type.call_count == 3

        # Get call args
        call_args = [
            call.kwargs["agent_type"]
            for call in dispatcher.register_agent_type.call_args_list
        ]

        assert "release_agent" in call_args
        assert "deployment_agent" in call_args
        assert "monitor_agent" in call_args


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_release_agent(self) -> None:
        """Test creating ReleaseAgent via factory."""
        from src.workers.agents.deployment import create_release_agent, ReleaseAgent

        mock_backend = MagicMock()
        mock_writer = MagicMock()

        agent = create_release_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, ReleaseAgent)

    def test_create_release_agent_with_config(self) -> None:
        """Test creating ReleaseAgent with custom config."""
        from src.workers.agents.deployment import (
            create_release_agent,
            ReleaseAgent,
            DeploymentConfig,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        config = DeploymentConfig()

        agent = create_release_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, ReleaseAgent)

    def test_create_deployment_agent(self) -> None:
        """Test creating DeploymentAgent via factory."""
        from src.workers.agents.deployment import create_deployment_agent, DeploymentAgent

        mock_backend = MagicMock()
        mock_writer = MagicMock()

        agent = create_deployment_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, DeploymentAgent)

    def test_create_deployment_agent_with_config(self) -> None:
        """Test creating DeploymentAgent with custom config."""
        from src.workers.agents.deployment import (
            create_deployment_agent,
            DeploymentAgent,
            DeploymentConfig,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        config = DeploymentConfig()

        agent = create_deployment_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, DeploymentAgent)

    def test_create_monitor_agent(self) -> None:
        """Test creating MonitorAgent via factory."""
        from src.workers.agents.deployment import create_monitor_agent, MonitorAgent

        mock_backend = MagicMock()
        mock_writer = MagicMock()

        agent = create_monitor_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, MonitorAgent)

    def test_create_monitor_agent_with_config(self) -> None:
        """Test creating MonitorAgent with custom config."""
        from src.workers.agents.deployment import (
            create_monitor_agent,
            MonitorAgent,
            DeploymentConfig,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        config = DeploymentConfig()

        agent = create_monitor_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, MonitorAgent)

    def test_create_validation_deployment_coordinator(self) -> None:
        """Test creating ValidationDeploymentCoordinator via factory."""
        from src.workers.agents.deployment import (
            create_validation_deployment_coordinator,
            ValidationDeploymentCoordinator,
        )

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        mock_runner = MagicMock()

        coordinator = create_validation_deployment_coordinator(
            backend=mock_backend,
            artifact_writer=mock_writer,
            test_runner=mock_runner,
        )

        assert isinstance(coordinator, ValidationDeploymentCoordinator)

    def test_create_validation_deployment_coordinator_with_options(self) -> None:
        """Test creating ValidationDeploymentCoordinator with all options."""
        from src.workers.agents.deployment import (
            create_validation_deployment_coordinator,
            ValidationDeploymentCoordinator,
            DeploymentConfig,
        )
        from src.workers.agents.validation import ValidationConfig

        mock_backend = MagicMock()
        mock_writer = MagicMock()
        mock_runner = MagicMock()
        mock_hitl = MagicMock()
        validation_config = ValidationConfig()
        deployment_config = DeploymentConfig()

        coordinator = create_validation_deployment_coordinator(
            backend=mock_backend,
            artifact_writer=mock_writer,
            test_runner=mock_runner,
            validation_config=validation_config,
            deployment_config=deployment_config,
            hitl_dispatcher=mock_hitl,
        )

        assert isinstance(coordinator, ValidationDeploymentCoordinator)


class TestAllExports:
    """Tests for __all__ exports."""

    def test_all_exports_valid(self) -> None:
        """Test that all items in __all__ are importable."""
        from src.workers.agents import deployment

        for name in deployment.__all__:
            assert hasattr(deployment, name), f"{name} in __all__ but not exported"

    def test_all_contains_expected_items(self) -> None:
        """Test that __all__ contains key items."""
        from src.workers.agents.deployment import __all__

        expected = [
            # Config
            "DeploymentConfig",
            "DeploymentConfigValidationError",
            "DeploymentStrategy",
            # Models
            "ArtifactType",
            "ArtifactReference",
            "ReleaseManifest",
            "StepType",
            "DeploymentStep",
            "HealthCheckType",
            "HealthCheck",
            "DeploymentPlan",
            "MetricType",
            "MetricDefinition",
            "AlertSeverity",
            "AlertRule",
            "DashboardConfig",
            "MonitoringConfig",
            # Agents
            "ReleaseAgent",
            "ReleaseAgentError",
            "DeploymentAgent",
            "DeploymentAgentError",
            "MonitorAgent",
            "MonitorAgentError",
            # Coordinator
            "ValidationDeploymentCoordinator",
            "ValidationDeploymentCoordinatorError",
            "EvidenceBundle",
            "ValidationResult",
            "DeploymentResult",
            "RejectionResult",
            # Metadata and Registration
            "AGENT_METADATA",
            "register_deployment_agents",
            # Factory Functions
            "create_release_agent",
            "create_deployment_agent",
            "create_monitor_agent",
            "create_validation_deployment_coordinator",
        ]

        for item in expected:
            assert item in __all__, f"{item} not in __all__"
