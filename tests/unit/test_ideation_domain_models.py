"""Unit tests for ideation domain models.

Tests the pure Python dataclasses for the ideation persistence layer.
Following TDD: these tests are written FIRST before implementation.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone
from typing import TYPE_CHECKING

# Import will fail until implementation exists - this is expected for TDD RED phase
from src.core.models.ideation import (
    ProjectStatus,
    DataSource,
    MessageRole,
    RequirementType,
    RequirementPriority,
    IdeationSession,
    ChatMessage,
    ExtractedRequirement,
    MaturityCategory,
    MaturityState,
    PRDSection,
    PRDDraft,
    UserStory,
)


class TestProjectStatusEnum:
    """Tests for ProjectStatus enum."""

    def test_all_statuses_defined(self):
        """Verify all expected project statuses are defined."""
        expected = ["draft", "approved", "in_build", "closed"]
        for status in expected:
            assert hasattr(ProjectStatus, status.upper()), f"Missing {status}"

    def test_status_string_values(self):
        """Status enum values are lowercase strings."""
        assert ProjectStatus.DRAFT.value == "draft"
        assert ProjectStatus.APPROVED.value == "approved"
        assert ProjectStatus.IN_BUILD.value == "in_build"
        assert ProjectStatus.CLOSED.value == "closed"

    def test_status_is_string_enum(self):
        """ProjectStatus inherits from str for JSON serialization."""
        assert isinstance(ProjectStatus.DRAFT, str)
        assert ProjectStatus.DRAFT == "draft"


class TestDataSourceEnum:
    """Tests for DataSource enum."""

    def test_all_sources_defined(self):
        """Verify all expected data sources are defined."""
        expected = ["mock", "configured"]
        for source in expected:
            assert hasattr(DataSource, source.upper()), f"Missing {source}"

    def test_source_string_values(self):
        """DataSource enum values are lowercase strings."""
        assert DataSource.MOCK.value == "mock"
        assert DataSource.CONFIGURED.value == "configured"


class TestMessageRoleEnum:
    """Tests for MessageRole enum."""

    def test_all_roles_defined(self):
        """Verify all expected message roles are defined."""
        expected = ["user", "assistant", "system"]
        for role in expected:
            assert hasattr(MessageRole, role.upper()), f"Missing {role}"

    def test_role_string_values(self):
        """MessageRole enum values are lowercase strings."""
        assert MessageRole.USER.value == "user"
        assert MessageRole.ASSISTANT.value == "assistant"
        assert MessageRole.SYSTEM.value == "system"


class TestRequirementTypeEnum:
    """Tests for RequirementType enum."""

    def test_all_types_defined(self):
        """Verify all expected requirement types are defined."""
        expected = ["functional", "non_functional"]
        for req_type in expected:
            assert hasattr(RequirementType, req_type.upper()), f"Missing {req_type}"

    def test_type_string_values(self):
        """RequirementType enum values are snake_case strings."""
        assert RequirementType.FUNCTIONAL.value == "functional"
        assert RequirementType.NON_FUNCTIONAL.value == "non_functional"


class TestRequirementPriorityEnum:
    """Tests for RequirementPriority enum."""

    def test_all_priorities_defined(self):
        """Verify all expected priorities are defined (MoSCoW without Won't Have)."""
        expected = ["must_have", "should_have", "could_have"]
        for priority in expected:
            assert hasattr(RequirementPriority, priority.upper()), f"Missing {priority}"

    def test_priority_string_values(self):
        """RequirementPriority enum values are snake_case strings."""
        assert RequirementPriority.MUST_HAVE.value == "must_have"
        assert RequirementPriority.SHOULD_HAVE.value == "should_have"
        assert RequirementPriority.COULD_HAVE.value == "could_have"


class TestIdeationSession:
    """Tests for IdeationSession dataclass."""

    def test_create_minimal_session(self):
        """Create session with only required fields."""
        session = IdeationSession(
            id="session-001",
            project_name="Test Project",
            user_id="user-123",
        )

        assert session.id == "session-001"
        assert session.project_name == "Test Project"
        assert session.user_id == "user-123"
        assert session.status == ProjectStatus.DRAFT
        assert session.data_source == DataSource.MOCK
        assert session.version == 1

    def test_create_full_session(self):
        """Create session with all fields."""
        now = datetime.now(timezone.utc)
        session = IdeationSession(
            id="session-002",
            project_name="Full Project",
            user_id="user-456",
            status=ProjectStatus.APPROVED,
            data_source=DataSource.CONFIGURED,
            version=3,
            created_at=now,
            updated_at=now,
        )

        assert session.status == ProjectStatus.APPROVED
        assert session.data_source == DataSource.CONFIGURED
        assert session.version == 3
        assert session.created_at == now
        assert session.updated_at == now

    def test_session_defaults_timestamps(self):
        """Session gets default timestamps if not provided."""
        session = IdeationSession(
            id="session-003",
            project_name="Default Timestamps",
            user_id="user-789",
        )

        assert session.created_at is not None
        assert session.updated_at is not None
        assert isinstance(session.created_at, datetime)
        assert isinstance(session.updated_at, datetime)


class TestChatMessage:
    """Tests for ChatMessage dataclass."""

    def test_create_minimal_message(self):
        """Create message with only required fields."""
        message = ChatMessage(
            id="msg-001",
            session_id="session-001",
            role=MessageRole.USER,
            content="Hello, I want to build an app",
        )

        assert message.id == "msg-001"
        assert message.session_id == "session-001"
        assert message.role == MessageRole.USER
        assert message.content == "Hello, I want to build an app"
        assert message.maturity_delta == 0
        assert message.metadata is None

    def test_create_full_message(self):
        """Create message with all fields."""
        now = datetime.now(timezone.utc)
        message = ChatMessage(
            id="msg-002",
            session_id="session-001",
            role=MessageRole.ASSISTANT,
            content="That sounds great! Let me help.",
            timestamp=now,
            maturity_delta=5,
            metadata={"source": "claude", "model": "opus"},
        )

        assert message.role == MessageRole.ASSISTANT
        assert message.timestamp == now
        assert message.maturity_delta == 5
        assert message.metadata == {"source": "claude", "model": "opus"}

    def test_message_defaults_timestamp(self):
        """Message gets default timestamp if not provided."""
        message = ChatMessage(
            id="msg-003",
            session_id="session-001",
            role=MessageRole.SYSTEM,
            content="System prompt",
        )

        assert message.timestamp is not None
        assert isinstance(message.timestamp, datetime)


class TestExtractedRequirement:
    """Tests for ExtractedRequirement dataclass."""

    def test_create_minimal_requirement(self):
        """Create requirement with only required fields."""
        requirement = ExtractedRequirement(
            id="req-001",
            session_id="session-001",
            description="The system shall allow users to login",
            type=RequirementType.FUNCTIONAL,
            priority=RequirementPriority.MUST_HAVE,
        )

        assert requirement.id == "req-001"
        assert requirement.session_id == "session-001"
        assert requirement.description == "The system shall allow users to login"
        assert requirement.type == RequirementType.FUNCTIONAL
        assert requirement.priority == RequirementPriority.MUST_HAVE
        assert requirement.category_id is None

    def test_create_full_requirement(self):
        """Create requirement with all fields."""
        now = datetime.now(timezone.utc)
        requirement = ExtractedRequirement(
            id="req-002",
            session_id="session-001",
            description="The system shall respond within 200ms",
            type=RequirementType.NON_FUNCTIONAL,
            priority=RequirementPriority.SHOULD_HAVE,
            category_id="performance",
            created_at=now,
        )

        assert requirement.type == RequirementType.NON_FUNCTIONAL
        assert requirement.priority == RequirementPriority.SHOULD_HAVE
        assert requirement.category_id == "performance"
        assert requirement.created_at == now


class TestMaturityCategory:
    """Tests for MaturityCategory dataclass."""

    def test_create_category(self):
        """Create maturity category."""
        category = MaturityCategory(
            id="cat-problem",
            name="Problem Definition",
            score=75,
            required_for_submit=True,
        )

        assert category.id == "cat-problem"
        assert category.name == "Problem Definition"
        assert category.score == 75
        assert category.required_for_submit is True

    def test_category_not_required(self):
        """Create optional maturity category."""
        category = MaturityCategory(
            id="cat-nice-to-have",
            name="Nice to Have Features",
            score=30,
            required_for_submit=False,
        )

        assert category.required_for_submit is False


class TestMaturityState:
    """Tests for MaturityState dataclass."""

    def test_create_minimal_maturity_state(self):
        """Create maturity state with required fields."""
        categories = [
            MaturityCategory(
                id="cat-1", name="Problem", score=80, required_for_submit=True
            )
        ]
        state = MaturityState(
            session_id="session-001",
            score=80,
            level="intermediate",
            categories=categories,
        )

        assert state.session_id == "session-001"
        assert state.score == 80
        assert state.level == "intermediate"
        assert len(state.categories) == 1
        assert state.can_submit is False
        assert state.gaps == []

    def test_create_full_maturity_state(self):
        """Create maturity state with all fields."""
        now = datetime.now(timezone.utc)
        categories = [
            MaturityCategory(
                id="cat-1", name="Problem", score=100, required_for_submit=True
            ),
            MaturityCategory(
                id="cat-2", name="Solution", score=90, required_for_submit=True
            ),
        ]
        state = MaturityState(
            session_id="session-001",
            score=95,
            level="advanced",
            categories=categories,
            can_submit=True,
            gaps=["Consider adding more user stories"],
            updated_at=now,
        )

        assert state.can_submit is True
        assert len(state.gaps) == 1
        assert state.gaps[0] == "Consider adding more user stories"
        assert state.updated_at == now


class TestPRDSection:
    """Tests for PRDSection dataclass."""

    def test_create_section(self):
        """Create PRD section."""
        section = PRDSection(
            id="sec-001",
            heading="Introduction",
            content="This document describes the requirements for...",
            order=1,
        )

        assert section.id == "sec-001"
        assert section.heading == "Introduction"
        assert section.content == "This document describes the requirements for..."
        assert section.order == 1


class TestPRDDraft:
    """Tests for PRDDraft dataclass."""

    def test_create_minimal_prd_draft(self):
        """Create PRD draft with required fields."""
        sections = [
            PRDSection(id="sec-1", heading="Intro", content="...", order=1)
        ]
        draft = PRDDraft(
            id="prd-001",
            session_id="session-001",
            title="My App PRD",
            version="0.1.0",
            sections=sections,
        )

        assert draft.id == "prd-001"
        assert draft.session_id == "session-001"
        assert draft.title == "My App PRD"
        assert draft.version == "0.1.0"
        assert len(draft.sections) == 1
        assert draft.status == "draft"

    def test_create_full_prd_draft(self):
        """Create PRD draft with all fields."""
        now = datetime.now(timezone.utc)
        sections = [
            PRDSection(id="sec-1", heading="Intro", content="...", order=1),
            PRDSection(id="sec-2", heading="Requirements", content="...", order=2),
        ]
        draft = PRDDraft(
            id="prd-002",
            session_id="session-001",
            title="Final PRD",
            version="1.0.0",
            sections=sections,
            status="approved",
            created_at=now,
        )

        assert draft.status == "approved"
        assert len(draft.sections) == 2
        assert draft.created_at == now


class TestUserStory:
    """Tests for UserStory dataclass."""

    def test_create_minimal_user_story(self):
        """Create user story with required fields."""
        story = UserStory(
            id="story-001",
            session_id="session-001",
            title="User Login",
            as_a="registered user",
            i_want="to login with my email and password",
            so_that="I can access my account",
            acceptance_criteria=["User enters valid credentials", "User is redirected to dashboard"],
        )

        assert story.id == "story-001"
        assert story.session_id == "session-001"
        assert story.title == "User Login"
        assert story.as_a == "registered user"
        assert story.i_want == "to login with my email and password"
        assert story.so_that == "I can access my account"
        assert len(story.acceptance_criteria) == 2
        assert story.linked_requirements == []
        assert story.priority == RequirementPriority.SHOULD_HAVE

    def test_create_full_user_story(self):
        """Create user story with all fields."""
        now = datetime.now(timezone.utc)
        story = UserStory(
            id="story-002",
            session_id="session-001",
            title="Password Reset",
            as_a="user who forgot password",
            i_want="to reset my password via email",
            so_that="I can regain access to my account",
            acceptance_criteria=["User receives email", "Link expires after 24h"],
            linked_requirements=["req-001", "req-002"],
            priority=RequirementPriority.MUST_HAVE,
            created_at=now,
        )

        assert len(story.linked_requirements) == 2
        assert story.priority == RequirementPriority.MUST_HAVE
        assert story.created_at == now
