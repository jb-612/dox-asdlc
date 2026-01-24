"""Factory function for KnowledgeStore instances.

Provides singleton pattern for KnowledgeStore access with backend selection.
"""

from __future__ import annotations

import logging
import warnings
from typing import TYPE_CHECKING, Union

from src.core.exceptions import ConfigurationError
from src.infrastructure.knowledge_store.chromadb_store import ChromaDBStore
from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
from src.infrastructure.knowledge_store.elasticsearch_store import ElasticsearchStore
from src.infrastructure.knowledge_store.mock_anthology import MockAnthologyStore

if TYPE_CHECKING:
    from src.core.interfaces import KnowledgeStore

logger = logging.getLogger(__name__)

# Type alias for supported store types
StoreType = Union[ElasticsearchStore, ChromaDBStore, MockAnthologyStore]

# Singleton instance
_knowledge_store: StoreType | None = None


def get_knowledge_store(
    config: KnowledgeStoreConfig | None = None,
) -> StoreType:
    """Get the singleton KnowledgeStore instance.

    Creates a new store instance on first call based on the backend
    configuration, or returns the existing instance on subsequent calls.

    Supported backends:
        - "elasticsearch": Elasticsearch vector database (default, recommended)
        - "chromadb": ChromaDB vector database (deprecated, use elasticsearch)
        - "mock_anthology": In-memory mock for testing

    Args:
        config: Optional configuration. If not provided, configuration
            is loaded from environment variables. Only used on first call.

    Returns:
        KnowledgeStore: The singleton store instance.

    Raises:
        ConfigurationError: If the backend type is not supported.
        BackendConnectionError: If connection to backend fails.

    Example:
        ```python
        # Get store with default config from environment
        store = get_knowledge_store()

        # Get store with mock backend for testing
        config = KnowledgeStoreConfig(backend="mock_anthology")
        store = get_knowledge_store(config=config)
        ```
    """
    global _knowledge_store

    if _knowledge_store is None:
        if config is None:
            config = KnowledgeStoreConfig.from_env()

        backend = config.backend.lower()
        logger.info(f"Creating KnowledgeStore with backend: {backend}")

        if backend == "elasticsearch":
            logger.info(
                f"Connecting to Elasticsearch at {config.elasticsearch_url}"
            )
            _knowledge_store = ElasticsearchStore(config)
        elif backend == "chromadb":
            warnings.warn(
                "ChromaDB backend is DEPRECATED and will be removed in 30 days. "
                "Please migrate to Elasticsearch by setting "
                "KNOWLEDGE_STORE_BACKEND=elasticsearch",
                DeprecationWarning,
                stacklevel=2,
            )
            logger.warning(
                "ChromaDB backend is DEPRECATED. "
                "Please migrate to Elasticsearch."
            )
            logger.info(
                f"Connecting to ChromaDB at {config.host}:{config.port}"
            )
            _knowledge_store = ChromaDBStore(config)
        elif backend == "mock_anthology":
            logger.info("Using MockAnthologyStore (in-memory)")
            _knowledge_store = MockAnthologyStore(config)
        else:
            raise ConfigurationError(
                f"Unsupported knowledge store backend: '{backend}'. "
                f"Supported backends: elasticsearch, chromadb, mock_anthology"
            )

    return _knowledge_store


def reset_knowledge_store() -> None:
    """Reset the singleton KnowledgeStore instance.

    Call this to clear the cached instance, for example when testing
    or when configuration might have changed.
    """
    global _knowledge_store
    _knowledge_store = None
    logger.debug("KnowledgeStore singleton reset")
