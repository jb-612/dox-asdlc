"""Unit tests for GCPSecretsClient."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from src.infrastructure.secrets.gcp_client import GCPSecretsClient


class TestGCPSecretsClientInit:
    """Tests for GCPSecretsClient initialization."""

    def test_init_reads_env_vars(self, monkeypatch):
        """Test that init reads configuration from environment variables."""
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")

        client = GCPSecretsClient()

        assert client.project_id == "test-project"

    def test_init_defaults_to_empty(self, monkeypatch):
        """Test that init defaults project_id to empty string."""
        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)

        client = GCPSecretsClient()

        assert client.project_id == ""


class TestGCPSecretsClientPaths:
    """Tests for GCPSecretsClient path building methods."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured GCPSecretsClient."""
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
        return GCPSecretsClient()

    def test_secret_path_adds_environment_prefix_for_dev(self, client):
        """Test that _secret_path adds environment prefix for dev."""
        path = client._secret_path("MY_SECRET", "dev")

        assert path == "projects/test-project/secrets/dev_MY_SECRET/versions/latest"

    def test_secret_path_no_prefix_for_prod(self, client):
        """Test that _secret_path does not add prefix for prod."""
        path = client._secret_path("MY_SECRET", "prod")

        assert path == "projects/test-project/secrets/MY_SECRET/versions/latest"

    def test_secret_parent_adds_environment_prefix_for_staging(self, client):
        """Test that _secret_parent adds environment prefix for staging."""
        path = client._secret_parent("MY_SECRET", "staging")

        assert path == "projects/test-project/secrets/staging_MY_SECRET"

    def test_secret_parent_no_prefix_for_prod(self, client):
        """Test that _secret_parent does not add prefix for prod."""
        path = client._secret_parent("MY_SECRET", "prod")

        assert path == "projects/test-project/secrets/MY_SECRET"


class TestGCPSecretsClientGetClient:
    """Tests for GCPSecretsClient _get_client method."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured GCPSecretsClient."""
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
        return GCPSecretsClient()

    def test_get_client_raises_import_error_if_not_installed(self, client):
        """Test that _get_client raises ImportError if package not installed."""
        with patch.dict("sys.modules", {"google.cloud": None, "google.cloud.secretmanager": None}):
            # Force reimport to trigger ImportError
            client._client = None
            with pytest.raises(ImportError, match="google-cloud-secret-manager"):
                client._get_client()

    def test_get_client_caches_instance(self, client):
        """Test that _get_client caches the client instance."""
        # Manually set a mock client to test caching behavior
        mock_client_instance = MagicMock()
        client._client = mock_client_instance

        # Both calls should return the same cached instance
        client1 = client._get_client()
        client2 = client._get_client()

        assert client1 is client2
        assert client1 is mock_client_instance


class TestGCPSecretsClientOperations:
    """Tests for GCPSecretsClient CRUD operations."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured GCPSecretsClient with mocked GCP client."""
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
        gcp_client = GCPSecretsClient()
        gcp_client._client = MagicMock()
        return gcp_client

    @pytest.mark.asyncio
    async def test_get_secret_returns_value(self, client):
        """Test that get_secret returns the secret value."""
        mock_response = MagicMock()
        mock_response.payload.data.decode.return_value = "my-secret-value"
        client._client.access_secret_version.return_value = mock_response

        result = await client.get_secret("MY_SECRET", "dev")

        assert result == "my-secret-value"
        client._client.access_secret_version.assert_called_once_with(
            request={"name": "projects/test-project/secrets/dev_MY_SECRET/versions/latest"}
        )

    @pytest.mark.asyncio
    async def test_get_secret_returns_none_on_error(self, client):
        """Test that get_secret returns None on error."""
        client._client.access_secret_version.side_effect = Exception("Not found")

        result = await client.get_secret("MY_SECRET", "dev")

        assert result is None

    @pytest.mark.asyncio
    async def test_list_secrets_returns_names_for_dev(self, client):
        """Test that list_secrets returns secret names for dev environment."""
        mock_secret1 = MagicMock()
        mock_secret1.name = "projects/test-project/secrets/dev_SECRET_ONE"
        mock_secret2 = MagicMock()
        mock_secret2.name = "projects/test-project/secrets/dev_SECRET_TWO"
        mock_secret3 = MagicMock()
        mock_secret3.name = "projects/test-project/secrets/prod_SECRET"  # Different env

        client._client.list_secrets.return_value = [mock_secret1, mock_secret2, mock_secret3]

        result = await client.list_secrets("dev")

        assert "SECRET_ONE" in result
        assert "SECRET_TWO" in result
        assert "prod_SECRET" not in result

    @pytest.mark.asyncio
    async def test_list_secrets_returns_names_for_prod(self, client):
        """Test that list_secrets returns secret names for prod environment."""
        mock_secret1 = MagicMock()
        mock_secret1.name = "projects/test-project/secrets/DATABASE_PASSWORD"  # Prod secret
        mock_secret2 = MagicMock()
        mock_secret2.name = "projects/test-project/secrets/dev_DATABASE_PASSWORD"  # Dev prefix
        mock_secret3 = MagicMock()
        mock_secret3.name = "projects/test-project/secrets/staging_API_KEY"  # Staging prefix

        client._client.list_secrets.return_value = [mock_secret1, mock_secret2, mock_secret3]

        result = await client.list_secrets("prod")

        # Should include prod secrets (no env prefix)
        assert "DATABASE_PASSWORD" in result
        # Should exclude dev and staging prefixed secrets
        assert "dev_DATABASE_PASSWORD" not in result
        assert "staging_API_KEY" not in result

    @pytest.mark.asyncio
    async def test_list_secrets_returns_empty_on_error(self, client):
        """Test that list_secrets returns empty list on error."""
        client._client.list_secrets.side_effect = Exception("Permission denied")

        result = await client.list_secrets("dev")

        assert result == []

    @pytest.mark.asyncio
    async def test_set_secret_creates_and_adds_version(self, client):
        """Test that set_secret creates secret and adds version."""
        result = await client.set_secret("MY_SECRET", "my-value", "dev")

        assert result is True
        # Should try to create secret
        client._client.create_secret.assert_called_once()
        # Should add version
        client._client.add_secret_version.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_secret_handles_existing_secret(self, client):
        """Test that set_secret handles existing secret."""
        client._client.create_secret.side_effect = Exception("Already exists")

        result = await client.set_secret("MY_SECRET", "my-value", "dev")

        assert result is True
        # Should still add version even if create failed
        client._client.add_secret_version.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_secret_returns_false_on_version_error(self, client):
        """Test that set_secret returns False on version add error."""
        client._client.add_secret_version.side_effect = Exception("Failed to add version")

        result = await client.set_secret("MY_SECRET", "my-value", "dev")

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_secret_returns_true_on_success(self, client):
        """Test that delete_secret returns True on success."""
        result = await client.delete_secret("MY_SECRET", "dev")

        assert result is True
        client._client.delete_secret.assert_called_once_with(
            request={"name": "projects/test-project/secrets/dev_MY_SECRET"}
        )

    @pytest.mark.asyncio
    async def test_delete_secret_returns_false_on_error(self, client):
        """Test that delete_secret returns False on error."""
        client._client.delete_secret.side_effect = Exception("Not found")

        result = await client.delete_secret("MY_SECRET", "dev")

        assert result is False


class TestGCPSecretsClientTestSecret:
    """Tests for GCPSecretsClient test_secret method."""

    @pytest.fixture
    def client(self, monkeypatch):
        """Create a configured GCPSecretsClient with mocked GCP client."""
        monkeypatch.setenv("GCP_PROJECT_ID", "test-project")
        gcp_client = GCPSecretsClient()
        gcp_client._client = MagicMock()
        return gcp_client

    @pytest.mark.asyncio
    async def test_test_secret_returns_success_when_found(self, client):
        """Test that test_secret returns success when secret found."""
        mock_response = MagicMock()
        mock_response.payload.data.decode.return_value = "my-secret-value"
        client._client.access_secret_version.return_value = mock_response

        result = await client.test_secret("MY_SECRET", "dev")

        assert result["success"] is True
        assert "accessible" in result["message"]

    @pytest.mark.asyncio
    async def test_test_secret_returns_failure_when_not_found(self, client):
        """Test that test_secret returns failure when secret not found."""
        client._client.access_secret_version.side_effect = Exception("Not found")

        result = await client.test_secret("MY_SECRET", "dev")

        assert result["success"] is False
        assert "not found" in result["message"]
