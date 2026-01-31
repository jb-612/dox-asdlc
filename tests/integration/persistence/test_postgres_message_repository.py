"""Integration tests for PostgresMessageRepository.

Tests message repository operations against a real PostgreSQL database
using testcontainers.
"""

from datetime import UTC, datetime, timedelta

import pytest

from src.core.models.ideation import (
    ChatMessage,
    DataSource,
    IdeationSession,
    MessageRole,
    ProjectStatus,
)
from src.orchestrator.repositories.postgres.message_repository import (
    PostgresMessageRepository,
)
from src.orchestrator.repositories.postgres.session_repository import (
    PostgresSessionRepository,
)


@pytest.fixture
async def session_with_repo(db_session):
    """Create a session in the database for message tests.

    Returns:
        Tuple of (session, session_repo, message_repo).
    """
    session_repo = PostgresSessionRepository(db_session)
    message_repo = PostgresMessageRepository(db_session)

    session = IdeationSession(
        id="msg-test-session",
        project_name="Message Test Session",
        user_id="msg-test-user",
        status=ProjectStatus.DRAFT,
        data_source=DataSource.MOCK,
        version=1,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    await session_repo.create(session)
    await db_session.commit()

    return session, session_repo, message_repo


@pytest.mark.asyncio
class TestPostgresMessageRepositoryIntegration:
    """Integration tests for PostgresMessageRepository."""

    async def test_create_message(self, db_session, session_with_repo):
        """Test creating a message persists data to database."""
        # Arrange
        session, _, message_repo = session_with_repo
        message = ChatMessage(
            id="test-msg-1",
            session_id=session.id,
            role=MessageRole.USER,
            content="Hello, I want to build an app",
            timestamp=datetime.now(UTC),
            maturity_delta=5,
            metadata={"source": "web"},
        )

        # Act
        result = await message_repo.create(message)
        await db_session.commit()

        # Assert
        assert result.id == "test-msg-1"
        assert result.session_id == session.id
        assert result.role == MessageRole.USER
        assert result.content == "Hello, I want to build an app"
        assert result.maturity_delta == 5
        assert result.metadata == {"source": "web"}

    async def test_get_messages_by_session(self, db_session, session_with_repo):
        """Test retrieving messages by session ID."""
        # Arrange
        session, _, message_repo = session_with_repo
        messages = [
            ChatMessage(
                id=f"get-msg-{i}",
                session_id=session.id,
                role=MessageRole.USER if i % 2 == 0 else MessageRole.ASSISTANT,
                content=f"Message {i}",
                timestamp=datetime.now(UTC),
                maturity_delta=0,
                metadata=None,
            )
            for i in range(3)
        ]

        for msg in messages:
            await message_repo.create(msg)
        await db_session.commit()

        # Act
        result = await message_repo.get_by_session(session.id)

        # Assert
        assert len(result) == 3
        assert all(m.session_id == session.id for m in result)

    async def test_get_messages_chronological_order(self, db_session, session_with_repo):
        """Test messages are returned in chronological order (oldest first)."""
        # Arrange
        session, _, message_repo = session_with_repo
        base_time = datetime.now(UTC)

        messages = [
            ChatMessage(
                id=f"order-msg-{i}",
                session_id=session.id,
                role=MessageRole.USER,
                content=f"Message {i}",
                timestamp=base_time + timedelta(seconds=i),
                maturity_delta=0,
                metadata=None,
            )
            for i in range(3)
        ]

        # Create in reverse order
        for msg in reversed(messages):
            await message_repo.create(msg)
        await db_session.commit()

        # Act
        result = await message_repo.get_by_session(session.id)

        # Assert - should be in ascending order by timestamp
        assert len(result) == 3
        assert result[0].id == "order-msg-0"  # Oldest first
        assert result[1].id == "order-msg-1"
        assert result[2].id == "order-msg-2"  # Newest last

    async def test_get_messages_with_pagination(self, db_session, session_with_repo):
        """Test pagination when getting messages."""
        # Arrange
        session, _, message_repo = session_with_repo
        base_time = datetime.now(UTC)

        for i in range(5):
            msg = ChatMessage(
                id=f"page-msg-{i}",
                session_id=session.id,
                role=MessageRole.USER,
                content=f"Message {i}",
                timestamp=base_time + timedelta(seconds=i),
                maturity_delta=0,
                metadata=None,
            )
            await message_repo.create(msg)
        await db_session.commit()

        # Act
        page1 = await message_repo.get_by_session(session.id, limit=2, offset=0)
        page2 = await message_repo.get_by_session(session.id, limit=2, offset=2)

        # Assert
        assert len(page1) == 2
        assert len(page2) == 2
        assert page1[0].id == "page-msg-0"
        assert page1[1].id == "page-msg-1"
        assert page2[0].id == "page-msg-2"
        assert page2[1].id == "page-msg-3"

    async def test_get_messages_empty_session(self, db_session, session_with_repo):
        """Test getting messages for session with no messages."""
        # Arrange
        _, _, message_repo = session_with_repo

        # Act - use a different session ID
        result = await message_repo.get_by_session("non-existent-session")

        # Assert
        assert result == []

    async def test_delete_messages_by_session(self, db_session, session_with_repo):
        """Test deleting all messages for a session."""
        # Arrange
        session, _, message_repo = session_with_repo
        for i in range(3):
            msg = ChatMessage(
                id=f"del-msg-{i}",
                session_id=session.id,
                role=MessageRole.USER,
                content=f"Message {i}",
                timestamp=datetime.now(UTC),
                maturity_delta=0,
                metadata=None,
            )
            await message_repo.create(msg)
        await db_session.commit()

        # Verify messages exist
        before_delete = await message_repo.get_by_session(session.id)
        assert len(before_delete) == 3

        # Act
        await message_repo.delete_by_session(session.id)
        await db_session.commit()

        # Assert
        after_delete = await message_repo.get_by_session(session.id)
        assert after_delete == []

    async def test_create_message_with_metadata(self, db_session, session_with_repo):
        """Test creating a message with JSON metadata."""
        # Arrange
        session, _, message_repo = session_with_repo
        metadata = {
            "model": "claude-3-opus",
            "tokens_used": 150,
            "latency_ms": 234,
            "nested": {"key": "value"},
        }
        message = ChatMessage(
            id="meta-msg-1",
            session_id=session.id,
            role=MessageRole.ASSISTANT,
            content="Response with metadata",
            timestamp=datetime.now(UTC),
            maturity_delta=10,
            metadata=metadata,
        )

        # Act
        await message_repo.create(message)
        await db_session.commit()
        result = await message_repo.get_by_session(session.id)

        # Assert
        assert len(result) == 1
        assert result[0].metadata == metadata
        assert result[0].metadata["nested"]["key"] == "value"

    async def test_create_message_with_null_metadata(self, db_session, session_with_repo):
        """Test creating a message without metadata."""
        # Arrange
        session, _, message_repo = session_with_repo
        message = ChatMessage(
            id="null-meta-msg",
            session_id=session.id,
            role=MessageRole.SYSTEM,
            content="System message without metadata",
            timestamp=datetime.now(UTC),
            maturity_delta=0,
            metadata=None,
        )

        # Act
        await message_repo.create(message)
        await db_session.commit()
        result = await message_repo.get_by_session(session.id)

        # Assert
        assert len(result) == 1
        assert result[0].metadata is None


@pytest.mark.asyncio
class TestMessageCascadeDeleteIntegration:
    """Integration tests for cascade delete via session deletion."""

    async def test_messages_deleted_when_session_deleted(self, db_session):
        """Test messages are cascade deleted when session is deleted."""
        # Arrange
        session_repo = PostgresSessionRepository(db_session)
        message_repo = PostgresMessageRepository(db_session)

        session = IdeationSession(
            id="cascade-msg-session",
            project_name="Cascade Message Test",
            user_id="cascade-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)

        for i in range(3):
            msg = ChatMessage(
                id=f"cascade-del-msg-{i}",
                session_id=session.id,
                role=MessageRole.USER,
                content=f"Message {i}",
                timestamp=datetime.now(UTC),
                maturity_delta=0,
                metadata=None,
            )
            await message_repo.create(msg)
        await db_session.commit()

        # Verify messages exist
        before_delete = await message_repo.get_by_session(session.id)
        assert len(before_delete) == 3

        # Act - delete the session
        await session_repo.delete(session.id)
        await db_session.commit()

        # Assert - messages should be gone
        after_delete = await message_repo.get_by_session(session.id)
        assert after_delete == []


@pytest.mark.asyncio
class TestMessageRoleTypes:
    """Integration tests for different message role types."""

    async def test_all_message_roles(self, db_session, session_with_repo):
        """Test creating messages with all role types."""
        # Arrange
        session, _, message_repo = session_with_repo
        roles = [MessageRole.USER, MessageRole.ASSISTANT, MessageRole.SYSTEM]

        for i, role in enumerate(roles):
            msg = ChatMessage(
                id=f"role-msg-{i}",
                session_id=session.id,
                role=role,
                content=f"Message from {role.value}",
                timestamp=datetime.now(UTC),
                maturity_delta=0,
                metadata=None,
            )
            await message_repo.create(msg)
        await db_session.commit()

        # Act
        result = await message_repo.get_by_session(session.id)

        # Assert
        assert len(result) == 3
        retrieved_roles = {m.role for m in result}
        assert retrieved_roles == set(roles)
