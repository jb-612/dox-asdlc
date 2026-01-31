"""Tests for P02-F09 Task T17: IdeationService Repository Integration.

This module tests that IdeationService correctly uses the repository
factory pattern for persistence operations.
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.models.ideation import (
    ChatMessage,
    DataSource,
    IdeationSession,
    MaturityCategory,
    MaturityState,
    MessageRole,
    ProjectStatus,
)


@asynccontextmanager
async def mock_db_session():
    """Mock database session context manager that yields a mock session."""
    yield MagicMock()


class TestIdeationServiceImplRepositoryFactory:
    """Test that IdeationServiceImpl uses repository factory."""

    def test_service_has_repository_factory_attribute(self) -> None:
        """Test that IdeationServiceImpl accepts repository_factory parameter."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        # Create service with mock factory
        mock_factory = MagicMock()
        service = IdeationServiceImpl(repository_factory=mock_factory)

        # Verify factory is stored
        assert service._repository_factory is mock_factory

    def test_service_defaults_to_env_based_factory(self) -> None:
        """Test that service creates factory from environment if not provided."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "postgres"}):
            service = IdeationServiceImpl()
            # Factory should be created lazily, so _repository_factory may be None
            # but _get_repository_factory() should work
            factory = service._get_repository_factory()
            from src.orchestrator.repositories.factory import PostgresRepositoryFactory
            assert isinstance(factory, PostgresRepositoryFactory)

    def test_service_uses_redis_factory_when_configured(self) -> None:
        """Test that service uses RedisRepositoryFactory when backend is redis."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "redis"}):
            service = IdeationServiceImpl()
            factory = service._get_repository_factory()
            from src.orchestrator.repositories.redis import RedisRepositoryFactory
            assert isinstance(factory, RedisRepositoryFactory)


class TestIdeationServiceImplMaturityMethods:
    """Test maturity-related methods use repositories."""

    @pytest.fixture
    def mock_maturity_repo(self) -> AsyncMock:
        """Create mock maturity repository."""
        repo = AsyncMock()
        return repo

    @pytest.fixture
    def mock_factory(self, mock_maturity_repo: AsyncMock) -> MagicMock:
        """Create mock repository factory."""
        factory = MagicMock()
        factory.get_maturity_repository = MagicMock(return_value=mock_maturity_repo)
        return factory

    @pytest.fixture
    def service(self, mock_factory: MagicMock) -> "IdeationServiceImpl":
        """Create service with mock factory and mocked database session."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        service = IdeationServiceImpl(repository_factory=mock_factory)
        # Mock the _db_session method to avoid database connection
        service._db_session = mock_db_session
        return service

    @pytest.mark.asyncio
    async def test_get_session_maturity_uses_repository(
        self,
        service: "IdeationServiceImpl",
        mock_maturity_repo: AsyncMock,
    ) -> None:
        """Test that get_session_maturity uses maturity repository."""
        # Create a domain MaturityState to return
        maturity = MaturityState(
            session_id="session-123",
            score=75,
            level="intermediate",
            categories=[
                MaturityCategory(
                    id="functional",
                    name="Functional Requirements",
                    score=80,
                    required_for_submit=True,
                ),
            ],
            can_submit=True,
            gaps=["Missing edge cases"],
            updated_at=datetime(2024, 1, 15, 11, 0, 0),
        )
        mock_maturity_repo.get_by_session = AsyncMock(return_value=maturity)

        result = await service.get_session_maturity("session-123")

        # Should have called repository
        mock_maturity_repo.get_by_session.assert_called_once_with("session-123")
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_session_maturity_returns_none_when_not_found(
        self,
        service: "IdeationServiceImpl",
        mock_maturity_repo: AsyncMock,
    ) -> None:
        """Test that get_session_maturity returns None when not found."""
        mock_maturity_repo.get_by_session = AsyncMock(return_value=None)

        result = await service.get_session_maturity("nonexistent")

        assert result is None


class TestIdeationServiceImplSaveDraft:
    """Test save_draft method uses repositories."""

    @pytest.fixture
    def mock_session_repo(self) -> AsyncMock:
        """Create mock session repository."""
        return AsyncMock()

    @pytest.fixture
    def mock_message_repo(self) -> AsyncMock:
        """Create mock message repository."""
        return AsyncMock()

    @pytest.fixture
    def mock_maturity_repo(self) -> AsyncMock:
        """Create mock maturity repository."""
        return AsyncMock()

    @pytest.fixture
    def mock_factory(
        self,
        mock_session_repo: AsyncMock,
        mock_message_repo: AsyncMock,
        mock_maturity_repo: AsyncMock,
    ) -> MagicMock:
        """Create mock repository factory."""
        factory = MagicMock()
        factory.get_session_repository = MagicMock(return_value=mock_session_repo)
        factory.get_message_repository = MagicMock(return_value=mock_message_repo)
        factory.get_maturity_repository = MagicMock(return_value=mock_maturity_repo)
        return factory

    @pytest.fixture
    def service(self, mock_factory: MagicMock) -> "IdeationServiceImpl":
        """Create service with mock factory and mocked database session."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        service = IdeationServiceImpl(repository_factory=mock_factory)
        # Mock the _db_session method to avoid database connection
        service._db_session = mock_db_session
        return service

    @pytest.fixture
    def mock_request(self) -> MagicMock:
        """Create mock save draft request."""
        from src.orchestrator.routes.ideation_api import (
            CategoryMaturity,
            IdeationMessage,
            MaturityState,
        )

        request = MagicMock()
        request.maturityState = MaturityState(
            score=75,
            level="intermediate",
            categories=[
                CategoryMaturity(
                    id="functional",
                    name="Functional",
                    score=80,
                    requiredForSubmit=True,
                    sections=[],
                ),
            ],
            canSubmit=True,
            gaps=[],
        )
        request.messages = [
            MagicMock(id="msg-1", role="user", content="Hello"),
            MagicMock(id="msg-2", role="assistant", content="Hi there"),
        ]
        return request

    @pytest.mark.asyncio
    async def test_save_draft_saves_maturity(
        self,
        service: "IdeationServiceImpl",
        mock_maturity_repo: AsyncMock,
        mock_request: MagicMock,
    ) -> None:
        """Test that save_draft saves maturity state via repository."""
        mock_maturity_repo.save = AsyncMock()

        result = await service.save_draft("session-123", mock_request)

        # Should have saved maturity
        mock_maturity_repo.save.assert_called_once()
        assert result.success is True
        assert result.sessionId == "session-123"


class TestIdeationServiceImplConversationHistory:
    """Test conversation history methods use message repository."""

    @pytest.fixture
    def mock_message_repo(self) -> AsyncMock:
        """Create mock message repository."""
        return AsyncMock()

    @pytest.fixture
    def mock_factory(self, mock_message_repo: AsyncMock) -> MagicMock:
        """Create mock repository factory."""
        factory = MagicMock()
        factory.get_message_repository = MagicMock(return_value=mock_message_repo)
        # Also mock maturity repo for other methods
        factory.get_maturity_repository = MagicMock(return_value=AsyncMock())
        return factory

    @pytest.fixture
    def service(self, mock_factory: MagicMock) -> "IdeationServiceImpl":
        """Create service with mock factory and mocked database session."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        service = IdeationServiceImpl(repository_factory=mock_factory)
        # Mock the _db_session method to avoid database connection
        service._db_session = mock_db_session
        return service

    @pytest.mark.asyncio
    async def test_get_conversation_history_uses_repository(
        self,
        service: "IdeationServiceImpl",
        mock_message_repo: AsyncMock,
    ) -> None:
        """Test that conversation history is fetched via repository."""
        messages = [
            ChatMessage(
                id="msg-1",
                session_id="session-123",
                role=MessageRole.USER,
                content="Hello",
                timestamp=datetime(2024, 1, 15, 10, 0, 0),
            ),
            ChatMessage(
                id="msg-2",
                session_id="session-123",
                role=MessageRole.ASSISTANT,
                content="Hi there",
                timestamp=datetime(2024, 1, 15, 10, 1, 0),
            ),
        ]
        mock_message_repo.get_by_session = AsyncMock(return_value=messages)

        result = await service._get_conversation_history("session-123")

        mock_message_repo.get_by_session.assert_called_once_with("session-123")
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_save_conversation_message_uses_repository(
        self,
        service: "IdeationServiceImpl",
        mock_message_repo: AsyncMock,
    ) -> None:
        """Test that saving message uses repository."""
        mock_message_repo.create = AsyncMock()

        await service._save_conversation_message(
            "session-123",
            {"role": "user", "content": "Hello"},
        )

        mock_message_repo.create.assert_called_once()
        # Verify the message was created with correct data
        call_args = mock_message_repo.create.call_args[0][0]
        assert isinstance(call_args, ChatMessage)
        assert call_args.role == MessageRole.USER
        assert call_args.content == "Hello"
        assert call_args.session_id == "session-123"


class TestIdeationServiceBackwardCompatibility:
    """Test backward compatibility with existing behavior."""

    @pytest.mark.asyncio
    async def test_service_works_with_redis_backend(self) -> None:
        """Test that service works when IDEATION_PERSISTENCE_BACKEND=redis."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "redis"}):
            service = IdeationServiceImpl()
            factory = service._get_repository_factory()

            from src.orchestrator.repositories.redis import RedisRepositoryFactory
            assert isinstance(factory, RedisRepositoryFactory)

    @pytest.mark.asyncio
    async def test_service_works_with_postgres_backend(self) -> None:
        """Test that service works when IDEATION_PERSISTENCE_BACKEND=postgres."""
        from src.orchestrator.services.ideation_service import IdeationServiceImpl

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "postgres"}):
            service = IdeationServiceImpl()
            factory = service._get_repository_factory()

            from src.orchestrator.repositories.factory import PostgresRepositoryFactory
            assert isinstance(factory, PostgresRepositoryFactory)
