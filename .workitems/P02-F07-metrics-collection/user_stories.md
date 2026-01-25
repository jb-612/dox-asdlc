# P02-F07: User Stories

## Epic Summary

Add Prometheus-compatible `/metrics` endpoints to aSDLC microservices (orchestrator and workers), exposing application metrics for observability. This enables VictoriaMetrics scraping for monitoring dashboards and alerting.

---

## US-01: Metrics Endpoint on Orchestrator

**As an** operator monitoring the aSDLC cluster
**I want** the orchestrator service to expose a `/metrics` endpoint
**So that** VictoriaMetrics can scrape application metrics

### Acceptance Criteria

- [ ] GET `/metrics` on port 8080 returns HTTP 200
- [ ] Response content-type is `text/plain; version=0.0.4; charset=utf-8`
- [ ] Response body is valid Prometheus exposition format
- [ ] Endpoint responds within 100ms under normal load
- [ ] Endpoint does not require authentication
- [ ] Endpoint is available after service startup

### Test Cases

```python
def test_orchestrator_metrics_endpoint_returns_200():
    """GET /metrics returns 200 OK."""

def test_orchestrator_metrics_content_type():
    """Response has Prometheus content type."""

def test_orchestrator_metrics_valid_format():
    """Response is valid Prometheus text format."""

def test_orchestrator_metrics_response_time():
    """Response completes within 100ms."""
```

---

## US-02: Metrics Endpoint on Workers

**As an** operator monitoring the aSDLC cluster
**I want** the workers service to expose a `/metrics` endpoint
**So that** VictoriaMetrics can scrape worker pool metrics

### Acceptance Criteria

- [ ] GET `/metrics` on port 8081 returns HTTP 200
- [ ] Response content-type is `text/plain; version=0.0.4; charset=utf-8`
- [ ] Response body is valid Prometheus exposition format
- [ ] Endpoint responds within 100ms under normal load
- [ ] Endpoint is available after service startup
- [ ] Endpoint coexists with existing `/health` and `/stats` endpoints

### Test Cases

```python
def test_workers_metrics_endpoint_returns_200():
    """GET /metrics returns 200 OK."""

def test_workers_metrics_content_type():
    """Response has Prometheus content type."""

def test_workers_metrics_valid_format():
    """Response is valid Prometheus text format."""

def test_workers_existing_endpoints_work():
    """/health and /stats still functional."""
```

---

## US-03: HTTP Request Count Metric

**As an** operator analyzing service traffic
**I want** a counter of HTTP requests
**So that** I can track request volume and error rates

### Acceptance Criteria

- [ ] `asdlc_http_requests_total` counter exposed
- [ ] Counter has labels: service, method, endpoint, status
- [ ] Counter increments for each HTTP request
- [ ] Counter excludes `/metrics` endpoint itself
- [ ] Counter persists across scrapes (cumulative)
- [ ] Label cardinality is bounded (no query params in endpoint)

### Test Cases

```python
def test_request_count_increments():
    """Counter increments after HTTP request."""

def test_request_count_has_labels():
    """Counter includes service, method, endpoint, status labels."""

def test_request_count_excludes_metrics_endpoint():
    """Requests to /metrics not counted."""

def test_request_count_normalizes_endpoints():
    """Path parameters normalized to prevent cardinality explosion."""
```

---

## US-04: HTTP Request Latency Metric

**As an** operator monitoring service performance
**I want** a histogram of request latency
**So that** I can track p50, p90, p99 response times

### Acceptance Criteria

- [ ] `asdlc_http_request_duration_seconds` histogram exposed
- [ ] Histogram has labels: service, method, endpoint
- [ ] Histogram uses seconds as unit (not milliseconds)
- [ ] Bucket boundaries cover typical latency range (5ms to 10s)
- [ ] Histogram records all non-metrics requests
- [ ] _bucket, _count, and _sum suffixes present

### Test Cases

```python
def test_request_latency_histogram_exposed():
    """Histogram metric exists in output."""

def test_request_latency_buckets():
    """Histogram has appropriate bucket boundaries."""

def test_request_latency_records_duration():
    """Histogram observation matches actual request time."""

def test_request_latency_has_sum_and_count():
    """Histogram includes _sum and _count metrics."""
```

---

## US-05: Active Workers Gauge

**As an** operator monitoring worker pool capacity
**I want** a gauge showing active workers
**So that** I can track worker utilization

### Acceptance Criteria

- [ ] `asdlc_active_workers` gauge exposed on workers service
- [ ] Gauge has label: service
- [ ] Gauge value matches `WorkerPool.get_stats()["active_workers"]`
- [ ] Gauge updates in real-time (not cached)
- [ ] Gauge returns 0 when no tasks processing

### Test Cases

```python
def test_active_workers_gauge_exposed():
    """Gauge metric exists in output."""

def test_active_workers_matches_pool_stats():
    """Gauge value equals worker pool active count."""

def test_active_workers_zero_when_idle():
    """Gauge returns 0 with no active tasks."""

def test_active_workers_updates_realtime():
    """Gauge reflects current state on each scrape."""
```

---

## US-06: Events Processed Counter

**As an** operator tracking worker throughput
**I want** a counter of processed events
**So that** I can monitor processing rate and success ratio

### Acceptance Criteria

- [ ] `asdlc_events_processed_total` counter exposed on workers service
- [ ] Counter has labels: service, status (success/failed)
- [ ] Counter matches `WorkerPool.get_stats()` totals
- [ ] Counter is cumulative (never resets except on restart)
- [ ] Success and failure counts are separate label values

### Test Cases

```python
def test_events_processed_counter_exposed():
    """Counter metric exists in output."""

def test_events_processed_success_label():
    """Counter has status=success for succeeded events."""

def test_events_processed_failed_label():
    """Counter has status=failed for failed events."""

def test_events_processed_matches_pool_stats():
    """Counter values match worker pool statistics."""
```

---

## US-07: Redis Connection Status Gauge

**As an** operator monitoring infrastructure health
**I want** a gauge showing Redis connection status
**So that** I can detect connectivity issues

### Acceptance Criteria

- [ ] `asdlc_redis_connection_up` gauge exposed on both services
- [ ] Gauge has label: service
- [ ] Gauge value is 1 when Redis is reachable
- [ ] Gauge value is 0 when Redis is unreachable
- [ ] Health check uses existing `HealthChecker.check_redis_dependency()`
- [ ] Check timeout is bounded (< 5 seconds)

### Test Cases

```python
def test_redis_up_gauge_exposed():
    """Gauge metric exists in output."""

def test_redis_up_when_connected():
    """Gauge is 1 when Redis ping succeeds."""

def test_redis_down_when_disconnected():
    """Gauge is 0 when Redis is unreachable."""

def test_redis_check_has_timeout():
    """Redis check does not block indefinitely."""
```

---

## US-08: Service Info Metric

**As an** operator identifying service versions
**I want** an info metric with service metadata
**So that** I can track which versions are deployed

### Acceptance Criteria

- [ ] `asdlc_service_info` info metric exposed
- [ ] Info metric has labels: service, version
- [ ] Version matches application version (0.1.0)
- [ ] Service name matches configured service name
- [ ] Info metric value is always 1.0

### Test Cases

```python
def test_service_info_exposed():
    """Info metric exists in output."""

def test_service_info_has_version():
    """Info metric includes version label."""

def test_service_info_has_service_name():
    """Info metric includes service label."""
```

---

## US-09: Prometheus Middleware Integration

**As a** developer extending the orchestrator
**I want** automatic request metrics via middleware
**So that** new endpoints are tracked without code changes

### Acceptance Criteria

- [ ] Middleware automatically tracks all HTTP requests
- [ ] Middleware is configurable with service name
- [ ] Middleware skips `/metrics` endpoint
- [ ] Middleware does not affect response content
- [ ] Middleware adds minimal latency (< 1ms)
- [ ] Middleware is async-safe

### Test Cases

```python
def test_middleware_tracks_requests():
    """Middleware increments counter for requests."""

def test_middleware_skips_metrics():
    """Requests to /metrics not tracked."""

def test_middleware_preserves_response():
    """Response body unchanged by middleware."""

def test_middleware_minimal_overhead():
    """Middleware adds < 1ms latency."""
```

---

## US-10: Process Memory Gauge

**As an** operator monitoring resource usage
**I want** a gauge showing process memory
**So that** I can detect memory leaks

### Acceptance Criteria

- [ ] `asdlc_process_memory_bytes` gauge exposed
- [ ] Gauge has labels: service, type (rss, vms)
- [ ] RSS (Resident Set Size) memory tracked
- [ ] VMS (Virtual Memory Size) memory tracked
- [ ] Values update on each scrape
- [ ] Uses `psutil` or similar for cross-platform support

### Test Cases

```python
def test_process_memory_gauge_exposed():
    """Gauge metric exists in output."""

def test_process_memory_rss():
    """RSS memory is reasonable value (> 0)."""

def test_process_memory_vms():
    """VMS memory is reasonable value (>= RSS)."""
```

---

## US-11: Scrape Configuration Documentation

**As a** DevOps engineer configuring monitoring
**I want** documented scrape configuration
**So that** I can configure vmagent correctly

### Acceptance Criteria

- [ ] Static scrape config documented for Docker Compose
- [ ] Kubernetes service discovery config documented
- [ ] Recommended scrape interval documented (15s)
- [ ] Job naming convention documented
- [ ] Relabeling config documented for Kubernetes

### Test Cases

```bash
# Manual verification:
# Apply documented config to vmagent
# Verify targets appear in vmagent UI
# Verify metrics are being scraped
```

---

## US-12: Metric Naming Conventions

**As a** developer adding new metrics
**I want** consistent naming conventions
**So that** metrics are discoverable and understandable

### Acceptance Criteria

- [ ] All metrics prefixed with `asdlc_`
- [ ] Counters end with `_total`
- [ ] Histograms/summaries use base units (seconds, bytes)
- [ ] Labels use lowercase snake_case
- [ ] No high-cardinality labels (user IDs, request IDs)
- [ ] Naming conventions documented in code comments

### Test Cases

```python
def test_metric_names_have_prefix():
    """All custom metrics start with asdlc_."""

def test_counter_names_end_with_total():
    """Counter metrics end with _total."""

def test_histogram_uses_base_units():
    """Histogram uses seconds not milliseconds."""

def test_labels_are_snake_case():
    """All label names are lowercase snake_case."""
```

---

## US-13: VictoriaMetrics Query Proxy

**As a** frontend developer building the metrics dashboard
**I want** backend API endpoints to query VictoriaMetrics
**So that** the dashboard can display time series data without direct TSDB access

### Acceptance Criteria

- [ ] GET `/api/metrics/query_range` proxies PromQL queries to VictoriaMetrics
- [ ] GET `/api/metrics/services` returns list of services with metrics
- [ ] GET `/api/metrics/health` returns VictoriaMetrics connectivity status
- [ ] Endpoints handle VictoriaMetrics unavailability gracefully (503)
- [ ] Query timeout is configurable (default 30s)
- [ ] Endpoints documented in OpenAPI/Swagger

### Test Cases

```python
def test_query_range_proxies_to_vm():
    """Proxy passes query to VictoriaMetrics."""

def test_query_range_returns_vm_response():
    """Proxy returns VictoriaMetrics JSON response."""

def test_query_range_handles_vm_error():
    """Returns 503 when VictoriaMetrics unavailable."""

def test_services_returns_list():
    """Returns list of service names."""

def test_health_returns_status():
    """Returns healthy/unhealthy status."""
```

---

## Summary Table

| US | Title | Priority |
|----|-------|----------|
| US-01 | Metrics Endpoint on Orchestrator | High |
| US-02 | Metrics Endpoint on Workers | High |
| US-03 | HTTP Request Count Metric | High |
| US-04 | HTTP Request Latency Metric | High |
| US-05 | Active Workers Gauge | High |
| US-06 | Events Processed Counter | High |
| US-07 | Redis Connection Status Gauge | Medium |
| US-08 | Service Info Metric | Low |
| US-09 | Prometheus Middleware Integration | High |
| US-10 | Process Memory Gauge | Medium |
| US-11 | Scrape Configuration Documentation | Medium |
| US-12 | Metric Naming Conventions | Low |
| US-13 | VictoriaMetrics Query Proxy | High |
