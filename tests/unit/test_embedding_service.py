"""Unit tests for EmbeddingService.

Tests embedding generation functionality used by Elasticsearch store.
"""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest
import numpy as np


@pytest.fixture(autouse=True)
def mock_sentence_transformers():
    """Mock sentence_transformers module before importing EmbeddingService."""
    # Create a mock module
    mock_module = MagicMock()
    mock_model = MagicMock()
    mock_model.encode.return_value = np.array([0.1] * 384)
    mock_module.SentenceTransformer.return_value = mock_model

    # Store original if it exists
    original = sys.modules.get("sentence_transformers")

    # Add mock to sys.modules
    sys.modules["sentence_transformers"] = mock_module

    yield mock_module

    # Restore original or remove
    if original is not None:
        sys.modules["sentence_transformers"] = original
    else:
        sys.modules.pop("sentence_transformers", None)

    # Clear cached imports
    for mod_name in list(sys.modules.keys()):
        if "embedding_service" in mod_name:
            del sys.modules[mod_name]


class TestEmbeddingService:
    """Tests for EmbeddingService class."""

    def test_embed_returns_list_of_floats(self, mock_sentence_transformers) -> None:
        """Test that embed returns a list of floats."""
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.1, 0.2, 0.3])
        mock_sentence_transformers.SentenceTransformer.return_value = mock_model

        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        service = EmbeddingService()
        result = service.embed("test text")

        assert isinstance(result, list)
        assert all(isinstance(x, float) for x in result)
        mock_model.encode.assert_called_once_with("test text")

    def test_embed_batch_returns_list_of_lists(self, mock_sentence_transformers) -> None:
        """Test that embed_batch returns a list of embedding lists."""
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
        ])
        mock_sentence_transformers.SentenceTransformer.return_value = mock_model

        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        service = EmbeddingService()
        result = service.embed_batch(["text 1", "text 2"])

        assert isinstance(result, list)
        assert len(result) == 2
        assert all(isinstance(emb, list) for emb in result)

    def test_embedding_dimension_is_384(self, mock_sentence_transformers) -> None:
        """Test that the embedding dimension is 384."""
        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        service = EmbeddingService()

        assert service.dimension == 384

    def test_default_model_is_minilm(self, mock_sentence_transformers) -> None:
        """Test that the default model is all-MiniLM-L6-v2."""
        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        service = EmbeddingService()
        # Trigger model loading
        service._get_model()

        mock_sentence_transformers.SentenceTransformer.assert_called_with(
            "all-MiniLM-L6-v2"
        )

    def test_custom_model_name_is_used(self, mock_sentence_transformers) -> None:
        """Test that a custom model name can be specified."""
        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        service = EmbeddingService(model_name="custom-model")
        # Trigger model loading
        service._get_model()

        mock_sentence_transformers.SentenceTransformer.assert_called_with(
            "custom-model"
        )

    def test_lazy_model_loading(self, mock_sentence_transformers) -> None:
        """Test that the model is loaded lazily on first use."""
        # Reset the call count
        mock_sentence_transformers.SentenceTransformer.reset_mock()

        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        # Creating service should not load model
        service = EmbeddingService()

        # Model should be None initially
        assert service._model is None

        # SentenceTransformer should not have been called yet
        mock_sentence_transformers.SentenceTransformer.assert_not_called()

        # Now trigger loading
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.1, 0.2, 0.3])
        mock_sentence_transformers.SentenceTransformer.return_value = mock_model

        service.embed("test")

        mock_sentence_transformers.SentenceTransformer.assert_called_once()
