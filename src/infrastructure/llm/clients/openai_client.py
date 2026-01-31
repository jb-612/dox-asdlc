"""OpenAI LLM Client.

This module provides the OpenAI (GPT) implementation of BaseLLMClient.
Uses the openai SDK for API calls.
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


class OpenAIClient(BaseLLMClient):
    """OpenAI API client for GPT models.

    Implements BaseLLMClient using the openai SDK.

    Usage:
        client = OpenAIClient(
            api_key="sk-...",
            model="gpt-4-turbo",
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
        """Initialize the OpenAI client.

        Args:
            api_key: OpenAI API key.
            model: Model identifier (e.g., gpt-4-turbo).
            temperature: Sampling temperature (0.0-1.0).
            max_tokens: Maximum tokens in response.
            top_p: Nucleus sampling parameter.
            top_k: Top-k sampling parameter (not used by OpenAI, ignored).
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
        """Get or create the OpenAI client.

        Returns:
            openai.AsyncOpenAI: The client instance.
        """
        if self._client is None:
            import openai

            self._client = openai.AsyncOpenAI(api_key=self._api_key)
        return self._client

    @property
    def provider(self) -> str:
        """Return the provider name.

        Returns:
            str: 'openai'.
        """
        return "openai"

    def _build_openai_messages(
        self,
        prompt: str,
        system: str | None,
        messages: list[dict[str, Any]] | None,
    ) -> list[dict[str, Any]]:
        """Build OpenAI-formatted messages.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.

        Returns:
            list[dict[str, Any]]: OpenAI-formatted messages.
        """
        result: list[dict[str, Any]] = []

        if system:
            result.append({"role": "system", "content": system})

        if messages:
            result.extend(messages)

        if prompt:
            result.append({"role": "user", "content": prompt})

        return result

    async def generate(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a response from GPT.

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
        api_messages = self._build_openai_messages(prompt, system, messages)

        # Build request parameters
        params: dict[str, Any] = {
            "model": self._model,
            "max_tokens": kwargs.get("max_tokens", self._max_tokens),
            "temperature": kwargs.get("temperature", self._temperature),
            "messages": api_messages,
        }

        if self._top_p is not None:
            params["top_p"] = self._top_p

        if tools:
            # Convert to OpenAI tool format
            params["tools"] = [
                {
                    "type": "function",
                    "function": tool,
                }
                for tool in tools
            ]

        logger.debug(f"OpenAI API call: model={self._model}, messages={len(api_messages)}")

        response = await client.chat.completions.create(**params)

        # Extract content
        choice = response.choices[0]
        content = choice.message.content or ""

        # Extract tool calls if present
        tool_calls = []
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "input": tc.function.arguments,
                })

        return LLMResponse(
            content=content,
            model=response.model,
            tool_calls=tool_calls,
            usage={
                "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                "output_tokens": response.usage.completion_tokens if response.usage else 0,
            },
            stop_reason=choice.finish_reason,
        )

    async def generate_stream(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Generate a streaming response from GPT.

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
        api_messages = self._build_openai_messages(prompt, system, messages)

        # Build request parameters
        params: dict[str, Any] = {
            "model": self._model,
            "max_tokens": kwargs.get("max_tokens", self._max_tokens),
            "temperature": kwargs.get("temperature", self._temperature),
            "messages": api_messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }

        if self._top_p is not None:
            params["top_p"] = self._top_p

        if tools:
            params["tools"] = [
                {
                    "type": "function",
                    "function": tool,
                }
                for tool in tools
            ]

        logger.debug(f"OpenAI streaming API call: model={self._model}")

        async for chunk in await client.chat.completions.create(**params):
            if chunk.choices and chunk.choices[0].delta.content:
                yield StreamChunk(
                    content=chunk.choices[0].delta.content,
                    is_final=False,
                )

            # Check for usage in final chunk
            if chunk.usage:
                yield StreamChunk(
                    content="",
                    is_final=True,
                    usage={
                        "input_tokens": chunk.usage.prompt_tokens,
                        "output_tokens": chunk.usage.completion_tokens,
                    },
                )
