"""Unit tests for workers secrets helper."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest


class TestGetSecret:
    """Tests for get_secret helper function."""

    @pytest.mark.asyncio
    async def test_get_secret_from_client(self, monkeypatch):
        """Test that get_secret uses SecretsClient to fetch secret."""
        from src.workers.secrets_helper import get_secret

        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(return_value="secret-value")

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = await get_secret("MY_SECRET")

        assert result == "secret-value"
        mock_client.get_secret.assert_called_once_with("MY_SECRET", "dev")

    @pytest.mark.asyncio
    async def test_get_secret_with_environment(self, monkeypatch):
        """Test that get_secret passes environment to client."""
        from src.workers.secrets_helper import get_secret

        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(return_value="staging-secret")

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = await get_secret("MY_SECRET", environment="staging")

        assert result == "staging-secret"
        mock_client.get_secret.assert_called_once_with("MY_SECRET", "staging")

    @pytest.mark.asyncio
    async def test_get_secret_falls_back_to_env_var(self, monkeypatch):
        """Test that get_secret falls back to env var when client returns None."""
        from src.workers.secrets_helper import get_secret

        monkeypatch.setenv("MY_SECRET", "env-value")
        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(return_value=None)

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = await get_secret("MY_SECRET")

        assert result == "env-value"

    @pytest.mark.asyncio
    async def test_get_secret_returns_none_when_not_found(self, monkeypatch):
        """Test that get_secret returns None when secret not found anywhere."""
        from src.workers.secrets_helper import get_secret

        monkeypatch.delenv("NONEXISTENT_SECRET", raising=False)
        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(return_value=None)

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = await get_secret("NONEXISTENT_SECRET")

        assert result is None


class TestGetSecretSync:
    """Tests for get_secret_sync synchronous helper function."""

    def test_get_secret_sync_returns_value(self, monkeypatch):
        """Test that get_secret_sync returns secret value synchronously."""
        from src.workers.secrets_helper import get_secret_sync

        mock_client = MagicMock()
        mock_client.get_secret = AsyncMock(return_value="sync-secret")

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = get_secret_sync("MY_SECRET")

        assert result == "sync-secret"

    def test_get_secret_sync_falls_back_to_env(self, monkeypatch):
        """Test that get_secret_sync falls back to env var."""
        from src.workers.secrets_helper import get_secret_sync

        monkeypatch.setenv("FALLBACK_SECRET", "fallback-value")
        mock_client = MagicMock()
        mock_client.get_secret = AsyncMock(return_value=None)

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = get_secret_sync("FALLBACK_SECRET")

        assert result == "fallback-value"


class TestGetMultipleSecrets:
    """Tests for get_multiple_secrets helper function."""

    @pytest.mark.asyncio
    async def test_get_multiple_secrets_returns_dict(self):
        """Test that get_multiple_secrets returns a dict of secrets."""
        from src.workers.secrets_helper import get_multiple_secrets

        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(side_effect=["value1", "value2", "value3"])

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = await get_multiple_secrets(["SECRET_1", "SECRET_2", "SECRET_3"])

        assert result == {
            "SECRET_1": "value1",
            "SECRET_2": "value2",
            "SECRET_3": "value3",
        }

    @pytest.mark.asyncio
    async def test_get_multiple_secrets_handles_missing(self, monkeypatch):
        """Test that get_multiple_secrets handles missing secrets."""
        from src.workers.secrets_helper import get_multiple_secrets

        monkeypatch.setenv("SECRET_1", "env-value-1")
        monkeypatch.delenv("SECRET_2", raising=False)

        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(side_effect=[None, None])

        with patch("src.workers.secrets_helper.get_secrets_client", return_value=mock_client):
            result = await get_multiple_secrets(["SECRET_1", "SECRET_2"])

        assert result == {
            "SECRET_1": "env-value-1",
            "SECRET_2": None,
        }
