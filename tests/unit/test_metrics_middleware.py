"""Unit tests for Prometheus metrics middleware.

Tests verify:
- Request count is incremented correctly
- Request latency is recorded
- /metrics endpoint is skipped
- Endpoint paths are normalized
- Exception handling during middleware
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.requests import Request
from starlette.responses import Response


@pytest.fixture
def mock_request() -> MagicMock:
    """Create a mock Starlette request."""
    request = MagicMock(spec=Request)
    request.method = "GET"
    request.url = MagicMock()
    request.url.path = "/api/health"
    return request


@pytest.fixture
def mock_response() -> Response:
    """Create a mock Starlette response."""
    return Response(content="OK", status_code=200)


class TestPrometheusMiddleware:
    """Tests for PrometheusMiddleware class."""

    def test_middleware_accepts_service_name(self) -> None:
        """Should accept service_name in constructor."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        app = MagicMock()
        middleware = PrometheusMiddleware(app, service_name="test-service")

        assert middleware.service_name == "test-service"

    @pytest.mark.asyncio
    async def test_increments_request_count(
        self, mock_request: MagicMock, mock_response: Response
    ) -> None:
        """Should increment REQUEST_COUNT on each request."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_COUNT"
        ) as mock_counter:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            call_next = AsyncMock(return_value=mock_response)
            await middleware.dispatch(mock_request, call_next)

            mock_counter.labels.assert_called_once_with(
                service="test-service",
                method="GET",
                endpoint="/api/health",
                status=200,
            )
            mock_counter.labels.return_value.inc.assert_called_once()

    @pytest.mark.asyncio
    async def test_records_request_latency(
        self, mock_request: MagicMock, mock_response: Response
    ) -> None:
        """Should record request latency in REQUEST_LATENCY histogram."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_LATENCY"
        ) as mock_histogram:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            call_next = AsyncMock(return_value=mock_response)
            await middleware.dispatch(mock_request, call_next)

            mock_histogram.labels.assert_called_once_with(
                service="test-service",
                method="GET",
                endpoint="/api/health",
            )
            mock_histogram.labels.return_value.observe.assert_called_once()
            # Check that observe was called with a positive duration
            args = mock_histogram.labels.return_value.observe.call_args[0]
            assert args[0] >= 0

    @pytest.mark.asyncio
    async def test_skips_metrics_endpoint(self, mock_response: Response) -> None:
        """Should skip tracking for /metrics endpoint."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_COUNT"
        ) as mock_counter:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            # Create request for /metrics
            request = MagicMock(spec=Request)
            request.url = MagicMock()
            request.url.path = "/metrics"

            call_next = AsyncMock(return_value=mock_response)
            await middleware.dispatch(request, call_next)

            # Should not have called labels/inc for /metrics
            mock_counter.labels.assert_not_called()

    @pytest.mark.asyncio
    async def test_calls_next_handler(
        self, mock_request: MagicMock, mock_response: Response
    ) -> None:
        """Should call the next handler in the chain."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        app = MagicMock()
        middleware = PrometheusMiddleware(app, service_name="test-service")

        call_next = AsyncMock(return_value=mock_response)
        result = await middleware.dispatch(mock_request, call_next)

        call_next.assert_awaited_once_with(mock_request)
        assert result == mock_response

    @pytest.mark.asyncio
    async def test_returns_response(
        self, mock_request: MagicMock, mock_response: Response
    ) -> None:
        """Should return the response from next handler."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        app = MagicMock()
        middleware = PrometheusMiddleware(app, service_name="test-service")

        call_next = AsyncMock(return_value=mock_response)
        result = await middleware.dispatch(mock_request, call_next)

        assert result.status_code == 200


class TestEndpointNormalization:
    """Tests for endpoint path normalization."""

    @pytest.mark.asyncio
    async def test_normalizes_uuid_in_path(self) -> None:
        """Should normalize UUID segments to prevent cardinality explosion."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_LATENCY"
        ) as mock_histogram:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            request = MagicMock(spec=Request)
            request.method = "GET"
            request.url = MagicMock()
            request.url.path = (
                "/api/tasks/123e4567-e89b-12d3-a456-426614174000/status"
            )

            call_next = AsyncMock(return_value=Response(status_code=200))
            await middleware.dispatch(request, call_next)

            # Check that path was normalized
            call_args = mock_histogram.labels.call_args
            assert call_args[1]["endpoint"] == "/api/tasks/:id/status"

    @pytest.mark.asyncio
    async def test_normalizes_numeric_ids(self) -> None:
        """Should normalize numeric IDs in path segments."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_LATENCY"
        ) as mock_histogram:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            request = MagicMock(spec=Request)
            request.method = "GET"
            request.url = MagicMock()
            request.url.path = "/api/users/12345/profile"

            call_next = AsyncMock(return_value=Response(status_code=200))
            await middleware.dispatch(request, call_next)

            call_args = mock_histogram.labels.call_args
            assert call_args[1]["endpoint"] == "/api/users/:id/profile"

    @pytest.mark.asyncio
    async def test_preserves_static_paths(self) -> None:
        """Should preserve static path segments."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_LATENCY"
        ) as mock_histogram:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            request = MagicMock(spec=Request)
            request.method = "GET"
            request.url = MagicMock()
            request.url.path = "/api/health/ready"

            call_next = AsyncMock(return_value=Response(status_code=200))
            await middleware.dispatch(request, call_next)

            call_args = mock_histogram.labels.call_args
            assert call_args[1]["endpoint"] == "/api/health/ready"


class TestMiddlewareExceptionHandling:
    """Tests for exception handling in middleware."""

    @pytest.mark.asyncio
    async def test_records_metrics_on_exception(
        self, mock_request: MagicMock
    ) -> None:
        """Should still record metrics when handler raises exception."""
        from src.infrastructure.metrics.middleware import PrometheusMiddleware

        with patch(
            "src.infrastructure.metrics.middleware.REQUEST_COUNT"
        ) as mock_counter:
            app = MagicMock()
            middleware = PrometheusMiddleware(app, service_name="test-service")

            call_next = AsyncMock(side_effect=Exception("Test error"))

            with pytest.raises(Exception, match="Test error"):
                await middleware.dispatch(mock_request, call_next)

            # Metrics should still be recorded with status 500
            mock_counter.labels.assert_called_once()
            call_args = mock_counter.labels.call_args
            assert call_args[1]["status"] == 500
