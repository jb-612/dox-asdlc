"""Unit tests for swarm configuration.

Tests for SwarmConfig Pydantic model and get_swarm_config factory function.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from src.workers.swarm.config import SwarmConfig, get_swarm_config


class TestSwarmConfig:
    """Tests for SwarmConfig model."""

    def test_swarm_config_defaults(self) -> None:
        """Test that SwarmConfig has correct default values."""
        config = SwarmConfig()

        assert config.task_timeout_seconds == 300
        assert config.aggregate_timeout_seconds == 60
        assert config.max_concurrent_swarms == 5
        assert config.default_reviewers == ["security", "performance", "style"]
        assert config.key_prefix == "swarm"
        assert config.result_ttl_seconds == 86400
        assert config.duplicate_similarity_threshold == 0.8
        assert config.allowed_path_prefixes == ["src/", "docker/", "tests/"]

    def test_swarm_config_custom_values(self) -> None:
        """Test creating SwarmConfig with custom values."""
        config = SwarmConfig(
            task_timeout_seconds=600,
            aggregate_timeout_seconds=120,
            max_concurrent_swarms=10,
            default_reviewers=["security", "style"],
            key_prefix="review_swarm",
            result_ttl_seconds=172800,
            duplicate_similarity_threshold=0.9,
            allowed_path_prefixes=["src/", "lib/"],
        )

        assert config.task_timeout_seconds == 600
        assert config.aggregate_timeout_seconds == 120
        assert config.max_concurrent_swarms == 10
        assert config.default_reviewers == ["security", "style"]
        assert config.key_prefix == "review_swarm"
        assert config.result_ttl_seconds == 172800
        assert config.duplicate_similarity_threshold == 0.9
        assert config.allowed_path_prefixes == ["src/", "lib/"]

    def test_swarm_config_task_timeout_validation(self) -> None:
        """Test that task_timeout_seconds must be positive."""
        with pytest.raises(ValueError):
            SwarmConfig(task_timeout_seconds=0)

        with pytest.raises(ValueError):
            SwarmConfig(task_timeout_seconds=-1)

    def test_swarm_config_aggregate_timeout_validation(self) -> None:
        """Test that aggregate_timeout_seconds must be positive."""
        with pytest.raises(ValueError):
            SwarmConfig(aggregate_timeout_seconds=0)

        with pytest.raises(ValueError):
            SwarmConfig(aggregate_timeout_seconds=-10)

    def test_swarm_config_max_concurrent_swarms_validation(self) -> None:
        """Test that max_concurrent_swarms must be positive."""
        with pytest.raises(ValueError):
            SwarmConfig(max_concurrent_swarms=0)

        with pytest.raises(ValueError):
            SwarmConfig(max_concurrent_swarms=-5)

    def test_swarm_config_result_ttl_validation(self) -> None:
        """Test that result_ttl_seconds must be positive."""
        with pytest.raises(ValueError):
            SwarmConfig(result_ttl_seconds=0)

        with pytest.raises(ValueError):
            SwarmConfig(result_ttl_seconds=-100)

    def test_swarm_config_duplicate_threshold_validation(self) -> None:
        """Test that duplicate_similarity_threshold must be between 0 and 1."""
        with pytest.raises(ValueError):
            SwarmConfig(duplicate_similarity_threshold=-0.1)

        with pytest.raises(ValueError):
            SwarmConfig(duplicate_similarity_threshold=1.5)

        # Boundary values should work
        config_zero = SwarmConfig(duplicate_similarity_threshold=0.0)
        assert config_zero.duplicate_similarity_threshold == 0.0

        config_one = SwarmConfig(duplicate_similarity_threshold=1.0)
        assert config_one.duplicate_similarity_threshold == 1.0

    def test_swarm_config_to_dict(self) -> None:
        """Test SwarmConfig serialization to dictionary."""
        config = SwarmConfig()
        data = config.model_dump()

        assert data["task_timeout_seconds"] == 300
        assert data["aggregate_timeout_seconds"] == 60
        assert data["max_concurrent_swarms"] == 5
        assert data["default_reviewers"] == ["security", "performance", "style"]
        assert data["key_prefix"] == "swarm"
        assert data["result_ttl_seconds"] == 86400
        assert data["duplicate_similarity_threshold"] == 0.8
        assert data["allowed_path_prefixes"] == ["src/", "docker/", "tests/"]

    def test_swarm_config_from_dict(self) -> None:
        """Test SwarmConfig deserialization from dictionary."""
        data = {
            "task_timeout_seconds": 450,
            "aggregate_timeout_seconds": 90,
            "max_concurrent_swarms": 8,
            "default_reviewers": ["security"],
            "key_prefix": "custom_swarm",
            "result_ttl_seconds": 43200,
            "duplicate_similarity_threshold": 0.75,
            "allowed_path_prefixes": ["src/"],
        }

        config = SwarmConfig.model_validate(data)

        assert config.task_timeout_seconds == 450
        assert config.aggregate_timeout_seconds == 90
        assert config.max_concurrent_swarms == 8
        assert config.default_reviewers == ["security"]
        assert config.key_prefix == "custom_swarm"

    def test_swarm_config_json_serialization(self) -> None:
        """Test SwarmConfig JSON round-trip."""
        original = SwarmConfig(
            task_timeout_seconds=500,
            max_concurrent_swarms=3,
        )

        json_str = original.model_dump_json()
        restored = SwarmConfig.model_validate_json(json_str)

        assert restored.task_timeout_seconds == 500
        assert restored.max_concurrent_swarms == 3
        assert restored.default_reviewers == original.default_reviewers


class TestGetSwarmConfig:
    """Tests for get_swarm_config factory function."""

    def test_get_swarm_config_defaults(self) -> None:
        """Test that get_swarm_config returns config with defaults when no env vars."""
        # Clear any existing SWARM_ environment variables
        env_vars_to_clear = [
            "SWARM_TASK_TIMEOUT_SECONDS",
            "SWARM_AGGREGATE_TIMEOUT_SECONDS",
            "SWARM_MAX_CONCURRENT_SWARMS",
            "SWARM_DEFAULT_REVIEWERS",
            "SWARM_KEY_PREFIX",
            "SWARM_RESULT_TTL_SECONDS",
            "SWARM_DUPLICATE_SIMILARITY_THRESHOLD",
            "SWARM_ALLOWED_PATH_PREFIXES",
        ]

        with patch.dict(os.environ, {}, clear=False):
            # Remove any existing swarm env vars
            for var in env_vars_to_clear:
                os.environ.pop(var, None)

            # Clear the lru_cache if exists
            get_swarm_config.cache_clear()

            config = get_swarm_config()

            assert config.task_timeout_seconds == 300
            assert config.aggregate_timeout_seconds == 60
            assert config.max_concurrent_swarms == 5

    def test_get_swarm_config_from_env_vars(self) -> None:
        """Test that get_swarm_config reads from SWARM_ prefixed env vars."""
        env_vars = {
            "SWARM_TASK_TIMEOUT_SECONDS": "600",
            "SWARM_AGGREGATE_TIMEOUT_SECONDS": "120",
            "SWARM_MAX_CONCURRENT_SWARMS": "10",
            "SWARM_DEFAULT_REVIEWERS": "security,performance",
            "SWARM_KEY_PREFIX": "custom_prefix",
            "SWARM_RESULT_TTL_SECONDS": "172800",
            "SWARM_DUPLICATE_SIMILARITY_THRESHOLD": "0.9",
            "SWARM_ALLOWED_PATH_PREFIXES": "src/,lib/,tests/",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            # Clear cache to force reload
            get_swarm_config.cache_clear()

            config = get_swarm_config()

            assert config.task_timeout_seconds == 600
            assert config.aggregate_timeout_seconds == 120
            assert config.max_concurrent_swarms == 10
            assert config.default_reviewers == ["security", "performance"]
            assert config.key_prefix == "custom_prefix"
            assert config.result_ttl_seconds == 172800
            assert config.duplicate_similarity_threshold == 0.9
            assert config.allowed_path_prefixes == ["src/", "lib/", "tests/"]

    def test_get_swarm_config_partial_env_vars(self) -> None:
        """Test that get_swarm_config uses defaults for missing env vars."""
        env_vars = {
            "SWARM_TASK_TIMEOUT_SECONDS": "450",
            # Other vars not set - should use defaults
        }

        with patch.dict(os.environ, env_vars, clear=False):
            # Remove other swarm vars that might be set
            for key in list(os.environ.keys()):
                if key.startswith("SWARM_") and key != "SWARM_TASK_TIMEOUT_SECONDS":
                    os.environ.pop(key, None)

            # Clear cache
            get_swarm_config.cache_clear()

            config = get_swarm_config()

            assert config.task_timeout_seconds == 450
            assert config.aggregate_timeout_seconds == 60  # default
            assert config.max_concurrent_swarms == 5  # default

    def test_get_swarm_config_is_cached(self) -> None:
        """Test that get_swarm_config caches the result."""
        # Clear cache first
        get_swarm_config.cache_clear()

        config1 = get_swarm_config()
        config2 = get_swarm_config()

        # Should return the same cached object
        assert config1 is config2

    def test_get_swarm_config_cache_can_be_cleared(self) -> None:
        """Test that cache can be cleared to reload config."""
        env_vars_initial = {"SWARM_TASK_TIMEOUT_SECONDS": "100"}

        with patch.dict(os.environ, env_vars_initial, clear=False):
            get_swarm_config.cache_clear()
            config1 = get_swarm_config()
            assert config1.task_timeout_seconds == 100

        env_vars_updated = {"SWARM_TASK_TIMEOUT_SECONDS": "200"}

        with patch.dict(os.environ, env_vars_updated, clear=False):
            get_swarm_config.cache_clear()
            config2 = get_swarm_config()
            assert config2.task_timeout_seconds == 200

    def test_get_swarm_config_invalid_env_var(self) -> None:
        """Test that invalid env var values raise appropriate errors."""
        env_vars = {"SWARM_TASK_TIMEOUT_SECONDS": "not_a_number"}

        with patch.dict(os.environ, env_vars, clear=False):
            get_swarm_config.cache_clear()

            with pytest.raises(ValueError):
                get_swarm_config()

    def test_get_swarm_config_invalid_threshold(self) -> None:
        """Test that invalid threshold value raises error."""
        env_vars = {"SWARM_DUPLICATE_SIMILARITY_THRESHOLD": "2.0"}

        with patch.dict(os.environ, env_vars, clear=False):
            get_swarm_config.cache_clear()

            with pytest.raises(ValueError):
                get_swarm_config()
