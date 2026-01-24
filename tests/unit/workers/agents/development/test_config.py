"""Unit tests for DevelopmentConfig."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from src.workers.agents.development.config import (
    DevelopmentConfig,
    ConfigValidationError,
)


class TestDevelopmentConfig:
    """Tests for DevelopmentConfig dataclass."""

    def test_default_config_has_sensible_defaults(self) -> None:
        """Test that default config has sensible defaults."""
        config = DevelopmentConfig()

        assert config.utest_model == "claude-sonnet-4-20250514"
        assert config.coding_model == "claude-sonnet-4-20250514"
        assert config.debugger_model == "claude-sonnet-4-20250514"
        assert config.reviewer_model == "claude-opus-4-20250514"  # Opus for review
        assert config.max_tokens == 16384
        assert config.temperature == 0.2
        assert config.artifact_base_path == Path("artifacts/development")
        assert config.enable_rlm is True
        assert config.max_coding_retries == 4
        assert config.test_timeout_seconds == 300
        assert config.coverage_threshold == 80.0

    def test_reviewer_uses_opus_model_by_default(self) -> None:
        """Test that reviewer uses Opus model by default."""
        config = DevelopmentConfig()

        assert "opus" in config.reviewer_model.lower()

    def test_config_accepts_custom_values(self) -> None:
        """Test that config accepts custom values."""
        config = DevelopmentConfig(
            utest_model="custom-model",
            max_tokens=8192,
            temperature=0.5,
            enable_rlm=False,
            max_coding_retries=5,
        )

        assert config.utest_model == "custom-model"
        assert config.max_tokens == 8192
        assert config.temperature == 0.5
        assert config.enable_rlm is False
        assert config.max_coding_retries == 5

    def test_config_validates_max_tokens_minimum(self) -> None:
        """Test that max_tokens has minimum validation."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DevelopmentConfig(max_tokens=50)

        assert "max_tokens must be at least 100" in str(exc_info.value)

    def test_config_validates_temperature_range(self) -> None:
        """Test that temperature has range validation."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DevelopmentConfig(temperature=2.5)

        assert "temperature must be between 0 and 2" in str(exc_info.value)

        with pytest.raises(ConfigValidationError):
            DevelopmentConfig(temperature=-0.1)

    def test_config_validates_max_coding_retries_non_negative(self) -> None:
        """Test that max_coding_retries must be non-negative."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DevelopmentConfig(max_coding_retries=-1)

        assert "max_coding_retries must be non-negative" in str(exc_info.value)

    def test_config_validates_test_timeout_positive(self) -> None:
        """Test that test_timeout_seconds must be positive."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DevelopmentConfig(test_timeout_seconds=0)

        assert "test_timeout_seconds must be positive" in str(exc_info.value)

    def test_config_validates_coverage_threshold_range(self) -> None:
        """Test that coverage_threshold must be between 0 and 100."""
        with pytest.raises(ConfigValidationError) as exc_info:
            DevelopmentConfig(coverage_threshold=101)

        assert "coverage_threshold must be between 0 and 100" in str(exc_info.value)

        with pytest.raises(ConfigValidationError):
            DevelopmentConfig(coverage_threshold=-1)


class TestDevelopmentConfigFromEnv:
    """Tests for DevelopmentConfig.from_env()."""

    def test_from_env_returns_defaults_without_env_vars(self) -> None:
        """Test that from_env returns defaults when no env vars are set."""
        with patch.dict(os.environ, {}, clear=True):
            config = DevelopmentConfig.from_env()

        assert config.utest_model == "claude-sonnet-4-20250514"
        assert config.reviewer_model == "claude-opus-4-20250514"
        assert config.max_tokens == 16384

    def test_from_env_reads_utest_model_from_env(self) -> None:
        """Test that from_env reads utest model from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_UTEST_MODEL": "test-model"}):
            config = DevelopmentConfig.from_env()

        assert config.utest_model == "test-model"

    def test_from_env_reads_coding_model_from_env(self) -> None:
        """Test that from_env reads coding model from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_CODING_MODEL": "test-coding"}):
            config = DevelopmentConfig.from_env()

        assert config.coding_model == "test-coding"

    def test_from_env_reads_debugger_model_from_env(self) -> None:
        """Test that from_env reads debugger model from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_DEBUGGER_MODEL": "test-debugger"}):
            config = DevelopmentConfig.from_env()

        assert config.debugger_model == "test-debugger"

    def test_from_env_reads_reviewer_model_from_env(self) -> None:
        """Test that from_env reads reviewer model from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_REVIEWER_MODEL": "test-reviewer"}):
            config = DevelopmentConfig.from_env()

        assert config.reviewer_model == "test-reviewer"

    def test_from_env_reads_max_tokens_from_env(self) -> None:
        """Test that from_env reads max_tokens from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_MAX_TOKENS": "8192"}):
            config = DevelopmentConfig.from_env()

        assert config.max_tokens == 8192

    def test_from_env_reads_temperature_from_env(self) -> None:
        """Test that from_env reads temperature from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_TEMPERATURE": "0.7"}):
            config = DevelopmentConfig.from_env()

        assert config.temperature == 0.7

    def test_from_env_reads_artifact_path_from_env(self) -> None:
        """Test that from_env reads artifact path from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_ARTIFACT_PATH": "/custom/path"}):
            config = DevelopmentConfig.from_env()

        assert config.artifact_base_path == Path("/custom/path")

    def test_from_env_reads_enable_rlm_from_env(self) -> None:
        """Test that from_env reads enable_rlm from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_ENABLE_RLM": "false"}):
            config = DevelopmentConfig.from_env()

        assert config.enable_rlm is False

        with patch.dict(os.environ, {"DEVELOPMENT_ENABLE_RLM": "true"}):
            config = DevelopmentConfig.from_env()

        assert config.enable_rlm is True

    def test_from_env_reads_max_coding_retries_from_env(self) -> None:
        """Test that from_env reads max coding retries from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_MAX_CODING_RETRIES": "6"}):
            config = DevelopmentConfig.from_env()

        assert config.max_coding_retries == 6

    def test_from_env_reads_test_timeout_from_env(self) -> None:
        """Test that from_env reads test timeout from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_TEST_TIMEOUT": "600"}):
            config = DevelopmentConfig.from_env()

        assert config.test_timeout_seconds == 600

    def test_from_env_reads_coverage_threshold_from_env(self) -> None:
        """Test that from_env reads coverage threshold from environment."""
        with patch.dict(os.environ, {"DEVELOPMENT_COVERAGE_THRESHOLD": "90"}):
            config = DevelopmentConfig.from_env()

        assert config.coverage_threshold == 90.0


class TestDevelopmentConfigToDict:
    """Tests for DevelopmentConfig.to_dict()."""

    def test_to_dict_serializes_all_fields(self) -> None:
        """Test that to_dict serializes all fields."""
        config = DevelopmentConfig(
            utest_model="test-utest",
            coding_model="test-coding",
            debugger_model="test-debugger",
            reviewer_model="test-reviewer",
            max_tokens=8192,
            temperature=0.5,
            artifact_base_path=Path("/test/path"),
            enable_rlm=False,
            max_coding_retries=5,
            test_timeout_seconds=600,
            coverage_threshold=90.0,
        )

        result = config.to_dict()

        assert result["utest_model"] == "test-utest"
        assert result["coding_model"] == "test-coding"
        assert result["debugger_model"] == "test-debugger"
        assert result["reviewer_model"] == "test-reviewer"
        assert result["max_tokens"] == 8192
        assert result["temperature"] == 0.5
        assert result["artifact_base_path"] == "/test/path"
        assert result["enable_rlm"] is False
        assert result["max_coding_retries"] == 5
        assert result["test_timeout_seconds"] == 600
        assert result["coverage_threshold"] == 90.0


class TestDevelopmentConfigWithOverrides:
    """Tests for DevelopmentConfig.with_overrides()."""

    def test_with_overrides_creates_new_config(self) -> None:
        """Test that with_overrides creates a new config."""
        original = DevelopmentConfig()
        modified = original.with_overrides(max_tokens=8192)

        assert original.max_tokens == 16384  # Original unchanged
        assert modified.max_tokens == 8192  # New config has override

    def test_with_overrides_preserves_unmodified_values(self) -> None:
        """Test that with_overrides preserves unmodified values."""
        original = DevelopmentConfig(temperature=0.5)
        modified = original.with_overrides(max_tokens=8192)

        assert modified.temperature == 0.5  # Preserved
        assert modified.max_tokens == 8192  # Overridden

    def test_with_overrides_handles_path_conversion(self) -> None:
        """Test that with_overrides handles path string conversion."""
        original = DevelopmentConfig()
        modified = original.with_overrides(artifact_base_path="/new/path")

        assert modified.artifact_base_path == Path("/new/path")
