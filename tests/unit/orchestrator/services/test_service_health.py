"""Unit tests for service health aggregation service.

Tests query methods, caching, and error handling with mocked VictoriaMetrics responses.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.api.models.service_health import (
    ServiceHealthInfo,
    ServiceHealthStatus,
    ServicesHealthResponse,
    ServiceSparklineResponse,
    SparklineDataPoint,
)
from src.orchestrator.services.service_health import (
    VALID_SERVICES,
    ServiceHealthService,
    determine_health_status,
)


class TestDetermineHealthStatus:
    """Tests for health status determination logic."""

    def test_healthy_status(self) -> None:
        """Test healthy status when CPU and memory are low."""
        status = determine_health_status(cpu_percent=30.0, memory_percent=50.0)
        assert status == ServiceHealthStatus.HEALTHY

    def test_degraded_status_high_cpu(self) -> None:
        """Test degraded status when CPU is high."""
        status = determine_health_status(cpu_percent=85.0, memory_percent=50.0)
        assert status == ServiceHealthStatus.DEGRADED

    def test_degraded_status_high_memory(self) -> None:
        """Test degraded status when memory is high."""
        status = determine_health_status(cpu_percent=50.0, memory_percent=82.0)
        assert status == ServiceHealthStatus.DEGRADED

    def test_unhealthy_status_very_high_cpu(self) -> None:
        """Test unhealthy status when CPU is very high."""
        status = determine_health_status(cpu_percent=96.0, memory_percent=50.0)
        assert status == ServiceHealthStatus.UNHEALTHY

    def test_unhealthy_status_very_high_memory(self) -> None:
        """Test unhealthy status when memory is very high."""
        status = determine_health_status(cpu_percent=50.0, memory_percent=96.0)
        assert status == ServiceHealthStatus.UNHEALTHY


class TestValidServices:
    """Tests for valid services constant."""

    def test_valid_services_contains_expected(self) -> None:
        """Test that VALID_SERVICES contains expected services."""
        expected = {"hitl-ui", "orchestrator", "workers", "redis", "elasticsearch"}
        assert VALID_SERVICES == expected


class TestServiceHealthService:
    """Tests for ServiceHealthService class."""

    @pytest.fixture
    def service(self) -> ServiceHealthService:
        """Create a service instance for testing."""
        return ServiceHealthService()

    @pytest.fixture
    def mock_vm_cpu_response(self) -> dict[str, Any]:
        """Mock VictoriaMetrics response for CPU query."""
        return {
            "status": "success",
            "data": {
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "value": [1706367600, "45.5"],
                    }
                ]
            },
        }

    @pytest.fixture
    def mock_vm_memory_response(self) -> dict[str, Any]:
        """Mock VictoriaMetrics response for memory query."""
        return {
            "status": "success",
            "data": {
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "value": [1706367600, "60.2"],
                    }
                ]
            },
        }

    @pytest.fixture
    def mock_vm_pod_count_response(self) -> dict[str, Any]:
        """Mock VictoriaMetrics response for pod count query."""
        return {
            "status": "success",
            "data": {
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "value": [1706367600, "3"],
                    }
                ]
            },
        }

    @pytest.fixture
    def mock_vm_request_rate_response(self) -> dict[str, Any]:
        """Mock VictoriaMetrics response for request rate query."""
        return {
            "status": "success",
            "data": {
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "value": [1706367600, "150.5"],
                    }
                ]
            },
        }

    @pytest.fixture
    def mock_vm_latency_response(self) -> dict[str, Any]:
        """Mock VictoriaMetrics response for latency query."""
        return {
            "status": "success",
            "data": {
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "value": [1706367600, "0.025"],  # 25ms
                    }
                ]
            },
        }

    @pytest.fixture
    def mock_vm_sparkline_response(self) -> dict[str, Any]:
        """Mock VictoriaMetrics response for sparkline data."""
        return {
            "status": "success",
            "data": {
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "values": [
                            [1706367600, "45.0"],
                            [1706367660, "48.0"],
                            [1706367720, "50.0"],
                        ],
                    }
                ]
            },
        }

    @pytest.mark.asyncio
    async def test_get_service_health_success(
        self,
        service: ServiceHealthService,
        mock_vm_cpu_response: dict,
        mock_vm_memory_response: dict,
        mock_vm_pod_count_response: dict,
        mock_vm_request_rate_response: dict,
        mock_vm_latency_response: dict,
    ) -> None:
        """Test successful service health retrieval."""
        with patch.object(
            service, "_query_instant", new_callable=AsyncMock
        ) as mock_query:
            mock_query.side_effect = [
                mock_vm_cpu_response,
                mock_vm_memory_response,
                mock_vm_pod_count_response,
                mock_vm_request_rate_response,
                mock_vm_latency_response,
            ]

            result = await service.get_service_health("orchestrator")

            assert result.name == "orchestrator"
            assert result.status == ServiceHealthStatus.HEALTHY
            assert result.cpu_percent == 45.5
            assert result.memory_percent == 60.2
            assert result.pod_count == 3
            assert result.request_rate == 150.5
            assert result.latency_p50 == 25.0  # Converted to ms

    @pytest.mark.asyncio
    async def test_get_service_health_vm_unavailable(
        self,
        service: ServiceHealthService,
    ) -> None:
        """Test service health when VictoriaMetrics is unavailable."""
        with patch.object(
            service, "_query_instant", new_callable=AsyncMock
        ) as mock_query:
            mock_query.side_effect = Exception("Connection refused")

            result = await service.get_service_health("orchestrator")

            # Should return mock/default data
            assert result.name == "orchestrator"
            assert result.status in list(ServiceHealthStatus)
            assert isinstance(result.cpu_percent, float)
            assert isinstance(result.memory_percent, float)

    @pytest.mark.asyncio
    async def test_get_all_services_health(
        self,
        service: ServiceHealthService,
    ) -> None:
        """Test retrieving health for all services."""
        mock_health = ServiceHealthInfo(
            name="test",
            status=ServiceHealthStatus.HEALTHY,
            cpu_percent=30.0,
            memory_percent=40.0,
            pod_count=1,
        )
        with patch.object(
            service, "get_service_health", new_callable=AsyncMock
        ) as mock_get:
            mock_get.return_value = mock_health

            result = await service.get_all_services_health()

            assert isinstance(result, ServicesHealthResponse)
            assert len(result.services) == 5  # All 5 aSDLC services
            assert isinstance(result.timestamp, datetime)

    @pytest.mark.asyncio
    async def test_get_service_sparkline_success(
        self,
        service: ServiceHealthService,
        mock_vm_sparkline_response: dict,
    ) -> None:
        """Test successful sparkline data retrieval."""
        with patch.object(
            service, "_query_range", new_callable=AsyncMock
        ) as mock_query:
            mock_query.return_value = mock_vm_sparkline_response

            result = await service.get_service_sparkline("orchestrator", "cpu")

            assert isinstance(result, ServiceSparklineResponse)
            assert result.service == "orchestrator"
            assert result.metric == "cpu"
            assert len(result.data_points) == 3
            assert result.data_points[0].timestamp == 1706367600
            assert result.data_points[0].value == 45.0

    @pytest.mark.asyncio
    async def test_get_service_sparkline_vm_unavailable(
        self,
        service: ServiceHealthService,
    ) -> None:
        """Test sparkline when VictoriaMetrics is unavailable."""
        with patch.object(
            service, "_query_range", new_callable=AsyncMock
        ) as mock_query:
            mock_query.side_effect = Exception("Connection refused")

            result = await service.get_service_sparkline("orchestrator", "cpu")

            # Should return mock/default data
            assert isinstance(result, ServiceSparklineResponse)
            assert result.service == "orchestrator"
            assert result.metric == "cpu"

    @pytest.mark.asyncio
    async def test_caching_health(
        self,
        service: ServiceHealthService,
    ) -> None:
        """Test that health data is cached."""
        mock_health = ServiceHealthInfo(
            name="orchestrator",
            status=ServiceHealthStatus.HEALTHY,
            cpu_percent=30.0,
            memory_percent=40.0,
            pod_count=2,
        )

        with patch.object(
            service, "_fetch_service_health", new_callable=AsyncMock
        ) as mock_fetch:
            mock_fetch.return_value = mock_health

            # First call should fetch
            result1 = await service.get_service_health("orchestrator")
            # Second call should use cache
            result2 = await service.get_service_health("orchestrator")

            # Should only have called _fetch_service_health once
            assert mock_fetch.call_count == 1
            assert result1.name == result2.name

    @pytest.mark.asyncio
    async def test_valid_metrics_for_sparkline(
        self,
        service: ServiceHealthService,
    ) -> None:
        """Test that sparkline accepts valid metric types."""
        with patch.object(
            service, "_query_range", new_callable=AsyncMock
        ) as mock_query:
            mock_query.return_value = {"data": {"result": []}}

            valid_metrics = ["cpu", "memory", "requests", "latency"]
            for metric in valid_metrics:
                result = await service.get_service_sparkline("orchestrator", metric)
                assert result.metric == metric
