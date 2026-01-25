"""Unit tests for VictoriaMetrics proxy API.

Tests verify:
- GET /api/metrics/query_range proxies PromQL queries to VictoriaMetrics
- GET /api/metrics/services lists available services
- GET /api/metrics/health checks VictoriaMetrics connectivity
- Proper error handling for VictoriaMetrics unavailability
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def mock_httpx_client() -> MagicMock:
    """Create a mock httpx.AsyncClient."""
    return MagicMock()


@pytest.fixture
def app() -> FastAPI:
    """Create a test FastAPI app with the metrics router."""
    from src.orchestrator.routes.metrics_api import router

    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create a test client for the app."""
    return TestClient(app)


class TestQueryRangeEndpoint:
    """Tests for GET /api/metrics/query_range."""

    @pytest.mark.asyncio
    async def test_query_range_success(self, app: FastAPI) -> None:
        """query_range should proxy to VictoriaMetrics and return results."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {
                "resultType": "matrix",
                "result": [
                    {
                        "metric": {"service": "orchestrator"},
                        "values": [[1706000000, "100"]],
                    }
                ],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get(
                    "/api/metrics/query_range",
                    params={
                        "query": "asdlc_http_requests_total",
                        "start": "2024-01-01T00:00:00Z",
                        "end": "2024-01-01T01:00:00Z",
                        "step": "15s",
                    },
                )

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "success"

    @pytest.mark.asyncio
    async def test_query_range_requires_query_param(self, client: TestClient) -> None:
        """query_range should require query parameter."""
        response = client.get(
            "/api/metrics/query_range",
            params={
                "start": "2024-01-01T00:00:00Z",
                "end": "2024-01-01T01:00:00Z",
            },
        )
        # FastAPI returns 422 for validation errors
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_query_range_requires_start_param(self, client: TestClient) -> None:
        """query_range should require start parameter."""
        response = client.get(
            "/api/metrics/query_range",
            params={
                "query": "asdlc_http_requests_total",
                "end": "2024-01-01T01:00:00Z",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_query_range_requires_end_param(self, client: TestClient) -> None:
        """query_range should require end parameter."""
        response = client.get(
            "/api/metrics/query_range",
            params={
                "query": "asdlc_http_requests_total",
                "start": "2024-01-01T00:00:00Z",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_query_range_default_step(self, app: FastAPI) -> None:
        """query_range should use default step of 15s."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "success", "data": {}}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get(
                    "/api/metrics/query_range",
                    params={
                        "query": "test",
                        "start": "2024-01-01T00:00:00Z",
                        "end": "2024-01-01T01:00:00Z",
                    },
                )

                # Verify the call was made with default step
                mock_client.get.assert_called_once()
                call_kwargs = mock_client.get.call_args
                assert call_kwargs.kwargs["params"]["step"] == "15s"

    @pytest.mark.asyncio
    async def test_query_range_vm_unavailable(self, app: FastAPI) -> None:
        """query_range should return 503 when VictoriaMetrics is unavailable."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(
                side_effect=httpx.RequestError("Connection refused")
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get(
                    "/api/metrics/query_range",
                    params={
                        "query": "test",
                        "start": "2024-01-01T00:00:00Z",
                        "end": "2024-01-01T01:00:00Z",
                    },
                )

                assert response.status_code == 503
                assert "unavailable" in response.json()["detail"].lower()


class TestServicesEndpoint:
    """Tests for GET /api/metrics/services."""

    @pytest.mark.asyncio
    async def test_services_returns_list(self, app: FastAPI) -> None:
        """services should return a list of service names."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {
                "result": [
                    {"metric": {"service": "orchestrator"}},
                    {"metric": {"service": "workers"}},
                ],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get("/api/metrics/services")

                assert response.status_code == 200
                services = response.json()
                assert isinstance(services, list)
                assert "orchestrator" in services
                assert "workers" in services

    @pytest.mark.asyncio
    async def test_services_fallback_on_error(self, app: FastAPI) -> None:
        """services should return fallback list when VictoriaMetrics fails."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(
                side_effect=httpx.RequestError("Connection refused")
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get("/api/metrics/services")

                assert response.status_code == 200
                services = response.json()
                # Fallback should include known services
                assert "orchestrator" in services
                assert "workers" in services

    @pytest.mark.asyncio
    async def test_services_deduplicates(self, app: FastAPI) -> None:
        """services should return unique service names."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {
                "result": [
                    {"metric": {"service": "orchestrator"}},
                    {"metric": {"service": "orchestrator"}},
                    {"metric": {"service": "workers"}},
                ],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get("/api/metrics/services")

                services = response.json()
                # Should be deduplicated
                assert services.count("orchestrator") == 1


class TestHealthEndpoint:
    """Tests for GET /api/metrics/health."""

    @pytest.mark.asyncio
    async def test_health_returns_healthy(self, app: FastAPI) -> None:
        """health should return healthy when VictoriaMetrics is accessible."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get("/api/metrics/health")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_health_returns_degraded(self, app: FastAPI) -> None:
        """health should return degraded when VictoriaMetrics returns non-200."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get("/api/metrics/health")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "degraded"

    @pytest.mark.asyncio
    async def test_health_returns_unhealthy(self, app: FastAPI) -> None:
        """health should return unhealthy when VictoriaMetrics is unreachable."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(
                side_effect=httpx.RequestError("Connection refused")
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_class.return_value = mock_client

            with TestClient(app) as client:
                response = client.get("/api/metrics/health")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "unhealthy"
                assert "error" in data


class TestRouterConfiguration:
    """Tests for router configuration."""

    def test_router_has_correct_prefix(self) -> None:
        """Router should have /api/metrics prefix."""
        from src.orchestrator.routes.metrics_api import router

        assert router.prefix == "/api/metrics"

    def test_router_has_metrics_tag(self) -> None:
        """Router should have metrics tag."""
        from src.orchestrator.routes.metrics_api import router

        assert "metrics" in router.tags
