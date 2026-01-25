"""Prometheus metrics module for aSDLC services.

This module provides centralized metrics collection for the aSDLC platform,
following Prometheus naming conventions and best practices.

Components:
- definitions: Metric definitions (Counter, Histogram, Gauge, Info)
- registry: Helper functions for registry management
- middleware: FastAPI middleware for HTTP request metrics
- collectors: Custom collectors for Redis, worker pool, and process metrics

Usage:
    from src.infrastructure.metrics import (
        PrometheusMiddleware,
        RedisMetricsCollector,
        WorkerPoolCollector,
        ProcessMetricsCollector,
        REQUEST_COUNT,
        REQUEST_LATENCY,
        initialize_service_info,
    )
"""

from __future__ import annotations

# Collectors
from src.infrastructure.metrics.collectors import (
    HealthCheckerProtocol,
    ProcessMetricsCollector,
    RedisMetricsCollector,
    WorkerPoolCollector,
    WorkerPoolProtocol,
)

# Metric definitions
from src.infrastructure.metrics.definitions import (
    ACTIVE_TASKS,
    ACTIVE_WORKERS,
    EVENTS_PROCESSED,
    PROCESS_MEMORY_BYTES,
    REDIS_CONNECTION_UP,
    REDIS_LATENCY,
    REQUEST_COUNT,
    REQUEST_LATENCY,
    SERVICE_INFO,
)

# Middleware
from src.infrastructure.metrics.middleware import (
    PrometheusMiddleware,
    normalize_endpoint_path,
)

# Registry helpers
from src.infrastructure.metrics.registry import (
    create_custom_registry,
    get_metrics_registry,
    initialize_service_info,
    update_process_metrics,
)

__all__ = [
    # Metric definitions
    "SERVICE_INFO",
    "REQUEST_COUNT",
    "REQUEST_LATENCY",
    "EVENTS_PROCESSED",
    "ACTIVE_TASKS",
    "ACTIVE_WORKERS",
    "REDIS_CONNECTION_UP",
    "REDIS_LATENCY",
    "PROCESS_MEMORY_BYTES",
    # Middleware
    "PrometheusMiddleware",
    "normalize_endpoint_path",
    # Collectors
    "RedisMetricsCollector",
    "WorkerPoolCollector",
    "ProcessMetricsCollector",
    "HealthCheckerProtocol",
    "WorkerPoolProtocol",
    # Registry helpers
    "get_metrics_registry",
    "create_custom_registry",
    "initialize_service_info",
    "update_process_metrics",
]
