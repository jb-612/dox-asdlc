"""Unit tests for KnowledgeStore configuration.

Tests configuration loading and validation.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig


class TestKnowledgeStoreConfig:
    """Tests for KnowledgeStoreConfig dataclass."""

    def test_default_configuration(self) -> None:
        """Test KnowledgeStoreConfig default values."""
        config = KnowledgeStoreConfig()

        assert config.host == "localhost"
        assert config.port == 8000
        assert config.collection_name == "asdlc_documents"
        assert config.embedding_model == "all-MiniLM-L6-v2"

    def test_custom_configuration(self) -> None:
        """Test KnowledgeStoreConfig with custom values."""
        config = KnowledgeStoreConfig(
            host="chromadb.local",
            port=9000,
            collection_name="my_collection",
            embedding_model="sentence-transformers/all-mpnet-base-v2",
        )

        assert config.host == "chromadb.local"
        assert config.port == 9000
        assert config.collection_name == "my_collection"
        assert config.embedding_model == "sentence-transformers/all-mpnet-base-v2"

    def test_configuration_is_immutable(self) -> None:
        """Test KnowledgeStoreConfig is frozen."""
        config = KnowledgeStoreConfig()

        with pytest.raises(AttributeError):
            config.host = "new-host"  # type: ignore[misc]


class TestKnowledgeStoreConfigFromEnv:
    """Tests for loading configuration from environment."""

    def test_from_env_with_defaults(self) -> None:
        """Test from_env uses defaults when env vars not set."""
        # Clear any existing env vars
        env_vars = [
            "KNOWLEDGE_STORE_HOST",
            "KNOWLEDGE_STORE_PORT",
            "KNOWLEDGE_STORE_COLLECTION",
            "KNOWLEDGE_STORE_EMBEDDING_MODEL",
        ]

        with patch.dict(os.environ, {}, clear=True):
            # Ensure the vars are not set
            for var in env_vars:
                os.environ.pop(var, None)

            config = KnowledgeStoreConfig.from_env()

            assert config.host == "localhost"
            assert config.port == 8000
            assert config.collection_name == "asdlc_documents"
            assert config.embedding_model == "all-MiniLM-L6-v2"

    def test_from_env_with_custom_values(self) -> None:
        """Test from_env loads from environment variables."""
        env_vars = {
            "KNOWLEDGE_STORE_HOST": "chromadb.prod",
            "KNOWLEDGE_STORE_PORT": "9090",
            "KNOWLEDGE_STORE_COLLECTION": "prod_docs",
            "KNOWLEDGE_STORE_EMBEDDING_MODEL": "custom-model",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            config = KnowledgeStoreConfig.from_env()

            assert config.host == "chromadb.prod"
            assert config.port == 9090
            assert config.collection_name == "prod_docs"
            assert config.embedding_model == "custom-model"

    def test_from_env_partial_override(self) -> None:
        """Test from_env with partial environment variables."""
        env_vars = {
            "KNOWLEDGE_STORE_HOST": "custom-host",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            # Clear other vars
            os.environ.pop("KNOWLEDGE_STORE_PORT", None)
            os.environ.pop("KNOWLEDGE_STORE_COLLECTION", None)
            os.environ.pop("KNOWLEDGE_STORE_EMBEDDING_MODEL", None)

            config = KnowledgeStoreConfig.from_env()

            assert config.host == "custom-host"
            assert config.port == 8000  # default
            assert config.collection_name == "asdlc_documents"  # default


class TestKnowledgeStoreConfigSerialization:
    """Tests for configuration serialization."""

    def test_to_dict(self) -> None:
        """Test configuration to_dict serialization."""
        config = KnowledgeStoreConfig(
            host="test-host",
            port=1234,
            collection_name="test_collection",
            embedding_model="test-model",
        )

        result = config.to_dict()

        assert result["host"] == "test-host"
        assert result["port"] == 1234
        assert result["collection_name"] == "test_collection"
        assert result["embedding_model"] == "test-model"

    def test_connection_url(self) -> None:
        """Test connection URL generation."""
        config = KnowledgeStoreConfig(
            host="chromadb.local",
            port=8080,
        )

        assert config.connection_url == "http://chromadb.local:8080"

    def test_connection_url_localhost(self) -> None:
        """Test connection URL with localhost."""
        config = KnowledgeStoreConfig()

        assert config.connection_url == "http://localhost:8000"


class TestElasticsearchConfig:
    """Tests for Elasticsearch-specific configuration."""

    def test_default_elasticsearch_url(self) -> None:
        """Test default Elasticsearch URL."""
        config = KnowledgeStoreConfig()

        assert config.elasticsearch_url == "http://localhost:9200"

    def test_elasticsearch_url_from_env(self) -> None:
        """Test Elasticsearch URL from environment variable."""
        with patch.dict(
            os.environ,
            {"ELASTICSEARCH_URL": "http://elasticsearch.prod:9200"},
        ):
            config = KnowledgeStoreConfig.from_env()

            assert config.elasticsearch_url == "http://elasticsearch.prod:9200"

    def test_elasticsearch_api_key_default_none(self) -> None:
        """Test Elasticsearch API key defaults to None."""
        config = KnowledgeStoreConfig()

        assert config.elasticsearch_api_key is None

    def test_elasticsearch_api_key_from_env(self) -> None:
        """Test Elasticsearch API key from environment variable."""
        with patch.dict(
            os.environ,
            {"ELASTICSEARCH_API_KEY": "my-secret-api-key"},
        ):
            config = KnowledgeStoreConfig.from_env()

            assert config.elasticsearch_api_key == "my-secret-api-key"

    def test_elasticsearch_index_prefix(self) -> None:
        """Test default Elasticsearch index prefix."""
        config = KnowledgeStoreConfig()

        assert config.es_index_prefix == "asdlc"

    def test_elasticsearch_index_prefix_from_env(self) -> None:
        """Test Elasticsearch index prefix from environment variable."""
        with patch.dict(
            os.environ,
            {"ES_INDEX_PREFIX": "custom_prefix"},
        ):
            config = KnowledgeStoreConfig.from_env()

            assert config.es_index_prefix == "custom_prefix"

    def test_elasticsearch_num_candidates(self) -> None:
        """Test default Elasticsearch kNN num_candidates."""
        config = KnowledgeStoreConfig()

        assert config.es_num_candidates == 100

    def test_elasticsearch_num_candidates_from_env(self) -> None:
        """Test Elasticsearch num_candidates from environment variable."""
        with patch.dict(
            os.environ,
            {"ES_NUM_CANDIDATES": "200"},
        ):
            config = KnowledgeStoreConfig.from_env()

            assert config.es_num_candidates == 200

    def test_elasticsearch_config_in_to_dict(self) -> None:
        """Test Elasticsearch config is included in to_dict."""
        config = KnowledgeStoreConfig(
            elasticsearch_url="http://es:9200",
            es_index_prefix="myprefix",
            es_num_candidates=150,
        )

        result = config.to_dict()

        assert result["elasticsearch_url"] == "http://es:9200"
        assert result["es_index_prefix"] == "myprefix"
        assert result["es_num_candidates"] == 150
        # API key should not be in dict for security
        assert "elasticsearch_api_key" not in result
