"""Data models for repository ingestion.

Provides IngestionResult dataclass for tracking ingestion operation outcomes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class IngestionResult:
    """Result of repository ingestion operation.

    Attributes:
        files_processed: Number of files successfully processed.
        documents_created: Number of documents indexed (may exceed files due to chunking).
        files_skipped: Number of files skipped (excluded patterns or unsupported).
        errors: List of (file_path, error_message) tuples for files that failed.
        duration_seconds: Time taken for the ingestion operation.

    Example:
        ```python
        result = IngestionResult(
            files_processed=10,
            documents_created=15,
            files_skipped=3,
            errors=[("path/to/file.py", "Permission denied")],
            duration_seconds=1.5,
        )
        print(result.to_dict())
        ```
    """

    files_processed: int
    documents_created: int
    files_skipped: int
    errors: list[tuple[str, str]]
    duration_seconds: float

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary for JSON serialization.

        Returns:
            Dictionary representation of the ingestion result.
        """
        return {
            "files_processed": self.files_processed,
            "documents_created": self.documents_created,
            "files_skipped": self.files_skipped,
            "errors": self.errors,
            "duration_seconds": self.duration_seconds,
        }
