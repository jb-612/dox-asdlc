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
from fastapi.responses import Response
from prometheus_client import REGISTRY, generate_latest, CONTENT_TYPE_LATEST

from src.core.config import get_config
from src.infrastructure.health import get_health_checker, HealthChecker
from src.infrastructure.metrics import (
    PrometheusMiddleware,
    ProcessMetricsCollector,
    RedisMetricsCollector,
    initialize_service_info,
)
from src.infrastructure.redis_streams import initialize_consumer_groups
from src.orchestrator.api.routes.devops import router as devops_api_router
from src.orchestrator.api.routes.k8s import router as k8s_api_router
from src.orchestrator.knowledge_store_api import create_knowledge_store_router
from src.orchestrator.routes.metrics_api import router as metrics_api_router
from src.orchestrator.routes.ideation_api import router as ideation_api_router
from src.orchestrator.routes.agents_api import router as agents_api_router, ws_router as agents_ws_router
from src.orchestrator.routes.llm_config_api import router as llm_config_router
from src.orchestrator.routes.llm_streaming_api import router as llm_streaming_router
from src.orchestrator.routes.integrations_api import router as integrations_router
from src.orchestrator.routes.ideas_api import router as ideas_api_router
from src.orchestrator.routes.correlation_api import router as correlation_api_router

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

    # Initialize metrics
    initialize_service_info(service_name=service_name, version="0.1.0")

    # Register custom metrics collectors
    try:
        REGISTRY.register(RedisMetricsCollector(service_name, _health_checker))
        REGISTRY.register(ProcessMetricsCollector(service_name))
        logger.info("Prometheus metrics collectors registered")
    except Exception as e:
        logger.warning(f"Failed to register metrics collectors: {e}")

    # Initialize infrastructure
    try:
        await initialize_infrastructure()
    except Exception as e:
        logger.warning(f"Infrastructure init failed (non-fatal): {e}")

    # Initialize PostgreSQL database for ideation persistence
    try:
        backend = os.getenv("IDEATION_PERSISTENCE_BACKEND", "postgres")
        if backend == "postgres":
            from src.orchestrator.persistence.database import get_database
            db = get_database()
            await db.connect()
            logger.info("PostgreSQL database connected")
    except Exception as e:
        logger.warning(f"Database connection failed (non-fatal): {e}")

    logger.info("Orchestrator service ready")
    yield

    # Shutdown
    logger.info("Orchestrator service stopping")

    # Disconnect from PostgreSQL
    try:
        backend = os.getenv("IDEATION_PERSISTENCE_BACKEND", "postgres")
        if backend == "postgres":
            from src.orchestrator.persistence.database import get_database
            db = get_database()
            await db.disconnect()
            logger.info("PostgreSQL database disconnected")
    except Exception as e:
        logger.warning(f"Database disconnect failed: {e}")


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

    # Add Prometheus middleware for HTTP metrics
    app.add_middleware(PrometheusMiddleware, service_name="orchestrator")

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

    @app.get("/metrics")
    async def metrics() -> Response:
        """Prometheus metrics endpoint for scraping."""
        return Response(
            content=generate_latest(REGISTRY),
            media_type=CONTENT_TYPE_LATEST,
        )

    # KnowledgeStore API endpoints
    knowledge_store_router = create_knowledge_store_router()
    app.include_router(
        knowledge_store_router,
        prefix="/api/knowledge-store",
    )

    # VictoriaMetrics proxy API endpoints (for metrics dashboard)
    app.include_router(metrics_api_router)

    # DevOps activity API endpoints (for DevOps monitoring dashboard)
    app.include_router(devops_api_router)

    # K8s cluster API endpoints (for K8s visibility dashboard)
    app.include_router(k8s_api_router)

    # Ideation Studio API endpoints (for PRD Ideation Studio)
    app.include_router(ideation_api_router)

    # Agent Telemetry API endpoints (for agent activity monitoring)
    app.include_router(agents_api_router)
    app.include_router(agents_ws_router)  # WebSocket at /ws/agents

    # LLM Configuration API endpoints (for LLM Admin settings)
    app.include_router(llm_config_router)

    # LLM Streaming API endpoints (for SSE streaming in Ideation Studio)
    app.include_router(llm_streaming_router)

    # Integration Credentials API endpoints (for Slack, Teams, GitHub)
    app.include_router(integrations_router, prefix="/api")

    # Ideas API endpoints (for Brainflare Hub)
    app.include_router(ideas_api_router)

    # Correlation API endpoints (for Brainflare Hub graph/linking)
    app.include_router(correlation_api_router)

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
    logger.info(f"Metrics: http://localhost:{port}/metrics")
    logger.info(f"KnowledgeStore API: http://localhost:{port}/api/knowledge-store/")
    logger.info(f"Metrics API: http://localhost:{port}/api/metrics/")
    logger.info(f"K8s API: http://localhost:{port}/api/k8s/")
    logger.info(f"Ideation API: http://localhost:{port}/api/studio/ideation/")
    logger.info(f"Agents API: http://localhost:{port}/api/agents/")
    logger.info(f"LLM Config API: http://localhost:{port}/api/llm/")
    logger.info(f"LLM Streaming API: http://localhost:{port}/api/llm/stream")
    logger.info(f"Integrations API: http://localhost:{port}/api/integrations/")
    logger.info(f"Ideas API: http://localhost:{port}/api/brainflare/ideas")
    logger.info(f"Correlation API: http://localhost:{port}/api/brainflare/correlations")

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
