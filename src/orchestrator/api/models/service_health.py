"""Pydantic models for service health endpoints.

This module defines the data models used by the service health API
for monitoring aSDLC services (P06-F07).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ServiceHealthStatus(str, Enum):
    """Health status for a service.

    Values match frontend TypeScript type:
    'healthy' | 'degraded' | 'unhealthy'
    """

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ServiceHealthInfo(BaseModel):
    """Health information for a single service.

    Attributes:
        name: Service identifier (e.g., 'orchestrator', 'workers').
        status: Current health status.
        cpu_percent: CPU utilization percentage.
        memory_percent: Memory utilization percentage.
        pod_count: Number of running pods.
        request_rate: Requests per second (optional).
        latency_p50: 50th percentile latency in ms (optional).
        last_restart: Timestamp of last pod restart (optional).
    """

    name: str
    status: ServiceHealthStatus
    cpu_percent: float = Field(alias="cpuPercent")
    memory_percent: float = Field(alias="memoryPercent")
    pod_count: int = Field(alias="podCount")
    request_rate: Optional[float] = Field(default=None, alias="requestRate")
    latency_p50: Optional[float] = Field(default=None, alias="latencyP50")
    last_restart: Optional[datetime] = Field(default=None, alias="lastRestart")

    model_config = {"populate_by_name": True}


class SparklineDataPoint(BaseModel):
    """A single data point for sparkline charts.

    Attributes:
        timestamp: Unix timestamp in seconds.
        value: Metric value at this timestamp.
    """

    timestamp: int
    value: float


class ServiceConnectionType(str, Enum):
    """Connection type between services."""

    HTTP = "http"
    REDIS = "redis"
    ELASTICSEARCH = "elasticsearch"


class ServiceConnection(BaseModel):
    """Connection between two services in the topology map."""

    from_service: str = Field(alias="from")
    to_service: str = Field(alias="to")
    type: ServiceConnectionType

    model_config = {"populate_by_name": True}


class ServicesHealthResponse(BaseModel):
    """Response model for all services health endpoint.

    Attributes:
        services: List of health info for each service.
        connections: Topology connections between services.
        timestamp: When this health snapshot was taken.
    """

    services: list[ServiceHealthInfo]
    connections: list[ServiceConnection] = Field(default_factory=list)
    timestamp: datetime


class ServiceSparklineResponse(BaseModel):
    """Response model for service sparkline data endpoint.

    Attributes:
        service: Service name.
        metric: Metric type ('cpu', 'memory', 'requests', 'latency').
        data_points: Time series data points.
        interval: Sampling interval (e.g., '1m').
        duration: Total time range (e.g., '15m').
    """

    service: str
    metric: str
    data_points: list[SparklineDataPoint] = Field(alias="dataPoints")
    interval: str
    duration: str

    model_config = {"populate_by_name": True}
