"""Fixtures for persistence integration tests.

Provides PostgreSQL container and database session fixtures using testcontainers.
These fixtures ensure tests run against a real PostgreSQL database.
"""

import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.orchestrator.persistence.orm_models import Base


def _configure_docker_host() -> None:
    """Configure DOCKER_HOST environment variable if not set.

    Detects common Docker socket locations on different platforms
    and sets DOCKER_HOST if a valid socket is found.
    """
    # If already set, do nothing
    if os.environ.get("DOCKER_HOST"):
        return

    # Common socket locations
    socket_paths = [
        Path.home() / ".docker" / "run" / "docker.sock",  # Docker Desktop (macOS)
        Path.home() / ".colima" / "default" / "docker.sock",  # Colima
        Path("/var/run/docker.sock"),  # Linux default
    ]

    for path in socket_paths:
        if path.exists():
            os.environ["DOCKER_HOST"] = f"unix://{path}"
            return


# Configure Docker host on module import
_configure_docker_host()


# Module-level container instance (shared across tests in module)
_postgres_container: Any = None
_connection_url: str | None = None


def _get_postgres_container():
    """Get or create the PostgreSQL container for the module.

    Returns:
        PostgresContainer instance with connection details.
    """
    global _postgres_container, _connection_url

    if _postgres_container is None:
        from testcontainers.postgres import PostgresContainer

        _postgres_container = PostgresContainer("postgres:16-alpine")
        _postgres_container.start()
        _connection_url = _postgres_container.get_connection_url()

    return _postgres_container, _connection_url


@pytest.fixture(scope="module")
def postgres_container():
    """Start a PostgreSQL container for integration tests.

    Uses testcontainers to spin up a PostgreSQL 16 container.
    DOCKER_HOST is configured automatically on module import.

    Yields:
        PostgresContainer instance with connection details.
    """
    container, url = _get_postgres_container()
    yield container, url

    # Clean up at module end
    global _postgres_container, _connection_url
    if _postgres_container is not None:
        _postgres_container.stop()
        _postgres_container = None
        _connection_url = None


@pytest_asyncio.fixture
async def db_engine(postgres_container):
    """Create async database engine connected to test container.

    Args:
        postgres_container: Tuple of (PostgresContainer, connection_url).

    Yields:
        AsyncEngine connected to the test database.
    """
    _, sync_url = postgres_container
    # Replace psycopg2 driver with asyncpg for async support
    async_url = sync_url.replace("psycopg2", "asyncpg")

    engine = create_async_engine(async_url, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Clean up
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncIterator[AsyncSession]:
    """Create a database session for each test.

    Each test gets its own session with automatic rollback after the test.
    This ensures test isolation.

    Args:
        db_engine: Async database engine.

    Yields:
        AsyncSession for database operations.
    """
    async_session_factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_factory() as session:
        yield session
        # Rollback any uncommitted changes after test
        await session.rollback()

    # Clean up tables after each test for isolation
    async with async_session_factory() as cleanup_session:
        for table in reversed(Base.metadata.sorted_tables):
            await cleanup_session.execute(table.delete())
        await cleanup_session.commit()


@pytest_asyncio.fixture
async def clean_db_session(db_engine) -> AsyncIterator[AsyncSession]:
    """Create a clean database session with committed data.

    Unlike db_session, this fixture commits changes and cleans up
    tables after the test. Use for tests that need to verify data
    persistence across "restarts".

    Args:
        db_engine: Async database engine.

    Yields:
        AsyncSession for database operations.
    """
    async_session_factory = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_factory() as session:
        yield session
        await session.commit()

    # Clean up all data after test
    async with async_session_factory() as cleanup_session:
        # Delete in reverse dependency order
        for table in reversed(Base.metadata.sorted_tables):
            await cleanup_session.execute(table.delete())
        await cleanup_session.commit()
