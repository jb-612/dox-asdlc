"""Integration tests for Elasticsearch knowledge store.

These tests require a running Elasticsearch instance.
Run with: docker compose up elasticsearch -d
"""

from __future__ import annotations

import os
import sys
import uuid

import pytest
import numpy as np

# Skip all tests if Elasticsearch is not available
pytestmark = pytest.mark.skipif(
    os.getenv("SKIP_ELASTICSEARCH_TESTS", "true").lower() == "true",
    reason="Elasticsearch not available. Set SKIP_ELASTICSEARCH_TESTS=false to run.",
)


# Mock sentence_transformers for tests
@pytest.fixture(autouse=True, scope="module")
def mock_sentence_transformers():
    """Mock sentence_transformers module."""
    mock_st = type(sys)("sentence_transformers")
    mock_model = type("MockModel", (), {
        "encode": lambda self, text: np.random.rand(384).astype(np.float32)
        if isinstance(text, str)
        else np.random.rand(len(text), 384).astype(np.float32)
    })()
    mock_st.SentenceTransformer = lambda name: mock_model
    sys.modules["sentence_transformers"] = mock_st
    yield
    sys.modules.pop("sentence_transformers", None)


@pytest.fixture
def test_config():
    """Create test configuration for Elasticsearch."""
    from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig

    return KnowledgeStoreConfig(
        backend="elasticsearch",
        elasticsearch_url=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
        es_index_prefix=f"test_{uuid.uuid4().hex[:8]}",
        es_num_candidates=50,
    )


@pytest.fixture
async def store(test_config):
    """Create an ElasticsearchStore instance for testing."""
    from src.infrastructure.knowledge_store.elasticsearch_store import ElasticsearchStore

    store = ElasticsearchStore(test_config)
    yield store

    # Cleanup: delete test indices
    try:
        index_pattern = f"{test_config.es_index_prefix}_*"
        await store._client.indices.delete(index=index_pattern, ignore=[404])
    except Exception:
        pass
    finally:
        await store.close()


class TestElasticsearchIntegration:
    """Integration tests for Elasticsearch store."""

    @pytest.mark.asyncio
    async def test_index_and_retrieve_document(self, store) -> None:
        """Test indexing a document and retrieving it by ID."""
        from src.infrastructure.knowledge_store.models import Document

        doc = Document(
            doc_id="test-doc-1",
            content="This is a test document about machine learning.",
            metadata={"author": "test", "category": "ml"},
        )

        # Index the document
        result_id = await store.index_document(doc)
        assert result_id == "test-doc-1"

        # Wait for index refresh
        await store._client.indices.refresh(index=store._get_index_name())

        # Retrieve by ID
        retrieved = await store.get_by_id("test-doc-1")
        assert retrieved is not None
        assert retrieved.doc_id == "test-doc-1"
        assert retrieved.content == doc.content
        assert retrieved.metadata["author"] == "test"

    @pytest.mark.asyncio
    async def test_search_returns_results(self, store) -> None:
        """Test semantic search returns documents."""
        from src.infrastructure.knowledge_store.models import Document

        # Index multiple documents
        docs = [
            Document(
                doc_id="ml-doc",
                content="Machine learning is a subset of artificial intelligence.",
                metadata={"topic": "ml"},
            ),
            Document(
                doc_id="cooking-doc",
                content="The best way to cook pasta is in salted boiling water.",
                metadata={"topic": "cooking"},
            ),
            Document(
                doc_id="ai-doc",
                content="Deep learning uses neural networks with many layers.",
                metadata={"topic": "ai"},
            ),
        ]

        for doc in docs:
            await store.index_document(doc)

        # Wait for index refresh
        await store._client.indices.refresh(index=store._get_index_name())

        # Search for content
        results = await store.search("artificial intelligence", top_k=3)

        assert len(results) > 0
        doc_ids = [r.doc_id for r in results]
        assert any(doc_id in doc_ids for doc_id in ["ml-doc", "ai-doc", "cooking-doc"])

    @pytest.mark.asyncio
    async def test_search_with_metadata_filter(self, store) -> None:
        """Test search with metadata filtering."""
        from src.infrastructure.knowledge_store.models import Document

        docs = [
            Document(
                doc_id="python-doc",
                content="Python is a popular programming language.",
                metadata={"language": "python"},
            ),
            Document(
                doc_id="java-doc",
                content="Java is also a popular programming language.",
                metadata={"language": "java"},
            ),
        ]

        for doc in docs:
            await store.index_document(doc)

        # Wait for index refresh
        await store._client.indices.refresh(index=store._get_index_name())

        # Search with filter
        results = await store.search(
            "programming language",
            top_k=5,
            filters={"language": "python"},
        )

        assert len(results) == 1
        assert results[0].doc_id == "python-doc"

    @pytest.mark.asyncio
    async def test_update_document(self, store) -> None:
        """Test updating an existing document."""
        from src.infrastructure.knowledge_store.models import Document

        # Index original
        doc = Document(
            doc_id="update-test",
            content="Original content",
            metadata={"version": "1"},
        )
        await store.index_document(doc)

        # Update (upsert)
        updated_doc = Document(
            doc_id="update-test",
            content="Updated content with new information",
            metadata={"version": "2"},
        )
        await store.index_document(updated_doc)

        # Wait for index refresh
        await store._client.indices.refresh(index=store._get_index_name())

        # Verify update
        retrieved = await store.get_by_id("update-test")
        assert retrieved is not None
        assert "Updated content" in retrieved.content
        assert retrieved.metadata["version"] == "2"

    @pytest.mark.asyncio
    async def test_delete_document(self, store) -> None:
        """Test deleting a document."""
        from src.infrastructure.knowledge_store.models import Document

        doc = Document(
            doc_id="delete-test",
            content="This document will be deleted.",
        )
        await store.index_document(doc)

        # Wait for index refresh
        await store._client.indices.refresh(index=store._get_index_name())

        # Verify it exists
        assert await store.get_by_id("delete-test") is not None

        # Delete
        result = await store.delete("delete-test")
        assert result is True

        # Verify deleted
        assert await store.get_by_id("delete-test") is None

        # Delete again should return False
        result = await store.delete("delete-test")
        assert result is False

    @pytest.mark.asyncio
    async def test_health_check(self, store) -> None:
        """Test health check returns healthy status."""
        health = await store.health_check()

        assert health["status"] == "healthy"
        assert health["backend"] == "elasticsearch"
        assert "cluster_status" in health

    @pytest.mark.asyncio
    async def test_search_empty_results(self, store) -> None:
        """Test search with no matching documents."""
        # Ensure index exists
        await store._ensure_index_exists()

        results = await store.search("xyzzy nonexistent query 12345", top_k=5)
        assert results == []

    @pytest.mark.asyncio
    async def test_get_nonexistent_document(self, store) -> None:
        """Test getting a document that doesn't exist."""
        # Ensure index exists
        await store._ensure_index_exists()

        result = await store.get_by_id("nonexistent-doc-id")
        assert result is None


class TestElasticsearchConcurrency:
    """Tests for concurrent operations."""

    @pytest.mark.asyncio
    async def test_concurrent_indexing(self, store) -> None:
        """Test concurrent document indexing."""
        import asyncio

        from src.infrastructure.knowledge_store.models import Document

        async def index_doc(i: int) -> str:
            doc = Document(
                doc_id=f"concurrent-{i}",
                content=f"Document number {i} for concurrency testing.",
            )
            return await store.index_document(doc)

        # Index 10 documents concurrently
        tasks = [index_doc(i) for i in range(10)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 10
        assert all(r.startswith("concurrent-") for r in results)

        # Wait for index refresh
        await store._client.indices.refresh(index=store._get_index_name())

        # Verify all were indexed
        for i in range(10):
            doc = await store.get_by_id(f"concurrent-{i}")
            assert doc is not None


class TestElasticsearchMultiTenant:
    """Tests for multi-tenant operations."""

    @pytest.mark.asyncio
    async def test_tenant_isolation(self, test_config) -> None:
        """Test that tenants have isolated indexes."""
        from unittest.mock import patch, MagicMock

        from src.infrastructure.knowledge_store.elasticsearch_store import ElasticsearchStore
        from src.infrastructure.knowledge_store.models import Document

        # Create store for tenant A
        with patch(
            "src.infrastructure.knowledge_store.elasticsearch_store.get_tenant_config"
        ) as mock_config:
            mock_config_obj = MagicMock()
            mock_config_obj.enabled = True
            mock_config_obj.default_tenant = "default"
            mock_config.return_value = mock_config_obj

            with patch(
                "src.infrastructure.knowledge_store.elasticsearch_store.TenantContext"
            ) as mock_tenant:
                mock_tenant.get_current_tenant.return_value = "tenant_a"

                store = ElasticsearchStore(test_config)
                index_name = store._get_index_name()

                # Verify tenant prefix
                assert index_name.startswith("tenant_a_")

                await store.close()
