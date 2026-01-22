"""Unit tests for exception hierarchy.

Tests KnowledgeStore exceptions and their serialization.
"""

from __future__ import annotations

import pytest

from src.core.exceptions import (
    ASDLCError,
    BackendConnectionError,
    DocumentNotFoundError,
    EmbeddingError,
    IndexingError,
    KnowledgeStoreError,
    SearchError,
)


class TestKnowledgeStoreExceptions:
    """Tests for KnowledgeStore exception hierarchy."""

    def test_knowledge_store_error_inherits_from_asdlc_error(self) -> None:
        """Test KnowledgeStoreError inherits from ASDLCError."""
        error = KnowledgeStoreError("test error")
        assert isinstance(error, ASDLCError)
        assert isinstance(error, Exception)

    def test_knowledge_store_error_with_message(self) -> None:
        """Test KnowledgeStoreError instantiation with message."""
        error = KnowledgeStoreError("Knowledge store failed")
        assert error.message == "Knowledge store failed"
        assert str(error) == "Knowledge store failed"
        assert error.details == {}

    def test_knowledge_store_error_with_details(self) -> None:
        """Test KnowledgeStoreError instantiation with details."""
        details = {"backend": "chromadb", "operation": "index"}
        error = KnowledgeStoreError("Operation failed", details=details)
        assert error.message == "Operation failed"
        assert error.details == details
        assert error.details["backend"] == "chromadb"

    def test_knowledge_store_error_to_dict(self) -> None:
        """Test KnowledgeStoreError to_dict serialization."""
        error = KnowledgeStoreError("test", details={"key": "value"})
        result = error.to_dict()

        assert result["error"] == "KnowledgeStoreError"
        assert result["message"] == "test"
        assert result["details"] == {"key": "value"}


class TestDocumentNotFoundError:
    """Tests for DocumentNotFoundError."""

    def test_document_not_found_inherits_from_knowledge_store_error(self) -> None:
        """Test DocumentNotFoundError inherits from KnowledgeStoreError."""
        error = DocumentNotFoundError("doc not found")
        assert isinstance(error, KnowledgeStoreError)
        assert isinstance(error, ASDLCError)

    def test_document_not_found_with_doc_id(self) -> None:
        """Test DocumentNotFoundError with document ID in details."""
        error = DocumentNotFoundError(
            "Document not found",
            details={"doc_id": "abc123"}
        )
        assert error.details["doc_id"] == "abc123"

    def test_document_not_found_to_dict(self) -> None:
        """Test DocumentNotFoundError to_dict serialization."""
        error = DocumentNotFoundError("not found", details={"doc_id": "xyz"})
        result = error.to_dict()

        assert result["error"] == "DocumentNotFoundError"
        assert result["message"] == "not found"
        assert result["details"]["doc_id"] == "xyz"


class TestIndexingError:
    """Tests for IndexingError."""

    def test_indexing_error_inherits_from_knowledge_store_error(self) -> None:
        """Test IndexingError inherits from KnowledgeStoreError."""
        error = IndexingError("indexing failed")
        assert isinstance(error, KnowledgeStoreError)

    def test_indexing_error_with_details(self) -> None:
        """Test IndexingError with operation details."""
        error = IndexingError(
            "Failed to index document",
            details={"doc_id": "doc1", "reason": "duplicate"}
        )
        assert error.message == "Failed to index document"
        assert error.details["reason"] == "duplicate"

    def test_indexing_error_to_dict(self) -> None:
        """Test IndexingError to_dict serialization."""
        error = IndexingError("failed")
        result = error.to_dict()
        assert result["error"] == "IndexingError"


class TestSearchError:
    """Tests for SearchError."""

    def test_search_error_inherits_from_knowledge_store_error(self) -> None:
        """Test SearchError inherits from KnowledgeStoreError."""
        error = SearchError("search failed")
        assert isinstance(error, KnowledgeStoreError)

    def test_search_error_with_query_details(self) -> None:
        """Test SearchError with query details."""
        error = SearchError(
            "Search failed",
            details={"query": "test query", "top_k": 10}
        )
        assert error.details["query"] == "test query"
        assert error.details["top_k"] == 10

    def test_search_error_to_dict(self) -> None:
        """Test SearchError to_dict serialization."""
        error = SearchError("failed")
        result = error.to_dict()
        assert result["error"] == "SearchError"


class TestEmbeddingError:
    """Tests for EmbeddingError."""

    def test_embedding_error_inherits_from_knowledge_store_error(self) -> None:
        """Test EmbeddingError inherits from KnowledgeStoreError."""
        error = EmbeddingError("embedding failed")
        assert isinstance(error, KnowledgeStoreError)

    def test_embedding_error_with_model_details(self) -> None:
        """Test EmbeddingError with model details."""
        error = EmbeddingError(
            "Failed to generate embedding",
            details={"model": "all-MiniLM-L6-v2", "text_length": 5000}
        )
        assert error.details["model"] == "all-MiniLM-L6-v2"
        assert error.details["text_length"] == 5000

    def test_embedding_error_to_dict(self) -> None:
        """Test EmbeddingError to_dict serialization."""
        error = EmbeddingError("failed")
        result = error.to_dict()
        assert result["error"] == "EmbeddingError"


class TestBackendConnectionError:
    """Tests for BackendConnectionError."""

    def test_backend_connection_error_inherits_from_knowledge_store_error(self) -> None:
        """Test BackendConnectionError inherits from KnowledgeStoreError."""
        error = BackendConnectionError("connection failed")
        assert isinstance(error, KnowledgeStoreError)

    def test_backend_connection_error_with_connection_details(self) -> None:
        """Test BackendConnectionError with connection details."""
        error = BackendConnectionError(
            "Failed to connect to ChromaDB",
            details={"host": "localhost", "port": 8000, "timeout": 30}
        )
        assert error.details["host"] == "localhost"
        assert error.details["port"] == 8000

    def test_backend_connection_error_to_dict(self) -> None:
        """Test BackendConnectionError to_dict serialization."""
        error = BackendConnectionError("failed")
        result = error.to_dict()
        assert result["error"] == "BackendConnectionError"


class TestExceptionHierarchy:
    """Tests for overall exception hierarchy structure."""

    def test_all_exceptions_have_to_dict(self) -> None:
        """Test all KnowledgeStore exceptions have to_dict method."""
        exceptions = [
            KnowledgeStoreError("test"),
            DocumentNotFoundError("test"),
            IndexingError("test"),
            SearchError("test"),
            EmbeddingError("test"),
            BackendConnectionError("test"),
        ]

        for exc in exceptions:
            result = exc.to_dict()
            assert "error" in result
            assert "message" in result
            assert "details" in result

    def test_exception_hierarchy_chain(self) -> None:
        """Test exception inheritance chain is correct."""
        # KnowledgeStoreError -> ASDLCError -> Exception
        assert issubclass(KnowledgeStoreError, ASDLCError)

        # All specific errors -> KnowledgeStoreError
        assert issubclass(DocumentNotFoundError, KnowledgeStoreError)
        assert issubclass(IndexingError, KnowledgeStoreError)
        assert issubclass(SearchError, KnowledgeStoreError)
        assert issubclass(EmbeddingError, KnowledgeStoreError)
        assert issubclass(BackendConnectionError, KnowledgeStoreError)

    def test_exceptions_can_be_caught_by_base_class(self) -> None:
        """Test specific exceptions can be caught by KnowledgeStoreError."""
        with pytest.raises(KnowledgeStoreError):
            raise DocumentNotFoundError("test")

        with pytest.raises(KnowledgeStoreError):
            raise IndexingError("test")

        with pytest.raises(ASDLCError):
            raise KnowledgeStoreError("test")
