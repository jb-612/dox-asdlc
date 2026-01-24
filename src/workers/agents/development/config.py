"""Configuration for Development agents.

Provides configuration dataclass with sensible defaults and
environment variable overrides for UTest, Coding, Debugger, and Reviewer agents.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""

    pass


# Default values as constants for class method access
_DEFAULT_UTEST_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_CODING_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_DEBUGGER_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_REVIEWER_MODEL = "claude-opus-4-20250514"  # Opus for high-quality review
_DEFAULT_MAX_TOKENS = 16384
_DEFAULT_TEMPERATURE = 0.2  # Lower for precise code generation
_DEFAULT_ARTIFACT_BASE_PATH = Path("artifacts/development")
_DEFAULT_ENABLE_RLM = True
_DEFAULT_MAX_CODING_RETRIES = 4  # Before escalating to debugger
_DEFAULT_TEST_TIMEOUT_SECONDS = 300
_DEFAULT_COVERAGE_THRESHOLD = 80.0


@dataclass
class DevelopmentConfig:
    """Configuration for Development agents.

    Attributes:
        utest_model: LLM model for test generation.
        coding_model: LLM model for implementation.
        debugger_model: LLM model for debugging.
        reviewer_model: LLM model for code review (Opus by default).
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation.
        artifact_base_path: Base path for artifact output.
        enable_rlm: Whether to enable RLM integration.
        max_coding_retries: Maximum coding retries before debugger escalation.
        test_timeout_seconds: Timeout for test execution.
        coverage_threshold: Minimum test coverage percentage required.
    """

    utest_model: str = _DEFAULT_UTEST_MODEL
    coding_model: str = _DEFAULT_CODING_MODEL
    debugger_model: str = _DEFAULT_DEBUGGER_MODEL
    reviewer_model: str = _DEFAULT_REVIEWER_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    artifact_base_path: Path = field(default_factory=lambda: _DEFAULT_ARTIFACT_BASE_PATH)
    enable_rlm: bool = _DEFAULT_ENABLE_RLM
    max_coding_retries: int = _DEFAULT_MAX_CODING_RETRIES
    test_timeout_seconds: int = _DEFAULT_TEST_TIMEOUT_SECONDS
    coverage_threshold: float = _DEFAULT_COVERAGE_THRESHOLD

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

        if self.max_coding_retries < 0:
            raise ConfigValidationError(
                f"max_coding_retries must be non-negative, got {self.max_coding_retries}"
            )

        if self.test_timeout_seconds <= 0:
            raise ConfigValidationError(
                f"test_timeout_seconds must be positive, got {self.test_timeout_seconds}"
            )

        if not 0 <= self.coverage_threshold <= 100:
            raise ConfigValidationError(
                f"coverage_threshold must be between 0 and 100, got {self.coverage_threshold}"
            )

    @classmethod
    def from_env(cls) -> DevelopmentConfig:
        """Create configuration from environment variables.

        Environment variables:
            DEVELOPMENT_UTEST_MODEL: Model for test generation
            DEVELOPMENT_CODING_MODEL: Model for implementation
            DEVELOPMENT_DEBUGGER_MODEL: Model for debugging
            DEVELOPMENT_REVIEWER_MODEL: Model for code review
            DEVELOPMENT_MAX_TOKENS: Maximum tokens for LLM responses
            DEVELOPMENT_TEMPERATURE: LLM temperature
            DEVELOPMENT_ARTIFACT_PATH: Base path for artifacts
            DEVELOPMENT_ENABLE_RLM: Enable RLM integration (true/false)
            DEVELOPMENT_MAX_CODING_RETRIES: Maximum coding retries
            DEVELOPMENT_TEST_TIMEOUT: Test execution timeout in seconds
            DEVELOPMENT_COVERAGE_THRESHOLD: Minimum test coverage percentage

        Returns:
            DevelopmentConfig: Configuration from environment.
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

        artifact_path = os.getenv("DEVELOPMENT_ARTIFACT_PATH")

        return cls(
            utest_model=os.getenv("DEVELOPMENT_UTEST_MODEL", _DEFAULT_UTEST_MODEL),
            coding_model=os.getenv("DEVELOPMENT_CODING_MODEL", _DEFAULT_CODING_MODEL),
            debugger_model=os.getenv("DEVELOPMENT_DEBUGGER_MODEL", _DEFAULT_DEBUGGER_MODEL),
            reviewer_model=os.getenv("DEVELOPMENT_REVIEWER_MODEL", _DEFAULT_REVIEWER_MODEL),
            max_tokens=get_int("DEVELOPMENT_MAX_TOKENS", _DEFAULT_MAX_TOKENS),
            temperature=get_float("DEVELOPMENT_TEMPERATURE", _DEFAULT_TEMPERATURE),
            artifact_base_path=Path(artifact_path) if artifact_path else _DEFAULT_ARTIFACT_BASE_PATH,
            enable_rlm=get_bool("DEVELOPMENT_ENABLE_RLM", _DEFAULT_ENABLE_RLM),
            max_coding_retries=get_int("DEVELOPMENT_MAX_CODING_RETRIES", _DEFAULT_MAX_CODING_RETRIES),
            test_timeout_seconds=get_int("DEVELOPMENT_TEST_TIMEOUT", _DEFAULT_TEST_TIMEOUT_SECONDS),
            coverage_threshold=get_float("DEVELOPMENT_COVERAGE_THRESHOLD", _DEFAULT_COVERAGE_THRESHOLD),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary.

        Returns:
            dict: Configuration as dictionary.
        """
        return {
            "utest_model": self.utest_model,
            "coding_model": self.coding_model,
            "debugger_model": self.debugger_model,
            "reviewer_model": self.reviewer_model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "artifact_base_path": str(self.artifact_base_path),
            "enable_rlm": self.enable_rlm,
            "max_coding_retries": self.max_coding_retries,
            "test_timeout_seconds": self.test_timeout_seconds,
            "coverage_threshold": self.coverage_threshold,
        }

    def with_overrides(self, **kwargs: Any) -> DevelopmentConfig:
        """Create new config with overridden values.

        Args:
            **kwargs: Values to override.

        Returns:
            DevelopmentConfig: New config with overrides.
        """
        current = self.to_dict()
        current.update(kwargs)

        # Handle Path conversion
        if isinstance(current.get("artifact_base_path"), str):
            current["artifact_base_path"] = Path(current["artifact_base_path"])

        return DevelopmentConfig(**current)
