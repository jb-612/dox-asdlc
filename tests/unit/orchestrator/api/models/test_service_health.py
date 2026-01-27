"""Unit tests for service health Pydantic models.

Tests model validation, serialization, and constraints.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from src.orchestrator.api.models.service_health import (
    ServiceHealthStatus,
    ServiceHealthInfo,
    SparklineDataPoint,
    ServicesHealthResponse,
    ServiceSparklineResponse,
)


class TestServiceHealthStatus:
    """Tests for ServiceHealthStatus enum."""

    def test_health_status_enum_values(self) -> None:
        """Test ServiceHealthStatus enum has correct values."""
        assert ServiceHealthStatus.HEALTHY.value == "healthy"
        assert ServiceHealthStatus.DEGRADED.value == "degraded"
        assert ServiceHealthStatus.UNHEALTHY.value == "unhealthy"

    def test_health_status_is_string_enum(self) -> None:
        """Test ServiceHealthStatus is a string enum."""
        assert isinstance(ServiceHealthStatus.HEALTHY, str)
        assert ServiceHealthStatus.HEALTHY == "healthy"


class TestServiceHealthInfo:
    """Tests for ServiceHealthInfo model."""

    def test_service_health_info_creation(self) -> None:
        """Test ServiceHealthInfo creation with all fields."""
        now = datetime.now(timezone.utc)
        info = ServiceHealthInfo(
            name="orchestrator",
            status=ServiceHealthStatus.HEALTHY,
            cpu_percent=45.5,
            memory_percent=60.2,
            pod_count=3,
            request_rate=150.5,
            latency_p50=25.0,
            last_restart=now,
        )
        assert info.name == "orchestrator"
        assert info.status == ServiceHealthStatus.HEALTHY
        assert info.cpu_percent == 45.5
        assert info.memory_percent == 60.2
        assert info.pod_count == 3
        assert info.request_rate == 150.5
        assert info.latency_p50 == 25.0
        assert info.last_restart == now

    def test_service_health_info_optional_fields(self) -> None:
        """Test ServiceHealthInfo with optional fields as None."""
        info = ServiceHealthInfo(
            name="redis",
            status=ServiceHealthStatus.HEALTHY,
            cpu_percent=20.0,
            memory_percent=40.0,
            pod_count=1,
        )
        assert info.name == "redis"
        assert info.request_rate is None
        assert info.latency_p50 is None
        assert info.last_restart is None

    def test_service_health_info_serialization(self) -> None:
        """Test ServiceHealthInfo JSON serialization with camelCase aliases."""
        info = ServiceHealthInfo(
            name="workers",
            status=ServiceHealthStatus.DEGRADED,
            cpu_percent=75.0,
            memory_percent=80.0,
            pod_count=5,
            request_rate=200.0,
            latency_p50=50.0,
        )
        data = info.model_dump(by_alias=True)
        assert data["name"] == "workers"
        assert data["status"] == "degraded"
        assert data["cpuPercent"] == 75.0
        assert data["memoryPercent"] == 80.0
        assert data["podCount"] == 5
        assert data["requestRate"] == 200.0
        assert data["latencyP50"] == 50.0

    def test_service_health_info_from_dict_by_alias(self) -> None:
        """Test ServiceHealthInfo can be created from camelCase dict."""
        data = {
            "name": "hitl-ui",
            "status": "healthy",
            "cpuPercent": 30.0,
            "memoryPercent": 45.0,
            "podCount": 2,
            "requestRate": 100.0,
        }
        info = ServiceHealthInfo.model_validate(data)
        assert info.name == "hitl-ui"
        assert info.cpu_percent == 30.0
        assert info.memory_percent == 45.0
        assert info.pod_count == 2

    def test_service_health_info_validation_error(self) -> None:
        """Test ServiceHealthInfo raises error for invalid data."""
        with pytest.raises(ValidationError):
            ServiceHealthInfo(
                name="test",
                status="invalid_status",  # Invalid enum value
                cpu_percent=45.0,
                memory_percent=60.0,
                pod_count=1,
            )


class TestSparklineDataPoint:
    """Tests for SparklineDataPoint model."""

    def test_sparkline_data_point_creation(self) -> None:
        """Test SparklineDataPoint creation."""
        point = SparklineDataPoint(
            timestamp=1706367600,
            value=45.5,
        )
        assert point.timestamp == 1706367600
        assert point.value == 45.5

    def test_sparkline_data_point_serialization(self) -> None:
        """Test SparklineDataPoint JSON serialization."""
        point = SparklineDataPoint(
            timestamp=1706367600,
            value=75.0,
        )
        data = point.model_dump()
        assert data["timestamp"] == 1706367600
        assert data["value"] == 75.0


class TestServicesHealthResponse:
    """Tests for ServicesHealthResponse model."""

    def test_services_health_response_creation(self) -> None:
        """Test ServicesHealthResponse creation."""
        now = datetime.now(timezone.utc)
        response = ServicesHealthResponse(
            services=[
                ServiceHealthInfo(
                    name="orchestrator",
                    status=ServiceHealthStatus.HEALTHY,
                    cpu_percent=45.0,
                    memory_percent=60.0,
                    pod_count=2,
                ),
                ServiceHealthInfo(
                    name="redis",
                    status=ServiceHealthStatus.HEALTHY,
                    cpu_percent=20.0,
                    memory_percent=40.0,
                    pod_count=1,
                ),
            ],
            timestamp=now,
        )
        assert len(response.services) == 2
        assert response.services[0].name == "orchestrator"
        assert response.timestamp == now

    def test_services_health_response_serialization(self) -> None:
        """Test ServicesHealthResponse JSON serialization."""
        now = datetime.now(timezone.utc)
        response = ServicesHealthResponse(
            services=[
                ServiceHealthInfo(
                    name="workers",
                    status=ServiceHealthStatus.DEGRADED,
                    cpu_percent=80.0,
                    memory_percent=85.0,
                    pod_count=5,
                ),
            ],
            timestamp=now,
        )
        data = response.model_dump(by_alias=True)
        assert len(data["services"]) == 1
        assert data["services"][0]["cpuPercent"] == 80.0
        assert "timestamp" in data


class TestServiceSparklineResponse:
    """Tests for ServiceSparklineResponse model."""

    def test_service_sparkline_response_creation(self) -> None:
        """Test ServiceSparklineResponse creation."""
        response = ServiceSparklineResponse(
            service="orchestrator",
            metric="cpu",
            data_points=[
                SparklineDataPoint(timestamp=1706367600, value=45.0),
                SparklineDataPoint(timestamp=1706367660, value=48.0),
                SparklineDataPoint(timestamp=1706367720, value=50.0),
            ],
            interval="1m",
            duration="15m",
        )
        assert response.service == "orchestrator"
        assert response.metric == "cpu"
        assert len(response.data_points) == 3
        assert response.interval == "1m"
        assert response.duration == "15m"

    def test_service_sparkline_response_serialization(self) -> None:
        """Test ServiceSparklineResponse JSON serialization with camelCase."""
        response = ServiceSparklineResponse(
            service="workers",
            metric="memory",
            data_points=[
                SparklineDataPoint(timestamp=1706367600, value=60.0),
            ],
            interval="1m",
            duration="15m",
        )
        data = response.model_dump(by_alias=True)
        assert data["service"] == "workers"
        assert data["metric"] == "memory"
        assert data["dataPoints"][0]["value"] == 60.0
        assert data["interval"] == "1m"
        assert data["duration"] == "15m"

    def test_service_sparkline_response_from_dict_by_alias(self) -> None:
        """Test ServiceSparklineResponse can be created from camelCase dict."""
        data = {
            "service": "redis",
            "metric": "cpu",
            "dataPoints": [
                {"timestamp": 1706367600, "value": 25.0},
            ],
            "interval": "1m",
            "duration": "15m",
        }
        response = ServiceSparklineResponse.model_validate(data)
        assert response.service == "redis"
        assert len(response.data_points) == 1
        assert response.data_points[0].value == 25.0
