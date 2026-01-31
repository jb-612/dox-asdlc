"""Base LLM Client interface.

This module defines the abstract base class for LLM client implementations.
All provider-specific clients (Anthropic, OpenAI, Google) must implement this interface.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator


logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Response from an LLM call.

    Attributes:
        content: Text content of the response.
        model: Model that generated the response.
        tool_calls: List of tool calls requested by the model.
        usage: Token usage statistics.
        stop_reason: Reason the model stopped generating.
    """

    content: str
    model: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    stop_reason: str | None = None


@dataclass
class StreamChunk:
    """A chunk from a streaming LLM response.

    Attributes:
        content: Text content of this chunk.
        is_final: Whether this is the final chunk.
        usage: Token usage (only present in final chunk).
    """

    content: str
    is_final: bool = False
    usage: dict[str, int] | None = None


class BaseLLMClient(ABC):
    """Abstract base class for LLM client implementations.

    Defines the interface that all provider-specific clients must implement.
    Provides common properties and methods for LLM interactions.

    Attributes:
        provider: The LLM provider name (anthropic, openai, google).
        model: The model identifier.
        api_key: The API key for authentication.
        temperature: Sampling temperature (0.0-1.0).
        max_tokens: Maximum tokens in response.
        top_p: Nucleus sampling parameter.
        top_k: Top-k sampling parameter.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float = 0.2,
        max_tokens: int = 16384,
        top_p: float | None = None,
        top_k: int | None = None,
    ) -> None:
        """Initialize the base LLM client.

        Args:
            api_key: API key for authentication.
            model: Model identifier.
            temperature: Sampling temperature (0.0-1.0).
            max_tokens: Maximum tokens in response.
            top_p: Nucleus sampling parameter.
            top_k: Top-k sampling parameter.
        """
        self._api_key = api_key
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._top_p = top_p
        self._top_k = top_k

    @property
    @abstractmethod
    def provider(self) -> str:
        """Return the provider name.

        Returns:
            str: Provider name (anthropic, openai, google).
        """
        ...

    @property
    def model(self) -> str:
        """Return the model identifier.

        Returns:
            str: Model identifier.
        """
        return self._model

    @property
    def temperature(self) -> float:
        """Return the temperature setting.

        Returns:
            float: Temperature value.
        """
        return self._temperature

    @property
    def max_tokens(self) -> int:
        """Return the max_tokens setting.

        Returns:
            int: Max tokens value.
        """
        return self._max_tokens

    @abstractmethod
    async def generate(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a response from the LLM.

        Args:
            prompt: The user prompt (for simple single-turn).
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional model-specific parameters.

        Returns:
            LLMResponse: The model's response.
        """
        ...

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Generate a streaming response from the LLM.

        Args:
            prompt: The user prompt (for simple single-turn).
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional model-specific parameters.

        Yields:
            StreamChunk: Chunks of the response as they arrive.
        """
        ...

    def _build_messages(
        self,
        prompt: str,
        system: str | None,
        messages: list[dict[str, Any]] | None,
    ) -> list[dict[str, Any]]:
        """Build a message list from prompt and optional conversation history.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.

        Returns:
            list[dict[str, Any]]: List of messages for the API call.
        """
        result: list[dict[str, Any]] = []

        if messages:
            result.extend(messages)

        if prompt:
            result.append({"role": "user", "content": prompt})

        return result
