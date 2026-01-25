"""Unit tests for Prometheus format validation.

Tests verify that all metrics follow Prometheus naming conventions:
- Metric names have asdlc_ prefix
- Counter names end with _total
- Duration histograms use _seconds suffix
- Labels are snake_case
- No high-cardinality labels in definitions
"""

from __future__ import annotations

import re

import pytest
from prometheus_client import REGISTRY, generate_latest


class TestMetricNamingConventions:
    """Tests for metric naming conventions."""

    def test_all_asdlc_metrics_have_prefix(self) -> None:
        """All custom aSDLC metrics should have asdlc_ prefix."""
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

    def test_counter_names_end_with_total(self) -> None:
        """Counter metric names should end with _total when exported."""
        from prometheus_client import Counter, generate_latest, REGISTRY

        from src.infrastructure.metrics.definitions import (
            EVENTS_PROCESSED,
            REQUEST_COUNT,
        )

        counters = [REQUEST_COUNT, EVENTS_PROCESSED]

        for counter in counters:
            assert isinstance(counter, Counter)

        # Prometheus automatically adds _total suffix for counters during export
        # Verify by checking the exported output
        output = generate_latest(REGISTRY).decode("utf-8")

        # Counter metrics should have _total suffix in exported form
        assert "asdlc_http_requests_total{" in output or "asdlc_http_requests_total " in output, (
            "REQUEST_COUNT should export with _total suffix"
        )
        assert "asdlc_events_processed_total{" in output or "asdlc_events_processed_total " in output, (
            "EVENTS_PROCESSED should export with _total suffix"
        )

    def test_histogram_durations_use_seconds(self) -> None:
        """Histogram metrics for durations should use _seconds suffix."""
        from prometheus_client import Histogram

        from src.infrastructure.metrics.definitions import (
            REDIS_LATENCY,
            REQUEST_LATENCY,
        )

        duration_histograms = [REQUEST_LATENCY, REDIS_LATENCY]

        for histogram in duration_histograms:
            assert isinstance(histogram, Histogram)
            assert "_seconds" in histogram._name, (
                f"Duration histogram {histogram._name} should use _seconds suffix"
            )


class TestLabelConventions:
    """Tests for label naming conventions."""

    def test_all_labels_are_snake_case(self) -> None:
        """All labels should be lowercase snake_case."""
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

        # Snake case pattern: lowercase letters, numbers, and underscores
        snake_case_pattern = re.compile(r"^[a-z][a-z0-9_]*$")

        for metric in metrics_with_labels:
            for label in metric._labelnames:
                assert snake_case_pattern.match(label), (
                    f"Label '{label}' in metric {metric._name} is not snake_case"
                )

    def test_no_high_cardinality_labels(self) -> None:
        """Labels should not include high-cardinality values like IDs or timestamps."""
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

        # List of potentially high-cardinality label names to avoid
        high_cardinality_labels = {
            "id", "uuid", "timestamp", "session_id", "request_id",
            "user_id", "trace_id", "span_id", "correlation_id",
        }

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

        for metric in metrics_with_labels:
            for label in metric._labelnames:
                assert label not in high_cardinality_labels, (
                    f"Label '{label}' in metric {metric._name} may cause cardinality explosion"
                )


class TestPrometheusOutputFormat:
    """Tests for Prometheus exposition format compliance."""

    def test_generate_latest_produces_valid_output(self) -> None:
        """generate_latest should produce valid Prometheus format output."""
        from prometheus_client import REGISTRY

        output = generate_latest(REGISTRY)
        assert isinstance(output, bytes)

        # Decode and check format
        text = output.decode("utf-8")

        # Should contain at least some metrics
        assert len(text) > 0

        # Each non-empty line should be either:
        # - A comment line starting with #
        # - A metric line with format: name{labels} value [timestamp]
        lines = text.strip().split("\n")
        for line in lines:
            if not line.strip():
                continue
            if line.startswith("#"):
                # Comment lines: # HELP, # TYPE, or other comments
                continue
            # Metric line should match pattern
            # Example: metric_name{label="value"} 123.45
            # Example: metric_name 123.45
            assert re.match(
                r"^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+[\d.eE+-]+(\s+\d+)?$",
                line.strip(),
            ), f"Invalid Prometheus format line: {line}"

    def test_asdlc_metrics_present_in_output(self) -> None:
        """aSDLC metrics should be present in generate_latest output."""
        from src.infrastructure.metrics import initialize_service_info

        # Initialize service info to ensure it's in the registry
        initialize_service_info(service_name="test", version="0.1.0")

        output = generate_latest(REGISTRY).decode("utf-8")

        # Check that our custom metrics are present
        assert "asdlc_service_info" in output

    def test_type_annotations_present(self) -> None:
        """Metrics should have # TYPE annotations in output."""
        from src.infrastructure.metrics import initialize_service_info

        initialize_service_info(service_name="test", version="0.1.0")

        output = generate_latest(REGISTRY).decode("utf-8")

        # Should contain TYPE annotations
        assert "# TYPE" in output

    def test_help_annotations_present(self) -> None:
        """Metrics should have # HELP annotations in output."""
        from src.infrastructure.metrics import initialize_service_info

        initialize_service_info(service_name="test", version="0.1.0")

        output = generate_latest(REGISTRY).decode("utf-8")

        # Should contain HELP annotations
        assert "# HELP" in output


class TestMetricValueFormats:
    """Tests for metric value formats."""

    def test_counter_values_are_numeric(self) -> None:
        """Counter values should be numeric in output."""
        from src.infrastructure.metrics.definitions import REQUEST_COUNT

        # Increment the counter
        REQUEST_COUNT.labels(
            service="test",
            method="GET",
            endpoint="/test",
            status="200",
        ).inc()

        output = generate_latest(REGISTRY).decode("utf-8")

        # Find the counter line and verify value is numeric
        for line in output.split("\n"):
            if line.startswith("asdlc_http_requests_total{"):
                parts = line.split()
                value = parts[-1]
                # Should be parseable as float
                float(value)
                return

    def test_histogram_has_bucket_sum_count(self) -> None:
        """Histogram metrics should have _bucket, _sum, _count variants."""
        from src.infrastructure.metrics.definitions import REQUEST_LATENCY

        # Observe a value
        REQUEST_LATENCY.labels(
            service="test",
            method="GET",
            endpoint="/test",
        ).observe(0.1)

        output = generate_latest(REGISTRY).decode("utf-8")

        # Histogram should have all three variants
        assert "asdlc_http_request_duration_seconds_bucket{" in output
        assert "asdlc_http_request_duration_seconds_sum{" in output
        assert "asdlc_http_request_duration_seconds_count{" in output

    def test_gauge_values_can_go_up_and_down(self) -> None:
        """Gauge values should support increment and decrement."""
        from src.infrastructure.metrics.definitions import ACTIVE_TASKS

        # Set a value
        ACTIVE_TASKS.labels(service="test").set(5)

        output1 = generate_latest(REGISTRY).decode("utf-8")

        # Find the value
        for line in output1.split("\n"):
            if 'asdlc_active_tasks{service="test"}' in line:
                parts = line.split()
                assert float(parts[-1]) == 5.0

        # Change the value
        ACTIVE_TASKS.labels(service="test").set(3)

        output2 = generate_latest(REGISTRY).decode("utf-8")

        # Verify new value
        for line in output2.split("\n"):
            if 'asdlc_active_tasks{service="test"}' in line:
                parts = line.split()
                assert float(parts[-1]) == 3.0
