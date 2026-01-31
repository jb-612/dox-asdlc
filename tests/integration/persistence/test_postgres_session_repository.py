"""Integration tests for PostgresSessionRepository.

Tests session repository operations against a real PostgreSQL database
using testcontainers.
"""

from datetime import UTC, datetime

import pytest

from src.core.models.ideation import (
    DataSource,
    IdeationSession,
    ProjectStatus,
)
from src.orchestrator.repositories.postgres.session_repository import (
    PostgresSessionRepository,
)


@pytest.mark.asyncio
class TestPostgresSessionRepositoryIntegration:
    """Integration tests for PostgresSessionRepository."""

    async def test_create_session(self, db_session):
        """Test creating a session persists data to database."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        session = IdeationSession(
            id="test-session-1",
            project_name="Test Project",
            user_id="user-1",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        # Act
        result = await repo.create(session)
        await db_session.commit()

        # Assert
        assert result.id == "test-session-1"
        assert result.project_name == "Test Project"
        assert result.user_id == "user-1"
        assert result.status == ProjectStatus.DRAFT

    async def test_get_session_by_id(self, db_session):
        """Test retrieving a session by ID."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        session = IdeationSession(
            id="test-session-get",
            project_name="Get Test",
            user_id="user-2",
            status=ProjectStatus.APPROVED,
            data_source=DataSource.CONFIGURED,
            version=2,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await repo.create(session)
        await db_session.commit()

        # Act
        result = await repo.get_by_id("test-session-get")

        # Assert
        assert result is not None
        assert result.id == "test-session-get"
        assert result.project_name == "Get Test"
        assert result.status == ProjectStatus.APPROVED
        assert result.data_source == DataSource.CONFIGURED

    async def test_get_session_not_found(self, db_session):
        """Test get_by_id returns None for non-existent session."""
        # Arrange
        repo = PostgresSessionRepository(db_session)

        # Act
        result = await repo.get_by_id("non-existent-id")

        # Assert
        assert result is None

    async def test_update_session(self, db_session):
        """Test updating a session persists changes."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        session = IdeationSession(
            id="test-session-update",
            project_name="Original Name",
            user_id="user-3",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await repo.create(session)
        await db_session.commit()

        # Act
        session.project_name = "Updated Name"
        session.status = ProjectStatus.IN_BUILD
        session.version = 2
        await repo.update(session)
        await db_session.commit()

        # Assert
        result = await repo.get_by_id("test-session-update")
        assert result is not None
        assert result.project_name == "Updated Name"
        assert result.status == ProjectStatus.IN_BUILD
        assert result.version == 2

    async def test_delete_session(self, db_session):
        """Test deleting a session removes it from database."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        session = IdeationSession(
            id="test-session-delete",
            project_name="Delete Test",
            user_id="user-4",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await repo.create(session)
        await db_session.commit()

        # Act
        await repo.delete("test-session-delete")
        await db_session.commit()

        # Assert
        result = await repo.get_by_id("test-session-delete")
        assert result is None

    async def test_list_by_user_returns_sessions(self, db_session):
        """Test listing sessions for a user."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        user_id = "user-list-test"

        sessions = [
            IdeationSession(
                id=f"list-session-{i}",
                project_name=f"Project {i}",
                user_id=user_id,
                status=ProjectStatus.DRAFT,
                data_source=DataSource.MOCK,
                version=1,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            for i in range(3)
        ]

        for session in sessions:
            await repo.create(session)
        await db_session.commit()

        # Act
        result = await repo.list_by_user(user_id)

        # Assert
        assert len(result) == 3
        assert all(s.user_id == user_id for s in result)

    async def test_list_by_user_with_pagination(self, db_session):
        """Test pagination when listing sessions."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        user_id = "user-pagination-test"

        sessions = [
            IdeationSession(
                id=f"page-session-{i}",
                project_name=f"Project {i}",
                user_id=user_id,
                status=ProjectStatus.DRAFT,
                data_source=DataSource.MOCK,
                version=1,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            for i in range(5)
        ]

        for session in sessions:
            await repo.create(session)
        await db_session.commit()

        # Act
        page1 = await repo.list_by_user(user_id, limit=2, offset=0)
        page2 = await repo.list_by_user(user_id, limit=2, offset=2)

        # Assert
        assert len(page1) == 2
        assert len(page2) == 2
        # Ensure no overlap
        page1_ids = {s.id for s in page1}
        page2_ids = {s.id for s in page2}
        assert page1_ids.isdisjoint(page2_ids)

    async def test_list_by_user_empty(self, db_session):
        """Test listing sessions for user with no sessions."""
        # Arrange
        repo = PostgresSessionRepository(db_session)

        # Act
        result = await repo.list_by_user("non-existent-user")

        # Assert
        assert result == []

    async def test_list_by_user_ordered_by_updated_at(self, db_session):
        """Test sessions are ordered by updated_at descending."""
        # Arrange
        repo = PostgresSessionRepository(db_session)
        user_id = "user-order-test"

        base_time = datetime.now(UTC)
        sessions = []
        for i in range(3):
            from datetime import timedelta

            session = IdeationSession(
                id=f"order-session-{i}",
                project_name=f"Project {i}",
                user_id=user_id,
                status=ProjectStatus.DRAFT,
                data_source=DataSource.MOCK,
                version=1,
                created_at=base_time,
                updated_at=base_time + timedelta(hours=i),
            )
            sessions.append(session)

        # Create in reverse order
        for session in reversed(sessions):
            await repo.create(session)
        await db_session.commit()

        # Act
        result = await repo.list_by_user(user_id)

        # Assert - should be in descending order by updated_at
        assert len(result) == 3
        assert result[0].id == "order-session-2"  # Most recent
        assert result[1].id == "order-session-1"
        assert result[2].id == "order-session-0"  # Oldest


@pytest.mark.asyncio
class TestPostgresSessionRepositoryCascadeDelete:
    """Integration tests for cascade delete behavior."""

    async def test_delete_cascade_removes_messages(self, db_session):
        """Test deleting session cascades to messages."""
        from src.core.models.ideation import ChatMessage, MessageRole
        from src.orchestrator.repositories.postgres.message_repository import (
            PostgresMessageRepository,
        )

        # Arrange
        session_repo = PostgresSessionRepository(db_session)
        message_repo = PostgresMessageRepository(db_session)

        session = IdeationSession(
            id="cascade-session-1",
            project_name="Cascade Test",
            user_id="cascade-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)

        message = ChatMessage(
            id="cascade-message-1",
            session_id="cascade-session-1",
            role=MessageRole.USER,
            content="Test message",
            timestamp=datetime.now(UTC),
            maturity_delta=0,
            metadata=None,
        )
        await message_repo.create(message)
        await db_session.commit()

        # Act
        await session_repo.delete("cascade-session-1")
        await db_session.commit()

        # Assert - message should be deleted too
        messages = await message_repo.get_by_session("cascade-session-1")
        assert messages == []

    async def test_delete_cascade_removes_maturity(self, db_session):
        """Test deleting session cascades to maturity state."""
        from src.core.models.ideation import MaturityCategory, MaturityState
        from src.orchestrator.repositories.postgres.maturity_repository import (
            PostgresMaturityRepository,
        )

        # Arrange
        session_repo = PostgresSessionRepository(db_session)
        maturity_repo = PostgresMaturityRepository(db_session)

        session = IdeationSession(
            id="cascade-session-2",
            project_name="Cascade Maturity Test",
            user_id="cascade-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)

        maturity = MaturityState(
            session_id="cascade-session-2",
            score=50,
            level="intermediate",
            categories=[
                MaturityCategory(
                    id="functional",
                    name="Functional Requirements",
                    score=50,
                    required_for_submit=True,
                )
            ],
            can_submit=False,
            gaps=["Needs more detail"],
            updated_at=datetime.now(UTC),
        )
        await maturity_repo.save(maturity)
        await db_session.commit()

        # Act
        await session_repo.delete("cascade-session-2")
        await db_session.commit()

        # Assert - maturity should be deleted too
        result = await maturity_repo.get_by_session("cascade-session-2")
        assert result is None

    async def test_delete_cascade_removes_requirements(self, db_session):
        """Test deleting session cascades to requirements."""
        from src.core.models.ideation import (
            ExtractedRequirement,
            RequirementPriority,
            RequirementType,
        )
        from src.orchestrator.repositories.postgres.requirement_repository import (
            PostgresRequirementRepository,
        )

        # Arrange
        session_repo = PostgresSessionRepository(db_session)
        req_repo = PostgresRequirementRepository(db_session)

        session = IdeationSession(
            id="cascade-session-3",
            project_name="Cascade Req Test",
            user_id="cascade-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)

        requirement = ExtractedRequirement(
            id="cascade-req-1",
            session_id="cascade-session-3",
            description="Test requirement",
            type=RequirementType.FUNCTIONAL,
            priority=RequirementPriority.MUST_HAVE,
            category_id="core",
            created_at=datetime.now(UTC),
        )
        await req_repo.create(requirement)
        await db_session.commit()

        # Act
        await session_repo.delete("cascade-session-3")
        await db_session.commit()

        # Assert - requirement should be deleted too
        requirements = await req_repo.get_by_session("cascade-session-3")
        assert requirements == []
