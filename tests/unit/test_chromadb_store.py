"""Unit tests for ChromaDB knowledge store implementation.

Tests ChromaDBStore with mocked ChromaDB client.
"""

from __future__ import annotations

import warnings
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import (
    BackendConnectionError,
    DocumentNotFoundError,
    IndexingError,
    SearchError,
)
from src.infrastructure.knowledge_store.chromadb_store import ChromaDBStore
from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
from src.infrastructure.knowledge_store.models import Document, SearchResult


# Suppress deprecation warnings during most tests since we know it's deprecated
pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


@pytest.fixture
def mock_config() -> KnowledgeStoreConfig:
    """Create a test configuration."""
    return KnowledgeStoreConfig(
        host="localhost",
        port=8000,
        collection_name="test_collection",
        embedding_model="all-MiniLM-L6-v2",
    )


@pytest.fixture
def mock_collection() -> MagicMock:
    """Create a mock ChromaDB collection."""
    collection = MagicMock()
    collection.name = "test_collection"
    return collection


@pytest.fixture
def mock_client(mock_collection: MagicMock) -> MagicMock:
    """Create a mock ChromaDB client."""
    client = MagicMock()
    client.get_or_create_collection.return_value = mock_collection
    client.heartbeat.return_value = 1234567890
    return client


class TestChromaDBStoreInit:
    """Tests for ChromaDBStore initialization."""

    def test_store_creation(
        self, mock_config: KnowledgeStoreConfig, mock_client: MagicMock
    ) -> None:
        """Test ChromaDBStore can be created."""
        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            assert store is not None
            assert store.config == mock_config

    @pytest.mark.filterwarnings("error::DeprecationWarning")
    def test_store_emits_deprecation_warning(
        self, mock_config: KnowledgeStoreConfig, mock_client: MagicMock
    ) -> None:
        """Test ChromaDBStore emits deprecation warning on creation."""
        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                ChromaDBStore(mock_config)

                # Verify deprecation warning was raised
                assert len(w) >= 1
                deprecation_warnings = [
                    x for x in w if issubclass(x.category, DeprecationWarning)
                ]
                assert len(deprecation_warnings) == 1
                assert "DEPRECATED" in str(deprecation_warnings[0].message)
                assert "ElasticsearchStore" in str(deprecation_warnings[0].message)

    def test_store_creates_collection_on_first_access(
        self, mock_config: KnowledgeStoreConfig, mock_client: MagicMock
    ) -> None:
        """Test ChromaDBStore creates collection on first access (lazy init)."""
        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            # Collection is not created during __init__ (lazy initialization)
            mock_client.get_or_create_collection.assert_not_called()

            # Trigger collection creation by calling _get_collection()
            store._get_collection()

            # Now collection should be created
            mock_client.get_or_create_collection.assert_called_once()

    def test_store_connection_error(self, mock_config: KnowledgeStoreConfig) -> None:
        """Test ChromaDBStore raises BackendConnectionError on connection failure."""
        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            side_effect=Exception("Connection refused"),
        ):
            with pytest.raises(BackendConnectionError) as exc_info:
                ChromaDBStore(mock_config)

            assert "Connection refused" in str(exc_info.value)


class TestChromaDBStoreIndexDocument:
    """Tests for index_document method."""

    @pytest.mark.asyncio
    async def test_index_document_success(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test successful document indexing."""
        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            doc = Document(
                doc_id="doc-1",
                content="Test content",
                metadata={"author": "test"},
            )

            result = await store.index_document(doc)

            assert result == "doc-1"
            mock_collection.upsert.assert_called_once()

    @pytest.mark.asyncio
    async def test_index_document_with_embedding(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test indexing document with pre-computed embedding."""
        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            doc = Document(
                doc_id="doc-1",
                content="Test content",
                embedding=[0.1, 0.2, 0.3],
            )

            result = await store.index_document(doc)

            assert result == "doc-1"
            # When embedding is provided, it should be passed to upsert
            call_args = mock_collection.upsert.call_args
            assert call_args is not None

    @pytest.mark.asyncio
    async def test_index_document_error(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test indexing error handling."""
        mock_collection.upsert.side_effect = Exception("Indexing failed")

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            doc = Document(doc_id="doc-1", content="Test")

            with pytest.raises(IndexingError) as exc_info:
                await store.index_document(doc)

            assert "Indexing failed" in str(exc_info.value)


class TestChromaDBStoreSearch:
    """Tests for search method."""

    @pytest.mark.asyncio
    async def test_search_returns_results(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test search returns SearchResult list."""
        mock_collection.query.return_value = {
            "ids": [["doc-1", "doc-2"]],
            "documents": [["Content 1", "Content 2"]],
            "metadatas": [[{"key": "val1"}, {"key": "val2"}]],
            "distances": [[0.1, 0.2]],
        }

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            results = await store.search("test query", top_k=5)

            assert len(results) == 2
            assert isinstance(results[0], SearchResult)
            assert results[0].doc_id == "doc-1"
            assert results[0].content == "Content 1"
            # Score is 1 - distance (similarity from distance)
            assert results[0].score == pytest.approx(0.9, rel=0.01)

    @pytest.mark.asyncio
    async def test_search_empty_results(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test search with no results."""
        mock_collection.query.return_value = {
            "ids": [[]],
            "documents": [[]],
            "metadatas": [[]],
            "distances": [[]],
        }

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            results = await store.search("nonexistent", top_k=5)

            assert results == []

    @pytest.mark.asyncio
    async def test_search_with_filters(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test search with metadata filters."""
        mock_collection.query.return_value = {
            "ids": [["doc-1"]],
            "documents": [["Content"]],
            "metadatas": [[{"type": "article"}]],
            "distances": [[0.1]],
        }

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            results = await store.search(
                "query",
                top_k=5,
                filters={"type": "article"},
            )

            assert len(results) == 1
            # Verify filter was passed
            mock_collection.query.assert_called_once()
            call_kwargs = mock_collection.query.call_args.kwargs
            assert call_kwargs.get("where") == {"type": "article"}

    @pytest.mark.asyncio
    async def test_search_error(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test search error handling."""
        mock_collection.query.side_effect = Exception("Search failed")

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            with pytest.raises(SearchError) as exc_info:
                await store.search("query")

            assert "Search failed" in str(exc_info.value)


class TestChromaDBStoreGetById:
    """Tests for get_by_id method."""

    @pytest.mark.asyncio
    async def test_get_by_id_found(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test get_by_id returns document when found."""
        mock_collection.get.return_value = {
            "ids": ["doc-1"],
            "documents": ["Test content"],
            "metadatas": [{"author": "test"}],
            "embeddings": [[0.1, 0.2]],
        }

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            doc = await store.get_by_id("doc-1")

            assert doc is not None
            assert isinstance(doc, Document)
            assert doc.doc_id == "doc-1"
            assert doc.content == "Test content"
            assert doc.metadata == {"author": "test"}

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test get_by_id returns None when not found."""
        mock_collection.get.return_value = {
            "ids": [],
            "documents": [],
            "metadatas": [],
            "embeddings": [],
        }

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            doc = await store.get_by_id("nonexistent")

            assert doc is None


class TestChromaDBStoreDelete:
    """Tests for delete method."""

    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test successful document deletion."""
        # First call for existence check
        mock_collection.get.return_value = {"ids": ["doc-1"]}

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            result = await store.delete("doc-1")

            assert result is True
            mock_collection.delete.assert_called_once_with(ids=["doc-1"])

    @pytest.mark.asyncio
    async def test_delete_not_found(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
        mock_collection: MagicMock,
    ) -> None:
        """Test delete returns False when document not found."""
        mock_collection.get.return_value = {"ids": []}

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            result = await store.delete("nonexistent")

            assert result is False
            mock_collection.delete.assert_not_called()


class TestChromaDBStoreHealthCheck:
    """Tests for health_check method."""

    @pytest.mark.asyncio
    async def test_health_check_healthy(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
    ) -> None:
        """Test health check returns healthy status."""
        mock_client.heartbeat.return_value = 1234567890

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            health = await store.health_check()

            assert health["status"] == "healthy"
            assert health["backend"] == "chromadb"
            assert "host" in health
            assert "port" in health

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(
        self,
        mock_config: KnowledgeStoreConfig,
        mock_client: MagicMock,
    ) -> None:
        """Test health check returns unhealthy on error."""
        # First heartbeat succeeds (for init), then fails (for health check)
        mock_client.heartbeat.side_effect = [123456, Exception("Connection lost")]

        with patch(
            "src.infrastructure.knowledge_store.chromadb_store.chromadb.HttpClient",
            return_value=mock_client,
        ):
            store = ChromaDBStore(mock_config)

            health = await store.health_check()

            assert health["status"] == "unhealthy"
            assert "error" in health
