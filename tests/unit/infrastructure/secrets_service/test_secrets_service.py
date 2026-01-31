"""Unit tests for SecretsService."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.secrets.service import SecretsService, REDIS_INTEGRATION_PREFIX


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    return AsyncMock()


@pytest.fixture
def secrets_service(mock_redis):
    """Create a SecretsService with a mock Redis client."""
    service = SecretsService(redis_client=mock_redis)
    return service


class TestSecretsServiceStore:
    """Tests for SecretsService.store."""

    @pytest.mark.asyncio
    async def test_store_creates_credential(self, secrets_service, mock_redis):
        """Test that store creates a credential and returns an ID."""
        result = await secrets_service.store(
            integration_type="slack",
            credential_type="bot_token",
            name="Test Bot",
            value="xoxb-test-token",
        )

        assert result.startswith("cred-slack-")
        mock_redis.set.assert_called_once()

        # Verify the stored data structure
        call_args = mock_redis.set.call_args
        key = call_args[0][0]
        data = json.loads(call_args[0][1])

        assert key.startswith(REDIS_INTEGRATION_PREFIX)
        assert data["integration_type"] == "slack"
        assert data["credential_type"] == "bot_token"
        assert data["name"] == "Test Bot"
        assert "key_encrypted" in data
        assert data["key_masked"] == "xoxb-te...ken"


class TestSecretsServiceRetrieve:
    """Tests for SecretsService.retrieve."""

    @pytest.mark.asyncio
    async def test_retrieve_returns_decrypted_value(self, secrets_service, mock_redis):
        """Test that retrieve decrypts and returns the credential value."""
        # Store a credential first
        test_value = "xoxb-test-token-12345"
        encrypted = secrets_service._encryption.encrypt(test_value)

        stored_data = {
            "id": "cred-slack-abc123",
            "integration_type": "slack",
            "credential_type": "bot_token",
            "name": "Test",
            "key_encrypted": encrypted,
            "key_masked": "xoxb-te...345",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used": None,
            "is_valid": True,
        }
        mock_redis.get.return_value = json.dumps(stored_data)

        result = await secrets_service.retrieve("cred-slack-abc123")

        assert result == test_value

    @pytest.mark.asyncio
    async def test_retrieve_returns_none_for_missing(self, secrets_service, mock_redis):
        """Test that retrieve returns None for missing credentials."""
        mock_redis.get.return_value = None

        result = await secrets_service.retrieve("nonexistent")

        assert result is None


class TestSecretsServiceDelete:
    """Tests for SecretsService.delete."""

    @pytest.mark.asyncio
    async def test_delete_removes_credential(self, secrets_service, mock_redis):
        """Test that delete removes the credential from Redis."""
        mock_redis.delete.return_value = 1

        result = await secrets_service.delete("cred-slack-abc123")

        assert result is True
        mock_redis.delete.assert_called_once_with(
            f"{REDIS_INTEGRATION_PREFIX}cred-slack-abc123"
        )

    @pytest.mark.asyncio
    async def test_delete_returns_false_for_missing(self, secrets_service, mock_redis):
        """Test that delete returns False for missing credentials."""
        mock_redis.delete.return_value = 0

        result = await secrets_service.delete("nonexistent")

        assert result is False


class TestSecretsServiceList:
    """Tests for SecretsService.list_credentials."""

    @pytest.mark.asyncio
    async def test_list_returns_all_credentials(self, secrets_service, mock_redis):
        """Test that list returns all credentials."""
        mock_redis.keys.return_value = [
            f"{REDIS_INTEGRATION_PREFIX}cred-slack-abc",
            f"{REDIS_INTEGRATION_PREFIX}cred-github-def",
        ]

        slack_data = json.dumps({
            "id": "cred-slack-abc",
            "integration_type": "slack",
            "credential_type": "bot_token",
            "name": "Slack Bot",
            "key_masked": "xoxb...abc",
            "created_at": "2025-01-01T00:00:00Z",
            "last_used": None,
            "is_valid": True,
        })
        github_data = json.dumps({
            "id": "cred-github-def",
            "integration_type": "github",
            "credential_type": "personal_access_token",
            "name": "GitHub PAT",
            "key_masked": "ghp_...def",
            "created_at": "2025-01-01T00:00:00Z",
            "last_used": None,
            "is_valid": True,
        })

        mock_redis.get.side_effect = [slack_data, github_data]

        result = await secrets_service.list_credentials()

        assert len(result) == 2
        assert result[0]["integration_type"] == "slack"
        assert result[1]["integration_type"] == "github"

    @pytest.mark.asyncio
    async def test_list_filters_by_integration_type(self, secrets_service, mock_redis):
        """Test that list filters by integration type."""
        mock_redis.keys.return_value = [
            f"{REDIS_INTEGRATION_PREFIX}cred-slack-abc",
            f"{REDIS_INTEGRATION_PREFIX}cred-github-def",
        ]

        slack_data = json.dumps({
            "id": "cred-slack-abc",
            "integration_type": "slack",
            "credential_type": "bot_token",
            "name": "Slack Bot",
            "key_masked": "xoxb...abc",
            "created_at": "2025-01-01T00:00:00Z",
            "last_used": None,
            "is_valid": True,
        })
        github_data = json.dumps({
            "id": "cred-github-def",
            "integration_type": "github",
            "credential_type": "personal_access_token",
            "name": "GitHub PAT",
            "key_masked": "ghp_...def",
            "created_at": "2025-01-01T00:00:00Z",
            "last_used": None,
            "is_valid": True,
        })

        mock_redis.get.side_effect = [slack_data, github_data]

        result = await secrets_service.list_credentials(integration_type="slack")

        assert len(result) == 1
        assert result[0]["integration_type"] == "slack"
