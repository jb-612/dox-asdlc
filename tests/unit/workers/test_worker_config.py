"""Unit tests for worker configuration.

Tests the WorkerConfig dataclass and configuration loading.
"""

from __future__ import annotations

import os
import pytest

from src.workers.config import WorkerConfig


class TestWorkerConfig:
    """Tests for WorkerConfig dataclass."""

    def test_default_config(self):
        """WorkerConfig has sensible defaults."""
        config = WorkerConfig()

        assert config.pool_size == 4
        assert config.batch_size == 10
        assert config.event_timeout_seconds == 300
        assert config.shutdown_timeout_seconds == 30
        assert config.consumer_group == "development-handlers"
        assert config.consumer_name is not None

    def test_custom_config(self):
        """WorkerConfig accepts custom values."""
        config = WorkerConfig(
            pool_size=8,
            batch_size=20,
            event_timeout_seconds=600,
            shutdown_timeout_seconds=60,
            consumer_group="custom-group",
            consumer_name="custom-consumer",
        )

        assert config.pool_size == 8
        assert config.batch_size == 20
        assert config.event_timeout_seconds == 600
        assert config.shutdown_timeout_seconds == 60
        assert config.consumer_group == "custom-group"
        assert config.consumer_name == "custom-consumer"

    def test_from_env_defaults(self, monkeypatch):
        """WorkerConfig.from_env uses defaults when env vars not set."""
        # Clear any existing env vars
        for key in [
            "WORKER_POOL_SIZE",
            "WORKER_BATCH_SIZE",
            "WORKER_EVENT_TIMEOUT",
            "WORKER_SHUTDOWN_TIMEOUT",
            "WORKER_CONSUMER_GROUP",
            "WORKER_CONSUMER_NAME",
        ]:
            monkeypatch.delenv(key, raising=False)

        config = WorkerConfig.from_env()

        assert config.pool_size == 4
        assert config.batch_size == 10
        assert config.event_timeout_seconds == 300
        assert config.shutdown_timeout_seconds == 30

    def test_from_env_custom_values(self, monkeypatch):
        """WorkerConfig.from_env reads from environment variables."""
        monkeypatch.setenv("WORKER_POOL_SIZE", "16")
        monkeypatch.setenv("WORKER_BATCH_SIZE", "50")
        monkeypatch.setenv("WORKER_EVENT_TIMEOUT", "900")
        monkeypatch.setenv("WORKER_SHUTDOWN_TIMEOUT", "120")
        monkeypatch.setenv("WORKER_CONSUMER_GROUP", "env-group")
        monkeypatch.setenv("WORKER_CONSUMER_NAME", "env-consumer")

        config = WorkerConfig.from_env()

        assert config.pool_size == 16
        assert config.batch_size == 50
        assert config.event_timeout_seconds == 900
        assert config.shutdown_timeout_seconds == 120
        assert config.consumer_group == "env-group"
        assert config.consumer_name == "env-consumer"

    def test_pool_size_validates_positive(self):
        """WorkerConfig validates pool_size is positive."""
        with pytest.raises(ValueError, match="pool_size"):
            WorkerConfig(pool_size=0)

        with pytest.raises(ValueError, match="pool_size"):
            WorkerConfig(pool_size=-1)

    def test_batch_size_validates_positive(self):
        """WorkerConfig validates batch_size is positive."""
        with pytest.raises(ValueError, match="batch_size"):
            WorkerConfig(batch_size=0)

    def test_consumer_name_generated_if_not_provided(self):
        """WorkerConfig generates unique consumer name if not provided."""
        config1 = WorkerConfig()
        config2 = WorkerConfig()

        # Each should have a consumer name
        assert config1.consumer_name is not None
        assert config2.consumer_name is not None

        # Names should be unique
        assert config1.consumer_name != config2.consumer_name

    def test_config_immutable(self):
        """WorkerConfig is immutable (frozen dataclass)."""
        config = WorkerConfig()

        with pytest.raises(AttributeError):
            config.pool_size = 10


class TestGetWorkerConfig:
    """Tests for get_worker_config singleton function."""

    def test_returns_worker_config(self, monkeypatch):
        """get_worker_config returns a WorkerConfig instance."""
        from src.workers.config import get_worker_config, clear_worker_config_cache

        # Clear cache to ensure fresh config
        clear_worker_config_cache()

        config = get_worker_config()
        assert isinstance(config, WorkerConfig)

    def test_cached(self, monkeypatch):
        """get_worker_config returns cached instance."""
        from src.workers.config import get_worker_config, clear_worker_config_cache

        clear_worker_config_cache()

        config1 = get_worker_config()
        config2 = get_worker_config()

        assert config1 is config2
