"""Repository ingestion service for KnowledgeStore.

Provides RepoIngester class for walking repositories, filtering files,
chunking content, and indexing into the KnowledgeStore.
"""

from __future__ import annotations

import fnmatch
import logging
import os
import time
from datetime import UTC, datetime
from typing import Any, Protocol

from src.core.exceptions import IngestionError
from src.infrastructure.knowledge_store.models import Document
from src.infrastructure.repo_ingestion.config import IngestionConfig
from src.infrastructure.repo_ingestion.models import IngestionResult

logger = logging.getLogger(__name__)


class KnowledgeStoreProtocol(Protocol):
    """Protocol for KnowledgeStore to enable dependency injection."""

    async def index_document(self, document: Document) -> str:
        """Index a document in the store."""
        ...


class RepoIngester:
    """Service for ingesting repository files into KnowledgeStore.

    Walks the repository directory tree, filters files by extension and patterns,
    chunks large files, and indexes content with metadata.

    Attributes:
        config: Ingestion configuration.

    Example:
        ```python
        from src.infrastructure.knowledge_store import get_knowledge_store
        from src.infrastructure.repo_ingestion import RepoIngester, IngestionConfig

        store = get_knowledge_store()
        config = IngestionConfig()
        ingester = RepoIngester(store, config)

        result = await ingester.ingest_repository("/path/to/repo")
        print(f"Processed {result.files_processed} files")
        ```
    """

    def __init__(
        self,
        store: KnowledgeStoreProtocol,
        config: IngestionConfig,
    ) -> None:
        """Initialize RepoIngester with KnowledgeStore and configuration.

        Args:
            store: KnowledgeStore instance for indexing documents.
            config: Configuration for ingestion behavior.
        """
        self._store = store
        self._config = config

    def _chunk_content(
        self,
        content: str,
        max_chars: int = 4000,
    ) -> list[str]:
        """Split content into chunks respecting line boundaries.

        Args:
            content: Text content to chunk.
            max_chars: Maximum characters per chunk.

        Returns:
            List of content chunks with overlap for context preservation.
        """
        if len(content) <= max_chars:
            return [content]

        lines = content.split("\n")
        chunks: list[str] = []
        current_chunk: list[str] = []
        current_size = 0

        for line in lines:
            line_size = len(line) + 1  # +1 for newline

            if current_size + line_size > max_chars and current_chunk:
                # Save current chunk
                chunks.append("\n".join(current_chunk))
                # Keep overlap_lines for context in next chunk
                current_chunk = current_chunk[-self._config.overlap_lines:]
                current_size = sum(len(chunk_line) + 1 for chunk_line in current_chunk)

            current_chunk.append(line)
            current_size += line_size

        # Add final chunk
        if current_chunk:
            chunks.append("\n".join(current_chunk))

        return chunks

    def _should_include_file(self, file_path: str) -> bool:
        """Check if file should be included based on extension and patterns.

        Args:
            file_path: Path to the file (relative or absolute).

        Returns:
            True if file should be included, False otherwise.
        """
        # Check extension
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()

        if ext not in self._config.include_extensions:
            return False

        # Check exclude patterns
        # Normalize path separators for pattern matching
        normalized_path = file_path.replace(os.sep, "/")

        for pattern in self._config.exclude_patterns:
            if fnmatch.fnmatch(normalized_path, pattern):
                return False
            # Also check path components for directory patterns
            # Handle patterns like **/node_modules/** by checking if directory is in path
            if "/**" in pattern:
                # Extract the directory name to match
                dir_pattern = pattern.replace("**/", "").replace("/**", "")
                if "/" + dir_pattern + "/" in "/" + normalized_path:
                    return False
                # Also check if path starts with the directory
                if normalized_path.startswith(dir_pattern + "/"):
                    return False

        return True

    def _validate_path_within_repo(self, file_path: str, repo_path: str) -> bool:
        """Ensure file_path is within repo_path after resolving symlinks.

        This prevents path traversal attacks where malicious symlinks or
        relative paths (../) could escape the repository boundary.

        Args:
            file_path: Path to the file being ingested.
            repo_path: Root path of the repository being ingested.

        Returns:
            True if file_path is safely within repo_path, False otherwise.
        """
        real_file = os.path.realpath(file_path)
        real_repo = os.path.realpath(repo_path)
        return real_file.startswith(real_repo + os.sep) or real_file == real_repo

    def _check_file_size(self, file_path: str) -> bool:
        """Check if file size is within limits.

        Args:
            file_path: Path to the file to check.

        Returns:
            True if file is within size limit, False otherwise.
        """
        try:
            file_size = os.path.getsize(file_path)
            if file_size > self._config.max_file_size_bytes:
                logger.warning(
                    f"Skipping oversized file: {file_path} "
                    f"({file_size} bytes > {self._config.max_file_size_bytes} limit)"
                )
                return False
            return True
        except OSError as e:
            logger.warning(f"Could not check file size for {file_path}: {e}")
            return False

    def _read_file_content(self, file_path: str) -> str | None:
        """Read file content with encoding fallback.

        Args:
            file_path: Path to the file to read.

        Returns:
            File content as string, or None if file is binary/unreadable.
        """
        try:
            with open(file_path, encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            try:
                logger.warning(f"UTF-8 decode failed for {file_path}, trying latin-1")
                with open(file_path, encoding="latin-1") as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Skipping binary file: {file_path}: {e}")
                return None
        except OSError as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            return None

    async def ingest_file(
        self,
        file_path: str,
        repo_path: str,
    ) -> list[str]:
        """Ingest a single file, returning document IDs created.

        Large files are chunked into multiple documents.

        Args:
            file_path: Absolute path to the file to ingest.
            repo_path: Absolute path to the repository root.

        Returns:
            List of document IDs created for this file.

        Raises:
            IngestionError: If file cannot be read or indexed.
        """
        # CRITICAL: Validate path within repo before any file read
        if not self._validate_path_within_repo(file_path, repo_path):
            raise IngestionError(
                f"Path traversal detected: {file_path} is outside repo",
                file_path=file_path,
            )

        # Check file size
        if not self._check_file_size(file_path):
            raise IngestionError(
                f"File exceeds size limit: {file_path}",
                file_path=file_path,
            )

        # Read content
        content = self._read_file_content(file_path)
        if content is None:
            raise IngestionError(
                f"Failed to read file: {file_path}",
                file_path=file_path,
            )

        # Calculate relative path from repo root
        real_repo = os.path.realpath(repo_path)
        real_file = os.path.realpath(file_path)
        relative_path = os.path.relpath(real_file, real_repo)
        # Normalize to forward slashes for consistent doc IDs
        relative_path = relative_path.replace(os.sep, "/")

        # Get file type
        _, file_type = os.path.splitext(file_path)
        file_type = file_type.lower()

        # Chunk content
        chunks = self._chunk_content(content, self._config.max_chunk_size)
        total_chunks = len(chunks)

        # Index each chunk
        doc_ids: list[str] = []
        indexed_at = datetime.now(UTC).isoformat()

        for chunk_index, chunk_content in enumerate(chunks):
            doc_id = f"{relative_path}:{chunk_index}"

            metadata: dict[str, Any] = {
                "file_path": relative_path,
                "file_type": file_type,
                "chunk_index": chunk_index,
                "total_chunks": total_chunks,
                "repo_path": repo_path,
                "indexed_at": indexed_at,
            }

            document = Document(
                doc_id=doc_id,
                content=chunk_content,
                metadata=metadata,
            )

            try:
                await self._store.index_document(document)
                doc_ids.append(doc_id)
            except Exception as e:
                raise IngestionError(
                    f"Failed to index document {doc_id}: {e}",
                    file_path=file_path,
                    cause=e,
                ) from e

        return doc_ids

    async def ingest_repository(
        self,
        repo_path: str,
        force_reindex: bool = False,
    ) -> IngestionResult:
        """Ingest all matching files from repository.

        Args:
            repo_path: Absolute path to repository root.
            force_reindex: If True, re-index even if document exists (not implemented).

        Returns:
            IngestionResult with counts and any errors.
        """
        start_time = time.time()

        files_processed = 0
        documents_created = 0
        files_skipped = 0
        errors: list[tuple[str, str]] = []

        real_repo = os.path.realpath(repo_path)

        for root, _dirs, files in os.walk(real_repo):
            for filename in files:
                file_path = os.path.join(root, filename)
                relative_path = os.path.relpath(file_path, real_repo)
                # Normalize for pattern matching
                normalized_relative = relative_path.replace(os.sep, "/")

                # Check if file should be included
                if not self._should_include_file(normalized_relative):
                    files_skipped += 1
                    logger.debug(f"Skipping excluded file: {relative_path}")
                    continue

                try:
                    doc_ids = await self.ingest_file(file_path, real_repo)
                    files_processed += 1
                    documents_created += len(doc_ids)
                    logger.info(f"Ingested {relative_path}: {len(doc_ids)} document(s)")
                except IngestionError as e:
                    errors.append((relative_path, str(e)))
                    logger.error(f"Failed to ingest {relative_path}: {e}")
                except Exception as e:
                    errors.append((relative_path, str(e)))
                    logger.error(f"Unexpected error ingesting {relative_path}: {e}")

        duration = time.time() - start_time

        result = IngestionResult(
            files_processed=files_processed,
            documents_created=documents_created,
            files_skipped=files_skipped,
            errors=errors,
            duration_seconds=duration,
        )

        logger.info(
            f"Ingestion complete: {files_processed} files, "
            f"{documents_created} documents, {files_skipped} skipped, "
            f"{len(errors)} errors in {duration:.2f}s"
        )

        return result
