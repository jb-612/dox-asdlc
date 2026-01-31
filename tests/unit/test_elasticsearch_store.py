"""Unit tests for ElasticsearchStore.

Tests Elasticsearch implementation of KnowledgeStore protocol.
"""

from __future__ import annotations

import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import numpy as np

from src.core.exceptions import (
    BackendConnectionError,
    IndexingError,
    SearchError,
)
from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
from src.infrastructure.knowledge_store.models import Document, SearchResult


@pytest.fixture(autouse=True)
def mock_dependencies():
    """Mock external dependencies before importing ElasticsearchStore."""
    # Mock sentence_transformers
    mock_st = MagicMock()
    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([0.1] * 384)
    mock_st.SentenceTransformer.return_value = mock_model
    sys.modules["sentence_transformers"] = mock_st

    # Mock elasticsearch
    mock_es_module = MagicMock()

    # Create mock client class
    mock_client_class = MagicMock()
    mock_es_module.AsyncElasticsearch = mock_client_class

    # Mock exceptions
    mock_es_module.NotFoundError = type("NotFoundError", (Exception,), {})
    mock_es_module.ConnectionError = type("ConnectionError", (Exception,), {})
    mock_es_module.ElasticsearchException = type("ElasticsearchException", (Exception,), {})

    sys.modules["elasticsearch"] = mock_es_module

    yield {
        "sentence_transformers": mock_st,
        "elasticsearch": mock_es_module,
    }

    # Cleanup
    for mod_name in list(sys.modules.keys()):
        if "elasticsearch_store" in mod_name or "embedding_service" in mod_name:
            del sys.modules[mod_name]
    sys.modules.pop("sentence_transformers", None)
    sys.modules.pop("elasticsearch", None)


@pytest.fixture
def mock_config() -> KnowledgeStoreConfig:
    """Create a test configuration."""
    return KnowledgeStoreConfig(
        backend="elasticsearch",
        elasticsearch_url="http://localhost:9200",
        es_index_prefix="test",
        es_num_candidates=50,
    )


@pytest.fixture
def mock_es_client():
    """Create a mock Elasticsearch client."""
    client = AsyncMock()
    client.indices = AsyncMock()
    client.indices.exists = AsyncMock(return_value=True)
    client.indices.create = AsyncMock()
    client.info = AsyncMock(return_value={"cluster_name": "test"})
    return client


class TestElasticsearchStoreInit:
    """Tests for ElasticsearchStore initialization."""

    def test_init_creates_client(self, mock_dependencies, mock_config) -> None:
        """Test that __init__ creates Elasticsearch client."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        store = ElasticsearchStore(mock_config)

        assert store.config == mock_config
        assert store._client is not None

    def test_init_uses_config_url(self, mock_dependencies, mock_config) -> None:
        """Test that __init__ uses the configured URL."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        store = ElasticsearchStore(mock_config)

        mock_dependencies["elasticsearch"].AsyncElasticsearch.assert_called()

    def test_init_with_api_key(self, mock_dependencies) -> None:
        """Test that __init__ uses API key when provided."""
        config = KnowledgeStoreConfig(
            backend="elasticsearch",
            elasticsearch_url="http://localhost:9200",
            elasticsearch_api_key="test-api-key",
        )

        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        store = ElasticsearchStore(config)

        # Verify client was created with API key
        call_kwargs = mock_dependencies["elasticsearch"].AsyncElasticsearch.call_args[1]
        assert call_kwargs.get("api_key") == "test-api-key"


class TestGetIndexName:
    """Tests for _get_index_name method."""

    def test_single_tenant_index_name(self, mock_dependencies, mock_config) -> None:
        """Test index name in single-tenant mode."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False
            mock_tenant_config.return_value.default_tenant = "default"

            store = ElasticsearchStore(mock_config)
            index_name = store._get_index_name()

            assert index_name == "test_documents"

    def test_multi_tenant_index_name(self, mock_dependencies, mock_config) -> None:
        """Test index name in multi-tenant mode."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch(
            "src.infrastructure.knowledge_store.elasticsearch_store.get_tenant_config"
        ) as mock_tenant_config:
            mock_config_obj = MagicMock()
            mock_config_obj.enabled = True
            mock_config_obj.default_tenant = "default"
            mock_tenant_config.return_value = mock_config_obj

            with patch(
                "src.infrastructure.knowledge_store.elasticsearch_store.TenantContext"
            ) as mock_tenant:
                mock_tenant.get_current_tenant.return_value = "acme"

                store = ElasticsearchStore(mock_config)
                index_name = store._get_index_name()

                assert index_name == "acme_test_documents"


class TestValidateDocId:
    """Tests for _validate_doc_id method."""

    def test_validate_doc_id_valid(self, mock_dependencies, mock_config) -> None:
        """Test that valid doc_id passes validation."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            # Should not raise
            store._validate_doc_id("valid-doc-id")

    def test_validate_doc_id_empty_raises(self, mock_dependencies, mock_config) -> None:
        """Test that empty doc_id raises ValueError."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            with pytest.raises(ValueError, match="Invalid doc_id"):
                store._validate_doc_id("")

    def test_validate_doc_id_none_raises(self, mock_dependencies, mock_config) -> None:
        """Test that None doc_id raises ValueError."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            with pytest.raises(ValueError, match="Invalid doc_id"):
                store._validate_doc_id(None)

    def test_validate_doc_id_too_long_raises(
        self, mock_dependencies, mock_config
    ) -> None:
        """Test that doc_id exceeding 512 chars raises ValueError."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            long_id = "x" * 513
            with pytest.raises(ValueError, match="Invalid doc_id"):
                store._validate_doc_id(long_id)

    def test_validate_doc_id_max_length_valid(
        self, mock_dependencies, mock_config
    ) -> None:
        """Test that doc_id with exactly 512 chars is valid."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            # Should not raise
            store._validate_doc_id("x" * 512)


class TestIndexDocument:
    """Tests for index_document method."""

    @pytest.mark.asyncio
    async def test_index_document_success(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test successful document indexing."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.index = AsyncMock(return_value={"_id": "doc-1"})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = Document(doc_id="doc-1", content="Test content")

            result = await store.index_document(doc)

            assert result == "doc-1"
            mock_es_client.index.assert_called_once()

    @pytest.mark.asyncio
    async def test_index_document_generates_embedding(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test that embedding is generated if not provided."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.index = AsyncMock(return_value={"_id": "doc-1"})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = Document(doc_id="doc-1", content="Test content")

            await store.index_document(doc)

            # Verify index was called with embedding in body
            call_kwargs = mock_es_client.index.call_args[1]
            assert "embedding" in call_kwargs["body"]
            assert len(call_kwargs["body"]["embedding"]) == 384

    @pytest.mark.asyncio
    async def test_index_document_uses_provided_embedding(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test that provided embedding is used."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.index = AsyncMock(return_value={"_id": "doc-1"})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            embedding = [0.5] * 384
            doc = Document(doc_id="doc-1", content="Test", embedding=embedding)

            await store.index_document(doc)

            call_kwargs = mock_es_client.index.call_args[1]
            assert call_kwargs["body"]["embedding"] == embedding

    @pytest.mark.asyncio
    async def test_index_document_raises_on_error(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test that IndexingError is raised on failure."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        # Use ElasticsearchException from the mock
        ESException = mock_dependencies["elasticsearch"].ElasticsearchException

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.index = AsyncMock(side_effect=ESException("Index failed"))

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = Document(doc_id="doc-1", content="Test")

            with pytest.raises(IndexingError):
                await store.index_document(doc)

    @pytest.mark.asyncio
    async def test_index_document_invalid_doc_id(
        self, mock_dependencies, mock_config
    ) -> None:
        """Test that ValueError is raised for invalid doc_id."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = Document(doc_id="", content="Test")

            with pytest.raises(ValueError, match="Invalid doc_id"):
                await store.index_document(doc)


class TestSearch:
    """Tests for search method."""

    @pytest.mark.asyncio
    async def test_search_returns_results(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test search returns SearchResult objects."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.search = AsyncMock(
            return_value={
                "hits": {
                    "hits": [
                        {
                            "_source": {
                                "doc_id": "doc-1",
                                "content": "Test content",
                                "metadata": {"author": "test"},
                            },
                            "_score": 0.95,
                        }
                    ]
                }
            }
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            results = await store.search("test query", top_k=5)

            assert len(results) == 1
            assert isinstance(results[0], SearchResult)
            assert results[0].doc_id == "doc-1"
            assert results[0].score == 0.95

    @pytest.mark.asyncio
    async def test_search_respects_top_k(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test search respects top_k parameter."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.search = AsyncMock(return_value={"hits": {"hits": []}})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            await store.search("test", top_k=3)

            call_kwargs = mock_es_client.search.call_args[1]
            assert call_kwargs["knn"]["k"] == 3

    @pytest.mark.asyncio
    async def test_search_with_filters(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test search with metadata filters."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.search = AsyncMock(return_value={"hits": {"hits": []}})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            await store.search("test", filters={"type": "reference"})

            call_kwargs = mock_es_client.search.call_args[1]
            assert "filter" in call_kwargs["knn"]

    @pytest.mark.asyncio
    async def test_search_empty_index(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test search on empty index returns empty list."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.search = AsyncMock(return_value={"hits": {"hits": []}})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            results = await store.search("test")

            assert results == []

    @pytest.mark.asyncio
    async def test_search_raises_on_error(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test that SearchError is raised on failure."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        # Use ElasticsearchException from the mock
        ESException = mock_dependencies["elasticsearch"].ElasticsearchException

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.search = AsyncMock(side_effect=ESException("Search failed"))

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)

            with pytest.raises(SearchError):
                await store.search("test")


class TestGetById:
    """Tests for get_by_id method."""

    @pytest.mark.asyncio
    async def test_get_by_id_returns_document(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test get_by_id returns Document."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.get = AsyncMock(
            return_value={
                "_source": {
                    "doc_id": "doc-1",
                    "content": "Test content",
                    "metadata": {"author": "test"},
                    "embedding": [0.1] * 384,
                }
            }
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = await store.get_by_id("doc-1")

            assert doc is not None
            assert isinstance(doc, Document)
            assert doc.doc_id == "doc-1"
            assert doc.content == "Test content"

    @pytest.mark.asyncio
    async def test_get_by_id_returns_none_for_missing(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test get_by_id returns None for non-existent document."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        # Use the NotFoundError from our mock
        NotFoundError = mock_dependencies["elasticsearch"].NotFoundError

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.get = AsyncMock(side_effect=NotFoundError())

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = await store.get_by_id("non-existent")

            assert doc is None

    @pytest.mark.asyncio
    async def test_get_by_id_includes_embedding(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test get_by_id includes embedding in returned document."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        embedding = [0.5] * 384
        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.get = AsyncMock(
            return_value={
                "_source": {
                    "doc_id": "doc-1",
                    "content": "Test",
                    "metadata": {},
                    "embedding": embedding,
                }
            }
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            doc = await store.get_by_id("doc-1")

            assert doc is not None
            assert doc.embedding == embedding

    @pytest.mark.asyncio
    async def test_get_by_id_invalid_doc_id(
        self, mock_dependencies, mock_config
    ) -> None:
        """Test that ValueError is raised for invalid doc_id."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)

            with pytest.raises(ValueError, match="Invalid doc_id"):
                await store.get_by_id("")


class TestDelete:
    """Tests for delete method."""

    @pytest.mark.asyncio
    async def test_delete_success(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test successful document deletion."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.delete = AsyncMock(return_value={"result": "deleted"})

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = await store.delete("doc-1")

            assert result is True
            mock_es_client.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_returns_false_for_missing(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test delete returns False for non-existent document."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        NotFoundError = mock_dependencies["elasticsearch"].NotFoundError

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.delete = AsyncMock(side_effect=NotFoundError())

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = await store.delete("non-existent")

            assert result is False

    @pytest.mark.asyncio
    async def test_delete_invalid_doc_id(
        self, mock_dependencies, mock_config
    ) -> None:
        """Test that ValueError is raised for invalid doc_id."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)

            with pytest.raises(ValueError, match="Invalid doc_id"):
                await store.delete("")


class TestBuildFilter:
    """Tests for _build_filter method."""

    def test_build_filter_empty(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter with empty filters returns empty list."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({})

            assert result == []

    def test_build_filter_single_value(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter with single value uses term query."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({"type": "reference"})

            assert len(result) == 1
            assert result[0] == {"term": {"metadata.type.keyword": "reference"}}

    def test_build_filter_list_value(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter with list value uses terms query."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({"status": ["active", "pending"]})

            assert len(result) == 1
            assert result[0] == {"terms": {"metadata.status.keyword": ["active", "pending"]}}

    def test_build_filter_file_types_mapping(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter maps file_types to file_type."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({"file_types": ["py", "js"]})

            assert len(result) == 1
            # API sends file_types (plural), ES doc uses file_type (singular)
            assert result[0] == {"terms": {"metadata.file_type.keyword": ["py", "js"]}}

    def test_build_filter_date_from(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter handles date_from with range query."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({"date_from": "2024-01-01"})

            assert len(result) == 1
            assert result[0] == {"range": {"metadata.indexed_at": {"gte": "2024-01-01"}}}

    def test_build_filter_date_to(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter handles date_to with range query."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({"date_to": "2024-12-31"})

            assert len(result) == 1
            assert result[0] == {"range": {"metadata.indexed_at": {"lte": "2024-12-31"}}}

    def test_build_filter_date_range_combined(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter combines date_from and date_to into single range query."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({
                "date_from": "2024-01-01",
                "date_to": "2024-12-31"
            })

            assert len(result) == 1
            assert result[0] == {
                "range": {
                    "metadata.indexed_at": {
                        "gte": "2024-01-01",
                        "lte": "2024-12-31"
                    }
                }
            }

    def test_build_filter_mixed_filters(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter with mixed filter types."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({
                "file_types": ["py", "js"],
                "author": "john",
                "date_from": "2024-01-01",
                "date_to": "2024-06-30"
            })

            # Should have 3 filter clauses: file_type terms, author term, date range
            assert len(result) == 3

            # Check file_types mapped to file_type
            file_type_filter = next(
                (f for f in result if "terms" in f and "metadata.file_type.keyword" in f["terms"]),
                None
            )
            assert file_type_filter == {"terms": {"metadata.file_type.keyword": ["py", "js"]}}

            # Check author term filter
            author_filter = next(
                (f for f in result if "term" in f and "metadata.author.keyword" in f["term"]),
                None
            )
            assert author_filter == {"term": {"metadata.author.keyword": "john"}}

            # Check date range filter
            date_filter = next(
                (f for f in result if "range" in f),
                None
            )
            assert date_filter == {
                "range": {
                    "metadata.indexed_at": {
                        "gte": "2024-01-01",
                        "lte": "2024-06-30"
                    }
                }
            }

    def test_build_filter_passthrough_unknown_keys(self, mock_dependencies, mock_config) -> None:
        """Test _build_filter passes through unknown filter keys unchanged."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            result = store._build_filter({"custom_field": "value"})

            assert len(result) == 1
            assert result[0] == {"term": {"metadata.custom_field.keyword": "value"}}


class TestHealthCheck:
    """Tests for health_check method."""

    @pytest.mark.asyncio
    async def test_health_check_healthy(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test health_check returns healthy status."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.cluster = AsyncMock()
        mock_es_client.cluster.health = AsyncMock(
            return_value={"status": "green", "cluster_name": "test-cluster"}
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            health = await store.health_check()

            assert health["status"] == "healthy"
            assert health["backend"] == "elasticsearch"
            assert health["cluster_status"] == "green"

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(
        self, mock_dependencies, mock_config, mock_es_client
    ) -> None:
        """Test health_check returns unhealthy on connection error."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.cluster = AsyncMock()
        mock_es_client.cluster.health = AsyncMock(
            side_effect=Exception("Connection refused")
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(mock_config)
            health = await store.health_check()

            assert health["status"] == "unhealthy"
            assert "error" in health

    @pytest.mark.asyncio
    async def test_health_check_excludes_api_key(
        self, mock_dependencies, mock_es_client
    ) -> None:
        """Test health_check does not expose API key."""
        from src.infrastructure.knowledge_store.elasticsearch_store import (
            ElasticsearchStore,
        )

        config = KnowledgeStoreConfig(
            backend="elasticsearch",
            elasticsearch_url="http://localhost:9200",
            elasticsearch_api_key="secret-key",
        )

        mock_dependencies["elasticsearch"].AsyncElasticsearch.return_value = mock_es_client
        mock_es_client.cluster = AsyncMock()
        mock_es_client.cluster.health = AsyncMock(
            return_value={"status": "green", "cluster_name": "test"}
        )

        with patch("src.core.config.get_tenant_config") as mock_tenant_config:
            mock_tenant_config.return_value.enabled = False

            store = ElasticsearchStore(config)
            health = await store.health_check()

            # API key should not be in any value
            for value in health.values():
                if isinstance(value, str):
                    assert "secret-key" not in value
