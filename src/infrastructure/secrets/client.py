"""Secrets client abstraction for centralized secrets management.

Supports multiple backends:
- Infisical (self-hosted, for local dev)
- GCP Secret Manager (for cloud environments)
- Caching (GCP primary with Infisical fallback)
- Environment variables (fallback)
"""

from abc import ABC, abstractmethod
from typing import Any, Optional
import os
import logging

logger = logging.getLogger(__name__)


class SecretsClient(ABC):
    """Abstract base class for secrets clients."""

    @property
    @abstractmethod
    def backend_type(self) -> str:
        """Return the backend type identifier.

        Returns:
            Backend type string (e.g., "env", "infisical", "gcp")
        """
        pass

    @abstractmethod
    async def get_secret(self, name: str, environment: str = "dev") -> Optional[str]:
        """Get a secret value by name.

        Args:
            name: Secret name (e.g., "SLACK_BOT_TOKEN")
            environment: Environment scope (dev, staging, prod)

        Returns:
            Secret value or None if not found
        """
        pass

    @abstractmethod
    async def list_secrets(self, environment: str = "dev") -> list[str]:
        """List all secret names for an environment.

        Args:
            environment: Environment scope

        Returns:
            List of secret names
        """
        pass

    @abstractmethod
    async def set_secret(
        self, name: str, value: str, environment: str = "dev"
    ) -> bool:
        """Create or update a secret.

        Args:
            name: Secret name
            value: Secret value
            environment: Environment scope

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        """Delete a secret.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            True if deleted, False if not found
        """
        pass

    @abstractmethod
    async def test_secret(self, name: str, environment: str = "dev") -> dict:
        """Test a secret (e.g., verify Slack token works).

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            Dict with 'success', 'message', and optional 'details'
        """
        pass

    async def health_check(self) -> dict[str, Any]:
        """Check the health of the secrets backend.

        Returns:
            Dict with health status information
        """
        # Default implementation - override in subclasses
        return {"connected": True}


class EnvironmentSecretsClient(SecretsClient):
    """Fallback client that reads from environment variables."""

    @property
    def backend_type(self) -> str:
        """Return the backend type identifier."""
        return "env"

    async def get_secret(self, name: str, environment: str = "dev") -> Optional[str]:
        """Get a secret from environment variables.

        Args:
            name: Environment variable name
            environment: Ignored for env vars

        Returns:
            Environment variable value or None
        """
        return os.environ.get(name)

    async def list_secrets(self, environment: str = "dev") -> list[str]:
        """List known secret names that exist in environment.

        Args:
            environment: Ignored for env vars

        Returns:
            List of known secret names that are set
        """
        known_secrets = [
            "SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "SLACK_SIGNING_SECRET",
            "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY",
        ]
        return [s for s in known_secrets if os.environ.get(s)]

    async def set_secret(
        self, name: str, value: str, environment: str = "dev"
    ) -> bool:
        """Cannot persist secrets with environment client.

        Args:
            name: Secret name
            value: Secret value
            environment: Ignored

        Returns:
            False (cannot persist)
        """
        logger.warning("EnvironmentSecretsClient cannot persist secrets")
        return False

    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        """Cannot delete secrets with environment client.

        Args:
            name: Secret name
            environment: Ignored

        Returns:
            False (cannot delete)
        """
        logger.warning("EnvironmentSecretsClient cannot delete secrets")
        return False

    async def test_secret(self, name: str, environment: str = "dev") -> dict:
        """Test if a secret exists in environment.

        Args:
            name: Environment variable name
            environment: Ignored

        Returns:
            Dict with success status and message
        """
        value = await self.get_secret(name, environment)
        if value:
            return {"success": True, "message": "Secret exists in environment"}
        return {"success": False, "message": "Secret not found in environment"}

    async def health_check(self) -> dict[str, Any]:
        """Environment client is always healthy.

        Returns:
            Dict indicating healthy status
        """
        return {"connected": True, "source": "environment variables"}


_client: Optional[SecretsClient] = None


def get_secrets_client() -> SecretsClient:
    """Get the configured secrets client.

    Returns appropriate client based on SECRETS_BACKEND env var:
    - "infisical": InfisicalSecretsClient
    - "gcp": GCPSecretsClient
    - "caching": CachingSecretsClient (GCP primary with Infisical cache)
    - "env" or default: EnvironmentSecretsClient

    Returns:
        Configured SecretsClient instance
    """
    global _client
    if _client is not None:
        return _client

    backend = os.environ.get("SECRETS_BACKEND", "env").lower()

    if backend == "infisical":
        from src.infrastructure.secrets.infisical_client import InfisicalSecretsClient
        _client = InfisicalSecretsClient()
        logger.info("Using Infisical secrets backend")
    elif backend == "gcp":
        from src.infrastructure.secrets.gcp_client import GCPSecretsClient
        _client = GCPSecretsClient()
        logger.info("Using GCP Secret Manager backend")
    elif backend == "caching":
        from src.infrastructure.secrets.gcp_client import GCPSecretsClient
        from src.infrastructure.secrets.infisical_client import InfisicalSecretsClient
        from src.infrastructure.secrets.caching_client import CachingSecretsClient
        _client = CachingSecretsClient(GCPSecretsClient(), InfisicalSecretsClient())
        logger.info("Using GCP-primary with Infisical cache backend")
    else:
        _client = EnvironmentSecretsClient()
        logger.info("Using environment variables for secrets (fallback)")

    return _client


async def reset_secrets_client() -> None:
    """Reset the cached client (for testing)."""
    global _client
    _client = None
