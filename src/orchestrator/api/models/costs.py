"""Cost tracking API data models (P13-F01).

Pydantic models for cost record listing, summaries,
session breakdowns, and pricing table responses.
"""

from __future__ import annotations

from pydantic import BaseModel


class CostRecordResponse(BaseModel):
    id: int
    timestamp: float
    session_id: str | None = None
    agent_id: str | None = None
    model: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0
    tool_name: str | None = None
    hook_event_id: int | None = None


class CostRecordsListResponse(BaseModel):
    records: list[CostRecordResponse]
    total: int
    page: int = 1
    page_size: int = 50


class CostSummaryGroupResponse(BaseModel):
    key: str | None = None
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    record_count: int = 0


class PeriodRange(BaseModel):
    date_from: str
    date_to: str


class CostSummaryResponse(BaseModel):
    groups: list[CostSummaryGroupResponse]
    total_cost_usd: float = 0.0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    period: PeriodRange | None = None


class ModelBreakdownEntry(BaseModel):
    model: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0


class ToolBreakdownEntry(BaseModel):
    tool_name: str | None = None
    call_count: int = 0
    total_cost_usd: float = 0.0


class SessionCostBreakdownResponse(BaseModel):
    session_id: str
    model_breakdown: list[ModelBreakdownEntry]
    tool_breakdown: list[ToolBreakdownEntry]
    total_cost_usd: float = 0.0


class ModelPricingEntry(BaseModel):
    model_prefix: str
    input_rate_per_million: float
    output_rate_per_million: float


class PricingResponse(BaseModel):
    models: list[ModelPricingEntry]
