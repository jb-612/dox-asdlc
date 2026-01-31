"""Model Discovery Service.

This module provides a service for discovering available models from
LLM vendor APIs (Anthropic, OpenAI, Google).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any

import httpx


logger = logging.getLogger(__name__)


@dataclass
class DiscoveredModel:
    """A model discovered from a vendor API.

    Attributes:
        id: Exact vendor model ID (e.g., "claude-sonnet-4-20250514").
        name: Display name (e.g., "Claude Sonnet 4").
        provider: The LLM provider (anthropic, openai, google).
        context_window: Maximum context window size in tokens.
        max_output: Maximum output tokens.
        capabilities: List of capabilities (chat, vision, tools, etc.).
        deprecated: Whether the vendor marks this model as deprecated.
        discovered_at: ISO timestamp when this info was fetched.
    """

    id: str
    name: str
    provider: str
    context_window: int
    max_output: int
    capabilities: list[str]
    deprecated: bool
    discovered_at: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation.

        Returns:
            dict: Dictionary with all fields.
        """
        return asdict(self)


class ModelDiscoveryService:
    """Discovers available models from LLM vendor APIs.

    This service queries vendor APIs to fetch the list of available models.
    Results are typically cached in Redis for 24 hours.

    Usage:
        service = ModelDiscoveryService()
        models = await service.discover_models("anthropic", "api-key-here")
    """

    # Default context windows when not provided by API
    DEFAULT_CONTEXT_WINDOWS = {
        "anthropic": 200000,
        "openai": 128000,
        "google": 1000000,
    }

    # Default max output when not provided by API
    DEFAULT_MAX_OUTPUT = {
        "anthropic": 8192,
        "openai": 4096,
        "google": 8192,
    }

    def __init__(self) -> None:
        """Initialize the model discovery service."""
        pass

    async def discover_models(
        self, provider: str, api_key: str
    ) -> list[DiscoveredModel]:
        """Discover models for a provider using the API key.

        Args:
            provider: The LLM provider ("anthropic", "openai", "google").
            api_key: The API key for authenticating with the provider.

        Returns:
            list[DiscoveredModel]: List of discovered models, empty if error.
        """
        if provider == "anthropic":
            return await self._discover_anthropic(api_key)
        elif provider == "openai":
            return await self._discover_openai(api_key)
        elif provider == "google":
            return await self._discover_google(api_key)
        return []

    async def _discover_anthropic(self, api_key: str) -> list[DiscoveredModel]:
        """Fetch models from Anthropic API.

        Calls: https://api.anthropic.com/v1/models

        Args:
            api_key: The Anthropic API key.

        Returns:
            list[DiscoveredModel]: List of discovered models.
        """
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                    },
                    timeout=30.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        self._map_anthropic_model(m)
                        for m in data.get("data", [])
                    ]
                else:
                    logger.warning(
                        f"Anthropic API returned status {resp.status_code}"
                    )
                    return []
        except httpx.RequestError as e:
            logger.error(f"Error discovering Anthropic models: {e}")
            return []

    async def _discover_openai(self, api_key: str) -> list[DiscoveredModel]:
        """Fetch models from OpenAI API.

        Calls: https://api.openai.com/v1/models

        Args:
            api_key: The OpenAI API key.

        Returns:
            list[DiscoveredModel]: List of discovered models (filtered to chat models).
        """
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=30.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Filter for chat models (gpt-4*, gpt-3.5*, o1*, o3*)
                    chat_models = [
                        m
                        for m in data.get("data", [])
                        if m["id"].startswith(("gpt-4", "gpt-3.5", "o1", "o3"))
                    ]
                    return [self._map_openai_model(m) for m in chat_models]
                else:
                    logger.warning(
                        f"OpenAI API returned status {resp.status_code}"
                    )
                    return []
        except httpx.RequestError as e:
            logger.error(f"Error discovering OpenAI models: {e}")
            return []

    async def _discover_google(self, api_key: str) -> list[DiscoveredModel]:
        """Fetch models from Google Generative AI API.

        Calls: https://generativelanguage.googleapis.com/v1/models

        Args:
            api_key: The Google API key.

        Returns:
            list[DiscoveredModel]: List of discovered models.
        """
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://generativelanguage.googleapis.com/v1/models?key={api_key}",
                    timeout=30.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Filter for models that support generateContent
                    generative_models = [
                        m
                        for m in data.get("models", [])
                        if "generateContent"
                        in m.get("supportedGenerationMethods", [])
                    ]
                    return [self._map_google_model(m) for m in generative_models]
                else:
                    logger.warning(
                        f"Google API returned status {resp.status_code}"
                    )
                    return []
        except httpx.RequestError as e:
            logger.error(f"Error discovering Google models: {e}")
            return []

    def _map_anthropic_model(self, m: dict[str, Any]) -> DiscoveredModel:
        """Map Anthropic API response to DiscoveredModel.

        Args:
            m: Raw model data from Anthropic API.

        Returns:
            DiscoveredModel: Mapped model.
        """
        return DiscoveredModel(
            id=m.get("id", ""),
            name=m.get("display_name", m.get("id", "")),
            provider="anthropic",
            context_window=m.get(
                "context_window", self.DEFAULT_CONTEXT_WINDOWS["anthropic"]
            ),
            max_output=m.get("max_tokens", self.DEFAULT_MAX_OUTPUT["anthropic"]),
            capabilities=["chat", "tools"],
            deprecated=False,
            discovered_at=datetime.now(timezone.utc).isoformat(),
        )

    def _map_openai_model(self, m: dict[str, Any]) -> DiscoveredModel:
        """Map OpenAI API response to DiscoveredModel.

        Args:
            m: Raw model data from OpenAI API.

        Returns:
            DiscoveredModel: Mapped model.
        """
        model_id = m.get("id", "")
        
        # Determine context window based on model ID
        if "gpt-4" in model_id:
            context_window = 128000
        elif "gpt-3.5" in model_id:
            context_window = 16385
        else:
            context_window = self.DEFAULT_CONTEXT_WINDOWS["openai"]

        return DiscoveredModel(
            id=model_id,
            name=model_id,  # OpenAI doesn't provide display names
            provider="openai",
            context_window=context_window,
            max_output=self.DEFAULT_MAX_OUTPUT["openai"],
            capabilities=["chat", "tools"],
            deprecated=False,
            discovered_at=datetime.now(timezone.utc).isoformat(),
        )

    def _map_google_model(self, m: dict[str, Any]) -> DiscoveredModel:
        """Map Google API response to DiscoveredModel.

        Args:
            m: Raw model data from Google API.

        Returns:
            DiscoveredModel: Mapped model.
        """
        # Google model names are like "models/gemini-1.5-pro"
        full_name = m.get("name", "")
        model_id = full_name.replace("models/", "") if full_name else ""

        return DiscoveredModel(
            id=model_id,
            name=m.get("displayName", model_id),
            provider="google",
            context_window=m.get(
                "inputTokenLimit", self.DEFAULT_CONTEXT_WINDOWS["google"]
            ),
            max_output=m.get(
                "outputTokenLimit", self.DEFAULT_MAX_OUTPUT["google"]
            ),
            capabilities=["chat", "tools"],
            deprecated=False,
            discovered_at=datetime.now(timezone.utc).isoformat(),
        )
