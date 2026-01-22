"""Unit tests for LLM client.

Tests the LLMClient interface and stub implementation.
"""

from __future__ import annotations

import pytest
from typing import Any
from unittest.mock import AsyncMock

from src.workers.llm.client import (
    LLMClient,
    LLMResponse,
    StubLLMClient,
    LLMClientError,
)


class TestLLMResponse:
    """Tests for LLMResponse dataclass."""

    def test_response_with_text(self):
        """LLMResponse stores text content."""
        response = LLMResponse(
            content="This is the LLM response",
            model="claude-3-opus",
            usage={"input_tokens": 100, "output_tokens": 50},
        )

        assert response.content == "This is the LLM response"
        assert response.model == "claude-3-opus"
        assert response.usage["input_tokens"] == 100

    def test_response_with_tool_calls(self):
        """LLMResponse can include tool calls."""
        tool_calls = [
            {"name": "read_file", "arguments": {"path": "/src/main.py"}},
            {"name": "write_file", "arguments": {"path": "/src/main.py", "content": "..."}},
        ]
        response = LLMResponse(
            content="",
            model="claude-3-opus",
            tool_calls=tool_calls,
        )

        assert len(response.tool_calls) == 2
        assert response.tool_calls[0]["name"] == "read_file"

    def test_response_defaults(self):
        """LLMResponse has sensible defaults."""
        response = LLMResponse(content="response", model="claude-3")

        assert response.tool_calls == []
        assert response.usage == {}
        assert response.stop_reason is None


class TestStubLLMClient:
    """Tests for StubLLMClient class."""

    @pytest.fixture
    def client(self):
        """Create a StubLLMClient."""
        return StubLLMClient()

    async def test_generate_returns_response(self, client):
        """StubLLMClient returns LLMResponse."""
        response = await client.generate(
            prompt="Write a hello world function",
            system="You are a helpful assistant",
        )

        assert isinstance(response, LLMResponse)
        assert response.content is not None
        assert response.model == "stub-model"

    async def test_generate_with_custom_response(self):
        """StubLLMClient can be configured with custom responses."""
        custom_response = LLMResponse(
            content="Custom response content",
            model="custom-model",
            usage={"input_tokens": 10, "output_tokens": 5},
        )
        client = StubLLMClient(responses=[custom_response])

        response = await client.generate(prompt="test")

        assert response.content == "Custom response content"
        assert response.model == "custom-model"

    async def test_generate_cycles_through_responses(self):
        """StubLLMClient cycles through configured responses."""
        responses = [
            LLMResponse(content="First", model="stub"),
            LLMResponse(content="Second", model="stub"),
        ]
        client = StubLLMClient(responses=responses)

        r1 = await client.generate(prompt="test")
        r2 = await client.generate(prompt="test")
        r3 = await client.generate(prompt="test")  # Cycles back

        assert r1.content == "First"
        assert r2.content == "Second"
        assert r3.content == "First"

    async def test_generate_with_error(self):
        """StubLLMClient can simulate errors."""
        client = StubLLMClient(error=LLMClientError("API error"))

        with pytest.raises(LLMClientError, match="API error"):
            await client.generate(prompt="test")

    async def test_generate_tracks_calls(self):
        """StubLLMClient tracks generate calls."""
        client = StubLLMClient()

        await client.generate(prompt="first prompt", system="system1")
        await client.generate(prompt="second prompt")

        assert len(client.calls) == 2
        assert client.calls[0]["prompt"] == "first prompt"
        assert client.calls[0]["system"] == "system1"
        assert client.calls[1]["prompt"] == "second prompt"

    async def test_generate_with_tools(self, client):
        """StubLLMClient accepts tools parameter."""
        tools = [
            {"name": "read_file", "description": "Read a file"},
        ]

        response = await client.generate(prompt="test", tools=tools)

        # Should work without error
        assert response is not None

    async def test_generate_with_messages(self, client):
        """StubLLMClient accepts messages parameter."""
        messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there"},
            {"role": "user", "content": "How are you?"},
        ]

        response = await client.generate(messages=messages)

        assert response is not None

    async def test_count_tokens(self, client):
        """StubLLMClient estimates token count."""
        text = "This is a test sentence with several words."

        count = await client.count_tokens(text)

        # Stub uses simple word-based estimate
        assert count > 0

    def test_client_model_name(self, client):
        """StubLLMClient reports model name."""
        assert client.model_name == "stub-model"

    def test_custom_model_name(self):
        """StubLLMClient can have custom model name."""
        client = StubLLMClient(model_name="custom-stub")
        assert client.model_name == "custom-stub"


class TestLLMClientProtocol:
    """Tests for LLMClient protocol."""

    def test_stub_implements_protocol(self):
        """StubLLMClient implements LLMClient protocol."""
        client = StubLLMClient()

        # Protocol requires these
        assert hasattr(client, "generate")
        assert hasattr(client, "count_tokens")
        assert hasattr(client, "model_name")

    async def test_protocol_allows_different_implementations(self):
        """Different implementations can satisfy the protocol."""

        class MockLLMClient:
            @property
            def model_name(self) -> str:
                return "mock"

            async def generate(
                self,
                prompt: str = "",
                system: str | None = None,
                messages: list[dict] | None = None,
                tools: list[dict] | None = None,
                **kwargs: Any,
            ) -> LLMResponse:
                return LLMResponse(content="mock response", model="mock")

            async def count_tokens(self, text: str) -> int:
                return len(text.split())

        client = MockLLMClient()
        response = await client.generate(prompt="test")

        assert response.content == "mock response"
        assert isinstance(client, LLMClient)
