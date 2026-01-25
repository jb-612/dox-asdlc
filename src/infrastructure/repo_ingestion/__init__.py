"""Repository ingestion module for KnowledgeStore.

This module provides services for ingesting repository code and documentation
into the KnowledgeStore for semantic search and retrieval.

Usage:
    ```python
    from src.infrastructure.repo_ingestion import (
        RepoIngester,
        IngestionConfig,
        IngestionResult,
    )
    from src.infrastructure.knowledge_store import get_knowledge_store

    # Get the knowledge store
    store = get_knowledge_store()

    # Create ingester with configuration
    config = IngestionConfig.from_env()
    ingester = RepoIngester(store, config)

    # Ingest a repository
    result = await ingester.ingest_repository("/path/to/repo")

    print(f"Processed: {result.files_processed} files")
    print(f"Created: {result.documents_created} documents")
    print(f"Skipped: {result.files_skipped} files")
    print(f"Errors: {len(result.errors)}")
    ```
"""

from src.infrastructure.repo_ingestion.config import IngestionConfig
from src.infrastructure.repo_ingestion.ingester import RepoIngester
from src.infrastructure.repo_ingestion.models import IngestionResult

__all__ = [
    "RepoIngester",
    "IngestionConfig",
    "IngestionResult",
]
