"""Guardrails API data models.

Defines Pydantic models for guardrails CRUD operations,
evaluation, and audit log viewing.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class GuidelineCategoryEnum(str, Enum):
    """Guideline category types.

    Values match the domain GuidelineCategory enum exactly to ensure
    lossless round-tripping between API and domain layers.
    """

    COGNITIVE_ISOLATION = "cognitive_isolation"
    HITL_GATE = "hitl_gate"
    TDD_PROTOCOL = "tdd_protocol"
    CONTEXT_CONSTRAINT = "context_constraint"
    AUDIT_TELEMETRY = "audit_telemetry"
    SECURITY = "security"
    CUSTOM = "custom"


class ActionTypeEnum(str, Enum):
    """Action type for guideline actions.

    Values match the domain ActionType enum exactly to ensure
    lossless round-tripping between API and domain layers.
    """

    INSTRUCTION = "instruction"
    TOOL_RESTRICTION = "tool_restriction"
    HITL_GATE = "hitl_gate"
    CONSTRAINT = "constraint"
    TELEMETRY = "telemetry"


class GuidelineConditionModel(BaseModel):
    """Condition for when a guideline applies."""

    agents: list[str] | None = None
    domains: list[str] | None = None
    actions: list[str] | None = None
    paths: list[str] | None = None
    events: list[str] | None = None
    gate_types: list[str] | None = None


class GuidelineActionModel(BaseModel):
    """Action to take when guideline matches."""

    action_type: ActionTypeEnum
    instruction: str | None = None
    tools_allowed: list[str] | None = None
    tools_denied: list[str] | None = None
    gate_type: str | None = None
    gate_threshold: str | None = None
    max_files: int | None = None
    require_tests: bool | None = None
    require_review: bool | None = None


class GuidelineCreate(BaseModel):
    """Request model for creating a new guideline."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: GuidelineCategoryEnum
    priority: int = Field(default=100, ge=0, le=1000)
    enabled: bool = Field(default=True)
    condition: GuidelineConditionModel
    action: GuidelineActionModel


class GuidelineUpdate(BaseModel):
    """Request model for updating a guideline. All fields optional."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: GuidelineCategoryEnum | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)
    enabled: bool | None = None
    condition: GuidelineConditionModel | None = None
    action: GuidelineActionModel | None = None
    version: int = Field(..., description="Version for optimistic locking")


class GuidelineResponse(BaseModel):
    """Response model for a single guideline."""

    id: str
    name: str
    description: str
    category: str
    priority: int
    enabled: bool
    condition: GuidelineConditionModel
    action: GuidelineActionModel
    version: int
    created_at: str
    updated_at: str
    created_by: str | None = None
    tenant_id: str | None = None


class GuidelinesListResponse(BaseModel):
    """Response model for listing guidelines."""

    guidelines: list[GuidelineResponse]
    total: int
    page: int = 1
    page_size: int = 20


class TaskContextRequest(BaseModel):
    """Request model for evaluating context."""

    agent: str | None = None
    domain: str | None = None
    action: str | None = None
    paths: list[str] | None = None
    event: str | None = None
    gate_type: str | None = None
    session_id: str | None = None


class EvaluatedGuidelineResponse(BaseModel):
    """Response for a single evaluated guideline."""

    guideline_id: str
    guideline_name: str
    priority: int
    match_score: float
    matched_fields: list[str]


class EvaluatedContextResponse(BaseModel):
    """Response model for evaluated context."""

    matched_count: int
    combined_instruction: str
    tools_allowed: list[str]
    tools_denied: list[str]
    hitl_gates: list[str]
    guidelines: list[EvaluatedGuidelineResponse]


class AuditLogEntry(BaseModel):
    """Response model for an audit log entry."""

    id: str
    event_type: str
    guideline_id: str | None = None
    timestamp: str
    decision: dict | None = None
    context: dict | None = None
    changes: dict | None = None


class AuditLogResponse(BaseModel):
    """Response model for listing audit entries."""

    entries: list[AuditLogEntry]
    total: int
