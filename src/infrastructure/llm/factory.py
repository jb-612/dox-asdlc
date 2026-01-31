"""LLM Client Factory.

This module provides a factory for creating configured LLM clients
based on agent role and admin configuration.
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

from src.core.exceptions import ASDLCError
from src.infrastructure.llm.base_client import BaseLLMClient
from src.orchestrator.api.models.llm_config import (
    AgentLLMConfig,
    AgentRole,
    LLMProvider,
)

if TYPE_CHECKING:
    from src.orchestrator.services.llm_config_service import LLMConfigService


logger = logging.getLogger(__name__)


class LLMClientError(ASDLCError):
    """Raised when LLM client operations fail."""

    pass


class LLMClientFactory:
    """Factory for creating LLM clients based on agent configuration.

    Reads configuration from LLMConfigService and creates appropriate
    client instances for each agent role. Caches clients per role to
    avoid recreating them.

    Usage:
        factory = LLMClientFactory()
        client = await factory.get_client(AgentRole.DISCOVERY)
        response = await client.generate(prompt="Hello")

    Example with string role:
        client = await factory.get_client("discovery")
    """

    def __init__(
        self,
        config_service: LLMConfigService | None = None,
    ) -> None:
        """Initialize the factory.

        Args:
            config_service: Optional LLMConfigService instance. If not provided,
                will use the global singleton.
        """
        self._config_service = config_service
        self._client_cache: dict[AgentRole, BaseLLMClient] = {}

    def _get_config_service(self) -> LLMConfigService:
        """Get the config service, creating if needed.

        Returns:
            LLMConfigService: The config service instance.
        """
        if self._config_service is None:
            from src.orchestrator.services.llm_config_service import (
                get_llm_config_service,
            )

            self._config_service = get_llm_config_service()
        return self._config_service

    async def get_client(
        self,
        role: AgentRole | str,
    ) -> BaseLLMClient:
        """Get a configured LLM client for the given agent role.

        Creates a new client if not cached, or returns the cached instance.

        Args:
            role: The agent role (AgentRole enum or string).

        Returns:
            BaseLLMClient: Configured LLM client for the role.

        Raises:
            LLMClientError: If role is invalid, config is missing, or API key not found.
        """
        # Convert string to AgentRole if needed
        if isinstance(role, str):
            try:
                role = AgentRole(role)
            except ValueError as e:
                raise LLMClientError(f"Invalid agent role: {role}") from e

        # Check cache first
        if role in self._client_cache:
            return self._client_cache[role]

        # Get config from service
        config_service = self._get_config_service()
        config = await config_service.get_agent_config(role)

        # Validate config
        if not config.enabled:
            raise LLMClientError(f"Agent {role.value} is disabled in configuration")

        if not config.api_key_id:
            raise LLMClientError(f"No API key configured for agent {role.value}")

        # Get decrypted API key
        api_key = await config_service.get_decrypted_key(config.api_key_id)
        if not api_key:
            raise LLMClientError(f"API key not found: {config.api_key_id}")

        # Create the appropriate client
        client = self._create_client(config, api_key)

        # Cache and return
        self._client_cache[role] = client
        logger.info(f"Created LLM client for {role.value}: {config.provider.value}/{config.model}")

        return client

    def _create_client(
        self,
        config: AgentLLMConfig,
        api_key: str,
    ) -> BaseLLMClient:
        """Create a client instance based on provider.

        Args:
            config: Agent LLM configuration.
            api_key: Decrypted API key.

        Returns:
            BaseLLMClient: The created client instance.

        Raises:
            LLMClientError: If provider is not supported.
        """
        if config.provider == LLMProvider.ANTHROPIC:
            from src.infrastructure.llm.clients.anthropic_client import AnthropicClient

            return AnthropicClient(
                api_key=api_key,
                model=config.model,
                temperature=config.settings.temperature,
                max_tokens=config.settings.max_tokens,
                top_p=config.settings.top_p,
                top_k=config.settings.top_k,
            )
        elif config.provider == LLMProvider.OPENAI:
            from src.infrastructure.llm.clients.openai_client import OpenAIClient

            return OpenAIClient(
                api_key=api_key,
                model=config.model,
                temperature=config.settings.temperature,
                max_tokens=config.settings.max_tokens,
                top_p=config.settings.top_p,
            )
        elif config.provider == LLMProvider.GOOGLE:
            from src.infrastructure.llm.clients.google_client import GoogleClient

            return GoogleClient(
                api_key=api_key,
                model=config.model,
                temperature=config.settings.temperature,
                max_tokens=config.settings.max_tokens,
                top_p=config.settings.top_p,
                top_k=config.settings.top_k,
            )
        else:
            raise LLMClientError(f"Unsupported provider: {config.provider}")

    def clear_cache(self) -> None:
        """Clear the client cache.

        Useful when configuration has changed and clients need to be recreated.
        """
        self._client_cache.clear()
        logger.info("Cleared LLM client cache")

    def remove_from_cache(self, role: AgentRole) -> bool:
        """Remove a specific role's client from cache.

        Args:
            role: The agent role to remove.

        Returns:
            bool: True if removed, False if not in cache.
        """
        if role in self._client_cache:
            del self._client_cache[role]
            logger.info(f"Removed {role.value} from LLM client cache")
            return True
        return False


# Global factory instance
_llm_client_factory: LLMClientFactory | None = None


def get_llm_client_factory() -> LLMClientFactory:
    """Get the global LLM client factory instance.

    Returns:
        LLMClientFactory: The factory instance.
    """
    global _llm_client_factory
    if _llm_client_factory is None:
        _llm_client_factory = LLMClientFactory()
    return _llm_client_factory
