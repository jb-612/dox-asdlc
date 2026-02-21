"""Unit tests for HttpIdeasService.

Tests the HTTP-based ideas service that calls the orchestrator's
REST API to persist ideas, replacing the old RedisIdeasService.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.api.models.idea import (
    CreateIdeaRequest,
    Idea,
    IdeaClassification,
    IdeaStatus,
)


class TestHttpIdeasServiceCreation:
    """Tests for HttpIdeasService initialization."""

    def test_default_orchestrator_url(self):
        """Uses default orchestrator URL when env var is not set."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        with patch.dict("os.environ", {}, clear=True):
            service = HttpIdeasService()
            assert service._base_url == "http://localhost:8080"

    def test_custom_orchestrator_url_from_env(self):
        """Uses ORCHESTRATOR_URL env var when set."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        with patch.dict("os.environ", {"ORCHESTRATOR_URL": "http://orchestrator:9090"}):
            service = HttpIdeasService()
            assert service._base_url == "http://orchestrator:9090"

    def test_session_initially_none(self):
        """Session is not created until first use."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()
        assert service._session is None


class TestHttpIdeasServiceCreateIdea:
    """Tests for HttpIdeasService.create_idea method."""

    @pytest.fixture
    def idea_response_data(self) -> dict:
        """Sample idea response from orchestrator API."""
        now = datetime.now(UTC).isoformat()
        return {
            "id": "idea-abc123def456",
            "content": "A great idea for improving the system",
            "author_id": "U001",
            "author_name": "Test User",
            "status": "active",
            "classification": "undetermined",
            "labels": ["source_ref:slack:command:C-IDEAS:U001"],
            "created_at": now,
            "updated_at": now,
            "word_count": 8,
        }

    @pytest.fixture
    def create_request(self) -> CreateIdeaRequest:
        """Sample idea creation request."""
        return CreateIdeaRequest(
            content="A great idea for improving the system",
            author_id="U001",
            author_name="Test User",
            labels=["source_ref:slack:command:C-IDEAS:U001"],
        )

    @pytest.mark.asyncio
    async def test_successful_idea_creation(
        self, create_request: CreateIdeaRequest, idea_response_data: dict
    ):
        """Successful HTTP 200 response returns Idea object."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()

        # Mock aiohttp response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=idea_response_data)

        # Mock session
        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=_AsyncContextManager(mock_response))
        service._session = mock_session

        result = await service.create_idea(create_request)

        assert isinstance(result, Idea)
        assert result.id == "idea-abc123def456"
        assert result.content == "A great idea for improving the system"
        assert result.author_id == "U001"
        assert result.author_name == "Test User"
        assert result.status == IdeaStatus.ACTIVE
        assert result.classification == IdeaClassification.UNDETERMINED
        assert result.word_count == 8

    @pytest.mark.asyncio
    async def test_posts_to_correct_endpoint(
        self, create_request: CreateIdeaRequest, idea_response_data: dict
    ):
        """Posts to /api/brainflare/ideas endpoint."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=idea_response_data)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=_AsyncContextManager(mock_response))
        service._session = mock_session

        await service.create_idea(create_request)

        # Verify correct URL
        call_args = mock_session.post.call_args
        assert call_args[0][0] == "http://localhost:8080/api/brainflare/ideas"

    @pytest.mark.asyncio
    async def test_sends_correct_json_payload(
        self, create_request: CreateIdeaRequest, idea_response_data: dict
    ):
        """Sends CreateIdeaRequest as JSON in request body."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=idea_response_data)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=_AsyncContextManager(mock_response))
        service._session = mock_session

        await service.create_idea(create_request)

        call_kwargs = mock_session.post.call_args[1]
        json_payload = call_kwargs["json"]
        assert json_payload["content"] == "A great idea for improving the system"
        assert json_payload["author_id"] == "U001"
        assert json_payload["author_name"] == "Test User"
        assert "source_ref:slack:command:C-IDEAS:U001" in json_payload["labels"]

    @pytest.mark.asyncio
    async def test_word_count_validation_error_raises_value_error(
        self, create_request: CreateIdeaRequest
    ):
        """HTTP 400 response raises ValueError."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()

        mock_response = AsyncMock()
        mock_response.status = 400
        mock_response.json = AsyncMock(
            return_value={"detail": "Idea exceeds 144 word limit (200 words)"}
        )

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=_AsyncContextManager(mock_response))
        service._session = mock_session

        with pytest.raises(ValueError, match="144 word limit"):
            await service.create_idea(create_request)

    @pytest.mark.asyncio
    async def test_server_error_raises_exception(
        self, create_request: CreateIdeaRequest
    ):
        """HTTP 500 response raises Exception."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()

        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.json = AsyncMock(
            return_value={"detail": "Internal server error"}
        )

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=_AsyncContextManager(mock_response))
        service._session = mock_session

        with pytest.raises(Exception, match="Orchestrator API error"):
            await service.create_idea(create_request)

    @pytest.mark.asyncio
    async def test_connection_error_raises_exception(
        self, create_request: CreateIdeaRequest
    ):
        """Connection error raises Exception with descriptive message."""
        import aiohttp

        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()

        mock_session = AsyncMock()
        mock_session.post = MagicMock(
            side_effect=aiohttp.ClientError("Connection refused")
        )
        service._session = mock_session

        with pytest.raises(Exception, match="Failed to connect"):
            await service.create_idea(create_request)

    @pytest.mark.asyncio
    async def test_creates_session_lazily(self, idea_response_data: dict):
        """Session is created on first use if not already set."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()
        assert service._session is None

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value=idea_response_data)

        request = CreateIdeaRequest(
            content="Test idea",
            author_id="U001",
            author_name="Test",
        )

        with patch("aiohttp.ClientSession") as mock_session_class:
            mock_session = AsyncMock()
            mock_session.post = MagicMock(
                return_value=_AsyncContextManager(mock_response)
            )
            mock_session_class.return_value = mock_session

            await service.create_idea(request)

            mock_session_class.assert_called_once()
            assert service._session is mock_session


class TestHttpIdeasServiceClose:
    """Tests for HttpIdeasService.close method."""

    @pytest.mark.asyncio
    async def test_close_closes_session(self):
        """Close method closes the aiohttp session."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()
        mock_session = AsyncMock()
        service._session = mock_session

        await service.close()

        mock_session.close.assert_called_once()
        assert service._session is None

    @pytest.mark.asyncio
    async def test_close_noop_when_no_session(self):
        """Close is a no-op when session was never created."""
        from src.infrastructure.slack_bridge.http_ideas_service import HttpIdeasService

        service = HttpIdeasService()
        assert service._session is None

        # Should not raise
        await service.close()


class _AsyncContextManager:
    """Helper to mock async context managers for aiohttp responses."""

    def __init__(self, return_value):
        self._return_value = return_value

    async def __aenter__(self):
        return self._return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return False
