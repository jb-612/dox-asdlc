"""Integration tests for full ideation persistence workflow.

Tests the complete flow of creating sessions, adding messages,
updating maturity, saving drafts, and verifying data persistence
across "restarts" (new database connections).
"""

from datetime import UTC, datetime

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
from src.orchestrator.repositories.postgres.maturity_repository import (
    PostgresMaturityRepository,
)
from src.orchestrator.repositories.postgres.message_repository import (
    PostgresMessageRepository,
)
from src.orchestrator.repositories.postgres.prd_repository import (
    PostgresPRDRepository,
)
from src.orchestrator.repositories.postgres.requirement_repository import (
    PostgresRequirementRepository,
)
from src.orchestrator.repositories.postgres.session_repository import (
    PostgresSessionRepository,
)


@pytest.mark.asyncio
class TestFullWorkflowIntegration:
    """Integration tests for complete ideation persistence workflow."""

    async def test_full_ideation_workflow(self, clean_db_session):
        """Test complete flow: create session -> add messages -> update maturity -> save draft."""
        db_session = clean_db_session

        # Initialize repositories
        session_repo = PostgresSessionRepository(db_session)
        message_repo = PostgresMessageRepository(db_session)
        maturity_repo = PostgresMaturityRepository(db_session)
        req_repo = PostgresRequirementRepository(db_session)
        prd_repo = PostgresPRDRepository(db_session)

        # Step 1: Create a new session
        session = IdeationSession(
            id="workflow-session-1",
            project_name="Task Management App",
            user_id="workflow-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.CONFIGURED,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)
        await db_session.commit()

        # Step 2: Add conversation messages
        messages = [
            ChatMessage(
                id="wf-msg-1",
                session_id=session.id,
                role=MessageRole.USER,
                content="I want to build a task management app",
                timestamp=datetime.now(UTC),
                maturity_delta=0,
                metadata=None,
            ),
            ChatMessage(
                id="wf-msg-2",
                session_id=session.id,
                role=MessageRole.ASSISTANT,
                content="Great! Tell me about the target users.",
                timestamp=datetime.now(UTC),
                maturity_delta=5,
                metadata={"model": "claude-3"},
            ),
            ChatMessage(
                id="wf-msg-3",
                session_id=session.id,
                role=MessageRole.USER,
                content="Small teams of 5-10 people who need to track tasks.",
                timestamp=datetime.now(UTC),
                maturity_delta=0,
                metadata=None,
            ),
        ]

        for msg in messages:
            await message_repo.create(msg)
        await db_session.commit()

        # Step 3: Update maturity state
        maturity = MaturityState(
            session_id=session.id,
            score=35,
            level="beginner",
            categories=[
                MaturityCategory(
                    id="problem",
                    name="Problem Statement",
                    score=50,
                    required_for_submit=True,
                ),
                MaturityCategory(
                    id="users",
                    name="Target Users",
                    score=40,
                    required_for_submit=True,
                ),
                MaturityCategory(
                    id="features",
                    name="Core Features",
                    score=15,
                    required_for_submit=True,
                ),
            ],
            can_submit=False,
            gaps=["Need to define core features", "Clarify success metrics"],
            updated_at=datetime.now(UTC),
        )
        await maturity_repo.save(maturity)
        await db_session.commit()

        # Step 4: Extract some requirements
        requirements = [
            ExtractedRequirement(
                id="wf-req-1",
                session_id=session.id,
                description="Users can create and assign tasks",
                type=RequirementType.FUNCTIONAL,
                priority=RequirementPriority.MUST_HAVE,
                category_id="features",
                created_at=datetime.now(UTC),
            ),
            ExtractedRequirement(
                id="wf-req-2",
                session_id=session.id,
                description="System must handle 100 concurrent users",
                type=RequirementType.NON_FUNCTIONAL,
                priority=RequirementPriority.SHOULD_HAVE,
                category_id="scalability",
                created_at=datetime.now(UTC),
            ),
        ]

        for req in requirements:
            await req_repo.create(req)
        await db_session.commit()

        # Verify all data was persisted
        retrieved_session = await session_repo.get_by_id(session.id)
        retrieved_messages = await message_repo.get_by_session(session.id)
        retrieved_maturity = await maturity_repo.get_by_session(session.id)
        retrieved_requirements = await req_repo.get_by_session(session.id)

        assert retrieved_session is not None
        assert retrieved_session.project_name == "Task Management App"
        assert len(retrieved_messages) == 3
        assert retrieved_maturity is not None
        assert retrieved_maturity.score == 35
        assert len(retrieved_maturity.categories) == 3
        assert len(retrieved_requirements) == 2

    async def test_resume_session_with_history(self, clean_db_session):
        """Test resuming a session restores all data."""
        db_session = clean_db_session

        # Initialize repositories
        session_repo = PostgresSessionRepository(db_session)
        message_repo = PostgresMessageRepository(db_session)
        maturity_repo = PostgresMaturityRepository(db_session)

        # Create session with data
        session = IdeationSession(
            id="resume-session",
            project_name="Resume Test Project",
            user_id="resume-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.CONFIGURED,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)

        for i in range(5):
            msg = ChatMessage(
                id=f"resume-msg-{i}",
                session_id=session.id,
                role=MessageRole.USER if i % 2 == 0 else MessageRole.ASSISTANT,
                content=f"Message {i} content",
                timestamp=datetime.now(UTC),
                maturity_delta=i * 2,
                metadata=None,
            )
            await message_repo.create(msg)

        maturity = MaturityState(
            session_id=session.id,
            score=60,
            level="intermediate",
            categories=[
                MaturityCategory(
                    id="core",
                    name="Core",
                    score=60,
                    required_for_submit=True,
                )
            ],
            can_submit=False,
            gaps=[],
            updated_at=datetime.now(UTC),
        )
        await maturity_repo.save(maturity)
        await db_session.commit()

        # Simulate "resume" - create fresh repository instances
        fresh_session_repo = PostgresSessionRepository(db_session)
        fresh_message_repo = PostgresMessageRepository(db_session)
        fresh_maturity_repo = PostgresMaturityRepository(db_session)

        # Verify data is restored
        resumed_session = await fresh_session_repo.get_by_id("resume-session")
        resumed_messages = await fresh_message_repo.get_by_session("resume-session")
        resumed_maturity = await fresh_maturity_repo.get_by_session("resume-session")

        assert resumed_session is not None
        assert resumed_session.project_name == "Resume Test Project"
        assert len(resumed_messages) == 5
        assert resumed_maturity is not None
        assert resumed_maturity.score == 60

    async def test_delete_session_cascade_all(self, clean_db_session):
        """Test deleting session removes all related data."""
        db_session = clean_db_session

        # Initialize repositories
        session_repo = PostgresSessionRepository(db_session)
        message_repo = PostgresMessageRepository(db_session)
        maturity_repo = PostgresMaturityRepository(db_session)
        req_repo = PostgresRequirementRepository(db_session)
        prd_repo = PostgresPRDRepository(db_session)

        # Create session with all types of related data
        session = IdeationSession(
            id="cascade-all-session",
            project_name="Cascade All Test",
            user_id="cascade-all-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)

        # Add message
        msg = ChatMessage(
            id="cascade-all-msg",
            session_id=session.id,
            role=MessageRole.USER,
            content="Test",
            timestamp=datetime.now(UTC),
            maturity_delta=0,
            metadata=None,
        )
        await message_repo.create(msg)

        # Add maturity
        maturity = MaturityState(
            session_id=session.id,
            score=20,
            level="beginner",
            categories=[],
            can_submit=False,
            gaps=[],
            updated_at=datetime.now(UTC),
        )
        await maturity_repo.save(maturity)

        # Add requirement
        req = ExtractedRequirement(
            id="cascade-all-req",
            session_id=session.id,
            description="Test requirement",
            type=RequirementType.FUNCTIONAL,
            priority=RequirementPriority.MUST_HAVE,
            category_id=None,
            created_at=datetime.now(UTC),
        )
        await req_repo.create(req)

        # Add PRD draft
        prd = PRDDraft(
            id="cascade-all-prd",
            session_id=session.id,
            title="Test PRD",
            version="0.1",
            sections=[
                PRDSection(id="s1", heading="Overview", content="Test", order=1)
            ],
            status="draft",
            created_at=datetime.now(UTC),
        )
        await prd_repo.save_draft(prd)

        # Add user stories
        stories = [
            UserStory(
                id="cascade-all-story",
                session_id=session.id,
                title="Test Story",
                as_a="user",
                i_want="to test",
                so_that="I can verify",
                acceptance_criteria=["Works"],
                linked_requirements=[],
                priority=RequirementPriority.MUST_HAVE,
                created_at=datetime.now(UTC),
            )
        ]
        await prd_repo.save_user_stories(session.id, stories)
        await db_session.commit()

        # Verify all data exists
        assert await session_repo.get_by_id(session.id) is not None
        assert len(await message_repo.get_by_session(session.id)) == 1
        assert await maturity_repo.get_by_session(session.id) is not None
        assert len(await req_repo.get_by_session(session.id)) == 1
        assert await prd_repo.get_draft(session.id) is not None
        assert len(await prd_repo.get_user_stories(session.id)) == 1

        # Delete session
        await session_repo.delete(session.id)
        await db_session.commit()

        # Verify all related data is deleted
        assert await session_repo.get_by_id(session.id) is None
        assert await message_repo.get_by_session(session.id) == []
        assert await maturity_repo.get_by_session(session.id) is None
        assert await req_repo.get_by_session(session.id) == []
        assert await prd_repo.get_draft(session.id) is None
        assert await prd_repo.get_user_stories(session.id) == []

    async def test_list_drafts_for_user(self, clean_db_session):
        """Test listing all drafts/sessions for a user."""
        db_session = clean_db_session
        session_repo = PostgresSessionRepository(db_session)

        user_id = "list-drafts-user"

        # Create multiple sessions
        for i in range(3):
            session = IdeationSession(
                id=f"draft-session-{i}",
                project_name=f"Project {i}",
                user_id=user_id,
                status=ProjectStatus.DRAFT,
                data_source=DataSource.MOCK,
                version=1,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            await session_repo.create(session)
        await db_session.commit()

        # List sessions
        sessions = await session_repo.list_by_user(user_id)

        assert len(sessions) == 3
        assert all(s.user_id == user_id for s in sessions)


@pytest.mark.asyncio
class TestMaturityUpdateWorkflow:
    """Integration tests for maturity state updates."""

    async def test_maturity_upsert_behavior(self, clean_db_session):
        """Test maturity save acts as upsert (insert or update)."""
        db_session = clean_db_session

        session_repo = PostgresSessionRepository(db_session)
        maturity_repo = PostgresMaturityRepository(db_session)

        # Create session
        session = IdeationSession(
            id="maturity-upsert-session",
            project_name="Maturity Upsert Test",
            user_id="maturity-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)
        await db_session.commit()

        # First save (insert)
        maturity_v1 = MaturityState(
            session_id=session.id,
            score=20,
            level="beginner",
            categories=[
                MaturityCategory(id="cat1", name="Cat 1", score=20, required_for_submit=True)
            ],
            can_submit=False,
            gaps=["Gap 1"],
            updated_at=datetime.now(UTC),
        )
        await maturity_repo.save(maturity_v1)
        await db_session.commit()

        # Verify first version
        result_v1 = await maturity_repo.get_by_session(session.id)
        assert result_v1 is not None
        assert result_v1.score == 20
        assert result_v1.level == "beginner"

        # Second save (update)
        maturity_v2 = MaturityState(
            session_id=session.id,
            score=60,
            level="intermediate",
            categories=[
                MaturityCategory(id="cat1", name="Cat 1", score=60, required_for_submit=True),
                MaturityCategory(id="cat2", name="Cat 2", score=60, required_for_submit=True),
            ],
            can_submit=False,
            gaps=[],
            updated_at=datetime.now(UTC),
        )
        await maturity_repo.save(maturity_v2)
        await db_session.commit()

        # Verify updated version
        result_v2 = await maturity_repo.get_by_session(session.id)
        assert result_v2 is not None
        assert result_v2.score == 60
        assert result_v2.level == "intermediate"
        assert len(result_v2.categories) == 2


@pytest.mark.asyncio
class TestPRDWorkflow:
    """Integration tests for PRD draft and user story workflow."""

    async def test_save_and_retrieve_prd_draft(self, clean_db_session):
        """Test saving and retrieving PRD draft."""
        db_session = clean_db_session

        session_repo = PostgresSessionRepository(db_session)
        prd_repo = PostgresPRDRepository(db_session)

        # Create session
        session = IdeationSession(
            id="prd-workflow-session",
            project_name="PRD Workflow Test",
            user_id="prd-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)
        await db_session.commit()

        # Save PRD draft
        prd = PRDDraft(
            id="prd-draft-1",
            session_id=session.id,
            title="Task Management PRD",
            version="0.1.0",
            sections=[
                PRDSection(id="exec", heading="Executive Summary", content="Overview...", order=1),
                PRDSection(id="problem", heading="Problem Statement", content="Users need...", order=2),
                PRDSection(id="solution", heading="Proposed Solution", content="We will...", order=3),
            ],
            status="draft",
            created_at=datetime.now(UTC),
        )
        await prd_repo.save_draft(prd)
        await db_session.commit()

        # Retrieve
        result = await prd_repo.get_draft(session.id)
        assert result is not None
        assert result.title == "Task Management PRD"
        assert result.version == "0.1.0"
        assert len(result.sections) == 3
        assert result.sections[0].heading == "Executive Summary"

    async def test_save_and_retrieve_user_stories(self, clean_db_session):
        """Test saving and retrieving user stories."""
        db_session = clean_db_session

        session_repo = PostgresSessionRepository(db_session)
        prd_repo = PostgresPRDRepository(db_session)

        # Create session
        session = IdeationSession(
            id="stories-workflow-session",
            project_name="Stories Workflow Test",
            user_id="stories-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)
        await db_session.commit()

        # Save user stories
        stories = [
            UserStory(
                id="story-1",
                session_id=session.id,
                title="Create Task",
                as_a="team member",
                i_want="to create a new task",
                so_that="I can track my work",
                acceptance_criteria=["Task has title", "Task has due date", "Task is assigned"],
                linked_requirements=["req-1", "req-2"],
                priority=RequirementPriority.MUST_HAVE,
                created_at=datetime.now(UTC),
            ),
            UserStory(
                id="story-2",
                session_id=session.id,
                title="View Dashboard",
                as_a="manager",
                i_want="to see team progress",
                so_that="I can plan capacity",
                acceptance_criteria=["Shows task count", "Shows completion rate"],
                linked_requirements=["req-3"],
                priority=RequirementPriority.SHOULD_HAVE,
                created_at=datetime.now(UTC),
            ),
        ]
        await prd_repo.save_user_stories(session.id, stories)
        await db_session.commit()

        # Retrieve
        result = await prd_repo.get_user_stories(session.id)
        assert len(result) == 2
        assert result[0].title == "Create Task"
        assert result[0].as_a == "team member"
        assert len(result[0].acceptance_criteria) == 3
        assert result[1].priority == RequirementPriority.SHOULD_HAVE

    async def test_user_stories_replace_existing(self, clean_db_session):
        """Test saving user stories replaces existing ones."""
        db_session = clean_db_session

        session_repo = PostgresSessionRepository(db_session)
        prd_repo = PostgresPRDRepository(db_session)

        # Create session
        session = IdeationSession(
            id="stories-replace-session",
            project_name="Stories Replace Test",
            user_id="replace-user",
            status=ProjectStatus.DRAFT,
            data_source=DataSource.MOCK,
            version=1,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        await session_repo.create(session)
        await db_session.commit()

        # Save initial stories
        stories_v1 = [
            UserStory(
                id="replace-story-1",
                session_id=session.id,
                title="Old Story 1",
                as_a="user",
                i_want="old feature",
                so_that="old reason",
                acceptance_criteria=["old criteria"],
                linked_requirements=[],
                priority=RequirementPriority.MUST_HAVE,
                created_at=datetime.now(UTC),
            ),
        ]
        await prd_repo.save_user_stories(session.id, stories_v1)
        await db_session.commit()

        # Verify initial stories
        result_v1 = await prd_repo.get_user_stories(session.id)
        assert len(result_v1) == 1
        assert result_v1[0].title == "Old Story 1"

        # Save new stories (should replace)
        stories_v2 = [
            UserStory(
                id="replace-story-2",
                session_id=session.id,
                title="New Story 1",
                as_a="user",
                i_want="new feature",
                so_that="new reason",
                acceptance_criteria=["new criteria"],
                linked_requirements=[],
                priority=RequirementPriority.SHOULD_HAVE,
                created_at=datetime.now(UTC),
            ),
            UserStory(
                id="replace-story-3",
                session_id=session.id,
                title="New Story 2",
                as_a="admin",
                i_want="admin feature",
                so_that="admin reason",
                acceptance_criteria=["admin criteria"],
                linked_requirements=[],
                priority=RequirementPriority.COULD_HAVE,
                created_at=datetime.now(UTC),
            ),
        ]
        await prd_repo.save_user_stories(session.id, stories_v2)
        await db_session.commit()

        # Verify replaced stories
        result_v2 = await prd_repo.get_user_stories(session.id)
        assert len(result_v2) == 2
        titles = {s.title for s in result_v2}
        assert "New Story 1" in titles
        assert "New Story 2" in titles
        assert "Old Story 1" not in titles
