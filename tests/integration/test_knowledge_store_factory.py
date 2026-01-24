"""Integration tests for KnowledgeStore factory and backend switching.

Tests factory behavior with real backends when available.
"""

from __future__ import annotations

import os
import sys
import warnings
from unittest.mock import MagicMock

import pytest
import numpy as np


@pytest.fixture(autouse=True)
def mock_sentence_transformers():
    """Mock sentence_transformers module."""
    mock_st = MagicMock()
    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([0.1] * 384)
    mock_st.SentenceTransformer.return_value = mock_model
    sys.modules["sentence_transformers"] = mock_st

    yield

    sys.modules.pop("sentence_transformers", None)


@pytest.fixture(autouse=True)
def mock_elasticsearch():
    """Mock elasticsearch module for tests without real ES."""
    mock_es = MagicMock()
    mock_es.AsyncElasticsearch = MagicMock()
    mock_es.NotFoundError = type("NotFoundError", (Exception,), {})
    sys.modules["elasticsearch"] = mock_es

    yield

    sys.modules.pop("elasticsearch", None)


@pytest.fixture
def cleanup_factory():
    """Clean up factory singleton after each test."""
    yield
    # Clear any cached modules
    for mod_name in list(sys.modules.keys()):
        if any(
            name in mod_name
            for name in [
                "elasticsearch_store",
                "chromadb_store",
                "embedding_service",
                "factory",
            ]
        ):
            sys.modules.pop(mod_name, None)


class TestFactoryBackendSelection:
    """Tests for factory backend selection."""

    def test_factory_creates_elasticsearch_by_default(
        self, mock_sentence_transformers, mock_elasticsearch, cleanup_factory
    ) -> None:
        """Test factory creates ElasticsearchStore by default."""
        from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        reset_knowledge_store()

        config = KnowledgeStoreConfig(
            backend="elasticsearch",
            elasticsearch_url="http://localhost:9200",
        )
        store = get_knowledge_store(config=config)

        assert isinstance(store, ElasticsearchStore)
        reset_knowledge_store()

    def test_factory_creates_chromadb_with_deprecation_warning(
        self, mock_sentence_transformers, cleanup_factory
    ) -> None:
        """Test factory creates ChromaDBStore with deprecation warning."""
        # Mock chromadb
        mock_chromadb = MagicMock()
        mock_client = MagicMock()
        mock_collection = MagicMock()
        mock_collection.name = "test"
        mock_client.get_or_create_collection.return_value = mock_collection
        mock_client.heartbeat.return_value = 123456
        mock_chromadb.HttpClient.return_value = mock_client
        sys.modules["chromadb"] = mock_chromadb

        try:
            from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
            from src.infrastructure.knowledge_store.factory import (
                get_knowledge_store,
                reset_knowledge_store,
            )
            from src.infrastructure.knowledge_store.chromadb_store import ChromaDBStore

            reset_knowledge_store()

            config = KnowledgeStoreConfig(
                backend="chromadb",
                host="localhost",
                port=8000,
            )

            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                store = get_knowledge_store(config=config)

                # Should have deprecation warnings
                deprecation_warnings = [
                    x for x in w if issubclass(x.category, DeprecationWarning)
                ]
                # At least one deprecation warning (from factory or from ChromaDBStore)
                assert len(deprecation_warnings) >= 1

            assert isinstance(store, ChromaDBStore)
            reset_knowledge_store()
        finally:
            sys.modules.pop("chromadb", None)

    def test_factory_singleton_behavior(
        self, mock_sentence_transformers, mock_elasticsearch, cleanup_factory
    ) -> None:
        """Test factory returns singleton instance."""
        from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )

        reset_knowledge_store()

        config = KnowledgeStoreConfig(backend="elasticsearch")
        store1 = get_knowledge_store(config=config)
        store2 = get_knowledge_store()

        assert store1 is store2
        reset_knowledge_store()

    def test_reset_knowledge_store_clears_singleton(
        self, mock_sentence_transformers, mock_elasticsearch, cleanup_factory
    ) -> None:
        """Test reset_knowledge_store clears the singleton."""
        from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )

        reset_knowledge_store()

        config = KnowledgeStoreConfig(backend="elasticsearch")
        store1 = get_knowledge_store(config=config)

        reset_knowledge_store()

        store2 = get_knowledge_store(config=config)

        assert store1 is not store2
        reset_knowledge_store()

    def test_factory_creates_mock_anthology(
        self, mock_sentence_transformers, cleanup_factory
    ) -> None:
        """Test factory creates MockAnthologyStore for testing."""
        from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )
        from src.infrastructure.knowledge_store.mock_anthology import MockAnthologyStore

        reset_knowledge_store()

        config = KnowledgeStoreConfig(backend="mock_anthology")
        store = get_knowledge_store(config=config)

        assert isinstance(store, MockAnthologyStore)
        reset_knowledge_store()


class TestFactoryConfiguration:
    """Tests for factory configuration."""

    def test_factory_uses_config_from_env(
        self, mock_sentence_transformers, mock_elasticsearch, cleanup_factory
    ) -> None:
        """Test factory uses configuration from environment."""
        from unittest.mock import patch

        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )

        reset_knowledge_store()

        with patch.dict(
            os.environ,
            {
                "KNOWLEDGE_STORE_BACKEND": "elasticsearch",
                "ELASTICSEARCH_URL": "http://custom:9200",
            },
        ):
            store = get_knowledge_store()

            assert store.config.elasticsearch_url == "http://custom:9200"

        reset_knowledge_store()
