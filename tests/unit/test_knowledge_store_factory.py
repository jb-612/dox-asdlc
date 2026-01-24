"""Unit tests for KnowledgeStore factory function.

Tests factory pattern and singleton behavior.
"""

from __future__ import annotations

import os
import sys
import warnings
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig


@pytest.fixture(autouse=True)
def mock_all_backends():
    """Mock all backend dependencies."""
    # Mock sentence_transformers
    mock_st = MagicMock()
    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([0.1] * 384)
    mock_st.SentenceTransformer.return_value = mock_model
    sys.modules["sentence_transformers"] = mock_st

    # Mock elasticsearch
    mock_es = MagicMock()
    mock_es.AsyncElasticsearch = MagicMock()
    mock_es.NotFoundError = type("NotFoundError", (Exception,), {})
    mock_es.ConnectionError = type("ConnectionError", (Exception,), {})
    sys.modules["elasticsearch"] = mock_es

    # Mock chromadb
    mock_chromadb = MagicMock()
    mock_client = MagicMock()
    mock_collection = MagicMock()
    mock_collection.name = "test_collection"
    mock_client.get_or_create_collection.return_value = mock_collection
    mock_client.heartbeat.return_value = 123456
    mock_chromadb.HttpClient.return_value = mock_client
    sys.modules["chromadb"] = mock_chromadb

    yield {
        "sentence_transformers": mock_st,
        "elasticsearch": mock_es,
        "chromadb": mock_chromadb,
    }

    # Cleanup
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
    sys.modules.pop("sentence_transformers", None)
    sys.modules.pop("elasticsearch", None)
    sys.modules.pop("chromadb", None)


class TestGetKnowledgeStore:
    """Tests for get_knowledge_store factory function."""

    def test_factory_returns_elasticsearch_by_default(
        self, mock_all_backends
    ) -> None:
        """Test factory returns ElasticsearchStore by default."""
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        reset_knowledge_store()

        with patch.dict(os.environ, {"KNOWLEDGE_STORE_BACKEND": "elasticsearch"}):
            store = get_knowledge_store()

        assert isinstance(store, ElasticsearchStore)

    def test_factory_returns_singleton(self, mock_all_backends) -> None:
        """Test factory returns same instance on subsequent calls."""
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )

        reset_knowledge_store()

        with patch.dict(os.environ, {"KNOWLEDGE_STORE_BACKEND": "elasticsearch"}):
            store1 = get_knowledge_store()
            store2 = get_knowledge_store()

        assert store1 is store2

    def test_factory_creates_elasticsearch_store(self, mock_all_backends) -> None:
        """Test factory creates ElasticsearchStore when configured."""
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
            elasticsearch_url="http://test:9200",
        )

        store = get_knowledge_store(config=config)

        assert isinstance(store, ElasticsearchStore)

    def test_factory_creates_chromadb_store_with_deprecation(
        self, mock_all_backends
    ) -> None:
        """Test factory creates ChromaDBStore with deprecation warning."""
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )
        from src.infrastructure.knowledge_store.chromadb_store import ChromaDBStore

        reset_knowledge_store()

        config = KnowledgeStoreConfig(
            backend="chromadb",
            host="test-host",
            port=8000,
        )

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            store = get_knowledge_store(config=config)

            # Verify deprecation warnings were raised
            # Two warnings: one from factory, one from ChromaDBStore
            deprecation_warnings = [
                x for x in w if issubclass(x.category, DeprecationWarning)
            ]
            assert len(deprecation_warnings) >= 1
            assert any("DEPRECATED" in str(x.message) for x in deprecation_warnings)

        assert isinstance(store, ChromaDBStore)

    def test_factory_accepts_custom_config(self, mock_all_backends) -> None:
        """Test factory accepts custom configuration."""
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )

        reset_knowledge_store()

        config = KnowledgeStoreConfig(
            backend="elasticsearch",
            elasticsearch_url="http://custom:9200",
            es_index_prefix="custom",
        )

        store = get_knowledge_store(config=config)

        assert store.config.elasticsearch_url == "http://custom:9200"
        assert store.config.es_index_prefix == "custom"

    def test_factory_creates_mock_anthology(self, mock_all_backends) -> None:
        """Test factory creates MockAnthologyStore for testing."""
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )
        from src.infrastructure.knowledge_store.mock_anthology import (
            MockAnthologyStore,
        )

        reset_knowledge_store()

        config = KnowledgeStoreConfig(backend="mock_anthology")

        store = get_knowledge_store(config=config)

        assert isinstance(store, MockAnthologyStore)


class TestResetKnowledgeStore:
    """Tests for reset_knowledge_store function."""

    def test_reset_clears_singleton(self, mock_all_backends) -> None:
        """Test reset_knowledge_store clears the singleton."""
        from src.infrastructure.knowledge_store.factory import (
            get_knowledge_store,
            reset_knowledge_store,
        )

        reset_knowledge_store()

        config = KnowledgeStoreConfig(backend="elasticsearch")
        store1 = get_knowledge_store(config=config)
        reset_knowledge_store()
        store2 = get_knowledge_store(config=config)

        # After reset, should get new instance
        assert store1 is not store2
