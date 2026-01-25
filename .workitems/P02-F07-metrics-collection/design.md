# P02-F07: Prometheus Metrics Collection

## Technical Design

### Overview

This feature adds Prometheus-compatible `/metrics` endpoints to the orchestrator and workers services. These endpoints expose application metrics in Prometheus exposition format, enabling VictoriaMetrics (or any Prometheus-compatible TSDB) to scrape and store time-series data for observability dashboards.

**Goals:**
- Implement `/metrics` endpoint on orchestrator service (port 8080)
- Implement `/metrics` endpoint on workers service (port 8081)
- Expose standardized metrics: request latency, request count, active tasks, Redis connection status
- Use `prometheus_client` library for Python services
- Follow Prometheus naming conventions and best practices
- Document scrape targets for vmagent configuration

### Architecture Reference

From `docs/Main_Features.md` Section F.18:
- Per-agent counters, latency, failure reasons, and cost estimates
- Run logs and trajectories persisted for replay and audits

This feature provides the metrics collection layer that enables observability dashboards (P05-F10) and integrates with the VictoriaMetrics TSDB deployed in P06-F06.

### Dependencies

**Internal:**
- P01-F01: Infrastructure (Docker, Redis) - Required
- P02-F01: Redis Streams - Required (for Redis connection metrics)
- P03-F01: Agent Worker Pool - Required (for worker pool metrics)
- P06-F06: VictoriaMetrics Infrastructure - Required (downstream consumer)

**External:**
- `prometheus_client>=0.19.0` - Prometheus Python client library

### Components

#### 1. Metrics Registry Module (`src/infrastructure/metrics/`)

Create a centralized metrics module that defines and exposes all application metrics.

```
src/infrastructure/metrics/
    __init__.py          # Public exports
    registry.py          # Custom registry and helpers
    definitions.py       # Metric definitions (counters, histograms, gauges)
    middleware.py        # FastAPI/HTTP middleware for request metrics
    collectors.py        # Custom collectors for Redis, worker pool
```

#### 2. Metric Definitions (`src/infrastructure/metrics/definitions.py`)

```python
from prometheus_client import Counter, Histogram, Gauge, Info

# Service info
SERVICE_INFO = Info(
    "asdlc_service",
    "Service information"
)

# Request metrics
REQUEST_COUNT = Counter(
    "asdlc_http_requests_total",
    "Total HTTP requests",
    ["service", "method", "endpoint", "status"]
)

REQUEST_LATENCY = Histogram(
    "asdlc_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["service", "method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Task/Event metrics
EVENTS_PROCESSED = Counter(
    "asdlc_events_processed_total",
    "Total events processed",
    ["service", "event_type", "status"]
)

ACTIVE_TASKS = Gauge(
    "asdlc_active_tasks",
    "Number of currently active tasks",
    ["service"]
)

ACTIVE_WORKERS = Gauge(
    "asdlc_active_workers",
    "Number of active worker threads",
    ["service"]
)

# Redis metrics
REDIS_CONNECTION_UP = Gauge(
    "asdlc_redis_connection_up",
    "Redis connection status (1=up, 0=down)",
    ["service"]
)

REDIS_LATENCY = Histogram(
    "asdlc_redis_operation_duration_seconds",
    "Redis operation latency in seconds",
    ["service", "operation"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
)

# Resource metrics (supplemental to container metrics)
PROCESS_MEMORY_BYTES = Gauge(
    "asdlc_process_memory_bytes",
    "Process memory usage in bytes",
    ["service", "type"]
)
```

#### 3. Metrics Middleware (`src/infrastructure/metrics/middleware.py`)

FastAPI middleware to automatically track request metrics.

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to track HTTP request metrics."""

    def __init__(self, app, service_name: str):
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip metrics endpoint to avoid recursion
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start_time

        REQUEST_COUNT.labels(
            service=self.service_name,
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        REQUEST_LATENCY.labels(
            service=self.service_name,
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)

        return response
```

#### 4. Custom Collectors (`src/infrastructure/metrics/collectors.py`)

Collectors for Redis and worker pool metrics.

```python
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import Collector

class RedisMetricsCollector(Collector):
    """Collector for Redis connection metrics."""

    def __init__(self, service_name: str, health_checker):
        self.service_name = service_name
        self.health_checker = health_checker

    def collect(self):
        # Check Redis health and yield metric
        status = 1 if self._check_redis() else 0
        gauge = GaugeMetricFamily(
            "asdlc_redis_connection_up",
            "Redis connection status",
            labels=["service"]
        )
        gauge.add_metric([self.service_name], status)
        yield gauge

class WorkerPoolCollector(Collector):
    """Collector for worker pool metrics."""

    def __init__(self, service_name: str, worker_pool):
        self.service_name = service_name
        self.worker_pool = worker_pool

    def collect(self):
        stats = self.worker_pool.get_stats()

        active = GaugeMetricFamily(
            "asdlc_active_workers",
            "Active workers",
            labels=["service"]
        )
        active.add_metric([self.service_name], stats["active_workers"])
        yield active

        processed = GaugeMetricFamily(
            "asdlc_events_processed_total",
            "Events processed",
            labels=["service", "status"]
        )
        processed.add_metric([self.service_name, "success"], stats["events_succeeded"])
        processed.add_metric([self.service_name, "failed"], stats["events_failed"])
        yield processed
```

#### 5. Orchestrator Integration (`src/orchestrator/main.py`)

Add `/metrics` endpoint to the orchestrator FastAPI app.

```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, REGISTRY
from fastapi.responses import Response as FastAPIResponse
from src.infrastructure.metrics.middleware import PrometheusMiddleware
from src.infrastructure.metrics.collectors import RedisMetricsCollector

def create_app() -> FastAPI:
    app = FastAPI(...)

    # Add Prometheus middleware
    app.add_middleware(PrometheusMiddleware, service_name="orchestrator")

    # Register custom collectors
    REGISTRY.register(RedisMetricsCollector("orchestrator", _health_checker))

    # Metrics endpoint
    @app.get("/metrics")
    async def metrics():
        """Prometheus metrics endpoint."""
        return FastAPIResponse(
            content=generate_latest(REGISTRY),
            media_type=CONTENT_TYPE_LATEST
        )

    return app
```

#### 6. Workers Integration (`src/workers/main.py`)

Add `/metrics` endpoint to the workers HTTP server.

```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, REGISTRY
from src.infrastructure.metrics.collectors import WorkerPoolCollector, RedisMetricsCollector

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/metrics":
            self._handle_metrics()
        # ... existing handlers

    def _handle_metrics(self) -> None:
        """Handle /metrics endpoint for Prometheus scraping."""
        output = generate_latest(REGISTRY)
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPE_LATEST)
        self.end_headers()
        self.wfile.write(output)
```

### Metrics Schema

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `asdlc_service_info` | Info | service, version | Service metadata |
| `asdlc_http_requests_total` | Counter | service, method, endpoint, status | Total HTTP requests |
| `asdlc_http_request_duration_seconds` | Histogram | service, method, endpoint | Request latency |
| `asdlc_events_processed_total` | Counter | service, event_type, status | Events processed |
| `asdlc_active_tasks` | Gauge | service | Current active tasks |
| `asdlc_active_workers` | Gauge | service | Active worker threads |
| `asdlc_redis_connection_up` | Gauge | service | Redis status (1/0) |
| `asdlc_redis_operation_duration_seconds` | Histogram | service, operation | Redis op latency |
| `asdlc_process_memory_bytes` | Gauge | service, type | Process memory |

### Prometheus Naming Conventions

Following [Prometheus naming best practices](https://prometheus.io/docs/practices/naming/):

1. **Prefix**: `asdlc_` for all custom metrics
2. **Units**: Suffix with unit (`_seconds`, `_bytes`, `_total`)
3. **Labels**: Use lowercase, snake_case labels
4. **Counters**: End with `_total` suffix
5. **Base units**: Use base units (seconds not milliseconds, bytes not megabytes)

### Scrape Configuration

Document vmagent scrape configuration for P06-F06 integration:

```yaml
# vmagent scrape config for aSDLC services
scrape_configs:
  - job_name: "asdlc-orchestrator"
    static_configs:
      - targets: ["orchestrator:8080"]
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: "asdlc-workers"
    static_configs:
      - targets: ["workers:8081"]
    metrics_path: /metrics
    scrape_interval: 15s
```

For Kubernetes with service discovery:

```yaml
scrape_configs:
  - job_name: "asdlc-services"
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ["dox-asdlc"]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

### File Structure

```
src/infrastructure/metrics/
    __init__.py                    # Create
    registry.py                    # Create
    definitions.py                 # Create
    middleware.py                  # Create
    collectors.py                  # Create

src/orchestrator/
    main.py                        # Modify (add /metrics endpoint)

src/workers/
    main.py                        # Modify (add /metrics endpoint)

tests/unit/
    test_metrics_definitions.py    # Create
    test_metrics_middleware.py     # Create
    test_metrics_collectors.py     # Create

tests/integration/
    test_metrics_endpoints.py      # Create
```

### Testing Strategy

1. **Unit tests**: Test metric increments, histogram observations
2. **Middleware tests**: Test request tracking with mock FastAPI
3. **Collector tests**: Test custom collectors with mock health/pool
4. **Endpoint tests**: Test `/metrics` returns valid Prometheus format
5. **Integration tests**: Test scraping with actual services

**Test fixtures:**
- Mock Redis client for connection status tests
- Mock worker pool for stats collection tests
- Prometheus text format parser for output validation

### Security Considerations

1. **No authentication on /metrics**: Following Prometheus standard practice
2. **Network isolation**: Metrics endpoint only accessible within cluster
3. **No sensitive data**: Metrics do not include PII or secrets
4. **Cardinality control**: Limit label values to prevent explosion

### Performance Considerations

1. **Minimal overhead**: Middleware adds ~0.1ms per request
2. **Async-safe**: Use thread-safe counters and gauges
3. **Skip recursion**: Exclude /metrics from request tracking
4. **Efficient export**: `generate_latest()` is optimized for scraping

### Error Handling

1. **Collector errors**: Return empty metrics, log warning
2. **Redis check errors**: Return `redis_connection_up=0`
3. **Export errors**: Return 500 with error message

### VictoriaMetrics Proxy API (for P05-F10 Dashboard)

The dashboard (P05-F10) requires backend endpoints to query VictoriaMetrics. These proxy endpoints abstract the TSDB connection from the frontend.

#### 7. Metrics Query Proxy (`src/orchestrator/routes/metrics_api.py`)

```python
from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

VICTORIAMETRICS_URL = os.environ.get("VICTORIAMETRICS_URL", "http://victoriametrics:8428")

class QueryRangeRequest(BaseModel):
    query: str
    start: str  # RFC3339 or Unix timestamp
    end: str
    step: str = "15s"

class MetricResult(BaseModel):
    metric: dict
    values: List[List]  # [[timestamp, value], ...]

class QueryRangeResponse(BaseModel):
    status: str
    data: dict

@router.get("/query_range", response_model=QueryRangeResponse)
async def query_range(
    query: str = Query(..., description="PromQL query"),
    start: str = Query(..., description="Start time"),
    end: str = Query(..., description="End time"),
    step: str = Query("15s", description="Query resolution step")
) -> QueryRangeResponse:
    """
    Proxy to VictoriaMetrics /api/v1/query_range endpoint.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/api/v1/query_range",
                params={"query": query, "start": start, "end": end, "step": step},
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"VictoriaMetrics unavailable: {e}")

@router.get("/services")
async def list_services() -> List[str]:
    """
    List available services with metrics.
    Queries VictoriaMetrics for unique service label values.
    """
    query = 'group by (service) (asdlc_service_info)'
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/api/v1/query",
                params={"query": query},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            services = [
                result["metric"].get("service", "unknown")
                for result in data.get("data", {}).get("result", [])
            ]
            return sorted(set(services))
        except Exception:
            # Fallback to known services
            return ["orchestrator", "workers"]

@router.get("/health")
async def metrics_health() -> dict:
    """Check VictoriaMetrics connectivity."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{VICTORIAMETRICS_URL}/health",
                timeout=5.0
            )
            return {"status": "healthy" if response.status_code == 200 else "degraded"}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
```

#### Proxy Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics/query_range` | GET | Proxy PromQL range queries to VictoriaMetrics |
| `/api/metrics/services` | GET | List services with metrics |
| `/api/metrics/health` | GET | Check VictoriaMetrics connectivity |

### Updated File Structure

```
src/orchestrator/
    routes/
        metrics_api.py             # Create (VictoriaMetrics proxy)
    main.py                        # Modify (add /metrics, include router)
```

### Out of Scope

- Dashboard creation (P05-F10)
- VictoriaMetrics deployment (P06-F06)
- Alerting rules
- Log-based metrics
- Cost estimation metrics (future enhancement)
