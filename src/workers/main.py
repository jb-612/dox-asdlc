"""aSDLC Workers Service Entry Point.

Runs the stateless agent worker pool with health endpoints.
Implements P03-F01: Agent Worker Pool Framework.
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

from prometheus_client import REGISTRY, generate_latest, CONTENT_TYPE_LATEST

from src.core.config import get_config
from src.core.redis_client import get_redis_client
from src.infrastructure.health import HealthChecker, get_health_checker
from src.infrastructure.metrics import (
    ProcessMetricsCollector,
    RedisMetricsCollector,
    WorkerPoolCollector,
    initialize_service_info,
)
from src.infrastructure.redis_streams import initialize_consumer_groups
from src.workers.agents.dispatcher import AgentDispatcher
from src.workers.agents.stub_agent import StubAgent
from src.workers.config import get_worker_config
from src.workers.pool.worker_pool import WorkerPool
from src.workers.classification_worker import ClassificationWorker

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Global references for shutdown
_worker_pool: WorkerPool | None = None
_health_server: HTTPServer | None = None
_classification_worker: ClassificationWorker | None = None


class HealthHandler(BaseHTTPRequestHandler):
    """HTTP handler for health check endpoints."""

    health_checker: HealthChecker | None = None
    worker_pool: WorkerPool | None = None

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
        elif self.path == "/stats":
            self._handle_stats()
        elif self.path == "/metrics":
            self._handle_metrics()
        else:
            self._send_json_response({"error": "Not Found"}, 404)

    def _handle_health(self) -> None:
        """Handle /health endpoint."""
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(
                self.health_checker.check_health()
            )
            self._send_json_response(
                response.to_dict(), response.http_status_code()
            )
        finally:
            loop.close()

    def _handle_liveness(self) -> None:
        """Handle /health/live endpoint."""
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(
                self.health_checker.check_liveness()
            )
            self._send_json_response(
                response.to_dict(), response.http_status_code()
            )
        finally:
            loop.close()

    def _handle_readiness(self) -> None:
        """Handle /health/ready endpoint."""
        loop = asyncio.new_event_loop()
        try:
            response = loop.run_until_complete(
                self.health_checker.check_health(include_dependencies=True)
            )
            self._send_json_response(
                response.to_dict(), response.http_status_code()
            )
        finally:
            loop.close()

    def _handle_stats(self) -> None:
        """Handle /stats endpoint for worker pool metrics."""
        if self.worker_pool:
            stats = self.worker_pool.get_stats()
            self._send_json_response(stats)
        else:
            self._send_json_response({"error": "Worker pool not initialized"}, 503)

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
    pool: WorkerPool | None = None,
) -> HTTPServer:
    """Start the health check HTTP server."""
    HealthHandler.health_checker = checker
    HealthHandler.worker_pool = pool
    server = HTTPServer((host, port), HealthHandler)
    logger.info(f"Health server running on {host}:{port}")
    return server


def create_dispatcher() -> AgentDispatcher:
    """Create and configure the agent dispatcher.

    Registers available agents. Additional agents can be registered
    for domain-specific functionality.

    Returns:
        AgentDispatcher: Configured dispatcher with registered agents.
    """
    dispatcher = AgentDispatcher()

    # Register the stub agent for testing/development
    dispatcher.register(StubAgent())

    # TODO: Register domain agents in P04:
    # - CodingAgent
    # - ReviewerAgent
    # - DiscoveryAgent
    # etc.

    logger.info(f"Dispatcher configured with agents: {dispatcher.registered_agents}")
    return dispatcher


async def run_worker_pool(pool: WorkerPool) -> None:
    """Run the worker pool until shutdown.

    Args:
        pool: The worker pool to run.
    """
    try:
        await pool.start()
    except asyncio.CancelledError:
        logger.info("Worker pool task cancelled")
    except Exception as e:
        logger.exception(f"Worker pool error: {e}")
        raise


async def async_main() -> None:
    """Async main function that runs the worker pool."""
    global _worker_pool, _health_server, _classification_worker

    logger.info("Starting aSDLC Workers Service")

    # Load configuration
    try:
        config = get_config()
        service_name = config.service.name
        port = config.service.port
        host = config.service.host
        workspace_path = config.workspace_path
    except Exception as e:
        logger.warning(f"Config error, using defaults: {e}")
        service_name = os.getenv("SERVICE_NAME", "workers")
        port = int(os.getenv("SERVICE_PORT", "8081"))
        host = os.getenv("SERVICE_HOST", "0.0.0.0")
        workspace_path = os.getenv("WORKSPACE_PATH", "/app/workspace")

    # Load worker config
    worker_config = get_worker_config()
    logger.info(
        f"Worker config: pool_size={worker_config.pool_size}, "
        f"batch_size={worker_config.batch_size}, "
        f"consumer_group={worker_config.consumer_group}"
    )

    # Initialize Redis client
    redis_client = await get_redis_client()

    # Initialize consumer groups
    try:
        await initialize_consumer_groups(redis_client)
        logger.info("Consumer groups initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize consumer groups: {e}")

    # Create dispatcher with registered agents
    dispatcher = create_dispatcher()

    # Create worker pool
    _worker_pool = WorkerPool(
        redis_client=redis_client,
        config=worker_config,
        dispatcher=dispatcher,
        workspace_path=workspace_path,
    )

    # Initialize health checker
    health_checker = get_health_checker(service_name)

    # Initialize metrics
    initialize_service_info(service_name=service_name, version="0.1.0")

    # Register custom metrics collectors
    try:
        REGISTRY.register(RedisMetricsCollector(service_name, health_checker))
        REGISTRY.register(WorkerPoolCollector(service_name, _worker_pool))
        REGISTRY.register(ProcessMetricsCollector(service_name))
        logger.info("Prometheus metrics collectors registered")
    except Exception as e:
        logger.warning(f"Failed to register metrics collectors: {e}")

    # Start health server in a thread
    _health_server = run_health_server(host, port, health_checker, _worker_pool)
    health_thread = threading.Thread(target=_health_server.serve_forever)
    health_thread.daemon = True
    health_thread.start()

    logger.info(f"Workers service ready on {host}:{port}")
    logger.info(f"Health check: http://localhost:{port}/health")
    logger.info(f"Metrics: http://localhost:{port}/metrics")
    logger.info(f"Stats: http://localhost:{port}/stats")

    # Start classification worker if classification service is available
    classification_task = None
    try:
        from src.orchestrator.services.classification_service import (
            ClassificationService,
            get_classification_service,
        )

        classification_service = get_classification_service()
        if classification_service:
            _classification_worker = ClassificationWorker(
                redis_client=redis_client,
                classification_service=classification_service,
            )
            classification_task = asyncio.create_task(
                _classification_worker.start(),
                name="classification-worker",
            )
            logger.info("Classification worker started")
        else:
            logger.warning("Classification service not available, worker not started")
    except ImportError as e:
        logger.warning(f"Classification worker not available: {e}")
    except Exception as e:
        logger.error(f"Failed to start classification worker: {e}")

    # Run worker pool
    try:
        await run_worker_pool(_worker_pool)
    finally:
        # Stop classification worker
        if classification_task and _classification_worker:
            await _classification_worker.stop()
            classification_task.cancel()
            try:
                await classification_task
            except asyncio.CancelledError:
                pass


def handle_shutdown(signum: int, frame: Any) -> None:
    """Handle shutdown signals."""
    global _worker_pool, _health_server, _classification_worker

    logger.info(f"Received signal {signum}, shutting down...")

    # Stop health server
    if _health_server:
        _health_server.shutdown()

    # Stop classification worker
    if _classification_worker:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_classification_worker.stop())

    # Stop worker pool (needs to be done in the event loop)
    if _worker_pool:
        # Create a task to stop the pool
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_worker_pool.stop())
        else:
            loop.run_until_complete(_worker_pool.stop())


def main() -> None:
    """Main entry point for workers service."""
    # Set up signal handlers
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        pass
    finally:
        logger.info("Workers service stopped")


if __name__ == "__main__":
    main()
