"""Configuration for the guardrails system.

Provides environment-based configuration for guardrails evaluation
and enforcement.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Any

from src.core.exceptions import ConfigurationError

logger = logging.getLogger(__name__)

_VALID_FALLBACK_MODES = ("permissive", "restrictive", "static")
_INDEX_PREFIX_RE = re.compile(r"^[a-zA-Z0-9_-]*$")


@dataclass(frozen=True)
class GuardrailsConfig:
    """Configuration for the guardrails system.

    Attributes:
        enabled: Master enable/disable flag for guardrails.
        elasticsearch_url: URL for Elasticsearch connection.
        index_prefix: Tenant prefix for Elasticsearch indices.
        cache_ttl: Seconds to cache enabled guidelines.
        fallback_mode: Behavior when Elasticsearch is unavailable:
            "permissive", "restrictive", or "static".
            When "static", the evaluator falls back to reading
            guidelines from a local JSON file.
        static_file_path: Path to static guidelines JSON file,
            used when fallback_mode is "static".
    """

    enabled: bool = True
    elasticsearch_url: str = "http://localhost:9200"
    index_prefix: str = ""
    cache_ttl: float = 60.0
    fallback_mode: str = "static"
    static_file_path: str = ".claude/guardrails-static.json"

    @classmethod
    def from_env(cls) -> GuardrailsConfig:
        """Load configuration from environment variables.

        Environment variables:
            GUARDRAILS_ENABLED: Master enable/disable (default: true).
                Accepts "true"/"1" (case-insensitive) as True,
                everything else as False.
            ELASTICSEARCH_URL: Elasticsearch URL (default: http://localhost:9200).
            GUARDRAILS_INDEX_PREFIX: Tenant prefix for indices (default: "").
            GUARDRAILS_CACHE_TTL: Cache TTL in seconds (default: 60.0).
            GUARDRAILS_FALLBACK_MODE: Fallback mode when ES unavailable
                (default: static). Accepts "permissive", "restrictive",
                or "static".
            GUARDRAILS_STATIC_FILE: Path to static guidelines JSON file
                (default: .claude/guardrails-static.json).

        Returns:
            GuardrailsConfig instance with values from environment.
        """
        # Parse enabled boolean: accept "true" or "1" (case-insensitive) as True
        enabled_str = os.getenv("GUARDRAILS_ENABLED", "true").lower()
        enabled = enabled_str in ("true", "1")

        # Validate elasticsearch_url
        elasticsearch_url = os.getenv(
            "ELASTICSEARCH_URL", "http://localhost:9200"
        )
        if not elasticsearch_url.startswith(("http://", "https://")):
            raise ConfigurationError(
                f"Invalid ELASTICSEARCH_URL: {elasticsearch_url!r}. "
                "Must start with http:// or https://",
                details={"field": "elasticsearch_url", "value": elasticsearch_url},
            )

        # Validate index_prefix
        index_prefix = os.getenv("GUARDRAILS_INDEX_PREFIX", "")
        if not _INDEX_PREFIX_RE.match(index_prefix):
            raise ConfigurationError(
                f"Invalid GUARDRAILS_INDEX_PREFIX: {index_prefix!r}. "
                "Must contain only alphanumeric characters, hyphens, and underscores",
                details={"field": "index_prefix", "value": index_prefix},
            )

        # Validate cache_ttl
        try:
            cache_ttl = float(os.getenv("GUARDRAILS_CACHE_TTL", "60.0"))
        except ValueError:
            logger.warning("Invalid GUARDRAILS_CACHE_TTL, using default 60.0")
            cache_ttl = 60.0

        if not (0 <= cache_ttl <= 3600):
            raise ConfigurationError(
                f"Invalid GUARDRAILS_CACHE_TTL: {cache_ttl}. Must be 0-3600 seconds.",
                details={"field": "cache_ttl", "value": cache_ttl},
            )

        # Validate fallback_mode
        fallback_mode = os.getenv("GUARDRAILS_FALLBACK_MODE", "static")
        if fallback_mode not in _VALID_FALLBACK_MODES:
            raise ConfigurationError(
                f"Invalid GUARDRAILS_FALLBACK_MODE: {fallback_mode!r}. "
                f"Must be one of: {', '.join(_VALID_FALLBACK_MODES)}",
                details={"field": "fallback_mode", "value": fallback_mode},
            )

        return cls(
            enabled=enabled,
            elasticsearch_url=elasticsearch_url,
            index_prefix=index_prefix,
            cache_ttl=cache_ttl,
            fallback_mode=fallback_mode,
            static_file_path=os.getenv(
                "GUARDRAILS_STATIC_FILE", ".claude/guardrails-static.json"
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary.

        Returns:
            Dictionary representation of the configuration.
        """
        return {
            "enabled": self.enabled,
            "elasticsearch_url": self.elasticsearch_url,
            "index_prefix": self.index_prefix,
            "cache_ttl": self.cache_ttl,
            "fallback_mode": self.fallback_mode,
            "static_file_path": self.static_file_path,
        }

    def to_safe_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary with sensitive fields redacted.

        Returns:
            Dictionary representation with elasticsearch_url redacted.
        """
        d = self.to_dict()
        if d.get("elasticsearch_url"):
            from urllib.parse import urlparse
            parsed = urlparse(d["elasticsearch_url"])
            d["elasticsearch_url"] = f"{parsed.scheme}://{parsed.hostname}:***"
        return d
