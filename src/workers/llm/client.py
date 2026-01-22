"""LLM client interface and stub implementation.

Provides an interface for Claude SDK integration. The stub implementation
is used for testing and development. Full implementation will be added
in P03-F03 (RLM native implementation).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

from src.core.exceptions import ASDLCError

logger = logging.getLogger(__name__)


class LLMClientError(ASDLCError):
    """Raised when LLM client operations fail."""

    pass


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


@runtime_checkable
class LLMClient(Protocol):
    """Protocol for LLM client implementations.

    Defines the interface for interacting with language models.
    Implementations can wrap different providers (Claude, OpenAI, etc.)
    """

    @property
    def model_name(self) -> str:
        """Return the model name."""
        ...

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

    async def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: The text to count tokens for.

        Returns:
            int: Approximate token count.
        """
        ...


class StubLLMClient:
    """Stub LLM client for testing and development.

    Provides configurable responses and tracks all calls for verification.
    Use this for unit testing agents and the worker framework.

    Example:
        # Basic usage
        client = StubLLMClient()
        response = await client.generate(prompt="Hello")

        # With custom responses
        client = StubLLMClient(responses=[
            LLMResponse(content="First response", model="stub"),
            LLMResponse(content="Second response", model="stub"),
        ])

        # Simulate errors
        client = StubLLMClient(error=LLMClientError("Rate limited"))
    """

    def __init__(
        self,
        responses: list[LLMResponse] | None = None,
        error: Exception | None = None,
        model_name: str = "stub-model",
    ) -> None:
        """Initialize the stub client.

        Args:
            responses: List of responses to return (cycles through them).
            error: Exception to raise on generate calls.
            model_name: Name to report as the model.
        """
        self._responses = responses or [
            LLMResponse(
                content="This is a stub LLM response.",
                model=model_name,
                usage={"input_tokens": 10, "output_tokens": 20},
            )
        ]
        self._error = error
        self._model_name = model_name
        self._call_index = 0
        self.calls: list[dict[str, Any]] = []

    @property
    def model_name(self) -> str:
        """Return the model name."""
        return self._model_name

    async def generate(
        self,
        prompt: str = "",
        system: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate a stub response.

        Args:
            prompt: The user prompt.
            system: Optional system message.
            messages: Optional conversation history.
            tools: Optional tool definitions.
            **kwargs: Additional parameters (ignored).

        Returns:
            LLMResponse: The configured stub response.

        Raises:
            LLMClientError: If configured to raise an error.
        """
        # Track the call
        self.calls.append({
            "prompt": prompt,
            "system": system,
            "messages": messages,
            "tools": tools,
            "kwargs": kwargs,
        })

        # Raise error if configured
        if self._error:
            raise self._error

        # Return the next response (cycling)
        response = self._responses[self._call_index % len(self._responses)]
        self._call_index += 1

        logger.debug(f"StubLLMClient returning response #{self._call_index}")
        return response

    async def count_tokens(self, text: str) -> int:
        """Estimate token count using simple word-based heuristic.

        Args:
            text: The text to count tokens for.

        Returns:
            int: Estimated token count (words * 1.3).
        """
        words = len(text.split())
        # Simple estimate: ~1.3 tokens per word on average
        return int(words * 1.3)
