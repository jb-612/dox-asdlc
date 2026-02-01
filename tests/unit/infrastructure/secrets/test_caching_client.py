"""Tests for the caching secrets client with GCP primary and Infisical fallback."""

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.secrets.client import SecretsClient


class MockSecretsClient(SecretsClient):
    """Mock implementation of SecretsClient for testing."""

    def __init__(self, backend_name: str = "mock"):
        self._backend_name = backend_name
        self._secrets: dict[str, dict[str, str]] = {}

    @property
    def backend_type(self) -> str:
        return self._backend_name

    async def get_secret(self, name: str, environment: str = "dev") -> str | None:
        env_secrets = self._secrets.get(environment, {})
        return env_secrets.get(name)

    async def set_secret(self, name: str, value: str, environment: str = "dev") -> bool:
        if environment not in self._secrets:
            self._secrets[environment] = {}
        self._secrets[environment][name] = value
        return True

    async def list_secrets(self, environment: str = "dev") -> list[str]:
        return list(self._secrets.get(environment, {}).keys())

    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        if environment in self._secrets and name in self._secrets[environment]:
            del self._secrets[environment][name]
            return True
        return False

    async def test_secret(self, name: str, environment: str = "dev") -> dict:
        value = await self.get_secret(name, environment)
        if value:
            return {"success": True, "message": "Secret exists"}
        return {"success": False, "message": "Secret not found"}

    async def health_check(self) -> dict:
        return {"status": "healthy", "backend": self._backend_name}


class FailingSecretsClient(SecretsClient):
    """Mock client that always fails for testing fallback behavior."""

    def __init__(self, backend_name: str = "failing"):
        self._backend_name = backend_name

    @property
    def backend_type(self) -> str:
        return self._backend_name

    async def get_secret(self, name: str, environment: str = "dev") -> str | None:
        raise ConnectionError("GCP connection failed")

    async def set_secret(self, name: str, value: str, environment: str = "dev") -> bool:
        raise ConnectionError("GCP connection failed")

    async def list_secrets(self, environment: str = "dev") -> list[str]:
        raise ConnectionError("GCP connection failed")

    async def delete_secret(self, name: str, environment: str = "dev") -> bool:
        raise ConnectionError("GCP connection failed")

    async def test_secret(self, name: str, environment: str = "dev") -> dict:
        raise ConnectionError("GCP connection failed")

    async def health_check(self) -> dict:
        raise ConnectionError("GCP connection failed")


class TestCachingSecretsClient:
    """Tests for CachingSecretsClient."""

    @pytest.fixture
    def gcp_client(self) -> MockSecretsClient:
        """Create a mock GCP client."""
        return MockSecretsClient(backend_name="gcp")

    @pytest.fixture
    def infisical_client(self) -> MockSecretsClient:
        """Create a mock Infisical client."""
        return MockSecretsClient(backend_name="infisical")

    @pytest.fixture
    def failing_gcp_client(self) -> FailingSecretsClient:
        """Create a failing GCP client for fallback testing."""
        return FailingSecretsClient(backend_name="gcp")

    @pytest.fixture
    def caching_client(self, gcp_client, infisical_client):
        """Create a CachingSecretsClient with mock backends."""
        from src.infrastructure.secrets.caching_client import CachingSecretsClient
        return CachingSecretsClient(gcp_client, infisical_client)

    @pytest.fixture
    def caching_client_with_failing_gcp(self, failing_gcp_client, infisical_client):
        """Create a CachingSecretsClient with failing GCP backend."""
        from src.infrastructure.secrets.caching_client import CachingSecretsClient
        return CachingSecretsClient(failing_gcp_client, infisical_client)

    # Test 1: GCP success -> caches to Infisical, returns value
    @pytest.mark.asyncio
    async def test_gcp_success_caches_to_infisical(
        self, caching_client, gcp_client, infisical_client
    ):
        """When GCP succeeds, value should be cached to Infisical."""
        # Set up a secret in GCP
        await gcp_client.set_secret("API_KEY", "secret-value-123", "dev")

        # Get via caching client
        result = await caching_client.get_secret("API_KEY", "dev")

        # Should return the value
        assert result == "secret-value-123"

        # Should have cached to Infisical
        cached_value = await infisical_client.get_secret("API_KEY", "dev")
        assert cached_value == "secret-value-123"

        # Should not be in cache mode
        assert caching_client._using_cache is False
        assert caching_client.backend_type == "gcp"

    # Test 2: GCP failure -> reads from Infisical cache, shows warning
    @pytest.mark.asyncio
    async def test_gcp_failure_reads_from_cache(
        self, caching_client_with_failing_gcp, infisical_client, caplog
    ):
        """When GCP fails, should fall back to Infisical cache."""
        # Pre-populate the cache
        await infisical_client.set_secret("API_KEY", "cached-value-456", "dev")

        # Get via caching client (GCP will fail)
        with caplog.at_level(logging.WARNING):
            result = await caching_client_with_failing_gcp.get_secret("API_KEY", "dev")

        # Should return cached value
        assert result == "cached-value-456"

        # Should be in cache mode
        assert caching_client_with_failing_gcp._using_cache is True
        assert caching_client_with_failing_gcp.backend_type == "infisical (cached)"

        # Should have logged warning about GCP unavailable
        assert "GCP unavailable" in caplog.text

    # Test 3: set_secret fails when GCP unreachable
    @pytest.mark.asyncio
    async def test_set_secret_fails_when_gcp_unreachable(
        self, caching_client_with_failing_gcp, caplog
    ):
        """Writes should fail when GCP is unreachable."""
        with caplog.at_level(logging.ERROR):
            result = await caching_client_with_failing_gcp.set_secret(
                "NEW_SECRET", "new-value", "dev"
            )

        # Should fail
        assert result is False

        # Should log error about writes requiring GCP
        assert "Cannot set secret" in caplog.text
        assert "Writes require GCP" in caplog.text

    # Test 4: Warning only shown once per session
    @pytest.mark.asyncio
    async def test_cache_warning_shown_once(
        self, caching_client_with_failing_gcp, infisical_client, caplog
    ):
        """Cache warning should only be shown once per session."""
        # Pre-populate cache
        await infisical_client.set_secret("SECRET_1", "value1", "dev")
        await infisical_client.set_secret("SECRET_2", "value2", "dev")

        with caplog.at_level(logging.WARNING):
            # First call - should show warning
            await caching_client_with_failing_gcp.get_secret("SECRET_1", "dev")

            # Count cache mode warnings
            first_count = caplog.text.count("CACHED secrets - may be stale")

            # Clear log and make second call
            caplog.clear()
            await caching_client_with_failing_gcp.get_secret("SECRET_2", "dev")

            # Warning should not appear again
            second_count = caplog.text.count("CACHED secrets - may be stale")

        assert first_count == 1
        assert second_count == 0

    # Test 5: health_check returns both primary and cache status
    @pytest.mark.asyncio
    async def test_health_check_returns_both_statuses(
        self, caching_client
    ):
        """Health check should return status for both primary and cache."""
        result = await caching_client.health_check()

        assert "using_cache" in result
        assert "primary" in result
        assert "cache" in result

        # Both should be healthy with mock clients
        assert result["primary"]["status"] == "healthy"
        assert result["cache"]["status"] == "healthy"
        assert result["using_cache"] is False

    @pytest.mark.asyncio
    async def test_health_check_with_failing_primary(
        self, caching_client_with_failing_gcp
    ):
        """Health check should report unhealthy primary when GCP fails."""
        result = await caching_client_with_failing_gcp.health_check()

        assert result["primary"]["status"] == "unhealthy"
        assert "error" in result["primary"]
        assert result["cache"]["status"] == "healthy"

    # Test 6: test_secret adds warning when using cache
    @pytest.mark.asyncio
    async def test_test_secret_adds_warning_when_using_cache(
        self, caching_client_with_failing_gcp, infisical_client
    ):
        """test_secret should add warning when testing cached value."""
        # Pre-populate cache
        await infisical_client.set_secret("TEST_SECRET", "test-value", "dev")

        # Force cache mode by doing a get first
        await caching_client_with_failing_gcp.get_secret("TEST_SECRET", "dev")

        # Now test the secret
        result = await caching_client_with_failing_gcp.test_secret("TEST_SECRET", "dev")

        # Should succeed but with warning
        assert result["success"] is True
        assert "warning" in result
        assert "CACHED" in result["warning"]

    @pytest.mark.asyncio
    async def test_test_secret_no_warning_when_not_cached(
        self, caching_client, gcp_client
    ):
        """test_secret should not have warning when not using cache."""
        # Set up secret in GCP
        await gcp_client.set_secret("TEST_SECRET", "test-value", "dev")

        # Test via caching client
        result = await caching_client.test_secret("TEST_SECRET", "dev")

        # Should succeed without warning
        assert result["success"] is True
        assert "warning" not in result

    # Additional tests for completeness

    @pytest.mark.asyncio
    async def test_list_secrets_from_gcp_when_available(
        self, caching_client, gcp_client
    ):
        """list_secrets should use GCP when available."""
        await gcp_client.set_secret("SECRET_A", "value-a", "dev")
        await gcp_client.set_secret("SECRET_B", "value-b", "dev")

        result = await caching_client.list_secrets("dev")

        assert "SECRET_A" in result
        assert "SECRET_B" in result
        assert caching_client._using_cache is False

    @pytest.mark.asyncio
    async def test_list_secrets_from_cache_when_gcp_fails(
        self, caching_client_with_failing_gcp, infisical_client
    ):
        """list_secrets should fall back to cache when GCP fails."""
        await infisical_client.set_secret("CACHED_A", "value-a", "dev")
        await infisical_client.set_secret("CACHED_B", "value-b", "dev")

        result = await caching_client_with_failing_gcp.list_secrets("dev")

        assert "CACHED_A" in result
        assert "CACHED_B" in result
        assert caching_client_with_failing_gcp._using_cache is True

    @pytest.mark.asyncio
    async def test_delete_secret_fails_when_gcp_unreachable(
        self, caching_client_with_failing_gcp, caplog
    ):
        """delete_secret should fail when GCP is unreachable."""
        with caplog.at_level(logging.ERROR):
            result = await caching_client_with_failing_gcp.delete_secret(
                "SOME_SECRET", "dev"
            )

        assert result is False
        assert "Cannot delete" in caplog.text
        assert "Deletes require GCP" in caplog.text

    @pytest.mark.asyncio
    async def test_delete_secret_removes_from_both(
        self, caching_client, gcp_client, infisical_client
    ):
        """delete_secret should remove from both GCP and cache."""
        # Set up secret in both
        await gcp_client.set_secret("TO_DELETE", "value", "dev")
        await infisical_client.set_secret("TO_DELETE", "value", "dev")

        # Delete via caching client
        result = await caching_client.delete_secret("TO_DELETE", "dev")

        assert result is True

        # Should be gone from GCP
        assert await gcp_client.get_secret("TO_DELETE", "dev") is None

        # Should also be gone from cache
        assert await infisical_client.get_secret("TO_DELETE", "dev") is None

    @pytest.mark.asyncio
    async def test_set_secret_updates_both_backends(
        self, caching_client, gcp_client, infisical_client
    ):
        """set_secret should write to both GCP and cache."""
        result = await caching_client.set_secret("NEW_KEY", "new-value", "dev")

        assert result is True

        # Should be in GCP
        assert await gcp_client.get_secret("NEW_KEY", "dev") == "new-value"

        # Should also be in cache
        assert await infisical_client.get_secret("NEW_KEY", "dev") == "new-value"

    @pytest.mark.asyncio
    async def test_cache_update_failure_does_not_fail_operation(
        self, gcp_client, caplog
    ):
        """Cache update failure should not fail the overall operation."""
        from src.infrastructure.secrets.caching_client import CachingSecretsClient

        # Create a cache client that fails on set
        failing_cache = FailingSecretsClient(backend_name="infisical")
        caching_client = CachingSecretsClient(gcp_client, failing_cache)

        # Set a secret in GCP first
        await gcp_client.set_secret("KEY", "value", "dev")

        # Get should succeed even though cache update fails
        with caplog.at_level(logging.DEBUG):
            result = await caching_client.get_secret("KEY", "dev")

        assert result == "value"
        # Should have logged cache update failure at debug level
        assert "Failed to update cache" in caplog.text

    @pytest.mark.asyncio
    async def test_get_secret_returns_none_when_not_found(
        self, caching_client
    ):
        """get_secret should return None when secret not found in GCP."""
        result = await caching_client.get_secret("NONEXISTENT", "dev")
        assert result is None


class TestCachingClientFactory:
    """Tests for the caching client factory integration."""

    @pytest.mark.asyncio
    async def test_factory_creates_caching_client(self):
        """Factory should create CachingSecretsClient when backend is 'caching'."""
        with patch.dict("os.environ", {
            "SECRETS_BACKEND": "caching",
            "GCP_PROJECT_ID": "test-project",
            "INFISICAL_URL": "http://localhost:8086",
            "INFISICAL_CLIENT_ID": "test-client-id",
            "INFISICAL_CLIENT_SECRET": "test-client-secret",
            "INFISICAL_PROJECT_ID": "test-project-id",
        }):
            # Reset the cached client
            from src.infrastructure.secrets import client as client_module
            await client_module.reset_secrets_client()

            # Get client
            secrets_client = client_module.get_secrets_client()

            # Should be a CachingSecretsClient
            from src.infrastructure.secrets.caching_client import CachingSecretsClient
            assert isinstance(secrets_client, CachingSecretsClient)

            # Clean up
            await client_module.reset_secrets_client()
