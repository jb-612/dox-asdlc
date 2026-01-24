"""ChromaDB implementation of the KnowledgeStore interface.

DEPRECATED: This module is deprecated and will be removed in 30 days.
Please migrate to Elasticsearch by setting KNOWLEDGE_STORE_BACKEND=elasticsearch.

Provides vector storage and semantic search using ChromaDB backend.
Supports multi-tenancy through tenant-prefixed collection names.
"""

from __future__ import annotations

import logging
import warnings
from typing import Any

import chromadb

from src.core.config import get_tenant_config
from src.core.exceptions import (
    BackendConnectionError,
    IndexingError,
    SearchError,
)
from src.core.tenant import TenantContext
from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
from src.infrastructure.knowledge_store.models import Document, SearchResult

logger = logging.getLogger(__name__)


class ChromaDBStore:
    """ChromaDB implementation of KnowledgeStore protocol.

    DEPRECATED: This class is deprecated and will be removed in 30 days.
    Please migrate to ElasticsearchStore by setting KNOWLEDGE_STORE_BACKEND=elasticsearch.

    Connects to a ChromaDB instance via HTTP and provides document
    indexing, semantic search, and retrieval operations.

    Attributes:
        config: Configuration for the ChromaDB connection.

    Example:
        ```python
        # Deprecated - use ElasticsearchStore instead
        config = KnowledgeStoreConfig.from_env()
        store = ChromaDBStore(config)

        # Index a document
        doc = Document(doc_id="doc-1", content="Hello world")
        await store.index_document(doc)

        # Search
        results = await store.search("greeting", top_k=5)
        ```
    """

    def __init__(self, config: KnowledgeStoreConfig) -> None:
        """Initialize ChromaDB store with configuration.

        DEPRECATED: Use ElasticsearchStore instead.

        Args:
            config: Configuration for ChromaDB connection.

        Raises:
            BackendConnectionError: If connection to ChromaDB fails.
        """
        warnings.warn(
            "ChromaDBStore is DEPRECATED and will be removed in 30 days. "
            "Please migrate to ElasticsearchStore by setting "
            "KNOWLEDGE_STORE_BACKEND=elasticsearch. "
            "See docs/System_Design.md Section 5.3 for migration guidance.",
            DeprecationWarning,
            stacklevel=2,
        )
        self.config = config
        self._base_collection_name = config.collection_name
        self._collection_cache: dict[str, Any] = {}

        try:
            self._client = chromadb.HttpClient(
                host=config.host,
                port=config.port,
            )
            # Test connection by getting heartbeat
            self._client.heartbeat()
            logger.info(
                f"Connected to ChromaDB at {config.host}:{config.port}, "
                f"base collection: {config.collection_name}"
            )
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB: {e}")
            raise BackendConnectionError(
                f"Failed to connect to ChromaDB: {e}",
                details={
                    "host": config.host,
                    "port": config.port,
                },
            ) from e

    def _get_collection_name(self) -> str:
        """Get the collection name, with tenant prefix if multi-tenancy is enabled.

        Returns:
            str: The collection name to use for operations.
        """
        tenant_config = get_tenant_config()
        if tenant_config.enabled:
            try:
                tenant_id = TenantContext.get_current_tenant()
                return f"{tenant_id}_{self._base_collection_name}"
            except Exception:
                # No tenant in context, use default
                return f"{tenant_config.default_tenant}_{self._base_collection_name}"
        return self._base_collection_name

    def _get_collection(self) -> Any:
        """Get or create the ChromaDB collection for the current tenant.

        Uses caching to avoid repeated get_or_create calls.

        Returns:
            ChromaDB Collection object.
        """
        collection_name = self._get_collection_name()

        if collection_name not in self._collection_cache:
            self._collection_cache[collection_name] = (
                self._client.get_or_create_collection(name=collection_name)
            )
            logger.debug(f"Initialized collection: {collection_name}")

        return self._collection_cache[collection_name]

    async def index_document(self, document: Document) -> str:
        """Index a document in ChromaDB.

        If a document with the same doc_id exists, it will be updated (upsert).
        Uses tenant-prefixed collection in multi-tenant mode.

        Args:
            document: The document to index.

        Returns:
            The doc_id of the indexed document.

        Raises:
            IndexingError: If indexing fails.
        """
        try:
            collection = self._get_collection()
            upsert_kwargs: dict[str, Any] = {
                "ids": [document.doc_id],
                "documents": [document.content],
                "metadatas": [document.metadata] if document.metadata else None,
            }

            # Include embedding if provided
            if document.embedding is not None:
                upsert_kwargs["embeddings"] = [document.embedding]

            collection.upsert(**upsert_kwargs)

            logger.debug(f"Indexed document: {document.doc_id}")
            return document.doc_id

        except Exception as e:
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

        Uses tenant-prefixed collection in multi-tenant mode.

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
            collection = self._get_collection()
            query_kwargs: dict[str, Any] = {
                "query_texts": [query],
                "n_results": top_k,
            }

            if filters:
                query_kwargs["where"] = filters

            results = collection.query(**query_kwargs)

            # Convert ChromaDB results to SearchResult objects
            search_results: list[SearchResult] = []

            ids = results.get("ids", [[]])[0]
            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]

            for i, doc_id in enumerate(ids):
                # Convert distance to similarity score (1 - distance)
                score = 1.0 - distances[i] if i < len(distances) else 0.0

                search_results.append(
                    SearchResult(
                        doc_id=doc_id,
                        content=documents[i] if i < len(documents) else "",
                        metadata=metadatas[i] if i < len(metadatas) else {},
                        score=score,
                        source="chromadb",
                    )
                )

            logger.debug(f"Search returned {len(search_results)} results")
            return search_results

        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise SearchError(
                f"Search failed: {e}",
                details={"query": query, "top_k": top_k},
            ) from e

    async def get_by_id(self, doc_id: str) -> Document | None:
        """Retrieve a document by its ID.

        Uses tenant-prefixed collection in multi-tenant mode.

        Args:
            doc_id: The unique identifier of the document.

        Returns:
            The Document if found, None otherwise.

        Raises:
            BackendConnectionError: If connection to backend fails.
        """
        try:
            collection = self._get_collection()
            result = collection.get(
                ids=[doc_id],
                include=["documents", "metadatas", "embeddings"],
            )

            if not result["ids"]:
                return None

            return Document(
                doc_id=result["ids"][0],
                content=result["documents"][0] if result["documents"] else "",
                metadata=result["metadatas"][0] if result["metadatas"] else {},
                embedding=result["embeddings"][0] if result.get("embeddings") else None,
            )

        except Exception as e:
            logger.error(f"Failed to get document {doc_id}: {e}")
            raise BackendConnectionError(
                f"Failed to retrieve document: {e}",
                details={"doc_id": doc_id},
            ) from e

    async def delete(self, doc_id: str) -> bool:
        """Delete a document from the knowledge store.

        Uses tenant-prefixed collection in multi-tenant mode.

        Args:
            doc_id: The unique identifier of the document to delete.

        Returns:
            True if the document was deleted, False if not found.

        Raises:
            BackendConnectionError: If connection to backend fails.
        """
        try:
            collection = self._get_collection()
            # Check if document exists first
            result = collection.get(ids=[doc_id])

            if not result["ids"]:
                return False

            collection.delete(ids=[doc_id])
            logger.debug(f"Deleted document: {doc_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete document {doc_id}: {e}")
            raise BackendConnectionError(
                f"Failed to delete document: {e}",
                details={"doc_id": doc_id},
            ) from e

    async def health_check(self) -> dict[str, Any]:
        """Check the health of the ChromaDB backend.

        Returns:
            Dictionary with health status information.
        """
        try:
            heartbeat = self._client.heartbeat()
            collection_name = self._get_collection_name()
            return {
                "status": "healthy",
                "backend": "chromadb",
                "host": self.config.host,
                "port": self.config.port,
                "base_collection": self._base_collection_name,
                "active_collection": collection_name,
                "heartbeat": heartbeat,
            }
        except Exception as e:
            logger.warning(f"ChromaDB health check failed: {e}")
            return {
                "status": "unhealthy",
                "backend": "chromadb",
                "host": self.config.host,
                "port": self.config.port,
                "error": str(e),
            }
