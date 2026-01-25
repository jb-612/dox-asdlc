"""Health check endpoints for aSDLC services.

Provides standardized health check responses with dependency status.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from http import HTTPStatus
from typing import Any

from src.core.config import get_config, get_redis_config
from src.core.redis_client import check_redis_health, ping_redis

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Health check status values."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class DependencyHealth:
    """Health status of a service dependency."""

    name: str
    status: HealthStatus
    latency_ms: float | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthResponse:
    """Standardized health check response."""

    status: HealthStatus
    service: str
    timestamp: str
    uptime_seconds: float
    dependencies: list[DependencyHealth] = field(default_factory=list)
    version: str = "0.1.0"
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "status": self.status.value,
            "service": self.service,
            "timestamp": self.timestamp,
            "uptime_seconds": self.uptime_seconds,
            "version": self.version,
            "dependencies": [
                {
                    "name": d.name,
                    "status": d.status.value,
                    "latency_ms": d.latency_ms,
                    "details": d.details,
                }
                for d in self.dependencies
            ],
            "details": self.details,
        }

    def http_status_code(self) -> int:
        """Get appropriate HTTP status code for health status."""
        if self.status == HealthStatus.HEALTHY:
            return HTTPStatus.OK
        elif self.status == HealthStatus.DEGRADED:
            return HTTPStatus.OK  # Still serving, but with warnings
        else:
            return HTTPStatus.SERVICE_UNAVAILABLE


class HealthChecker:
    """Health checker for aSDLC services.

    Tracks uptime and checks dependency health.
    """

    def __init__(self, service_name: str) -> None:
        """Initialize health checker.

        Args:
            service_name: Name of the service for health reports.
        """
        self.service_name = service_name
        self._start_time = datetime.utcnow()

    @property
    def uptime_seconds(self) -> float:
        """Get service uptime in seconds."""
        return (datetime.utcnow() - self._start_time).total_seconds()

    async def check_redis_dependency(self) -> DependencyHealth:
        """Check Redis dependency health.

        Returns:
            DependencyHealth: Redis health status with latency.
        """
        start_time = asyncio.get_event_loop().time()

        try:
            health = await check_redis_health()
            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000

            if health.get("status") == "healthy":
                return DependencyHealth(
                    name="redis",
                    status=HealthStatus.HEALTHY,
                    latency_ms=round(latency_ms, 2),
                    details={
                        "host": health.get("host"),
                        "port": health.get("port"),
                        "server_version": health.get("server_version"),
                    },
                )
            else:
                return DependencyHealth(
                    name="redis",
                    status=HealthStatus.UNHEALTHY,
                    latency_ms=round(latency_ms, 2),
                    details={"error": health.get("error", "Unknown error")},
                )
        except Exception as e:
            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            logger.warning(f"Redis health check failed: {e}")
            return DependencyHealth(
                name="redis",
                status=HealthStatus.UNHEALTHY,
                latency_ms=round(latency_ms, 2),
                details={"error": str(e)},
            )

    async def check_knowledge_store_dependency(self) -> DependencyHealth:
        """Check KnowledgeStore dependency health.

        Returns:
            DependencyHealth: KnowledgeStore health status with latency.
        """
        start_time = asyncio.get_event_loop().time()

        try:
            from src.infrastructure.knowledge_store.factory import (
                get_knowledge_store,
            )

            store = get_knowledge_store()
            health = await store.health_check()
            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000

            if health.get("status") == "healthy":
                return DependencyHealth(
                    name="knowledge_store",
                    status=HealthStatus.HEALTHY,
                    latency_ms=round(latency_ms, 2),
                    details={
                        "backend": health.get("backend"),
                        "host": health.get("host"),
                        "port": health.get("port"),
                        "collection": health.get("collection"),
                    },
                )
            else:
                return DependencyHealth(
                    name="knowledge_store",
                    status=HealthStatus.UNHEALTHY,
                    latency_ms=round(latency_ms, 2),
                    details={"error": health.get("error", "Unknown error")},
                )
        except Exception as e:
            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            logger.warning(f"KnowledgeStore health check failed: {e}")
            return DependencyHealth(
                name="knowledge_store",
                status=HealthStatus.UNHEALTHY,
                latency_ms=round(latency_ms, 2),
                details={"error": str(e)},
            )

    async def check_health(
        self,
        include_dependencies: bool = True,
        include_knowledge_store: bool = False,
    ) -> HealthResponse:
        """Perform full health check.

        Args:
            include_dependencies: Whether to check dependency health.
            include_knowledge_store: Whether to include KnowledgeStore check.

        Returns:
            HealthResponse: Complete health status.
        """
        dependencies: list[DependencyHealth] = []

        if include_dependencies:
            # Check Redis
            redis_health = await self.check_redis_dependency()
            dependencies.append(redis_health)

            # Check KnowledgeStore if requested
            if include_knowledge_store:
                ks_health = await self.check_knowledge_store_dependency()
                dependencies.append(ks_health)

        # Determine overall status based on dependencies
        overall_status = HealthStatus.HEALTHY
        for dep in dependencies:
            if dep.status == HealthStatus.UNHEALTHY:
                overall_status = HealthStatus.UNHEALTHY
                break
            elif dep.status == HealthStatus.DEGRADED:
                overall_status = HealthStatus.DEGRADED

        return HealthResponse(
            status=overall_status,
            service=self.service_name,
            timestamp=datetime.utcnow().isoformat(),
            uptime_seconds=round(self.uptime_seconds, 2),
            dependencies=dependencies,
        )

    def check_redis_sync(self) -> bool:
        """Synchronously check if Redis is healthy.

        Used by Prometheus collectors that need synchronous access.

        Returns:
            bool: True if Redis is healthy, False otherwise.
        """
        try:
            # Run the async health check in a new event loop
            loop = asyncio.new_event_loop()
            try:
                health = loop.run_until_complete(check_redis_health())
                return health.get("status") == "healthy"
            finally:
                loop.close()
        except Exception as e:
            logger.warning(f"Redis sync health check failed: {e}")
            return False

    async def check_liveness(self) -> HealthResponse:
        """Perform basic liveness check.

        Does not check dependencies - just verifies the service is running.

        Returns:
            HealthResponse: Basic health status.
        """
        return HealthResponse(
            status=HealthStatus.HEALTHY,
            service=self.service_name,
            timestamp=datetime.utcnow().isoformat(),
            uptime_seconds=round(self.uptime_seconds, 2),
            dependencies=[],
        )


# Singleton health checker instance
_health_checker: HealthChecker | None = None


def get_health_checker(service_name: str | None = None) -> HealthChecker:
    """Get or create the health checker singleton.

    Args:
        service_name: Service name. Uses config if not provided.

    Returns:
        HealthChecker: The health checker instance.
    """
    global _health_checker

    if _health_checker is None:
        if service_name is None:
            try:
                config = get_config()
                service_name = config.service.name
            except Exception:
                service_name = "unknown"
        _health_checker = HealthChecker(service_name)

    return _health_checker


async def health_check_handler() -> tuple[dict[str, Any], int]:
    """Handler for health check endpoint.

    Returns:
        tuple: (response_dict, http_status_code)
    """
    checker = get_health_checker()
    response = await checker.check_health()
    return response.to_dict(), response.http_status_code()


async def liveness_check_handler() -> tuple[dict[str, Any], int]:
    """Handler for liveness check endpoint (Kubernetes-style).

    Returns:
        tuple: (response_dict, http_status_code)
    """
    checker = get_health_checker()
    response = await checker.check_liveness()
    return response.to_dict(), response.http_status_code()


async def readiness_check_handler() -> tuple[dict[str, Any], int]:
    """Handler for readiness check endpoint (Kubernetes-style).

    Includes dependency checks to determine if service is ready.

    Returns:
        tuple: (response_dict, http_status_code)
    """
    checker = get_health_checker()
    response = await checker.check_health(include_dependencies=True)
    return response.to_dict(), response.http_status_code()
