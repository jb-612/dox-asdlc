"""Custom Prometheus collectors for aSDLC services.

Provides collectors for:
- Redis connection health
- Worker pool statistics
- Process resource metrics

These collectors implement the Prometheus Collector interface and are
registered with the default registry to provide on-demand metric collection.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Iterator, Protocol

from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import Collector

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Try to import psutil, but make it optional
try:
    import psutil
except ImportError:
    psutil = None  # type: ignore[assignment]
    logger.warning("psutil not available, ProcessMetricsCollector will be disabled")


class HealthCheckerProtocol(Protocol):
    """Protocol for health checker objects."""

    def check_redis_sync(self) -> bool:
        """Synchronously check Redis connection health.

        Returns:
            bool: True if Redis is healthy, False otherwise.
        """
        ...


class WorkerPoolProtocol(Protocol):
    """Protocol for worker pool objects."""

    def get_stats(self) -> dict[str, Any]:
        """Get worker pool statistics.

        Returns:
            dict: Statistics including active_workers, events_succeeded, events_failed.
        """
        ...


class RedisMetricsCollector(Collector):
    """Collector for Redis connection health metrics.

    Checks Redis health on each scrape and reports the connection status
    as a gauge metric (1=up, 0=down).

    Example:
        from prometheus_client import REGISTRY

        health_checker = get_health_checker("orchestrator")
        collector = RedisMetricsCollector("orchestrator", health_checker)
        REGISTRY.register(collector)
    """

    def __init__(
        self,
        service_name: str,
        health_checker: HealthCheckerProtocol,
    ) -> None:
        """Initialize the Redis metrics collector.

        Args:
            service_name: Name of the service for metric labels.
            health_checker: Object with check_redis_sync() method.
        """
        self.service_name = service_name
        self.health_checker = health_checker

    def collect(self) -> Iterator[GaugeMetricFamily]:
        """Collect Redis connection metrics.

        Yields:
            GaugeMetricFamily: Redis connection status metric.
        """
        try:
            is_healthy = self.health_checker.check_redis_sync()
            status = 1 if is_healthy else 0
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            status = 0

        gauge = GaugeMetricFamily(
            "asdlc_redis_connection_up",
            "Redis connection status (1=up, 0=down)",
            labels=["service"],
        )
        gauge.add_metric([self.service_name], status)
        yield gauge


class WorkerPoolCollector(Collector):
    """Collector for worker pool statistics.

    Collects active worker count and processed event counts from the
    worker pool on each scrape.

    Example:
        from prometheus_client import REGISTRY

        pool = WorkerPool(...)
        collector = WorkerPoolCollector("workers", pool)
        REGISTRY.register(collector)
    """

    def __init__(
        self,
        service_name: str,
        worker_pool: WorkerPoolProtocol,
    ) -> None:
        """Initialize the worker pool metrics collector.

        Args:
            service_name: Name of the service for metric labels.
            worker_pool: Worker pool with get_stats() method.
        """
        self.service_name = service_name
        self.worker_pool = worker_pool

    def collect(self) -> Iterator[GaugeMetricFamily]:
        """Collect worker pool metrics.

        Yields:
            GaugeMetricFamily: Active workers and events processed metrics.
        """
        try:
            stats = self.worker_pool.get_stats()
        except Exception as e:
            logger.warning(f"Failed to get worker pool stats: {e}")
            return

        # Active workers gauge
        active_workers = GaugeMetricFamily(
            "asdlc_active_workers",
            "Number of active worker threads",
            labels=["service"],
        )
        active_workers.add_metric(
            [self.service_name],
            stats.get("active_workers", 0),
        )
        yield active_workers

        # Events processed counter (as gauge for collector pattern)
        events_processed = GaugeMetricFamily(
            "asdlc_events_processed_total",
            "Total number of events processed",
            labels=["service", "status"],
        )
        events_processed.add_metric(
            [self.service_name, "success"],
            stats.get("events_succeeded", 0),
        )
        events_processed.add_metric(
            [self.service_name, "failed"],
            stats.get("events_failed", 0),
        )
        yield events_processed


class ProcessMetricsCollector(Collector):
    """Collector for process resource metrics.

    Collects memory usage (RSS and VMS) for the current process.
    Requires psutil to be available.

    Example:
        from prometheus_client import REGISTRY

        collector = ProcessMetricsCollector("orchestrator")
        REGISTRY.register(collector)
    """

    def __init__(self, service_name: str) -> None:
        """Initialize the process metrics collector.

        Args:
            service_name: Name of the service for metric labels.
        """
        self.service_name = service_name

    def collect(self) -> Iterator[GaugeMetricFamily]:
        """Collect process resource metrics.

        Yields:
            GaugeMetricFamily: Process memory usage metrics.
        """
        if psutil is None:
            logger.debug("psutil not available, skipping process metrics")
            return

        try:
            process = psutil.Process()
            memory_info = process.memory_info()
        except Exception as e:
            logger.warning(f"Failed to get process metrics: {e}")
            return

        # Memory usage gauge
        memory = GaugeMetricFamily(
            "asdlc_process_memory_bytes",
            "Process memory usage in bytes",
            labels=["service", "type"],
        )
        memory.add_metric([self.service_name, "rss"], memory_info.rss)
        memory.add_metric([self.service_name, "vms"], memory_info.vms)
        yield memory


__all__ = [
    "RedisMetricsCollector",
    "WorkerPoolCollector",
    "ProcessMetricsCollector",
    "HealthCheckerProtocol",
    "WorkerPoolProtocol",
]
