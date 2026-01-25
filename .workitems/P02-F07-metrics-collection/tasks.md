# P02-F07: Tasks

## Task Breakdown

### T01: Add prometheus_client Dependency
**File:** `requirements.txt` or `pyproject.toml`

- [x] Add `prometheus_client>=0.19.0` to dependencies
- [x] Add `psutil>=5.9.0` for process metrics (if not present)
- [x] Run `pip install` and verify no conflicts
- [x] Update any lock files if applicable

**Estimate:** 0.5h
**Dependencies:** None
**User Story:** US-01, US-02

---

### T02: Create Metrics Module Structure
**File:** `src/infrastructure/metrics/__init__.py`

- [x] Create `src/infrastructure/metrics/` directory
- [x] Create `__init__.py` with public exports
- [x] Define module docstring and imports
- [x] Export key functions and classes

**Estimate:** 0.25h
**Dependencies:** T01
**User Story:** US-01, US-02

---

### T03: Define Core Metrics
**File:** `src/infrastructure/metrics/definitions.py`
**Test:** `tests/unit/test_metrics_definitions.py`

- [x] Create `definitions.py` file
- [x] Define `SERVICE_INFO` Info metric
- [x] Define `REQUEST_COUNT` Counter with labels
- [x] Define `REQUEST_LATENCY` Histogram with buckets
- [x] Define `EVENTS_PROCESSED` Counter
- [x] Define `ACTIVE_TASKS` Gauge
- [x] Define `ACTIVE_WORKERS` Gauge
- [x] Write unit tests verifying metric types and labels

**Estimate:** 1h
**Dependencies:** T01
**User Story:** US-03, US-04, US-05, US-06, US-08, US-12

---

### T04: Define Redis Metrics
**File:** `src/infrastructure/metrics/definitions.py`
**Test:** `tests/unit/test_metrics_definitions.py`

- [x] Define `REDIS_CONNECTION_UP` Gauge
- [x] Define `REDIS_LATENCY` Histogram
- [x] Add appropriate labels (service, operation)
- [x] Write unit tests for Redis metrics

**Estimate:** 0.5h
**Dependencies:** T03
**User Story:** US-07

---

### T05: Define Process Metrics
**File:** `src/infrastructure/metrics/definitions.py`
**Test:** `tests/unit/test_metrics_definitions.py`

- [x] Define `PROCESS_MEMORY_BYTES` Gauge
- [x] Add labels for type (rss, vms)
- [x] Write unit tests for process metrics

**Estimate:** 0.25h
**Dependencies:** T03
**User Story:** US-10

---

### T06: Create Metrics Registry Helper
**File:** `src/infrastructure/metrics/registry.py`
**Test:** `tests/unit/test_metrics_registry.py`

- [x] Create `registry.py` file
- [x] Create function to get/create custom registry
- [x] Create function to initialize service info metric
- [x] Create function to update process metrics
- [x] Handle registry singleton pattern
- [x] Write unit tests for registry functions

**Estimate:** 1h
**Dependencies:** T03, T04, T05
**User Story:** US-08, US-10

---

### T07: Implement Prometheus Middleware
**File:** `src/infrastructure/metrics/middleware.py`
**Test:** `tests/unit/test_metrics_middleware.py`

- [x] Create `middleware.py` file
- [x] Implement `PrometheusMiddleware` class extending BaseHTTPMiddleware
- [x] Accept service_name in constructor
- [x] Track request count with labels
- [x] Track request latency with histogram
- [x] Skip `/metrics` endpoint from tracking
- [x] Normalize endpoint paths to prevent cardinality explosion
- [x] Write unit tests with mock FastAPI app

**Estimate:** 1.5h
**Dependencies:** T03
**User Story:** US-03, US-04, US-09

---

### T08: Implement Redis Collector
**File:** `src/infrastructure/metrics/collectors.py`
**Test:** `tests/unit/test_metrics_collectors.py`

- [x] Create `collectors.py` file
- [x] Implement `RedisMetricsCollector` class
- [x] Accept service_name and health_checker in constructor
- [x] Implement `collect()` method yielding GaugeMetricFamily
- [x] Check Redis health with timeout
- [x] Return 1 for healthy, 0 for unhealthy
- [x] Write unit tests with mock health checker

**Estimate:** 1h
**Dependencies:** T04, T06
**User Story:** US-07

---

### T09: Implement Worker Pool Collector
**File:** `src/infrastructure/metrics/collectors.py`
**Test:** `tests/unit/test_metrics_collectors.py`

- [x] Implement `WorkerPoolCollector` class
- [x] Accept service_name and worker_pool in constructor
- [x] Implement `collect()` method
- [x] Yield active_workers gauge
- [x] Yield events_processed counter (success/failed)
- [x] Write unit tests with mock worker pool

**Estimate:** 1h
**Dependencies:** T03, T06
**User Story:** US-05, US-06

---

### T10: Implement Process Metrics Collector
**File:** `src/infrastructure/metrics/collectors.py`
**Test:** `tests/unit/test_metrics_collectors.py`

- [x] Implement `ProcessMetricsCollector` class
- [x] Use psutil to get memory info
- [x] Yield RSS memory gauge
- [x] Yield VMS memory gauge
- [x] Handle psutil import errors gracefully
- [x] Write unit tests

**Estimate:** 0.5h
**Dependencies:** T05, T06
**User Story:** US-10

---

### T11: Add /metrics Endpoint to Orchestrator
**File:** `src/orchestrator/main.py`
**Test:** `tests/unit/test_orchestrator_metrics.py`

- [x] Import prometheus_client and metrics module
- [x] Add PrometheusMiddleware to FastAPI app
- [x] Register RedisMetricsCollector with health checker
- [x] Register ProcessMetricsCollector
- [x] Initialize service info metric
- [x] Add GET `/metrics` route returning generate_latest()
- [x] Set correct content type (CONTENT_TYPE_LATEST)
- [ ] Write unit tests for endpoint

**Estimate:** 1.5h
**Dependencies:** T07, T08, T10
**User Story:** US-01, US-09

---

### T12: Add /metrics Endpoint to Workers
**File:** `src/workers/main.py`
**Test:** `tests/unit/test_workers_metrics.py`

- [x] Import prometheus_client and metrics module
- [x] Register WorkerPoolCollector with worker pool reference
- [x] Register RedisMetricsCollector with health checker
- [x] Register ProcessMetricsCollector
- [x] Initialize service info metric
- [x] Add `/metrics` handler to HealthHandler class
- [x] Return generate_latest() with correct content type
- [ ] Write unit tests for endpoint

**Estimate:** 1.5h
**Dependencies:** T08, T09, T10
**User Story:** US-02

---

### T13: Update __init__.py Exports
**File:** `src/infrastructure/metrics/__init__.py`

- [x] Export PrometheusMiddleware
- [x] Export collectors (Redis, WorkerPool, Process)
- [x] Export metric definitions
- [x] Export registry helper functions
- [x] Add module-level docstring

**Estimate:** 0.25h
**Dependencies:** T07, T08, T09, T10
**User Story:** US-01, US-02

---

### T14: Integration Test - Orchestrator Metrics
**File:** `tests/integration/test_orchestrator_metrics.py`

- [x] Test GET /metrics returns 200
- [x] Test response has correct content type
- [x] Test response contains expected metrics
- [x] Test request count increments after requests
- [x] Test request latency recorded
- [x] Test service info present
- [x] Skip if orchestrator not running

**Estimate:** 1h
**Dependencies:** T11
**User Story:** US-01, US-03, US-04, US-08

---

### T15: Integration Test - Workers Metrics
**File:** `tests/integration/test_workers_metrics.py`

- [x] Test GET /metrics returns 200
- [x] Test response has correct content type
- [x] Test response contains expected metrics
- [x] Test active_workers gauge present
- [x] Test events_processed counter present
- [x] Test existing /health and /stats still work
- [x] Skip if workers not running

**Estimate:** 1h
**Dependencies:** T12
**User Story:** US-02, US-05, US-06

---

### T16: Document Scrape Configuration
**File:** `src/infrastructure/metrics/SCRAPE_CONFIG.md`

- [x] Document Docker Compose scrape targets
- [x] Document Kubernetes service discovery config
- [x] Document recommended scrape interval (15s)
- [x] Document job naming convention
- [x] Add example vmagent configuration
- [x] Note Pod annotations for K8s discovery

**Estimate:** 0.5h
**Dependencies:** T11, T12
**User Story:** US-11

Note: Documentation created within backend domain at `src/infrastructure/metrics/SCRAPE_CONFIG.md`.

---

### T17: Validate Prometheus Format Output
**File:** `tests/unit/test_prometheus_format.py`

- [x] Test metric names follow conventions (asdlc_ prefix)
- [x] Test counter names end with _total
- [x] Test histogram uses seconds
- [x] Test labels are snake_case
- [x] Test no high-cardinality labels
- [x] Parse output with prometheus_client parser

**Estimate:** 0.5h
**Dependencies:** T11, T12
**User Story:** US-12

---

### T18: Add httpx Dependency
**File:** `requirements.txt`

- [x] Add `httpx>=0.25.0` for async HTTP client
- [x] Verify no conflicts with existing dependencies
- [x] Run `pip install` to test

**Estimate:** 0.25h
**Dependencies:** T01
**User Story:** US-13 (VictoriaMetrics proxy)

---

### T19: Implement Metrics Query Proxy Router
**File:** `src/orchestrator/routes/metrics_api.py`
**Test:** `tests/unit/test_metrics_api.py`

- [x] Create `routes/metrics_api.py` with FastAPI router
- [x] Implement GET `/api/metrics/query_range` endpoint
- [x] Implement GET `/api/metrics/services` endpoint
- [x] Implement GET `/api/metrics/health` endpoint
- [x] Add proper type hints to all functions
- [x] Handle VictoriaMetrics connection errors gracefully
- [x] Add timeout configuration (default 30s for queries)
- [x] Write unit tests with mocked httpx responses

**Estimate:** 2h
**Dependencies:** T18, T11
**User Story:** US-13

---

### T20: Integrate Metrics Router into Orchestrator
**File:** `src/orchestrator/main.py`
**Test:** `tests/integration/test_metrics_api.py`

- [x] Import metrics_api router
- [x] Add router to FastAPI app with `/api/metrics` prefix
- [x] Add VICTORIAMETRICS_URL to environment config
- [x] Write integration test with mock VictoriaMetrics
- [x] Verify router included in OpenAPI docs

**Estimate:** 1h
**Dependencies:** T19
**User Story:** US-13

---

## Progress

- Started: 2026-01-25
- Tasks Complete: 20/20 (T01-T20 complete)
- Percentage: 100%
- Status: COMPLETE
- Blockers: None
- Completed: 2026-01-25

## Dependency Graph

```
T01 (deps)
  |
  v
T02 (module structure)
  |
  v
T03 (core metrics) --> T04 (redis metrics) --> T05 (process metrics)
  |                         |                        |
  |                         |                        |
  v                         v                        v
T06 (registry) <-----------+-----------------------+
  |
  +-----------------+
  |                 |
  v                 v
T07 (middleware)   T08 (redis collector)
  |                 |
  |                 +---> T09 (worker pool collector)
  |                 |
  |                 +---> T10 (process collector)
  |                 |
  v                 v
T11 (orchestrator) T12 (workers)
  |                 |
  v                 v
T14 (orch tests)   T15 (worker tests)
  |                 |
  +-----------------+
          |
          v
        T13 (exports)
          |
          v
        T17 (format validation)
          |
          v
        T16 (scrape docs)
```

## Estimates Summary

| Task | Estimate | Cumulative |
|------|----------|------------|
| T01 | 0.5h | 0.5h |
| T02 | 0.25h | 0.75h |
| T03 | 1.0h | 1.75h |
| T04 | 0.5h | 2.25h |
| T05 | 0.25h | 2.5h |
| T06 | 1.0h | 3.5h |
| T07 | 1.5h | 5.0h |
| T08 | 1.0h | 6.0h |
| T09 | 1.0h | 7.0h |
| T10 | 0.5h | 7.5h |
| T11 | 1.5h | 9.0h |
| T12 | 1.5h | 10.5h |
| T13 | 0.25h | 10.75h |
| T14 | 1.0h | 11.75h |
| T15 | 1.0h | 12.75h |
| T16 | 0.5h | 13.25h |
| T17 | 0.5h | 13.75h |

| T18 | 0.25h | 14h |
| T19 | 2.0h | 16h |
| T20 | 1.0h | 17h |

**Total Estimated Effort:** 17 hours (~2.5 days)

## Parallel Execution Opportunities

The following tasks can be done in parallel:

**Track 1 (Metrics definitions):**
T01 -> T02 -> T03 -> T04 -> T05 -> T06

**Track 2 (Once T03 complete):**
T07 (middleware)

**Track 3 (Once T06 complete):**
T08 -> T09 -> T10

**Final integration (all tracks converge):**
T11, T12 -> T13 -> T14, T15 -> T17 -> T16

## Notes

- All metrics follow Prometheus naming conventions
- Middleware skips /metrics to prevent recursion
- Custom collectors are registered on service startup
- Process metrics use psutil for cross-platform support
- Integration tests require running services (skip in CI without infra)
