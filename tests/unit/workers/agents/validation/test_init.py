"""Unit tests for Validation Agents package initialization."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.backends.base import BackendResult


class TestValidationPackageImports:
    """Tests for package imports."""

    def test_import_config(self) -> None:
        """Test importing configuration classes."""
        from src.workers.agents.validation import ValidationConfig, ConfigValidationError

        assert ValidationConfig is not None
        assert ConfigValidationError is not None

    def test_import_models(self) -> None:
        """Test importing model classes."""
        from src.workers.agents.validation import (
            CheckCategory,
            Severity,
            SecurityCategory,
            ValidationCheck,
            ValidationReport,
            SecurityFinding,
            SecurityReport,
        )

        assert CheckCategory is not None
        assert Severity is not None
        assert SecurityCategory is not None
        assert ValidationCheck is not None
        assert ValidationReport is not None
        assert SecurityFinding is not None
        assert SecurityReport is not None

    def test_import_validation_agent(self) -> None:
        """Test importing ValidationAgent classes."""
        from src.workers.agents.validation import (
            ValidationAgent,
            ValidationAgentError,
        )

        assert ValidationAgent is not None
        assert ValidationAgentError is not None

    def test_import_security_agent(self) -> None:
        """Test importing SecurityAgent classes."""
        from src.workers.agents.validation import (
            SecurityAgent,
            SecurityAgentError,
        )

        assert SecurityAgent is not None
        assert SecurityAgentError is not None


class TestAgentMetadata:
    """Tests for agent metadata."""

    def test_agent_metadata_exists(self) -> None:
        """Test that AGENT_METADATA is defined."""
        from src.workers.agents.validation import AGENT_METADATA

        assert isinstance(AGENT_METADATA, dict)

    def test_validation_agent_metadata(self) -> None:
        """Test ValidationAgent metadata."""
        from src.workers.agents.validation import AGENT_METADATA, ValidationAgent

        assert "validation_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["validation_agent"]

        assert metadata["class"] is ValidationAgent
        assert metadata["phase"] == "validation"
        assert "description" in metadata
        assert "inputs" in metadata
        assert "outputs" in metadata
        assert "capabilities" in metadata
        assert "e2e_testing" in metadata["capabilities"]
        assert "rlm_exploration" not in metadata["capabilities"]

    def test_security_agent_metadata(self) -> None:
        """Test SecurityAgent metadata."""
        from src.workers.agents.validation import AGENT_METADATA, SecurityAgent

        assert "security_agent" in AGENT_METADATA
        metadata = AGENT_METADATA["security_agent"]

        assert metadata["class"] is SecurityAgent
        assert metadata["phase"] == "validation"
        assert "vulnerability_scanning" in metadata["capabilities"]


class TestAgentRegistration:
    """Tests for agent registration function."""

    def test_register_validation_agents(self) -> None:
        """Test registering validation agents with dispatcher."""
        from src.workers.agents.validation import register_validation_agents

        # Create mock dispatcher
        dispatcher = MagicMock()
        dispatcher.register_agent_type = MagicMock()

        # Register agents
        register_validation_agents(dispatcher)

        # Verify registration calls (2 agents)
        assert dispatcher.register_agent_type.call_count == 2

        # Get call args
        call_args = [
            call.kwargs["agent_type"]
            for call in dispatcher.register_agent_type.call_args_list
        ]

        assert "validation_agent" in call_args
        assert "security_agent" in call_args


class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_validation_agent(self) -> None:
        """Test creating ValidationAgent via factory."""
        from src.workers.agents.validation import create_validation_agent, ValidationAgent

        mock_backend = AsyncMock()
        mock_backend.backend_name = "mock"
        mock_backend.execute = AsyncMock(return_value=BackendResult(
            success=True, output="{}", structured_output={},
        ))
        mock_writer = MagicMock()
        mock_runner = MagicMock()

        agent = create_validation_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            test_runner=mock_runner,
        )

        assert isinstance(agent, ValidationAgent)

    def test_create_validation_agent_with_config(self) -> None:
        """Test creating ValidationAgent with custom config."""
        from src.workers.agents.validation import (
            create_validation_agent,
            ValidationAgent,
            ValidationConfig,
        )

        mock_backend = AsyncMock()
        mock_backend.backend_name = "mock"
        mock_writer = MagicMock()
        mock_runner = MagicMock()
        config = ValidationConfig()

        agent = create_validation_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            test_runner=mock_runner,
            config=config,
        )

        assert isinstance(agent, ValidationAgent)

    def test_create_security_agent(self) -> None:
        """Test creating SecurityAgent via factory."""
        from src.workers.agents.validation import create_security_agent, SecurityAgent

        mock_backend = AsyncMock()
        mock_backend.backend_name = "mock"
        mock_writer = MagicMock()

        agent = create_security_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
        )

        assert isinstance(agent, SecurityAgent)

    def test_create_security_agent_with_config(self) -> None:
        """Test creating SecurityAgent with custom config."""
        from src.workers.agents.validation import (
            create_security_agent,
            SecurityAgent,
            ValidationConfig,
        )

        mock_backend = AsyncMock()
        mock_backend.backend_name = "mock"
        mock_writer = MagicMock()
        config = ValidationConfig()

        agent = create_security_agent(
            backend=mock_backend,
            artifact_writer=mock_writer,
            config=config,
        )

        assert isinstance(agent, SecurityAgent)


class TestAllExports:
    """Tests for __all__ exports."""

    def test_all_exports_valid(self) -> None:
        """Test that all items in __all__ are importable."""
        from src.workers.agents import validation

        for name in validation.__all__:
            assert hasattr(validation, name), f"{name} in __all__ but not exported"

    def test_all_contains_expected_items(self) -> None:
        """Test that __all__ contains key items."""
        from src.workers.agents.validation import __all__

        expected = [
            # Config
            "ValidationConfig",
            "ConfigValidationError",
            # Models
            "CheckCategory",
            "Severity",
            "SecurityCategory",
            "ValidationCheck",
            "ValidationReport",
            "SecurityFinding",
            "SecurityReport",
            # Agents
            "ValidationAgent",
            "ValidationAgentError",
            "SecurityAgent",
            "SecurityAgentError",
            # Metadata and Registration
            "AGENT_METADATA",
            "register_validation_agents",
            # Factory Functions
            "create_validation_agent",
            "create_security_agent",
        ]

        for item in expected:
            assert item in __all__, f"{item} not in __all__"
