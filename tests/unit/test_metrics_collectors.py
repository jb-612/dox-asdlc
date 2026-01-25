"""Unit tests for Prometheus custom collectors.

Tests verify:
- RedisMetricsCollector yields correct metrics
- WorkerPoolCollector collects pool stats
- ProcessMetricsCollector collects memory info
- Error handling in collectors
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from prometheus_client.core import GaugeMetricFamily


class TestRedisMetricsCollector:
    """Tests for RedisMetricsCollector class."""

    def test_accepts_service_name_and_health_checker(self) -> None:
        """Should accept service_name and health_checker in constructor."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        collector = RedisMetricsCollector(
            service_name="test-service",
            health_checker=health_checker,
        )

        assert collector.service_name == "test-service"
        assert collector.health_checker is health_checker

    def test_collect_yields_gauge_metric_family(self) -> None:
        """Should yield GaugeMetricFamily from collect()."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        health_checker.check_redis_sync.return_value = True

        collector = RedisMetricsCollector(
            service_name="test-service",
            health_checker=health_checker,
        )

        metrics = list(collector.collect())

        assert len(metrics) == 1
        assert isinstance(metrics[0], GaugeMetricFamily)

    def test_collect_returns_1_when_redis_healthy(self) -> None:
        """Should return 1 when Redis is healthy."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        health_checker.check_redis_sync.return_value = True

        collector = RedisMetricsCollector(
            service_name="test-service",
            health_checker=health_checker,
        )

        metrics = list(collector.collect())
        gauge = metrics[0]

        # Check the metric value
        samples = list(gauge.samples)
        assert len(samples) == 1
        assert samples[0].value == 1

    def test_collect_returns_0_when_redis_unhealthy(self) -> None:
        """Should return 0 when Redis is unhealthy."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        health_checker.check_redis_sync.return_value = False

        collector = RedisMetricsCollector(
            service_name="test-service",
            health_checker=health_checker,
        )

        metrics = list(collector.collect())
        gauge = metrics[0]

        samples = list(gauge.samples)
        assert samples[0].value == 0

    def test_collect_returns_0_on_health_check_exception(self) -> None:
        """Should return 0 when health check raises exception."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        health_checker.check_redis_sync.side_effect = Exception("Connection error")

        collector = RedisMetricsCollector(
            service_name="test-service",
            health_checker=health_checker,
        )

        metrics = list(collector.collect())
        gauge = metrics[0]

        samples = list(gauge.samples)
        assert samples[0].value == 0

    def test_collect_includes_service_label(self) -> None:
        """Should include service label in metric."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        health_checker.check_redis_sync.return_value = True

        collector = RedisMetricsCollector(
            service_name="my-service",
            health_checker=health_checker,
        )

        metrics = list(collector.collect())
        gauge = metrics[0]

        samples = list(gauge.samples)
        assert samples[0].labels == {"service": "my-service"}


class TestWorkerPoolCollector:
    """Tests for WorkerPoolCollector class."""

    def test_accepts_service_name_and_worker_pool(self) -> None:
        """Should accept service_name and worker_pool in constructor."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        collector = WorkerPoolCollector(
            service_name="test-service",
            worker_pool=worker_pool,
        )

        assert collector.service_name == "test-service"
        assert collector.worker_pool is worker_pool

    def test_collect_yields_active_workers_gauge(self) -> None:
        """Should yield active_workers gauge from collect()."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        worker_pool.get_stats.return_value = {
            "active_workers": 5,
            "events_succeeded": 100,
            "events_failed": 2,
        }

        collector = WorkerPoolCollector(
            service_name="test-service",
            worker_pool=worker_pool,
        )

        metrics = list(collector.collect())

        # Should have at least the active_workers metric
        metric_names = [m.name for m in metrics]
        assert "asdlc_active_workers" in metric_names

    def test_collect_yields_events_processed_counter(self) -> None:
        """Should yield events_processed counter from collect()."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        worker_pool.get_stats.return_value = {
            "active_workers": 5,
            "events_succeeded": 100,
            "events_failed": 2,
        }

        collector = WorkerPoolCollector(
            service_name="test-service",
            worker_pool=worker_pool,
        )

        metrics = list(collector.collect())

        metric_names = [m.name for m in metrics]
        assert "asdlc_events_processed_total" in metric_names

    def test_collect_includes_correct_worker_count(self) -> None:
        """Should include correct active worker count."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        worker_pool.get_stats.return_value = {
            "active_workers": 7,
            "events_succeeded": 100,
            "events_failed": 2,
        }

        collector = WorkerPoolCollector(
            service_name="test-service",
            worker_pool=worker_pool,
        )

        metrics = list(collector.collect())

        # Find the active_workers metric
        active_workers = next(m for m in metrics if m.name == "asdlc_active_workers")
        samples = list(active_workers.samples)
        assert samples[0].value == 7

    def test_collect_includes_success_and_failed_counts(self) -> None:
        """Should include both success and failed event counts."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        worker_pool.get_stats.return_value = {
            "active_workers": 5,
            "events_succeeded": 150,
            "events_failed": 5,
        }

        collector = WorkerPoolCollector(
            service_name="test-service",
            worker_pool=worker_pool,
        )

        metrics = list(collector.collect())

        # Find the events_processed metric
        events = next(m for m in metrics if m.name == "asdlc_events_processed_total")
        samples = list(events.samples)

        # Should have samples for both success and failed
        sample_by_status = {s.labels["status"]: s.value for s in samples}
        assert sample_by_status["success"] == 150
        assert sample_by_status["failed"] == 5

    def test_collect_handles_get_stats_exception(self) -> None:
        """Should handle gracefully when get_stats raises exception."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        worker_pool.get_stats.side_effect = Exception("Pool error")

        collector = WorkerPoolCollector(
            service_name="test-service",
            worker_pool=worker_pool,
        )

        # Should not raise, but return empty or zero metrics
        metrics = list(collector.collect())
        assert isinstance(metrics, list)


class TestProcessMetricsCollector:
    """Tests for ProcessMetricsCollector class."""

    def test_accepts_service_name(self) -> None:
        """Should accept service_name in constructor."""
        from src.infrastructure.metrics.collectors import ProcessMetricsCollector

        collector = ProcessMetricsCollector(service_name="test-service")

        assert collector.service_name == "test-service"

    @patch("src.infrastructure.metrics.collectors.psutil")
    def test_collect_yields_memory_gauge(self, mock_psutil: MagicMock) -> None:
        """Should yield memory gauge from collect()."""
        from src.infrastructure.metrics.collectors import ProcessMetricsCollector

        mock_process = MagicMock()
        mock_process.memory_info.return_value = MagicMock(rss=1024000, vms=2048000)
        mock_psutil.Process.return_value = mock_process

        collector = ProcessMetricsCollector(service_name="test-service")

        metrics = list(collector.collect())

        metric_names = [m.name for m in metrics]
        assert "asdlc_process_memory_bytes" in metric_names

    @patch("src.infrastructure.metrics.collectors.psutil")
    def test_collect_includes_rss_and_vms(self, mock_psutil: MagicMock) -> None:
        """Should include both RSS and VMS memory metrics."""
        from src.infrastructure.metrics.collectors import ProcessMetricsCollector

        mock_process = MagicMock()
        mock_process.memory_info.return_value = MagicMock(rss=1024000, vms=2048000)
        mock_psutil.Process.return_value = mock_process

        collector = ProcessMetricsCollector(service_name="test-service")

        metrics = list(collector.collect())

        # Find the memory metric
        memory = next(m for m in metrics if m.name == "asdlc_process_memory_bytes")
        samples = list(memory.samples)

        sample_by_type = {s.labels["type"]: s.value for s in samples}
        assert sample_by_type["rss"] == 1024000
        assert sample_by_type["vms"] == 2048000

    @patch("src.infrastructure.metrics.collectors.psutil", None)
    def test_collect_handles_missing_psutil(self) -> None:
        """Should handle gracefully when psutil is not available."""
        # Re-import to get version without psutil
        import importlib

        import src.infrastructure.metrics.collectors as collectors_module

        original_psutil = getattr(collectors_module, "psutil", None)

        try:
            collectors_module.psutil = None

            collector = collectors_module.ProcessMetricsCollector(
                service_name="test-service"
            )

            # Should not raise, returns empty list
            metrics = list(collector.collect())
            assert metrics == []
        finally:
            if original_psutil is not None:
                collectors_module.psutil = original_psutil

    @patch("src.infrastructure.metrics.collectors.psutil")
    def test_collect_handles_process_exception(self, mock_psutil: MagicMock) -> None:
        """Should handle gracefully when Process() raises exception."""
        from src.infrastructure.metrics.collectors import ProcessMetricsCollector

        mock_psutil.Process.side_effect = Exception("Process error")

        collector = ProcessMetricsCollector(service_name="test-service")

        # Should not raise
        metrics = list(collector.collect())
        assert metrics == []

    @patch("src.infrastructure.metrics.collectors.psutil")
    def test_collect_includes_service_label(self, mock_psutil: MagicMock) -> None:
        """Should include service label in metrics."""
        from src.infrastructure.metrics.collectors import ProcessMetricsCollector

        mock_process = MagicMock()
        mock_process.memory_info.return_value = MagicMock(rss=1024000, vms=2048000)
        mock_psutil.Process.return_value = mock_process

        collector = ProcessMetricsCollector(service_name="my-service")

        metrics = list(collector.collect())

        memory = next(m for m in metrics if m.name == "asdlc_process_memory_bytes")
        samples = list(memory.samples)

        for sample in samples:
            assert sample.labels["service"] == "my-service"


class TestCollectorRegistration:
    """Tests for collector registration with Prometheus registry."""

    def test_redis_collector_has_collect_method(self) -> None:
        """RedisMetricsCollector should have a collect method."""
        from src.infrastructure.metrics.collectors import RedisMetricsCollector

        health_checker = MagicMock()
        collector = RedisMetricsCollector(
            service_name="test", health_checker=health_checker
        )

        # Collectors must have a collect method that returns an iterable
        assert hasattr(collector, "collect")
        assert callable(collector.collect)

    def test_worker_pool_collector_has_collect_method(self) -> None:
        """WorkerPoolCollector should have a collect method."""
        from src.infrastructure.metrics.collectors import WorkerPoolCollector

        worker_pool = MagicMock()
        collector = WorkerPoolCollector(service_name="test", worker_pool=worker_pool)

        assert hasattr(collector, "collect")
        assert callable(collector.collect)

    def test_process_collector_has_collect_method(self) -> None:
        """ProcessMetricsCollector should have a collect method."""
        from src.infrastructure.metrics.collectors import ProcessMetricsCollector

        collector = ProcessMetricsCollector(service_name="test")

        assert hasattr(collector, "collect")
        assert callable(collector.collect)
