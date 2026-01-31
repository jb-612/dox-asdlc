"""Pydantic models for LLM Configuration endpoints.

This module defines the data models for managing LLM providers, API keys,
and per-agent model configurations.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class LLMProvider(str, Enum):
    """Supported LLM providers."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"


class AgentRole(str, Enum):
    """Agent roles that can be configured with LLM settings."""

    DISCOVERY = "discovery"
    DESIGN = "design"
    UTEST = "utest"
    CODING = "coding"
    DEBUGGER = "debugger"
    REVIEWER = "reviewer"
    IDEATION = "ideation"


class APIKey(BaseModel):
    """API key stored in the system (masked for security).

    Attributes:
        id: Unique identifier for this key.
        provider: The LLM provider this key is for.
        name: User-friendly name for the key.
        key_masked: Masked version of the key (e.g., "sk-ant-...xyz").
        created_at: When the key was added.
        last_used: When the key was last used for an API call.
        is_valid: Whether the last connectivity test passed.
    """

    id: str
    provider: LLMProvider
    name: str
    key_masked: str
    created_at: datetime
    last_used: datetime | None = None
    is_valid: bool = True

    model_config = {"populate_by_name": True}


class APIKeyCreate(BaseModel):
    """Request model for creating a new API key.

    Attributes:
        provider: The LLM provider this key is for.
        name: User-friendly name for the key.
        key: The plaintext API key (will be encrypted before storage).
    """

    provider: LLMProvider
    name: str
    key: str

    model_config = {"populate_by_name": True}


class LLMModel(BaseModel):
    """Information about an LLM model.

    Attributes:
        id: Model identifier used in API calls.
        name: Human-readable model name.
        provider: The provider this model belongs to.
        context_window: Maximum context window size in tokens.
        max_output: Maximum output tokens.
        capabilities: List of model capabilities (e.g., "vision", "tools").
    """

    id: str
    name: str
    provider: LLMProvider
    context_window: int
    max_output: int
    capabilities: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class AgentSettings(BaseModel):
    """LLM generation settings for an agent.

    Attributes:
        temperature: Sampling temperature (0.0 to 1.0).
        max_tokens: Maximum tokens in response.
        top_p: Nucleus sampling parameter.
        top_k: Top-k sampling parameter.
    """

    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=16384, ge=1024, le=32768)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=1, le=100)

    model_config = {"populate_by_name": True}


class AgentLLMConfig(BaseModel):
    """LLM configuration for a specific agent role.

    Attributes:
        role: The agent role this config applies to.
        provider: The LLM provider to use.
        model: The model ID to use.
        api_key_id: Reference to the API key to use.
        settings: Generation settings for this agent.
        enabled: Whether this agent is enabled.
    """

    role: AgentRole
    provider: LLMProvider
    model: str
    api_key_id: str
    settings: AgentSettings = Field(default_factory=AgentSettings)
    enabled: bool = True

    model_config = {"populate_by_name": True}


class AgentConfigUpdate(BaseModel):
    """Partial update model for agent LLM configuration.

    All fields are optional to support partial updates. Only the fields
    that are provided will be updated, preserving existing values for
    fields not included in the request.

    Attributes:
        provider: The LLM provider to use.
        model: The model ID to use.
        api_key_id: Reference to the API key to use.
        enabled: Whether this agent is enabled.
        settings: Generation settings for this agent.
    """

    provider: LLMProvider | None = None
    model: str | None = None
    api_key_id: str | None = None
    enabled: bool | None = None
    settings: AgentSettings | None = None

    model_config = {"populate_by_name": True}


class LLMConfigResponse(BaseModel):
    """Combined response with all LLM configuration.

    Attributes:
        keys: List of API keys (masked).
        agents: List of agent configurations.
    """

    keys: list[APIKey]
    agents: list[AgentLLMConfig]

    model_config = {"populate_by_name": True}
