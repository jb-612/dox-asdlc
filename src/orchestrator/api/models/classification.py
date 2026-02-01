"""Pydantic models for Classification API.

This module defines the data models for auto-classification of ideas,
including classification results, requests, labels, and taxonomy management.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ClassificationType(str, Enum):
    """Classification type for ideas.
    
    Indicates whether an idea is functional (user-facing feature),
    non-functional (technical/quality concern), or undetermined.
    """

    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non_functional"
    UNDETERMINED = "undetermined"


class ClassificationJobStatus(str, Enum):
    """Status of a batch classification job."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class LabelDefinition(BaseModel):
    """Definition of a label in the taxonomy.

    Attributes:
        id: Unique identifier for the label (e.g., "feature", "bug").
        name: Human-readable display name.
        description: Optional description of when to use this label.
        keywords: Keywords that help identify ideas for this label.
        color: Optional hex color code for UI display (e.g., "#22c55e").
    """

    id: str
    name: str
    description: str | None = None
    keywords: list[str] = Field(default_factory=list)
    color: str | None = None

    model_config = {"populate_by_name": True}


class LabelTaxonomy(BaseModel):
    """A taxonomy of labels for idea classification.

    Attributes:
        id: Unique identifier for the taxonomy.
        name: Human-readable name for the taxonomy.
        description: Optional description of the taxonomy.
        labels: List of label definitions in this taxonomy.
        version: Version string for tracking taxonomy changes.
        created_at: When the taxonomy was created.
        updated_at: When the taxonomy was last modified.
    """

    id: str
    name: str
    description: str | None = None
    labels: list[LabelDefinition]
    version: str
    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}


class ClassificationResult(BaseModel):
    """Result of classifying an idea.

    Attributes:
        idea_id: The ID of the classified idea.
        classification: The determined classification type.
        confidence: Confidence score from 0.0 to 1.0.
        labels: List of label IDs assigned to this idea.
        reasoning: Optional explanation of the classification decision.
        model_version: Optional version of the classification model used.
    """

    idea_id: str
    classification: ClassificationType
    confidence: float = Field(..., ge=0.0, le=1.0)
    labels: list[str]
    reasoning: str | None = None
    model_version: str | None = None

    model_config = {"populate_by_name": True}


class ClassificationRequest(BaseModel):
    """Request to classify a single idea.

    Attributes:
        idea_id: The ID of the idea to classify.
    """

    idea_id: str

    model_config = {"populate_by_name": True}


class BatchClassificationRequest(BaseModel):
    """Request to classify multiple ideas in a batch.

    Attributes:
        idea_ids: List of idea IDs to classify.
    """

    idea_ids: list[str]

    model_config = {"populate_by_name": True}


class ClassificationJob(BaseModel):
    """A batch classification job.

    Attributes:
        job_id: Unique identifier for the job.
        status: Current status of the job.
        total: Total number of ideas to classify.
        completed: Number of ideas successfully classified.
        failed: Number of ideas that failed classification.
        created_at: When the job was created.
    """

    job_id: str
    status: ClassificationJobStatus
    total: int = Field(..., ge=0)
    completed: int = Field(default=0, ge=0)
    failed: int = Field(default=0, ge=0)
    created_at: datetime

    model_config = {"populate_by_name": True}
