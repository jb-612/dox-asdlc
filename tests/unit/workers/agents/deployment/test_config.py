"""Unit tests for DeploymentConfig."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from src.workers.agents.deployment.config import (
    DeploymentConfig,
    DeploymentConfigValidationError,
    DeploymentStrategy,
)


class TestDeploymentStrategy:
    """Tests for DeploymentStrategy enum."""

    def test_rolling_strategy_exists(self) -> None:
        """Test that rolling strategy exists."""
        assert DeploymentStrategy.ROLLING.value == "rolling"

    def test_blue_green_strategy_exists(self) -> None:
        """Test that blue-green strategy exists."""
        assert DeploymentStrategy.BLUE_GREEN.value == "blue-green"

    def test_canary_strategy_exists(self) -> None:
        """Test that canary strategy exists."""
        assert DeploymentStrategy.CANARY.value == "canary"

    def test_strategy_from_string(self) -> None:
        """Test creating strategy from string value."""
        assert DeploymentStrategy("rolling") == DeploymentStrategy.ROLLING
        assert DeploymentStrategy("blue-green") == DeploymentStrategy.BLUE_GREEN
        assert DeploymentStrategy("canary") == DeploymentStrategy.CANARY


class TestDeploymentConfig:
    """Tests for DeploymentConfig dataclass."""

    def test_default_config_has_sensible_defaults(self) -> None:
        """Test that default config has sensible defaults."""
        config = DeploymentConfig()

        assert config.release_model == "claude-sonnet-4-20250514"
        assert config.deployment_model == "claude-sonnet-4-20250514"
        assert config.monitor_model == "claude-sonnet-4-20250514"
        assert config.max_tokens == 8192
        assert config.temperature == 0.1  # Low for precise deployment
        assert config.artifact_base_path == Path("artifacts/deployment")
        assert config.rollback_enabled is True
        assert config.canary_percentage == 10
        assert config.health_check_interval == 30
        assert config.deployment_strategy == DeploymentStrategy.ROLLING

    def test_low_temperature_for_precise_deployment(self) -> None:
        """Test that default temperature is low for precise deployment."""
        config = DeploymentConfig()

        # Temperature should be <= 0.2 for precise deployment
        assert config.temperature <= 0.2

    def test_config_accepts_custom_values(self) -> None:
        """Test that config accepts custom values."""
        config = DeploymentConfig(
            release_model="custom-release-model",
            deployment_model="custom-deploy-model",
            monitor_model="custom-monitor-model",
            max_tokens=16384,
            temperature=0.2,
            rollback_enabled=False,
            canary_percentage=25,
            health_check_interval=60,
            deployment_strategy=DeploymentStrategy.CANARY,
        )

        assert config.release_model == "custom-release-model"
        assert config.deployment_model == "custom-deploy-model"
        assert config.monitor_model == "custom-monitor-model"
        assert config.max_tokens == 16384
        assert config.temperature == 0.2
        assert config.rollback_enabled is False
        assert config.canary_percentage == 25
        assert config.health_check_interval == 60
        assert config.deployment_strategy == DeploymentStrategy.CANARY

    def test_config_validates_max_tokens_minimum(self) -> None:
        """Test that max_tokens has minimum validation."""
        with pytest.raises(DeploymentConfigValidationError) as exc_info:
            DeploymentConfig(max_tokens=50)

        assert "max_tokens must be at least 100" in str(exc_info.value)

    def test_config_validates_temperature_range(self) -> None:
        """Test that temperature has range validation."""
        with pytest.raises(DeploymentConfigValidationError) as exc_info:
            DeploymentConfig(temperature=2.5)

        assert "temperature must be between 0 and 2" in str(exc_info.value)

        with pytest.raises(DeploymentConfigValidationError):
            DeploymentConfig(temperature=-0.1)

    def test_config_validates_canary_percentage_range(self) -> None:
        """Test that canary_percentage has range validation."""
        with pytest.raises(DeploymentConfigValidationError) as exc_info:
            DeploymentConfig(canary_percentage=0)

        assert "canary_percentage must be between 1 and 100" in str(exc_info.value)

        with pytest.raises(DeploymentConfigValidationError):
            DeploymentConfig(canary_percentage=101)

    def test_config_validates_health_check_interval_positive(self) -> None:
        """Test that health_check_interval must be positive."""
        with pytest.raises(DeploymentConfigValidationError) as exc_info:
            DeploymentConfig(health_check_interval=0)

        assert "health_check_interval must be positive" in str(exc_info.value)

        with pytest.raises(DeploymentConfigValidationError):
            DeploymentConfig(health_check_interval=-10)

    def test_config_accepts_all_valid_strategies(self) -> None:
        """Test that all valid deployment strategies are accepted."""
        for strategy in DeploymentStrategy:
            config = DeploymentConfig(deployment_strategy=strategy)
            assert config.deployment_strategy == strategy


class TestDeploymentConfigFromEnv:
    """Tests for DeploymentConfig.from_env()."""

    def test_from_env_returns_defaults_without_env_vars(self) -> None:
        """Test that from_env returns defaults when no env vars are set."""
        with patch.dict(os.environ, {}, clear=True):
            config = DeploymentConfig.from_env()

        assert config.release_model == "claude-sonnet-4-20250514"
        assert config.deployment_model == "claude-sonnet-4-20250514"
        assert config.monitor_model == "claude-sonnet-4-20250514"
        assert config.max_tokens == 8192

    def test_from_env_reads_release_model_from_env(self) -> None:
        """Test that from_env reads release model from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_RELEASE_MODEL": "test-model"}):
            config = DeploymentConfig.from_env()

        assert config.release_model == "test-model"

    def test_from_env_reads_deployment_model_from_env(self) -> None:
        """Test that from_env reads deployment model from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_DEPLOY_MODEL": "test-deploy"}):
            config = DeploymentConfig.from_env()

        assert config.deployment_model == "test-deploy"

    def test_from_env_reads_monitor_model_from_env(self) -> None:
        """Test that from_env reads monitor model from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_MONITOR_MODEL": "test-monitor"}):
            config = DeploymentConfig.from_env()

        assert config.monitor_model == "test-monitor"

    def test_from_env_reads_max_tokens_from_env(self) -> None:
        """Test that from_env reads max_tokens from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_MAX_TOKENS": "16384"}):
            config = DeploymentConfig.from_env()

        assert config.max_tokens == 16384

    def test_from_env_reads_temperature_from_env(self) -> None:
        """Test that from_env reads temperature from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_TEMPERATURE": "0.2"}):
            config = DeploymentConfig.from_env()

        assert config.temperature == 0.2

    def test_from_env_reads_artifact_path_from_env(self) -> None:
        """Test that from_env reads artifact path from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_ARTIFACT_PATH": "/custom/path"}):
            config = DeploymentConfig.from_env()

        assert config.artifact_base_path == Path("/custom/path")

    def test_from_env_reads_rollback_enabled_from_env(self) -> None:
        """Test that from_env reads rollback_enabled from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_ROLLBACK_ENABLED": "false"}):
            config = DeploymentConfig.from_env()

        assert config.rollback_enabled is False

        with patch.dict(os.environ, {"DEPLOYMENT_ROLLBACK_ENABLED": "true"}):
            config = DeploymentConfig.from_env()

        assert config.rollback_enabled is True

    def test_from_env_reads_canary_percentage_from_env(self) -> None:
        """Test that from_env reads canary percentage from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_CANARY_PERCENTAGE": "25"}):
            config = DeploymentConfig.from_env()

        assert config.canary_percentage == 25

    def test_from_env_reads_health_check_interval_from_env(self) -> None:
        """Test that from_env reads health check interval from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_HEALTH_CHECK_INTERVAL": "60"}):
            config = DeploymentConfig.from_env()

        assert config.health_check_interval == 60

    def test_from_env_reads_deployment_strategy_from_env(self) -> None:
        """Test that from_env reads deployment strategy from environment."""
        with patch.dict(os.environ, {"DEPLOYMENT_STRATEGY": "canary"}):
            config = DeploymentConfig.from_env()

        assert config.deployment_strategy == DeploymentStrategy.CANARY

        with patch.dict(os.environ, {"DEPLOYMENT_STRATEGY": "blue-green"}):
            config = DeploymentConfig.from_env()

        assert config.deployment_strategy == DeploymentStrategy.BLUE_GREEN


class TestDeploymentConfigToDict:
    """Tests for DeploymentConfig.to_dict()."""

    def test_to_dict_serializes_all_fields(self) -> None:
        """Test that to_dict serializes all fields."""
        config = DeploymentConfig(
            release_model="test-release",
            deployment_model="test-deploy",
            monitor_model="test-monitor",
            max_tokens=16384,
            temperature=0.2,
            artifact_base_path=Path("/test/path"),
            rollback_enabled=False,
            canary_percentage=25,
            health_check_interval=60,
            deployment_strategy=DeploymentStrategy.BLUE_GREEN,
        )

        result = config.to_dict()

        assert result["release_model"] == "test-release"
        assert result["deployment_model"] == "test-deploy"
        assert result["monitor_model"] == "test-monitor"
        assert result["max_tokens"] == 16384
        assert result["temperature"] == 0.2
        assert result["artifact_base_path"] == "/test/path"
        assert result["rollback_enabled"] is False
        assert result["canary_percentage"] == 25
        assert result["health_check_interval"] == 60
        assert result["deployment_strategy"] == "blue-green"


class TestDeploymentConfigWithOverrides:
    """Tests for DeploymentConfig.with_overrides()."""

    def test_with_overrides_creates_new_config(self) -> None:
        """Test that with_overrides creates a new config."""
        original = DeploymentConfig()
        modified = original.with_overrides(max_tokens=16384)

        assert original.max_tokens == 8192  # Original unchanged
        assert modified.max_tokens == 16384  # New config has override

    def test_with_overrides_preserves_unmodified_values(self) -> None:
        """Test that with_overrides preserves unmodified values."""
        original = DeploymentConfig(temperature=0.2)
        modified = original.with_overrides(max_tokens=16384)

        assert modified.temperature == 0.2  # Preserved
        assert modified.max_tokens == 16384  # Overridden

    def test_with_overrides_handles_path_conversion(self) -> None:
        """Test that with_overrides handles path string conversion."""
        original = DeploymentConfig()
        modified = original.with_overrides(artifact_base_path="/new/path")

        assert modified.artifact_base_path == Path("/new/path")

    def test_with_overrides_handles_strategy_string_conversion(self) -> None:
        """Test that with_overrides handles strategy string conversion."""
        original = DeploymentConfig()
        modified = original.with_overrides(deployment_strategy="canary")

        assert modified.deployment_strategy == DeploymentStrategy.CANARY

    def test_with_overrides_validates_new_values(self) -> None:
        """Test that with_overrides validates new values."""
        original = DeploymentConfig()

        with pytest.raises(DeploymentConfigValidationError):
            original.with_overrides(canary_percentage=0)
