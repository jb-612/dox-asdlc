"""LLM Configuration API routes.

This module provides REST API endpoints for managing LLM providers,
API keys, and per-agent model configurations.

Endpoints:
- GET /api/llm/providers - List supported providers
- GET /api/llm/providers/{provider}/models - List models for a provider
- GET /api/llm/keys - List API keys (masked)
- POST /api/llm/keys - Add new API key
- DELETE /api/llm/keys/{id} - Delete API key
- GET /api/llm/keys/{id}/models - Get cached models for key
- POST /api/llm/keys/{id}/discover - Force model discovery
- POST /api/llm/keys/{id}/test - Test API key validity
- GET /api/llm/agents - List agent configurations
- GET /api/llm/agents/{role} - Get agent configuration
- PUT /api/llm/agents/{role} - Update agent configuration
- GET /api/llm/config/export - Export full config as JSON
- GET /api/llm/config/export/env - Export config as .env format
- POST /api/llm/config/import - Import config from JSON
- POST /api/llm/config/validate - Validate config JSON
- POST /api/llm/agents/{role}/test - Test agent LLM connectivity
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel, Field, ValidationError

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
from src.orchestrator.services.llm_config_service import (
    LLMConfigService,
    get_llm_config_service,
)


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/llm", tags=["llm-config"])


# =============================================================================
# Request/Response Models for new endpoints
# =============================================================================


class ConfigImportRequest(BaseModel):
    """Request model for config import."""

    agents: dict[str, dict[str, Any]] = Field(
        default_factory=dict, description="Agent configurations by role"
    )


class AgentConfigImport(BaseModel):
    """Agent config for import validation."""

    provider: str = "anthropic"
    model: str = "claude-sonnet-4-20250514"
    api_key_id: str = ""
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=16384, ge=1024, le=32768)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=1, le=100)
    enabled: bool = True


class LLMConfigImport(BaseModel):
    """Full config import model for validation."""

    agents: dict[str, AgentConfigImport] = Field(default_factory=dict)


class EnvExportResponse(BaseModel):
    """Response model for .env export."""

    content: str
    filename: str = "llm-config.env"


class ValidationResponse(BaseModel):
    """Response model for config validation."""

    valid: bool
    errors: list[dict[str, Any]] = Field(default_factory=list)


class ImportResponse(BaseModel):
    """Response model for config import."""

    imported: bool
    agents: int = 0


class KeyTestResponse(BaseModel):
    """Response model for API key test."""

    success: bool
    message: str
    models_discovered: int = 0



# =============================================================================
# Provider Endpoints
# =============================================================================


@router.get("/providers", response_model=list[str])
async def get_providers(
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> list[str]:
    """Get list of supported LLM providers.

    Returns:
        list[str]: List of provider identifiers.
    """
    try:
        providers = await service.get_providers()
        return [p.value for p in providers]
    except Exception as e:
        logger.error(f"Failed to get providers: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve providers",
        ) from e


@router.get("/providers/{provider}/models", response_model=list[LLMModel])
async def get_models(
    provider: LLMProvider,
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> list[LLMModel]:
    """Get list of models for a specific provider.

    Args:
        provider: The LLM provider to get models for.
        service: The LLM config service.

    Returns:
        list[LLMModel]: List of available models.
    """
    try:
        return await service.get_models(provider)
    except Exception as e:
        logger.error(f"Failed to get models for {provider}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve models",
        ) from e


# =============================================================================
# API Key Endpoints
# =============================================================================


@router.get("/keys", response_model=list[APIKey])
async def get_keys(
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> list[APIKey]:
    """Get list of all API keys (masked).

    Returns:
        list[APIKey]: List of keys with masked values.
    """
    try:
        return await service.get_keys()
    except Exception as e:
        logger.error(f"Failed to get keys: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve API keys",
        ) from e


@router.post("/keys", response_model=APIKey, status_code=status.HTTP_201_CREATED)
async def add_key(
    key_create: APIKeyCreate,
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> APIKey:
    """Add a new API key.

    The key is encrypted before storage. Only the masked version is returned.

    Args:
        key_create: The key creation request.
        service: The LLM config service.

    Returns:
        APIKey: The created key with masked value.
    """
    try:
        return await service.add_key(key_create)
    except Exception as e:
        logger.error(f"Failed to add key: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add API key",
        ) from e


@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(
    key_id: Annotated[str, Path(description="The ID of the key to delete")],
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> Response:
    """Delete an API key.

    Args:
        key_id: The ID of the key to delete.
        service: The LLM config service.

    Returns:
        Response: Empty response on success.

    Raises:
        HTTPException: 404 if key not found.
    """
    try:
        deleted = await service.delete_key(key_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found",
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete key {key_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API key",
        ) from e


# =============================================================================
# Model Discovery Endpoints (T26)
# =============================================================================


@router.get("/keys/{key_id}/models", response_model=list[dict[str, Any]])
async def get_key_models(
    key_id: Annotated[str, Path(description="The ID of the API key")],
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> list[dict[str, Any]]:
    """Get cached models for this API key.

    Returns models from cache or triggers discovery if not cached.

    Args:
        key_id: The ID of the API key.
        service: The LLM config service.

    Returns:
        list[dict]: List of discovered models.
    """
    try:
        return await service.get_cached_models(key_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    except Exception as e:
        logger.error(f"Failed to get models for key {key_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve models",
        ) from e


@router.post("/keys/{key_id}/discover", response_model=list[dict[str, Any]])
async def discover_key_models(
    key_id: Annotated[str, Path(description="The ID of the API key")],
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> list[dict[str, Any]]:
    """Force re-discovery of models for this key.

    Bypasses cache and fetches models directly from the vendor API.

    Args:
        key_id: The ID of the API key.
        service: The LLM config service.

    Returns:
        list[dict]: List of discovered models.
    """
    try:
        return await service.discover_and_cache_models(key_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    except Exception as e:
        logger.error(f"Failed to discover models for key {key_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to discover models",
        ) from e



@router.post("/keys/{key_id}/test", response_model=KeyTestResponse)
async def test_key(
    key_id: Annotated[str, Path(description="The ID of the API key")],
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> KeyTestResponse:
    """Test an API key by making a minimal API call to the provider.

    This endpoint verifies that an API key works by attempting to list
    models from the corresponding provider's API.

    Args:
        key_id: The ID of the API key to test.
        service: The LLM config service.

    Returns:
        KeyTestResponse: Test result with success status, message, and model count.
    """
    try:
        result = await service.test_api_key(key_id)
        return KeyTestResponse(**result)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    except Exception as e:
        logger.error(f"Failed to test key {key_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test API key",
        ) from e


# =============================================================================
# Agent Configuration Endpoints
# =============================================================================


@router.get("/agents", response_model=list[AgentLLMConfig])
async def get_agents(
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> list[AgentLLMConfig]:
    """Get configurations for all agent roles.

    Returns:
        list[AgentLLMConfig]: List of all agent configurations.
    """
    try:
        return await service.get_all_agent_configs()
    except Exception as e:
        logger.error(f"Failed to get agent configs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve agent configurations",
        ) from e


@router.get("/agents/{role}", response_model=AgentLLMConfig)
async def get_agent_config(
    role: AgentRole,
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> AgentLLMConfig:
    """Get configuration for a specific agent role.

    Args:
        role: The agent role to get configuration for.
        service: The LLM config service.

    Returns:
        AgentLLMConfig: The agent's configuration.
    """
    try:
        return await service.get_agent_config(role)
    except Exception as e:
        logger.error(f"Failed to get config for {role}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve agent configuration",
        ) from e


@router.put("/agents/{role}", response_model=AgentLLMConfig)
async def update_agent_config(
    role: AgentRole,
    update: AgentConfigUpdate,
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> AgentLLMConfig:
    """Update configuration for a specific agent role.

    Supports partial updates - only fields provided in the request body
    will be updated. Existing values are preserved for omitted fields.

    Args:
        role: The agent role to update.
        update: Partial configuration update (all fields optional).
        service: The LLM config service.

    Returns:
        AgentLLMConfig: The updated configuration.
    """
    try:
        return await service.partial_update_agent_config(role, update)
    except Exception as e:
        logger.error(f"Failed to update config for {role}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update agent configuration",
        ) from e


# =============================================================================
# Config Export/Import Endpoints (T31)
# =============================================================================


@router.get("/config/export", response_model=dict[str, Any])
async def export_config(
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> dict[str, Any]:
    """Export full config as JSON.

    Returns:
        dict: Full configuration including agents and key IDs.
    """
    try:
        return await service.export_config()
    except Exception as e:
        logger.error(f"Failed to export config: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export configuration",
        ) from e


@router.get("/config/export/env", response_model=EnvExportResponse)
async def export_config_env(
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> EnvExportResponse:
    """Export config as .env format.

    Returns:
        EnvExportResponse: .env content and filename.
    """
    try:
        config = await service.export_config()
        env_content = _generate_env_format(config)
        return EnvExportResponse(content=env_content, filename="llm-config.env")
    except Exception as e:
        logger.error(f"Failed to export config as env: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export configuration",
        ) from e


@router.post("/config/import", response_model=ImportResponse)
async def import_config(
    config: dict[str, Any],
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> ImportResponse:
    """Import config from JSON.

    Args:
        config: Configuration dict with agents section.
        service: The LLM config service.

    Returns:
        ImportResponse: Import result.
    """
    try:
        result = await service.import_config(config)
        return ImportResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to import config: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to import configuration",
        ) from e


@router.post("/config/validate", response_model=ValidationResponse)
async def validate_config(config: dict[str, Any]) -> ValidationResponse:
    """Validate config JSON structure.

    Args:
        config: Configuration dict to validate.

    Returns:
        ValidationResponse: Validation result with errors if any.
    """
    try:
        LLMConfigImport(**config)
        return ValidationResponse(valid=True)
    except ValidationError as e:
        return ValidationResponse(valid=False, errors=e.errors())


# =============================================================================
# Helper Functions
# =============================================================================


def _generate_env_format(config: dict[str, Any]) -> str:
    """Generate .env format from config dict.

    Args:
        config: Configuration dict with agents section.

    Returns:
        str: Configuration in .env format.
    """
    lines = [
        "# LLM Configuration - Generated by aSDLC Admin",
        f"# Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]

    agents = config.get("agents", {})

    for role, agent_config in agents.items():
        role_upper = role.upper()
        lines.append(f"# {role.title()} Agent")
        lines.append(f"LLM_{role_upper}_PROVIDER={agent_config.get('provider', '')}")
        lines.append(f"LLM_{role_upper}_MODEL={agent_config.get('model', '')}")
        lines.append(f"LLM_{role_upper}_API_KEY_ID={agent_config.get('api_key_id', '')}")
        lines.append(f"LLM_{role_upper}_TEMPERATURE={agent_config.get('temperature', 0.2)}")
        lines.append(f"LLM_{role_upper}_MAX_TOKENS={agent_config.get('max_tokens', 16384)}")
        lines.append("")

    lines.append("# API Keys (IDs only - actual keys stored securely)")
    lines.append("# To use in deployment, set these environment variables:")
    lines.append("# ANTHROPIC_API_KEY=your-key-here")
    lines.append("# OPENAI_API_KEY=your-key-here")
    lines.append("# GOOGLE_API_KEY=your-key-here")

    return "\n".join(lines)


# =============================================================================
# Agent Connection Test Endpoint
# =============================================================================


class AgentConnectionTestResponse(BaseModel):
    """Response model for agent connection test."""

    success: bool
    message: str
    latency_ms: float | None = None


@router.post("/agents/{role}/test", response_model=AgentConnectionTestResponse)
async def test_agent_connection(
    role: AgentRole,
    service: Annotated[LLMConfigService, Depends(get_llm_config_service)],
) -> AgentConnectionTestResponse:
    """Test LLM connectivity for a specific agent role.

    This endpoint verifies that an agent can successfully communicate with its
    configured LLM provider. It makes a simple test call to the LLM with a
    short prompt and measures latency.

    Args:
        role: The agent role to test.
        service: The LLM config service.

    Returns:
        AgentConnectionTestResponse: Test result with success status, message,
            and latency in milliseconds.
    """
    try:
        result = await service.test_agent_connection(role)
        return AgentConnectionTestResponse(**result)
    except Exception as e:
        logger.error(f"Failed to test agent connection for {role}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test agent connection",
        ) from e
