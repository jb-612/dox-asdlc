"""VictoriaMetrics proxy API for metrics dashboard.

This module provides API endpoints that proxy requests to VictoriaMetrics,
abstracting the TSDB connection from the frontend dashboard (P05-F10).

Endpoints:
- GET /api/metrics/health - Check VictoriaMetrics connectivity
- GET /api/metrics/services - List services with health status
- GET /api/metrics/services/health - Get detailed health for all aSDLC services (P06-F07)
- GET /api/metrics/services/{name}/sparkline - Get sparkline data for a service (P06-F07)
- GET /api/metrics/cpu - CPU usage time series
- GET /api/metrics/memory - Memory usage time series
- GET /api/metrics/requests - Request rate time series
- GET /api/metrics/latency - Latency percentiles (p50, p95, p99)
- GET /api/metrics/tasks - Active tasks and workers count
"""

from __future__ import annotations

import os
import re
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel

from src.orchestrator.api.models.service_health import (
    ServicesHealthResponse,
    ServiceSparklineResponse,
)
from src.orchestrator.services.service_health import (
    VALID_SERVICES,
    get_service_health_service,
)

# VictoriaMetrics URL from environment or default for docker-compose
VICTORIAMETRICS_URL = os.environ.get(
    "VICTORIAMETRICS_URL", "http://victoriametrics:8428"
)

# Timeout configuration
QUERY_TIMEOUT = float(os.environ.get("VICTORIAMETRICS_QUERY_TIMEOUT", "30.0"))
HEALTH_TIMEOUT = float(os.environ.get("VICTORIAMETRICS_HEALTH_TIMEOUT", "5.0"))

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


# =============================================================================
# Response Models (matching frontend types)
# =============================================================================

class VMMetricsDataPoint(BaseModel):
    """Single data point in a time series."""
    timestamp: str
    value: float


class VMMetricsTimeSeries(BaseModel):
    """Time series data for a metric."""
    metric: str
    service: str
    dataPoints: list[VMMetricsDataPoint]


class LatencyMetrics(BaseModel):
    """Latency percentiles."""
    p50: VMMetricsTimeSeries
    p95: VMMetricsTimeSeries
    p99: VMMetricsTimeSeries


class ActiveTasksMetrics(BaseModel):
    """Active tasks and workers count."""
    activeTasks: int
    maxTasks: int
    activeWorkers: int
    lastUpdated: str


class ServiceInfo(BaseModel):
    """Information about a monitored service."""
    name: str
    displayName: str
    healthy: bool
    statusMessage: str | None = None


class ServicesResponse(BaseModel):
    """Response for services list."""
    services: list[ServiceInfo]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str  # 'healthy', 'unhealthy', 'unknown'
    error: str | None = None


# =============================================================================
# Time Range Helpers
# =============================================================================

TIME_RANGE_CONFIG = {
    "15m": {"duration": timedelta(minutes=15), "step": "15s"},
    "1h": {"duration": timedelta(hours=1), "step": "1m"},
    "6h": {"duration": timedelta(hours=6), "step": "5m"},
    "24h": {"duration": timedelta(hours=24), "step": "15m"},
    "7d": {"duration": timedelta(days=7), "step": "1h"},
}


def get_time_range(range_str: str) -> tuple[str, str, str]:
    """Convert range string to start, end, step for PromQL."""
    config = TIME_RANGE_CONFIG.get(range_str, TIME_RANGE_CONFIG["1h"])
    end = datetime.now(UTC)
    start = end - config["duration"]
    return (
        start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        config["step"],
    )


def parse_vm_response(data: dict, metric_name: str, service: str) -> VMMetricsTimeSeries:
    """Parse VictoriaMetrics response into VMMetricsTimeSeries."""
    data_points = []

    results = data.get("data", {}).get("result", [])
    if results:
        # Take first result (or aggregate if needed)
        values = results[0].get("values", [])
        for timestamp, value in values:
            data_points.append(VMMetricsDataPoint(
                timestamp=datetime.fromtimestamp(timestamp, UTC).isoformat(),
                value=float(value) if value != "NaN" else 0.0,
            ))

    return VMMetricsTimeSeries(
        metric=metric_name,
        service=service or "all",
        dataPoints=data_points,
    )


async def query_victoriametrics(query: str, start: str, end: str, step: str) -> dict:
    """Execute a PromQL range query against VictoriaMetrics."""
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
            ) from e
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"VictoriaMetrics unavailable: {e}",
            ) from e


async def query_victoriametrics_instant(query: str) -> dict:
    """Execute an instant PromQL query against VictoriaMetrics."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/api/v1/query",
                params={"query": query},
                timeout=QUERY_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except Exception:
            return {"data": {"result": []}}


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/health", response_model=HealthResponse)
async def metrics_health() -> HealthResponse:
    """Check VictoriaMetrics connectivity."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/health",
                timeout=HEALTH_TIMEOUT,
            )
            if response.status_code == 200:
                return HealthResponse(status="healthy")
            else:
                return HealthResponse(status="unhealthy")
        except Exception as e:
            return HealthResponse(status="unhealthy", error=str(e))


@router.get("/services", response_model=ServicesResponse)
async def list_services() -> ServicesResponse:
    """List available services with health status."""
    # Known services with display names
    known_services = {
        "orchestrator": "Orchestrator",
        "workers": "Worker Pool",
        "hitl-ui": "HITL UI",
        "redis": "Redis",
        "elasticsearch": "Elasticsearch",
    }

    # Query for services that have metrics
    query = "group by (service) (up)"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/api/v1/query",
                params={"query": query},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            services = []
            results = data.get("data", {}).get("result", [])

            for result in results:
                name = result.get("metric", {}).get("service", "unknown")
                value = result.get("value", [0, "0"])[1]
                healthy = value == "1"

                services.append(ServiceInfo(
                    name=name,
                    displayName=known_services.get(name, name.title()),
                    healthy=healthy,
                ))

            # If no results, return known services as fallback
            if not services:
                services = [
                    ServiceInfo(name=k, displayName=v, healthy=True)
                    for k, v in known_services.items()
                ]

            return ServicesResponse(services=sorted(services, key=lambda s: s.name))

        except Exception:
            # Fallback to known services
            return ServicesResponse(services=[
                ServiceInfo(name=k, displayName=v, healthy=True)
                for k, v in known_services.items()
            ])


# =============================================================================
# Service Health Endpoints (P06-F07)
# =============================================================================


@router.get("/services/health", response_model=ServicesHealthResponse)
async def get_services_health() -> ServicesHealthResponse:
    """Get detailed health information for all aSDLC services.

    Returns health status, CPU/memory usage, pod count, request rate,
    and latency for each of the 5 aSDLC services:
    - hitl-ui
    - orchestrator
    - workers
    - redis
    - elasticsearch

    Returns:
        ServicesHealthResponse: Health data for all services.
    """
    service = get_service_health_service()
    return await service.get_all_services_health()


@router.get("/services/{name}/sparkline", response_model=ServiceSparklineResponse)
async def get_service_sparkline(
    name: str = Path(..., description="Service name"),
    metric: str = Query("cpu", description="Metric type: cpu, memory, requests, latency"),
) -> ServiceSparklineResponse:
    """Get 15-minute sparkline data for a service metric.

    Args:
        name: Service name (hitl-ui, orchestrator, workers, redis, elasticsearch).
        metric: Metric type (cpu, memory, requests, latency).

    Returns:
        ServiceSparklineResponse: Time series data for the sparkline chart.

    Raises:
        HTTPException: 400 if service name is invalid.
    """
    # Validate service name
    if name not in VALID_SERVICES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid service name '{name}'. Valid services: {', '.join(sorted(VALID_SERVICES))}",
        )

    service = get_service_health_service()
    return await service.get_service_sparkline(name, metric)


@router.get("/cpu", response_model=VMMetricsTimeSeries)
async def get_cpu_metrics(
    service: str | None = Query(None, description="Service name filter"),
    range: str = Query("1h", description="Time range (15m, 1h, 6h, 24h, 7d)"),
) -> VMMetricsTimeSeries:
    """Get CPU usage time series.

    Uses rate(process_cpu_seconds_total) * 100 to get CPU percentage.
    """
    start, end, step = get_time_range(range)

    # Build PromQL query - use rate of process_cpu_seconds_total converted to percentage
    if service:
        query = f'rate(process_cpu_seconds_total{{service="{service}"}}[5m]) * 100'
    else:
        query = 'avg(rate(process_cpu_seconds_total[5m])) * 100'

    data = await query_victoriametrics(query, start, end, step)
    return parse_vm_response(data, "process_cpu_percent", service)


@router.get("/memory", response_model=VMMetricsTimeSeries)
async def get_memory_metrics(
    service: str | None = Query(None, description="Service name filter"),
    range: str = Query("1h", description="Time range (15m, 1h, 6h, 24h, 7d)"),
) -> VMMetricsTimeSeries:
    """Get memory usage time series.

    Uses process_resident_memory_bytes converted to megabytes for readability.
    """
    start, end, step = get_time_range(range)

    # Build PromQL query - use process_resident_memory_bytes (RSS memory)
    if service:
        query = f'process_resident_memory_bytes{{service="{service}"}} / 1024 / 1024'
    else:
        query = 'sum(process_resident_memory_bytes) / 1024 / 1024'

    data = await query_victoriametrics(query, start, end, step)
    return parse_vm_response(data, "process_memory_mb", service)


@router.get("/requests", response_model=VMMetricsTimeSeries)
async def get_request_rate_metrics(
    service: str | None = Query(None, description="Service name filter"),
    range: str = Query("1h", description="Time range (15m, 1h, 6h, 24h, 7d)"),
) -> VMMetricsTimeSeries:
    """Get request rate time series."""
    start, end, step = get_time_range(range)

    # Build PromQL query
    if service:
        query = f'rate(asdlc_http_requests_total{{service="{service}"}}[5m])'
    else:
        query = 'sum(rate(asdlc_http_requests_total[5m]))'

    data = await query_victoriametrics(query, start, end, step)
    return parse_vm_response(data, "asdlc_http_requests_total", service)


@router.get("/latency", response_model=LatencyMetrics)
async def get_latency_metrics(
    service: str | None = Query(None, description="Service name filter"),
    range: str = Query("1h", description="Time range (15m, 1h, 6h, 24h, 7d)"),
) -> LatencyMetrics:
    """Get latency percentile time series (p50, p95, p99)."""
    start, end, step = get_time_range(range)

    service_filter = f'service="{service}"' if service else ""

    # Build PromQL queries for each percentile
    queries = {
        "p50": f'histogram_quantile(0.50, rate(asdlc_http_request_duration_seconds_bucket{{{service_filter}}}[5m]))',
        "p95": f'histogram_quantile(0.95, rate(asdlc_http_request_duration_seconds_bucket{{{service_filter}}}[5m]))',
        "p99": f'histogram_quantile(0.99, rate(asdlc_http_request_duration_seconds_bucket{{{service_filter}}}[5m]))',
    }

    results = {}
    for percentile, query in queries.items():
        data = await query_victoriametrics(query, start, end, step)
        results[percentile] = parse_vm_response(
            data,
            f"asdlc_http_request_duration_seconds_{percentile}",
            service
        )

    return LatencyMetrics(
        p50=results["p50"],
        p95=results["p95"],
        p99=results["p99"],
    )


@router.get("/tasks", response_model=ActiveTasksMetrics)
async def get_active_tasks() -> ActiveTasksMetrics:
    """Get current active tasks and workers count."""
    # Query current values
    tasks_query = "asdlc_active_tasks"
    workers_query = "asdlc_active_workers"
    max_tasks_query = "asdlc_max_tasks"

    tasks_data = await query_victoriametrics_instant(tasks_query)
    workers_data = await query_victoriametrics_instant(workers_query)
    max_tasks_data = await query_victoriametrics_instant(max_tasks_query)

    # Extract values with defaults
    def get_value(data: dict, default: int = 0) -> int:
        results = data.get("data", {}).get("result", [])
        if results:
            try:
                return int(float(results[0].get("value", [0, str(default)])[1]))
            except (ValueError, IndexError):
                return default
        return default

    return ActiveTasksMetrics(
        activeTasks=get_value(tasks_data, 0),
        maxTasks=get_value(max_tasks_data, 100),
        activeWorkers=get_value(workers_data, 0),
        lastUpdated=datetime.now(UTC).isoformat(),
    )


# PromQL query validation
_ALLOWED_METRIC_PREFIXES = (
    "asdlc_",
    "process_",
    "up",
    "histogram_quantile",
    "rate(",
    "sum(",
    "avg(",
    "count(",
    "group by",
)

_DANGEROUS_PATTERNS = re.compile(
    r"(label_replace|label_join|count_values)\s*\(",
    re.IGNORECASE,
)

MAX_QUERY_LENGTH = 2000


def _validate_promql_query(query: str) -> None:
    """Validate a PromQL query to prevent abuse.

    Raises:
        HTTPException: 400 if the query is invalid or disallowed.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if len(query) > MAX_QUERY_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Query length {len(query)} exceeds maximum of {MAX_QUERY_LENGTH}",
        )
    if _DANGEROUS_PATTERNS.search(query):
        raise HTTPException(
            status_code=400,
            detail="Query contains disallowed PromQL functions",
        )
    query_stripped = query.strip()
    if not any(query_stripped.startswith(prefix) for prefix in _ALLOWED_METRIC_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail="Query must reference an allowed metric prefix (asdlc_*, process_*, up)",
        )


# Keep the generic query_range for advanced use cases
@router.get("/query_range")
async def query_range(
    query: str = Query(..., description="PromQL query expression"),
    start: str = Query(..., description="Start time (RFC3339 or Unix timestamp)"),
    end: str = Query(..., description="End time (RFC3339 or Unix timestamp)"),
    step: str = Query("15s", description="Query resolution step"),
) -> dict[str, Any]:
    """Proxy PromQL range queries to VictoriaMetrics."""
    _validate_promql_query(query)
    return await query_victoriametrics(query, start, end, step)
