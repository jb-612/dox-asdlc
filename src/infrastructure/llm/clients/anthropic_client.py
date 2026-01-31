"""Anthropic LLM Client.

This module provides the Anthropic (Claude) implementation of BaseLLMClient.
Uses the anthropic SDK for API calls.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from src.infrastructure.llm.base_client import (
    BaseLLMClient,
    LLMResponse,
    StreamChunk,
)


logger = logging.getLogger(__name__)


class AnthropicClient(BaseLLMClient):
    """Anthropic API client for Claude models.

    Implements BaseLLMClient using the anthropic SDK.

    Usage:
        client = AnthropicClient(
            api_key="sk-ant-...",
            model="claude-sonnet-4-20250514",
        )
        response = await client.generate(prompt="Hello!")
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
        """Initialize the Anthropic client.

        Args:
            api_key: Anthropic API key.
            model: Model identifier (e.g., claude-sonnet-4-20250514).
            temperature: Sampling temperature (0.0-1.0).
            max_tokens: Maximum tokens in response.
            top_p: Nucleus sampling parameter.
            top_k: Top-k sampling parameter.
        """
        super().__init__(
            api_key=api_key,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            top_k=top_k,
        )
        self._client = None

    def _get_client(self) -> Any:
        """Get or create the anthropic client.

        Returns:
            anthropic.AsyncAnthropic: The client instance.
        """
        if self._client is None:
            import anthropic

            self._client = anthropic.AsyncAnthropic(api_key=self._api_key)
        return self._client

    @property
    def provider(self) -> str:
        """Return the provider name.

        Returns:
            str: 'anthropic'.
        """
        return "anthropic"

    async def generate(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a response from Claude.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional parameters (passed to API).

        Returns:
            LLMResponse: The model's response.
        """
        client = self._get_client()

        # Build messages
        api_messages = self._build_messages(prompt, system, messages)

        # Build request parameters
        params: dict[str, Any] = {
            "model": self._model,
            "max_tokens": kwargs.get("max_tokens", self._max_tokens),
            "temperature": kwargs.get("temperature", self._temperature),
            "messages": api_messages,
        }

        if system:
            params["system"] = system

        if self._top_p is not None:
            params["top_p"] = self._top_p

        if self._top_k is not None:
            params["top_k"] = self._top_k

        if tools:
            params["tools"] = tools

        logger.debug(f"Anthropic API call: model={self._model}, messages={len(api_messages)}")

        response = await client.messages.create(**params)

        # Extract content
        content = ""
        tool_calls = []

        for block in response.content:
            if hasattr(block, "text"):
                content += block.text
            elif hasattr(block, "type") and block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })

        return LLMResponse(
            content=content,
            model=response.model,
            tool_calls=tool_calls,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            stop_reason=response.stop_reason,
        )

    async def generate_stream(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Generate a streaming response from Claude.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional parameters (passed to API).

        Yields:
            StreamChunk: Chunks of the response as they arrive.
        """
        client = self._get_client()

        # Build messages
        api_messages = self._build_messages(prompt, system, messages)

        # Build request parameters
        params: dict[str, Any] = {
            "model": self._model,
            "max_tokens": kwargs.get("max_tokens", self._max_tokens),
            "temperature": kwargs.get("temperature", self._temperature),
            "messages": api_messages,
        }

        if system:
            params["system"] = system

        if self._top_p is not None:
            params["top_p"] = self._top_p

        if self._top_k is not None:
            params["top_k"] = self._top_k

        if tools:
            params["tools"] = tools

        logger.debug(f"Anthropic streaming API call: model={self._model}")

        async with client.messages.stream(**params) as stream:
            async for text in stream.text_stream:
                yield StreamChunk(content=text, is_final=False)

            # Get final message for usage stats
            final_message = await stream.get_final_message()
            yield StreamChunk(
                content="",
                is_final=True,
                usage={
                    "input_tokens": final_message.usage.input_tokens,
                    "output_tokens": final_message.usage.output_tokens,
                },
            )
