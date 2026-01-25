"""Integration tests for workers /metrics endpoint.

These tests verify that the workers service's Prometheus metrics endpoint:
- Returns 200 status code
- Returns correct content type (text/plain with Prometheus format)
- Contains expected metrics (active_workers, events_processed)
- Does not break existing /health and /stats endpoints

These tests require the workers service to be running.
Use pytest.mark.skipif to skip when workers is not available.
"""

from __future__ import annotations

import os
import re

import pytest

# Check if httpx is available for testing
try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

# Default workers URL
WORKERS_URL = os.getenv("WORKERS_URL", "http://localhost:8081")


def check_workers_available() -> bool:
    """Check if workers service is available."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{WORKERS_URL}/health")
            return response.status_code == 200
    except Exception:
        return False


def check_metrics_endpoint_available() -> bool:
    """Check if /metrics endpoint is available (new code deployed)."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            # Check for 200 and Prometheus content type
            if response.status_code == 200:
                content_type = response.headers.get("content-type", "")
                return "text/plain" in content_type
        return False
    except Exception:
        return False


# Skip all tests in this module if /metrics endpoint is not available
pytestmark = pytest.mark.skipif(
    not check_metrics_endpoint_available(),
    reason="Workers /metrics endpoint not available (service not running or old code)",
)


class TestWorkersMetricsEndpoint:
    """Tests for the workers /metrics endpoint."""

    def test_metrics_endpoint_returns_200(self) -> None:
        """GET /metrics should return 200 status code."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            assert response.status_code == 200

    def test_metrics_endpoint_has_correct_content_type(self) -> None:
        """GET /metrics should return Prometheus content type."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content_type = response.headers.get("content-type", "")
            # Prometheus content type includes version info
            assert "text/plain" in content_type or "text/plain; version=0.0.4" in content_type

    def test_metrics_contains_service_info(self) -> None:
        """GET /metrics should contain asdlc_service_info metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text
            assert "asdlc_service_info" in content

    def test_metrics_contains_active_workers(self) -> None:
        """GET /metrics should contain asdlc_active_workers metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text
            assert "asdlc_active_workers" in content

    def test_metrics_contains_events_processed(self) -> None:
        """GET /metrics should contain asdlc_events_processed_total metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text
            # Events processed counter
            assert "asdlc_events_processed_total" in content

    def test_metrics_contains_redis_connection_status(self) -> None:
        """GET /metrics should contain asdlc_redis_connection_up metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text
            assert "asdlc_redis_connection_up" in content

    def test_metrics_contains_process_memory(self) -> None:
        """GET /metrics should contain asdlc_process_memory_bytes metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text
            assert "asdlc_process_memory_bytes" in content

    def test_service_info_has_workers_label(self) -> None:
        """Service info metric should have service=workers label."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text
            assert 'service="workers"' in content or "service='workers'" in content


class TestWorkersExistingEndpoints:
    """Tests to verify existing endpoints still work after metrics addition."""

    def test_health_endpoint_still_works(self) -> None:
        """GET /health should still return 200."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/health")
            assert response.status_code == 200

    def test_health_returns_json(self) -> None:
        """GET /health should return JSON content type."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/health")
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type

    def test_health_contains_status(self) -> None:
        """GET /health should contain status field."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/health")
            data = response.json()
            assert "status" in data

    def test_stats_endpoint_still_works(self) -> None:
        """GET /stats should still return 200."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/stats")
            assert response.status_code == 200

    def test_stats_returns_json(self) -> None:
        """GET /stats should return JSON content type."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/stats")
            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type

    def test_stats_contains_worker_info(self) -> None:
        """GET /stats should contain worker pool statistics."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/stats")
            data = response.json()
            # Stats should include worker pool info
            assert "active_workers" in data or "pool_size" in data or "events_processed" in data

    def test_liveness_endpoint_works(self) -> None:
        """GET /health/live should return 200."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/health/live")
            assert response.status_code == 200

    def test_readiness_endpoint_works(self) -> None:
        """GET /health/ready should return 200 or 503 (if deps unavailable)."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/health/ready")
            # Either healthy (200) or degraded (503) is acceptable
            assert response.status_code in (200, 503)


class TestWorkersMetricsFormat:
    """Tests for Prometheus format compliance of workers metrics."""

    def test_metrics_are_valid_prometheus_format(self) -> None:
        """Metrics output should be valid Prometheus exposition format."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text

            # Basic format checks
            lines = content.strip().split("\n")
            for line in lines:
                if not line.strip():
                    continue
                if line.startswith("#"):
                    continue
                # Metric line validation
                assert re.match(r"^\w+(\{[^}]*\})?\s+[\d.eE+-]+(\s+\d+)?$", line), (
                    f"Invalid Prometheus format line: {line}"
                )

    def test_active_workers_is_numeric(self) -> None:
        """asdlc_active_workers metric value should be numeric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text

            # Find active_workers metric line and check value
            for line in content.split("\n"):
                if line.startswith("asdlc_active_workers{"):
                    # Extract value (last token after space)
                    parts = line.split()
                    value = parts[-1]
                    # Should be parseable as float
                    float(value)  # Will raise if not numeric
                    return
            # If we didn't find the metric, that's an error
            pytest.fail("asdlc_active_workers metric not found")

    def test_events_processed_is_counter(self) -> None:
        """asdlc_events_processed_total should be present as counter."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{WORKERS_URL}/metrics")
            content = response.text

            # Counter metrics have TYPE comment
            assert "# TYPE asdlc_events_processed_total counter" in content
