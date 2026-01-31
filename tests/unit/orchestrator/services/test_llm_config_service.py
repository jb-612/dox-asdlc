"""Unit tests for LLM Configuration Service.

Tests the LLMConfigService class for managing API keys and agent configurations
stored in Redis.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.api.models.llm_config import (
    AgentLLMConfig,
    AgentRole,
    AgentSettings,
    APIKey,
    APIKeyCreate,
    LLMModel,
    LLMProvider,
)
from src.orchestrator.services.llm_config_service import (
    LLMConfigService,
    get_llm_config_service,
)


class TestLLMConfigServiceInit:
    """Tests for LLMConfigService initialization."""

    def test_init_with_default_redis_client(self) -> None:
        """Test service can be instantiated with default Redis client."""
        service = LLMConfigService()
        assert service is not None

    def test_init_with_custom_redis_client(self) -> None:
        """Test service can be instantiated with custom Redis client."""
        mock_client = AsyncMock()
        service = LLMConfigService(redis_client=mock_client)
        assert service._redis_client is mock_client


class TestGetProviders:
    """Tests for get_providers method."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance."""
        return LLMConfigService()

    @pytest.mark.asyncio
    async def test_get_providers_returns_all_providers(
        self, service: LLMConfigService
    ) -> None:
        """Test that get_providers returns all supported providers."""
        providers = await service.get_providers()
        
        assert LLMProvider.ANTHROPIC in providers
        assert LLMProvider.OPENAI in providers
        assert LLMProvider.GOOGLE in providers

    @pytest.mark.asyncio
    async def test_get_providers_returns_list(self, service: LLMConfigService) -> None:
        """Test that get_providers returns a list."""
        providers = await service.get_providers()
        assert isinstance(providers, list)


class TestGetModels:
    """Tests for get_models method."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance."""
        return LLMConfigService()

    @pytest.mark.asyncio
    async def test_get_models_anthropic(self, service: LLMConfigService) -> None:
        """Test getting Anthropic models."""
        models = await service.get_models(LLMProvider.ANTHROPIC)
        
        assert len(models) > 0
        assert all(isinstance(m, LLMModel) for m in models)
        assert all(m.provider == LLMProvider.ANTHROPIC for m in models)
        
        # Check for expected models
        model_ids = [m.id for m in models]
        assert "claude-sonnet-4-20250514" in model_ids

    @pytest.mark.asyncio
    async def test_get_models_openai(self, service: LLMConfigService) -> None:
        """Test getting OpenAI models."""
        models = await service.get_models(LLMProvider.OPENAI)
        
        assert len(models) > 0
        assert all(m.provider == LLMProvider.OPENAI for m in models)

    @pytest.mark.asyncio
    async def test_get_models_google(self, service: LLMConfigService) -> None:
        """Test getting Google models."""
        models = await service.get_models(LLMProvider.GOOGLE)
        
        assert len(models) > 0
        assert all(m.provider == LLMProvider.GOOGLE for m in models)


class TestAPIKeyOperations:
    """Tests for API key CRUD operations."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LLMConfigService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_add_key_stores_encrypted(self, service: LLMConfigService) -> None:
        """Test that adding a key stores it encrypted."""
        key_create = APIKeyCreate(
            provider=LLMProvider.ANTHROPIC,
            name="Test Key",
            key="sk-ant-api03-secret-key-12345",
        )
        
        result = await service.add_key(key_create)
        
        assert isinstance(result, APIKey)
        assert result.name == "Test Key"
        assert result.provider == LLMProvider.ANTHROPIC
        assert "..." in result.key_masked  # Key should be masked
        assert "secret" not in result.key_masked  # Original key not exposed
        
        # Verify Redis was called
        service._redis_client.set.assert_called()

    @pytest.mark.asyncio
    async def test_add_key_generates_id(self, service: LLMConfigService) -> None:
        """Test that adding a key generates a unique ID."""
        key_create = APIKeyCreate(
            provider=LLMProvider.OPENAI,
            name="Another Key",
            key="sk-openai-test-key",
        )
        
        result = await service.add_key(key_create)
        
        assert result.id is not None
        assert len(result.id) > 0

    @pytest.mark.asyncio
    async def test_get_keys_returns_list(self, service: LLMConfigService) -> None:
        """Test that get_keys returns a list of API keys."""
        # Mock Redis responses
        service._redis_client.keys.return_value = [
            b"llm:keys:key-1",
            b"llm:keys:key-2",
        ]
        service._redis_client.get.side_effect = [
            json.dumps({
                "id": "key-1",
                "provider": "anthropic",
                "name": "Key 1",
                "key_encrypted": "encrypted-data-1",
                "key_masked": "sk-ant-...123",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_used": None,
                "is_valid": True,
            }),
            json.dumps({
                "id": "key-2",
                "provider": "openai",
                "name": "Key 2",
                "key_encrypted": "encrypted-data-2",
                "key_masked": "sk-...456",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_used": None,
                "is_valid": True,
            }),
        ]
        
        keys = await service.get_keys()
        
        assert len(keys) == 2
        assert all(isinstance(k, APIKey) for k in keys)

    @pytest.mark.asyncio
    async def test_get_keys_empty(self, service: LLMConfigService) -> None:
        """Test that get_keys returns empty list when no keys exist."""
        service._redis_client.keys.return_value = []
        
        keys = await service.get_keys()
        
        assert keys == []

    @pytest.mark.asyncio
    async def test_delete_key_removes_from_redis(
        self, service: LLMConfigService
    ) -> None:
        """Test that delete_key removes the key from Redis."""
        service._redis_client.delete.return_value = 1
        
        result = await service.delete_key("key-123")
        
        assert result is True
        service._redis_client.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_key_not_found(self, service: LLMConfigService) -> None:
        """Test that delete_key returns False when key doesn't exist."""
        service._redis_client.delete.return_value = 0
        
        result = await service.delete_key("nonexistent-key")
        
        assert result is False


class TestAgentConfigOperations:
    """Tests for agent configuration operations."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LLMConfigService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_get_agent_config(self, service: LLMConfigService) -> None:
        """Test getting an agent configuration."""
        service._redis_client.get.return_value = json.dumps({
            "role": "coding",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        })
        
        config = await service.get_agent_config(AgentRole.CODING)
        
        assert config is not None
        assert config.role == AgentRole.CODING
        assert config.provider == LLMProvider.ANTHROPIC

    @pytest.mark.asyncio
    async def test_get_agent_config_not_found_returns_default(
        self, service: LLMConfigService
    ) -> None:
        """Test getting a non-existent agent config returns default."""
        service._redis_client.get.return_value = None
        
        config = await service.get_agent_config(AgentRole.DEBUGGER)
        
        # Should return a default config
        assert config is not None
        assert config.role == AgentRole.DEBUGGER

    @pytest.mark.asyncio
    async def test_get_all_agent_configs(self, service: LLMConfigService) -> None:
        """Test getting all agent configurations."""
        # Mock Redis to return configs for some roles
        def mock_get(key: str) -> str | None:
            if "coding" in key:
                return json.dumps({
                    "role": "coding",
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "api_key_id": "key-1",
                    "settings": {"temperature": 0.2, "max_tokens": 16384},
                    "enabled": True,
                })
            return None
        
        service._redis_client.get.side_effect = mock_get
        
        configs = await service.get_all_agent_configs()
        
        # Should return configs for all roles (defaults for unconfigured)
        assert len(configs) == len(AgentRole)
        assert all(isinstance(c, AgentLLMConfig) for c in configs)

    @pytest.mark.asyncio
    async def test_update_agent_config(self, service: LLMConfigService) -> None:
        """Test updating an agent configuration."""
        config = AgentLLMConfig(
            role=AgentRole.REVIEWER,
            provider=LLMProvider.OPENAI,
            model="gpt-4",
            api_key_id="key-456",
            settings=AgentSettings(temperature=0.3),
            enabled=True,
        )
        
        result = await service.update_agent_config(config)
        
        assert result == config
        service._redis_client.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_agent_config_persists_correctly(
        self, service: LLMConfigService
    ) -> None:
        """Test that updated config is persisted with correct format."""
        config = AgentLLMConfig(
            role=AgentRole.UTEST,
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-20250514",
            api_key_id="key-789",
            settings=AgentSettings(temperature=0.5, max_tokens=8192),
            enabled=False,
        )
        
        await service.update_agent_config(config)
        
        # Check the key and value passed to Redis
        call_args = service._redis_client.set.call_args
        key = call_args[0][0]
        value = json.loads(call_args[0][1])
        
        assert "llm:agents:utest" in key
        assert value["role"] == "utest"
        assert value["provider"] == "anthropic"
        assert value["enabled"] is False


class TestGetDecryptedKey:
    """Tests for get_decrypted_key method."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LLMConfigService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_get_decrypted_key_returns_plaintext(
        self, service: LLMConfigService
    ) -> None:
        """Test that get_decrypted_key returns decrypted plaintext."""
        # First encrypt a key using the service's encryption
        original_key = "sk-ant-api03-secret-key"
        encrypted = service._encryption.encrypt(original_key)
        
        service._redis_client.get.return_value = json.dumps({
            "id": "key-123",
            "provider": "anthropic",
            "name": "Test Key",
            "key_encrypted": encrypted,
            "key_masked": "sk-ant-...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        
        result = await service.get_decrypted_key("key-123")
        
        assert result == original_key

    @pytest.mark.asyncio
    async def test_get_decrypted_key_not_found(
        self, service: LLMConfigService
    ) -> None:
        """Test that get_decrypted_key returns None when key not found."""
        service._redis_client.get.return_value = None
        
        result = await service.get_decrypted_key("nonexistent")
        
        assert result is None


class TestGetLLMConfigService:
    """Tests for get_llm_config_service function."""

    def test_returns_service_instance(self) -> None:
        """Test that function returns a service instance."""
        service = get_llm_config_service()
        assert isinstance(service, LLMConfigService)

    def test_returns_same_instance(self) -> None:
        """Test that function returns the same singleton instance."""
        # Reset the global instance first
        import src.orchestrator.services.llm_config_service as module
        module._llm_config_service = None
        
        service1 = get_llm_config_service()
        service2 = get_llm_config_service()
        
        assert service1 is service2


class TestCachedModels:
    """Tests for model caching methods."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LLMConfigService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_get_cached_models_from_cache(
        self, service: LLMConfigService
    ) -> None:
        """Test getting models from cache."""
        cached_models = [
            {
                "id": "claude-sonnet-4-20250514",
                "name": "Claude Sonnet 4",
                "provider": "anthropic",
                "context_window": 200000,
                "max_output": 16384,
                "capabilities": ["chat", "tools"],
                "deprecated": False,
                "discovered_at": "2026-01-29T10:00:00Z",
            }
        ]
        service._redis_client.get.return_value = json.dumps(cached_models)

        result = await service.get_cached_models("key-123")

        assert len(result) == 1
        assert result[0]["id"] == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_get_cached_models_not_cached(
        self, service: LLMConfigService
    ) -> None:
        """Test get_cached_models triggers discovery when not cached."""
        # First call returns None (not cached), second call returns key data
        key_data = json.dumps({
            "id": "key-123",
            "provider": "anthropic",
            "name": "Test Key",
            "key_encrypted": service._encryption.encrypt("test-api-key"),
            "key_masked": "test-a...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        service._redis_client.get.side_effect = [None, key_data]
        service._redis_client.setex = AsyncMock()

        # Mock the discovery service
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            mock_instance = AsyncMock()
            mock_instance.discover_models.return_value = []
            mock_discovery.return_value = mock_instance

            result = await service.get_cached_models("key-123")

            assert result == []

    @pytest.mark.asyncio
    async def test_get_cached_models_key_not_found(
        self, service: LLMConfigService
    ) -> None:
        """Test get_cached_models raises error when key doesn't exist."""
        # Cache miss and key not found
        service._redis_client.get.side_effect = [None, None]

        with pytest.raises(KeyError):
            await service.get_cached_models("nonexistent")

    @pytest.mark.asyncio
    async def test_discover_and_cache_models(
        self, service: LLMConfigService
    ) -> None:
        """Test discover_and_cache_models stores results."""
        key_data = json.dumps({
            "id": "key-123",
            "provider": "anthropic",
            "name": "Test Key",
            "key_encrypted": service._encryption.encrypt("test-api-key"),
            "key_masked": "test-a...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        service._redis_client.get.return_value = key_data
        service._redis_client.setex = AsyncMock()

        # Mock discovery service
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            from src.infrastructure.llm.model_discovery import DiscoveredModel
            mock_instance = AsyncMock()
            mock_instance.discover_models.return_value = [
                DiscoveredModel(
                    id="claude-sonnet-4-20250514",
                    name="Claude Sonnet 4",
                    provider="anthropic",
                    context_window=200000,
                    max_output=16384,
                    capabilities=["chat", "tools"],
                    deprecated=False,
                    discovered_at="2026-01-29T10:00:00Z",
                )
            ]
            mock_discovery.return_value = mock_instance

            result = await service.discover_and_cache_models("key-123")

            assert len(result) == 1
            # Verify cache was set with 24hr TTL
            service._redis_client.setex.assert_called_once()
            call_args = service._redis_client.setex.call_args
            assert call_args[0][1] == 86400  # 24 hours


class TestExportImportConfig:
    """Tests for config export/import methods."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LLMConfigService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_export_config(self, service: LLMConfigService) -> None:
        """Test exporting full configuration."""
        # Mock keys
        service._redis_client.keys.return_value = [b"llm:keys:key-1"]
        service._redis_client.get.side_effect = [
            # Key data
            json.dumps({
                "id": "key-1",
                "provider": "anthropic",
                "name": "Key 1",
                "key_encrypted": "encrypted",
                "key_masked": "sk-ant-...123",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_used": None,
                "is_valid": True,
            }),
            # Agent configs (one per role)
            json.dumps({
                "role": "discovery",
                "provider": "anthropic",
                "model": "claude-sonnet-4-20250514",
                "api_key_id": "key-1",
                "settings": {"temperature": 0.2, "max_tokens": 16384},
                "enabled": True,
            }),
            None,  # design - default
            None,  # utest - default
            None,  # coding - default
            None,  # debugger - default
            None,  # reviewer - default
            None,  # ideation - default
        ]

        result = await service.export_config()

        assert "agents" in result
        assert "keys" in result
        assert "discovery" in result["agents"]

    @pytest.mark.asyncio
    async def test_import_config(self, service: LLMConfigService) -> None:
        """Test importing configuration."""
        config = {
            "agents": {
                "discovery": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "api_key_id": "key-1",
                    "temperature": 0.2,
                    "max_tokens": 16384,
                }
            }
        }

        service._redis_client.set = AsyncMock()

        result = await service.import_config(config)

        assert result["imported"] is True
        service._redis_client.set.assert_called()

    @pytest.mark.asyncio
    async def test_import_config_invalid(self, service: LLMConfigService) -> None:
        """Test importing invalid configuration."""
        config = {
            "agents": {
                "invalid_role": {
                    "provider": "anthropic",
                }
            }
        }

        with pytest.raises(ValueError):
            await service.import_config(config)


class TestAPIKeyTesting:
    """Tests for API key testing method."""

    @pytest.fixture
    def service(self) -> LLMConfigService:
        """Create a service instance with mocked Redis."""
        mock_client = AsyncMock()
        return LLMConfigService(redis_client=mock_client)

    @pytest.mark.asyncio
    async def test_test_api_key_success(self, service: LLMConfigService) -> None:
        """Test successful API key validation."""
        key_data = json.dumps({
            "id": "key-123",
            "provider": "anthropic",
            "name": "Test Key",
            "key_encrypted": service._encryption.encrypt("test-api-key"),
            "key_masked": "test-a...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        service._redis_client.get.return_value = key_data
        service._redis_client.set = AsyncMock()

        # Mock discovery service to return models
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            from src.infrastructure.llm.model_discovery import DiscoveredModel
            mock_instance = AsyncMock()
            mock_instance.discover_models.return_value = [
                DiscoveredModel(
                    id="claude-sonnet-4-20250514",
                    name="Claude Sonnet 4",
                    provider="anthropic",
                    context_window=200000,
                    max_output=16384,
                    capabilities=["chat", "tools"],
                    deprecated=False,
                    discovered_at="2026-01-29T10:00:00Z",
                ),
                DiscoveredModel(
                    id="claude-opus-4-20250514",
                    name="Claude Opus 4",
                    provider="anthropic",
                    context_window=200000,
                    max_output=32768,
                    capabilities=["chat", "tools", "vision"],
                    deprecated=False,
                    discovered_at="2026-01-29T10:00:00Z",
                ),
            ]
            mock_discovery.return_value = mock_instance

            result = await service.test_api_key("key-123")

            assert result["success"] is True
            assert result["models_discovered"] == 2
            assert "valid" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_test_api_key_invalid(self, service: LLMConfigService) -> None:
        """Test validation of invalid API key (returns no models)."""
        key_data = json.dumps({
            "id": "key-invalid",
            "provider": "anthropic",
            "name": "Invalid Key",
            "key_encrypted": service._encryption.encrypt("invalid-key"),
            "key_masked": "inval...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        service._redis_client.get.return_value = key_data
        service._redis_client.set = AsyncMock()

        # Mock discovery service to return no models
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            mock_instance = AsyncMock()
            mock_instance.discover_models.return_value = []
            mock_discovery.return_value = mock_instance

            result = await service.test_api_key("key-invalid")

            assert result["success"] is False
            assert result["models_discovered"] == 0

    @pytest.mark.asyncio
    async def test_test_api_key_not_found(self, service: LLMConfigService) -> None:
        """Test testing a non-existent key raises KeyError."""
        service._redis_client.get.return_value = None

        with pytest.raises(KeyError):
            await service.test_api_key("nonexistent")

    @pytest.mark.asyncio
    async def test_test_api_key_auth_failure(self, service: LLMConfigService) -> None:
        """Test handling of authentication failure."""
        key_data = json.dumps({
            "id": "key-auth-fail",
            "provider": "anthropic",
            "name": "Auth Fail Key",
            "key_encrypted": service._encryption.encrypt("bad-key"),
            "key_masked": "bad-k...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        service._redis_client.get.return_value = key_data
        service._redis_client.set = AsyncMock()

        # Mock discovery service to raise auth error
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            mock_instance = AsyncMock()
            mock_instance.discover_models.side_effect = Exception("401 Unauthorized")
            mock_discovery.return_value = mock_instance

            result = await service.test_api_key("key-auth-fail")

            assert result["success"] is False
            assert "authentication" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_test_api_key_rate_limit(self, service: LLMConfigService) -> None:
        """Test handling of rate limit error."""
        key_data = json.dumps({
            "id": "key-rate-limit",
            "provider": "openai",
            "name": "Rate Limited Key",
            "key_encrypted": service._encryption.encrypt("rate-limited-key"),
            "key_masked": "rate-...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        })
        service._redis_client.get.return_value = key_data
        service._redis_client.set = AsyncMock()

        # Mock discovery service to raise rate limit error
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            mock_instance = AsyncMock()
            mock_instance.discover_models.side_effect = Exception("429 Rate limit exceeded")
            mock_discovery.return_value = mock_instance

            result = await service.test_api_key("key-rate-limit")

            assert result["success"] is False
            assert "rate limit" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_test_api_key_updates_is_valid(self, service: LLMConfigService) -> None:
        """Test that key testing updates the is_valid field in Redis."""
        key_data = {
            "id": "key-123",
            "provider": "anthropic",
            "name": "Test Key",
            "key_encrypted": service._encryption.encrypt("test-api-key"),
            "key_masked": "test-a...key",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": False,  # Initially invalid
        }
        service._redis_client.get.return_value = json.dumps(key_data)
        service._redis_client.set = AsyncMock()

        # Mock successful discovery
        with patch("src.infrastructure.llm.model_discovery.ModelDiscoveryService") as mock_discovery:
            from src.infrastructure.llm.model_discovery import DiscoveredModel
            mock_instance = AsyncMock()
            mock_instance.discover_models.return_value = [
                DiscoveredModel(
                    id="test-model",
                    name="Test Model",
                    provider="anthropic",
                    context_window=100000,
                    max_output=8192,
                    capabilities=["chat"],
                    deprecated=False,
                    discovered_at="2026-01-29T10:00:00Z",
                )
            ]
            mock_discovery.return_value = mock_instance

            await service.test_api_key("key-123")

            # Verify Redis was called to update the key with is_valid=True
            service._redis_client.set.assert_called_once()
            call_args = service._redis_client.set.call_args
            stored_data = json.loads(call_args[0][1])
            assert stored_data["is_valid"] is True
