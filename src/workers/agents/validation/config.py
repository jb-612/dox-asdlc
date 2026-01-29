"""Configuration for Validation agents.

Provides configuration dataclass with sensible defaults and
environment variable overrides for Validation and Security agents.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""

    pass


# Valid security scan levels
VALID_SECURITY_SCAN_LEVELS = frozenset({"minimal", "standard", "thorough"})

# Default values as constants for class method access
_DEFAULT_VALIDATION_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_SECURITY_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MAX_TOKENS = 8192
_DEFAULT_TEMPERATURE = 0.1  # Low for precise validation
_DEFAULT_ARTIFACT_BASE_PATH = Path("artifacts/validation")
_DEFAULT_ENABLE_RLM = True
_DEFAULT_E2E_TEST_TIMEOUT = 600
_DEFAULT_SECURITY_SCAN_LEVEL = "standard"


@dataclass
class ValidationConfig:
    """Configuration for Validation agents.

    Attributes:
        validation_model: LLM model for validation analysis.
        security_model: LLM model for security scanning.
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation (low for precise validation).
        artifact_base_path: Base path for artifact output.
        enable_rlm: Whether to enable RLM integration.
        e2e_test_timeout: Timeout for E2E test execution in seconds.
        security_scan_level: Security scan thoroughness level.
    """

    validation_model: str = _DEFAULT_VALIDATION_MODEL
    security_model: str = _DEFAULT_SECURITY_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    artifact_base_path: Path = field(default_factory=lambda: _DEFAULT_ARTIFACT_BASE_PATH)
    enable_rlm: bool = _DEFAULT_ENABLE_RLM
    e2e_test_timeout: int = _DEFAULT_E2E_TEST_TIMEOUT
    security_scan_level: str = _DEFAULT_SECURITY_SCAN_LEVEL

    def __post_init__(self) -> None:
        """Validate configuration after initialization."""
        self._validate()

    def _validate(self) -> None:
        """Validate configuration values.

        Raises:
            ConfigValidationError: If validation fails.
        """
        if self.max_tokens < 100:
            raise ConfigValidationError(
                f"max_tokens must be at least 100, got {self.max_tokens}"
            )

        if not 0 <= self.temperature <= 2:
            raise ConfigValidationError(
                f"temperature must be between 0 and 2, got {self.temperature}"
            )

        if self.e2e_test_timeout <= 0:
            raise ConfigValidationError(
                f"e2e_test_timeout must be positive, got {self.e2e_test_timeout}"
            )

        if self.security_scan_level not in VALID_SECURITY_SCAN_LEVELS:
            raise ConfigValidationError(
                f"security_scan_level must be one of {sorted(VALID_SECURITY_SCAN_LEVELS)}, "
                f"got '{self.security_scan_level}'"
            )

    @classmethod
    def from_env(cls) -> ValidationConfig:
        """Create configuration from environment variables.

        Environment variables:
            VALIDATION_MODEL: Model for validation analysis
            VALIDATION_SECURITY_MODEL: Model for security scanning
            VALIDATION_MAX_TOKENS: Maximum tokens for LLM responses
            VALIDATION_TEMPERATURE: LLM temperature
            VALIDATION_ARTIFACT_PATH: Base path for artifacts
            VALIDATION_ENABLE_RLM: Enable RLM integration (true/false)
            VALIDATION_E2E_TIMEOUT: E2E test timeout in seconds
            VALIDATION_SECURITY_SCAN_LEVEL: Security scan level

        Returns:
            ValidationConfig: Configuration from environment.
        """
        def get_bool(key: str, default: bool) -> bool:
            value = os.getenv(key)
            if value is None:
                return default
            return value.lower() in ("true", "1", "yes")

        def get_float(key: str, default: float) -> float:
            value = os.getenv(key)
            if value is None:
                return default
            return float(value)

        def get_int(key: str, default: int) -> int:
            value = os.getenv(key)
            if value is None:
                return default
            return int(value)

        artifact_path = os.getenv("VALIDATION_ARTIFACT_PATH")

        return cls(
            validation_model=os.getenv("VALIDATION_MODEL", _DEFAULT_VALIDATION_MODEL),
            security_model=os.getenv("VALIDATION_SECURITY_MODEL", _DEFAULT_SECURITY_MODEL),
            max_tokens=get_int("VALIDATION_MAX_TOKENS", _DEFAULT_MAX_TOKENS),
            temperature=get_float("VALIDATION_TEMPERATURE", _DEFAULT_TEMPERATURE),
            artifact_base_path=Path(artifact_path) if artifact_path else _DEFAULT_ARTIFACT_BASE_PATH,
            enable_rlm=get_bool("VALIDATION_ENABLE_RLM", _DEFAULT_ENABLE_RLM),
            e2e_test_timeout=get_int("VALIDATION_E2E_TIMEOUT", _DEFAULT_E2E_TEST_TIMEOUT),
            security_scan_level=os.getenv("VALIDATION_SECURITY_SCAN_LEVEL", _DEFAULT_SECURITY_SCAN_LEVEL),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary.

        Returns:
            dict: Configuration as dictionary.
        """
        return {
            "validation_model": self.validation_model,
            "security_model": self.security_model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "artifact_base_path": str(self.artifact_base_path),
            "enable_rlm": self.enable_rlm,
            "e2e_test_timeout": self.e2e_test_timeout,
            "security_scan_level": self.security_scan_level,
        }

    def with_overrides(self, **kwargs: Any) -> ValidationConfig:
        """Create new config with overridden values.

        Args:
            **kwargs: Values to override.

        Returns:
            ValidationConfig: New config with overrides.
        """
        current = self.to_dict()
        current.update(kwargs)

        # Handle Path conversion
        if isinstance(current.get("artifact_base_path"), str):
            current["artifact_base_path"] = Path(current["artifact_base_path"])

        return ValidationConfig(**current)
