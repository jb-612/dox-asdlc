"""aSDLC Orchestrator Service Entry Point.

Runs the orchestrator/governance service with health and KnowledgeStore API endpoints.
Uses FastAPI for async HTTP handling.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_config
from src.infrastructure.health import get_health_checker, HealthChecker
from src.infrastructure.redis_streams import initialize_consumer_groups
from src.orchestrator.knowledge_store_api import create_knowledge_store_router

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Global health checker instance
_health_checker: HealthChecker | None = None


async def initialize_infrastructure() -> None:
    """Initialize Redis streams and consumer groups."""
    logger.info("Initializing infrastructure...")
    try:
        results = await initialize_consumer_groups()
        for group, created in results.items():
            status = "created" if created else "exists"
            logger.info(f"Consumer group '{group}': {status}")
    except Exception as e:
        logger.error(f"Failed to initialize infrastructure: {e}")
        raise


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle.

    Initializes infrastructure on startup and cleans up on shutdown.
    """
    global _health_checker

    # Startup
    logger.info("Starting aSDLC Orchestrator Service")

    try:
        config = get_config()
        service_name = config.service.name
    except Exception as e:
        logger.warning(f"Config error, using defaults: {e}")
        service_name = os.getenv("SERVICE_NAME", "orchestrator")

    # Initialize health checker
    _health_checker = get_health_checker(service_name)

    # Initialize infrastructure
    try:
        await initialize_infrastructure()
    except Exception as e:
        logger.warning(f"Infrastructure init failed (non-fatal): {e}")

    logger.info("Orchestrator service ready")
    yield

    # Shutdown
    logger.info("Orchestrator service stopping")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        FastAPI: Configured application instance.
    """
    app = FastAPI(
        title="aSDLC Orchestrator",
        description="Orchestrator and governance service for aSDLC",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Add CORS middleware for frontend access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health endpoints
    @app.get("/health")
    async def health() -> dict:
        """Health check endpoint."""
        if _health_checker is None:
            return {"status": "starting", "service": "orchestrator"}
        response = await _health_checker.check_health()
        return response.to_dict()

    @app.get("/health/live")
    async def liveness() -> dict:
        """Liveness probe endpoint."""
        if _health_checker is None:
            return {"status": "starting", "service": "orchestrator"}
        response = await _health_checker.check_liveness()
        return response.to_dict()

    @app.get("/health/ready")
    async def readiness() -> dict:
        """Readiness probe endpoint."""
        if _health_checker is None:
            return {"status": "starting", "service": "orchestrator"}
        response = await _health_checker.check_health(include_dependencies=True)
        return response.to_dict()

    # KnowledgeStore API endpoints
    knowledge_store_router = create_knowledge_store_router()
    app.include_router(
        knowledge_store_router,
        prefix="/api/knowledge-store",
    )

    return app


def main() -> None:
    """Main entry point for orchestrator service."""
    try:
        config = get_config()
        port = config.service.port
        host = config.service.host
    except Exception as e:
        logger.warning(f"Config error, using defaults: {e}")
        port = int(os.getenv("SERVICE_PORT", "8080"))
        host = os.getenv("SERVICE_HOST", "0.0.0.0")

    logger.info(f"Starting server on {host}:{port}")
    logger.info(f"Health check: http://localhost:{port}/health")
    logger.info(f"KnowledgeStore API: http://localhost:{port}/api/knowledge-store/")

    # Handle shutdown signals
    def signal_handler(signum: int, frame: object) -> None:
        logger.info(f"Received signal {signum}, shutting down...")
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Run the server
    app = create_app()
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
