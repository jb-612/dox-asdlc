"""Unit tests for development agent factory integration with LLM admin config."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.workers.agents.protocols import AgentContext


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
def mock_artifact_writer(tmp_path):
    """Create a mock artifact writer."""
    writer = MagicMock()
    writer.workspace_path = str(tmp_path)

    async def write_artifact(**kwargs):
        path = tmp_path / kwargs.get("filename", "artifact.json")
        path.write_text(kwargs.get("content", "{}"))
        return str(path)

    writer.write_artifact = AsyncMock(side_effect=write_artifact)
    return writer


class TestDevelopmentAgentFactoryIntegration:
    """Tests for development agents using LLMClientFactory."""

    @pytest.mark.asyncio
    async def test_utest_agent_can_use_factory_client(
        self,
        mock_artifact_writer,
        agent_context,
    ) -> None:
        """Test that UTestAgent can be created with an LLMAgentBackend."""
        from src.workers.agents.development.utest_agent import UTestAgent
        from src.workers.agents.development.config import DevelopmentConfig
        from src.workers.agents.backends.llm_backend import LLMAgentBackend
        from src.infrastructure.llm.base_client import BaseLLMClient, LLMResponse

        # Create a mock client that implements BaseLLMClient interface
        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock(return_value=LLMResponse(
            content='{"test_cases": [], "setup_code": "", "fixtures": []}',
            model="test-model",
        ))
        mock_client.model = "test-model"
        mock_client.model_name = "test-model"

        config = DevelopmentConfig()
        backend = LLMAgentBackend(llm_client=mock_client)

        # Agent should work with any backend that implements the protocol
        agent = UTestAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "utest"

    @pytest.mark.asyncio
    async def test_coding_agent_can_use_factory_client(
        self,
        mock_artifact_writer,
        agent_context,
    ) -> None:
        """Test that CodingAgent can be created with a factory-provided client."""
        from src.workers.agents.backends.llm_backend import LLMAgentBackend
        from src.workers.agents.development.coding_agent import CodingAgent
        from src.workers.agents.development.config import DevelopmentConfig
        from src.infrastructure.llm.base_client import BaseLLMClient, LLMResponse

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock(return_value=LLMResponse(
            content='{"files": [], "imports": [], "dependencies": []}',
            model="test-model",
        ))
        mock_client.model = "test-model"

        config = DevelopmentConfig()
        backend = LLMAgentBackend(llm_client=mock_client)

        agent = CodingAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "coding"

    @pytest.mark.asyncio
    async def test_debugger_agent_can_use_factory_client(
        self,
        mock_artifact_writer,
        agent_context,
    ) -> None:
        """Test that DebuggerAgent can be created with an LLMAgentBackend."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent
        from src.workers.agents.development.config import DevelopmentConfig
        from src.infrastructure.llm.base_client import BaseLLMClient, LLMResponse
        from src.workers.agents.backends.llm_backend import LLMAgentBackend

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock(return_value=LLMResponse(
            content='{"failure_id": "test", "root_cause": "", "fix_suggestion": "", "code_changes": []}',
            model="test-model",
        ))
        mock_client.model = "test-model"
        mock_client.model_name = "test-model"

        config = DevelopmentConfig()
        backend = LLMAgentBackend(llm_client=mock_client)

        agent = DebuggerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "debugger"

    @pytest.mark.asyncio
    async def test_reviewer_agent_can_use_factory_client(
        self,
        mock_artifact_writer,
        agent_context,
    ) -> None:
        """Test that ReviewerAgent can be created with a factory-provided client."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent
        from src.workers.agents.development.config import DevelopmentConfig
        from src.infrastructure.llm.base_client import BaseLLMClient, LLMResponse

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock(return_value=LLMResponse(
            content='{"passed": true, "issues": [], "suggestions": [], "security_concerns": []}',
            model="test-model",
        ))
        mock_client.model = "test-model"
        mock_client.model_name = "test-model"

        from src.workers.agents.backends.llm_backend import LLMAgentBackend
        backend = LLMAgentBackend(llm_client=mock_client)

        config = DevelopmentConfig()

        agent = ReviewerAgent(
            backend=backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "reviewer"


class TestCreateDevelopmentAgentFromFactory:
    """Tests for creating development agents from LLMClientFactory."""

    @pytest.mark.asyncio
    async def test_create_utest_agent_from_factory(
        self,
        mock_artifact_writer,
    ) -> None:
        """Test creating UTestAgent using the factory."""
        from src.workers.agents.development.agent_factory import create_utest_agent
        from src.infrastructure.llm.base_client import BaseLLMClient, LLMResponse
        from unittest.mock import AsyncMock, MagicMock

        # Mock the factory
        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock()
        mock_client.model = "test-model"

        mock_factory = MagicMock()
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        agent = await create_utest_agent(
            artifact_writer=mock_artifact_writer,
            factory=mock_factory,
        )

        assert agent.agent_type == "utest"
        mock_factory.get_client.assert_called_once_with("utest")

    @pytest.mark.asyncio
    async def test_create_coding_agent_from_factory(
        self,
        mock_artifact_writer,
    ) -> None:
        """Test creating CodingAgent using the factory."""
        from src.workers.agents.development.agent_factory import create_coding_agent
        from src.infrastructure.llm.base_client import BaseLLMClient
        from unittest.mock import AsyncMock, MagicMock

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock()
        mock_client.model = "test-model"

        mock_factory = MagicMock()
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        agent = await create_coding_agent(
            artifact_writer=mock_artifact_writer,
            factory=mock_factory,
        )

        assert agent.agent_type == "coding"
        mock_factory.get_client.assert_called_once_with("coding")

    @pytest.mark.asyncio
    async def test_create_debugger_agent_from_factory(
        self,
        mock_artifact_writer,
    ) -> None:
        """Test creating DebuggerAgent using the factory."""
        from src.workers.agents.development.agent_factory import create_debugger_agent
        from src.infrastructure.llm.base_client import BaseLLMClient
        from unittest.mock import AsyncMock, MagicMock

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock()
        mock_client.model = "test-model"

        mock_factory = MagicMock()
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        agent = await create_debugger_agent(
            artifact_writer=mock_artifact_writer,
            factory=mock_factory,
        )

        assert agent.agent_type == "debugger"
        mock_factory.get_client.assert_called_once_with("debugger")

    @pytest.mark.asyncio
    async def test_create_reviewer_agent_from_factory(
        self,
        mock_artifact_writer,
    ) -> None:
        """Test creating ReviewerAgent using the factory."""
        from src.workers.agents.development.agent_factory import create_reviewer_agent
        from src.infrastructure.llm.base_client import BaseLLMClient
        from unittest.mock import AsyncMock, MagicMock

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock()
        mock_client.model = "test-model"

        mock_factory = MagicMock()
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        agent = await create_reviewer_agent(
            artifact_writer=mock_artifact_writer,
            factory=mock_factory,
        )

        assert agent.agent_type == "reviewer"
        mock_factory.get_client.assert_called_once_with("reviewer")

    @pytest.mark.asyncio
    async def test_create_agent_uses_global_factory_when_none_provided(
        self,
        mock_artifact_writer,
    ) -> None:
        """Test that create functions use global factory when none provided."""
        from src.workers.agents.development.agent_factory import create_utest_agent
        from src.infrastructure.llm.base_client import BaseLLMClient
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_client = MagicMock(spec=BaseLLMClient)
        mock_client.generate = AsyncMock()
        mock_client.model = "test-model"

        mock_factory = MagicMock()
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        with patch(
            "src.workers.agents.development.agent_factory.get_llm_client_factory",
            return_value=mock_factory,
        ):
            agent = await create_utest_agent(artifact_writer=mock_artifact_writer)

        assert agent.agent_type == "utest"

    @pytest.mark.asyncio
    async def test_create_agent_fallback_on_factory_error(
        self,
        mock_artifact_writer,
    ) -> None:
        """Test that create functions fall back to stub client on factory error."""
        from src.workers.agents.development.agent_factory import create_utest_agent
        from src.infrastructure.llm.factory import LLMClientError
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_factory = MagicMock()
        mock_factory.get_client = AsyncMock(
            side_effect=LLMClientError("No API key configured")
        )

        with patch(
            "src.workers.agents.development.agent_factory.get_llm_client_factory",
            return_value=mock_factory,
        ):
            # Should not raise, should fall back to stub
            agent = await create_utest_agent(
                artifact_writer=mock_artifact_writer,
                fallback_to_stub=True,
            )

        assert agent.agent_type == "utest"
