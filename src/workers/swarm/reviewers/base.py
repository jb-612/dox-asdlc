"""Base protocol and registry for specialized code reviewers.

This module defines the SpecializedReviewer protocol that all specialized
reviewers must implement, and the ReviewerRegistry for managing reviewer
instances.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class SpecializedReviewer(Protocol):
    """Protocol defining the interface for specialized code reviewers.

    All specialized reviewers must implement this protocol to be used
    in the Parallel Review Swarm system.

    Attributes:
        reviewer_type: Unique identifier for this reviewer type (e.g., 'security').
        focus_areas: List of focus areas this reviewer examines.
        severity_weights: Mapping of focus areas to their severity weights (0.0-1.0).

    Methods:
        get_system_prompt: Returns the system prompt for LLM-based review.
        get_checklist: Returns a list of checklist items for manual review.
    """

    reviewer_type: str
    focus_areas: list[str]
    severity_weights: dict[str, float]

    def get_system_prompt(self) -> str:
        """Return the system prompt for LLM-based code review.

        The prompt should instruct the LLM to focus on this reviewer's
        specific domain and priorities.

        Returns:
            A detailed system prompt string.
        """
        ...

    def get_checklist(self) -> list[str]:
        """Return a checklist of items to verify during review.

        Each item should be an actionable statement describing what
        to check for in the code.

        Returns:
            A list of checklist item strings.
        """
        ...


class ReviewerRegistry:
    """Registry for managing specialized reviewer instances.

    The registry provides a central location to register and retrieve
    reviewer implementations by their type identifier.

    Example:
        >>> registry = ReviewerRegistry()
        >>> registry.register(SecurityReviewer())
        >>> reviewer = registry.get("security")
        >>> reviewer.reviewer_type
        'security'
    """

    def __init__(self) -> None:
        """Initialize an empty reviewer registry."""
        self._reviewers: dict[str, SpecializedReviewer] = {}

    def register(self, reviewer: SpecializedReviewer) -> None:
        """Register a reviewer instance in the registry.

        If a reviewer with the same type is already registered, it will
        be overwritten with the new instance.

        Args:
            reviewer: The reviewer instance to register.
        """
        self._reviewers[reviewer.reviewer_type] = reviewer

    def get(self, reviewer_type: str) -> SpecializedReviewer | None:
        """Retrieve a reviewer by its type identifier.

        Args:
            reviewer_type: The type identifier of the reviewer to retrieve.

        Returns:
            The reviewer instance if found, None otherwise.
        """
        return self._reviewers.get(reviewer_type)

    def list_types(self) -> list[str]:
        """List all registered reviewer type identifiers.

        Returns:
            A list of all registered reviewer type identifiers.
        """
        return list(self._reviewers.keys())
