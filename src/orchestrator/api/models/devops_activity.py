"""Pydantic models for DevOps activity endpoints.

This module defines the data models for tracking DevOps operations,
including step-by-step progress and activity history.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class DevOpsStepStatus(str, Enum):
    """Status of a DevOps operation step."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class DevOpsActivityStatus(str, Enum):
    """Status of an overall DevOps activity."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class DevOpsStep(BaseModel):
    """A single step within a DevOps operation.

    Attributes:
        name: Human-readable name of the step.
        status: Current status of the step.
        started_at: When the step began execution.
        completed_at: When the step finished (success or failure).
        error: Error message if the step failed.
    """

    name: str
    status: DevOpsStepStatus
    started_at: datetime | None = Field(default=None, alias="startedAt")
    completed_at: datetime | None = Field(default=None, alias="completedAt")
    error: str | None = None

    model_config = {"populate_by_name": True}


class DevOpsActivity(BaseModel):
    """A DevOps operation with its steps and status.

    Attributes:
        id: Unique identifier for this activity.
        operation: Description of the operation being performed.
        status: Current overall status of the activity.
        started_at: When the activity began.
        completed_at: When the activity finished (if completed).
        steps: List of steps in this activity.
    """

    id: str
    operation: str
    status: DevOpsActivityStatus
    started_at: datetime = Field(alias="startedAt")
    completed_at: datetime | None = Field(default=None, alias="completedAt")
    steps: list[DevOpsStep]

    model_config = {"populate_by_name": True}


class DevOpsActivityResponse(BaseModel):
    """Response model for DevOps activity endpoint.

    Attributes:
        current: The currently running activity, if any.
        recent: List of recently completed activities.
    """

    current: DevOpsActivity | None = None
    recent: list[DevOpsActivity]
