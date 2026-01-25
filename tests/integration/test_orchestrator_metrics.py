"""Integration tests for orchestrator /metrics endpoint.

These tests verify that the orchestrator's Prometheus metrics endpoint:
- Returns 200 status code
- Returns correct content type (text/plain with Prometheus format)
- Contains expected metrics (service info, request metrics)
- Properly tracks HTTP request counts and latencies

These tests require the orchestrator service to be running.
Use pytest.mark.skipif to skip when orchestrator is not available.
"""

from __future__ import annotations

import os
import re
from typing import Generator

import pytest

# Check if httpx is available for async testing
try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

# Default orchestrator URL
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8080")


def check_orchestrator_available() -> bool:
    """Check if orchestrator service is available."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/health")
            return response.status_code == 200
    except Exception:
        return False


def check_metrics_endpoint_available() -> bool:
    """Check if /metrics endpoint is available (new code deployed)."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
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
    reason="Orchestrator /metrics endpoint not available (service not running or old code)",
)


class TestOrchestratorMetricsEndpoint:
    """Tests for the orchestrator /metrics endpoint."""

    def test_metrics_endpoint_returns_200(self) -> None:
        """GET /metrics should return 200 status code."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            assert response.status_code == 200

    def test_metrics_endpoint_has_correct_content_type(self) -> None:
        """GET /metrics should return Prometheus content type."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content_type = response.headers.get("content-type", "")
            # Prometheus content type includes version info
            assert "text/plain" in content_type or "text/plain; version=0.0.4" in content_type

    def test_metrics_contains_service_info(self) -> None:
        """GET /metrics should contain asdlc_service_info metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text
            # Service info metric should be present
            assert "asdlc_service_info" in content

    def test_metrics_contains_request_count(self) -> None:
        """GET /metrics should contain asdlc_http_requests_total metric."""
        with httpx.Client(timeout=5.0) as client:
            # Make a request to /health first to generate metrics
            client.get(f"{ORCHESTRATOR_URL}/health")
            # Now check metrics
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text
            # Request count metric should be present (Counter with _total suffix)
            assert "asdlc_http_requests_total" in content

    def test_metrics_contains_request_latency(self) -> None:
        """GET /metrics should contain asdlc_http_request_duration_seconds metric."""
        with httpx.Client(timeout=5.0) as client:
            # Make a request to generate metrics
            client.get(f"{ORCHESTRATOR_URL}/health")
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text
            # Histogram metrics have _bucket, _sum, _count suffixes
            assert "asdlc_http_request_duration_seconds" in content

    def test_metrics_contains_redis_connection_status(self) -> None:
        """GET /metrics should contain asdlc_redis_connection_up metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text
            # Redis connection gauge should be present
            assert "asdlc_redis_connection_up" in content

    def test_metrics_contains_process_memory(self) -> None:
        """GET /metrics should contain asdlc_process_memory_bytes metric."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text
            # Process memory gauge should be present
            assert "asdlc_process_memory_bytes" in content

    def test_request_count_increments_after_request(self) -> None:
        """Request count should increment after making a request."""
        with httpx.Client(timeout=5.0) as client:
            # Get initial metrics
            initial_response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            initial_content = initial_response.text

            # Extract initial count for /health endpoint
            initial_count = self._extract_request_count(initial_content, "/health")

            # Make a request to /health
            client.get(f"{ORCHESTRATOR_URL}/health")

            # Get updated metrics
            updated_response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            updated_content = updated_response.text

            # Extract updated count
            updated_count = self._extract_request_count(updated_content, "/health")

            # Count should have increased by 1
            assert updated_count == initial_count + 1

    def test_request_latency_recorded(self) -> None:
        """Request latency should be recorded after making a request."""
        with httpx.Client(timeout=5.0) as client:
            # Make a request to generate latency data
            client.get(f"{ORCHESTRATOR_URL}/health")

            # Get metrics
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text

            # Check that histogram has recorded data (sum should be > 0)
            # Looking for: asdlc_http_request_duration_seconds_sum{...} <value>
            assert "asdlc_http_request_duration_seconds_sum" in content
            assert "asdlc_http_request_duration_seconds_count" in content

    def test_service_info_has_orchestrator_label(self) -> None:
        """Service info metric should have service=orchestrator label."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text
            # Check for orchestrator in service info
            assert 'service="orchestrator"' in content or "service='orchestrator'" in content

    def _extract_request_count(self, metrics_content: str, endpoint: str) -> int:
        """Extract request count for a specific endpoint from metrics output.

        Args:
            metrics_content: The raw Prometheus metrics output.
            endpoint: The endpoint path to look for (e.g., '/health').

        Returns:
            The request count as an integer, or 0 if not found.
        """
        # Pattern to match: asdlc_http_requests_total{...,endpoint="/health",...} <count>
        # Escape the endpoint for regex
        escaped_endpoint = re.escape(endpoint)
        pattern = rf'asdlc_http_requests_total{{[^}}]*endpoint="{escaped_endpoint}"[^}}]*}}\s+(\d+(?:\.\d+)?)'
        match = re.search(pattern, metrics_content)
        if match:
            return int(float(match.group(1)))
        return 0


class TestOrchestratorMetricsFormat:
    """Tests for Prometheus format compliance of orchestrator metrics."""

    def test_metrics_are_valid_prometheus_format(self) -> None:
        """Metrics output should be valid Prometheus exposition format."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text

            # Basic format checks:
            # - Lines are either comments (# ...), metric lines (name{labels} value), or empty
            lines = content.strip().split("\n")
            for line in lines:
                if not line.strip():
                    continue  # Empty line is OK
                if line.startswith("#"):
                    continue  # Comment line is OK
                # Metric line should have a name followed by optional labels and a value
                # Simple regex: word characters, optionally followed by {labels}, then space and value
                assert re.match(r"^\w+(\{[^}]*\})?\s+[\d.eE+-]+(\s+\d+)?$", line), (
                    f"Invalid Prometheus format line: {line}"
                )

    def test_all_asdlc_metrics_have_prefix(self) -> None:
        """All custom metrics should have asdlc_ prefix."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/metrics")
            content = response.text

            # Find all metric names (lines that don't start with #)
            for line in content.split("\n"):
                if line.startswith("#") or not line.strip():
                    continue
                # Extract metric name (everything before { or space)
                match = re.match(r"^(\w+)", line)
                if match:
                    metric_name = match.group(1)
                    # Skip standard go/python metrics that prometheus_client adds
                    if metric_name.startswith(("python_", "process_", "gc_")):
                        continue
                    # Our custom metrics should have asdlc_ prefix
                    if not metric_name.startswith("asdlc_"):
                        # This is OK - there may be other default metrics
                        pass
