"""Configuration for Design agents.

Provides configuration dataclass with sensible defaults and
environment variable overrides for Surveyor, Architect, and Planner agents.
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
_DEFAULT_SURVEYOR_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_ARCHITECT_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_PLANNER_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MAX_TOKENS = 16384  # Larger for detailed designs
_DEFAULT_TEMPERATURE = 0.2  # Lower for technical precision
_DEFAULT_ARTIFACT_BASE_PATH = Path("artifacts/design")
_DEFAULT_ENABLE_RLM = True
_DEFAULT_RLM_CONTEXT_THRESHOLD = 100_000
_DEFAULT_CONTEXT_PACK_REQUIRED = True
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_RETRY_DELAY_SECONDS = 1.0


@dataclass
class DesignConfig:
    """Configuration for Design agents.

    Attributes:
        surveyor_model: LLM model for technology survey.
        architect_model: LLM model for architecture design.
        planner_model: LLM model for implementation planning.
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation.
        artifact_base_path: Base path for artifact output.
        enable_rlm: Whether to enable RLM integration.
        rlm_context_threshold: Token threshold for RLM activation.
        context_pack_required: Whether context pack is required.
        max_retries: Maximum retry attempts on failure.
        retry_delay_seconds: Delay between retries.
    """

    surveyor_model: str = _DEFAULT_SURVEYOR_MODEL
    architect_model: str = _DEFAULT_ARCHITECT_MODEL
    planner_model: str = _DEFAULT_PLANNER_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    artifact_base_path: Path = field(default_factory=lambda: _DEFAULT_ARTIFACT_BASE_PATH)
    enable_rlm: bool = _DEFAULT_ENABLE_RLM
    rlm_context_threshold: int = _DEFAULT_RLM_CONTEXT_THRESHOLD
    context_pack_required: bool = _DEFAULT_CONTEXT_PACK_REQUIRED
    max_retries: int = _DEFAULT_MAX_RETRIES
    retry_delay_seconds: float = _DEFAULT_RETRY_DELAY_SECONDS

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

        if self.max_retries < 0:
            raise ConfigValidationError(
                f"max_retries must be non-negative, got {self.max_retries}"
            )

        if self.rlm_context_threshold < 1000:
            raise ConfigValidationError(
                f"rlm_context_threshold must be at least 1000, got {self.rlm_context_threshold}"
            )

        if self.retry_delay_seconds < 0:
            raise ConfigValidationError(
                f"retry_delay_seconds must be non-negative, got {self.retry_delay_seconds}"
            )

    @classmethod
    def from_env(cls) -> DesignConfig:
        """Create configuration from environment variables.

        Environment variables:
            DESIGN_SURVEYOR_MODEL: Model for technology survey
            DESIGN_ARCHITECT_MODEL: Model for architecture design
            DESIGN_PLANNER_MODEL: Model for implementation planning
            DESIGN_MAX_TOKENS: Maximum tokens for LLM responses
            DESIGN_TEMPERATURE: LLM temperature
            DESIGN_ARTIFACT_PATH: Base path for artifacts
            DESIGN_ENABLE_RLM: Enable RLM integration (true/false)
            DESIGN_RLM_THRESHOLD: Token threshold for RLM
            DESIGN_CONTEXT_PACK_REQUIRED: Require context pack (true/false)
            DESIGN_MAX_RETRIES: Maximum retry attempts
            DESIGN_RETRY_DELAY: Delay between retries in seconds

        Returns:
            DesignConfig: Configuration from environment.
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

        artifact_path = os.getenv("DESIGN_ARTIFACT_PATH")

        return cls(
            surveyor_model=os.getenv("DESIGN_SURVEYOR_MODEL", _DEFAULT_SURVEYOR_MODEL),
            architect_model=os.getenv("DESIGN_ARCHITECT_MODEL", _DEFAULT_ARCHITECT_MODEL),
            planner_model=os.getenv("DESIGN_PLANNER_MODEL", _DEFAULT_PLANNER_MODEL),
            max_tokens=get_int("DESIGN_MAX_TOKENS", _DEFAULT_MAX_TOKENS),
            temperature=get_float("DESIGN_TEMPERATURE", _DEFAULT_TEMPERATURE),
            artifact_base_path=Path(artifact_path) if artifact_path else _DEFAULT_ARTIFACT_BASE_PATH,
            enable_rlm=get_bool("DESIGN_ENABLE_RLM", _DEFAULT_ENABLE_RLM),
            rlm_context_threshold=get_int("DESIGN_RLM_THRESHOLD", _DEFAULT_RLM_CONTEXT_THRESHOLD),
            context_pack_required=get_bool("DESIGN_CONTEXT_PACK_REQUIRED", _DEFAULT_CONTEXT_PACK_REQUIRED),
            max_retries=get_int("DESIGN_MAX_RETRIES", _DEFAULT_MAX_RETRIES),
            retry_delay_seconds=get_float("DESIGN_RETRY_DELAY", _DEFAULT_RETRY_DELAY_SECONDS),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary.

        Returns:
            dict: Configuration as dictionary.
        """
        return {
            "surveyor_model": self.surveyor_model,
            "architect_model": self.architect_model,
            "planner_model": self.planner_model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "artifact_base_path": str(self.artifact_base_path),
            "enable_rlm": self.enable_rlm,
            "rlm_context_threshold": self.rlm_context_threshold,
            "context_pack_required": self.context_pack_required,
            "max_retries": self.max_retries,
            "retry_delay_seconds": self.retry_delay_seconds,
        }

    def with_overrides(self, **kwargs: Any) -> DesignConfig:
        """Create new config with overridden values.

        Args:
            **kwargs: Values to override.

        Returns:
            DesignConfig: New config with overrides.
        """
        current = self.to_dict()
        current.update(kwargs)

        # Handle Path conversion
        if isinstance(current.get("artifact_base_path"), str):
            current["artifact_base_path"] = Path(current["artifact_base_path"])

        return DesignConfig(**current)
