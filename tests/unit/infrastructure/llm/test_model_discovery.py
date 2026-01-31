"""Unit tests for Model Discovery Service.

Tests the ModelDiscoveryService class for discovering models from LLM vendor APIs.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

from src.infrastructure.llm.model_discovery import (
    ModelDiscoveryService,
    DiscoveredModel,
)


class TestModelDiscoveryServiceInit:
    """Tests for ModelDiscoveryService initialization."""

    def test_init_creates_instance(self) -> None:
        """Test service can be instantiated."""
        service = ModelDiscoveryService()
        assert service is not None


class TestDiscoverModels:
    """Tests for discover_models method."""

    @pytest.fixture
    def service(self) -> ModelDiscoveryService:
        """Create a service instance."""
        return ModelDiscoveryService()

    @pytest.mark.asyncio
    async def test_discover_models_anthropic(self, service: ModelDiscoveryService) -> None:
        """Test discovering Anthropic models calls the correct API."""
        with patch.object(service, "_discover_anthropic", new_callable=AsyncMock) as mock:
            mock.return_value = [
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
            
            result = await service.discover_models("anthropic", "test-api-key")
            
            mock.assert_called_once_with("test-api-key")
            assert len(result) == 1
            assert result[0].id == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_discover_models_openai(self, service: ModelDiscoveryService) -> None:
        """Test discovering OpenAI models calls the correct API."""
        with patch.object(service, "_discover_openai", new_callable=AsyncMock) as mock:
            mock.return_value = [
                DiscoveredModel(
                    id="gpt-4-turbo",
                    name="GPT-4 Turbo",
                    provider="openai",
                    context_window=128000,
                    max_output=4096,
                    capabilities=["chat", "tools"],
                    deprecated=False,
                    discovered_at="2026-01-29T10:00:00Z",
                )
            ]
            
            result = await service.discover_models("openai", "test-api-key")
            
            mock.assert_called_once_with("test-api-key")
            assert len(result) == 1
            assert result[0].id == "gpt-4-turbo"

    @pytest.mark.asyncio
    async def test_discover_models_google(self, service: ModelDiscoveryService) -> None:
        """Test discovering Google models calls the correct API."""
        with patch.object(service, "_discover_google", new_callable=AsyncMock) as mock:
            mock.return_value = [
                DiscoveredModel(
                    id="gemini-1.5-pro",
                    name="Gemini 1.5 Pro",
                    provider="google",
                    context_window=2000000,
                    max_output=8192,
                    capabilities=["chat", "tools"],
                    deprecated=False,
                    discovered_at="2026-01-29T10:00:00Z",
                )
            ]
            
            result = await service.discover_models("google", "test-api-key")
            
            mock.assert_called_once_with("test-api-key")
            assert len(result) == 1

    @pytest.mark.asyncio
    async def test_discover_models_unknown_provider(self, service: ModelDiscoveryService) -> None:
        """Test discovering models for unknown provider returns empty list."""
        result = await service.discover_models("unknown", "test-api-key")
        assert result == []


class TestDiscoverAnthropic:
    """Tests for _discover_anthropic method."""

    @pytest.fixture
    def service(self) -> ModelDiscoveryService:
        """Create a service instance."""
        return ModelDiscoveryService()

    @pytest.mark.asyncio
    async def test_discover_anthropic_success(self, service: ModelDiscoveryService) -> None:
        """Test successful Anthropic model discovery."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "claude-sonnet-4-20250514",
                    "display_name": "Claude Sonnet 4",
                    "type": "model",
                    "created_at": "2025-05-14T00:00:00Z",
                }
            ]
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_anthropic("test-api-key")
            
            assert len(result) == 1
            assert result[0].id == "claude-sonnet-4-20250514"
            assert result[0].name == "Claude Sonnet 4"
            assert result[0].provider == "anthropic"
            
            # Verify correct headers were sent
            mock_instance.get.assert_called_once()
            call_kwargs = mock_instance.get.call_args
            assert call_kwargs[1]["headers"]["x-api-key"] == "test-api-key"
            assert "anthropic-version" in call_kwargs[1]["headers"]

    @pytest.mark.asyncio
    async def test_discover_anthropic_api_error(self, service: ModelDiscoveryService) -> None:
        """Test Anthropic discovery with API error returns empty list."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"error": "Invalid API key"}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_anthropic("invalid-key")
            
            assert result == []

    @pytest.mark.asyncio
    async def test_discover_anthropic_network_error(self, service: ModelDiscoveryService) -> None:
        """Test Anthropic discovery with network error returns empty list."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.side_effect = httpx.RequestError("Network error")
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_anthropic("test-key")
            
            assert result == []


class TestDiscoverOpenAI:
    """Tests for _discover_openai method."""

    @pytest.fixture
    def service(self) -> ModelDiscoveryService:
        """Create a service instance."""
        return ModelDiscoveryService()

    @pytest.mark.asyncio
    async def test_discover_openai_success(self, service: ModelDiscoveryService) -> None:
        """Test successful OpenAI model discovery."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "gpt-4-turbo",
                    "object": "model",
                    "created": 1699554400,
                    "owned_by": "openai",
                },
                {
                    "id": "gpt-3.5-turbo",
                    "object": "model",
                    "created": 1699554400,
                    "owned_by": "openai",
                },
                {
                    "id": "text-embedding-ada-002",  # Should be filtered out
                    "object": "model",
                    "created": 1699554400,
                    "owned_by": "openai",
                },
            ]
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_openai("test-api-key")
            
            # Should filter to only chat models
            assert len(result) == 2
            model_ids = [m.id for m in result]
            assert "gpt-4-turbo" in model_ids
            assert "gpt-3.5-turbo" in model_ids
            assert "text-embedding-ada-002" not in model_ids
            
            # Verify correct headers were sent
            call_kwargs = mock_instance.get.call_args
            assert call_kwargs[1]["headers"]["Authorization"] == "Bearer test-api-key"

    @pytest.mark.asyncio
    async def test_discover_openai_api_error(self, service: ModelDiscoveryService) -> None:
        """Test OpenAI discovery with API error returns empty list."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_openai("invalid-key")
            
            assert result == []


class TestDiscoverGoogle:
    """Tests for _discover_google method."""

    @pytest.fixture
    def service(self) -> ModelDiscoveryService:
        """Create a service instance."""
        return ModelDiscoveryService()

    @pytest.mark.asyncio
    async def test_discover_google_success(self, service: ModelDiscoveryService) -> None:
        """Test successful Google model discovery."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {
                    "name": "models/gemini-1.5-pro",
                    "displayName": "Gemini 1.5 Pro",
                    "description": "A powerful model",
                    "inputTokenLimit": 2000000,
                    "outputTokenLimit": 8192,
                    "supportedGenerationMethods": ["generateContent"],
                },
                {
                    "name": "models/gemini-1.5-flash",
                    "displayName": "Gemini 1.5 Flash",
                    "description": "A fast model",
                    "inputTokenLimit": 1000000,
                    "outputTokenLimit": 8192,
                    "supportedGenerationMethods": ["generateContent"],
                },
            ]
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_google("test-api-key")
            
            assert len(result) == 2
            assert result[0].id == "gemini-1.5-pro"
            assert result[0].name == "Gemini 1.5 Pro"
            assert result[0].context_window == 2000000
            assert result[0].max_output == 8192

    @pytest.mark.asyncio
    async def test_discover_google_api_error(self, service: ModelDiscoveryService) -> None:
        """Test Google discovery with API error returns empty list."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = AsyncMock()
            mock_instance.get.return_value = mock_response
            mock_instance.__aenter__.return_value = mock_instance
            mock_instance.__aexit__.return_value = None
            mock_client.return_value = mock_instance
            
            result = await service._discover_google("invalid-key")
            
            assert result == []


class TestModelMappers:
    """Tests for model mapping methods."""

    @pytest.fixture
    def service(self) -> ModelDiscoveryService:
        """Create a service instance."""
        return ModelDiscoveryService()

    def test_map_anthropic_model(self, service: ModelDiscoveryService) -> None:
        """Test mapping Anthropic API response to DiscoveredModel."""
        raw = {
            "id": "claude-sonnet-4-20250514",
            "display_name": "Claude Sonnet 4",
            "type": "model",
            "created_at": "2025-05-14T00:00:00Z",
        }
        
        result = service._map_anthropic_model(raw)
        
        assert result.id == "claude-sonnet-4-20250514"
        assert result.name == "Claude Sonnet 4"
        assert result.provider == "anthropic"
        assert "chat" in result.capabilities
        assert result.deprecated is False

    def test_map_openai_model(self, service: ModelDiscoveryService) -> None:
        """Test mapping OpenAI API response to DiscoveredModel."""
        raw = {
            "id": "gpt-4-turbo",
            "object": "model",
            "created": 1699554400,
            "owned_by": "openai",
        }
        
        result = service._map_openai_model(raw)
        
        assert result.id == "gpt-4-turbo"
        assert result.name == "gpt-4-turbo"
        assert result.provider == "openai"

    def test_map_google_model(self, service: ModelDiscoveryService) -> None:
        """Test mapping Google API response to DiscoveredModel."""
        raw = {
            "name": "models/gemini-1.5-pro",
            "displayName": "Gemini 1.5 Pro",
            "inputTokenLimit": 2000000,
            "outputTokenLimit": 8192,
            "supportedGenerationMethods": ["generateContent"],
        }
        
        result = service._map_google_model(raw)
        
        assert result.id == "gemini-1.5-pro"
        assert result.name == "Gemini 1.5 Pro"
        assert result.provider == "google"
        assert result.context_window == 2000000
        assert result.max_output == 8192


class TestDiscoveredModelDataClass:
    """Tests for DiscoveredModel dataclass."""

    def test_discovered_model_creation(self) -> None:
        """Test creating a DiscoveredModel."""
        model = DiscoveredModel(
            id="test-model",
            name="Test Model",
            provider="anthropic",
            context_window=100000,
            max_output=4096,
            capabilities=["chat"],
            deprecated=False,
            discovered_at="2026-01-29T10:00:00Z",
        )
        
        assert model.id == "test-model"
        assert model.name == "Test Model"
        assert model.provider == "anthropic"

    def test_discovered_model_to_dict(self) -> None:
        """Test converting DiscoveredModel to dict."""
        model = DiscoveredModel(
            id="test-model",
            name="Test Model",
            provider="anthropic",
            context_window=100000,
            max_output=4096,
            capabilities=["chat"],
            deprecated=False,
            discovered_at="2026-01-29T10:00:00Z",
        )
        
        result = model.to_dict()
        
        assert isinstance(result, dict)
        assert result["id"] == "test-model"
        assert result["capabilities"] == ["chat"]
