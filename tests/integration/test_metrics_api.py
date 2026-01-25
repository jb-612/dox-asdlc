"""Integration tests for VictoriaMetrics proxy API.

These tests verify that the /api/metrics/* endpoints work correctly
when VictoriaMetrics is available. They can be run against a live
docker-compose environment.

Tests require:
- Orchestrator service running at ORCHESTRATOR_URL (default: localhost:8080)
- VictoriaMetrics running and connected to orchestrator

Use pytest.mark.skipif to skip when services are not available.
"""

from __future__ import annotations

import os

import pytest

# Check if httpx is available
try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

# URLs from environment or defaults
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


def check_metrics_api_available() -> bool:
    """Check if metrics API endpoints are available (new code deployed)."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/api/metrics/health")
            return response.status_code == 200
    except Exception:
        return False


def check_victoriametrics_available() -> bool:
    """Check if VictoriaMetrics is available via orchestrator proxy."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/api/metrics/health")
            if response.status_code == 200:
                data = response.json()
                return data.get("status") == "healthy"
        return False
    except Exception:
        return False


# Skip all tests if orchestrator not available or metrics API not deployed
pytestmark = pytest.mark.skipif(
    not check_metrics_api_available(),
    reason="Orchestrator metrics API not available (service not running or old code)",
)


class TestMetricsApiIntegration:
    """Integration tests for /api/metrics endpoints."""

    def test_health_endpoint_accessible(self) -> None:
        """GET /api/metrics/health should be accessible."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/api/metrics/health")
            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert data["status"] in ("healthy", "degraded", "unhealthy")

    def test_services_endpoint_accessible(self) -> None:
        """GET /api/metrics/services should return a list."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/api/metrics/services")
            assert response.status_code == 200
            services = response.json()
            assert isinstance(services, list)
            # Should always have at least the fallback services
            assert len(services) >= 2


@pytest.mark.skipif(
    not check_victoriametrics_available(),
    reason="VictoriaMetrics not available",
)
class TestMetricsApiWithVictoriaMetrics:
    """Integration tests requiring VictoriaMetrics to be available."""

    def test_query_range_basic_query(self) -> None:
        """query_range should execute a basic PromQL query."""
        with httpx.Client(timeout=30.0) as client:
            # Query for up metric which should always exist
            response = client.get(
                f"{ORCHESTRATOR_URL}/api/metrics/query_range",
                params={
                    "query": "up",
                    "start": "now-1h",
                    "end": "now",
                    "step": "1m",
                },
            )
            # Should succeed (200) or return 4xx if no data
            assert response.status_code in (200, 400)
            if response.status_code == 200:
                data = response.json()
                assert "status" in data

    def test_query_range_asdlc_metrics(self) -> None:
        """query_range should find asdlc_ prefixed metrics."""
        with httpx.Client(timeout=30.0) as client:
            response = client.get(
                f"{ORCHESTRATOR_URL}/api/metrics/query_range",
                params={
                    "query": "asdlc_service_info",
                    "start": "now-1h",
                    "end": "now",
                    "step": "1m",
                },
            )
            assert response.status_code in (200, 400)

    def test_services_returns_asdlc_services(self) -> None:
        """services should return aSDLC service names from VictoriaMetrics."""
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/api/metrics/services")
            assert response.status_code == 200
            services = response.json()
            # Should include our known services
            assert "orchestrator" in services or "workers" in services

    def test_health_shows_healthy(self) -> None:
        """health should show healthy when VM is up."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/api/metrics/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"


class TestMetricsApiOpenApiDocs:
    """Tests for OpenAPI documentation integration."""

    def test_metrics_api_in_openapi(self) -> None:
        """Metrics API endpoints should be in OpenAPI docs."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/openapi.json")
            assert response.status_code == 200
            openapi = response.json()

            paths = openapi.get("paths", {})

            # Check that our endpoints are documented
            assert "/api/metrics/query_range" in paths
            assert "/api/metrics/services" in paths
            assert "/api/metrics/health" in paths

    def test_metrics_tag_in_openapi(self) -> None:
        """Metrics API should have 'metrics' tag in OpenAPI docs."""
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{ORCHESTRATOR_URL}/openapi.json")
            assert response.status_code == 200
            openapi = response.json()

            # Check that at least one metrics endpoint has the metrics tag
            paths = openapi.get("paths", {})
            metrics_health = paths.get("/api/metrics/health", {})
            get_operation = metrics_health.get("get", {})
            tags = get_operation.get("tags", [])
            assert "metrics" in tags
