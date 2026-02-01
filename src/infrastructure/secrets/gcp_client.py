"""GCP Secret Manager client implementation."""

import os
import logging
from typing import Optional

from src.infrastructure.secrets.client import SecretsClient

logger = logging.getLogger(__name__)

# Known environment prefixes used for filtering
KNOWN_ENV_PREFIXES = ["dev_", "staging_", "test_"]


class GCPSecretsClient(SecretsClient):
    """GCP Secret Manager client.

    Environment variables:
    - GCP_PROJECT_ID: GCP project ID
    - GOOGLE_APPLICATION_CREDENTIALS: Path to service account key (optional)
    """

    def __init__(self):
        """Initialize GCP client with configuration from environment."""
        self.project_id = os.environ.get("GCP_PROJECT_ID", "")
        self._client = None

    @property
    def backend_type(self) -> str:
        """Return the backend type identifier."""
        return "gcp"

    async def health_check(self) -> dict:
        """Check connection to GCP Secret Manager.

        Returns:
            Dict with connected status and project info
        """
        try:
            client = self._get_client()
            # Try to list secrets (limited to 1) to verify connection
            parent = f"projects/{self.project_id}"
            request = {"parent": parent, "page_size": 1}
            list(client.list_secrets(request=request))
            return {"connected": True, "project_id": self.project_id}
        except ImportError:
            return {"connected": False, "error": "google-cloud-secret-manager not installed"}
        except Exception as e:
            return {"connected": False, "error": str(e)}

    def _get_client(self):
        """Get or create the Secret Manager client.

        Returns:
            SecretManagerServiceClient instance

        Raises:
            ImportError: If google-cloud-secret-manager is not installed
        """
        if self._client is None:
            try:
                from google.cloud import secretmanager
                self._client = secretmanager.SecretManagerServiceClient()
            except ImportError:
                raise ImportError(
                    "google-cloud-secret-manager package required. "
                    "Install with: pip install google-cloud-secret-manager"
                )
        return self._client

    def _secret_path(self, name: str, environment: str) -> str:
        """Build secret resource path with environment prefix.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            Full GCP secret version path
        """
        # Convention: secrets are named {environment}_{name}
        secret_name = f"{environment}_{name}" if environment != "prod" else name
        return f"projects/{self.project_id}/secrets/{secret_name}/versions/latest"

    def _secret_parent(self, name: str, environment: str) -> str:
        """Build secret parent path.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            GCP secret parent path
        """
        secret_name = f"{environment}_{name}" if environment != "prod" else name
        return f"projects/{self.project_id}/secrets/{secret_name}"

    async def get_secret(self, name: str, environment: str = "dev") -> Optional[str]:
        """Get a secret value from GCP Secret Manager.

        Args:
            name: Secret name
            environment: Environment scope (dev, staging, prod)

        Returns:
            Secret value or None if not found
        """
        try:
            client = self._get_client()
            response = client.access_secret_version(
                request={"name": self._secret_path(name, environment)}
            )
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            logger.warning(f"Failed to get secret {name}: {e}")
            return None

    async def list_secrets(self, environment: str = "dev") -> list[str]:
        """List all secret names in the project.

        Args:
            environment: Environment scope to filter by

        Returns:
            List of secret names (without environment prefix)
        """
        try:
            client = self._get_client()
            parent = f"projects/{self.project_id}"

            secrets = []
            prefix = f"{environment}_" if environment != "prod" else None

            for secret in client.list_secrets(request={"parent": parent}):
                name = secret.name.split("/")[-1]

                if environment == "prod":
                    # For prod, include secrets that don't have known env prefixes
                    has_env_prefix = any(name.startswith(p) for p in KNOWN_ENV_PREFIXES)
                    if not has_env_prefix:
                        secrets.append(name)
                elif prefix and name.startswith(prefix):
                    # For non-prod, strip the prefix
                    secrets.append(name[len(prefix):])

            return secrets
        except Exception as e:
            logger.warning(f"Failed to list secrets: {e}")
            return []

    async def set_secret(
        self, name: str, value: str, environment: str = "dev"
    ) -> bool:
        """Create or update a secret in GCP Secret Manager.

        Args:
            name: Secret name
            value: Secret value
            environment: Environment scope

        Returns:
            True if successful
        """
        try:
            client = self._get_client()
            parent = f"projects/{self.project_id}"
            secret_id = f"{environment}_{name}" if environment != "prod" else name

            # Try to create the secret first
            try:
                client.create_secret(
                    request={
                        "parent": parent,
                        "secret_id": secret_id,
                        "secret": {"replication": {"automatic": {}}},
                    }
                )
            except Exception:
                pass  # Secret may already exist

            # Add the secret version
            client.add_secret_version(
                request={
                    "parent": self._secret_parent(name, environment),
                    "payload": {"data": value.encode("UTF-8")},
                }
            )
            return True
        except Exception as e:
            logger.error(f"Failed to set secret {name}: {e}")
            return False

    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        """Delete a secret from GCP Secret Manager.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            True if deleted
        """
        try:
            client = self._get_client()
            client.delete_secret(
                request={"name": self._secret_parent(name, environment)}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to delete secret {name}: {e}")
            return False

    async def test_secret(self, name: str, environment: str = "dev") -> dict:
        """Test a secret exists and is accessible.

        Args:
            name: Secret name
            environment: Environment scope

        Returns:
            Dict with 'success' and 'message'
        """
        value = await self.get_secret(name, environment)
        if value:
            return {"success": True, "message": "Secret accessible from GCP"}
        return {"success": False, "message": "Secret not found in GCP"}
