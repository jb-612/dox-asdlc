"""Specialized code reviewers for the Parallel Review Swarm.

This module provides specialized reviewer implementations that focus on
different aspects of code quality: security, performance, and style.

Each reviewer implements the SpecializedReviewer protocol and provides
domain-specific system prompts and checklists for code review.
"""

from src.workers.swarm.reviewers.base import ReviewerRegistry, SpecializedReviewer
from src.workers.swarm.reviewers.performance import PerformanceReviewer
from src.workers.swarm.reviewers.security import SecurityReviewer
from src.workers.swarm.reviewers.style import StyleReviewer

# Create a default registry populated with all built-in reviewers
default_registry = ReviewerRegistry()
default_registry.register(SecurityReviewer())
default_registry.register(PerformanceReviewer())
default_registry.register(StyleReviewer())

__all__ = [
    "SpecializedReviewer",
    "ReviewerRegistry",
    "SecurityReviewer",
    "PerformanceReviewer",
    "StyleReviewer",
    "default_registry",
]
