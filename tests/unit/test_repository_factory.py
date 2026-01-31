"""Tests for P02-F09 Task T15: Repository Factory.

This module tests the repository factory that selects between
PostgreSQL and Redis backends based on environment configuration:
- RepositoryFactory protocol
- PostgresRepositoryFactory
- get_repository_factory() with env selection
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.orchestrator.repositories.interfaces import (
    IMaturityRepository,
    IMessageRepository,
    IPRDRepository,
    IRequirementRepository,
    ISessionRepository,
)


class TestRepositoryFactoryImport:
    """Test that repository factory can be imported."""

    def test_import_factory_module(self) -> None:
        """Test that factory module can be imported."""
        from src.orchestrator.repositories import factory

        assert factory is not None

    def test_import_repository_factory_protocol(self) -> None:
        """Test that RepositoryFactory protocol can be imported."""
        from src.orchestrator.repositories.factory import RepositoryFactory

        assert RepositoryFactory is not None

    def test_import_postgres_repository_factory(self) -> None:
        """Test that PostgresRepositoryFactory can be imported."""
        from src.orchestrator.repositories.factory import PostgresRepositoryFactory

        assert PostgresRepositoryFactory is not None

    def test_import_get_repository_factory(self) -> None:
        """Test that get_repository_factory function can be imported."""
        from src.orchestrator.repositories.factory import get_repository_factory

        assert get_repository_factory is not None


class TestPostgresRepositoryFactory:
    """Test PostgresRepositoryFactory implementation."""

    @pytest.fixture
    def mock_db_session(self) -> AsyncMock:
        """Create a mock AsyncSession."""
        return AsyncMock()

    @pytest.fixture
    def factory(self) -> "PostgresRepositoryFactory":
        """Create a PostgresRepositoryFactory instance."""
        from src.orchestrator.repositories.factory import PostgresRepositoryFactory

        return PostgresRepositoryFactory()

    def test_get_session_repository(
        self, factory: "PostgresRepositoryFactory", mock_db_session: AsyncMock
    ) -> None:
        """Test that get_session_repository returns PostgresSessionRepository."""
        from src.orchestrator.repositories.postgres import PostgresSessionRepository

        repo = factory.get_session_repository(mock_db_session)
        assert isinstance(repo, PostgresSessionRepository)
        assert isinstance(repo, ISessionRepository)

    def test_get_message_repository(
        self, factory: "PostgresRepositoryFactory", mock_db_session: AsyncMock
    ) -> None:
        """Test that get_message_repository returns PostgresMessageRepository."""
        from src.orchestrator.repositories.postgres import PostgresMessageRepository

        repo = factory.get_message_repository(mock_db_session)
        assert isinstance(repo, PostgresMessageRepository)
        assert isinstance(repo, IMessageRepository)

    def test_get_requirement_repository(
        self, factory: "PostgresRepositoryFactory", mock_db_session: AsyncMock
    ) -> None:
        """Test that get_requirement_repository returns PostgresRequirementRepository."""
        from src.orchestrator.repositories.postgres import PostgresRequirementRepository

        repo = factory.get_requirement_repository(mock_db_session)
        assert isinstance(repo, PostgresRequirementRepository)
        assert isinstance(repo, IRequirementRepository)

    def test_get_maturity_repository(
        self, factory: "PostgresRepositoryFactory", mock_db_session: AsyncMock
    ) -> None:
        """Test that get_maturity_repository returns PostgresMaturityRepository."""
        from src.orchestrator.repositories.postgres import PostgresMaturityRepository

        repo = factory.get_maturity_repository(mock_db_session)
        assert isinstance(repo, PostgresMaturityRepository)
        assert isinstance(repo, IMaturityRepository)

    def test_get_prd_repository(
        self, factory: "PostgresRepositoryFactory", mock_db_session: AsyncMock
    ) -> None:
        """Test that get_prd_repository returns PostgresPRDRepository."""
        from src.orchestrator.repositories.postgres import PostgresPRDRepository

        repo = factory.get_prd_repository(mock_db_session)
        assert isinstance(repo, PostgresPRDRepository)
        assert isinstance(repo, IPRDRepository)


class TestGetRepositoryFactory:
    """Test get_repository_factory() function."""

    def test_default_returns_postgres_factory(self) -> None:
        """Test that default backend is postgres."""
        from src.orchestrator.repositories.factory import (
            PostgresRepositoryFactory,
            get_repository_factory,
        )

        with patch.dict(os.environ, {}, clear=True):
            # Ensure no IDEATION_PERSISTENCE_BACKEND is set
            os.environ.pop("IDEATION_PERSISTENCE_BACKEND", None)
            factory = get_repository_factory()
            assert isinstance(factory, PostgresRepositoryFactory)

    def test_postgres_backend_returns_postgres_factory(self) -> None:
        """Test that postgres backend returns PostgresRepositoryFactory."""
        from src.orchestrator.repositories.factory import (
            PostgresRepositoryFactory,
            get_repository_factory,
        )

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "postgres"}):
            factory = get_repository_factory()
            assert isinstance(factory, PostgresRepositoryFactory)

    def test_redis_backend_returns_redis_factory(self) -> None:
        """Test that redis backend returns RedisRepositoryFactory."""
        from src.orchestrator.repositories.factory import get_repository_factory

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "redis"}):
            factory = get_repository_factory()
            # Import here to avoid import errors if Redis factory not implemented yet
            from src.orchestrator.repositories.redis import RedisRepositoryFactory

            assert isinstance(factory, RedisRepositoryFactory)

    def test_unknown_backend_raises_error(self) -> None:
        """Test that unknown backend raises ValueError."""
        from src.orchestrator.repositories.factory import get_repository_factory

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "mongodb"}):
            with pytest.raises(ValueError) as exc_info:
                get_repository_factory()
            assert "Unknown persistence backend: mongodb" in str(exc_info.value)

    def test_case_sensitive_backend_selection(self) -> None:
        """Test that backend selection is case-sensitive."""
        from src.orchestrator.repositories.factory import get_repository_factory

        with patch.dict(os.environ, {"IDEATION_PERSISTENCE_BACKEND": "POSTGRES"}):
            with pytest.raises(ValueError) as exc_info:
                get_repository_factory()
            assert "Unknown persistence backend: POSTGRES" in str(exc_info.value)


class TestRepositoryFactoryProtocol:
    """Test that factories conform to the RepositoryFactory protocol."""

    def test_postgres_factory_has_all_methods(self) -> None:
        """Test that PostgresRepositoryFactory has all required methods."""
        from src.orchestrator.repositories.factory import PostgresRepositoryFactory

        factory = PostgresRepositoryFactory()

        # Check all required methods exist
        assert hasattr(factory, "get_session_repository")
        assert hasattr(factory, "get_message_repository")
        assert hasattr(factory, "get_requirement_repository")
        assert hasattr(factory, "get_maturity_repository")
        assert hasattr(factory, "get_prd_repository")

        # Check they are callable
        assert callable(factory.get_session_repository)
        assert callable(factory.get_message_repository)
        assert callable(factory.get_requirement_repository)
        assert callable(factory.get_maturity_repository)
        assert callable(factory.get_prd_repository)
