"""Unit tests for LLM Configuration API.

Tests verify:
- PUT /api/llm/agents/{role} supports partial updates
- Partial updates merge with existing config
- test_agent_connection uses saved config
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create a mock Redis client."""
    mock = AsyncMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock()
    mock.keys = AsyncMock(return_value=[])
    mock.delete = AsyncMock(return_value=1)
    return mock


@pytest.fixture
def app() -> FastAPI:
    """Create a test FastAPI app with the LLM config router."""
    from src.orchestrator.routes.llm_config_api import router

    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create a test client for the app."""
    return TestClient(app)


class TestAgentConfigPartialUpdate:
    """Tests for PUT /api/llm/agents/{role} with partial updates."""

    @pytest.mark.asyncio
    async def test_partial_update_model_only(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update should allow updating only the model field."""
        # Setup: existing config in Redis
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                # Send partial update with only model
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={"model": "claude-opus-4-20250514"},
                )

                assert response.status_code == 200
                data = response.json()

                # Verify the model was updated
                assert data["model"] == "claude-opus-4-20250514"

                # Verify other fields preserved
                assert data["provider"] == "anthropic"
                assert data["api_key_id"] == "key-123"
                assert data["enabled"] is True

    @pytest.mark.asyncio
    async def test_partial_update_provider_only(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update should allow updating only the provider field."""
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={"provider": "openai"},
                )

                assert response.status_code == 200
                data = response.json()
                assert data["provider"] == "openai"
                # Model should be preserved
                assert data["model"] == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_partial_update_api_key_only(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update should allow updating only the api_key_id field."""
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={"api_key_id": "key-new-456"},
                )

                assert response.status_code == 200
                data = response.json()
                assert data["api_key_id"] == "key-new-456"
                # Other fields preserved
                assert data["provider"] == "anthropic"
                assert data["model"] == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_partial_update_enabled_only(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update should allow updating only the enabled field."""
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={"enabled": False},
                )

                assert response.status_code == 200
                data = response.json()
                assert data["enabled"] is False
                # Other fields preserved
                assert data["api_key_id"] == "key-123"

    @pytest.mark.asyncio
    async def test_partial_update_multiple_fields(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update should allow updating multiple fields at once."""
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={
                        "provider": "google",
                        "model": "gemini-2.0-flash",
                        "api_key_id": "key-google-789",
                    },
                )

                assert response.status_code == 200
                data = response.json()
                assert data["provider"] == "google"
                assert data["model"] == "gemini-2.0-flash"
                assert data["api_key_id"] == "key-google-789"
                # enabled should be preserved
                assert data["enabled"] is True

    @pytest.mark.asyncio
    async def test_partial_update_empty_body(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update with empty body should return existing config unchanged."""
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={},
                )

                assert response.status_code == 200
                data = response.json()
                # All fields should be unchanged
                assert data["provider"] == "anthropic"
                assert data["model"] == "claude-sonnet-4-20250514"
                assert data["api_key_id"] == "key-123"
                assert data["enabled"] is True

    @pytest.mark.asyncio
    async def test_partial_update_invalid_provider(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """Partial update with invalid provider should return 422."""
        existing_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(existing_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.put(
                    "/api/llm/agents/discovery",
                    json={"provider": "invalid_provider"},
                )

                assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_partial_update_invalid_role_in_path(self, client: TestClient) -> None:
        """Partial update with invalid role in path should return 422."""
        response = client.put(
            "/api/llm/agents/invalid_role",
            json={"model": "claude-opus-4-20250514"},
        )
        assert response.status_code == 422


class TestAgentConnectionTest:
    """Tests for POST /api/llm/agents/{role}/test."""

    @pytest.mark.asyncio
    async def test_connection_test_uses_saved_config(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """test_agent_connection should use the agent's saved API key."""
        # Setup: agent config with API key
        agent_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        # Setup: API key in Redis
        api_key_data = {
            "id": "key-123",
            "provider": "anthropic",
            "name": "My Anthropic Key",
            "key_encrypted": "encrypted-key-value",
            "key_masked": "sk-ant-...xyz",
            "created_at": "2024-01-01T00:00:00Z",
            "is_valid": True,
        }

        def mock_get(key: str):
            if "llm:agents:discovery" in key:
                return json.dumps(agent_config)
            elif "llm:keys:key-123" in key:
                return json.dumps(api_key_data)
            return None

        mock_redis.get = AsyncMock(side_effect=mock_get)

        # Mock the encryption service to return a decrypted key
        mock_encryption = MagicMock()
        mock_encryption.decrypt = MagicMock(return_value="sk-ant-real-api-key")

        # Mock the LLM client
        mock_client = AsyncMock()
        mock_client.generate = AsyncMock(return_value="Hello!")

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with patch(
                "src.orchestrator.services.llm_config_service.EncryptionService",
                return_value=mock_encryption,
            ):
                with patch(
                    "src.infrastructure.llm.factory.LLMClientFactory.get_client",
                    return_value=mock_client,
                ):
                    with TestClient(app) as client:
                        response = client.post("/api/llm/agents/discovery/test")

                        assert response.status_code == 200
                        data = response.json()
                        # Should succeed since API key is configured
                        assert data["success"] is True
                        assert "latency_ms" in data

    @pytest.mark.asyncio
    async def test_connection_test_no_api_key(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """test_agent_connection should fail if no API key configured."""
        # Setup: agent config WITHOUT API key
        agent_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "",  # No API key
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": True,
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(agent_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.post("/api/llm/agents/discovery/test")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is False
                assert "no API key configured" in data["message"]

    @pytest.mark.asyncio
    async def test_connection_test_disabled_agent(self, app: FastAPI, mock_redis: AsyncMock) -> None:
        """test_agent_connection should fail if agent is disabled."""
        agent_config = {
            "role": "discovery",
            "provider": "anthropic",
            "model": "claude-sonnet-4-20250514",
            "api_key_id": "key-123",
            "settings": {"temperature": 0.2, "max_tokens": 16384},
            "enabled": False,  # Disabled
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(agent_config))

        with patch(
            "src.orchestrator.services.llm_config_service.LLMConfigService._get_redis",
            return_value=mock_redis,
        ):
            with TestClient(app) as client:
                response = client.post("/api/llm/agents/discovery/test")

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is False
                assert "disabled" in data["message"]


class TestAgentConfigUpdateModel:
    """Tests for AgentConfigUpdate Pydantic model."""

    def test_model_allows_none_fields(self) -> None:
        """AgentConfigUpdate should allow all fields to be None."""
        from src.orchestrator.api.models.llm_config import AgentConfigUpdate

        update = AgentConfigUpdate()
        assert update.provider is None
        assert update.model is None
        assert update.api_key_id is None
        assert update.enabled is None
        assert update.settings is None

    def test_model_allows_partial_fields(self) -> None:
        """AgentConfigUpdate should allow setting only some fields."""
        from src.orchestrator.api.models.llm_config import AgentConfigUpdate, LLMProvider

        update = AgentConfigUpdate(provider=LLMProvider.OPENAI, model="gpt-4")
        assert update.provider == LLMProvider.OPENAI
        assert update.model == "gpt-4"
        assert update.api_key_id is None
        assert update.enabled is None

    def test_model_validates_provider_enum(self) -> None:
        """AgentConfigUpdate should validate provider is a valid enum."""
        from pydantic import ValidationError

        from src.orchestrator.api.models.llm_config import AgentConfigUpdate

        with pytest.raises(ValidationError):
            AgentConfigUpdate(provider="invalid_provider")


class TestRouterConfiguration:
    """Tests for router configuration."""

    def test_router_has_correct_prefix(self) -> None:
        """Router should have /api/llm prefix."""
        from src.orchestrator.routes.llm_config_api import router

        assert router.prefix == "/api/llm"

    def test_router_has_llm_config_tag(self) -> None:
        """Router should have llm-config tag."""
        from src.orchestrator.routes.llm_config_api import router

        assert "llm-config" in router.tags
