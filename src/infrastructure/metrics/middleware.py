"""FastAPI middleware for Prometheus metrics collection.

Automatically tracks HTTP request counts and latencies for all endpoints,
following Prometheus best practices for cardinality control.
"""

from __future__ import annotations

import re
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.infrastructure.metrics.definitions import REQUEST_COUNT, REQUEST_LATENCY

# Patterns for normalizing dynamic path segments
UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)
NUMERIC_ID_PATTERN = re.compile(r"^[0-9]+$")


def normalize_endpoint_path(path: str) -> str:
    """Normalize endpoint path to prevent cardinality explosion.

    Replaces dynamic segments like UUIDs and numeric IDs with placeholders.

    Args:
        path: The original request path.

    Returns:
        str: Normalized path with dynamic segments replaced.

    Examples:
        >>> normalize_endpoint_path("/api/tasks/123e4567-e89b-12d3-a456-426614174000")
        '/api/tasks/:id'
        >>> normalize_endpoint_path("/api/users/12345/profile")
        '/api/users/:id/profile'
    """
    # Replace UUIDs
    path = UUID_PATTERN.sub(":id", path)

    # Replace numeric IDs in path segments
    segments = path.split("/")
    normalized_segments = []

    for segment in segments:
        if NUMERIC_ID_PATTERN.match(segment):
            normalized_segments.append(":id")
        else:
            normalized_segments.append(segment)

    return "/".join(normalized_segments)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Starlette/FastAPI middleware for collecting HTTP request metrics.

    Tracks:
    - Request count per service/method/endpoint/status
    - Request latency per service/method/endpoint

    The middleware skips the /metrics endpoint to avoid recursion.

    Example:
        app = FastAPI()
        app.add_middleware(PrometheusMiddleware, service_name="orchestrator")
    """

    def __init__(self, app: object, service_name: str) -> None:
        """Initialize the middleware.

        Args:
            app: The Starlette/FastAPI application.
            service_name: Name of the service for metric labels.
        """
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Response]
    ) -> Response:
        """Process the request and record metrics.

        Args:
            request: The incoming request.
            call_next: The next handler in the chain.

        Returns:
            Response: The response from the next handler.
        """
        # Skip metrics endpoint to avoid recursion
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.perf_counter()
        status_code = 500  # Default in case of exception

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            # Re-raise after recording metrics
            raise
        finally:
            # Calculate duration
            duration = time.perf_counter() - start_time

            # Normalize endpoint path
            endpoint = normalize_endpoint_path(request.url.path)

            # Record request count
            REQUEST_COUNT.labels(
                service=self.service_name,
                method=request.method,
                endpoint=endpoint,
                status=status_code,
            ).inc()

            # Record request latency
            REQUEST_LATENCY.labels(
                service=self.service_name,
                method=request.method,
                endpoint=endpoint,
            ).observe(duration)


__all__ = [
    "PrometheusMiddleware",
    "normalize_endpoint_path",
]
