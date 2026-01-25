"""Configuration for repository ingestion.

Provides IngestionConfig dataclass for configuring file filtering,
chunking strategy, and size limits during repository ingestion.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class IngestionConfig:
    """Configuration for repository ingestion.

    Attributes:
        include_extensions: File extensions to include (e.g., .py, .ts).
        exclude_patterns: Glob patterns for directories/files to exclude.
        max_chunk_size: Maximum characters per document chunk.
        overlap_lines: Number of lines to overlap between chunks for context.
        max_file_size_bytes: Maximum file size in bytes (files exceeding this are skipped).

    Example:
        ```python
        config = IngestionConfig()
        # Or from environment
        config = IngestionConfig.from_env()
        ```
    """

    include_extensions: frozenset[str] = frozenset({
        ".py", ".ts", ".js", ".tsx", ".jsx",
        ".md", ".yaml", ".yml", ".json",
        ".sh", ".toml", ".html", ".css",
    })

    exclude_patterns: frozenset[str] = frozenset({
        "**/node_modules/**",
        "**/__pycache__/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/*.pyc",
        "**/*.whl",
        "**/*.tar*",
        "**/*.zip",
        "**/*.png",
        "**/*.jpg",
        "**/*.gif",
        "**/*.ico",
        "**/*.egg-info/**",
        "**/.venv/**",
        "**/venv/**",
    })

    max_chunk_size: int = 4000
    overlap_lines: int = 5
    max_file_size_bytes: int = 10_000_000  # 10MB limit

    @classmethod
    def from_env(cls) -> IngestionConfig:
        """Create configuration from environment variables.

        Environment variables:
            INGESTION_MAX_CHUNK_SIZE: Maximum characters per chunk (default: 4000)
            INGESTION_OVERLAP_LINES: Lines to overlap between chunks (default: 5)
            INGESTION_MAX_FILE_SIZE_BYTES: Max file size in bytes (default: 10000000)

        Returns:
            IngestionConfig instance with values from environment or defaults.
        """
        max_chunk_size = int(
            os.environ.get("INGESTION_MAX_CHUNK_SIZE", "4000")
        )
        overlap_lines = int(
            os.environ.get("INGESTION_OVERLAP_LINES", "5")
        )
        max_file_size_bytes = int(
            os.environ.get("INGESTION_MAX_FILE_SIZE_BYTES", "10000000")
        )

        return cls(
            max_chunk_size=max_chunk_size,
            overlap_lines=overlap_lines,
            max_file_size_bytes=max_file_size_bytes,
        )
