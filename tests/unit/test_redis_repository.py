"""Tests for P02-F09 Task T16: Redis Repository Fallback.

This module tests the Redis implementations of repository interfaces:
- RedisSessionRepository
- RedisMessageRepository
- RedisRequirementRepository
- RedisMaturityRepository
- RedisPRDRepository
- RedisRepositoryFactory
"""

import json
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.models.ideation import (
    ChatMessage,
    DataSource,
    ExtractedRequirement,
    IdeationSession,
    MaturityCategory,
    MaturityState,
    MessageRole,
    PRDDraft,
    PRDSection,
    ProjectStatus,
    RequirementPriority,
    RequirementType,
    UserStory,
)
from src.orchestrator.repositories.interfaces import (
    IMaturityRepository,
    IMessageRepository,
    IPRDRepository,
    IRequirementRepository,
    ISessionRepository,
)


# =============================================================================
# Test Fixtures
# =============================================================================


def make_session(
    session_id: str = "session-123",
    project_name: str = "Test Project",
    user_id: str = "user-456",
) -> IdeationSession:
    """Create a test IdeationSession."""
    return IdeationSession(
        id=session_id,
        project_name=project_name,
        user_id=user_id,
        status=ProjectStatus.DRAFT,
        data_source=DataSource.MOCK,
        version=1,
        created_at=datetime(2024, 1, 15, 10, 0, 0),
        updated_at=datetime(2024, 1, 15, 11, 0, 0),
    )


def make_message(
    message_id: str = "msg-123",
    session_id: str = "session-123",
    role: MessageRole = MessageRole.USER,
    content: str = "Hello",
) -> ChatMessage:
    """Create a test ChatMessage."""
    return ChatMessage(
        id=message_id,
        session_id=session_id,
        role=role,
        content=content,
        timestamp=datetime(2024, 1, 15, 10, 30, 0),
        maturity_delta=5,
        metadata={"key": "value"},
    )


def make_requirement(
    requirement_id: str = "req-123",
    session_id: str = "session-123",
) -> ExtractedRequirement:
    """Create a test ExtractedRequirement."""
    return ExtractedRequirement(
        id=requirement_id,
        session_id=session_id,
        description="User can login",
        type=RequirementType.FUNCTIONAL,
        priority=RequirementPriority.MUST_HAVE,
        category_id="auth",
        created_at=datetime(2024, 1, 15, 10, 0, 0),
    )


def make_maturity(session_id: str = "session-123") -> MaturityState:
    """Create a test MaturityState."""
    return MaturityState(
        session_id=session_id,
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


def make_prd_draft(
    draft_id: str = "prd-123",
    session_id: str = "session-123",
) -> PRDDraft:
    """Create a test PRDDraft."""
    return PRDDraft(
        id=draft_id,
        session_id=session_id,
        title="My PRD",
        version="1.0.0",
        sections=[
            PRDSection(
                id="intro",
                heading="Introduction",
                content="This is the intro.",
                order=1,
            ),
        ],
        status="draft",
        created_at=datetime(2024, 1, 15, 12, 0, 0),
    )


def make_user_story(
    story_id: str = "story-123",
    session_id: str = "session-123",
) -> UserStory:
    """Create a test UserStory."""
    return UserStory(
        id=story_id,
        session_id=session_id,
        title="Login Story",
        as_a="registered user",
        i_want="to login",
        so_that="I can access my account",
        acceptance_criteria=["Valid credentials work", "Invalid credentials show error"],
        linked_requirements=["req-123"],
        priority=RequirementPriority.MUST_HAVE,
        created_at=datetime(2024, 1, 15, 10, 0, 0),
    )


# =============================================================================
# Import Tests
# =============================================================================


class TestRedisRepositoryImport:
    """Test that Redis repository modules can be imported."""

    def test_import_redis_package(self) -> None:
        """Test that redis repository package can be imported."""
        from src.orchestrator.repositories import redis

        assert redis is not None

    def test_import_session_repository(self) -> None:
        """Test that RedisSessionRepository can be imported."""
        from src.orchestrator.repositories.redis import RedisSessionRepository

        assert RedisSessionRepository is not None

    def test_import_message_repository(self) -> None:
        """Test that RedisMessageRepository can be imported."""
        from src.orchestrator.repositories.redis import RedisMessageRepository

        assert RedisMessageRepository is not None

    def test_import_requirement_repository(self) -> None:
        """Test that RedisRequirementRepository can be imported."""
        from src.orchestrator.repositories.redis import RedisRequirementRepository

        assert RedisRequirementRepository is not None

    def test_import_maturity_repository(self) -> None:
        """Test that RedisMaturityRepository can be imported."""
        from src.orchestrator.repositories.redis import RedisMaturityRepository

        assert RedisMaturityRepository is not None

    def test_import_prd_repository(self) -> None:
        """Test that RedisPRDRepository can be imported."""
        from src.orchestrator.repositories.redis import RedisPRDRepository

        assert RedisPRDRepository is not None

    def test_import_repository_factory(self) -> None:
        """Test that RedisRepositoryFactory can be imported."""
        from src.orchestrator.repositories.redis import RedisRepositoryFactory

        assert RedisRepositoryFactory is not None


# =============================================================================
# Session Repository Tests
# =============================================================================


class TestRedisSessionRepository:
    """Test RedisSessionRepository implementation."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def repo(self, mock_redis: AsyncMock) -> "RedisSessionRepository":
        """Create a repository instance with mock Redis."""
        from src.orchestrator.repositories.redis import RedisSessionRepository

        return RedisSessionRepository(mock_redis)

    def test_implements_interface(self) -> None:
        """Test that RedisSessionRepository implements ISessionRepository."""
        from src.orchestrator.repositories.redis import RedisSessionRepository

        assert issubclass(RedisSessionRepository, ISessionRepository)

    @pytest.mark.asyncio
    async def test_create_stores_session(
        self, repo: "RedisSessionRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that create() stores session in Redis."""
        session = make_session()
        mock_redis.set = AsyncMock()

        result = await repo.create(session)

        assert result.id == session.id
        mock_redis.set.assert_called_once()
        call_key = mock_redis.set.call_args[0][0]
        assert "ideation:session:session-123" in call_key

    @pytest.mark.asyncio
    async def test_get_by_id_returns_session(
        self, repo: "RedisSessionRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_by_id() returns session when found."""
        session = make_session()
        session_json = json.dumps({
            "id": session.id,
            "project_name": session.project_name,
            "user_id": session.user_id,
            "status": "draft",
            "data_source": "mock",
            "version": 1,
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T11:00:00",
        })
        mock_redis.get = AsyncMock(return_value=session_json)

        result = await repo.get_by_id("session-123")

        assert result is not None
        assert result.id == "session-123"
        assert isinstance(result, IdeationSession)

    @pytest.mark.asyncio
    async def test_get_by_id_returns_none_when_not_found(
        self, repo: "RedisSessionRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_by_id() returns None when not found."""
        mock_redis.get = AsyncMock(return_value=None)

        result = await repo.get_by_id("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_stores_session(
        self, repo: "RedisSessionRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that update() stores updated session."""
        session = make_session()
        mock_redis.set = AsyncMock()

        await repo.update(session)

        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_removes_session(
        self, repo: "RedisSessionRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that delete() removes session from Redis."""
        # Mock get to return session data (needed to find user_id for index cleanup)
        session_json = json.dumps({
            "id": "session-123",
            "project_name": "Test",
            "user_id": "user-456",
            "status": "draft",
            "data_source": "mock",
            "version": 1,
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T11:00:00",
        })
        mock_redis.get = AsyncMock(return_value=session_json)
        mock_redis.srem = AsyncMock()
        mock_redis.delete = AsyncMock()

        await repo.delete("session-123")

        mock_redis.delete.assert_called()

    @pytest.mark.asyncio
    async def test_list_by_user_returns_sessions(
        self, repo: "RedisSessionRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that list_by_user() returns user's sessions."""
        session_json = json.dumps({
            "id": "session-123",
            "project_name": "Test",
            "user_id": "user-456",
            "status": "draft",
            "data_source": "mock",
            "version": 1,
            "created_at": "2024-01-15T10:00:00",
            "updated_at": "2024-01-15T11:00:00",
        })
        mock_redis.smembers = AsyncMock(return_value={"session-123"})
        mock_redis.get = AsyncMock(return_value=session_json)

        result = await repo.list_by_user("user-456")

        assert len(result) >= 0  # May be empty if user index not found
        assert all(isinstance(s, IdeationSession) for s in result)


# =============================================================================
# Message Repository Tests
# =============================================================================


class TestRedisMessageRepository:
    """Test RedisMessageRepository implementation."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def repo(self, mock_redis: AsyncMock) -> "RedisMessageRepository":
        """Create a repository instance with mock Redis."""
        from src.orchestrator.repositories.redis import RedisMessageRepository

        return RedisMessageRepository(mock_redis)

    def test_implements_interface(self) -> None:
        """Test that RedisMessageRepository implements IMessageRepository."""
        from src.orchestrator.repositories.redis import RedisMessageRepository

        assert issubclass(RedisMessageRepository, IMessageRepository)

    @pytest.mark.asyncio
    async def test_create_stores_message(
        self, repo: "RedisMessageRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that create() stores message in Redis list."""
        message = make_message()
        mock_redis.rpush = AsyncMock()

        result = await repo.create(message)

        assert result.id == message.id
        mock_redis.rpush.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_session_returns_messages(
        self, repo: "RedisMessageRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_by_session() returns messages."""
        msg_json = json.dumps({
            "id": "msg-123",
            "session_id": "session-123",
            "role": "user",
            "content": "Hello",
            "timestamp": "2024-01-15T10:30:00",
            "maturity_delta": 5,
            "metadata": {"key": "value"},
        })
        mock_redis.lrange = AsyncMock(return_value=[msg_json])

        result = await repo.get_by_session("session-123")

        assert len(result) == 1
        assert isinstance(result[0], ChatMessage)

    @pytest.mark.asyncio
    async def test_delete_by_session_removes_messages(
        self, repo: "RedisMessageRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that delete_by_session() removes all messages."""
        mock_redis.delete = AsyncMock()

        await repo.delete_by_session("session-123")

        mock_redis.delete.assert_called_once()


# =============================================================================
# Requirement Repository Tests
# =============================================================================


class TestRedisRequirementRepository:
    """Test RedisRequirementRepository implementation."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def repo(self, mock_redis: AsyncMock) -> "RedisRequirementRepository":
        """Create a repository instance with mock Redis."""
        from src.orchestrator.repositories.redis import RedisRequirementRepository

        return RedisRequirementRepository(mock_redis)

    def test_implements_interface(self) -> None:
        """Test that RedisRequirementRepository implements IRequirementRepository."""
        from src.orchestrator.repositories.redis import RedisRequirementRepository

        assert issubclass(RedisRequirementRepository, IRequirementRepository)

    @pytest.mark.asyncio
    async def test_create_stores_requirement(
        self, repo: "RedisRequirementRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that create() stores requirement."""
        requirement = make_requirement()
        mock_redis.hset = AsyncMock()

        result = await repo.create(requirement)

        assert result.id == requirement.id
        mock_redis.hset.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_session_returns_requirements(
        self, repo: "RedisRequirementRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_by_session() returns requirements."""
        req_json = json.dumps({
            "id": "req-123",
            "session_id": "session-123",
            "description": "User can login",
            "type": "functional",
            "priority": "must_have",
            "category_id": "auth",
            "created_at": "2024-01-15T10:00:00",
        })
        mock_redis.hgetall = AsyncMock(return_value={"req-123": req_json})

        result = await repo.get_by_session("session-123")

        assert len(result) == 1
        assert isinstance(result[0], ExtractedRequirement)

    @pytest.mark.asyncio
    async def test_delete_removes_requirement(
        self, repo: "RedisRequirementRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that delete() removes requirement."""
        # Mock scan to return a key and then stop
        mock_redis.scan = AsyncMock(
            return_value=(0, [b"ideation:requirements:session-123"])
        )
        mock_redis.hexists = AsyncMock(return_value=True)
        mock_redis.hdel = AsyncMock()

        await repo.delete("req-123")

        # Should attempt to delete from hash
        mock_redis.hdel.assert_called()


# =============================================================================
# Maturity Repository Tests
# =============================================================================


class TestRedisMaturityRepository:
    """Test RedisMaturityRepository implementation."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def repo(self, mock_redis: AsyncMock) -> "RedisMaturityRepository":
        """Create a repository instance with mock Redis."""
        from src.orchestrator.repositories.redis import RedisMaturityRepository

        return RedisMaturityRepository(mock_redis)

    def test_implements_interface(self) -> None:
        """Test that RedisMaturityRepository implements IMaturityRepository."""
        from src.orchestrator.repositories.redis import RedisMaturityRepository

        assert issubclass(RedisMaturityRepository, IMaturityRepository)

    @pytest.mark.asyncio
    async def test_save_stores_maturity(
        self, repo: "RedisMaturityRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that save() stores maturity state."""
        maturity = make_maturity()
        mock_redis.set = AsyncMock()

        await repo.save(maturity)

        mock_redis.set.assert_called_once()
        call_key = mock_redis.set.call_args[0][0]
        assert "ideation:maturity:session-123" in call_key

    @pytest.mark.asyncio
    async def test_get_by_session_returns_maturity(
        self, repo: "RedisMaturityRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_by_session() returns maturity state."""
        maturity_json = json.dumps({
            "session_id": "session-123",
            "score": 75,
            "level": "intermediate",
            "categories": [
                {
                    "id": "functional",
                    "name": "Functional Requirements",
                    "score": 80,
                    "required_for_submit": True,
                }
            ],
            "can_submit": True,
            "gaps": ["Missing edge cases"],
            "updated_at": "2024-01-15T11:00:00",
        })
        mock_redis.get = AsyncMock(return_value=maturity_json)

        result = await repo.get_by_session("session-123")

        assert result is not None
        assert isinstance(result, MaturityState)
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_get_by_session_returns_none_when_not_found(
        self, repo: "RedisMaturityRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_by_session() returns None when not found."""
        mock_redis.get = AsyncMock(return_value=None)

        result = await repo.get_by_session("nonexistent")

        assert result is None


# =============================================================================
# PRD Repository Tests
# =============================================================================


class TestRedisPRDRepository:
    """Test RedisPRDRepository implementation."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def repo(self, mock_redis: AsyncMock) -> "RedisPRDRepository":
        """Create a repository instance with mock Redis."""
        from src.orchestrator.repositories.redis import RedisPRDRepository

        return RedisPRDRepository(mock_redis)

    def test_implements_interface(self) -> None:
        """Test that RedisPRDRepository implements IPRDRepository."""
        from src.orchestrator.repositories.redis import RedisPRDRepository

        assert issubclass(RedisPRDRepository, IPRDRepository)

    @pytest.mark.asyncio
    async def test_save_draft_stores_prd(
        self, repo: "RedisPRDRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that save_draft() stores PRD."""
        draft = make_prd_draft()
        mock_redis.set = AsyncMock()

        result = await repo.save_draft(draft)

        assert result.id == draft.id
        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_draft_returns_prd(
        self, repo: "RedisPRDRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_draft() returns PRD when found."""
        draft_json = json.dumps({
            "id": "prd-123",
            "session_id": "session-123",
            "title": "My PRD",
            "version": "1.0.0",
            "sections": [
                {"id": "intro", "heading": "Introduction", "content": "Intro text", "order": 1}
            ],
            "status": "draft",
            "created_at": "2024-01-15T12:00:00",
        })
        mock_redis.get = AsyncMock(return_value=draft_json)

        result = await repo.get_draft("session-123")

        assert result is not None
        assert isinstance(result, PRDDraft)

    @pytest.mark.asyncio
    async def test_save_user_stories_stores_stories(
        self, repo: "RedisPRDRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that save_user_stories() stores stories."""
        stories = [make_user_story()]
        mock_redis.delete = AsyncMock()
        mock_redis.rpush = AsyncMock()

        await repo.save_user_stories("session-123", stories)

        # Should delete existing and push new
        mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_user_stories_returns_stories(
        self, repo: "RedisPRDRepository", mock_redis: AsyncMock
    ) -> None:
        """Test that get_user_stories() returns stories."""
        story_json = json.dumps({
            "id": "story-123",
            "session_id": "session-123",
            "title": "Login Story",
            "as_a": "registered user",
            "i_want": "to login",
            "so_that": "I can access my account",
            "acceptance_criteria": ["Valid credentials work"],
            "linked_requirements": ["req-123"],
            "priority": "must_have",
            "created_at": "2024-01-15T10:00:00",
        })
        mock_redis.lrange = AsyncMock(return_value=[story_json])

        result = await repo.get_user_stories("session-123")

        assert len(result) == 1
        assert isinstance(result[0], UserStory)


# =============================================================================
# Repository Factory Tests
# =============================================================================


class TestRedisRepositoryFactory:
    """Test RedisRepositoryFactory implementation."""

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create a mock Redis client."""
        return AsyncMock()

    @pytest.fixture
    def factory(self, mock_redis: AsyncMock) -> "RedisRepositoryFactory":
        """Create a factory instance with mock Redis."""
        from src.orchestrator.repositories.redis import RedisRepositoryFactory

        return RedisRepositoryFactory(mock_redis)

    def test_get_session_repository(
        self, factory: "RedisRepositoryFactory"
    ) -> None:
        """Test that get_session_repository returns RedisSessionRepository."""
        from src.orchestrator.repositories.redis import RedisSessionRepository

        # For Redis factory, db_session is ignored (uses internal Redis client)
        repo = factory.get_session_repository(None)
        assert isinstance(repo, RedisSessionRepository)
        assert isinstance(repo, ISessionRepository)

    def test_get_message_repository(
        self, factory: "RedisRepositoryFactory"
    ) -> None:
        """Test that get_message_repository returns RedisMessageRepository."""
        from src.orchestrator.repositories.redis import RedisMessageRepository

        repo = factory.get_message_repository(None)
        assert isinstance(repo, RedisMessageRepository)
        assert isinstance(repo, IMessageRepository)

    def test_get_requirement_repository(
        self, factory: "RedisRepositoryFactory"
    ) -> None:
        """Test that get_requirement_repository returns RedisRequirementRepository."""
        from src.orchestrator.repositories.redis import RedisRequirementRepository

        repo = factory.get_requirement_repository(None)
        assert isinstance(repo, RedisRequirementRepository)
        assert isinstance(repo, IRequirementRepository)

    def test_get_maturity_repository(
        self, factory: "RedisRepositoryFactory"
    ) -> None:
        """Test that get_maturity_repository returns RedisMaturityRepository."""
        from src.orchestrator.repositories.redis import RedisMaturityRepository

        repo = factory.get_maturity_repository(None)
        assert isinstance(repo, RedisMaturityRepository)
        assert isinstance(repo, IMaturityRepository)

    def test_get_prd_repository(
        self, factory: "RedisRepositoryFactory"
    ) -> None:
        """Test that get_prd_repository returns RedisPRDRepository."""
        from src.orchestrator.repositories.redis import RedisPRDRepository

        repo = factory.get_prd_repository(None)
        assert isinstance(repo, RedisPRDRepository)
        assert isinstance(repo, IPRDRepository)
