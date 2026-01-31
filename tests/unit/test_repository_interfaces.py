"""Unit tests for repository interfaces.

Tests that the abstract base classes are properly defined with async methods.
Following TDD: these tests are written FIRST before implementation.
"""

from __future__ import annotations

import pytest
from abc import ABC
from inspect import iscoroutinefunction, signature
from typing import get_type_hints, List, Optional

# Import will fail until implementation exists - this is expected for TDD RED phase
from src.orchestrator.repositories.interfaces import (
    ISessionRepository,
    IMessageRepository,
    IRequirementRepository,
    IMaturityRepository,
    IPRDRepository,
)
from src.core.models.ideation import (
    IdeationSession,
    ChatMessage,
    ExtractedRequirement,
    MaturityState,
    PRDDraft,
    UserStory,
)


class TestISessionRepository:
    """Tests for ISessionRepository interface."""

    def test_is_abstract_base_class(self):
        """ISessionRepository is an ABC."""
        assert issubclass(ISessionRepository, ABC)

    def test_cannot_instantiate(self):
        """Cannot instantiate abstract class directly."""
        with pytest.raises(TypeError):
            ISessionRepository()

    def test_create_method_is_abstract_and_async(self):
        """create method is abstract and async."""
        assert hasattr(ISessionRepository, "create")
        method = getattr(ISessionRepository, "create")
        assert iscoroutinefunction(method)

    def test_get_by_id_method_is_abstract_and_async(self):
        """get_by_id method is abstract and async."""
        assert hasattr(ISessionRepository, "get_by_id")
        method = getattr(ISessionRepository, "get_by_id")
        assert iscoroutinefunction(method)

    def test_update_method_is_abstract_and_async(self):
        """update method is abstract and async."""
        assert hasattr(ISessionRepository, "update")
        method = getattr(ISessionRepository, "update")
        assert iscoroutinefunction(method)

    def test_delete_method_is_abstract_and_async(self):
        """delete method is abstract and async."""
        assert hasattr(ISessionRepository, "delete")
        method = getattr(ISessionRepository, "delete")
        assert iscoroutinefunction(method)

    def test_list_by_user_method_is_abstract_and_async(self):
        """list_by_user method is abstract and async."""
        assert hasattr(ISessionRepository, "list_by_user")
        method = getattr(ISessionRepository, "list_by_user")
        assert iscoroutinefunction(method)

    def test_create_signature(self):
        """create method has correct signature."""
        sig = signature(ISessionRepository.create)
        params = list(sig.parameters.keys())
        assert "session" in params

    def test_get_by_id_signature(self):
        """get_by_id method has correct signature."""
        sig = signature(ISessionRepository.get_by_id)
        params = list(sig.parameters.keys())
        assert "session_id" in params

    def test_list_by_user_signature(self):
        """list_by_user method has correct signature with pagination."""
        sig = signature(ISessionRepository.list_by_user)
        params = list(sig.parameters.keys())
        assert "user_id" in params
        assert "limit" in params
        assert "offset" in params


class TestIMessageRepository:
    """Tests for IMessageRepository interface."""

    def test_is_abstract_base_class(self):
        """IMessageRepository is an ABC."""
        assert issubclass(IMessageRepository, ABC)

    def test_cannot_instantiate(self):
        """Cannot instantiate abstract class directly."""
        with pytest.raises(TypeError):
            IMessageRepository()

    def test_create_method_is_abstract_and_async(self):
        """create method is abstract and async."""
        assert hasattr(IMessageRepository, "create")
        method = getattr(IMessageRepository, "create")
        assert iscoroutinefunction(method)

    def test_get_by_session_method_is_abstract_and_async(self):
        """get_by_session method is abstract and async."""
        assert hasattr(IMessageRepository, "get_by_session")
        method = getattr(IMessageRepository, "get_by_session")
        assert iscoroutinefunction(method)

    def test_delete_by_session_method_is_abstract_and_async(self):
        """delete_by_session method is abstract and async."""
        assert hasattr(IMessageRepository, "delete_by_session")
        method = getattr(IMessageRepository, "delete_by_session")
        assert iscoroutinefunction(method)

    def test_get_by_session_signature(self):
        """get_by_session method has correct signature with pagination."""
        sig = signature(IMessageRepository.get_by_session)
        params = list(sig.parameters.keys())
        assert "session_id" in params
        assert "limit" in params
        assert "offset" in params


class TestIRequirementRepository:
    """Tests for IRequirementRepository interface."""

    def test_is_abstract_base_class(self):
        """IRequirementRepository is an ABC."""
        assert issubclass(IRequirementRepository, ABC)

    def test_cannot_instantiate(self):
        """Cannot instantiate abstract class directly."""
        with pytest.raises(TypeError):
            IRequirementRepository()

    def test_create_method_is_abstract_and_async(self):
        """create method is abstract and async."""
        assert hasattr(IRequirementRepository, "create")
        method = getattr(IRequirementRepository, "create")
        assert iscoroutinefunction(method)

    def test_get_by_session_method_is_abstract_and_async(self):
        """get_by_session method is abstract and async."""
        assert hasattr(IRequirementRepository, "get_by_session")
        method = getattr(IRequirementRepository, "get_by_session")
        assert iscoroutinefunction(method)

    def test_update_method_is_abstract_and_async(self):
        """update method is abstract and async."""
        assert hasattr(IRequirementRepository, "update")
        method = getattr(IRequirementRepository, "update")
        assert iscoroutinefunction(method)

    def test_delete_method_is_abstract_and_async(self):
        """delete method is abstract and async."""
        assert hasattr(IRequirementRepository, "delete")
        method = getattr(IRequirementRepository, "delete")
        assert iscoroutinefunction(method)


class TestIMaturityRepository:
    """Tests for IMaturityRepository interface."""

    def test_is_abstract_base_class(self):
        """IMaturityRepository is an ABC."""
        assert issubclass(IMaturityRepository, ABC)

    def test_cannot_instantiate(self):
        """Cannot instantiate abstract class directly."""
        with pytest.raises(TypeError):
            IMaturityRepository()

    def test_save_method_is_abstract_and_async(self):
        """save method is abstract and async."""
        assert hasattr(IMaturityRepository, "save")
        method = getattr(IMaturityRepository, "save")
        assert iscoroutinefunction(method)

    def test_get_by_session_method_is_abstract_and_async(self):
        """get_by_session method is abstract and async."""
        assert hasattr(IMaturityRepository, "get_by_session")
        method = getattr(IMaturityRepository, "get_by_session")
        assert iscoroutinefunction(method)


class TestIPRDRepository:
    """Tests for IPRDRepository interface."""

    def test_is_abstract_base_class(self):
        """IPRDRepository is an ABC."""
        assert issubclass(IPRDRepository, ABC)

    def test_cannot_instantiate(self):
        """Cannot instantiate abstract class directly."""
        with pytest.raises(TypeError):
            IPRDRepository()

    def test_save_draft_method_is_abstract_and_async(self):
        """save_draft method is abstract and async."""
        assert hasattr(IPRDRepository, "save_draft")
        method = getattr(IPRDRepository, "save_draft")
        assert iscoroutinefunction(method)

    def test_get_draft_method_is_abstract_and_async(self):
        """get_draft method is abstract and async."""
        assert hasattr(IPRDRepository, "get_draft")
        method = getattr(IPRDRepository, "get_draft")
        assert iscoroutinefunction(method)

    def test_save_user_stories_method_is_abstract_and_async(self):
        """save_user_stories method is abstract and async."""
        assert hasattr(IPRDRepository, "save_user_stories")
        method = getattr(IPRDRepository, "save_user_stories")
        assert iscoroutinefunction(method)

    def test_get_user_stories_method_is_abstract_and_async(self):
        """get_user_stories method is abstract and async."""
        assert hasattr(IPRDRepository, "get_user_stories")
        method = getattr(IPRDRepository, "get_user_stories")
        assert iscoroutinefunction(method)


class TestConcreteImplementationRequired:
    """Tests that verify concrete implementations can be created."""

    def test_session_repository_can_be_subclassed(self):
        """Concrete implementation of ISessionRepository can be created."""

        class MockSessionRepository(ISessionRepository):
            async def create(self, session: IdeationSession) -> IdeationSession:
                return session

            async def get_by_id(self, session_id: str) -> Optional[IdeationSession]:
                return None

            async def update(self, session: IdeationSession) -> None:
                pass

            async def delete(self, session_id: str) -> None:
                pass

            async def list_by_user(
                self, user_id: str, limit: int = 50, offset: int = 0
            ) -> List[IdeationSession]:
                return []

        # Should not raise - can instantiate concrete implementation
        repo = MockSessionRepository()
        assert repo is not None

    def test_message_repository_can_be_subclassed(self):
        """Concrete implementation of IMessageRepository can be created."""

        class MockMessageRepository(IMessageRepository):
            async def create(self, message: ChatMessage) -> ChatMessage:
                return message

            async def get_by_session(
                self, session_id: str, limit: int = 100, offset: int = 0
            ) -> List[ChatMessage]:
                return []

            async def delete_by_session(self, session_id: str) -> None:
                pass

        repo = MockMessageRepository()
        assert repo is not None

    def test_requirement_repository_can_be_subclassed(self):
        """Concrete implementation of IRequirementRepository can be created."""

        class MockRequirementRepository(IRequirementRepository):
            async def create(
                self, requirement: ExtractedRequirement
            ) -> ExtractedRequirement:
                return requirement

            async def get_by_session(
                self, session_id: str
            ) -> List[ExtractedRequirement]:
                return []

            async def update(self, requirement: ExtractedRequirement) -> None:
                pass

            async def delete(self, requirement_id: str) -> None:
                pass

        repo = MockRequirementRepository()
        assert repo is not None

    def test_maturity_repository_can_be_subclassed(self):
        """Concrete implementation of IMaturityRepository can be created."""

        class MockMaturityRepository(IMaturityRepository):
            async def save(self, maturity: MaturityState) -> None:
                pass

            async def get_by_session(
                self, session_id: str
            ) -> Optional[MaturityState]:
                return None

        repo = MockMaturityRepository()
        assert repo is not None

    def test_prd_repository_can_be_subclassed(self):
        """Concrete implementation of IPRDRepository can be created."""

        class MockPRDRepository(IPRDRepository):
            async def save_draft(self, draft: PRDDraft) -> PRDDraft:
                return draft

            async def get_draft(self, session_id: str) -> Optional[PRDDraft]:
                return None

            async def save_user_stories(
                self, session_id: str, stories: List[UserStory]
            ) -> None:
                pass

            async def get_user_stories(self, session_id: str) -> List[UserStory]:
                return []

        repo = MockPRDRepository()
        assert repo is not None
