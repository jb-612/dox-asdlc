"""Google LLM Client.

This module provides the Google (Gemini) implementation of BaseLLMClient.
Uses the google-generativeai SDK for API calls.
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


class GoogleClient(BaseLLMClient):
    """Google Generative AI client for Gemini models.

    Implements BaseLLMClient using the google-generativeai SDK.

    Usage:
        client = GoogleClient(
            api_key="...",
            model="gemini-1.5-pro",
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
        """Initialize the Google client.

        Args:
            api_key: Google API key.
            model: Model identifier (e.g., gemini-1.5-pro).
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
        self._model_instance = None

    def _get_model(self) -> Any:
        """Get or create the generative model instance.

        Returns:
            GenerativeModel: The model instance.
        """
        if self._model_instance is None:
            import google.generativeai as genai

            genai.configure(api_key=self._api_key)
            self._model_instance = genai.GenerativeModel(self._model)
        return self._model_instance

    @property
    def provider(self) -> str:
        """Return the provider name.

        Returns:
            str: 'google'.
        """
        return "google"

    def _build_google_content(
        self,
        prompt: str,
        system: str | None,
        messages: list[dict[str, Any]] | None,
    ) -> list[dict[str, Any]]:
        """Build Google-formatted content.

        Args:
            prompt: The user prompt.
            system: Optional system message (prepended to first user message).
            messages: Optional conversation history.

        Returns:
            list[dict[str, Any]]: Google-formatted content.
        """
        result: list[dict[str, Any]] = []

        if messages:
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")

                # Google uses 'user' and 'model' roles
                google_role = "model" if role == "assistant" else "user"
                result.append({
                    "role": google_role,
                    "parts": [{"text": content}],
                })

        if prompt:
            # If we have a system message, prepend it to the user prompt
            full_prompt = prompt
            if system and not messages:  # Only prepend system for first message
                full_prompt = f"{system}\n\n{prompt}"

            result.append({
                "role": "user",
                "parts": [{"text": full_prompt}],
            })

        return result

    async def generate(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a response from Gemini.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional parameters (passed to API).

        Returns:
            LLMResponse: The model's response.
        """
        import google.generativeai as genai

        model = self._get_model()

        # Build content
        content = self._build_google_content(prompt, system, messages)

        # Build generation config
        generation_config = genai.GenerationConfig(
            temperature=kwargs.get("temperature", self._temperature),
            max_output_tokens=kwargs.get("max_tokens", self._max_tokens),
        )

        if self._top_p is not None:
            generation_config.top_p = self._top_p

        if self._top_k is not None:
            generation_config.top_k = self._top_k

        logger.debug(f"Google API call: model={self._model}, content_parts={len(content)}")

        # Make async call
        response = await model.generate_content_async(
            content,
            generation_config=generation_config,
        )

        # Extract content
        text_content = ""
        if response.text:
            text_content = response.text

        # Get usage stats if available
        usage = {}
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = {
                "input_tokens": response.usage_metadata.prompt_token_count or 0,
                "output_tokens": response.usage_metadata.candidates_token_count or 0,
            }

        return LLMResponse(
            content=text_content,
            model=self._model,
            tool_calls=[],
            usage=usage,
            stop_reason=response.candidates[0].finish_reason.name if response.candidates else None,
        )

    async def generate_stream(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[StreamChunk]:
        """Generate a streaming response from Gemini.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional parameters (passed to API).

        Yields:
            StreamChunk: Chunks of the response as they arrive.
        """
        import google.generativeai as genai

        model = self._get_model()

        # Build content
        content = self._build_google_content(prompt, system, messages)

        # Build generation config
        generation_config = genai.GenerationConfig(
            temperature=kwargs.get("temperature", self._temperature),
            max_output_tokens=kwargs.get("max_tokens", self._max_tokens),
        )

        if self._top_p is not None:
            generation_config.top_p = self._top_p

        if self._top_k is not None:
            generation_config.top_k = self._top_k

        logger.debug(f"Google streaming API call: model={self._model}")

        # Make streaming call
        response = await model.generate_content_async(
            content,
            generation_config=generation_config,
            stream=True,
        )

        async for chunk in response:
            if chunk.text:
                yield StreamChunk(content=chunk.text, is_final=False)

        # Final chunk with usage
        usage = {}
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            usage = {
                "input_tokens": response.usage_metadata.prompt_token_count or 0,
                "output_tokens": response.usage_metadata.candidates_token_count or 0,
            }

        yield StreamChunk(
            content="",
            is_final=True,
            usage=usage if usage else None,
        )
