"""Unit tests for ValidationConfig."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from src.workers.agents.validation.config import (
    ValidationConfig,
    ConfigValidationError,
)


class TestValidationConfig:
    """Tests for ValidationConfig dataclass."""

    def test_default_config_has_sensible_defaults(self) -> None:
        """Test that default config has sensible defaults."""
        config = ValidationConfig()

        assert config.validation_model == "claude-sonnet-4-20250514"
        assert config.security_model == "claude-sonnet-4-20250514"
        assert config.max_tokens == 8192
        assert config.temperature == 0.1  # Low for precise validation
        assert config.artifact_base_path == Path("artifacts/validation")
        assert config.enable_rlm is True
        assert config.e2e_test_timeout == 600
        assert config.security_scan_level == "standard"

    def test_low_temperature_for_precise_validation(self) -> None:
        """Test that default temperature is low for precise validation."""
        config = ValidationConfig()

        # Temperature should be <= 0.2 for precise validation
        assert config.temperature <= 0.2

    def test_config_accepts_custom_values(self) -> None:
        """Test that config accepts custom values."""
        config = ValidationConfig(
            validation_model="custom-model",
            security_model="custom-security-model",
            max_tokens=16384,
            temperature=0.2,
            enable_rlm=False,
            e2e_test_timeout=900,
            security_scan_level="thorough",
        )

        assert config.validation_model == "custom-model"
        assert config.security_model == "custom-security-model"
        assert config.max_tokens == 16384
        assert config.temperature == 0.2
        assert config.enable_rlm is False
        assert config.e2e_test_timeout == 900
        assert config.security_scan_level == "thorough"

    def test_config_validates_max_tokens_minimum(self) -> None:
        """Test that max_tokens has minimum validation."""
        with pytest.raises(ConfigValidationError) as exc_info:
            ValidationConfig(max_tokens=50)

        assert "max_tokens must be at least 100" in str(exc_info.value)

    def test_config_validates_temperature_range(self) -> None:
        """Test that temperature has range validation."""
        with pytest.raises(ConfigValidationError) as exc_info:
            ValidationConfig(temperature=2.5)

        assert "temperature must be between 0 and 2" in str(exc_info.value)

        with pytest.raises(ConfigValidationError):
            ValidationConfig(temperature=-0.1)

    def test_config_validates_e2e_test_timeout_positive(self) -> None:
        """Test that e2e_test_timeout must be positive."""
        with pytest.raises(ConfigValidationError) as exc_info:
            ValidationConfig(e2e_test_timeout=0)

        assert "e2e_test_timeout must be positive" in str(exc_info.value)

        with pytest.raises(ConfigValidationError):
            ValidationConfig(e2e_test_timeout=-100)

    def test_config_validates_security_scan_level(self) -> None:
        """Test that security_scan_level must be valid."""
        with pytest.raises(ConfigValidationError) as exc_info:
            ValidationConfig(security_scan_level="invalid")

        assert "security_scan_level must be one of" in str(exc_info.value)

    def test_config_accepts_all_valid_security_scan_levels(self) -> None:
        """Test that all valid security scan levels are accepted."""
        for level in ["minimal", "standard", "thorough"]:
            config = ValidationConfig(security_scan_level=level)
            assert config.security_scan_level == level


class TestValidationConfigFromEnv:
    """Tests for ValidationConfig.from_env()."""

    def test_from_env_returns_defaults_without_env_vars(self) -> None:
        """Test that from_env returns defaults when no env vars are set."""
        with patch.dict(os.environ, {}, clear=True):
            config = ValidationConfig.from_env()

        assert config.validation_model == "claude-sonnet-4-20250514"
        assert config.security_model == "claude-sonnet-4-20250514"
        assert config.max_tokens == 8192

    def test_from_env_reads_validation_model_from_env(self) -> None:
        """Test that from_env reads validation model from environment."""
        with patch.dict(os.environ, {"VALIDATION_MODEL": "test-model"}):
            config = ValidationConfig.from_env()

        assert config.validation_model == "test-model"

    def test_from_env_reads_security_model_from_env(self) -> None:
        """Test that from_env reads security model from environment."""
        with patch.dict(os.environ, {"VALIDATION_SECURITY_MODEL": "test-security"}):
            config = ValidationConfig.from_env()

        assert config.security_model == "test-security"

    def test_from_env_reads_max_tokens_from_env(self) -> None:
        """Test that from_env reads max_tokens from environment."""
        with patch.dict(os.environ, {"VALIDATION_MAX_TOKENS": "16384"}):
            config = ValidationConfig.from_env()

        assert config.max_tokens == 16384

    def test_from_env_reads_temperature_from_env(self) -> None:
        """Test that from_env reads temperature from environment."""
        with patch.dict(os.environ, {"VALIDATION_TEMPERATURE": "0.2"}):
            config = ValidationConfig.from_env()

        assert config.temperature == 0.2

    def test_from_env_reads_artifact_path_from_env(self) -> None:
        """Test that from_env reads artifact path from environment."""
        with patch.dict(os.environ, {"VALIDATION_ARTIFACT_PATH": "/custom/path"}):
            config = ValidationConfig.from_env()

        assert config.artifact_base_path == Path("/custom/path")

    def test_from_env_reads_enable_rlm_from_env(self) -> None:
        """Test that from_env reads enable_rlm from environment."""
        with patch.dict(os.environ, {"VALIDATION_ENABLE_RLM": "false"}):
            config = ValidationConfig.from_env()

        assert config.enable_rlm is False

        with patch.dict(os.environ, {"VALIDATION_ENABLE_RLM": "true"}):
            config = ValidationConfig.from_env()

        assert config.enable_rlm is True

    def test_from_env_reads_e2e_test_timeout_from_env(self) -> None:
        """Test that from_env reads E2E test timeout from environment."""
        with patch.dict(os.environ, {"VALIDATION_E2E_TIMEOUT": "900"}):
            config = ValidationConfig.from_env()

        assert config.e2e_test_timeout == 900

    def test_from_env_reads_security_scan_level_from_env(self) -> None:
        """Test that from_env reads security scan level from environment."""
        with patch.dict(os.environ, {"VALIDATION_SECURITY_SCAN_LEVEL": "thorough"}):
            config = ValidationConfig.from_env()

        assert config.security_scan_level == "thorough"


class TestValidationConfigToDict:
    """Tests for ValidationConfig.to_dict()."""

    def test_to_dict_serializes_all_fields(self) -> None:
        """Test that to_dict serializes all fields."""
        config = ValidationConfig(
            validation_model="test-validation",
            security_model="test-security",
            max_tokens=16384,
            temperature=0.2,
            artifact_base_path=Path("/test/path"),
            enable_rlm=False,
            e2e_test_timeout=900,
            security_scan_level="thorough",
        )

        result = config.to_dict()

        assert result["validation_model"] == "test-validation"
        assert result["security_model"] == "test-security"
        assert result["max_tokens"] == 16384
        assert result["temperature"] == 0.2
        assert result["artifact_base_path"] == "/test/path"
        assert result["enable_rlm"] is False
        assert result["e2e_test_timeout"] == 900
        assert result["security_scan_level"] == "thorough"


class TestValidationConfigWithOverrides:
    """Tests for ValidationConfig.with_overrides()."""

    def test_with_overrides_creates_new_config(self) -> None:
        """Test that with_overrides creates a new config."""
        original = ValidationConfig()
        modified = original.with_overrides(max_tokens=16384)

        assert original.max_tokens == 8192  # Original unchanged
        assert modified.max_tokens == 16384  # New config has override

    def test_with_overrides_preserves_unmodified_values(self) -> None:
        """Test that with_overrides preserves unmodified values."""
        original = ValidationConfig(temperature=0.2)
        modified = original.with_overrides(max_tokens=16384)

        assert modified.temperature == 0.2  # Preserved
        assert modified.max_tokens == 16384  # Overridden

    def test_with_overrides_handles_path_conversion(self) -> None:
        """Test that with_overrides handles path string conversion."""
        original = ValidationConfig()
        modified = original.with_overrides(artifact_base_path="/new/path")

        assert modified.artifact_base_path == Path("/new/path")

    def test_with_overrides_validates_new_values(self) -> None:
        """Test that with_overrides validates new values."""
        original = ValidationConfig()

        with pytest.raises(ConfigValidationError):
            original.with_overrides(security_scan_level="invalid")
