"""Pydantic models for Ideas API (Brainflare Hub).

This module defines the data models for managing ideas in the Brainflare Hub,
including CRUD operations, filtering, and word count validation.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class IdeaStatus(str, Enum):
    """Status of an idea."""

    ACTIVE = "active"
    ARCHIVED = "archived"


class IdeaClassification(str, Enum):
    """Classification type for ideas."""

    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non_functional"
    UNDETERMINED = "undetermined"


class Idea(BaseModel):
    """An idea in the Brainflare Hub.

    Attributes:
        id: Unique identifier for this idea.
        content: The idea content (max 144 words enforced at API level).
        author_id: ID of the author who created this idea.
        author_name: Display name of the author.
        status: Current status of the idea (active/archived).
        classification: Type classification (functional/non_functional/undetermined).
        labels: List of tags/labels attached to this idea.
        created_at: When the idea was created.
        updated_at: When the idea was last modified.
        word_count: Number of words in the content.
    """

    id: str
    content: str = Field(..., max_length=1000, description="Idea content (max 144 words enforced at API)")
    author_id: str
    author_name: str
    status: IdeaStatus = IdeaStatus.ACTIVE
    classification: IdeaClassification = IdeaClassification.UNDETERMINED
    labels: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    word_count: int = 0

    model_config = {"populate_by_name": True}


class CreateIdeaRequest(BaseModel):
    """Request to create a new idea.

    Attributes:
        content: The idea content (1-1000 characters, max 144 words enforced at API).
        author_id: ID of the author creating this idea.
        author_name: Display name of the author.
        classification: Initial classification for the idea.
        labels: Initial labels to attach to this idea.
    """

    content: str = Field(..., min_length=1, max_length=1000)
    author_id: str = "anonymous"
    author_name: str = "Anonymous"
    classification: IdeaClassification = IdeaClassification.UNDETERMINED
    labels: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class UpdateIdeaRequest(BaseModel):
    """Request to update an idea.

    All fields are optional to support partial updates.

    Attributes:
        content: New content for the idea (max 144 words enforced at API).
        status: New status for the idea.
        classification: New classification for the idea.
        labels: New labels for the idea (replaces existing labels).
    """

    content: str | None = Field(default=None, max_length=1000)
    status: IdeaStatus | None = None
    classification: IdeaClassification | None = None
    labels: list[str] | None = None

    model_config = {"populate_by_name": True}


class IdeaListResponse(BaseModel):
    """Response for listing ideas.

    Attributes:
        ideas: List of ideas matching the query.
        total: Total number of matching ideas (for pagination).
        limit: Maximum number of ideas returned.
        offset: Number of ideas skipped.
    """

    ideas: list[Idea]
    total: int
    limit: int
    offset: int

    model_config = {"populate_by_name": True}
