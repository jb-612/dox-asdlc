"""Configuration for Deployment agents.

Provides configuration dataclass with sensible defaults and
environment variable overrides for Release, Deployment, and Monitor agents.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class DeploymentConfigValidationError(Exception):
    """Raised when configuration validation fails."""

    pass


class DeploymentStrategy(Enum):
    """Deployment strategy options.

    Attributes:
        ROLLING: Rolling update strategy - gradual replacement of instances.
        BLUE_GREEN: Blue-green deployment - switch traffic between environments.
        CANARY: Canary deployment - gradual traffic shift to new version.
    """

    ROLLING = "rolling"
    BLUE_GREEN = "blue-green"
    CANARY = "canary"


# Default values as constants for class method access
_DEFAULT_RELEASE_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_DEPLOYMENT_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MONITOR_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MAX_TOKENS = 8192
_DEFAULT_TEMPERATURE = 0.1  # Low for precise deployment
_DEFAULT_ARTIFACT_BASE_PATH = Path("artifacts/deployment")
_DEFAULT_ROLLBACK_ENABLED = True
_DEFAULT_CANARY_PERCENTAGE = 10
_DEFAULT_HEALTH_CHECK_INTERVAL = 30
_DEFAULT_DEPLOYMENT_STRATEGY = DeploymentStrategy.ROLLING


@dataclass
class DeploymentConfig:
    """Configuration for Deployment agents.

    Attributes:
        release_model: LLM model for release management.
        deployment_model: LLM model for deployment planning.
        monitor_model: LLM model for monitoring configuration.
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation (low for precise deployment).
        artifact_base_path: Base path for artifact output.
        rollback_enabled: Whether rollback is enabled on failure.
        canary_percentage: Initial percentage for canary deployments.
        health_check_interval: Interval between health checks in seconds.
        deployment_strategy: Default deployment strategy.
    """

    release_model: str = _DEFAULT_RELEASE_MODEL
    deployment_model: str = _DEFAULT_DEPLOYMENT_MODEL
    monitor_model: str = _DEFAULT_MONITOR_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    artifact_base_path: Path = field(default_factory=lambda: _DEFAULT_ARTIFACT_BASE_PATH)
    rollback_enabled: bool = _DEFAULT_ROLLBACK_ENABLED
    canary_percentage: int = _DEFAULT_CANARY_PERCENTAGE
    health_check_interval: int = _DEFAULT_HEALTH_CHECK_INTERVAL
    deployment_strategy: DeploymentStrategy = _DEFAULT_DEPLOYMENT_STRATEGY

    def __post_init__(self) -> None:
        """Validate configuration after initialization."""
        self._validate()

    def _validate(self) -> None:
        """Validate configuration values.

        Raises:
            DeploymentConfigValidationError: If validation fails.
        """
        if self.max_tokens < 100:
            raise DeploymentConfigValidationError(
                f"max_tokens must be at least 100, got {self.max_tokens}"
            )

        if not 0 <= self.temperature <= 2:
            raise DeploymentConfigValidationError(
                f"temperature must be between 0 and 2, got {self.temperature}"
            )

        if not 1 <= self.canary_percentage <= 100:
            raise DeploymentConfigValidationError(
                f"canary_percentage must be between 1 and 100, got {self.canary_percentage}"
            )

        if self.health_check_interval <= 0:
            raise DeploymentConfigValidationError(
                f"health_check_interval must be positive, got {self.health_check_interval}"
            )

    @classmethod
    def from_env(cls) -> DeploymentConfig:
        """Create configuration from environment variables.

        Environment variables:
            DEPLOYMENT_RELEASE_MODEL: Model for release management
            DEPLOYMENT_DEPLOY_MODEL: Model for deployment planning
            DEPLOYMENT_MONITOR_MODEL: Model for monitoring
            DEPLOYMENT_MAX_TOKENS: Maximum tokens for LLM responses
            DEPLOYMENT_TEMPERATURE: LLM temperature
            DEPLOYMENT_ARTIFACT_PATH: Base path for artifacts
            DEPLOYMENT_ROLLBACK_ENABLED: Enable rollback (true/false)
            DEPLOYMENT_CANARY_PERCENTAGE: Initial canary percentage
            DEPLOYMENT_HEALTH_CHECK_INTERVAL: Health check interval in seconds
            DEPLOYMENT_STRATEGY: Deployment strategy (rolling/blue-green/canary)

        Returns:
            DeploymentConfig: Configuration from environment.
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

        def get_strategy(key: str, default: DeploymentStrategy) -> DeploymentStrategy:
            value = os.getenv(key)
            if value is None:
                return default
            return DeploymentStrategy(value)

        artifact_path = os.getenv("DEPLOYMENT_ARTIFACT_PATH")

        return cls(
            release_model=os.getenv("DEPLOYMENT_RELEASE_MODEL", _DEFAULT_RELEASE_MODEL),
            deployment_model=os.getenv("DEPLOYMENT_DEPLOY_MODEL", _DEFAULT_DEPLOYMENT_MODEL),
            monitor_model=os.getenv("DEPLOYMENT_MONITOR_MODEL", _DEFAULT_MONITOR_MODEL),
            max_tokens=get_int("DEPLOYMENT_MAX_TOKENS", _DEFAULT_MAX_TOKENS),
            temperature=get_float("DEPLOYMENT_TEMPERATURE", _DEFAULT_TEMPERATURE),
            artifact_base_path=Path(artifact_path) if artifact_path else _DEFAULT_ARTIFACT_BASE_PATH,
            rollback_enabled=get_bool("DEPLOYMENT_ROLLBACK_ENABLED", _DEFAULT_ROLLBACK_ENABLED),
            canary_percentage=get_int("DEPLOYMENT_CANARY_PERCENTAGE", _DEFAULT_CANARY_PERCENTAGE),
            health_check_interval=get_int("DEPLOYMENT_HEALTH_CHECK_INTERVAL", _DEFAULT_HEALTH_CHECK_INTERVAL),
            deployment_strategy=get_strategy("DEPLOYMENT_STRATEGY", _DEFAULT_DEPLOYMENT_STRATEGY),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary.

        Returns:
            dict: Configuration as dictionary.
        """
        return {
            "release_model": self.release_model,
            "deployment_model": self.deployment_model,
            "monitor_model": self.monitor_model,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "artifact_base_path": str(self.artifact_base_path),
            "rollback_enabled": self.rollback_enabled,
            "canary_percentage": self.canary_percentage,
            "health_check_interval": self.health_check_interval,
            "deployment_strategy": self.deployment_strategy.value,
        }

    def with_overrides(self, **kwargs: Any) -> DeploymentConfig:
        """Create new config with overridden values.

        Args:
            **kwargs: Values to override.

        Returns:
            DeploymentConfig: New config with overrides.
        """
        current = self.to_dict()
        current.update(kwargs)

        # Handle Path conversion
        if isinstance(current.get("artifact_base_path"), str):
            current["artifact_base_path"] = Path(current["artifact_base_path"])

        # Handle DeploymentStrategy conversion
        strategy = current.get("deployment_strategy")
        if isinstance(strategy, str):
            current["deployment_strategy"] = DeploymentStrategy(strategy)

        return DeploymentConfig(**current)
