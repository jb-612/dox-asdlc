"""Service health aggregation service.

This module provides functions to aggregate health information for aSDLC
services by querying VictoriaMetrics. It includes caching to reduce query
load and graceful degradation when VictoriaMetrics is unavailable.

P06-F07: K8s Cluster Monitoring.
"""

from __future__ import annotations

import logging
import os
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from src.orchestrator.api.models.service_health import (
    ServiceHealthInfo,
    ServiceHealthStatus,
    ServiceSparklineResponse,
    ServicesHealthResponse,
    SparklineDataPoint,
)

logger = logging.getLogger(__name__)

# VictoriaMetrics URL from environment or default for docker-compose
VICTORIAMETRICS_URL = os.environ.get(
    "VICTORIAMETRICS_URL", "http://victoriametrics:8428"
)

# Query timeout
QUERY_TIMEOUT = float(os.environ.get("VICTORIAMETRICS_QUERY_TIMEOUT", "30.0"))

# Valid service names for aSDLC
VALID_SERVICES: set[str] = {
    "hitl-ui",
    "orchestrator",
    "workers",
    "redis",
    "elasticsearch",
}

# Service name to pod label mappings
SERVICE_POD_LABELS: dict[str, str] = {
    "hitl-ui": 'app="hitl-ui"',
    "orchestrator": 'app="orchestrator"',
    "workers": 'app="workers"',
    "redis": 'app="redis"',
    "elasticsearch": 'app="elasticsearch"',
}

# Health status thresholds
CPU_DEGRADED_THRESHOLD = 80.0
CPU_UNHEALTHY_THRESHOLD = 95.0
MEMORY_DEGRADED_THRESHOLD = 80.0
MEMORY_UNHEALTHY_THRESHOLD = 95.0

# Cache configuration
HEALTH_CACHE_TTL = 300  # 5 minutes in seconds
SPARKLINE_CACHE_TTL = 60  # 1 minute in seconds


def determine_health_status(
    cpu_percent: float, memory_percent: float
) -> ServiceHealthStatus:
    """Determine health status based on CPU and memory usage.

    Args:
        cpu_percent: CPU utilization percentage (0-100).
        memory_percent: Memory utilization percentage (0-100).

    Returns:
        ServiceHealthStatus: HEALTHY, DEGRADED, or UNHEALTHY.
    """
    if cpu_percent >= CPU_UNHEALTHY_THRESHOLD or memory_percent >= MEMORY_UNHEALTHY_THRESHOLD:
        return ServiceHealthStatus.UNHEALTHY
    if cpu_percent >= CPU_DEGRADED_THRESHOLD or memory_percent >= MEMORY_DEGRADED_THRESHOLD:
        return ServiceHealthStatus.DEGRADED
    return ServiceHealthStatus.HEALTHY


class ServiceHealthService:
    """Service for aggregating health information from VictoriaMetrics.

    Provides methods to query service health, metrics, and sparkline data
    with built-in caching and graceful error handling.
    """

    def __init__(self, victoriametrics_url: str | None = None) -> None:
        """Initialize the service health service.

        Args:
            victoriametrics_url: Optional override for VictoriaMetrics URL.
        """
        self._vm_url = victoriametrics_url or VICTORIAMETRICS_URL
        self._health_cache: dict[str, tuple[ServiceHealthInfo, float]] = {}
        self._sparkline_cache: dict[str, tuple[ServiceSparklineResponse, float]] = {}

    async def _query_instant(self, query: str) -> dict[str, Any]:
        """Execute an instant PromQL query against VictoriaMetrics.

        Args:
            query: PromQL query string.

        Returns:
            VictoriaMetrics JSON response.

        Raises:
            Exception: If query fails.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._vm_url}/api/v1/query",
                params={"query": query},
                timeout=QUERY_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()

    async def _query_range(
        self, query: str, start: str, end: str, step: str
    ) -> dict[str, Any]:
        """Execute a range PromQL query against VictoriaMetrics.

        Args:
            query: PromQL query string.
            start: Start time (RFC3339 or Unix timestamp).
            end: End time (RFC3339 or Unix timestamp).
            step: Query resolution step.

        Returns:
            VictoriaMetrics JSON response.

        Raises:
            Exception: If query fails.
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self._vm_url}/api/v1/query_range",
                params={
                    "query": query,
                    "start": start,
                    "end": end,
                    "step": step,
                },
                timeout=QUERY_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()

    def _extract_value(
        self, data: dict[str, Any], default: float = 0.0
    ) -> float:
        """Extract a single value from VictoriaMetrics response.

        Args:
            data: VictoriaMetrics JSON response.
            default: Default value if extraction fails.

        Returns:
            Extracted float value.
        """
        results = data.get("data", {}).get("result", [])
        if results:
            try:
                value = results[0].get("value", [0, str(default)])[1]
                if value == "NaN":
                    return default
                return float(value)
            except (ValueError, IndexError, TypeError):
                return default
        return default

    def _get_mock_health_data(self, service_name: str) -> ServiceHealthInfo:
        """Generate mock health data when VictoriaMetrics is unavailable.

        Args:
            service_name: Name of the service.

        Returns:
            Mock ServiceHealthInfo.
        """
        # Generate somewhat realistic mock values
        cpu = random.uniform(20.0, 60.0)
        memory = random.uniform(30.0, 70.0)
        pod_counts = {"hitl-ui": 2, "orchestrator": 2, "workers": 5, "redis": 1, "elasticsearch": 1}

        return ServiceHealthInfo(
            name=service_name,
            status=determine_health_status(cpu, memory),
            cpu_percent=round(cpu, 1),
            memory_percent=round(memory, 1),
            pod_count=pod_counts.get(service_name, 1),
            request_rate=round(random.uniform(50.0, 200.0), 1) if service_name not in ("redis", "elasticsearch") else None,
            latency_p50=round(random.uniform(10.0, 50.0), 1) if service_name not in ("redis", "elasticsearch") else None,
            last_restart=None,
        )

    def _get_mock_sparkline_data(
        self, service_name: str, metric: str
    ) -> ServiceSparklineResponse:
        """Generate mock sparkline data when VictoriaMetrics is unavailable.

        Args:
            service_name: Name of the service.
            metric: Metric type (cpu, memory, requests, latency).

        Returns:
            Mock ServiceSparklineResponse.
        """
        now = int(time.time())
        data_points = []

        # Generate 15 data points for 15 minutes of data (1 per minute)
        base_value = {
            "cpu": random.uniform(30.0, 50.0),
            "memory": random.uniform(40.0, 60.0),
            "requests": random.uniform(100.0, 200.0),
            "latency": random.uniform(20.0, 40.0),
        }.get(metric, 50.0)

        for i in range(15):
            timestamp = now - (14 - i) * 60
            value = base_value + random.uniform(-10.0, 10.0)
            data_points.append(SparklineDataPoint(timestamp=timestamp, value=round(value, 1)))

        return ServiceSparklineResponse(
            service=service_name,
            metric=metric,
            data_points=data_points,
            interval="1m",
            duration="15m",
        )

    async def _fetch_service_health(self, service_name: str) -> ServiceHealthInfo:
        """Fetch health data from VictoriaMetrics for a service.

        Args:
            service_name: Name of the service.

        Returns:
            ServiceHealthInfo with current metrics.
        """
        label = SERVICE_POD_LABELS.get(service_name, f'app="{service_name}"')

        # Query CPU usage
        cpu_query = f'rate(process_cpu_seconds_total{{{label}}}[5m]) * 100'
        cpu_data = await self._query_instant(cpu_query)
        cpu_percent = self._extract_value(cpu_data)

        # Query memory usage (convert to percentage)
        memory_query = f'process_resident_memory_bytes{{{label}}} / container_spec_memory_limit_bytes{{{label}}} * 100'
        memory_data = await self._query_instant(memory_query)
        memory_percent = self._extract_value(memory_data)
        # If memory limit query fails, use raw memory value as a fallback estimate
        if memory_percent == 0.0:
            raw_memory_query = f'process_resident_memory_bytes{{{label}}}'
            raw_memory_data = await self._query_instant(raw_memory_query)
            raw_memory = self._extract_value(raw_memory_data)
            # Estimate percentage based on 1GB assumed limit
            memory_percent = (raw_memory / (1024 * 1024 * 1024)) * 100

        # Query pod count
        pod_query = f'count(kube_pod_status_phase{{{label}, phase="Running"}})'
        pod_data = await self._query_instant(pod_query)
        pod_count = int(self._extract_value(pod_data, default=1.0))

        # Query request rate (optional - may not exist for all services)
        request_rate = None
        if service_name not in ("redis", "elasticsearch"):
            rate_query = f'sum(rate(asdlc_http_requests_total{{{label}}}[5m]))'
            rate_data = await self._query_instant(rate_query)
            rate_value = self._extract_value(rate_data)
            if rate_value > 0:
                request_rate = round(rate_value, 1)

        # Query latency p50 (optional - may not exist for all services)
        latency_p50 = None
        if service_name not in ("redis", "elasticsearch"):
            latency_query = f'histogram_quantile(0.50, sum(rate(asdlc_http_request_duration_seconds_bucket{{{label}}}[5m])) by (le))'
            latency_data = await self._query_instant(latency_query)
            latency_value = self._extract_value(latency_data)
            if latency_value > 0:
                # Convert seconds to milliseconds
                latency_p50 = round(latency_value * 1000, 1)

        # Determine health status
        status = determine_health_status(cpu_percent, memory_percent)

        return ServiceHealthInfo(
            name=service_name,
            status=status,
            cpu_percent=round(cpu_percent, 1),
            memory_percent=round(memory_percent, 1),
            pod_count=pod_count,
            request_rate=request_rate,
            latency_p50=latency_p50,
            last_restart=None,  # Could query kube_pod_container_status_restarts_total
        )

    async def get_service_health(self, service_name: str) -> ServiceHealthInfo:
        """Get health information for a single service.

        Uses caching with 5 minute TTL. Falls back to mock data if
        VictoriaMetrics is unavailable.

        Args:
            service_name: Name of the service.

        Returns:
            ServiceHealthInfo with current metrics.
        """
        # Check cache
        if service_name in self._health_cache:
            cached, cache_time = self._health_cache[service_name]
            if time.time() - cache_time < HEALTH_CACHE_TTL:
                return cached

        # Try to fetch from VictoriaMetrics
        try:
            health = await self._fetch_service_health(service_name)
            self._health_cache[service_name] = (health, time.time())
            return health
        except Exception as e:
            logger.warning(
                f"Failed to fetch health for {service_name}, using mock data: {e}"
            )
            return self._get_mock_health_data(service_name)

    async def get_all_services_health(self) -> ServicesHealthResponse:
        """Get health information for all aSDLC services.

        Returns:
            ServicesHealthResponse with health for all 5 services.
        """
        services = []
        for service_name in sorted(VALID_SERVICES):
            health = await self.get_service_health(service_name)
            services.append(health)

        return ServicesHealthResponse(
            services=services,
            timestamp=datetime.now(timezone.utc),
        )

    async def get_service_sparkline(
        self, service_name: str, metric: str
    ) -> ServiceSparklineResponse:
        """Get 15-minute sparkline data for a service metric.

        Uses caching with 1 minute TTL. Falls back to mock data if
        VictoriaMetrics is unavailable.

        Args:
            service_name: Name of the service.
            metric: Metric type (cpu, memory, requests, latency).

        Returns:
            ServiceSparklineResponse with time series data.
        """
        cache_key = f"{service_name}:{metric}"

        # Check cache
        if cache_key in self._sparkline_cache:
            cached, cache_time = self._sparkline_cache[cache_key]
            if time.time() - cache_time < SPARKLINE_CACHE_TTL:
                return cached

        # Build query based on metric type
        label = SERVICE_POD_LABELS.get(service_name, f'app="{service_name}"')
        query_map = {
            "cpu": f'rate(process_cpu_seconds_total{{{label}}}[5m]) * 100',
            "memory": f'process_resident_memory_bytes{{{label}}} / 1024 / 1024',  # MB
            "requests": f'sum(rate(asdlc_http_requests_total{{{label}}}[5m]))',
            "latency": f'histogram_quantile(0.50, sum(rate(asdlc_http_request_duration_seconds_bucket{{{label}}}[5m])) by (le)) * 1000',
        }
        query = query_map.get(metric, query_map["cpu"])

        # Calculate time range (15 minutes)
        end = datetime.now(timezone.utc)
        start = end - timedelta(minutes=15)
        start_str = start.strftime("%Y-%m-%dT%H:%M:%SZ")
        end_str = end.strftime("%Y-%m-%dT%H:%M:%SZ")
        step = "1m"

        try:
            data = await self._query_range(query, start_str, end_str, step)
            data_points = self._parse_sparkline_data(data)

            response = ServiceSparklineResponse(
                service=service_name,
                metric=metric,
                data_points=data_points,
                interval=step,
                duration="15m",
            )
            self._sparkline_cache[cache_key] = (response, time.time())
            return response

        except Exception as e:
            logger.warning(
                f"Failed to fetch sparkline for {service_name}/{metric}, using mock data: {e}"
            )
            return self._get_mock_sparkline_data(service_name, metric)

    def _parse_sparkline_data(self, data: dict[str, Any]) -> list[SparklineDataPoint]:
        """Parse VictoriaMetrics range query response into sparkline data points.

        Args:
            data: VictoriaMetrics JSON response.

        Returns:
            List of SparklineDataPoint objects.
        """
        data_points = []
        results = data.get("data", {}).get("result", [])

        if results:
            values = results[0].get("values", [])
            for timestamp, value in values:
                try:
                    float_value = float(value) if value != "NaN" else 0.0
                    data_points.append(
                        SparklineDataPoint(
                            timestamp=int(timestamp),
                            value=round(float_value, 1),
                        )
                    )
                except (ValueError, TypeError):
                    continue

        return data_points

    def clear_cache(self) -> None:
        """Clear all cached data."""
        self._health_cache.clear()
        self._sparkline_cache.clear()


# Module-level service instance for convenience
_service_instance: ServiceHealthService | None = None


def get_service_health_service() -> ServiceHealthService:
    """Get the singleton service health service instance.

    Returns:
        ServiceHealthService instance.
    """
    global _service_instance
    if _service_instance is None:
        _service_instance = ServiceHealthService()
    return _service_instance
