"""Unified Secrets Service for credential management.

This module provides a single interface for managing encrypted credentials
used by both LLM providers and third-party integrations (Slack, Teams, GitHub).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import redis.asyncio as redis

from src.orchestrator.utils.encryption import EncryptionService


logger = logging.getLogger(__name__)


class CredentialType(str, Enum):
    """Type of credential being stored."""

    LLM_API_KEY = "llm_api_key"
    SLACK_BOT_TOKEN = "slack_bot_token"
    SLACK_APP_TOKEN = "slack_app_token"
    SLACK_SIGNING_SECRET = "slack_signing_secret"
    TEAMS_CLIENT_ID = "teams_client_id"
    TEAMS_CLIENT_SECRET = "teams_client_secret"
    TEAMS_TENANT_ID = "teams_tenant_id"
    GITHUB_PAT = "github_pat"
    GITHUB_APP_KEY = "github_app_key"


class IntegrationType(str, Enum):
    """Supported third-party integrations."""

    SLACK = "slack"
    TEAMS = "teams"
    GITHUB = "github"


# Redis key patterns for integration credentials
REDIS_INTEGRATION_PREFIX = "integration:creds:"


# Map credential types to integrations
CREDENTIAL_TO_INTEGRATION: dict[str, IntegrationType] = {
    "bot_token": IntegrationType.SLACK,
    "app_token": IntegrationType.SLACK,
    "signing_secret": IntegrationType.SLACK,
    "client_id": IntegrationType.TEAMS,
    "client_secret": IntegrationType.TEAMS,
    "tenant_id": IntegrationType.TEAMS,
    "personal_access_token": IntegrationType.GITHUB,
    "app_private_key": IntegrationType.GITHUB,
}


class SecretsService:
    """Unified secrets management for all integrations.

    Provides CRUD operations for encrypted credentials used by both
    LLM configurations and third-party integrations.

    Uses the same encryption infrastructure as LLM API keys
    (EncryptionService with Fernet/AES).

    Usage:
        service = SecretsService()

        # Store a credential
        cred_id = await service.store(
            integration_type="slack",
            credential_type="bot_token",
            name="Production Slack",
            value="xoxb-...",
        )

        # Retrieve decrypted value
        value = await service.retrieve(cred_id)

        # Test credential
        result = await service.test(cred_id)

        # Delete credential
        await service.delete(cred_id)
    """

    def __init__(self, redis_client: redis.Redis | None = None) -> None:
        """Initialize the secrets service.

        Args:
            redis_client: Optional Redis client. If not provided, will
                create a default client when needed.
        """
        self._redis_client = redis_client
        self._encryption = EncryptionService()

    async def _get_redis(self) -> redis.Redis:
        """Get or create the Redis client."""
        if self._redis_client is None:
            import os

            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                redis_host = os.environ.get("REDIS_HOST", "localhost")
                redis_port = os.environ.get("REDIS_PORT", "6379")
                redis_url = f"redis://{redis_host}:{redis_port}"
            self._redis_client = redis.from_url(redis_url)
        return self._redis_client

    async def store(
        self,
        integration_type: str,
        credential_type: str,
        name: str,
        value: str,
    ) -> str:
        """Store an encrypted credential.

        Args:
            integration_type: Type of integration (slack, teams, github).
            credential_type: Type of credential (bot_token, app_token, etc.).
            name: User-friendly name for the credential.
            value: The plaintext credential value.

        Returns:
            str: The unique credential ID.
        """
        redis_client = await self._get_redis()

        # Generate unique ID with prefix for the integration type
        cred_id = f"cred-{integration_type}-{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)

        # Encrypt the value
        encrypted = self._encryption.encrypt(value)
        masked = EncryptionService.mask_key(value)

        # Store in Redis
        cred_data = {
            "id": cred_id,
            "integration_type": integration_type,
            "credential_type": credential_type,
            "name": name,
            "key_encrypted": encrypted,
            "key_masked": masked,
            "created_at": now.isoformat(),
            "last_used": None,
            "is_valid": True,  # Assume valid until tested
        }

        await redis_client.set(
            f"{REDIS_INTEGRATION_PREFIX}{cred_id}",
            json.dumps(cred_data),
        )

        logger.info(f"Stored credential {cred_id} for {integration_type}")
        return cred_id

    async def retrieve(self, credential_id: str) -> str | None:
        """Retrieve the decrypted value for a credential.

        Args:
            credential_id: The ID of the credential.

        Returns:
            str | None: The decrypted value or None if not found.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(f"{REDIS_INTEGRATION_PREFIX}{credential_id}")

        if not data:
            return None

        cred_dict = json.loads(data)
        encrypted = cred_dict.get("key_encrypted")

        if not encrypted:
            return None

        # Update last_used timestamp
        cred_dict["last_used"] = datetime.now(timezone.utc).isoformat()
        await redis_client.set(
            f"{REDIS_INTEGRATION_PREFIX}{credential_id}",
            json.dumps(cred_dict),
        )

        return self._encryption.decrypt(encrypted)

    async def get_credential_metadata(self, credential_id: str) -> dict[str, Any] | None:
        """Get credential metadata (without decrypting the value).

        Args:
            credential_id: The ID of the credential.

        Returns:
            dict | None: Credential metadata or None if not found.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(f"{REDIS_INTEGRATION_PREFIX}{credential_id}")

        if not data:
            return None

        cred_dict = json.loads(data)
        # Return metadata without the encrypted key
        return {
            "id": cred_dict["id"],
            "integration_type": cred_dict["integration_type"],
            "credential_type": cred_dict["credential_type"],
            "name": cred_dict["name"],
            "key_masked": cred_dict["key_masked"],
            "created_at": cred_dict["created_at"],
            "last_used": cred_dict.get("last_used"),
            "is_valid": cred_dict.get("is_valid", True),
        }

    async def list_credentials(
        self, integration_type: str | None = None
    ) -> list[dict[str, Any]]:
        """List all credentials, optionally filtered by integration type.

        Args:
            integration_type: Optional filter by integration type.

        Returns:
            list[dict]: List of credential metadata (without decrypted values).
        """
        redis_client = await self._get_redis()

        # Find all credential entries
        pattern = f"{REDIS_INTEGRATION_PREFIX}*"
        key_names = await redis_client.keys(pattern)

        if not key_names:
            return []

        result = []
        for key_name in key_names:
            data = await redis_client.get(key_name)
            if data:
                cred_dict = json.loads(data)
                # Filter by integration type if specified
                if integration_type and cred_dict.get("integration_type") != integration_type:
                    continue
                # Return metadata without encrypted key
                result.append({
                    "id": cred_dict["id"],
                    "integration_type": cred_dict["integration_type"],
                    "credential_type": cred_dict["credential_type"],
                    "name": cred_dict["name"],
                    "key_masked": cred_dict["key_masked"],
                    "created_at": cred_dict["created_at"],
                    "last_used": cred_dict.get("last_used"),
                    "is_valid": cred_dict.get("is_valid", True),
                })

        return result

    async def delete(self, credential_id: str) -> bool:
        """Delete a credential.

        Args:
            credential_id: The ID of the credential to delete.

        Returns:
            bool: True if deleted, False if not found.
        """
        redis_client = await self._get_redis()
        deleted = await redis_client.delete(f"{REDIS_INTEGRATION_PREFIX}{credential_id}")
        if deleted > 0:
            logger.info(f"Deleted credential {credential_id}")
        return deleted > 0

    async def test(self, credential_id: str) -> dict[str, Any]:
        """Test a credential by calling the integration's test endpoint.

        Args:
            credential_id: The ID of the credential to test.

        Returns:
            dict: Test result with success, message, and details fields.

        Raises:
            KeyError: If credential not found.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(f"{REDIS_INTEGRATION_PREFIX}{credential_id}")

        if not data:
            raise KeyError(f"Credential not found: {credential_id}")

        cred_dict = json.loads(data)
        integration_type = cred_dict.get("integration_type", "")
        credential_type = cred_dict.get("credential_type", "")
        encrypted = cred_dict.get("key_encrypted")

        if not encrypted:
            raise KeyError(f"Credential has no encrypted value: {credential_id}")

        decrypted = self._encryption.decrypt(encrypted)

        # Test based on integration type
        try:
            if integration_type == "slack":
                result = await self._test_slack_credential(credential_type, decrypted)
            elif integration_type == "teams":
                result = await self._test_teams_credential(credential_type, decrypted)
            elif integration_type == "github":
                result = await self._test_github_credential(credential_type, decrypted)
            else:
                result = {
                    "success": False,
                    "message": f"Unknown integration type: {integration_type}",
                    "details": {},
                }

            # Update validity status
            cred_dict["is_valid"] = result.get("success", False)
            await redis_client.set(
                f"{REDIS_INTEGRATION_PREFIX}{credential_id}",
                json.dumps(cred_dict),
            )

            return result

        except Exception as e:
            # Update validity to false on error
            cred_dict["is_valid"] = False
            await redis_client.set(
                f"{REDIS_INTEGRATION_PREFIX}{credential_id}",
                json.dumps(cred_dict),
            )
            return {
                "success": False,
                "message": f"Test failed: {str(e)}",
                "details": {},
            }

    async def _test_slack_credential(
        self, credential_type: str, value: str
    ) -> dict[str, Any]:
        """Test a Slack credential.

        For bot_token, calls auth.test to verify the token.
        For app_token and signing_secret, performs format validation.
        """
        import httpx

        if credential_type == "bot_token":
            # Call Slack auth.test API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/auth.test",
                    headers={"Authorization": f"Bearer {value}"},
                    timeout=10.0,
                )
                data = response.json()

                if data.get("ok"):
                    return {
                        "success": True,
                        "message": f"Valid bot token for team: {data.get('team', 'Unknown')}",
                        "details": {
                            "team": data.get("team", ""),
                            "team_id": data.get("team_id", ""),
                            "user": data.get("user", ""),
                            "bot_id": data.get("bot_id", ""),
                        },
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Invalid token: {data.get('error', 'Unknown error')}",
                        "details": {},
                    }

        elif credential_type == "app_token":
            # App tokens start with xapp-
            if value.startswith("xapp-"):
                return {
                    "success": True,
                    "message": "App token format is valid",
                    "details": {},
                }
            return {
                "success": False,
                "message": "Invalid app token format (should start with xapp-)",
                "details": {},
            }

        elif credential_type == "signing_secret":
            # Signing secrets are 32-character hex strings
            if len(value) == 32 and all(c in "0123456789abcdef" for c in value.lower()):
                return {
                    "success": True,
                    "message": "Signing secret format is valid",
                    "details": {},
                }
            return {
                "success": False,
                "message": "Invalid signing secret format (should be 32 hex characters)",
                "details": {},
            }

        return {
            "success": False,
            "message": f"Unknown Slack credential type: {credential_type}",
            "details": {},
        }

    async def _test_teams_credential(
        self, credential_type: str, value: str
    ) -> dict[str, Any]:
        """Test a Microsoft Teams credential.

        Performs format validation. Full OAuth testing requires all three credentials.
        """
        if credential_type == "client_id":
            # Client IDs are GUIDs
            if len(value) == 36 and value.count("-") == 4:
                return {
                    "success": True,
                    "message": "Client ID format is valid (GUID)",
                    "details": {},
                }
            return {
                "success": False,
                "message": "Invalid client ID format (should be a GUID)",
                "details": {},
            }

        elif credential_type == "client_secret":
            # Client secrets are typically 32+ characters
            if len(value) >= 32:
                return {
                    "success": True,
                    "message": "Client secret format is valid",
                    "details": {},
                }
            return {
                "success": False,
                "message": "Client secret too short (should be 32+ characters)",
                "details": {},
            }

        elif credential_type == "tenant_id":
            # Tenant IDs are GUIDs
            if len(value) == 36 and value.count("-") == 4:
                return {
                    "success": True,
                    "message": "Tenant ID format is valid (GUID)",
                    "details": {},
                }
            return {
                "success": False,
                "message": "Invalid tenant ID format (should be a GUID)",
                "details": {},
            }

        return {
            "success": False,
            "message": f"Unknown Teams credential type: {credential_type}",
            "details": {},
        }

    async def _test_github_credential(
        self, credential_type: str, value: str
    ) -> dict[str, Any]:
        """Test a GitHub credential.

        For PAT, calls /user endpoint to verify the token.
        For app keys, performs format validation.
        """
        import httpx

        if credential_type == "personal_access_token":
            # Call GitHub /user API
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.github.com/user",
                    headers={
                        "Authorization": f"Bearer {value}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "message": f"Valid token for user: {data.get('login', 'Unknown')}",
                        "details": {
                            "login": data.get("login", ""),
                            "name": data.get("name", ""),
                            "id": str(data.get("id", "")),
                        },
                    }
                elif response.status_code == 401:
                    return {
                        "success": False,
                        "message": "Invalid or expired token",
                        "details": {},
                    }
                else:
                    return {
                        "success": False,
                        "message": f"API error: {response.status_code}",
                        "details": {},
                    }

        elif credential_type == "app_private_key":
            # Private keys should start with -----BEGIN RSA PRIVATE KEY-----
            if "BEGIN" in value and "PRIVATE KEY" in value:
                return {
                    "success": True,
                    "message": "Private key format is valid",
                    "details": {},
                }
            return {
                "success": False,
                "message": "Invalid private key format",
                "details": {},
            }

        return {
            "success": False,
            "message": f"Unknown GitHub credential type: {credential_type}",
            "details": {},
        }


# Global service instance
_secrets_service: SecretsService | None = None


def get_secrets_service() -> SecretsService:
    """Get the singleton secrets service instance.

    Returns:
        SecretsService: The service instance.
    """
    global _secrets_service
    if _secrets_service is None:
        _secrets_service = SecretsService()
    return _secrets_service
