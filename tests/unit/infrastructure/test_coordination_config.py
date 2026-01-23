"""Tests for coordination configuration."""

import os
from unittest.mock import patch

import pytest

from src.infrastructure.coordination.config import (
    CoordinationConfig,
    get_coordination_config,
    reset_coordination_config,
)


class TestCoordinationConfigDefaults:
    """Tests for default configuration values."""

    def test_default_redis_host(self) -> None:
        """Test default Redis host."""
        config = CoordinationConfig()
        assert config.redis_host == "localhost"

    def test_default_redis_port(self) -> None:
        """Test default Redis port."""
        config = CoordinationConfig()
        assert config.redis_port == 6379

    def test_default_redis_db(self) -> None:
        """Test default Redis database."""
        config = CoordinationConfig()
        assert config.redis_db == 0

    def test_default_key_prefix(self) -> None:
        """Test default key prefix."""
        config = CoordinationConfig()
        assert config.key_prefix == "coord"

    def test_default_message_ttl(self) -> None:
        """Test default message TTL."""
        config = CoordinationConfig()
        assert config.message_ttl_days == 30

    def test_default_presence_timeout(self) -> None:
        """Test default presence timeout."""
        config = CoordinationConfig()
        assert config.presence_timeout_minutes == 5

    def test_default_timeline_max_size(self) -> None:
        """Test default timeline max size."""
        config = CoordinationConfig()
        assert config.timeline_max_size == 1000


class TestCoordinationConfigFromEnv:
    """Tests for loading configuration from environment variables."""

    def test_from_env_redis_host(self) -> None:
        """Test loading Redis host from environment."""
        with patch.dict(os.environ, {"REDIS_HOST": "redis.example.com"}):
            config = CoordinationConfig.from_env()
            assert config.redis_host == "redis.example.com"

    def test_from_env_redis_port(self) -> None:
        """Test loading Redis port from environment."""
        with patch.dict(os.environ, {"REDIS_PORT": "6380"}):
            config = CoordinationConfig.from_env()
            assert config.redis_port == 6380

    def test_from_env_redis_db(self) -> None:
        """Test loading Redis database from environment."""
        with patch.dict(os.environ, {"REDIS_DB": "5"}):
            config = CoordinationConfig.from_env()
            assert config.redis_db == 5

    def test_from_env_key_prefix(self) -> None:
        """Test loading key prefix from environment."""
        with patch.dict(os.environ, {"COORD_KEY_PREFIX": "myapp"}):
            config = CoordinationConfig.from_env()
            assert config.key_prefix == "myapp"

    def test_from_env_message_ttl(self) -> None:
        """Test loading message TTL from environment."""
        with patch.dict(os.environ, {"COORD_MESSAGE_TTL_DAYS": "7"}):
            config = CoordinationConfig.from_env()
            assert config.message_ttl_days == 7

    def test_from_env_presence_timeout(self) -> None:
        """Test loading presence timeout from environment."""
        with patch.dict(os.environ, {"COORD_PRESENCE_TIMEOUT_MINUTES": "10"}):
            config = CoordinationConfig.from_env()
            assert config.presence_timeout_minutes == 10

    def test_from_env_uses_defaults_when_not_set(self) -> None:
        """Test that defaults are used when env vars not set."""
        with patch.dict(os.environ, {}, clear=True):
            # Remove any existing env vars
            for key in ["REDIS_HOST", "REDIS_PORT", "COORD_KEY_PREFIX"]:
                os.environ.pop(key, None)

            config = CoordinationConfig.from_env()
            assert config.redis_host == "localhost"
            assert config.redis_port == 6379


class TestCoordinationConfigKeyGeneration:
    """Tests for Redis key generation methods."""

    @pytest.fixture
    def config(self) -> CoordinationConfig:
        """Create test configuration."""
        return CoordinationConfig(key_prefix="test")

    def test_message_key(self, config: CoordinationConfig) -> None:
        """Test message key generation."""
        key = config.message_key("msg-abc123")
        assert key == "test:msg:msg-abc123"

    def test_inbox_key(self, config: CoordinationConfig) -> None:
        """Test inbox key generation."""
        key = config.inbox_key("backend")
        assert key == "test:inbox:backend"

    def test_timeline_key(self, config: CoordinationConfig) -> None:
        """Test timeline key generation."""
        key = config.timeline_key()
        assert key == "test:timeline"

    def test_pending_key(self, config: CoordinationConfig) -> None:
        """Test pending key generation."""
        key = config.pending_key()
        assert key == "test:pending"

    def test_presence_key(self, config: CoordinationConfig) -> None:
        """Test presence key generation."""
        key = config.presence_key()
        assert key == "test:presence"

    def test_instance_channel(self, config: CoordinationConfig) -> None:
        """Test instance channel generation."""
        channel = config.instance_channel("frontend")
        assert channel == "test:notify:frontend"

    def test_broadcast_channel(self, config: CoordinationConfig) -> None:
        """Test broadcast channel generation."""
        channel = config.broadcast_channel()
        assert channel == "test:notify:all"

    def test_notification_queue_key(self, config: CoordinationConfig) -> None:
        """Test notification queue key generation."""
        key = config.notification_queue_key("backend")
        assert key == "test:notifications:backend"

    def test_notification_queue_key_different_instances(
        self, config: CoordinationConfig
    ) -> None:
        """Test notification queue keys are unique per instance."""
        key1 = config.notification_queue_key("backend")
        key2 = config.notification_queue_key("frontend")
        key3 = config.notification_queue_key("orchestrator")

        assert key1 != key2 != key3
        assert "backend" in key1
        assert "frontend" in key2
        assert "orchestrator" in key3


class TestCoordinationConfigTTL:
    """Tests for TTL calculations."""

    def test_message_ttl_seconds_30_days(self) -> None:
        """Test TTL calculation for 30 days."""
        config = CoordinationConfig(message_ttl_days=30)
        expected = 30 * 24 * 60 * 60  # 2592000 seconds
        assert config.message_ttl_seconds == expected

    def test_message_ttl_seconds_7_days(self) -> None:
        """Test TTL calculation for 7 days."""
        config = CoordinationConfig(message_ttl_days=7)
        expected = 7 * 24 * 60 * 60  # 604800 seconds
        assert config.message_ttl_seconds == expected

    def test_message_ttl_seconds_1_day(self) -> None:
        """Test TTL calculation for 1 day."""
        config = CoordinationConfig(message_ttl_days=1)
        assert config.message_ttl_seconds == 86400


class TestGlobalConfig:
    """Tests for global configuration functions."""

    def setup_method(self) -> None:
        """Reset config before each test."""
        reset_coordination_config()

    def teardown_method(self) -> None:
        """Reset config after each test."""
        reset_coordination_config()

    def test_get_coordination_config_returns_config(self) -> None:
        """Test that get_coordination_config returns a config."""
        config = get_coordination_config()
        assert isinstance(config, CoordinationConfig)

    def test_get_coordination_config_returns_same_instance(self) -> None:
        """Test that config is cached (singleton)."""
        config1 = get_coordination_config()
        config2 = get_coordination_config()
        assert config1 is config2

    def test_reset_coordination_config_clears_cache(self) -> None:
        """Test that reset clears the cached config."""
        config1 = get_coordination_config()
        reset_coordination_config()

        with patch.dict(os.environ, {"COORD_KEY_PREFIX": "newprefix"}):
            config2 = get_coordination_config()
            assert config2.key_prefix == "newprefix"
            assert config1 is not config2


class TestCoordinationConfigImmutability:
    """Tests for configuration immutability."""

    def test_config_is_frozen(self) -> None:
        """Test that config is immutable."""
        config = CoordinationConfig()

        with pytest.raises(AttributeError):
            config.redis_host = "new_host"  # type: ignore

    def test_config_is_hashable(self) -> None:
        """Test that frozen config is hashable."""
        config = CoordinationConfig()
        # Should not raise
        hash(config)
