"""Integration tests for service health API endpoints.

Tests the /api/metrics/services/health and /api/metrics/services/{name}/sparkline
endpoints with mocked VictoriaMetrics responses.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.routes.metrics_api import router


@pytest.fixture
def app() -> FastAPI:
    """Create a test FastAPI application."""
    test_app = FastAPI()
    test_app.include_router(router)
    return test_app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def mock_services_health_response() -> dict[str, Any]:
    """Mock response for services health endpoint."""
    return {
        "services": [
            {
                "name": "elasticsearch",
                "status": "healthy",
                "cpuPercent": 25.0,
                "memoryPercent": 40.0,
                "podCount": 1,
                "requestRate": None,
                "latencyP50": None,
                "lastRestart": None,
            },
            {
                "name": "hitl-ui",
                "status": "healthy",
                "cpuPercent": 30.0,
                "memoryPercent": 45.0,
                "podCount": 2,
                "requestRate": 100.0,
                "latencyP50": 25.0,
                "lastRestart": None,
            },
            {
                "name": "orchestrator",
                "status": "healthy",
                "cpuPercent": 45.5,
                "memoryPercent": 60.2,
                "podCount": 2,
                "requestRate": 150.5,
                "latencyP50": 30.0,
                "lastRestart": None,
            },
            {
                "name": "redis",
                "status": "healthy",
                "cpuPercent": 15.0,
                "memoryPercent": 30.0,
                "podCount": 1,
                "requestRate": None,
                "latencyP50": None,
                "lastRestart": None,
            },
            {
                "name": "workers",
                "status": "degraded",
                "cpuPercent": 85.0,
                "memoryPercent": 70.0,
                "podCount": 5,
                "requestRate": 200.0,
                "latencyP50": 50.0,
                "lastRestart": None,
            },
        ],
        "timestamp": datetime.now().isoformat(),
    }


@pytest.fixture
def mock_sparkline_response() -> dict[str, Any]:
    """Mock response for sparkline endpoint."""
    return {
        "service": "orchestrator",
        "metric": "cpu",
        "dataPoints": [
            {"timestamp": 1706367600, "value": 45.0},
            {"timestamp": 1706367660, "value": 48.0},
            {"timestamp": 1706367720, "value": 50.0},
        ],
        "interval": "1m",
        "duration": "15m",
    }


class TestServicesHealthEndpoint:
    """Tests for GET /api/metrics/services/health endpoint."""

    def test_get_services_health_success(
        self,
        client: TestClient,
    ) -> None:
        """Test successful services health retrieval."""
        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceHealthInfo,
                ServiceHealthStatus,
                ServicesHealthResponse,
            )

            mock_service = AsyncMock()
            mock_service.get_all_services_health.return_value = ServicesHealthResponse(
                services=[
                    ServiceHealthInfo(
                        name="orchestrator",
                        status=ServiceHealthStatus.HEALTHY,
                        cpu_percent=45.0,
                        memory_percent=60.0,
                        pod_count=2,
                    ),
                ],
                timestamp=datetime.now(),
            )
            mock_get_service.return_value = mock_service

            response = client.get("/api/metrics/services/health")

            assert response.status_code == 200
            data = response.json()
            assert "services" in data
            assert "timestamp" in data
            assert len(data["services"]) >= 1

    def test_get_services_health_vm_unavailable(
        self,
        client: TestClient,
    ) -> None:
        """Test services health when VictoriaMetrics is unavailable."""
        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceHealthInfo,
                ServiceHealthStatus,
                ServicesHealthResponse,
            )

            # Service returns mock data when VM is unavailable
            mock_service = AsyncMock()
            mock_service.get_all_services_health.return_value = ServicesHealthResponse(
                services=[
                    ServiceHealthInfo(
                        name="orchestrator",
                        status=ServiceHealthStatus.HEALTHY,
                        cpu_percent=30.0,
                        memory_percent=40.0,
                        pod_count=1,
                    ),
                ],
                timestamp=datetime.now(),
            )
            mock_get_service.return_value = mock_service

            response = client.get("/api/metrics/services/health")

            # Should still return 200 with mock data
            assert response.status_code == 200
            data = response.json()
            assert "services" in data


class TestServiceSparklineEndpoint:
    """Tests for GET /api/metrics/services/{name}/sparkline endpoint."""

    def test_get_sparkline_success(
        self,
        client: TestClient,
    ) -> None:
        """Test successful sparkline retrieval."""
        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceSparklineResponse,
                SparklineDataPoint,
            )

            mock_service = AsyncMock()
            mock_service.get_service_sparkline.return_value = ServiceSparklineResponse(
                service="orchestrator",
                metric="cpu",
                data_points=[
                    SparklineDataPoint(timestamp=1706367600, value=45.0),
                    SparklineDataPoint(timestamp=1706367660, value=48.0),
                ],
                interval="1m",
                duration="15m",
            )
            mock_get_service.return_value = mock_service

            response = client.get(
                "/api/metrics/services/orchestrator/sparkline",
                params={"metric": "cpu"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["service"] == "orchestrator"
            assert data["metric"] == "cpu"
            assert "dataPoints" in data

    def test_get_sparkline_invalid_service(
        self,
        client: TestClient,
    ) -> None:
        """Test sparkline with invalid service name returns 400."""
        response = client.get(
            "/api/metrics/services/invalid-service/sparkline",
            params={"metric": "cpu"},
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalid-service" in data["detail"].lower() or "valid" in data["detail"].lower()

    def test_get_sparkline_valid_services(
        self,
        client: TestClient,
    ) -> None:
        """Test sparkline accepts all valid service names."""
        valid_services = ["hitl-ui", "orchestrator", "workers", "redis", "elasticsearch"]

        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceSparklineResponse,
                SparklineDataPoint,
            )

            mock_service = AsyncMock()
            mock_service.get_service_sparkline.return_value = ServiceSparklineResponse(
                service="test",
                metric="cpu",
                data_points=[SparklineDataPoint(timestamp=1706367600, value=45.0)],
                interval="1m",
                duration="15m",
            )
            mock_get_service.return_value = mock_service

            for service in valid_services:
                response = client.get(
                    f"/api/metrics/services/{service}/sparkline",
                    params={"metric": "cpu"},
                )
                assert response.status_code == 200, f"Failed for service: {service}"

    def test_get_sparkline_valid_metrics(
        self,
        client: TestClient,
    ) -> None:
        """Test sparkline accepts all valid metric types."""
        valid_metrics = ["cpu", "memory", "requests", "latency"]

        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceSparklineResponse,
                SparklineDataPoint,
            )

            mock_service = AsyncMock()
            mock_service.get_service_sparkline.return_value = ServiceSparklineResponse(
                service="orchestrator",
                metric="test",
                data_points=[SparklineDataPoint(timestamp=1706367600, value=45.0)],
                interval="1m",
                duration="15m",
            )
            mock_get_service.return_value = mock_service

            for metric in valid_metrics:
                response = client.get(
                    "/api/metrics/services/orchestrator/sparkline",
                    params={"metric": metric},
                )
                assert response.status_code == 200, f"Failed for metric: {metric}"

    def test_get_sparkline_vm_unavailable(
        self,
        client: TestClient,
    ) -> None:
        """Test sparkline when VictoriaMetrics is unavailable."""
        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceSparklineResponse,
                SparklineDataPoint,
            )

            # Service returns mock data when VM is unavailable
            mock_service = AsyncMock()
            mock_service.get_service_sparkline.return_value = ServiceSparklineResponse(
                service="orchestrator",
                metric="cpu",
                data_points=[SparklineDataPoint(timestamp=1706367600, value=30.0)],
                interval="1m",
                duration="15m",
            )
            mock_get_service.return_value = mock_service

            response = client.get(
                "/api/metrics/services/orchestrator/sparkline",
                params={"metric": "cpu"},
            )

            # Should still return 200 with mock data
            assert response.status_code == 200

    def test_get_sparkline_default_metric(
        self,
        client: TestClient,
    ) -> None:
        """Test sparkline uses cpu as default metric."""
        with patch(
            "src.orchestrator.routes.metrics_api.get_service_health_service"
        ) as mock_get_service:
            from src.orchestrator.api.models.service_health import (
                ServiceSparklineResponse,
                SparklineDataPoint,
            )

            mock_service = AsyncMock()
            mock_service.get_service_sparkline.return_value = ServiceSparklineResponse(
                service="orchestrator",
                metric="cpu",
                data_points=[],
                interval="1m",
                duration="15m",
            )
            mock_get_service.return_value = mock_service

            # No metric param should default to cpu
            response = client.get("/api/metrics/services/orchestrator/sparkline")

            assert response.status_code == 200
            mock_service.get_service_sparkline.assert_called_once_with(
                "orchestrator", "cpu"
            )
