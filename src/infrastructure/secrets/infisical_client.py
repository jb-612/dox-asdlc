"""Infisical secrets client implementation."""

import os
import logging
from typing import Optional
import aiohttp

from src.infrastructure.secrets.client import SecretsClient

logger = logging.getLogger(__name__)


class InfisicalSecretsClient(SecretsClient):
    """Infisical secrets client using REST API.

    Environment variables:
    - INFISICAL_URL: Infisical server URL (default: http://localhost:8086)
    - INFISICAL_CLIENT_ID: Machine identity client ID
    - INFISICAL_CLIENT_SECRET: Machine identity client secret
    - INFISICAL_PROJECT_ID: Project ID for secrets
    """

    def __init__(self):
        """Initialize Infisical client with configuration from environment."""
        self.base_url = os.environ.get("INFISICAL_URL", "http://localhost:8086")
        self.client_id = os.environ.get("INFISICAL_CLIENT_ID", "")
        self.client_secret = os.environ.get("INFISICAL_CLIENT_SECRET", "")
        self.project_id = os.environ.get("INFISICAL_PROJECT_ID", "")
        self._access_token: Optional[str] = None

    @property
    def backend_type(self) -> str:
        """Return the backend type identifier."""
        return "infisical"

    async def health_check(self) -> dict:
        """Check connection to Infisical server.

        Returns:
            Dict with connected status and version info
        """
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/status"
                ) as resp:
                    if resp.status == 200:
                        return {"connected": True, "url": self.base_url}
                    return {"connected": False, "error": f"Status {resp.status}"}
        except Exception as e:
            return {"connected": False, "error": str(e)}

    async def _get_access_token(self) -> str:
        """Get or refresh access token using machine identity.

        Returns:
            Valid access token

        Raises:
            ValueError: If authentication fails or credentials missing
        """
        if self._access_token:
            return self._access_token

        if not self.client_id or not self.client_secret:
            raise ValueError(
                "INFISICAL_CLIENT_ID and INFISICAL_CLIENT_SECRET required"
            )

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/v1/auth/universal-auth/login",
                json={
                    "clientId": self.client_id,
                    "clientSecret": self.client_secret,
                },
            ) as resp:
                if resp.status != 200:
                    raise ValueError(f"Failed to authenticate: {await resp.text()}")
                data = await resp.json()
                self._access_token = data["accessToken"]
                return self._access_token

    async def _request(
        self, method: str, path: str, **kwargs
    ) -> dict:
        """Make authenticated request to Infisical API.

        Args:
            method: HTTP method (GET, POST, DELETE, etc.)
            path: API path (e.g., /api/v3/secrets/raw)
            **kwargs: Additional arguments for aiohttp request

        Returns:
            JSON response as dict
        """
        token = await self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with aiohttp.ClientSession() as session:
            async with session.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                **kwargs,
            ) as resp:
                if resp.status == 401:
                    # Token expired, retry once
                    self._access_token = None
                    token = await self._get_access_token()
                    headers = {"Authorization": f"Bearer {token}"}
                    async with session.request(
                        method, f"{self.base_url}{path}", headers=headers, **kwargs
                    ) as retry_resp:
                        return await retry_resp.json()
                return await resp.json()

    async def get_secret(self, name: str, environment: str = "dev") -> Optional[str]:
        """Get a secret value from Infisical.

        Args:
            name: Secret key name
            environment: Environment scope (dev, staging, prod)

        Returns:
            Secret value or None if not found
        """
        try:
            data = await self._request(
                "GET",
                f"/api/v3/secrets/raw/{name}",
                params={
                    "workspaceId": self.project_id,
                    "environment": environment,
                },
            )
            return data.get("secret", {}).get("secretValue")
        except Exception as e:
            logger.warning(f"Failed to get secret {name}: {e}")
            return None

    async def list_secrets(self, environment: str = "dev") -> list[str]:
        """List all secret names in the project.

        Args:
            environment: Environment scope

        Returns:
            List of secret key names
        """
        try:
            data = await self._request(
                "GET",
                "/api/v3/secrets/raw",
                params={
                    "workspaceId": self.project_id,
                    "environment": environment,
                },
            )
            return [s["secretKey"] for s in data.get("secrets", [])]
        except Exception as e:
            logger.warning(f"Failed to list secrets: {e}")
            return []

    async def set_secret(
        self, name: str, value: str, environment: str = "dev"
    ) -> bool:
        """Create or update a secret in Infisical.

        Args:
            name: Secret key name
            value: Secret value
            environment: Environment scope

        Returns:
            True if successful
        """
        try:
            await self._request(
                "POST",
                "/api/v3/secrets/raw",
                json={
                    "workspaceId": self.project_id,
                    "environment": environment,
                    "secretKey": name,
                    "secretValue": value,
                },
            )
            return True
        except Exception as e:
            logger.error(f"Failed to set secret {name}: {e}")
            return False

    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        """Delete a secret from Infisical.

        Args:
            name: Secret key name
            environment: Environment scope

        Returns:
            True if deleted
        """
        try:
            await self._request(
                "DELETE",
                f"/api/v3/secrets/raw/{name}",
                params={
                    "workspaceId": self.project_id,
                    "environment": environment,
                },
            )
            return True
        except Exception as e:
            logger.error(f"Failed to delete secret {name}: {e}")
            return False

    async def test_secret(self, name: str, environment: str = "dev") -> dict:
        """Test a secret - for Slack tokens, actually test the connection.

        Args:
            name: Secret key name
            environment: Environment scope

        Returns:
            Dict with 'success', 'message', and optional 'details'
        """
        value = await self.get_secret(name, environment)
        if not value:
            return {"success": False, "message": "Secret not found"}

        # Special handling for Slack tokens
        if "SLACK" in name.upper() and "TOKEN" in name.upper():
            return await self._test_slack_token(name, value)

        return {"success": True, "message": "Secret exists"}

    async def _test_slack_token(self, name: str, token: str) -> dict:
        """Test a Slack token by calling auth.test and optionally sending a message.

        Args:
            name: Secret name (for logging)
            token: Slack token value

        Returns:
            Dict with test results
        """
        async with aiohttp.ClientSession() as session:
            # Call auth.test
            async with session.post(
                "https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {token}"},
            ) as resp:
                data = await resp.json()
                if not data.get("ok"):
                    return {
                        "success": False,
                        "message": f"Slack auth failed: {data.get('error')}",
                    }

                team = data.get("team", "Unknown")
                user_id = data.get("user_id", "")

                # Try to send a test message
                test_channel = os.environ.get("SLACK_TEST_CHANNEL", user_id)

                async with session.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "channel": test_channel,
                        "text": "aSDLC Slack integration test\nStatus: Connection verified",
                    },
                ) as msg_resp:
                    msg_data = await msg_resp.json()

                    if msg_data.get("ok"):
                        return {
                            "success": True,
                            "message": "Token valid and test message sent",
                            "details": {
                                "team": team,
                                "channel": msg_data.get("channel", test_channel),
                                "message_ts": msg_data.get("ts", ""),
                            },
                        }
                    else:
                        return {
                            "success": True,
                            "message": f"Token valid but could not send test message: {msg_data.get('error')}",
                            "details": {"team": team},
                        }
