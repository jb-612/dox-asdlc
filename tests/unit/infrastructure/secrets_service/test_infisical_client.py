"""Unit tests for InfisicalSecretsClient."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.infrastructure.secrets.infisical_client import InfisicalSecretsClient


class TestInfisicalSecretsClientInit:
    """Tests for InfisicalSecretsClient initialization."""

    def test_init_reads_env_vars(self, monkeypatch):
        """Test that init reads configuration from environment variables."""
        monkeypatch.setenv("INFISICAL_URL", "http://test:8080")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "test-id")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "test-secret")
        monkeypatch.setenv("INFISICAL_PROJECT_ID", "test-project")

        client = InfisicalSecretsClient()

        assert client.base_url == "http://test:8080"
        assert client.client_id == "test-id"
        assert client.client_secret == "test-secret"
        assert client.project_id == "test-project"

    def test_init_defaults_url(self, monkeypatch):
        """Test that init defaults URL to localhost:8086."""
        monkeypatch.delenv("INFISICAL_URL", raising=False)
        monkeypatch.delenv("INFISICAL_CLIENT_ID", raising=False)
        monkeypatch.delenv("INFISICAL_CLIENT_SECRET", raising=False)
        monkeypatch.delenv("INFISICAL_PROJECT_ID", raising=False)

        client = InfisicalSecretsClient()

        assert client.base_url == "http://localhost:8086"
        assert client.client_id == ""
        assert client.client_secret == ""
        assert client.project_id == ""


class TestInfisicalSecretsClientAuth:
    """Tests for InfisicalSecretsClient authentication."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured InfisicalSecretsClient."""
        monkeypatch.setenv("INFISICAL_URL", "http://test:8080")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "test-id")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "test-secret")
        monkeypatch.setenv("INFISICAL_PROJECT_ID", "test-project")
        return InfisicalSecretsClient()

    @pytest.mark.asyncio
    async def test_get_access_token_requires_credentials(self, monkeypatch):
        """Test that _get_access_token raises if credentials missing."""
        monkeypatch.delenv("INFISICAL_CLIENT_ID", raising=False)
        monkeypatch.delenv("INFISICAL_CLIENT_SECRET", raising=False)
        client = InfisicalSecretsClient()

        with pytest.raises(ValueError, match="INFISICAL_CLIENT_ID"):
            await client._get_access_token()

    @pytest.mark.asyncio
    async def test_get_access_token_caches_token(self, client):
        """Test that _get_access_token caches the token."""
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"accessToken": "test-token"})

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(
                    post=MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_response)))
                )
            )
            mock_session.return_value.__aexit__ = AsyncMock()

            # First call should fetch token
            token1 = await client._get_access_token()
            assert token1 == "test-token"

            # Second call should return cached token
            token2 = await client._get_access_token()
            assert token2 == "test-token"

            # Should have only made one request
            assert client._access_token == "test-token"


class TestInfisicalSecretsClientOperations:
    """Tests for InfisicalSecretsClient CRUD operations."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured InfisicalSecretsClient."""
        monkeypatch.setenv("INFISICAL_URL", "http://test:8080")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "test-id")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "test-secret")
        monkeypatch.setenv("INFISICAL_PROJECT_ID", "test-project")
        return InfisicalSecretsClient()

    @pytest.mark.asyncio
    async def test_get_secret_returns_value(self, client):
        """Test that get_secret returns the secret value."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"secret": {"secretValue": "my-secret-value"}}

            result = await client.get_secret("MY_SECRET", "dev")

            assert result == "my-secret-value"
            mock_request.assert_called_once_with(
                "GET",
                "/api/v3/secrets/raw/MY_SECRET",
                params={"workspaceId": "test-project", "environment": "dev"},
            )

    @pytest.mark.asyncio
    async def test_get_secret_returns_none_on_error(self, client):
        """Test that get_secret returns None on error."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = Exception("API error")

            result = await client.get_secret("MY_SECRET", "dev")

            assert result is None

    @pytest.mark.asyncio
    async def test_list_secrets_returns_names(self, client):
        """Test that list_secrets returns secret names."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {
                "secrets": [
                    {"secretKey": "SECRET_ONE"},
                    {"secretKey": "SECRET_TWO"},
                ]
            }

            result = await client.list_secrets("dev")

            assert result == ["SECRET_ONE", "SECRET_TWO"]

    @pytest.mark.asyncio
    async def test_list_secrets_returns_empty_on_error(self, client):
        """Test that list_secrets returns empty list on error."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = Exception("API error")

            result = await client.list_secrets("dev")

            assert result == []

    @pytest.mark.asyncio
    async def test_set_secret_returns_true_on_success(self, client):
        """Test that set_secret returns True on success."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"secret": {"id": "123"}}

            result = await client.set_secret("MY_SECRET", "my-value", "dev")

            assert result is True
            mock_request.assert_called_once_with(
                "POST",
                "/api/v3/secrets/raw",
                json={
                    "workspaceId": "test-project",
                    "environment": "dev",
                    "secretKey": "MY_SECRET",
                    "secretValue": "my-value",
                },
            )

    @pytest.mark.asyncio
    async def test_set_secret_returns_false_on_error(self, client):
        """Test that set_secret returns False on error."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = Exception("API error")

            result = await client.set_secret("MY_SECRET", "my-value", "dev")

            assert result is False

    @pytest.mark.asyncio
    async def test_delete_secret_returns_true_on_success(self, client):
        """Test that delete_secret returns True on success."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {}

            result = await client.delete_secret("MY_SECRET", "dev")

            assert result is True
            mock_request.assert_called_once_with(
                "DELETE",
                "/api/v3/secrets/raw/MY_SECRET",
                params={"workspaceId": "test-project", "environment": "dev"},
            )

    @pytest.mark.asyncio
    async def test_delete_secret_returns_false_on_error(self, client):
        """Test that delete_secret returns False on error."""
        client._access_token = "test-token"

        with patch.object(client, "_request", new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = Exception("API error")

            result = await client.delete_secret("MY_SECRET", "dev")

            assert result is False


class TestInfisicalSecretsClientTestSecret:
    """Tests for InfisicalSecretsClient test_secret method."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured InfisicalSecretsClient."""
        monkeypatch.setenv("INFISICAL_URL", "http://test:8080")
        monkeypatch.setenv("INFISICAL_CLIENT_ID", "test-id")
        monkeypatch.setenv("INFISICAL_CLIENT_SECRET", "test-secret")
        monkeypatch.setenv("INFISICAL_PROJECT_ID", "test-project")
        return InfisicalSecretsClient()

    @pytest.mark.asyncio
    async def test_test_secret_returns_failure_when_not_found(self, client):
        """Test that test_secret returns failure when secret not found."""
        with patch.object(client, "get_secret", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = None

            result = await client.test_secret("MY_SECRET", "dev")

            assert result["success"] is False
            assert "not found" in result["message"]

    @pytest.mark.asyncio
    async def test_test_secret_returns_success_for_non_slack(self, client):
        """Test that test_secret returns success for non-Slack secrets."""
        with patch.object(client, "get_secret", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "some-value"

            result = await client.test_secret("DATABASE_PASSWORD", "dev")

            assert result["success"] is True
            assert "exists" in result["message"]

    @pytest.mark.asyncio
    async def test_test_secret_tests_slack_tokens(self, client):
        """Test that test_secret actually tests Slack tokens."""
        with patch.object(client, "get_secret", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "xoxb-test-token"

            mock_auth_response = AsyncMock()
            mock_auth_response.json = AsyncMock(return_value={"ok": True, "team": "Test Team", "user_id": "U123"})

            mock_msg_response = AsyncMock()
            mock_msg_response.json = AsyncMock(return_value={"ok": True, "channel": "U123", "ts": "123.456"})

            with patch("aiohttp.ClientSession") as mock_session:
                mock_context = MagicMock()
                mock_context.post = MagicMock(
                    side_effect=[
                        AsyncMock(__aenter__=AsyncMock(return_value=mock_auth_response), __aexit__=AsyncMock()),
                        AsyncMock(__aenter__=AsyncMock(return_value=mock_msg_response), __aexit__=AsyncMock()),
                    ]
                )
                mock_session.return_value.__aenter__ = AsyncMock(return_value=mock_context)
                mock_session.return_value.__aexit__ = AsyncMock()

                result = await client.test_secret("SLACK_BOT_TOKEN", "dev")

                assert result["success"] is True
                assert "valid" in result["message"].lower()
                assert result["details"]["team"] == "Test Team"

    @pytest.mark.asyncio
    async def test_test_secret_handles_slack_auth_failure(self, client):
        """Test that test_secret handles Slack auth failure."""
        with patch.object(client, "get_secret", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = "xoxb-invalid-token"

            mock_auth_response = AsyncMock()
            mock_auth_response.json = AsyncMock(return_value={"ok": False, "error": "invalid_auth"})

            with patch("aiohttp.ClientSession") as mock_session:
                mock_context = MagicMock()
                mock_context.post = MagicMock(
                    return_value=AsyncMock(__aenter__=AsyncMock(return_value=mock_auth_response), __aexit__=AsyncMock())
                )
                mock_session.return_value.__aenter__ = AsyncMock(return_value=mock_context)
                mock_session.return_value.__aexit__ = AsyncMock()

                result = await client.test_secret("SLACK_BOT_TOKEN", "dev")

                assert result["success"] is False
                assert "invalid_auth" in result["message"]
