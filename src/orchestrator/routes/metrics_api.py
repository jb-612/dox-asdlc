"""VictoriaMetrics proxy API for metrics dashboard.

This module provides API endpoints that proxy requests to VictoriaMetrics,
abstracting the TSDB connection from the frontend dashboard (P05-F10).

Endpoints:
- GET /api/metrics/query_range - Proxy PromQL range queries
- GET /api/metrics/services - List services with metrics
- GET /api/metrics/health - Check VictoriaMetrics connectivity
"""

from __future__ import annotations

import os
from typing import Any, List

import httpx
from fastapi import APIRouter, HTTPException, Query

# VictoriaMetrics URL from environment or default for docker-compose
VICTORIAMETRICS_URL = os.environ.get(
    "VICTORIAMETRICS_URL", "http://victoriametrics:8428"
)

# Timeout configuration
QUERY_TIMEOUT = float(os.environ.get("VICTORIAMETRICS_QUERY_TIMEOUT", "30.0"))
HEALTH_TIMEOUT = float(os.environ.get("VICTORIAMETRICS_HEALTH_TIMEOUT", "5.0"))

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/query_range")
async def query_range(
    query: str = Query(..., description="PromQL query expression"),
    start: str = Query(..., description="Start time (RFC3339 or Unix timestamp)"),
    end: str = Query(..., description="End time (RFC3339 or Unix timestamp)"),
    step: str = Query("15s", description="Query resolution step (e.g., 15s, 1m, 5m)"),
) -> dict[str, Any]:
    """Proxy PromQL range queries to VictoriaMetrics.

    This endpoint proxies range queries to VictoriaMetrics' /api/v1/query_range
    endpoint, allowing the frontend to query time-series data without direct
    access to the TSDB.

    Args:
        query: PromQL query expression (e.g., 'asdlc_http_requests_total').
        start: Start time for the query range.
        end: End time for the query range.
        step: Resolution step for the query (default: 15s).

    Returns:
        VictoriaMetrics query response with status and data.

    Raises:
        HTTPException: 503 if VictoriaMetrics is unavailable.
        HTTPException: 4xx/5xx if VictoriaMetrics returns an error.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/api/v1/query_range",
                params={
                    "query": query,
                    "start": start,
                    "end": end,
                    "step": step,
                },
                timeout=QUERY_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"VictoriaMetrics error: {e}",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"VictoriaMetrics unavailable: {e}",
            )


@router.get("/services")
async def list_services() -> List[str]:
    """List available services with metrics.

    Queries VictoriaMetrics for unique service label values from the
    asdlc_service_info metric. Falls back to a known list of services
    if VictoriaMetrics is unavailable.

    Returns:
        Sorted list of unique service names.
    """
    # Query to get unique service labels
    query = "group by (service) (asdlc_service_info)"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/api/v1/query",
                params={"query": query},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            # Extract service labels from results
            services = [
                result.get("metric", {}).get("service", "unknown")
                for result in data.get("data", {}).get("result", [])
            ]

            # Deduplicate and sort
            return sorted(set(services))
        except Exception:
            # Fallback to known services
            return ["orchestrator", "workers"]


@router.get("/health")
async def metrics_health() -> dict[str, Any]:
    """Check VictoriaMetrics connectivity.

    Attempts to reach VictoriaMetrics health endpoint to verify
    connectivity and service status.

    Returns:
        Health status dict with 'status' key (healthy, degraded, unhealthy)
        and optional 'error' key if unhealthy.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/health",
                timeout=HEALTH_TIMEOUT,
            )
            if response.status_code == 200:
                return {"status": "healthy"}
            else:
                return {"status": "degraded"}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
