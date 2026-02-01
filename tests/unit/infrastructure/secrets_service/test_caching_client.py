"""Unit tests for CachingSecretsClient.

Tests the GCP-primary with Infisical cache fallback pattern.
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.infrastructure.secrets.caching_client import CachingSecretsClient


class TestCachingSecretsClientInit:
    """Tests for CachingSecretsClient initialization."""

    def test_init_stores_clients(self):
        """Test that init stores the primary and cache clients."""
        mock_gcp = MagicMock()
        mock_infisical = MagicMock()

        client = CachingSecretsClient(mock_gcp, mock_infisical)

        assert client.primary is mock_gcp
        assert client.cache is mock_infisical

    def test_init_sets_using_cache_to_false(self):
        """Test that init sets _using_cache to False."""
        mock_gcp = MagicMock()
        mock_infisical = MagicMock()

        client = CachingSecretsClient(mock_gcp, mock_infisical)

        assert client._using_cache is False


class TestCachingSecretsClientGetSecret:
    """Tests for CachingSecretsClient get_secret method."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.get_secret = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.get_secret = AsyncMock()
        mock_infisical.set_secret = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_get_secret_uses_gcp_when_available(self, client):
        """Test that get_secret uses GCP when available."""
        client.primary.get_secret.return_value = "gcp-secret-value"

        result = await client.get_secret("MY_SECRET", "dev")

        assert result == "gcp-secret-value"
        client.primary.get_secret.assert_called_once_with("MY_SECRET", "dev")

    @pytest.mark.asyncio
    async def test_get_secret_caches_to_infisical_on_success(self, client):
        """Test that get_secret caches to Infisical when GCP succeeds."""
        client.primary.get_secret.return_value = "gcp-secret-value"
        client.cache.set_secret.return_value = True

        await client.get_secret("MY_SECRET", "dev")

        client.cache.set_secret.assert_called_once_with("MY_SECRET", "gcp-secret-value", "dev")

    @pytest.mark.asyncio
    async def test_get_secret_falls_back_to_cache_on_gcp_failure(self, client):
        """Test that get_secret falls back to cache when GCP fails."""
        client.primary.get_secret.side_effect = Exception("GCP unavailable")
        client.cache.get_secret.return_value = "cached-secret-value"

        result = await client.get_secret("MY_SECRET", "dev")

        assert result == "cached-secret-value"
        client.cache.get_secret.assert_called_once_with("MY_SECRET", "dev")

    @pytest.mark.asyncio
    async def test_get_secret_sets_using_cache_flag_on_fallback(self, client):
        """Test that get_secret sets _using_cache flag when falling back."""
        client.primary.get_secret.side_effect = Exception("GCP unavailable")
        client.cache.get_secret.return_value = "cached-value"

        await client.get_secret("MY_SECRET", "dev")

        assert client._using_cache is True

    @pytest.mark.asyncio
    async def test_get_secret_clears_using_cache_flag_on_gcp_success(self, client):
        """Test that get_secret clears _using_cache flag when GCP succeeds."""
        client._using_cache = True
        client.primary.get_secret.return_value = "gcp-value"

        await client.get_secret("MY_SECRET", "dev")

        assert client._using_cache is False

    @pytest.mark.asyncio
    async def test_get_secret_logs_warning_on_fallback(self, client, caplog):
        """Test that get_secret logs warning when falling back to cache."""
        client.primary.get_secret.side_effect = Exception("GCP unavailable")
        client.cache.get_secret.return_value = "cached-value"

        with caplog.at_level(logging.WARNING):
            await client.get_secret("MY_SECRET", "dev")

        assert "GCP unavailable" in caplog.text
        assert "cached" in caplog.text.lower()


class TestCachingSecretsClientSetSecret:
    """Tests for CachingSecretsClient set_secret method."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.set_secret = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.set_secret = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_set_secret_writes_to_gcp(self, client):
        """Test that set_secret writes to GCP (source of truth)."""
        client.primary.set_secret.return_value = True

        result = await client.set_secret("MY_SECRET", "my-value", "dev")

        assert result is True
        client.primary.set_secret.assert_called_once_with("MY_SECRET", "my-value", "dev")

    @pytest.mark.asyncio
    async def test_set_secret_also_updates_cache_on_success(self, client):
        """Test that set_secret also updates cache when GCP succeeds."""
        client.primary.set_secret.return_value = True
        client.cache.set_secret.return_value = True

        await client.set_secret("MY_SECRET", "my-value", "dev")

        client.cache.set_secret.assert_called_once_with("MY_SECRET", "my-value", "dev")

    @pytest.mark.asyncio
    async def test_set_secret_fails_when_gcp_unreachable(self, client):
        """Test that set_secret fails when GCP unreachable (no writes to cache-only)."""
        client.primary.set_secret.side_effect = Exception("GCP unavailable")

        result = await client.set_secret("MY_SECRET", "my-value", "dev")

        assert result is False
        # Should NOT write to cache when GCP is unavailable
        client.cache.set_secret.assert_not_called()

    @pytest.mark.asyncio
    async def test_set_secret_logs_error_on_gcp_failure(self, client, caplog):
        """Test that set_secret logs error when GCP fails."""
        client.primary.set_secret.side_effect = Exception("GCP unavailable")

        with caplog.at_level(logging.ERROR):
            await client.set_secret("MY_SECRET", "my-value", "dev")

        assert "GCP" in caplog.text
        assert "unavailable" in caplog.text.lower() or "failed" in caplog.text.lower()


class TestCachingSecretsClientListSecrets:
    """Tests for CachingSecretsClient list_secrets method."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.list_secrets = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.list_secrets = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_list_secrets_uses_gcp_when_available(self, client):
        """Test that list_secrets uses GCP when available."""
        client.primary.list_secrets.return_value = ["SECRET_ONE", "SECRET_TWO"]

        result = await client.list_secrets("dev")

        assert result == ["SECRET_ONE", "SECRET_TWO"]
        client.primary.list_secrets.assert_called_once_with("dev")

    @pytest.mark.asyncio
    async def test_list_secrets_falls_back_to_cache_on_gcp_failure(self, client):
        """Test that list_secrets falls back to cache when GCP fails."""
        client.primary.list_secrets.side_effect = Exception("GCP unavailable")
        client.cache.list_secrets.return_value = ["CACHED_SECRET"]

        result = await client.list_secrets("dev")

        assert result == ["CACHED_SECRET"]
        client.cache.list_secrets.assert_called_once_with("dev")


class TestCachingSecretsClientDeleteSecret:
    """Tests for CachingSecretsClient delete_secret method."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.delete_secret = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.delete_secret = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_delete_secret_deletes_from_gcp(self, client):
        """Test that delete_secret deletes from GCP."""
        client.primary.delete_secret.return_value = True

        result = await client.delete_secret("MY_SECRET", "dev")

        assert result is True
        client.primary.delete_secret.assert_called_once_with("MY_SECRET", "dev")

    @pytest.mark.asyncio
    async def test_delete_secret_also_removes_from_cache(self, client):
        """Test that delete_secret also removes from cache."""
        client.primary.delete_secret.return_value = True
        client.cache.delete_secret.return_value = True

        await client.delete_secret("MY_SECRET", "dev")

        client.cache.delete_secret.assert_called_once_with("MY_SECRET", "dev")

    @pytest.mark.asyncio
    async def test_delete_secret_fails_when_gcp_unreachable(self, client):
        """Test that delete_secret fails when GCP unreachable."""
        client.primary.delete_secret.side_effect = Exception("GCP unavailable")

        result = await client.delete_secret("MY_SECRET", "dev")

        assert result is False


class TestCachingSecretsClientTestSecret:
    """Tests for CachingSecretsClient test_secret method."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.test_secret = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.test_secret = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_test_secret_tests_against_gcp(self, client):
        """Test that test_secret tests against GCP."""
        client.primary.test_secret.return_value = {"success": True, "message": "Secret accessible"}

        result = await client.test_secret("MY_SECRET", "dev")

        assert result["success"] is True
        client.primary.test_secret.assert_called_once_with("MY_SECRET", "dev")

    @pytest.mark.asyncio
    async def test_test_secret_warns_when_using_cache(self, client):
        """Test that test_secret warns when using cache."""
        client._using_cache = True
        client.cache.test_secret.return_value = {"success": True, "message": "Secret exists"}

        result = await client.test_secret("MY_SECRET", "dev")

        # Should still return success but with warning in message
        assert result["success"] is True
        assert "cache" in result.get("warning", result.get("message", "")).lower()


class TestCachingSecretsClientHealthCheck:
    """Tests for CachingSecretsClient health_check method."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.health_check = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.health_check = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_health_check_returns_both_statuses(self, client):
        """Test that health_check returns both primary and cache status."""
        client.primary.health_check.return_value = {"status": "healthy"}
        client.cache.health_check.return_value = {"status": "healthy"}

        result = await client.health_check()

        assert "primary" in result
        assert "cache" in result
        assert result["primary"]["status"] == "healthy"
        assert result["cache"]["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_health_check_indicates_when_using_cache(self, client):
        """Test that health_check indicates when using cache."""
        client._using_cache = True
        client.primary.health_check.side_effect = Exception("GCP unavailable")
        client.cache.health_check.return_value = {"status": "healthy"}

        result = await client.health_check()

        assert result["using_cache"] is True
        assert result["primary"]["status"] == "unhealthy"

    @pytest.mark.asyncio
    async def test_health_check_handles_missing_health_check_method(self, client):
        """Test that health_check handles backends without health_check."""
        del client.primary.health_check
        del client.cache.health_check

        result = await client.health_check()

        assert "primary" in result
        assert "cache" in result


class TestCachingSecretsClientBackendType:
    """Tests for CachingSecretsClient backend_type property."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_infisical = MagicMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    def test_backend_type_returns_gcp_when_not_using_cache(self, client):
        """Test that backend_type returns 'gcp' when not using cache."""
        client._using_cache = False

        assert client.backend_type == "gcp"

    def test_backend_type_returns_cached_when_using_cache(self, client):
        """Test that backend_type returns 'infisical (cached)' when using cache."""
        client._using_cache = True

        assert client.backend_type == "infisical (cached)"


class TestCachingSecretsClientCacheWarning:
    """Tests for cache warning behavior."""

    @pytest.fixture
    def client(self):
        """Create a CachingSecretsClient with mocked backends."""
        mock_gcp = MagicMock()
        mock_gcp.get_secret = AsyncMock()
        mock_infisical = MagicMock()
        mock_infisical.get_secret = AsyncMock()
        return CachingSecretsClient(mock_gcp, mock_infisical)

    @pytest.mark.asyncio
    async def test_cache_warning_shown_once(self, client, caplog):
        """Test that cache warning is shown only once."""
        client.primary.get_secret.side_effect = Exception("GCP unavailable")
        client.cache.get_secret.return_value = "cached-value"

        with caplog.at_level(logging.WARNING):
            await client.get_secret("SECRET_ONE", "dev")
            await client.get_secret("SECRET_TWO", "dev")

        # Warning about stale secrets should appear only once
        stale_warnings = [r for r in caplog.records if "stale" in r.message.lower()]
        assert len(stale_warnings) <= 1

    @pytest.mark.asyncio
    async def test_cache_warning_resets_after_gcp_recovery(self, client, caplog):
        """Test that cache warning can be shown again after GCP recovery."""
        # First fail
        client.primary.get_secret.side_effect = Exception("GCP unavailable")
        client.cache.get_secret.return_value = "cached-value"

        with caplog.at_level(logging.WARNING):
            await client.get_secret("SECRET", "dev")

        # GCP recovers
        client.primary.get_secret.side_effect = None
        client.primary.get_secret.return_value = "gcp-value"
        client.cache.set_secret = AsyncMock()

        await client.get_secret("SECRET", "dev")

        # Should reset warning flag
        assert client._cache_warning_shown is False
