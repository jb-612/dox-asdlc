"""Prometheus metric definitions for aSDLC services.

All metrics follow Prometheus naming conventions:
- Prefix: asdlc_ for all custom metrics
- Units: _seconds for duration, _bytes for memory, _total for counters
- Labels: lowercase, snake_case

See: https://prometheus.io/docs/practices/naming/
"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, Info

# =============================================================================
# Service Info
# =============================================================================

SERVICE_INFO = Info(
    "asdlc_service",
    "Service information including version and build details",
)

# =============================================================================
# HTTP Request Metrics
# =============================================================================

REQUEST_COUNT = Counter(
    "asdlc_http_requests_total",
    "Total number of HTTP requests",
    ["service", "method", "endpoint", "status"],
)

REQUEST_LATENCY = Histogram(
    "asdlc_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["service", "method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# =============================================================================
# Event Processing Metrics
# =============================================================================

EVENTS_PROCESSED = Counter(
    "asdlc_events_processed_total",
    "Total number of events processed",
    ["service", "event_type", "status"],
)

# =============================================================================
# Task and Worker Metrics
# =============================================================================

ACTIVE_TASKS = Gauge(
    "asdlc_active_tasks",
    "Number of currently active tasks",
    ["service"],
)

ACTIVE_WORKERS = Gauge(
    "asdlc_active_workers",
    "Number of active worker threads",
    ["service"],
)

# =============================================================================
# Redis Metrics
# =============================================================================

REDIS_CONNECTION_UP = Gauge(
    "asdlc_redis_connection_up",
    "Redis connection status (1=up, 0=down)",
    ["service"],
)

REDIS_LATENCY = Histogram(
    "asdlc_redis_operation_duration_seconds",
    "Redis operation latency in seconds",
    ["service", "operation"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
)

# =============================================================================
# Process Resource Metrics
# =============================================================================

PROCESS_MEMORY_BYTES = Gauge(
    "asdlc_process_memory_bytes",
    "Process memory usage in bytes",
    ["service", "type"],
)

# =============================================================================
# Exports
# =============================================================================

__all__ = [
    "SERVICE_INFO",
    "REQUEST_COUNT",
    "REQUEST_LATENCY",
    "EVENTS_PROCESSED",
    "ACTIVE_TASKS",
    "ACTIVE_WORKERS",
    "REDIS_CONNECTION_UP",
    "REDIS_LATENCY",
    "PROCESS_MEMORY_BYTES",
]
