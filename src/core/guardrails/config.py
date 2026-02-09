"""Configuration for the guardrails system.

Provides environment-based configuration for guardrails evaluation
and enforcement.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class GuardrailsConfig:
    """Configuration for the guardrails system.

    Attributes:
        enabled: Master enable/disable flag for guardrails.
        elasticsearch_url: URL for Elasticsearch connection.
        index_prefix: Tenant prefix for Elasticsearch indices.
        cache_ttl: Seconds to cache enabled guidelines.
        fallback_mode: Behavior when Elasticsearch is unavailable:
            "permissive" or "restrictive".
    """

    enabled: bool = True
    elasticsearch_url: str = "http://localhost:9200"
    index_prefix: str = ""
    cache_ttl: float = 60.0
    fallback_mode: str = "permissive"

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
                (default: permissive).

        Returns:
            GuardrailsConfig instance with values from environment.
        """
        # Parse enabled boolean: accept "true" or "1" (case-insensitive) as True
        enabled_str = os.getenv("GUARDRAILS_ENABLED", "true").lower()
        enabled = enabled_str in ("true", "1")

        return cls(
            enabled=enabled,
            elasticsearch_url=os.getenv(
                "ELASTICSEARCH_URL", "http://localhost:9200"
            ),
            index_prefix=os.getenv("GUARDRAILS_INDEX_PREFIX", ""),
            cache_ttl=float(os.getenv("GUARDRAILS_CACHE_TTL", "60.0")),
            fallback_mode=os.getenv("GUARDRAILS_FALLBACK_MODE", "permissive"),
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
        }
