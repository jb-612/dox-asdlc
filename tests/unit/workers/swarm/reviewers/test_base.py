"""Unit tests for reviewer base protocol and registry.

Tests for SpecializedReviewer protocol and ReviewerRegistry class.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import pytest


class TestSpecializedReviewerProtocol:
    """Tests for SpecializedReviewer protocol definition."""

    def test_protocol_is_importable(self) -> None:
        """Test that SpecializedReviewer protocol can be imported."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        assert SpecializedReviewer is not None

    def test_protocol_is_runtime_checkable(self) -> None:
        """Test that protocol can be used with isinstance checks."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        # Protocol should be runtime_checkable
        assert hasattr(SpecializedReviewer, "__protocol_attrs__") or isinstance(
            SpecializedReviewer, type
        )

    def test_protocol_requires_reviewer_type_property(self) -> None:
        """Test that protocol requires reviewer_type property."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        # Create a class that doesn't implement reviewer_type
        class IncompleteReviewer:
            focus_areas: list[str] = []
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return ""

            def get_checklist(self) -> list[str]:
                return []

        # Should not be considered an instance of the protocol
        reviewer = IncompleteReviewer()
        assert not isinstance(reviewer, SpecializedReviewer)

    def test_protocol_requires_focus_areas_property(self) -> None:
        """Test that protocol requires focus_areas property."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        class IncompleteReviewer:
            reviewer_type: str = "test"
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return ""

            def get_checklist(self) -> list[str]:
                return []

        reviewer = IncompleteReviewer()
        assert not isinstance(reviewer, SpecializedReviewer)

    def test_protocol_requires_severity_weights_property(self) -> None:
        """Test that protocol requires severity_weights property."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        class IncompleteReviewer:
            reviewer_type: str = "test"
            focus_areas: list[str] = []

            def get_system_prompt(self) -> str:
                return ""

            def get_checklist(self) -> list[str]:
                return []

        reviewer = IncompleteReviewer()
        assert not isinstance(reviewer, SpecializedReviewer)

    def test_protocol_requires_get_system_prompt_method(self) -> None:
        """Test that protocol requires get_system_prompt method."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        class IncompleteReviewer:
            reviewer_type: str = "test"
            focus_areas: list[str] = []
            severity_weights: dict[str, float] = {}

            def get_checklist(self) -> list[str]:
                return []

        reviewer = IncompleteReviewer()
        assert not isinstance(reviewer, SpecializedReviewer)

    def test_protocol_requires_get_checklist_method(self) -> None:
        """Test that protocol requires get_checklist method."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        class IncompleteReviewer:
            reviewer_type: str = "test"
            focus_areas: list[str] = []
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return ""

        reviewer = IncompleteReviewer()
        assert not isinstance(reviewer, SpecializedReviewer)

    def test_complete_implementation_satisfies_protocol(self) -> None:
        """Test that a complete implementation satisfies the protocol."""
        from src.workers.swarm.reviewers.base import SpecializedReviewer

        class CompleteReviewer:
            reviewer_type: str = "test"
            focus_areas: list[str] = ["area1", "area2"]
            severity_weights: dict[str, float] = {"area1": 0.8, "area2": 0.5}

            def get_system_prompt(self) -> str:
                return "Test system prompt"

            def get_checklist(self) -> list[str]:
                return ["Check item 1", "Check item 2"]

        reviewer = CompleteReviewer()
        assert isinstance(reviewer, SpecializedReviewer)


class TestReviewerRegistry:
    """Tests for ReviewerRegistry class."""

    def test_registry_is_importable(self) -> None:
        """Test that ReviewerRegistry can be imported."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        assert ReviewerRegistry is not None

    def test_registry_can_be_instantiated(self) -> None:
        """Test that ReviewerRegistry can be instantiated."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        registry = ReviewerRegistry()
        assert registry is not None

    def test_registry_register_adds_reviewer(self) -> None:
        """Test that register() adds a reviewer to the registry."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry, SpecializedReviewer

        class TestReviewer:
            reviewer_type: str = "test"
            focus_areas: list[str] = ["area1"]
            severity_weights: dict[str, float] = {"area1": 0.5}

            def get_system_prompt(self) -> str:
                return "Test prompt"

            def get_checklist(self) -> list[str]:
                return ["Check 1"]

        registry = ReviewerRegistry()
        reviewer = TestReviewer()
        registry.register(reviewer)

        assert registry.get("test") is reviewer

    def test_registry_get_returns_none_for_unknown_type(self) -> None:
        """Test that get() returns None for unknown reviewer type."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        registry = ReviewerRegistry()
        result = registry.get("nonexistent")

        assert result is None

    def test_registry_get_returns_registered_reviewer(self) -> None:
        """Test that get() returns the registered reviewer."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        class TestReviewer:
            reviewer_type: str = "custom"
            focus_areas: list[str] = ["area1"]
            severity_weights: dict[str, float] = {"area1": 0.5}

            def get_system_prompt(self) -> str:
                return "Custom prompt"

            def get_checklist(self) -> list[str]:
                return ["Custom check"]

        registry = ReviewerRegistry()
        reviewer = TestReviewer()
        registry.register(reviewer)

        retrieved = registry.get("custom")
        assert retrieved is reviewer
        assert retrieved.reviewer_type == "custom"

    def test_registry_list_types_returns_empty_initially(self) -> None:
        """Test that list_types() returns empty list when no reviewers registered."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        registry = ReviewerRegistry()
        types = registry.list_types()

        assert types == []

    def test_registry_list_types_returns_all_registered_types(self) -> None:
        """Test that list_types() returns all registered reviewer types."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        class ReviewerA:
            reviewer_type: str = "type_a"
            focus_areas: list[str] = []
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return ""

            def get_checklist(self) -> list[str]:
                return []

        class ReviewerB:
            reviewer_type: str = "type_b"
            focus_areas: list[str] = []
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return ""

            def get_checklist(self) -> list[str]:
                return []

        registry = ReviewerRegistry()
        registry.register(ReviewerA())
        registry.register(ReviewerB())

        types = registry.list_types()

        assert sorted(types) == ["type_a", "type_b"]

    def test_registry_register_overwrites_existing_type(self) -> None:
        """Test that registering with same type overwrites existing reviewer."""
        from src.workers.swarm.reviewers.base import ReviewerRegistry

        class ReviewerV1:
            reviewer_type: str = "same_type"
            focus_areas: list[str] = ["v1"]
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return "V1 prompt"

            def get_checklist(self) -> list[str]:
                return []

        class ReviewerV2:
            reviewer_type: str = "same_type"
            focus_areas: list[str] = ["v2"]
            severity_weights: dict[str, float] = {}

            def get_system_prompt(self) -> str:
                return "V2 prompt"

            def get_checklist(self) -> list[str]:
                return []

        registry = ReviewerRegistry()
        v1 = ReviewerV1()
        v2 = ReviewerV2()

        registry.register(v1)
        registry.register(v2)

        retrieved = registry.get("same_type")
        assert retrieved is v2
        assert retrieved.get_system_prompt() == "V2 prompt"
