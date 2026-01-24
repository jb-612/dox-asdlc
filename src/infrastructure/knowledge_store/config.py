"""Configuration for KnowledgeStore backends.

Provides environment-based configuration for knowledge store connections.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class KnowledgeStoreConfig:
    """Configuration for knowledge store connection.

    Attributes:
        backend: Backend type: "elasticsearch", "chromadb", or "mock_anthology".
        host: Hostname of the knowledge store backend (for ChromaDB).
        port: Port number for the backend (for ChromaDB).
        collection_name: Name of the document collection.
        embedding_model: Name of the embedding model to use.
        elasticsearch_url: URL for Elasticsearch connection.
        elasticsearch_api_key: API key for Elasticsearch authentication.
        es_index_prefix: Prefix for Elasticsearch index names.
        es_num_candidates: Number of candidates for kNN search.
    """

    backend: str = "elasticsearch"
    host: str = "localhost"
    port: int = 8000
    collection_name: str = "asdlc_documents"
    embedding_model: str = "all-MiniLM-L6-v2"
    elasticsearch_url: str = "http://localhost:9200"
    elasticsearch_api_key: str | None = None
    es_index_prefix: str = "asdlc"
    es_num_candidates: int = 100

    @classmethod
    def from_env(cls) -> KnowledgeStoreConfig:
        """Create configuration from environment variables.

        Environment variables:
            KNOWLEDGE_STORE_BACKEND: Backend type: elasticsearch, chromadb, or mock_anthology
                (default: elasticsearch)
            KNOWLEDGE_STORE_HOST: Backend hostname for ChromaDB (default: localhost)
            KNOWLEDGE_STORE_PORT: Backend port for ChromaDB (default: 8000)
            KNOWLEDGE_STORE_COLLECTION: Collection name (default: asdlc_documents)
            KNOWLEDGE_STORE_EMBEDDING_MODEL: Embedding model (default: all-MiniLM-L6-v2)
            ELASTICSEARCH_URL: Elasticsearch URL (default: http://localhost:9200)
            ELASTICSEARCH_API_KEY: Elasticsearch API key (default: None)
            ES_INDEX_PREFIX: Elasticsearch index prefix (default: asdlc)
            ES_NUM_CANDIDATES: kNN num_candidates parameter (default: 100)

        Returns:
            KnowledgeStoreConfig instance with values from environment.
        """
        return cls(
            backend=os.getenv("KNOWLEDGE_STORE_BACKEND", "elasticsearch"),
            host=os.getenv("KNOWLEDGE_STORE_HOST", "localhost"),
            port=int(os.getenv("KNOWLEDGE_STORE_PORT", "8000")),
            collection_name=os.getenv(
                "KNOWLEDGE_STORE_COLLECTION", "asdlc_documents"
            ),
            embedding_model=os.getenv(
                "KNOWLEDGE_STORE_EMBEDDING_MODEL", "all-MiniLM-L6-v2"
            ),
            elasticsearch_url=os.getenv(
                "ELASTICSEARCH_URL", "http://localhost:9200"
            ),
            elasticsearch_api_key=os.getenv("ELASTICSEARCH_API_KEY"),
            es_index_prefix=os.getenv("ES_INDEX_PREFIX", "asdlc"),
            es_num_candidates=int(os.getenv("ES_NUM_CANDIDATES", "100")),
        )

    @property
    def connection_url(self) -> str:
        """Get the connection URL for the backend.

        Returns:
            HTTP URL for connecting to the backend.
        """
        return f"http://{self.host}:{self.port}"

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary.

        Note: elasticsearch_api_key is excluded for security.

        Returns:
            Dictionary representation of the configuration.
        """
        return {
            "backend": self.backend,
            "host": self.host,
            "port": self.port,
            "collection_name": self.collection_name,
            "embedding_model": self.embedding_model,
            "elasticsearch_url": self.elasticsearch_url,
            "es_index_prefix": self.es_index_prefix,
            "es_num_candidates": self.es_num_candidates,
        }
