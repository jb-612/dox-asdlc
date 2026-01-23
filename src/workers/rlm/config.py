"""Configuration for RLM (Recursive LLM) exploration.

Loads configuration from environment variables with sensible defaults.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class RLMConfig:
    """Configuration for RLM exploration.

    Attributes:
        max_subcalls: Total sub-call budget per task
        max_subcalls_per_iteration: Maximum calls per exploration step
        timeout_seconds: Hard wall time limit in seconds
        model: Model to use for sub-calls
        max_tokens_per_subcall: Token limit per sub-query
        cache_enabled: Whether to enable sub-call caching
        audit_dir: Directory for audit logs
        repo_root: Root path of the repository being explored
    """

    max_subcalls: int = 50
    max_subcalls_per_iteration: int = 8
    timeout_seconds: int = 300
    model: str = "claude-3-5-haiku-20241022"
    max_tokens_per_subcall: int = 500
    cache_enabled: bool = True
    audit_dir: str = "telemetry/rlm"
    repo_root: str = "."

    @classmethod
    def from_env(cls) -> RLMConfig:
        """Load configuration from environment variables.

        Environment variables:
            RLM_MAX_SUBCALLS: Total sub-call budget (default: 50)
            RLM_MAX_PER_ITERATION: Max calls per iteration (default: 8)
            RLM_TIMEOUT: Timeout in seconds (default: 300)
            RLM_MODEL: Sub-call model (default: claude-3-5-haiku-20241022)
            RLM_MAX_TOKENS_PER_SUBCALL: Token limit per call (default: 500)
            RLM_CACHE_ENABLED: Enable caching (default: true)
            RLM_AUDIT_DIR: Audit log directory (default: telemetry/rlm)
            RLM_REPO_ROOT: Repository root path (default: .)

        Returns:
            RLMConfig instance with environment-based values
        """
        return cls(
            max_subcalls=int(os.getenv("RLM_MAX_SUBCALLS", "50")),
            max_subcalls_per_iteration=int(os.getenv("RLM_MAX_PER_ITERATION", "8")),
            timeout_seconds=int(os.getenv("RLM_TIMEOUT", "300")),
            model=os.getenv("RLM_MODEL", "claude-3-5-haiku-20241022"),
            max_tokens_per_subcall=int(os.getenv("RLM_MAX_TOKENS_PER_SUBCALL", "500")),
            cache_enabled=os.getenv("RLM_CACHE_ENABLED", "true").lower() == "true",
            audit_dir=os.getenv("RLM_AUDIT_DIR", "telemetry/rlm"),
            repo_root=os.getenv("RLM_REPO_ROOT", "."),
        )

    def ensure_audit_dir(self) -> Path:
        """Ensure audit directory exists and return its path.

        Returns:
            Path to the audit directory
        """
        path = Path(self.audit_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def validate(self) -> list[str]:
        """Validate configuration values.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors: list[str] = []

        if self.max_subcalls < 1:
            errors.append("max_subcalls must be at least 1")

        if self.max_subcalls_per_iteration < 1:
            errors.append("max_subcalls_per_iteration must be at least 1")

        if self.max_subcalls_per_iteration > self.max_subcalls:
            errors.append(
                "max_subcalls_per_iteration cannot exceed max_subcalls"
            )

        if self.timeout_seconds < 1:
            errors.append("timeout_seconds must be at least 1")

        if self.max_tokens_per_subcall < 1:
            errors.append("max_tokens_per_subcall must be at least 1")

        if not self.model:
            errors.append("model cannot be empty")

        return errors

    def to_dict(self) -> dict:
        """Convert to dictionary for logging/serialization.

        Returns:
            Dictionary representation
        """
        return {
            "max_subcalls": self.max_subcalls,
            "max_subcalls_per_iteration": self.max_subcalls_per_iteration,
            "timeout_seconds": self.timeout_seconds,
            "model": self.model,
            "max_tokens_per_subcall": self.max_tokens_per_subcall,
            "cache_enabled": self.cache_enabled,
            "audit_dir": self.audit_dir,
            "repo_root": self.repo_root,
        }
