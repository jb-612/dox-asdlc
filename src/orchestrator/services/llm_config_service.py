"""LLM Configuration Service.

This module provides the service layer for managing LLM providers,
API keys, and per-agent model configurations. Data is stored in Redis.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from src.orchestrator.api.models.llm_config import (
    AgentConfigUpdate,
    AgentLLMConfig,
    AgentRole,
    AgentSettings,
    APIKey,
    APIKeyCreate,
    LLMModel,
    LLMProvider,
)
from src.orchestrator.utils.encryption import EncryptionService


logger = logging.getLogger(__name__)


# Redis key patterns
REDIS_KEY_PREFIX = "llm:keys:"
REDIS_AGENT_PREFIX = "llm:agents:"
REDIS_MODELS_PREFIX = "llm:models:"

# Cache TTL for discovered models (24 hours)
MODELS_CACHE_TTL = 86400


# Static model definitions per provider
ANTHROPIC_MODELS = [
    LLMModel(
        id="claude-opus-4-20250514",
        name="Claude Opus 4",
        provider=LLMProvider.ANTHROPIC,
        context_window=200000,
        max_output=32768,
        capabilities=["vision", "tools", "code", "extended-thinking"],
    ),
    LLMModel(
        id="claude-sonnet-4-20250514",
        name="Claude Sonnet 4",
        provider=LLMProvider.ANTHROPIC,
        context_window=200000,
        max_output=16384,
        capabilities=["vision", "tools", "code"],
    ),
    LLMModel(
        id="claude-3-5-haiku-20241022",
        name="Claude 3.5 Haiku",
        provider=LLMProvider.ANTHROPIC,
        context_window=200000,
        max_output=8192,
        capabilities=["vision", "tools", "code"],
    ),
]

OPENAI_MODELS = [
    LLMModel(
        id="gpt-4-turbo",
        name="GPT-4 Turbo",
        provider=LLMProvider.OPENAI,
        context_window=128000,
        max_output=4096,
        capabilities=["vision", "tools", "code"],
    ),
    LLMModel(
        id="gpt-4",
        name="GPT-4",
        provider=LLMProvider.OPENAI,
        context_window=8192,
        max_output=4096,
        capabilities=["tools", "code"],
    ),
    LLMModel(
        id="gpt-4o",
        name="GPT-4o",
        provider=LLMProvider.OPENAI,
        context_window=128000,
        max_output=16384,
        capabilities=["vision", "tools", "code"],
    ),
    LLMModel(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider=LLMProvider.OPENAI,
        context_window=128000,
        max_output=16384,
        capabilities=["vision", "tools", "code"],
    ),
]

GOOGLE_MODELS = [
    LLMModel(
        id="gemini-2.0-flash",
        name="Gemini 2.0 Flash",
        provider=LLMProvider.GOOGLE,
        context_window=1000000,
        max_output=8192,
        capabilities=["vision", "tools", "code"],
    ),
    LLMModel(
        id="gemini-1.5-pro",
        name="Gemini 1.5 Pro",
        provider=LLMProvider.GOOGLE,
        context_window=2000000,
        max_output=8192,
        capabilities=["vision", "tools", "code"],
    ),
    LLMModel(
        id="gemini-1.5-flash",
        name="Gemini 1.5 Flash",
        provider=LLMProvider.GOOGLE,
        context_window=1000000,
        max_output=8192,
        capabilities=["vision", "tools", "code"],
    ),
]

MODELS_BY_PROVIDER = {
    LLMProvider.ANTHROPIC: ANTHROPIC_MODELS,
    LLMProvider.OPENAI: OPENAI_MODELS,
    LLMProvider.GOOGLE: GOOGLE_MODELS,
}


# Valid agent roles for import validation
VALID_ROLES = {role.value for role in AgentRole}


# Default agent configurations
def _get_default_config(role: AgentRole) -> AgentLLMConfig:
    """Get default configuration for an agent role."""
    return AgentLLMConfig(
        role=role,
        provider=LLMProvider.ANTHROPIC,
        model="claude-sonnet-4-20250514",
        api_key_id="",  # No key configured
        settings=AgentSettings(),
        enabled=True,
    )


class LLMConfigService:
    """Service for managing LLM configurations.

    Provides CRUD operations for API keys and agent configurations,
    with data stored in Redis.

    Usage:
        service = LLMConfigService()
        providers = await service.get_providers()
        models = await service.get_models(LLMProvider.ANTHROPIC)

        key = await service.add_key(APIKeyCreate(...))
        keys = await service.get_keys()

        config = await service.get_agent_config(AgentRole.CODING)
        await service.update_agent_config(config)
    """

    def __init__(self, redis_client: redis.Redis | None = None) -> None:
        """Initialize the LLM config service.

        Args:
            redis_client: Optional Redis client. If not provided, will
                create a default client when needed.
        """
        self._redis_client = redis_client
        self._encryption = EncryptionService()

    async def _get_redis(self) -> redis.Redis:
        """Get or create the Redis client.

        Returns:
            redis.Redis: The Redis client instance.
        """
        if self._redis_client is None:
            import os

            # Support both REDIS_URL and REDIS_HOST/REDIS_PORT
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                redis_host = os.environ.get("REDIS_HOST", "localhost")
                redis_port = os.environ.get("REDIS_PORT", "6379")
                redis_url = f"redis://{redis_host}:{redis_port}"
            self._redis_client = redis.from_url(redis_url)
        return self._redis_client

    async def get_providers(self) -> list[LLMProvider]:
        """Get list of supported LLM providers.

        Returns:
            list[LLMProvider]: List of all supported providers.
        """
        return list(LLMProvider)

    async def get_models(self, provider: LLMProvider) -> list[LLMModel]:
        """Get list of models for a specific provider.

        Args:
            provider: The LLM provider to get models for.

        Returns:
            list[LLMModel]: List of models for the provider.
        """
        return MODELS_BY_PROVIDER.get(provider, [])

    async def add_key(self, key_create: APIKeyCreate) -> APIKey:
        """Add a new API key.

        The key is encrypted before storage and a masked version is returned.

        Args:
            key_create: The key creation request with plaintext key.

        Returns:
            APIKey: The created key with masked key value.
        """
        redis_client = await self._get_redis()

        # Generate unique ID
        key_id = f"key-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        # Encrypt the key
        encrypted = self._encryption.encrypt(key_create.key)
        masked = EncryptionService.mask_key(key_create.key)

        # Store in Redis
        key_data = {
            "id": key_id,
            "provider": key_create.provider.value,
            "name": key_create.name,
            "key_encrypted": encrypted,
            "key_masked": masked,
            "created_at": now.isoformat(),
            "last_used": None,
            "is_valid": True,  # Assume valid until tested
        }

        await redis_client.set(
            f"{REDIS_KEY_PREFIX}{key_id}",
            json.dumps(key_data),
        )

        return APIKey(
            id=key_id,
            provider=key_create.provider,
            name=key_create.name,
            key_masked=masked,
            created_at=now,
            last_used=None,
            is_valid=True,
        )

    async def get_keys(self) -> list[APIKey]:
        """Get all API keys (masked).

        Returns:
            list[APIKey]: List of all stored keys with masked values.
        """
        redis_client = await self._get_redis()

        # Find all key entries
        keys_pattern = f"{REDIS_KEY_PREFIX}*"
        key_names = await redis_client.keys(keys_pattern)

        if not key_names:
            return []

        result = []
        for key_name in key_names:
            data = await redis_client.get(key_name)
            if data:
                key_dict = json.loads(data)
                result.append(
                    APIKey(
                        id=key_dict["id"],
                        provider=LLMProvider(key_dict["provider"]),
                        name=key_dict["name"],
                        key_masked=key_dict["key_masked"],
                        created_at=datetime.fromisoformat(key_dict["created_at"]),
                        last_used=(
                            datetime.fromisoformat(key_dict["last_used"])
                            if key_dict.get("last_used")
                            else None
                        ),
                        is_valid=key_dict.get("is_valid", True),
                    )
                )

        return result

    async def delete_key(self, key_id: str) -> bool:
        """Delete an API key.

        Args:
            key_id: The ID of the key to delete.

        Returns:
            bool: True if the key was deleted, False if not found.
        """
        redis_client = await self._get_redis()
        deleted = await redis_client.delete(f"{REDIS_KEY_PREFIX}{key_id}")
        return deleted > 0

    async def get_decrypted_key(self, key_id: str) -> str | None:
        """Get the decrypted plaintext for an API key.

        This should only be used internally when making API calls.

        Args:
            key_id: The ID of the key to decrypt.

        Returns:
            str | None: The decrypted key or None if not found.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(f"{REDIS_KEY_PREFIX}{key_id}")

        if not data:
            return None

        key_dict = json.loads(data)
        encrypted = key_dict.get("key_encrypted")

        if not encrypted:
            return None

        return self._encryption.decrypt(encrypted)

    async def _get_key_data(self, key_id: str) -> dict[str, Any] | None:
        """Get raw key data from Redis.

        Args:
            key_id: The ID of the key.

        Returns:
            dict | None: The key data or None if not found.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(f"{REDIS_KEY_PREFIX}{key_id}")
        if not data:
            return None
        return json.loads(data)

    async def get_agent_config(self, role: AgentRole) -> AgentLLMConfig:
        """Get configuration for a specific agent role.

        If no configuration is stored, returns a default configuration.

        Args:
            role: The agent role to get configuration for.

        Returns:
            AgentLLMConfig: The agent's configuration.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(f"{REDIS_AGENT_PREFIX}{role.value}")

        if not data:
            return _get_default_config(role)

        config_dict = json.loads(data)
        return AgentLLMConfig(
            role=AgentRole(config_dict["role"]),
            provider=LLMProvider(config_dict["provider"]),
            model=config_dict["model"],
            api_key_id=config_dict["api_key_id"],
            settings=AgentSettings(**config_dict.get("settings", {})),
            enabled=config_dict.get("enabled", True),
        )

    async def get_all_agent_configs(self) -> list[AgentLLMConfig]:
        """Get configurations for all agent roles.

        Returns default configurations for any roles not explicitly configured.

        Returns:
            list[AgentLLMConfig]: List of configurations for all roles.
        """
        configs = []
        for role in AgentRole:
            config = await self.get_agent_config(role)
            configs.append(config)
        return configs

    async def update_agent_config(self, config: AgentLLMConfig) -> AgentLLMConfig:
        """Update configuration for an agent role.

        Args:
            config: The new configuration to store.

        Returns:
            AgentLLMConfig: The stored configuration.
        """
        redis_client = await self._get_redis()

        config_dict = {
            "role": config.role.value,
            "provider": config.provider.value,
            "model": config.model,
            "api_key_id": config.api_key_id,
            "settings": config.settings.model_dump(),
            "enabled": config.enabled,
        }

        await redis_client.set(
            f"{REDIS_AGENT_PREFIX}{config.role.value}",
            json.dumps(config_dict),
        )

        return config

    async def partial_update_agent_config(
        self,
        role: AgentRole,
        update: AgentConfigUpdate,
    ) -> AgentLLMConfig:
        """Partially update configuration for an agent role.

        Only fields that are not None in the update will be changed.
        This allows the frontend to send partial updates without needing
        to provide the full configuration.

        Args:
            role: The agent role to update.
            update: Partial configuration update with only fields to change.

        Returns:
            AgentLLMConfig: The updated configuration.
        """
        # Get existing config
        existing = await self.get_agent_config(role)

        # Merge update into existing config
        if update.provider is not None:
            existing = AgentLLMConfig(
                role=existing.role,
                provider=update.provider,
                model=existing.model,
                api_key_id=existing.api_key_id,
                settings=existing.settings,
                enabled=existing.enabled,
            )
        if update.model is not None:
            existing = AgentLLMConfig(
                role=existing.role,
                provider=existing.provider,
                model=update.model,
                api_key_id=existing.api_key_id,
                settings=existing.settings,
                enabled=existing.enabled,
            )
        if update.api_key_id is not None:
            existing = AgentLLMConfig(
                role=existing.role,
                provider=existing.provider,
                model=existing.model,
                api_key_id=update.api_key_id,
                settings=existing.settings,
                enabled=existing.enabled,
            )
        if update.enabled is not None:
            existing = AgentLLMConfig(
                role=existing.role,
                provider=existing.provider,
                model=existing.model,
                api_key_id=existing.api_key_id,
                settings=existing.settings,
                enabled=update.enabled,
            )
        if update.settings is not None:
            existing = AgentLLMConfig(
                role=existing.role,
                provider=existing.provider,
                model=existing.model,
                api_key_id=existing.api_key_id,
                settings=update.settings,
                enabled=existing.enabled,
            )

        # Save the updated config
        return await self.update_agent_config(existing)

    # =========================================================================
    # Model Discovery and Caching
    # =========================================================================

    async def get_cached_models(self, key_id: str) -> list[dict[str, Any]]:
        """Get models from cache or discover if stale.

        Args:
            key_id: The ID of the API key.

        Returns:
            list[dict]: List of discovered models.

        Raises:
            KeyError: If the API key doesn't exist.
        """
        redis_client = await self._get_redis()
        cache_key = f"{REDIS_MODELS_PREFIX}{key_id}"

        # Check cache first
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

        # Not cached, discover and cache
        return await self.discover_and_cache_models(key_id)

    async def discover_and_cache_models(self, key_id: str) -> list[dict[str, Any]]:
        """Discover models and cache for 24 hours.

        Args:
            key_id: The ID of the API key to use for discovery.

        Returns:
            list[dict]: List of discovered models.

        Raises:
            KeyError: If the API key doesn't exist.
        """
        redis_client = await self._get_redis()

        # Get the key data
        key_data = await self._get_key_data(key_id)
        if not key_data:
            raise KeyError(f"API key not found: {key_id}")

        # Decrypt the key
        encrypted = key_data.get("key_encrypted")
        if not encrypted:
            raise KeyError(f"API key has no encrypted value: {key_id}")

        decrypted_key = self._encryption.decrypt(encrypted)
        provider = key_data.get("provider", "")

        # Discover models
        from src.infrastructure.llm.model_discovery import ModelDiscoveryService

        discovery = ModelDiscoveryService()
        discovered_models = await discovery.discover_models(provider, decrypted_key)

        # Convert to dict list for JSON serialization
        models_list = [m.to_dict() for m in discovered_models]

        # Cache with TTL
        cache_key = f"{REDIS_MODELS_PREFIX}{key_id}"
        await redis_client.setex(cache_key, MODELS_CACHE_TTL, json.dumps(models_list))

        return models_list

    # =========================================================================
    # Config Export/Import
    # =========================================================================

    async def export_config(self) -> dict[str, Any]:
        """Export full LLM configuration as JSON.

        Returns:
            dict: Full configuration including agents and key IDs.
        """
        # Get all keys (just IDs, not the actual keys)
        keys = await self.get_keys()
        key_ids = [k.id for k in keys]

        # Get all agent configs
        agents = {}
        for role in AgentRole:
            config = await self.get_agent_config(role)
            agents[role.value] = {
                "provider": config.provider.value,
                "model": config.model,
                "api_key_id": config.api_key_id,
                "temperature": config.settings.temperature,
                "max_tokens": config.settings.max_tokens,
                "top_p": config.settings.top_p,
                "top_k": config.settings.top_k,
                "enabled": config.enabled,
            }

        return {
            "agents": agents,
            "keys": key_ids,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }

    async def import_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """Import configuration from JSON.

        Args:
            config: Configuration dict with agents section.

        Returns:
            dict: Import result with success status.

        Raises:
            ValueError: If config structure is invalid.
        """
        if "agents" not in config:
            raise ValueError("Config must contain 'agents' section")

        agents_config = config.get("agents", {})
        imported_count = 0

        for role_str, agent_config in agents_config.items():
            # Validate role
            if role_str not in VALID_ROLES:
                raise ValueError(f"Invalid agent role: {role_str}")

            try:
                role = AgentRole(role_str)
                provider = LLMProvider(agent_config.get("provider", "anthropic"))

                # Build settings
                settings = AgentSettings(
                    temperature=agent_config.get("temperature", 0.2),
                    max_tokens=agent_config.get("max_tokens", 16384),
                    top_p=agent_config.get("top_p"),
                    top_k=agent_config.get("top_k"),
                )

                # Create config
                new_config = AgentLLMConfig(
                    role=role,
                    provider=provider,
                    model=agent_config.get("model", "claude-sonnet-4-20250514"),
                    api_key_id=agent_config.get("api_key_id", ""),
                    settings=settings,
                    enabled=agent_config.get("enabled", True),
                )

                await self.update_agent_config(new_config)
                imported_count += 1

            except (ValueError, KeyError) as e:
                raise ValueError(f"Invalid config for {role_str}: {e}") from e

        return {
            "imported": True,
            "agents": imported_count,
        }

    # =========================================================================
    # API Key Testing
    # =========================================================================

    async def test_api_key(self, key_id: str) -> dict[str, Any]:
        """Test an API key by making a minimal API call to the provider.

        This method decrypts the key, attempts to list models from the provider,
        and updates the key's validity status based on the result.

        Args:
            key_id: The ID of the API key to test.

        Returns:
            dict: Test result with success, message, and models_discovered fields.

        Raises:
            KeyError: If the API key doesn't exist.
        """
        redis_client = await self._get_redis()

        # Get the key data
        key_data = await self._get_key_data(key_id)
        if not key_data:
            raise KeyError(f"API key not found: {key_id}")

        # Decrypt the key
        encrypted = key_data.get("key_encrypted")
        if not encrypted:
            raise KeyError(f"API key has no encrypted value: {key_id}")

        decrypted_key = self._encryption.decrypt(encrypted)
        provider = key_data.get("provider", "")

        # Test the key by trying to discover models
        from src.infrastructure.llm.model_discovery import ModelDiscoveryService

        discovery = ModelDiscoveryService()

        try:
            discovered_models = await discovery.discover_models(provider, decrypted_key)
            models_count = len(discovered_models)

            # Key is valid - update status
            is_valid = models_count > 0

            # Update key validity in Redis
            key_data["is_valid"] = is_valid
            await redis_client.set(
                f"{REDIS_KEY_PREFIX}{key_id}",
                json.dumps(key_data),
            )

            if is_valid:
                return {
                    "success": True,
                    "message": f"Key is valid. Discovered {models_count} models.",
                    "models_discovered": models_count,
                }
            else:
                return {
                    "success": False,
                    "message": "Invalid API key: No models discovered. The key may be invalid or have insufficient permissions.",
                    "models_discovered": 0,
                }

        except Exception as e:
            # Key test failed - update status
            key_data["is_valid"] = False
            await redis_client.set(
                f"{REDIS_KEY_PREFIX}{key_id}",
                json.dumps(key_data),
            )

            error_msg = str(e)
            if "401" in error_msg or "unauthorized" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Invalid API key: Authentication failed",
                    "models_discovered": 0,
                }
            elif "429" in error_msg or "rate" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Provider error: Rate limit exceeded",
                    "models_discovered": 0,
                }
            else:
                return {
                    "success": False,
                    "message": f"Provider error: {error_msg}",
                    "models_discovered": 0,
                }

    # =========================================================================
    # Agent Connection Testing
    # =========================================================================

    async def test_agent_connection(self, role: AgentRole) -> dict[str, Any]:
        """Test LLM connectivity for a specific agent role.

        This method retrieves the agent's configuration, creates an LLM client,
        and makes a simple test call to verify connectivity. Latency is measured.

        Args:
            role: The agent role to test.

        Returns:
            dict: Test result with success, message, and latency_ms fields.
        """
        # Get agent config
        config = await self.get_agent_config(role)

        # Check if agent is enabled
        if not config.enabled:
            return {
                "success": False,
                "message": f"Agent '{role.value}' is disabled",
                "latency_ms": None,
            }

        # Check if API key is configured
        if not config.api_key_id:
            return {
                "success": False,
                "message": f"Agent '{role.value}' has no API key configured",
                "latency_ms": None,
            }

        # Get the LLM client using the factory
        from src.infrastructure.llm.factory import (
            LLMClientFactory,
            LLMClientError,
        )

        factory = LLMClientFactory(config_service=self)

        try:
            # Create the client
            client = await factory.get_client(role)

            # Make a simple test call and measure latency
            start_time = time.perf_counter()
            await client.generate(
                prompt="Say hello",
                max_tokens=10,
            )
            end_time = time.perf_counter()

            latency_ms = (end_time - start_time) * 1000

            return {
                "success": True,
                "message": f"Connection successful. Model responded in {latency_ms:.0f}ms.",
                "latency_ms": round(latency_ms, 1),
            }

        except LLMClientError as e:
            error_msg = str(e)
            if "no api key" in error_msg.lower():
                return {
                    "success": False,
                    "message": f"Agent '{role.value}' has no API key configured",
                    "latency_ms": None,
                }
            elif "disabled" in error_msg.lower():
                return {
                    "success": False,
                    "message": f"Agent '{role.value}' is disabled",
                    "latency_ms": None,
                }
            else:
                return {
                    "success": False,
                    "message": f"Configuration error: {error_msg}",
                    "latency_ms": None,
                }

        except Exception as e:
            error_msg = str(e).strip()

            # Try to extract more details from the exception
            if not error_msg:
                # Check for common exception attributes
                if hasattr(e, "message"):
                    error_msg = str(e.message).strip()
                elif hasattr(e, "reason"):
                    error_msg = str(e.reason).strip()
                elif hasattr(e, "args") and e.args:
                    error_msg = str(e.args[0]).strip()

            # If still empty, use exception type name
            if not error_msg:
                error_msg = f"{type(e).__name__}: Unknown error"

            if "401" in error_msg or "unauthorized" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Authentication failed: Invalid API key",
                    "latency_ms": None,
                }
            elif "403" in error_msg or "forbidden" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Authentication failed: API key lacks required permissions",
                    "latency_ms": None,
                }
            elif "api key" in error_msg.lower() and "invalid" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Authentication failed: Invalid API key",
                    "latency_ms": None,
                }
            elif "timeout" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Connection timed out after 30 seconds",
                    "latency_ms": None,
                }
            elif "429" in error_msg or "rate" in error_msg.lower():
                return {
                    "success": False,
                    "message": "Provider error: Rate limit exceeded",
                    "latency_ms": None,
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed: {error_msg}",
                    "latency_ms": None,
                }


# Global service instance
_llm_config_service: LLMConfigService | None = None


def get_llm_config_service() -> LLMConfigService:
    """Get the singleton LLM config service instance.

    Returns:
        LLMConfigService: The service instance.
    """
    global _llm_config_service
    if _llm_config_service is None:
        _llm_config_service = LLMConfigService()
    return _llm_config_service
