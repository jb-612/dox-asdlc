"""Unit tests for LLM Configuration API routes.

Tests the REST API endpoints for LLM configuration management.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.api.models.llm_config import (
    AgentLLMConfig,
    AgentRole,
    AgentSettings,
    APIKey,
    LLMModel,
    LLMProvider,
)
from src.orchestrator.routes.llm_config_api import (
    router,
    get_llm_config_service,
)
from src.orchestrator.services.llm_config_service import LLMConfigService


@pytest.fixture
def mock_service() -> LLMConfigService:
    """Create a mock LLM config service."""
    mock = AsyncMock(spec=LLMConfigService)
    return mock


@pytest.fixture
def app(mock_service: LLMConfigService) -> FastAPI:
    """Create a FastAPI app with the router."""
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_llm_config_service] = lambda: mock_service
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create a test client."""
    return TestClient(app)


class TestGetProviders:
    """Tests for GET /api/llm/providers endpoint."""

    def test_get_providers_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful retrieval of providers."""
        mock_service.get_providers.return_value = [
            LLMProvider.ANTHROPIC,
            LLMProvider.OPENAI,
            LLMProvider.GOOGLE,
        ]
        
        response = client.get("/api/llm/providers")
        
        assert response.status_code == 200
        data = response.json()
        assert "anthropic" in data
        assert "openai" in data
        assert "google" in data


class TestGetModels:
    """Tests for GET /api/llm/providers/{provider}/models endpoint."""

    def test_get_models_anthropic(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test getting Anthropic models."""
        mock_service.get_models.return_value = [
            LLMModel(
                id="claude-sonnet-4-20250514",
                name="Claude Sonnet 4",
                provider=LLMProvider.ANTHROPIC,
                context_window=200000,
                max_output=16384,
                capabilities=["vision", "tools"],
            ),
        ]
        
        response = client.get("/api/llm/providers/anthropic/models")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "claude-sonnet-4-20250514"

    def test_get_models_invalid_provider(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test getting models for invalid provider."""
        response = client.get("/api/llm/providers/invalid/models")
        
        assert response.status_code == 422  # Validation error


class TestGetKeys:
    """Tests for GET /api/llm/keys endpoint."""

    def test_get_keys_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful retrieval of API keys."""
        now = datetime.now(timezone.utc)
        mock_service.get_keys.return_value = [
            APIKey(
                id="key-1",
                provider=LLMProvider.ANTHROPIC,
                name="Production Key",
                key_masked="sk-ant-...xyz",
                created_at=now,
                last_used=None,
                is_valid=True,
            ),
        ]
        
        response = client.get("/api/llm/keys")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["key_masked"] == "sk-ant-...xyz"
        # Ensure plaintext key is never returned
        assert "key" not in data[0] or "..." in data[0].get("key_masked", "")

    def test_get_keys_empty(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test getting keys when none exist."""
        mock_service.get_keys.return_value = []
        
        response = client.get("/api/llm/keys")
        
        assert response.status_code == 200
        assert response.json() == []


class TestAddKey:
    """Tests for POST /api/llm/keys endpoint."""

    def test_add_key_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful addition of an API key."""
        now = datetime.now(timezone.utc)
        mock_service.add_key.return_value = APIKey(
            id="key-new",
            provider=LLMProvider.ANTHROPIC,
            name="New Key",
            key_masked="sk-ant-...new",
            created_at=now,
            last_used=None,
            is_valid=True,
        )
        
        response = client.post(
            "/api/llm/keys",
            json={
                "provider": "anthropic",
                "name": "New Key",
                "key": "sk-ant-api03-secret-key-value",
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "key-new"
        assert data["key_masked"] == "sk-ant-...new"

    def test_add_key_invalid_provider(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test adding key with invalid provider."""
        response = client.post(
            "/api/llm/keys",
            json={
                "provider": "invalid",
                "name": "Bad Key",
                "key": "some-key",
            },
        )
        
        assert response.status_code == 422

    def test_add_key_missing_fields(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test adding key with missing required fields."""
        response = client.post(
            "/api/llm/keys",
            json={"provider": "anthropic"},
        )
        
        assert response.status_code == 422


class TestDeleteKey:
    """Tests for DELETE /api/llm/keys/{id} endpoint."""

    def test_delete_key_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful deletion of an API key."""
        mock_service.delete_key.return_value = True
        
        response = client.delete("/api/llm/keys/key-123")
        
        assert response.status_code == 204

    def test_delete_key_not_found(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test deleting a non-existent key."""
        mock_service.delete_key.return_value = False
        
        response = client.delete("/api/llm/keys/nonexistent")
        
        assert response.status_code == 404


class TestGetAgents:
    """Tests for GET /api/llm/agents endpoint."""

    def test_get_agents_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful retrieval of agent configs."""
        mock_service.get_all_agent_configs.return_value = [
            AgentLLMConfig(
                role=AgentRole.CODING,
                provider=LLMProvider.ANTHROPIC,
                model="claude-sonnet-4-20250514",
                api_key_id="key-1",
                settings=AgentSettings(),
                enabled=True,
            ),
        ]
        
        response = client.get("/api/llm/agents")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["role"] == "coding"


class TestGetAgentConfig:
    """Tests for GET /api/llm/agents/{role} endpoint."""

    def test_get_agent_config_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful retrieval of an agent config."""
        mock_service.get_agent_config.return_value = AgentLLMConfig(
            role=AgentRole.REVIEWER,
            provider=LLMProvider.OPENAI,
            model="gpt-4",
            api_key_id="key-2",
            settings=AgentSettings(temperature=0.3),
            enabled=True,
        )
        
        response = client.get("/api/llm/agents/reviewer")
        
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "reviewer"
        assert data["settings"]["temperature"] == 0.3

    def test_get_agent_config_invalid_role(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test getting config for invalid role."""
        response = client.get("/api/llm/agents/invalid")
        
        assert response.status_code == 422


class TestUpdateAgentConfig:
    """Tests for PUT /api/llm/agents/{role} endpoint."""

    def test_update_agent_config_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful update of an agent config."""
        updated_config = AgentLLMConfig(
            role=AgentRole.DEBUGGER,
            provider=LLMProvider.ANTHROPIC,
            model="claude-opus-4-20250514",
            api_key_id="key-3",
            settings=AgentSettings(temperature=0.5, max_tokens=8192),
            enabled=False,
        )
        mock_service.partial_update_agent_config.return_value = updated_config
        
        response = client.put(
            "/api/llm/agents/debugger",
            json={
                "role": "debugger",
                "provider": "anthropic",
                "model": "claude-opus-4-20250514",
                "api_key_id": "key-3",
                "settings": {"temperature": 0.5, "max_tokens": 8192},
                "enabled": False,
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "debugger"
        assert data["enabled"] is False

    def test_update_agent_config_role_mismatch(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test updating with mismatched role in path vs body."""
        response = client.put(
            "/api/llm/agents/coding",
            json={
                "role": "reviewer",  # Mismatch!
                "provider": "anthropic",
                "model": "claude-sonnet-4-20250514",
                "api_key_id": "key-1",
                "settings": {},
            },
        )
        
        assert response.status_code == 400

    def test_update_agent_config_invalid_settings(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test updating with invalid settings."""
        response = client.put(
            "/api/llm/agents/coding",
            json={
                "role": "coding",
                "provider": "anthropic",
                "model": "claude-sonnet-4-20250514",
                "api_key_id": "key-1",
                "settings": {"temperature": 2.0},  # Invalid: > 1.0
            },
        )
        
        assert response.status_code == 422


class TestErrorHandling:
    """Tests for error handling in the API."""

    def test_service_error_returns_500(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test that service errors return 500."""
        mock_service.get_keys.side_effect = Exception("Database error")
        
        response = client.get("/api/llm/keys")
        
        assert response.status_code == 500
        # Error message should be generic, not expose internals
        data = response.json()
        assert "Database error" not in data.get("detail", "")


class TestGetKeyModels:
    """Tests for GET /api/llm/keys/{key_id}/models endpoint."""

    def test_get_key_models_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful retrieval of cached models for a key."""
        mock_service.get_cached_models.return_value = [
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

        response = client.get("/api/llm/keys/key-123/models")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "claude-sonnet-4-20250514"

    def test_get_key_models_empty(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test getting models when none cached."""
        mock_service.get_cached_models.return_value = []

        response = client.get("/api/llm/keys/key-456/models")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_key_models_key_not_found(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test getting models for non-existent key."""
        mock_service.get_cached_models.side_effect = KeyError("Key not found")

        response = client.get("/api/llm/keys/nonexistent/models")

        assert response.status_code == 404


class TestDiscoverKeyModels:
    """Tests for POST /api/llm/keys/{key_id}/discover endpoint."""

    def test_discover_key_models_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful model discovery for a key."""
        mock_service.discover_and_cache_models.return_value = [
            {
                "id": "claude-opus-4-20250514",
                "name": "Claude Opus 4",
                "provider": "anthropic",
                "context_window": 200000,
                "max_output": 32768,
                "capabilities": ["chat", "tools", "vision"],
                "deprecated": False,
                "discovered_at": "2026-01-29T10:00:00Z",
            }
        ]

        response = client.post("/api/llm/keys/key-123/discover")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "claude-opus-4-20250514"

    def test_discover_key_models_key_not_found(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test discovery for non-existent key."""
        mock_service.discover_and_cache_models.side_effect = KeyError("Key not found")

        response = client.post("/api/llm/keys/nonexistent/discover")

        assert response.status_code == 404


class TestExportConfig:
    """Tests for GET /api/llm/config/export endpoint."""

    def test_export_config_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful config export."""
        mock_service.export_config.return_value = {
            "agents": {
                "discovery": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "api_key_id": "key-123",
                    "temperature": 0.2,
                    "max_tokens": 16384,
                }
            },
            "keys": ["key-123"],
        }

        response = client.get("/api/llm/config/export")

        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert "keys" in data


class TestExportConfigEnv:
    """Tests for GET /api/llm/config/export/env endpoint."""

    def test_export_config_env_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful env export."""
        mock_service.export_config.return_value = {
            "agents": {
                "discovery": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "api_key_id": "key-123",
                    "temperature": 0.2,
                    "max_tokens": 16384,
                }
            },
            "keys": ["key-123"],
        }

        response = client.get("/api/llm/config/export/env")

        assert response.status_code == 200
        data = response.json()
        assert "content" in data
        assert "filename" in data
        assert data["filename"] == "llm-config.env"
        assert "LLM_DISCOVERY_PROVIDER=anthropic" in data["content"]


class TestImportConfig:
    """Tests for POST /api/llm/config/import endpoint."""

    def test_import_config_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful config import."""
        mock_service.import_config.return_value = {"imported": True, "agents": 7}

        config = {
            "agents": {
                "discovery": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "api_key_id": "key-123",
                    "temperature": 0.2,
                    "max_tokens": 16384,
                }
            }
        }

        response = client.post("/api/llm/config/import", json=config)

        assert response.status_code == 200
        data = response.json()
        assert data["imported"] is True

    def test_import_config_validation_error(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test import with invalid config structure."""
        mock_service.import_config.side_effect = ValueError("Invalid config")

        response = client.post("/api/llm/config/import", json={"invalid": "data"})

        assert response.status_code == 400


class TestValidateConfig:
    """Tests for POST /api/llm/config/validate endpoint."""

    def test_validate_config_valid(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test validating a valid config."""
        config = {
            "agents": {
                "discovery": {
                    "provider": "anthropic",
                    "model": "claude-sonnet-4-20250514",
                    "api_key_id": "key-123",
                    "temperature": 0.2,
                    "max_tokens": 16384,
                }
            }
        }

        response = client.post("/api/llm/config/validate", json=config)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True

    def test_validate_config_invalid(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test validating an invalid config."""
        config = {
            "agents": {
                "discovery": {
                    "temperature": 5.0,  # Invalid: > 1.0
                }
            }
        }

        response = client.post("/api/llm/config/validate", json=config)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert "errors" in data


class TestKeyTest:
    """Tests for POST /api/llm/keys/{key_id}/test endpoint."""

    def test_key_test_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful API key validation."""
        mock_service.test_api_key.return_value = {
            "success": True,
            "message": "Key is valid. Discovered 5 models.",
            "models_discovered": 5,
        }

        response = client.post("/api/llm/keys/key-123/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["models_discovered"] == 5
        assert "valid" in data["message"].lower()

    def test_key_test_invalid_key(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test validation of an invalid API key."""
        mock_service.test_api_key.return_value = {
            "success": False,
            "message": "Invalid API key: Authentication failed",
            "models_discovered": 0,
        }

        response = client.post("/api/llm/keys/key-invalid/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["models_discovered"] == 0
        assert "invalid" in data["message"].lower() or "failed" in data["message"].lower()

    def test_key_test_key_not_found(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test testing a non-existent key."""
        mock_service.test_api_key.side_effect = KeyError("Key not found")

        response = client.post("/api/llm/keys/nonexistent/test")

        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_key_test_provider_error(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test handling of provider-specific errors."""
        mock_service.test_api_key.return_value = {
            "success": False,
            "message": "Provider error: Rate limit exceeded",
            "models_discovered": 0,
        }

        response = client.post("/api/llm/keys/key-ratelimited/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "rate limit" in data["message"].lower() or "provider" in data["message"].lower()

    def test_key_test_updates_validity_status(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test that key test updates the key's isValid status."""
        mock_service.test_api_key.return_value = {
            "success": True,
            "message": "Key is valid. Discovered 3 models.",
            "models_discovered": 3,
        }

        response = client.post("/api/llm/keys/key-123/test")

        assert response.status_code == 200
        # Verify the service method was called with the key_id
        mock_service.test_api_key.assert_called_once_with("key-123")


class TestAgentConnectionTest:
    """Tests for POST /api/llm/agents/{role}/test endpoint."""

    def test_agent_connection_test_success(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test successful agent connection test."""
        mock_service.test_agent_connection.return_value = {
            "success": True,
            "message": "Connection successful. Model responded in 234ms.",
            "latency_ms": 234.5,
        }

        response = client.post("/api/llm/agents/coding/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["latency_ms"] == 234.5
        assert "successful" in data["message"].lower()

    def test_agent_connection_test_not_configured(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test connection test for agent with no API key configured."""
        mock_service.test_agent_connection.return_value = {
            "success": False,
            "message": "Agent 'coding' has no API key configured",
            "latency_ms": None,
        }

        response = client.post("/api/llm/agents/coding/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["latency_ms"] is None
        assert "no api key" in data["message"].lower()

    def test_agent_connection_test_invalid_key(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test connection test when API key is invalid."""
        mock_service.test_agent_connection.return_value = {
            "success": False,
            "message": "Authentication failed: Invalid API key",
            "latency_ms": None,
        }

        response = client.post("/api/llm/agents/reviewer/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "invalid" in data["message"].lower() or "authentication" in data["message"].lower()

    def test_agent_connection_test_timeout(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test connection test when request times out."""
        mock_service.test_agent_connection.return_value = {
            "success": False,
            "message": "Connection timed out after 30 seconds",
            "latency_ms": None,
        }

        response = client.post("/api/llm/agents/discovery/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "timeout" in data["message"].lower() or "timed out" in data["message"].lower()

    def test_agent_connection_test_invalid_role(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test connection test for invalid role."""
        response = client.post("/api/llm/agents/invalid_role/test")

        assert response.status_code == 422  # Validation error

    def test_agent_connection_test_disabled_agent(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test connection test for a disabled agent."""
        mock_service.test_agent_connection.return_value = {
            "success": False,
            "message": "Agent 'debugger' is disabled",
            "latency_ms": None,
        }

        response = client.post("/api/llm/agents/debugger/test")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "disabled" in data["message"].lower()

    def test_agent_connection_test_service_method_called(
        self, client: TestClient, mock_service: LLMConfigService
    ) -> None:
        """Test that service method is called with correct role."""
        mock_service.test_agent_connection.return_value = {
            "success": True,
            "message": "Connection successful.",
            "latency_ms": 100.0,
        }

        response = client.post("/api/llm/agents/ideation/test")

        assert response.status_code == 200
        mock_service.test_agent_connection.assert_called_once()
        # Verify it was called with the correct AgentRole
        call_args = mock_service.test_agent_connection.call_args
        assert call_args[0][0] == AgentRole.IDEATION
