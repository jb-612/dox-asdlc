"""Prometheus registry helpers for aSDLC services.

Provides helper functions for:
- Accessing the default Prometheus registry
- Creating custom registries for testing
- Initializing service info metrics
- Updating process metrics
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

from prometheus_client import REGISTRY, CollectorRegistry

from src.infrastructure.metrics.definitions import PROCESS_MEMORY_BYTES, SERVICE_INFO

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Try to import psutil, but make it optional
try:
    import psutil
except ImportError:
    psutil = None  # type: ignore[assignment]
    logger.warning("psutil not available, process metrics will be disabled")


def get_metrics_registry() -> CollectorRegistry:
    """Get the default Prometheus metrics registry.

    Returns:
        CollectorRegistry: The default Prometheus registry.
    """
    return REGISTRY


def create_custom_registry() -> CollectorRegistry:
    """Create a new custom CollectorRegistry.

    Useful for testing or isolated metric collection.

    Returns:
        CollectorRegistry: A new registry instance.
    """
    return CollectorRegistry()


def initialize_service_info(
    service_name: str,
    version: str = "0.1.0",
    git_sha: str | None = None,
) -> None:
    """Initialize the service info metric.

    Sets static labels for the service including name, version, and build info.

    Args:
        service_name: Name of the service (e.g., "orchestrator", "workers").
        version: Service version string.
        git_sha: Optional git commit SHA for build tracking.
    """
    info_labels = {
        "service": service_name,
        "version": version,
        "git_sha": git_sha or os.getenv("GIT_SHA", "unknown"),
    }

    SERVICE_INFO.info(info_labels)
    logger.debug(f"Initialized service info: {info_labels}")


def update_process_metrics(service_name: str) -> None:
    """Update process resource metrics.

    Collects current memory usage and updates the corresponding gauges.
    Safe to call periodically or on-demand.

    Args:
        service_name: Name of the service for labeling metrics.
    """
    if psutil is None:
        logger.debug("psutil not available, skipping process metrics update")
        return

    try:
        process = psutil.Process()
        memory_info = process.memory_info()

        # Update memory gauges
        PROCESS_MEMORY_BYTES.labels(service=service_name, type="rss").set(
            memory_info.rss
        )
        PROCESS_MEMORY_BYTES.labels(service=service_name, type="vms").set(
            memory_info.vms
        )

        logger.debug(
            f"Updated process metrics: rss={memory_info.rss}, vms={memory_info.vms}"
        )
    except Exception as e:
        logger.warning(f"Failed to update process metrics: {e}")


__all__ = [
    "get_metrics_registry",
    "create_custom_registry",
    "initialize_service_info",
    "update_process_metrics",
]
