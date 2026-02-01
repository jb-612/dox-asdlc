"""Unit tests for SecretsClient abstraction."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.secrets.client import (
    SecretsClient,
    EnvironmentSecretsClient,
    get_secrets_client,
    reset_secrets_client,
)


class TestEnvironmentSecretsClient:
    """Tests for EnvironmentSecretsClient."""

    @pytest.fixture
    def client(self):
        """Create an EnvironmentSecretsClient instance."""
        return EnvironmentSecretsClient()

    @pytest.mark.asyncio
    async def test_get_secret_returns_env_var(self, client, monkeypatch):
        """Test that get_secret returns environment variable value."""
        monkeypatch.setenv("TEST_SECRET", "test_value")

        result = await client.get_secret("TEST_SECRET")

        assert result == "test_value"

    @pytest.mark.asyncio
    async def test_get_secret_returns_none_for_missing(self, client, monkeypatch):
        """Test that get_secret returns None for missing env var."""
        monkeypatch.delenv("NONEXISTENT_SECRET", raising=False)

        result = await client.get_secret("NONEXISTENT_SECRET")

        assert result is None

    @pytest.mark.asyncio
    async def test_list_secrets_returns_known_secrets(self, client, monkeypatch):
        """Test that list_secrets returns known secrets that exist."""
        monkeypatch.setenv("SLACK_BOT_TOKEN", "xoxb-test")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)

        result = await client.list_secrets()

        assert "SLACK_BOT_TOKEN" in result
        assert "ANTHROPIC_API_KEY" in result
        assert "OPENAI_API_KEY" not in result

    @pytest.mark.asyncio
    async def test_set_secret_returns_false(self, client):
        """Test that set_secret returns False (cannot persist)."""
        result = await client.set_secret("TEST", "value")

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_secret_returns_false(self, client):
        """Test that delete_secret returns False (cannot delete)."""
        result = await client.delete_secret("TEST")

        assert result is False

    @pytest.mark.asyncio
    async def test_test_secret_returns_success_when_exists(self, client, monkeypatch):
        """Test that test_secret returns success when env var exists."""
        monkeypatch.setenv("TEST_SECRET", "test_value")

        result = await client.test_secret("TEST_SECRET")

        assert result["success"] is True
        assert "exists" in result["message"]

    @pytest.mark.asyncio
    async def test_test_secret_returns_failure_when_missing(self, client, monkeypatch):
        """Test that test_secret returns failure when env var missing."""
        monkeypatch.delenv("NONEXISTENT_SECRET", raising=False)

        result = await client.test_secret("NONEXISTENT_SECRET")

        assert result["success"] is False
        assert "not found" in result["message"]


class TestGetSecretsClient:
    """Tests for get_secrets_client factory function."""

    @pytest.fixture(autouse=True)
    async def reset_client(self):
        """Reset the cached client before and after each test."""
        await reset_secrets_client()
        yield
        await reset_secrets_client()

    @pytest.mark.asyncio
    async def test_returns_environment_client_by_default(self, monkeypatch):
        """Test that default backend is EnvironmentSecretsClient."""
        monkeypatch.delenv("SECRETS_BACKEND", raising=False)

        client = get_secrets_client()

        assert isinstance(client, EnvironmentSecretsClient)

    @pytest.mark.asyncio
    async def test_returns_environment_client_when_env_backend(self, monkeypatch):
        """Test that 'env' backend returns EnvironmentSecretsClient."""
        monkeypatch.setenv("SECRETS_BACKEND", "env")

        client = get_secrets_client()

        assert isinstance(client, EnvironmentSecretsClient)

    @pytest.mark.asyncio
    async def test_returns_infisical_client_when_infisical_backend(self, monkeypatch):
        """Test that 'infisical' backend returns InfisicalSecretsClient."""
        monkeypatch.setenv("SECRETS_BACKEND", "infisical")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "test-id")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "test-secret")

        client = get_secrets_client()

        from src.infrastructure.secrets.infisical_client import InfisicalSecretsClient
        assert isinstance(client, InfisicalSecretsClient)

    @pytest.mark.asyncio
    async def test_returns_gcp_client_when_gcp_backend(self, monkeypatch):
        """Test that 'gcp' backend returns GCPSecretsClient."""
        monkeypatch.setenv("SECRETS_BACKEND", "gcp")
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")

        # Mock the google.cloud import to avoid needing the package
        mock_secretmanager = MagicMock()
        with patch.dict('sys.modules', {'google.cloud': MagicMock(), 'google.cloud.secretmanager': mock_secretmanager}):
            client = get_secrets_client()

            from src.infrastructure.secrets.gcp_client import GCPSecretsClient
            assert isinstance(client, GCPSecretsClient)

    @pytest.mark.asyncio
    async def test_caches_client_instance(self, monkeypatch):
        """Test that get_secrets_client caches the client instance."""
        monkeypatch.delenv("SECRETS_BACKEND", raising=False)

        client1 = get_secrets_client()
        client2 = get_secrets_client()

        assert client1 is client2

    @pytest.mark.asyncio
    async def test_reset_clears_cached_client(self, monkeypatch):
        """Test that reset_secrets_client clears the cached instance."""
        monkeypatch.delenv("SECRETS_BACKEND", raising=False)

        client1 = get_secrets_client()
        await reset_secrets_client()
        client2 = get_secrets_client()

        # After reset, should get a new instance
        assert client1 is not client2


class TestSecretsClientInterface:
    """Tests to verify SecretsClient is a proper ABC."""

    def test_secrets_client_is_abstract(self):
        """Test that SecretsClient cannot be instantiated directly."""
        with pytest.raises(TypeError):
            SecretsClient()  # type: ignore

    def test_environment_client_implements_interface(self):
        """Test that EnvironmentSecretsClient implements all methods."""
        client = EnvironmentSecretsClient()

        assert hasattr(client, "get_secret")
        assert hasattr(client, "list_secrets")
        assert hasattr(client, "set_secret")
        assert hasattr(client, "delete_secret")
        assert hasattr(client, "test_secret")
