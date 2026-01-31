"""Unit tests for LLM Configuration API models.

Tests the Pydantic models for LLM configuration including providers,
API keys, models, and agent settings.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from src.orchestrator.api.models.llm_config import (
    AgentLLMConfig,
    AgentRole,
    AgentSettings,
    APIKey,
    APIKeyCreate,
    LLMConfigResponse,
    LLMModel,
    LLMProvider,
)


class TestLLMProvider:
    """Tests for LLMProvider enum."""

    def test_provider_values(self) -> None:
        """Test that all expected providers exist."""
        assert LLMProvider.ANTHROPIC.value == "anthropic"
        assert LLMProvider.OPENAI.value == "openai"
        assert LLMProvider.GOOGLE.value == "google"

    def test_provider_is_string_enum(self) -> None:
        """Test that provider values can be used as strings."""
        assert LLMProvider.ANTHROPIC.value == "anthropic"
        assert LLMProvider.ANTHROPIC == "anthropic"


class TestAgentRole:
    """Tests for AgentRole enum."""

    def test_role_values(self) -> None:
        """Test that all expected roles exist."""
        assert AgentRole.DISCOVERY.value == "discovery"
        assert AgentRole.DESIGN.value == "design"
        assert AgentRole.UTEST.value == "utest"
        assert AgentRole.CODING.value == "coding"
        assert AgentRole.DEBUGGER.value == "debugger"
        assert AgentRole.REVIEWER.value == "reviewer"
        assert AgentRole.IDEATION.value == "ideation"

    def test_role_count(self) -> None:
        """Test that we have exactly 7 roles defined."""
        assert len(AgentRole) == 7


class TestAPIKey:
    """Tests for APIKey model."""

    def test_create_api_key(self) -> None:
        """Test creating an API key model."""
        now = datetime.now(timezone.utc)
        key = APIKey(
            id="key-123",
            provider=LLMProvider.ANTHROPIC,
            name="Production Key",
            key_masked="sk-ant-...xyz",
            created_at=now,
            last_used=None,
            is_valid=True,
        )
        assert key.id == "key-123"
        assert key.provider == LLMProvider.ANTHROPIC
        assert key.name == "Production Key"
        assert key.key_masked == "sk-ant-...xyz"
        assert key.created_at == now
        assert key.last_used is None
        assert key.is_valid is True

    def test_api_key_with_last_used(self) -> None:
        """Test API key with last_used timestamp."""
        now = datetime.now(timezone.utc)
        key = APIKey(
            id="key-456",
            provider=LLMProvider.OPENAI,
            name="Test Key",
            key_masked="sk-...abc",
            created_at=now,
            last_used=now,
            is_valid=True,
        )
        assert key.last_used == now

    def test_api_key_serialization(self) -> None:
        """Test API key JSON serialization."""
        now = datetime.now(timezone.utc)
        key = APIKey(
            id="key-789",
            provider=LLMProvider.GOOGLE,
            name="Google Key",
            key_masked="AIza...xyz",
            created_at=now,
            last_used=None,
            is_valid=False,
        )
        data = key.model_dump()
        assert data["id"] == "key-789"
        assert data["provider"] == "google"
        assert data["is_valid"] is False


class TestAPIKeyCreate:
    """Tests for APIKeyCreate model."""

    def test_create_api_key_create(self) -> None:
        """Test creating an APIKeyCreate model."""
        key_create = APIKeyCreate(
            provider=LLMProvider.ANTHROPIC,
            name="New Key",
            key="sk-ant-api03-very-secret-key",
        )
        assert key_create.provider == LLMProvider.ANTHROPIC
        assert key_create.name == "New Key"
        assert key_create.key == "sk-ant-api03-very-secret-key"

    def test_api_key_create_required_fields(self) -> None:
        """Test that all fields are required."""
        with pytest.raises(ValidationError):
            APIKeyCreate(provider=LLMProvider.ANTHROPIC, name="Test")  # type: ignore

        with pytest.raises(ValidationError):
            APIKeyCreate(provider=LLMProvider.ANTHROPIC, key="test")  # type: ignore


class TestLLMModel:
    """Tests for LLMModel model."""

    def test_create_llm_model(self) -> None:
        """Test creating an LLM model."""
        model = LLMModel(
            id="claude-3-opus",
            name="Claude 3 Opus",
            provider=LLMProvider.ANTHROPIC,
            context_window=200000,
            max_output=4096,
            capabilities=["vision", "tools", "code"],
        )
        assert model.id == "claude-3-opus"
        assert model.name == "Claude 3 Opus"
        assert model.provider == LLMProvider.ANTHROPIC
        assert model.context_window == 200000
        assert model.max_output == 4096
        assert "vision" in model.capabilities

    def test_llm_model_empty_capabilities(self) -> None:
        """Test LLM model with empty capabilities list."""
        model = LLMModel(
            id="gpt-4",
            name="GPT-4",
            provider=LLMProvider.OPENAI,
            context_window=128000,
            max_output=8192,
            capabilities=[],
        )
        assert model.capabilities == []


class TestAgentSettings:
    """Tests for AgentSettings model."""

    def test_default_settings(self) -> None:
        """Test default agent settings values."""
        settings = AgentSettings()
        assert settings.temperature == 0.2
        assert settings.max_tokens == 16384
        assert settings.top_p is None
        assert settings.top_k is None

    def test_custom_settings(self) -> None:
        """Test custom agent settings values."""
        settings = AgentSettings(
            temperature=0.7,
            max_tokens=8192,
            top_p=0.9,
            top_k=50,
        )
        assert settings.temperature == 0.7
        assert settings.max_tokens == 8192
        assert settings.top_p == 0.9
        assert settings.top_k == 50

    def test_temperature_bounds(self) -> None:
        """Test temperature validation bounds."""
        # Valid bounds
        AgentSettings(temperature=0.0)
        AgentSettings(temperature=1.0)

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentSettings(temperature=-0.1)

        with pytest.raises(ValidationError):
            AgentSettings(temperature=1.1)

    def test_max_tokens_bounds(self) -> None:
        """Test max_tokens validation bounds."""
        # Valid bounds
        AgentSettings(max_tokens=1024)
        AgentSettings(max_tokens=32768)

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentSettings(max_tokens=1023)

        with pytest.raises(ValidationError):
            AgentSettings(max_tokens=32769)

    def test_top_p_bounds(self) -> None:
        """Test top_p validation bounds."""
        # Valid bounds
        AgentSettings(top_p=0.0)
        AgentSettings(top_p=1.0)

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentSettings(top_p=-0.1)

        with pytest.raises(ValidationError):
            AgentSettings(top_p=1.1)

    def test_top_k_bounds(self) -> None:
        """Test top_k validation bounds."""
        # Valid bounds
        AgentSettings(top_k=1)
        AgentSettings(top_k=100)

        # Invalid bounds
        with pytest.raises(ValidationError):
            AgentSettings(top_k=0)

        with pytest.raises(ValidationError):
            AgentSettings(top_k=101)


class TestAgentLLMConfig:
    """Tests for AgentLLMConfig model."""

    def test_create_agent_config(self) -> None:
        """Test creating an agent LLM configuration."""
        config = AgentLLMConfig(
            role=AgentRole.CODING,
            provider=LLMProvider.ANTHROPIC,
            model="claude-3-opus",
            api_key_id="key-123",
            settings=AgentSettings(),
            enabled=True,
        )
        assert config.role == AgentRole.CODING
        assert config.provider == LLMProvider.ANTHROPIC
        assert config.model == "claude-3-opus"
        assert config.api_key_id == "key-123"
        assert config.enabled is True

    def test_agent_config_default_enabled(self) -> None:
        """Test that enabled defaults to True."""
        config = AgentLLMConfig(
            role=AgentRole.REVIEWER,
            provider=LLMProvider.OPENAI,
            model="gpt-4",
            api_key_id="key-456",
            settings=AgentSettings(),
        )
        assert config.enabled is True

    def test_agent_config_serialization(self) -> None:
        """Test agent config JSON serialization."""
        config = AgentLLMConfig(
            role=AgentRole.DEBUGGER,
            provider=LLMProvider.GOOGLE,
            model="gemini-pro",
            api_key_id="key-789",
            settings=AgentSettings(temperature=0.5),
            enabled=False,
        )
        data = config.model_dump()
        assert data["role"] == "debugger"
        assert data["provider"] == "google"
        assert data["enabled"] is False
        assert data["settings"]["temperature"] == 0.5


class TestLLMConfigResponse:
    """Tests for LLMConfigResponse model."""

    def test_create_config_response(self) -> None:
        """Test creating a config response."""
        now = datetime.now(timezone.utc)
        response = LLMConfigResponse(
            keys=[
                APIKey(
                    id="key-1",
                    provider=LLMProvider.ANTHROPIC,
                    name="Key 1",
                    key_masked="sk-...1",
                    created_at=now,
                    last_used=None,
                    is_valid=True,
                )
            ],
            agents=[
                AgentLLMConfig(
                    role=AgentRole.CODING,
                    provider=LLMProvider.ANTHROPIC,
                    model="claude-3-opus",
                    api_key_id="key-1",
                    settings=AgentSettings(),
                )
            ],
        )
        assert len(response.keys) == 1
        assert len(response.agents) == 1

    def test_empty_config_response(self) -> None:
        """Test creating an empty config response."""
        response = LLMConfigResponse(keys=[], agents=[])
        assert response.keys == []
        assert response.agents == []
