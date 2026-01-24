"""Elasticsearch implementation of the KnowledgeStore interface.

Provides vector storage and semantic search using Elasticsearch backend.
Supports multi-tenancy through tenant-prefixed index names.
"""

from __future__ import annotations

import logging
from typing import Any

from elasticsearch import AsyncElasticsearch, ElasticsearchException, NotFoundError

from src.core.config import get_tenant_config
from src.core.exceptions import (
    BackendConnectionError,
    IndexingError,
    SearchError,
    TenantNotSetError,
)
from src.core.tenant import TenantContext
from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
from src.infrastructure.knowledge_store.embedding_service import EmbeddingService
from src.infrastructure.knowledge_store.models import Document, SearchResult

logger = logging.getLogger(__name__)


# Index mapping for Elasticsearch
INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "doc_id": {"type": "keyword"},
            "content": {"type": "text"},
            "embedding": {
                "type": "dense_vector",
                "dims": 384,
                "index": True,
                "similarity": "cosine",
            },
            "metadata": {"type": "object", "dynamic": True},
            "tenant_id": {"type": "keyword"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}


class ElasticsearchStore:
    """Elasticsearch implementation of KnowledgeStore protocol.

    Provides vector storage and semantic search using Elasticsearch
    dense_vector fields with HNSW algorithm for approximate kNN.

    Supports multi-tenancy through tenant-prefixed index names.

    Attributes:
        config: Configuration for the Elasticsearch connection.

    Example:
        ```python
        config = KnowledgeStoreConfig.from_env()
        store = ElasticsearchStore(config)

        # Index a document
        doc = Document(doc_id="doc-1", content="Hello world")
        await store.index_document(doc)

        # Search
        results = await store.search("greeting", top_k=5)
        ```
    """

    def __init__(self, config: KnowledgeStoreConfig) -> None:
        """Initialize Elasticsearch store with configuration.

        Args:
            config: Configuration for Elasticsearch connection.
        """
        self.config = config
        self._embedding_service = EmbeddingService(config.embedding_model)

        # Build client kwargs
        client_kwargs: dict[str, Any] = {
            "hosts": [config.elasticsearch_url],
        }

        # Add API key if provided
        if config.elasticsearch_api_key:
            client_kwargs["api_key"] = config.elasticsearch_api_key

        self._client = AsyncElasticsearch(**client_kwargs)
        self._index_exists_cache: dict[str, bool] = {}

        logger.info(
            f"ElasticsearchStore initialized with URL: {config.elasticsearch_url}, "
            f"index prefix: {config.es_index_prefix}"
        )

    def _get_index_name(self) -> str:
        """Get the index name, with tenant prefix if multi-tenancy is enabled.

        Returns:
            str: The index name to use for operations.
        """
        tenant_config = get_tenant_config()
        base_name = f"{self.config.es_index_prefix}_documents"

        if tenant_config.enabled:
            try:
                tenant_id = TenantContext.get_current_tenant()
                return f"{tenant_id}_{base_name}"
            except (TenantNotSetError, LookupError):
                # No tenant in context, use default
                return f"{tenant_config.default_tenant}_{base_name}"
        return base_name

    def _validate_doc_id(self, doc_id: str) -> None:
        """Validate document ID format.

        Args:
            doc_id: The document ID to validate.

        Raises:
            ValueError: If doc_id is empty, not a string, or exceeds 512 chars.
        """
        if not doc_id or not isinstance(doc_id, str) or len(doc_id) > 512:
            raise ValueError(
                "Invalid doc_id: must be non-empty string with max 512 chars"
            )

    async def _ensure_index_exists(self) -> None:
        """Ensure the index exists with proper mapping.

        Creates the index if it doesn't exist.
        """
        index_name = self._get_index_name()

        if index_name in self._index_exists_cache:
            return

        try:
            exists = await self._client.indices.exists(index=index_name)
            if not exists:
                logger.info(f"Creating index: {index_name}")
                await self._client.indices.create(
                    index=index_name,
                    body=INDEX_MAPPING,
                )
            self._index_exists_cache[index_name] = True
        except ElasticsearchException as e:
            logger.error(f"Failed to ensure index exists: {e}")
            raise BackendConnectionError(
                f"Failed to create/check index: {e}",
                details={"index": index_name},
            ) from e

    def _build_filter(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        """Build Elasticsearch filter clauses from metadata filters.

        Args:
            filters: Dictionary of metadata field:value pairs.

        Returns:
            List of Elasticsearch term filter clauses.
        """
        filter_clauses = []
        for key, value in filters.items():
            filter_clauses.append({"term": {f"metadata.{key}": value}})
        return filter_clauses

    async def index_document(self, document: Document) -> str:
        """Index a document in Elasticsearch.

        If a document with the same doc_id exists, it will be updated (upsert).
        Uses tenant-prefixed index in multi-tenant mode.

        Args:
            document: The document to index.

        Returns:
            The doc_id of the indexed document.

        Raises:
            ValueError: If doc_id is invalid.
            IndexingError: If indexing fails.
        """
        self._validate_doc_id(document.doc_id)

        try:
            await self._ensure_index_exists()

            # Generate embedding if not provided
            if document.embedding is not None:
                embedding = document.embedding
            else:
                embedding = self._embedding_service.embed(document.content)

            # Get tenant ID for document
            tenant_config = get_tenant_config()
            tenant_id = None
            if tenant_config.enabled:
                try:
                    tenant_id = TenantContext.get_current_tenant()
                except (TenantNotSetError, LookupError):
                    tenant_id = tenant_config.default_tenant

            # Build document body
            body = {
                "doc_id": document.doc_id,
                "content": document.content,
                "embedding": embedding,
                "metadata": document.metadata,
            }
            if tenant_id:
                body["tenant_id"] = tenant_id

            await self._client.index(
                index=self._get_index_name(),
                id=document.doc_id,
                body=body,
            )

            logger.debug(f"Indexed document: {document.doc_id}")
            return document.doc_id

        except ElasticsearchException as e:
            logger.error(f"Failed to index document {document.doc_id}: {e}")
            raise IndexingError(
                f"Failed to index document: {e}",
                details={"doc_id": document.doc_id},
            ) from e

    async def search(
        self,
        query: str,
        top_k: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Search for documents similar to the query.

        Uses tenant-prefixed index in multi-tenant mode.

        Args:
            query: The search query text.
            top_k: Maximum number of results to return.
            filters: Optional metadata filters to apply.

        Returns:
            List of SearchResult objects, ordered by relevance.

        Raises:
            SearchError: If the search operation fails.
        """
        try:
            await self._ensure_index_exists()

            # Generate query embedding
            query_embedding = self._embedding_service.embed(query)

            # Build kNN query
            knn_query: dict[str, Any] = {
                "field": "embedding",
                "query_vector": query_embedding,
                "k": top_k,
                "num_candidates": self.config.es_num_candidates,
            }

            # Add filters if provided
            if filters:
                knn_query["filter"] = {"bool": {"must": self._build_filter(filters)}}

            response = await self._client.search(
                index=self._get_index_name(),
                knn=knn_query,
                source=["doc_id", "content", "metadata"],
            )

            # Convert response to SearchResult objects
            results = []
            for hit in response["hits"]["hits"]:
                source = hit["_source"]
                results.append(
                    SearchResult(
                        doc_id=source["doc_id"],
                        content=source.get("content", ""),
                        metadata=source.get("metadata", {}),
                        score=hit["_score"],
                        source="elasticsearch",
                    )
                )

            logger.debug(f"Search returned {len(results)} results")
            return results

        except ElasticsearchException as e:
            logger.error(f"Search failed: {e}")
            raise SearchError(
                f"Search failed: {e}",
                details={"query": query, "top_k": top_k},
            ) from e

    async def get_by_id(self, doc_id: str) -> Document | None:
        """Retrieve a document by its ID.

        Uses tenant-prefixed index in multi-tenant mode.

        Args:
            doc_id: The unique identifier of the document.

        Returns:
            The Document if found, None otherwise.

        Raises:
            ValueError: If doc_id is invalid.
            BackendConnectionError: If connection to backend fails.
        """
        self._validate_doc_id(doc_id)

        try:
            await self._ensure_index_exists()

            response = await self._client.get(
                index=self._get_index_name(),
                id=doc_id,
            )

            source = response["_source"]
            return Document(
                doc_id=source["doc_id"],
                content=source.get("content", ""),
                metadata=source.get("metadata", {}),
                embedding=source.get("embedding"),
            )

        except NotFoundError:
            return None
        except ElasticsearchException as e:
            logger.error(f"Failed to get document {doc_id}: {e}")
            raise BackendConnectionError(
                f"Failed to retrieve document: {e}",
                details={"doc_id": doc_id},
            ) from e

    async def delete(self, doc_id: str) -> bool:
        """Delete a document from the knowledge store.

        Uses tenant-prefixed index in multi-tenant mode.

        Args:
            doc_id: The unique identifier of the document to delete.

        Returns:
            True if the document was deleted, False if not found.

        Raises:
            ValueError: If doc_id is invalid.
            BackendConnectionError: If connection to backend fails.
        """
        self._validate_doc_id(doc_id)

        try:
            await self._ensure_index_exists()

            await self._client.delete(
                index=self._get_index_name(),
                id=doc_id,
            )
            logger.debug(f"Deleted document: {doc_id}")
            return True

        except NotFoundError:
            return False
        except ElasticsearchException as e:
            logger.error(f"Failed to delete document {doc_id}: {e}")
            raise BackendConnectionError(
                f"Failed to delete document: {e}",
                details={"doc_id": doc_id},
            ) from e

    async def health_check(self) -> dict[str, Any]:
        """Check the health of the Elasticsearch backend.

        Returns:
            Dictionary with health status information.
        """
        try:
            health = await self._client.cluster.health()
            index_name = self._get_index_name()

            return {
                "status": "healthy",
                "backend": "elasticsearch",
                "url": self.config.elasticsearch_url,
                "index": index_name,
                "cluster_status": health.get("status", "unknown"),
                "cluster_name": health.get("cluster_name", "unknown"),
            }
        except Exception as e:
            logger.warning(f"Elasticsearch health check failed: {e}")
            return {
                "status": "unhealthy",
                "backend": "elasticsearch",
                "url": self.config.elasticsearch_url,
                "error": str(e),
            }

    async def close(self) -> None:
        """Close the Elasticsearch client connection."""
        await self._client.close()
        logger.debug("Elasticsearch client closed")
