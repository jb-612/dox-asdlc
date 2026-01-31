"""Unit tests for LLM Streaming API routes.

Tests the SSE streaming endpoint for real-time LLM responses.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.infrastructure.llm.base_client import BaseLLMClient, StreamChunk
from src.infrastructure.llm.factory import LLMClientFactory
from src.orchestrator.api.models.llm_config import AgentRole


@pytest.fixture
def mock_factory() -> LLMClientFactory:
    """Create a mock LLM client factory."""
    return MagicMock(spec=LLMClientFactory)


@pytest.fixture
def mock_client() -> BaseLLMClient:
    """Create a mock LLM client."""
    mock = MagicMock(spec=BaseLLMClient)
    return mock


@pytest.fixture
def app(mock_factory: LLMClientFactory) -> FastAPI:
    """Create a FastAPI app with the streaming router."""
    from src.orchestrator.routes.llm_streaming_api import (
        router,
        get_llm_client_factory,
    )

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_llm_client_factory] = lambda: mock_factory
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create a test client."""
    return TestClient(app)


class TestStreamEndpoint:
    """Tests for POST /api/llm/stream endpoint."""

    def test_stream_returns_streaming_response(
        self, client: TestClient, mock_factory: LLMClientFactory, mock_client: BaseLLMClient
    ) -> None:
        """Test that streaming endpoint returns StreamingResponse."""
        # Set up mock to return chunks
        async def mock_stream(*args: Any, **kwargs: Any) -> AsyncIterator[StreamChunk]:
            yield StreamChunk(content="Hello", is_final=False)
            yield StreamChunk(content=" World", is_final=False)
            yield StreamChunk(content="", is_final=True, usage={"input_tokens": 10, "output_tokens": 5})

        mock_client.generate_stream = mock_stream
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        response = client.post(
            "/api/llm/stream",
            json={"role": "discovery", "prompt": "Hello"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"

    def test_stream_sse_format_correct(
        self, client: TestClient, mock_factory: LLMClientFactory, mock_client: BaseLLMClient
    ) -> None:
        """Test that SSE format is correct with data: prefix."""
        async def mock_stream(*args: Any, **kwargs: Any) -> AsyncIterator[StreamChunk]:
            yield StreamChunk(content="Test", is_final=False)
            yield StreamChunk(content="", is_final=True, usage={"input_tokens": 5, "output_tokens": 2})

        mock_client.generate_stream = mock_stream
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        response = client.post(
            "/api/llm/stream",
            json={"role": "discovery", "prompt": "Test"},
        )

        # Parse SSE events
        lines = response.text.strip().split("\n\n")
        events = []
        for line in lines:
            if line.startswith("data: "):
                data = json.loads(line[6:])
                events.append(data)

        # First event should have token
        assert len(events) >= 2
        assert events[0]["token"] == "Test"
        assert events[0]["done"] is False

        # Last event should be done
        assert events[-1]["done"] is True
        assert "total_tokens" in events[-1]

    def test_stream_invalid_role_returns_error(
        self, client: TestClient, mock_factory: LLMClientFactory
    ) -> None:
        """Test that invalid role returns 400 error."""
        from src.infrastructure.llm.factory import LLMClientError

        mock_factory.get_client = AsyncMock(
            side_effect=LLMClientError("Invalid agent role: invalid_role")
        )

        response = client.post(
            "/api/llm/stream",
            json={"role": "invalid_role", "prompt": "Hello"},
        )

        assert response.status_code == 400
        data = response.json()
        assert "Invalid agent role" in data["detail"]

    def test_stream_with_system_prompt(
        self, client: TestClient, mock_factory: LLMClientFactory, mock_client: BaseLLMClient
    ) -> None:
        """Test streaming with system prompt."""
        captured_kwargs: dict[str, Any] = {}

        async def mock_stream(*args: Any, **kwargs: Any) -> AsyncIterator[StreamChunk]:
            captured_kwargs.update(kwargs)
            yield StreamChunk(content="Response", is_final=False)
            yield StreamChunk(content="", is_final=True, usage={"input_tokens": 10, "output_tokens": 3})

        mock_client.generate_stream = mock_stream
        mock_factory.get_client = AsyncMock(return_value=mock_client)

        response = client.post(
            "/api/llm/stream",
            json={
                "role": "discovery",
                "prompt": "Hello",
                "system_prompt": "You are a helpful assistant.",
            },
        )

        assert response.status_code == 200
        # The system prompt should be passed to generate_stream
        assert captured_kwargs.get("system") == "You are a helpful assistant."

    def test_stream_client_error_returns_500(
        self, client: TestClient, mock_factory: LLMClientFactory
    ) -> None:
        """Test that client errors return 500."""
        mock_factory.get_client = AsyncMock(
            side_effect=Exception("Connection failed")
        )

        response = client.post(
            "/api/llm/stream",
            json={"role": "discovery", "prompt": "Hello"},
        )

        assert response.status_code == 500
        data = response.json()
        assert "error" in data["detail"].lower()

    def test_stream_missing_prompt_returns_422(
        self, client: TestClient, mock_factory: LLMClientFactory
    ) -> None:
        """Test that missing prompt returns validation error."""
        response = client.post(
            "/api/llm/stream",
            json={"role": "discovery"},
        )

        assert response.status_code == 422

    def test_stream_missing_role_returns_422(
        self, client: TestClient, mock_factory: LLMClientFactory
    ) -> None:
        """Test that missing role returns validation error."""
        response = client.post(
            "/api/llm/stream",
            json={"prompt": "Hello"},
        )

        assert response.status_code == 422


class TestStreamRequestModel:
    """Tests for StreamRequest model validation."""

    def test_valid_request(self) -> None:
        """Test valid stream request."""
        from src.orchestrator.routes.llm_streaming_api import StreamRequest

        request = StreamRequest(role="discovery", prompt="Hello")
        assert request.role == "discovery"
        assert request.prompt == "Hello"
        assert request.system_prompt is None

    def test_request_with_system_prompt(self) -> None:
        """Test request with optional system prompt."""
        from src.orchestrator.routes.llm_streaming_api import StreamRequest

        request = StreamRequest(
            role="discovery",
            prompt="Hello",
            system_prompt="Be helpful.",
        )
        assert request.system_prompt == "Be helpful."


class TestSSEEventFormat:
    """Tests for SSE event formatting."""

    def test_token_event_format(self) -> None:
        """Test token event is properly formatted."""
        from src.orchestrator.routes.llm_streaming_api import format_sse_event

        event = format_sse_event(token="Hello", done=False)
        assert event == 'data: {"token": "Hello", "done": false}\n\n'

    def test_final_event_format(self) -> None:
        """Test final event includes total tokens."""
        from src.orchestrator.routes.llm_streaming_api import format_sse_event

        event = format_sse_event(token="", done=True, total_tokens=15)
        assert event == 'data: {"token": "", "done": true, "total_tokens": 15}\n\n'

    def test_special_characters_escaped(self) -> None:
        """Test that special characters in token are JSON-escaped."""
        from src.orchestrator.routes.llm_streaming_api import format_sse_event

        event = format_sse_event(token='Quote: "hello"\nNewline', done=False)
        # Should be valid JSON
        data_part = event.split("data: ")[1].strip()
        parsed = json.loads(data_part)
        assert parsed["token"] == 'Quote: "hello"\nNewline'
