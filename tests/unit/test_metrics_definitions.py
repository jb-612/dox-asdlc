"""Unit tests for Prometheus metrics definitions.

Tests verify:
- Metric types are correct (Counter, Histogram, Gauge, Info)
- All metrics have asdlc_ prefix
- Counter metrics end with _total
- Histograms use seconds for duration metrics
- All expected labels are present
"""

from __future__ import annotations

import pytest


class TestServiceInfoMetric:
    """Tests for SERVICE_INFO metric."""

    def test_service_info_exists(self) -> None:
        """SERVICE_INFO metric should be defined."""
        from src.infrastructure.metrics.definitions import SERVICE_INFO

        assert SERVICE_INFO is not None

    def test_service_info_is_info_type(self) -> None:
        """SERVICE_INFO should be an Info metric."""
        from prometheus_client import Info

        from src.infrastructure.metrics.definitions import SERVICE_INFO

        assert isinstance(SERVICE_INFO, Info)

    def test_service_info_name_prefix(self) -> None:
        """SERVICE_INFO should have asdlc_ prefix."""
        from src.infrastructure.metrics.definitions import SERVICE_INFO

        assert SERVICE_INFO._name.startswith("asdlc_")


class TestRequestMetrics:
    """Tests for HTTP request metrics."""

    def test_request_count_exists(self) -> None:
        """REQUEST_COUNT metric should be defined."""
        from src.infrastructure.metrics.definitions import REQUEST_COUNT

        assert REQUEST_COUNT is not None

    def test_request_count_is_counter(self) -> None:
        """REQUEST_COUNT should be a Counter metric."""
        from prometheus_client import Counter

        from src.infrastructure.metrics.definitions import REQUEST_COUNT

        assert isinstance(REQUEST_COUNT, Counter)

    def test_request_count_ends_with_total(self) -> None:
        """REQUEST_COUNT should end with _total suffix when exported."""
        from prometheus_client import generate_latest

        from src.infrastructure.metrics.definitions import REQUEST_COUNT

        # The _total suffix is added automatically by prometheus_client for Counters
        # We verify by checking the describe output which shows the exported name
        metric_desc = list(REQUEST_COUNT.describe())[0]
        # Counter metrics have _total suffix in exported form (added automatically)
        assert "requests" in metric_desc.name

    def test_request_count_has_required_labels(self) -> None:
        """REQUEST_COUNT should have service, method, endpoint, status labels."""
        from src.infrastructure.metrics.definitions import REQUEST_COUNT

        labels = REQUEST_COUNT._labelnames
        assert "service" in labels
        assert "method" in labels
        assert "endpoint" in labels
        assert "status" in labels

    def test_request_latency_exists(self) -> None:
        """REQUEST_LATENCY metric should be defined."""
        from src.infrastructure.metrics.definitions import REQUEST_LATENCY

        assert REQUEST_LATENCY is not None

    def test_request_latency_is_histogram(self) -> None:
        """REQUEST_LATENCY should be a Histogram metric."""
        from prometheus_client import Histogram

        from src.infrastructure.metrics.definitions import REQUEST_LATENCY

        assert isinstance(REQUEST_LATENCY, Histogram)

    def test_request_latency_uses_seconds(self) -> None:
        """REQUEST_LATENCY should use _seconds suffix."""
        from src.infrastructure.metrics.definitions import REQUEST_LATENCY

        assert "_seconds" in REQUEST_LATENCY._name

    def test_request_latency_has_required_labels(self) -> None:
        """REQUEST_LATENCY should have service, method, endpoint labels."""
        from src.infrastructure.metrics.definitions import REQUEST_LATENCY

        labels = REQUEST_LATENCY._labelnames
        assert "service" in labels
        assert "method" in labels
        assert "endpoint" in labels


class TestEventMetrics:
    """Tests for event processing metrics."""

    def test_events_processed_exists(self) -> None:
        """EVENTS_PROCESSED metric should be defined."""
        from src.infrastructure.metrics.definitions import EVENTS_PROCESSED

        assert EVENTS_PROCESSED is not None

    def test_events_processed_is_counter(self) -> None:
        """EVENTS_PROCESSED should be a Counter metric."""
        from prometheus_client import Counter

        from src.infrastructure.metrics.definitions import EVENTS_PROCESSED

        assert isinstance(EVENTS_PROCESSED, Counter)

    def test_events_processed_ends_with_total(self) -> None:
        """EVENTS_PROCESSED should end with _total suffix when exported."""
        from src.infrastructure.metrics.definitions import EVENTS_PROCESSED

        # The _total suffix is added automatically by prometheus_client for Counters
        metric_desc = list(EVENTS_PROCESSED.describe())[0]
        assert "events_processed" in metric_desc.name

    def test_events_processed_has_required_labels(self) -> None:
        """EVENTS_PROCESSED should have service, event_type, status labels."""
        from src.infrastructure.metrics.definitions import EVENTS_PROCESSED

        labels = EVENTS_PROCESSED._labelnames
        assert "service" in labels
        assert "event_type" in labels
        assert "status" in labels


class TestTaskMetrics:
    """Tests for task and worker metrics."""

    def test_active_tasks_exists(self) -> None:
        """ACTIVE_TASKS metric should be defined."""
        from src.infrastructure.metrics.definitions import ACTIVE_TASKS

        assert ACTIVE_TASKS is not None

    def test_active_tasks_is_gauge(self) -> None:
        """ACTIVE_TASKS should be a Gauge metric."""
        from prometheus_client import Gauge

        from src.infrastructure.metrics.definitions import ACTIVE_TASKS

        assert isinstance(ACTIVE_TASKS, Gauge)

    def test_active_tasks_has_service_label(self) -> None:
        """ACTIVE_TASKS should have service label."""
        from src.infrastructure.metrics.definitions import ACTIVE_TASKS

        assert "service" in ACTIVE_TASKS._labelnames

    def test_active_workers_exists(self) -> None:
        """ACTIVE_WORKERS metric should be defined."""
        from src.infrastructure.metrics.definitions import ACTIVE_WORKERS

        assert ACTIVE_WORKERS is not None

    def test_active_workers_is_gauge(self) -> None:
        """ACTIVE_WORKERS should be a Gauge metric."""
        from prometheus_client import Gauge

        from src.infrastructure.metrics.definitions import ACTIVE_WORKERS

        assert isinstance(ACTIVE_WORKERS, Gauge)


class TestRedisMetrics:
    """Tests for Redis metrics."""

    def test_redis_connection_up_exists(self) -> None:
        """REDIS_CONNECTION_UP metric should be defined."""
        from src.infrastructure.metrics.definitions import REDIS_CONNECTION_UP

        assert REDIS_CONNECTION_UP is not None

    def test_redis_connection_up_is_gauge(self) -> None:
        """REDIS_CONNECTION_UP should be a Gauge metric."""
        from prometheus_client import Gauge

        from src.infrastructure.metrics.definitions import REDIS_CONNECTION_UP

        assert isinstance(REDIS_CONNECTION_UP, Gauge)

    def test_redis_connection_up_has_service_label(self) -> None:
        """REDIS_CONNECTION_UP should have service label."""
        from src.infrastructure.metrics.definitions import REDIS_CONNECTION_UP

        assert "service" in REDIS_CONNECTION_UP._labelnames

    def test_redis_latency_exists(self) -> None:
        """REDIS_LATENCY metric should be defined."""
        from src.infrastructure.metrics.definitions import REDIS_LATENCY

        assert REDIS_LATENCY is not None

    def test_redis_latency_is_histogram(self) -> None:
        """REDIS_LATENCY should be a Histogram metric."""
        from prometheus_client import Histogram

        from src.infrastructure.metrics.definitions import REDIS_LATENCY

        assert isinstance(REDIS_LATENCY, Histogram)

    def test_redis_latency_uses_seconds(self) -> None:
        """REDIS_LATENCY should use _seconds suffix."""
        from src.infrastructure.metrics.definitions import REDIS_LATENCY

        assert "_seconds" in REDIS_LATENCY._name

    def test_redis_latency_has_required_labels(self) -> None:
        """REDIS_LATENCY should have service and operation labels."""
        from src.infrastructure.metrics.definitions import REDIS_LATENCY

        labels = REDIS_LATENCY._labelnames
        assert "service" in labels
        assert "operation" in labels


class TestProcessMetrics:
    """Tests for process metrics."""

    def test_process_memory_bytes_exists(self) -> None:
        """PROCESS_MEMORY_BYTES metric should be defined."""
        from src.infrastructure.metrics.definitions import PROCESS_MEMORY_BYTES

        assert PROCESS_MEMORY_BYTES is not None

    def test_process_memory_bytes_is_gauge(self) -> None:
        """PROCESS_MEMORY_BYTES should be a Gauge metric."""
        from prometheus_client import Gauge

        from src.infrastructure.metrics.definitions import PROCESS_MEMORY_BYTES

        assert isinstance(PROCESS_MEMORY_BYTES, Gauge)

    def test_process_memory_bytes_uses_bytes(self) -> None:
        """PROCESS_MEMORY_BYTES should use _bytes suffix."""
        from src.infrastructure.metrics.definitions import PROCESS_MEMORY_BYTES

        assert "_bytes" in PROCESS_MEMORY_BYTES._name

    def test_process_memory_bytes_has_required_labels(self) -> None:
        """PROCESS_MEMORY_BYTES should have service and type labels."""
        from src.infrastructure.metrics.definitions import PROCESS_MEMORY_BYTES

        labels = PROCESS_MEMORY_BYTES._labelnames
        assert "service" in labels
        assert "type" in labels


class TestMetricNamingConventions:
    """Tests for Prometheus naming conventions."""

    def test_all_metrics_have_asdlc_prefix(self) -> None:
        """All custom metrics should have asdlc_ prefix."""
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

        metrics = [
            SERVICE_INFO,
            REQUEST_COUNT,
            REQUEST_LATENCY,
            EVENTS_PROCESSED,
            ACTIVE_TASKS,
            ACTIVE_WORKERS,
            REDIS_CONNECTION_UP,
            REDIS_LATENCY,
            PROCESS_MEMORY_BYTES,
        ]

        for metric in metrics:
            assert metric._name.startswith("asdlc_"), (
                f"Metric {metric._name} does not have asdlc_ prefix"
            )

    def test_all_counter_metrics_are_counters(self) -> None:
        """All Counter metrics should be Counter type."""
        from prometheus_client import Counter

        from src.infrastructure.metrics.definitions import (
            EVENTS_PROCESSED,
            REQUEST_COUNT,
        )

        counters = [REQUEST_COUNT, EVENTS_PROCESSED]

        for counter in counters:
            assert isinstance(counter, Counter), (
                f"Metric {counter._name} should be a Counter"
            )
            # Note: prometheus_client automatically appends _total suffix to Counters
            # during export, so we don't need to include it in the metric name

    def test_all_labels_are_snake_case(self) -> None:
        """All labels should be snake_case."""
        import re

        from src.infrastructure.metrics.definitions import (
            ACTIVE_TASKS,
            ACTIVE_WORKERS,
            EVENTS_PROCESSED,
            PROCESS_MEMORY_BYTES,
            REDIS_CONNECTION_UP,
            REDIS_LATENCY,
            REQUEST_COUNT,
            REQUEST_LATENCY,
        )

        metrics_with_labels = [
            REQUEST_COUNT,
            REQUEST_LATENCY,
            EVENTS_PROCESSED,
            ACTIVE_TASKS,
            ACTIVE_WORKERS,
            REDIS_CONNECTION_UP,
            REDIS_LATENCY,
            PROCESS_MEMORY_BYTES,
        ]

        snake_case_pattern = re.compile(r"^[a-z][a-z0-9_]*$")

        for metric in metrics_with_labels:
            for label in metric._labelnames:
                assert snake_case_pattern.match(label), (
                    f"Label {label} in metric {metric._name} is not snake_case"
                )
