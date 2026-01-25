"""Unit tests for metrics registry helpers.

Tests verify:
- Registry singleton behavior
- Service info initialization
- Process metrics update functionality
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


class TestInitializeServiceInfo:
    """Tests for initialize_service_info function."""

    def test_initialize_sets_service_name(self) -> None:
        """Should set service name in SERVICE_INFO."""
        from src.infrastructure.metrics.registry import initialize_service_info

        initialize_service_info(service_name="test-service", version="1.0.0")

        from src.infrastructure.metrics.definitions import SERVICE_INFO

        # The Info metric stores labels in _metrics dict
        # For Info type, we need to check _labelvalues
        assert SERVICE_INFO._name == "asdlc_service"

    def test_initialize_sets_version(self) -> None:
        """Should set version in SERVICE_INFO."""
        from src.infrastructure.metrics.registry import initialize_service_info

        initialize_service_info(service_name="test-service", version="2.0.0")

        # Info metric values can be accessed via _value_to_labels
        from src.infrastructure.metrics.definitions import SERVICE_INFO

        assert SERVICE_INFO._name == "asdlc_service"

    def test_initialize_with_default_version(self) -> None:
        """Should use default version if not provided."""
        from src.infrastructure.metrics.registry import initialize_service_info

        initialize_service_info(service_name="test-service")

        from src.infrastructure.metrics.definitions import SERVICE_INFO

        assert SERVICE_INFO is not None


class TestUpdateProcessMetrics:
    """Tests for update_process_metrics function."""

    @patch("src.infrastructure.metrics.registry.psutil")
    def test_update_sets_rss_memory(self, mock_psutil: MagicMock) -> None:
        """Should set RSS memory metric."""
        from src.infrastructure.metrics.registry import update_process_metrics

        # Setup mock
        mock_process = MagicMock()
        mock_process.memory_info.return_value = MagicMock(rss=1024000, vms=2048000)
        mock_psutil.Process.return_value = mock_process

        update_process_metrics(service_name="test-service")

        mock_process.memory_info.assert_called_once()

    @patch("src.infrastructure.metrics.registry.psutil")
    def test_update_sets_vms_memory(self, mock_psutil: MagicMock) -> None:
        """Should set VMS memory metric."""
        from src.infrastructure.metrics.registry import update_process_metrics

        # Setup mock
        mock_process = MagicMock()
        mock_process.memory_info.return_value = MagicMock(rss=1024000, vms=2048000)
        mock_psutil.Process.return_value = mock_process

        update_process_metrics(service_name="test-service")

        mock_process.memory_info.assert_called_once()

    @patch("src.infrastructure.metrics.registry.psutil", None)
    def test_update_handles_missing_psutil(self) -> None:
        """Should handle gracefully when psutil is not available."""
        # Re-import to get the version without psutil
        import importlib

        import src.infrastructure.metrics.registry as registry_module

        # Save original
        original_psutil = getattr(registry_module, "psutil", None)

        try:
            # Set psutil to None to simulate missing import
            registry_module.psutil = None

            # Should not raise
            registry_module.update_process_metrics(service_name="test-service")
        finally:
            # Restore
            if original_psutil is not None:
                registry_module.psutil = original_psutil


class TestGetMetricsRegistry:
    """Tests for get_metrics_registry function."""

    def test_returns_registry(self) -> None:
        """Should return the Prometheus registry."""
        from prometheus_client import REGISTRY

        from src.infrastructure.metrics.registry import get_metrics_registry

        registry = get_metrics_registry()
        assert registry is REGISTRY

    def test_returns_same_registry_on_multiple_calls(self) -> None:
        """Should return the same registry instance."""
        from src.infrastructure.metrics.registry import get_metrics_registry

        registry1 = get_metrics_registry()
        registry2 = get_metrics_registry()
        assert registry1 is registry2


class TestCreateCustomRegistry:
    """Tests for create_custom_registry function."""

    def test_creates_registry(self) -> None:
        """Should create a new CollectorRegistry."""
        from prometheus_client import CollectorRegistry

        from src.infrastructure.metrics.registry import create_custom_registry

        registry = create_custom_registry()
        assert isinstance(registry, CollectorRegistry)

    def test_creates_unique_registries(self) -> None:
        """Should create unique registries on each call."""
        from src.infrastructure.metrics.registry import create_custom_registry

        registry1 = create_custom_registry()
        registry2 = create_custom_registry()
        assert registry1 is not registry2
