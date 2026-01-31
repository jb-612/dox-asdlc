"""Unit tests for LLM Client Factory.

Tests the LLMClientFactory class for creating configured LLM clients
based on agent role and admin configuration.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.llm.factory import LLMClientFactory, LLMClientError
from src.infrastructure.llm.base_client import BaseLLMClient
from src.orchestrator.api.models.llm_config import (
    AgentLLMConfig,
    AgentRole,
    AgentSettings,
    LLMProvider,
)


class TestLLMClientFactoryInit:
    """Tests for LLMClientFactory initialization."""

    def test_init_creates_instance(self) -> None:
        """Test factory can be instantiated."""
        factory = LLMClientFactory()
        assert factory is not None

    def test_init_with_config_service(self) -> None:
        """Test factory can be instantiated with custom config service."""
        mock_service = MagicMock()
        factory = LLMClientFactory(config_service=mock_service)
        assert factory._config_service is mock_service


class TestGetClient:
    """Tests for get_client method."""

    @pytest.fixture
    def mock_config_service(self) -> MagicMock:
        """Create a mock config service."""
        service = MagicMock()
        service.get_agent_config = AsyncMock()
        service.get_decrypted_key = AsyncMock()
        return service

    @pytest.fixture
    def factory(self, mock_config_service: MagicMock) -> LLMClientFactory:
        """Create a factory with mock service."""
        return LLMClientFactory(config_service=mock_config_service)

    @pytest.mark.asyncio
    async def test_get_client_returns_anthropic_client(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory returns AnthropicClient for Anthropic provider."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(temperature=0.3, max_tokens=4096),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "sk-ant-test-key"

        client = await factory.get_client(AgentRole.DISCOVERY)

        assert client is not None
        assert client.provider == "anthropic"
        assert client.model == "claude-sonnet-4-20250514"
        mock_config_service.get_agent_config.assert_called_once_with(AgentRole.DISCOVERY)
        mock_config_service.get_decrypted_key.assert_called_once_with("key-123")

    @pytest.mark.asyncio
    async def test_get_client_returns_openai_client(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory returns OpenAIClient for OpenAI provider."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.CODING,
            provider=LLMProvider.OPENAI,
            model="gpt-4-turbo",
            api_key_id="key-456",
            settings=AgentSettings(temperature=0.2),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "sk-openai-test-key"

        client = await factory.get_client(AgentRole.CODING)

        assert client is not None
        assert client.provider == "openai"
        assert client.model == "gpt-4-turbo"

    @pytest.mark.asyncio
    async def test_get_client_returns_google_client(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory returns GoogleClient for Google provider."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DESIGN,
            provider=LLMProvider.GOOGLE,
            model="gemini-1.5-pro",
            api_key_id="key-789",
            settings=AgentSettings(temperature=0.4),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "google-api-key"

        client = await factory.get_client(AgentRole.DESIGN)

        assert client is not None
        assert client.provider == "google"
        assert client.model == "gemini-1.5-pro"

    @pytest.mark.asyncio
    async def test_get_client_uses_config_settings(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory passes config settings to client."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.UTEST,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(temperature=0.5, max_tokens=8192, top_p=0.9),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "sk-ant-test-key"

        client = await factory.get_client(AgentRole.UTEST)

        assert client.temperature == 0.5
        assert client.max_tokens == 8192

    @pytest.mark.asyncio
    async def test_get_client_raises_error_when_config_not_found(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory raises error when no config found for role."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="",  # No API key configured
            settings=AgentSettings(),
            enabled=True,
        )

        with pytest.raises(LLMClientError) as exc_info:
            await factory.get_client(AgentRole.DISCOVERY)

        assert "No API key configured" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_client_raises_error_when_key_not_found(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory raises error when API key not found."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = None

        with pytest.raises(LLMClientError) as exc_info:
            await factory.get_client(AgentRole.DISCOVERY)

        assert "API key not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_client_raises_error_when_disabled(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory raises error when agent is disabled."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(),
            enabled=False,
        )

        with pytest.raises(LLMClientError) as exc_info:
            await factory.get_client(AgentRole.DISCOVERY)

        assert "disabled" in str(exc_info.value).lower()


class TestClientCaching:
    """Tests for client caching behavior."""

    @pytest.fixture
    def mock_config_service(self) -> MagicMock:
        """Create a mock config service."""
        service = MagicMock()
        service.get_agent_config = AsyncMock()
        service.get_decrypted_key = AsyncMock()
        return service

    @pytest.fixture
    def factory(self, mock_config_service: MagicMock) -> LLMClientFactory:
        """Create a factory with mock service."""
        return LLMClientFactory(config_service=mock_config_service)

    @pytest.mark.asyncio
    async def test_get_client_caches_clients(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test factory caches clients per role."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "sk-ant-test-key"

        client1 = await factory.get_client(AgentRole.DISCOVERY)
        client2 = await factory.get_client(AgentRole.DISCOVERY)

        # Should return the same cached instance
        assert client1 is client2
        # Should only call config service once
        assert mock_config_service.get_agent_config.call_count == 1

    @pytest.mark.asyncio
    async def test_different_roles_get_different_clients(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test different roles get different cached clients."""
        mock_config_service.get_agent_config.side_effect = [
            AgentLLMConfig(
                role=AgentRole.DISCOVERY,
                provider=LLMProvider.ANTHROPIC,
                model="claude-sonnet-4-20250514",
                api_key_id="key-123",
                settings=AgentSettings(),
                enabled=True,
            ),
            AgentLLMConfig(
                role=AgentRole.CODING,
                provider=LLMProvider.ANTHROPIC,
                model="claude-sonnet-4-20250514",
                api_key_id="key-123",
                settings=AgentSettings(temperature=0.5),
                enabled=True,
            ),
        ]
        mock_config_service.get_decrypted_key.return_value = "sk-ant-test-key"

        client1 = await factory.get_client(AgentRole.DISCOVERY)
        client2 = await factory.get_client(AgentRole.CODING)

        # Should return different instances
        assert client1 is not client2
        # Should call config service twice
        assert mock_config_service.get_agent_config.call_count == 2

    @pytest.mark.asyncio
    async def test_clear_cache_removes_cached_clients(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test clear_cache removes all cached clients."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "sk-ant-test-key"

        client1 = await factory.get_client(AgentRole.DISCOVERY)
        factory.clear_cache()
        client2 = await factory.get_client(AgentRole.DISCOVERY)

        # Should return different instances after cache clear
        assert client1 is not client2
        # Should call config service twice
        assert mock_config_service.get_agent_config.call_count == 2


class TestGetClientForRole:
    """Tests for get_client_for_role helper method."""

    @pytest.fixture
    def mock_config_service(self) -> MagicMock:
        """Create a mock config service."""
        service = MagicMock()
        service.get_agent_config = AsyncMock()
        service.get_decrypted_key = AsyncMock()
        return service

    @pytest.fixture
    def factory(self, mock_config_service: MagicMock) -> LLMClientFactory:
        """Create a factory with mock service."""
        return LLMClientFactory(config_service=mock_config_service)

    @pytest.mark.asyncio
    async def test_get_client_accepts_string_role(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test get_client accepts string role name."""
        mock_config_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.DISCOVERY,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-123",
            settings=AgentSettings(),
            enabled=True,
        )
        mock_config_service.get_decrypted_key.return_value = "sk-ant-test-key"

        client = await factory.get_client("discovery")

        assert client is not None
        assert client.provider == "anthropic"

    @pytest.mark.asyncio
    async def test_get_client_raises_error_for_invalid_role(
        self,
        factory: LLMClientFactory,
        mock_config_service: MagicMock,
    ) -> None:
        """Test get_client raises error for invalid role string."""
        with pytest.raises(LLMClientError) as exc_info:
            await factory.get_client("invalid_role")

        assert "Invalid agent role" in str(exc_info.value)


class TestBaseLLMClientInterface:
    """Tests for BaseLLMClient interface compliance."""

    def test_base_client_has_required_properties(self) -> None:
        """Test BaseLLMClient has required properties."""
        # BaseLLMClient is abstract, test via checking protocol
        from src.infrastructure.llm.base_client import BaseLLMClient

        # Check required abstract methods exist
        assert hasattr(BaseLLMClient, "generate")
        assert hasattr(BaseLLMClient, "generate_stream")

    def test_base_client_has_provider_property(self) -> None:
        """Test BaseLLMClient has provider property."""
        from src.infrastructure.llm.base_client import BaseLLMClient

        assert hasattr(BaseLLMClient, "provider")

    def test_base_client_has_model_property(self) -> None:
        """Test BaseLLMClient has model property."""
        from src.infrastructure.llm.base_client import BaseLLMClient

        assert hasattr(BaseLLMClient, "model")
