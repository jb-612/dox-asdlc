"""Review Swarm Service Entry Point.

Runs the parallel review swarm service with health endpoints.
Implements P04-F05: Parallel Review Swarm.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, generate_latest

from src.core.redis_client import close_redis_client, get_redis_client
from src.infrastructure.health import HealthChecker, get_health_checker
from src.infrastructure.metrics import (
    ProcessMetricsCollector,
    RedisMetricsCollector,
    initialize_service_info,
)
from src.workers.swarm.config import SwarmConfig, get_swarm_config
from src.workers.swarm.dispatcher import SwarmDispatcher
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.reviewers import default_registry
from src.workers.swarm.session import SwarmSessionManager

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global references for shutdown
_health_server: HTTPServer | None = None
_shutdown_event: asyncio.Event | None = None

# Global references for dependency injection
_swarm_session_manager: SwarmSessionManager | None = None
_swarm_dispatcher: SwarmDispatcher | None = None


class HealthHandler(BaseHTTPRequestHandler):
    """HTTP handler for health check endpoints."""

    health_checker: HealthChecker | None = None

    def log_message(self, format: str, *args: Any) -> None:
        """Override to use Python logging."""
        logger.debug(f"HTTP: {format % args}")

    def _send_json_response(self, data: dict, status: int = 200) -> None:
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_GET(self) -> None:
        """Handle GET requests."""
        if self.path == "/health":
            self._handle_health()
        elif self.path == "/health/live":
            self._handle_liveness()
        elif self.path == "/health/ready":
            self._handle_readiness()
        elif self.path == "/metrics":
            self._handle_metrics()
        else:
            self._send_json_response({"error": "Not Found"}, 404)

    def _handle_health(self) -> None:
        """Handle /health endpoint."""
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(self.health_checker.check_health())
            self._send_json_response(response.to_dict(), response.http_status_code())
        finally:
            loop.close()

    def _handle_liveness(self) -> None:
        """Handle /health/live endpoint."""
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(self.health_checker.check_liveness())
            self._send_json_response(response.to_dict(), response.http_status_code())
        finally:
            loop.close()

    def _handle_readiness(self) -> None:
        """Handle /health/ready endpoint."""
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(
                self.health_checker.check_health(include_dependencies=True)
            )
            self._send_json_response(response.to_dict(), response.http_status_code())
        finally:
            loop.close()

    def _handle_metrics(self) -> None:
        """Handle /metrics endpoint for Prometheus scraping."""
        output = generate_latest(REGISTRY)
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPE_LATEST)
        self.end_headers()
        self.wfile.write(output)


def run_health_server(
    host: str,
    port: int,
    checker: HealthChecker,
) -> HTTPServer:
    """Start the health check HTTP server.

    Args:
        host: Host to bind to.
        port: Port to bind to.
        checker: Health checker instance.

    Returns:
        HTTPServer: The running health server.
    """
    HealthHandler.health_checker = checker
    server = HTTPServer((host, port), HealthHandler)
    logger.info(f"Health server running on {host}:{port}")
    return server


def get_injected_session_manager() -> SwarmSessionManager | None:
    """Get the injected swarm session manager.

    Returns:
        SwarmSessionManager instance or None if not initialized.
    """
    return _swarm_session_manager


def get_injected_dispatcher() -> SwarmDispatcher | None:
    """Get the injected swarm dispatcher.

    Returns:
        SwarmDispatcher instance or None if not initialized.
    """
    return _swarm_dispatcher


def create_fastapi_app() -> Any:
    """Create and configure the FastAPI application.

    Returns:
        FastAPI application instance.
    """
    from fastapi import FastAPI

    from src.orchestrator.routes import swarm as swarm_routes

    app = FastAPI(
        title="Review Swarm Service",
        description="Parallel code review swarm service for P04-F05",
        version="0.1.0",
    )

    # Override the dependency injection functions
    swarm_routes.get_swarm_session_manager = get_injected_session_manager
    swarm_routes.get_swarm_dispatcher = get_injected_dispatcher

    # Include the swarm router
    app.include_router(swarm_routes.router)

    return app


async def run_fastapi_server(app: Any, host: str, port: int) -> None:
    """Run the FastAPI server using uvicorn.

    Args:
        app: FastAPI application instance.
        host: Host to bind to.
        port: Port to bind to.
    """
    import uvicorn

    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)

    # Run server until shutdown
    await server.serve()


async def async_main() -> None:
    """Async main function that runs the review swarm service."""
    global _health_server, _shutdown_event
    global _swarm_session_manager, _swarm_dispatcher

    logger.info("Starting Review Swarm Service")

    # Load configuration
    service_name = os.getenv("SERVICE_NAME", "review-swarm")
    health_port = int(os.getenv("HEALTH_PORT", "8083"))
    api_port = int(os.getenv("SERVICE_PORT", "8082"))
    host = os.getenv("SERVICE_HOST", "0.0.0.0")

    # Load swarm config
    swarm_config = get_swarm_config()
    logger.info(
        f"Swarm config: max_concurrent={swarm_config.max_concurrent_swarms}, "
        f"default_reviewers={swarm_config.default_reviewers}"
    )

    # Initialize Redis client
    redis_client = await get_redis_client()
    logger.info("Redis client initialized")

    # Create swarm components
    redis_store = SwarmRedisStore(redis_client, swarm_config)
    _swarm_session_manager = SwarmSessionManager(redis_store, swarm_config)
    _swarm_dispatcher = SwarmDispatcher(
        session_manager=_swarm_session_manager,
        redis_store=redis_store,
        registry=default_registry,
        config=swarm_config,
    )
    logger.info("Swarm components initialized")

    # Initialize health checker
    health_checker = get_health_checker(service_name)

    # Initialize metrics
    initialize_service_info(service_name=service_name, version="0.1.0")

    # Register custom metrics collectors
    try:
        REGISTRY.register(RedisMetricsCollector(service_name, health_checker))
        REGISTRY.register(ProcessMetricsCollector(service_name))
        logger.info("Prometheus metrics collectors registered")
    except Exception as e:
        logger.warning(f"Failed to register metrics collectors: {e}")

    # Start health server in a thread
    _health_server = run_health_server(host, health_port, health_checker)
    health_thread = threading.Thread(target=_health_server.serve_forever)
    health_thread.daemon = True
    health_thread.start()

    logger.info(f"Review Swarm service ready")
    logger.info(f"Health check: http://localhost:{health_port}/health")
    logger.info(f"Metrics: http://localhost:{health_port}/metrics")
    logger.info(f"API: http://localhost:{api_port}/api/swarm/review")

    # Create FastAPI app
    app = create_fastapi_app()

    # Create shutdown event
    _shutdown_event = asyncio.Event()

    # Run FastAPI server
    try:
        await run_fastapi_server(app, host, api_port)
    except asyncio.CancelledError:
        logger.info("FastAPI server cancelled")
    finally:
        # Cleanup
        await close_redis_client()
        logger.info("Redis client closed")


def handle_shutdown(signum: int, frame: Any) -> None:
    """Handle shutdown signals.

    Args:
        signum: Signal number received.
        frame: Current stack frame.
    """
    global _health_server, _shutdown_event

    logger.info(f"Received signal {signum}, shutting down...")

    # Stop health server
    if _health_server:
        _health_server.shutdown()

    # Signal shutdown
    if _shutdown_event:
        _shutdown_event.set()


def main() -> None:
    """Main entry point for review swarm service."""
    # Set up signal handlers
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("Review Swarm service stopped")


if __name__ == "__main__":
    main()
