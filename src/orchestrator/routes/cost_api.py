"""Agent Cost Tracking API endpoints (P13-F01).

REST API for querying cost records, aggregated summaries,
per-session breakdowns, and the model pricing table.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.orchestrator.api.models.costs import (
    CostRecordResponse,
    CostRecordsListResponse,
    CostSummaryGroupResponse,
    CostSummaryResponse,
    ModelBreakdownEntry,
    ModelPricingEntry,
    PeriodRange,
    PricingResponse,
    SessionCostBreakdownResponse,
    ToolBreakdownEntry,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/costs", tags=["costs"])


def _get_db_path() -> Path | None:
    env_path = os.environ.get("TELEMETRY_DB_PATH") or os.environ.get("ASDLC_TELEMETRY_DB")
    if env_path:
        return Path(env_path)
    return None


def _get_sqlite_store():
    scripts_telemetry = str(
        Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "telemetry"
    )
    if scripts_telemetry not in sys.path:
        sys.path.insert(0, scripts_telemetry)
    import sqlite_store
    return sqlite_store


@router.get("", response_model=CostRecordsListResponse)
async def list_costs(
    agent_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    date_from: Optional[float] = Query(None),
    date_to: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> CostRecordsListResponse:
    try:
        sqlite_store = _get_sqlite_store()
        from src.core.costs.models import CostFilter

        filters = CostFilter(
            agent_id=agent_id,
            session_id=session_id,
            model=model,
            date_from=date_from,
            date_to=date_to,
        )
        records, total = sqlite_store.get_costs(
            filters=filters, page=page, page_size=page_size, db_path=_get_db_path(),
        )
        return CostRecordsListResponse(
            records=[CostRecordResponse(**r) for r in records],
            total=total, page=page, page_size=page_size,
        )
    except ImportError as exc:
        logger.error("Missing dependency for costs: %s", exc)
        raise HTTPException(status_code=503, detail="Cost tracking service unavailable") from exc
    except Exception as exc:
        logger.error("Error listing costs: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve cost records") from exc


@router.get("/summary", response_model=CostSummaryResponse)
async def cost_summary(
    group_by: str = Query("agent"),
    agent_id: Optional[str] = Query(None),
    date_from: Optional[float] = Query(None),
    date_to: Optional[float] = Query(None),
) -> CostSummaryResponse:
    try:
        sqlite_store = _get_sqlite_store()
        from src.core.costs.models import CostFilter

        filters = CostFilter(agent_id=agent_id, date_from=date_from, date_to=date_to)
        rows = sqlite_store.get_cost_summary(
            group_by=group_by, filters=filters, db_path=_get_db_path(),
        )
        groups = [
            CostSummaryGroupResponse(
                key=r.get("group_key"),
                total_input_tokens=r.get("total_input_tokens", 0),
                total_output_tokens=r.get("total_output_tokens", 0),
                total_cost_usd=r.get("total_cost_usd", 0.0),
                record_count=r.get("record_count", 0),
            )
            for r in rows
        ]
        period = None
        if date_from is not None and date_to is not None:
            period = PeriodRange(
                date_from=datetime.fromtimestamp(date_from, tz=timezone.utc).isoformat(),
                date_to=datetime.fromtimestamp(date_to, tz=timezone.utc).isoformat(),
            )
        return CostSummaryResponse(
            groups=groups,
            total_cost_usd=sum(g.total_cost_usd for g in groups),
            total_input_tokens=sum(g.total_input_tokens for g in groups),
            total_output_tokens=sum(g.total_output_tokens for g in groups),
            period=period,
        )
    except ImportError as exc:
        logger.error("Missing dependency for costs: %s", exc)
        raise HTTPException(status_code=503, detail="Cost tracking service unavailable") from exc
    except Exception as exc:
        logger.error("Error getting cost summary: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve cost summary") from exc


@router.get("/sessions/{session_id}", response_model=SessionCostBreakdownResponse)
async def session_costs(session_id: str) -> SessionCostBreakdownResponse:
    try:
        sqlite_store = _get_sqlite_store()
        data = sqlite_store.get_session_costs(session_id=session_id, db_path=_get_db_path())
        return SessionCostBreakdownResponse(
            session_id=session_id,
            model_breakdown=[ModelBreakdownEntry(**r) for r in data.get("model_breakdown", [])],
            tool_breakdown=[ToolBreakdownEntry(**r) for r in data.get("tool_breakdown", [])],
            total_cost_usd=data.get("total_cost_usd", 0.0),
        )
    except ImportError as exc:
        logger.error("Missing dependency for costs: %s", exc)
        raise HTTPException(status_code=503, detail="Cost tracking service unavailable") from exc
    except Exception as exc:
        logger.error("Error getting session costs: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve session costs") from exc


@router.get("/pricing", response_model=PricingResponse)
async def get_pricing() -> PricingResponse:
    try:
        from src.core.costs.pricing import MODEL_PRICING, get_pricing as _get_pricing

        models = []
        for prefix in MODEL_PRICING:
            input_rate, output_rate = _get_pricing(prefix)
            models.append(ModelPricingEntry(
                model_prefix=prefix,
                input_rate_per_million=input_rate,
                output_rate_per_million=output_rate,
            ))
        return PricingResponse(models=models)
    except ImportError as exc:
        logger.error("Missing dependency for pricing: %s", exc)
        raise HTTPException(status_code=503, detail="Pricing service unavailable") from exc
    except Exception as exc:
        logger.error("Error getting pricing: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve pricing") from exc
