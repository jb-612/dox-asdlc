"""Caching secrets client with GCP primary and Infisical fallback."""

from __future__ import annotations
import logging
from typing import Any

from src.infrastructure.secrets.client import SecretsClient

logger = logging.getLogger(__name__)


class CachingSecretsClient(SecretsClient):
    """GCP-primary with Infisical cache fallback.

    This client implements a caching pattern where:
    - GCP Secret Manager is the source of truth
    - Infisical serves as a local cache for resilience
    - On successful GCP reads, values are cached to Infisical
    - On GCP failure, cached values from Infisical are used (read-only mode)
    - Writes always require GCP connectivity

    Environment variables:
    - Inherits from GCPSecretsClient and InfisicalSecretsClient
    """

    def __init__(
        self, gcp_client: SecretsClient, infisical_client: SecretsClient
    ) -> None:
        """Initialize with GCP primary and Infisical cache clients.

        Args:
            gcp_client: Primary GCP Secret Manager client
            infisical_client: Infisical client for caching
        """
        self.primary = gcp_client
        self.cache = infisical_client
        self._using_cache = False
        self._cache_warning_shown = False

    @property
    def backend_type(self) -> str:
        """Return the backend type identifier.

        Returns:
            'gcp' when using primary, 'infisical (cached)' when in fallback mode
        """
        return "infisical (cached)" if self._using_cache else "gcp"

    async def get_secret(self, name: str, environment: str = "dev") -> str | None:
        """Get a secret value, with automatic fallback to cache.

        Attempts to get from GCP first. On success, updates the local cache.
        On failure, falls back to the cached value in Infisical.

        Args:
            name: Secret name (e.g., "SLACK_BOT_TOKEN")
            environment: Environment scope (dev, staging, prod)

        Returns:
            Secret value or None if not found in either backend
        """
        try:
            value = await self.primary.get_secret(name, environment)
            if value is not None:
                await self._update_cache(name, value, environment)
                self._using_cache = False
                return value
            return None
        except Exception as e:
            logger.warning(f"GCP unavailable ({e}), using Infisical cache")
            self._using_cache = True
            self._show_cache_warning()
            return await self.cache.get_secret(name, environment)

    async def _update_cache(
        self, name: str, value: str, environment: str
    ) -> None:
        """Update the Infisical cache with a value from GCP.

        Args:
            name: Secret name
            value: Secret value
            environment: Environment scope
        """
        try:
            await self.cache.set_secret(name, value, environment)
        except Exception as e:
            logger.debug(f"Failed to update cache for {name}: {e}")

    def _show_cache_warning(self) -> None:
        """Show a warning about running in cached mode (once per session)."""
        if not self._cache_warning_shown:
            logger.warning(
                "Running with CACHED secrets - may be stale. GCP unreachable."
            )
            self._cache_warning_shown = True

    async def set_secret(
        self, name: str, value: str, environment: str = "dev"
    ) -> bool:
        """Create or update a secret.

        Writes require GCP connection - no writes in cache-only mode.
        On successful GCP write, also updates the local cache (best-effort).

        Args:
            name: Secret name
            value: Secret value
            environment: Environment scope

        Returns:
            True if successful, False if GCP unreachable
        """
        try:
            result = await self.primary.set_secret(name, value, environment)
            if result:
                try:
                    await self.cache.set_secret(name, value, environment)
                except Exception:
                    pass  # Cache update is best-effort
            return result
        except Exception as e:
            logger.error(
                f"Cannot set secret: GCP unavailable ({e}). Writes require GCP."
            )
            return False

    async def list_secrets(self, environment: str = "dev") -> list[str]:
        """List all secret names for an environment.

        Attempts GCP first, falls back to cache on failure.

        Args:
            environment: Environment scope

        Returns:
            List of secret names
        """
        try:
            return await self.primary.list_secrets(environment)
        except Exception as e:
            logger.warning(f"GCP unavailable ({e}), listing from cache")
            self._using_cache = True
            self._show_cache_warning()
            return await self.cache.list_secrets(environment)

    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        """Delete a secret.

        Deletes require GCP connection. On success, also removes from cache.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            True if deleted, False if GCP unreachable or not found
        """
        try:
            result = await self.primary.delete_secret(name, environment)
            if result:
                try:
                    await self.cache.delete_secret(name, environment)
                except Exception:
                    pass  # Cache delete is best-effort
            return result
        except Exception as e:
            logger.error(
                f"Cannot delete: GCP unavailable ({e}). Deletes require GCP."
            )
            return False

    async def test_secret(self, name: str, environment: str = "dev") -> dict[str, Any]:
        """Test a secret (e.g., verify Slack token works).

        When running in cache mode, adds a warning to the result.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            Dict with 'success', 'message', and optional 'details' and 'warning'
        """
        if self._using_cache:
            result = await self.cache.test_secret(name, environment)
            result["warning"] = (
                "Testing CACHED value - may not reflect current GCP state"
            )
            return result
        try:
            return await self.primary.test_secret(name, environment)
        except Exception as e:
            self._using_cache = True
            result = await self.cache.test_secret(name, environment)
            result["warning"] = f"Tested CACHED value - GCP unreachable: {e}"
            return result

    async def health_check(self) -> dict[str, Any]:
        """Check the health of both primary and cache backends.

        Returns:
            Dict with 'using_cache', 'primary', and 'cache' status
        """
        result: dict[str, Any] = {
            "using_cache": self._using_cache,
            "primary": {},
            "cache": {},
        }
        try:
            primary_health = await self.primary.health_check()
            result["primary"] = {"status": "healthy", **primary_health}
        except Exception as e:
            result["primary"] = {"status": "unhealthy", "error": str(e)}
        try:
            cache_health = await self.cache.health_check()
            result["cache"] = {"status": "healthy", **cache_health}
        except Exception as e:
            result["cache"] = {"status": "unhealthy", "error": str(e)}
        return result
