"""Embedding service for generating text embeddings.

Provides a shared embedding generation service for knowledge store backends.
Uses SentenceTransformers for embedding generation.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer as STModel

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Shared embedding generation service.

    Provides text embedding generation using SentenceTransformers.
    Supports lazy model loading for improved startup performance.

    Attributes:
        model_name: Name of the SentenceTransformer model to use.
        dimension: Dimension of the embedding vectors.

    Example:
        ```python
        from src.infrastructure.knowledge_store.embedding_service import (
            EmbeddingService,
        )

        service = EmbeddingService()

        # Generate single embedding
        embedding = service.embed("Hello, world!")

        # Generate batch embeddings
        embeddings = service.embed_batch(["Hello", "World"])
        ```
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        """Initialize the embedding service.

        Args:
            model_name: Name of the SentenceTransformer model to use.
                Defaults to "all-MiniLM-L6-v2" which produces 384-dimensional
                embeddings.
        """
        self._model_name = model_name
        self._model: STModel | None = None
        self._dimension = 384  # all-MiniLM-L6-v2 dimension

    @property
    def dimension(self) -> int:
        """Get the embedding dimension.

        Returns:
            int: The dimension of embedding vectors.
        """
        return self._dimension

    def _get_model(self) -> STModel:
        """Get or lazily load the SentenceTransformer model.

        Returns:
            SentenceTransformer: The loaded model instance.
        """
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading embedding model: {self._model_name}")
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def embed(self, text: str) -> list[float]:
        """Generate embedding for a single text.

        Args:
            text: The text to embed.

        Returns:
            list[float]: The embedding vector as a list of floats.
        """
        model = self._get_model()
        embedding = model.encode(text)
        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts.

        Args:
            texts: List of texts to embed.

        Returns:
            list[list[float]]: List of embedding vectors.
        """
        model = self._get_model()
        embeddings = model.encode(texts)
        return embeddings.tolist()
