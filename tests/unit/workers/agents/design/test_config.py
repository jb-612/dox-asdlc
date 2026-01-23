"""Tests for Design agent configuration."""

from __future__ import annotations

import os
from pathlib import Path
from unittest import mock

import pytest

from src.workers.agents.design.config import (
    ConfigValidationError,
    DesignConfig,
)


class TestDesignConfig:
    """Tests for DesignConfig dataclass."""

    def test_default_values(self) -> None:
        """Test configuration with default values."""
        config = DesignConfig()

        assert config.surveyor_model == "claude-sonnet-4-20250514"
        assert config.architect_model == "claude-sonnet-4-20250514"
        assert config.planner_model == "claude-sonnet-4-20250514"
        assert config.max_tokens == 16384
        assert config.temperature == 0.2
        assert config.artifact_base_path == Path("artifacts/design")
        assert config.enable_rlm is True
        assert config.rlm_context_threshold == 100_000
        assert config.context_pack_required is True
        assert config.max_retries == 3
        assert config.retry_delay_seconds == 1.0

    def test_custom_values(self) -> None:
        """Test configuration with custom values."""
        config = DesignConfig(
            surveyor_model="claude-opus-4-20250514",
            architect_model="claude-opus-4-20250514",
            planner_model="claude-opus-4-20250514",
            max_tokens=32768,
            temperature=0.5,
            artifact_base_path=Path("/custom/path"),
            enable_rlm=False,
            rlm_context_threshold=50_000,
            context_pack_required=False,
            max_retries=5,
            retry_delay_seconds=2.0,
        )

        assert config.surveyor_model == "claude-opus-4-20250514"
        assert config.architect_model == "claude-opus-4-20250514"
        assert config.planner_model == "claude-opus-4-20250514"
        assert config.max_tokens == 32768
        assert config.temperature == 0.5
        assert config.artifact_base_path == Path("/custom/path")
        assert config.enable_rlm is False
        assert config.rlm_context_threshold == 50_000
        assert config.context_pack_required is False
        assert config.max_retries == 5
        assert config.retry_delay_seconds == 2.0

    def test_validation_max_tokens_too_low(self) -> None:
        """Test that max_tokens below minimum raises error."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DesignConfig(max_tokens=50)

        assert "max_tokens must be at least 100" in str(exc_info.value)

    def test_validation_temperature_too_high(self) -> None:
        """Test that temperature above maximum raises error."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DesignConfig(temperature=2.5)

        assert "temperature must be between 0 and 2" in str(exc_info.value)

    def test_validation_temperature_negative(self) -> None:
        """Test that negative temperature raises error."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DesignConfig(temperature=-0.1)

        assert "temperature must be between 0 and 2" in str(exc_info.value)

    def test_validation_max_retries_negative(self) -> None:
        """Test that negative max_retries raises error."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DesignConfig(max_retries=-1)

        assert "max_retries must be non-negative" in str(exc_info.value)

    def test_validation_rlm_threshold_too_low(self) -> None:
        """Test that rlm_context_threshold below minimum raises error."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DesignConfig(rlm_context_threshold=500)

        assert "rlm_context_threshold must be at least 1000" in str(exc_info.value)

    def test_validation_retry_delay_negative(self) -> None:
        """Test that negative retry_delay_seconds raises error."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DesignConfig(retry_delay_seconds=-1.0)

        assert "retry_delay_seconds must be non-negative" in str(exc_info.value)


class TestDesignConfigFromEnv:
    """Tests for DesignConfig.from_env()."""

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables set."""
        with mock.patch.dict(os.environ, {}, clear=True):
            config = DesignConfig.from_env()

        assert config.surveyor_model == "claude-sonnet-4-20250514"
        assert config.max_tokens == 16384
        assert config.enable_rlm is True

    def test_from_env_all_variables(self) -> None:
        """Test from_env with all environment variables set."""
        env_vars = {
            "DESIGN_SURVEYOR_MODEL": "custom-surveyor-model",
            "DESIGN_ARCHITECT_MODEL": "custom-architect-model",
            "DESIGN_PLANNER_MODEL": "custom-planner-model",
            "DESIGN_MAX_TOKENS": "8192",
            "DESIGN_TEMPERATURE": "0.7",
            "DESIGN_ARTIFACT_PATH": "/env/artifacts",
            "DESIGN_ENABLE_RLM": "false",
            "DESIGN_RLM_THRESHOLD": "75000",
            "DESIGN_CONTEXT_PACK_REQUIRED": "false",
            "DESIGN_MAX_RETRIES": "10",
            "DESIGN_RETRY_DELAY": "3.5",
        }

        with mock.patch.dict(os.environ, env_vars, clear=True):
            config = DesignConfig.from_env()

        assert config.surveyor_model == "custom-surveyor-model"
        assert config.architect_model == "custom-architect-model"
        assert config.planner_model == "custom-planner-model"
        assert config.max_tokens == 8192
        assert config.temperature == 0.7
        assert config.artifact_base_path == Path("/env/artifacts")
        assert config.enable_rlm is False
        assert config.rlm_context_threshold == 75000
        assert config.context_pack_required is False
        assert config.max_retries == 10
        assert config.retry_delay_seconds == 3.5

    def test_from_env_bool_variations(self) -> None:
        """Test from_env handles various boolean formats."""
        # Test "true" variations
        for true_value in ("true", "TRUE", "1", "yes", "YES"):
            with mock.patch.dict(os.environ, {"DESIGN_ENABLE_RLM": true_value}):
                config = DesignConfig.from_env()
                assert config.enable_rlm is True, f"Failed for value: {true_value}"

        # Test "false" variations
        for false_value in ("false", "FALSE", "0", "no", "NO"):
            with mock.patch.dict(os.environ, {"DESIGN_ENABLE_RLM": false_value}):
                config = DesignConfig.from_env()
                assert config.enable_rlm is False, f"Failed for value: {false_value}"


class TestDesignConfigToDict:
    """Tests for DesignConfig.to_dict()."""

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        config = DesignConfig(
            surveyor_model="test-model",
            max_tokens=4096,
            artifact_base_path=Path("/test/path"),
        )

        result = config.to_dict()

        assert result["surveyor_model"] == "test-model"
        assert result["max_tokens"] == 4096
        assert result["artifact_base_path"] == "/test/path"
        assert isinstance(result["artifact_base_path"], str)

    def test_to_dict_completeness(self) -> None:
        """Test that to_dict includes all fields."""
        config = DesignConfig()
        result = config.to_dict()

        expected_keys = {
            "surveyor_model",
            "architect_model",
            "planner_model",
            "max_tokens",
            "temperature",
            "artifact_base_path",
            "enable_rlm",
            "rlm_context_threshold",
            "context_pack_required",
            "max_retries",
            "retry_delay_seconds",
        }

        assert set(result.keys()) == expected_keys


class TestDesignConfigWithOverrides:
    """Tests for DesignConfig.with_overrides()."""

    def test_with_overrides_single_value(self) -> None:
        """Test overriding a single value."""
        config = DesignConfig()
        new_config = config.with_overrides(max_tokens=8192)

        assert new_config.max_tokens == 8192
        assert config.max_tokens == 16384  # Original unchanged

    def test_with_overrides_multiple_values(self) -> None:
        """Test overriding multiple values."""
        config = DesignConfig()
        new_config = config.with_overrides(
            surveyor_model="new-model",
            temperature=0.5,
            enable_rlm=False,
        )

        assert new_config.surveyor_model == "new-model"
        assert new_config.temperature == 0.5
        assert new_config.enable_rlm is False

    def test_with_overrides_path_string(self) -> None:
        """Test that string paths are converted to Path objects."""
        config = DesignConfig()
        new_config = config.with_overrides(artifact_base_path="/new/path")

        assert new_config.artifact_base_path == Path("/new/path")
        assert isinstance(new_config.artifact_base_path, Path)

    def test_with_overrides_validation(self) -> None:
        """Test that validation runs on overridden config."""
        config = DesignConfig()

        with pytest.raises(ConfigValidationError):
            config.with_overrides(max_tokens=50)
