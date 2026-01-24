# P02-F04: Elasticsearch KnowledgeStore Backend

## Technical Design

### Overview

This feature replaces ChromaDB with Elasticsearch as the primary KnowledgeStore backend for vector storage and semantic search. The implementation follows the existing KnowledgeStore protocol interface, ensuring zero changes to agent prompts and orchestrator contracts.

**Goals:**
- Implement `ElasticsearchStore` class satisfying `KnowledgeStore` protocol
- Provide kNN search using Elasticsearch dense_vector with HNSW algorithm
- Support multi-tenancy via tenant-prefixed index names
- Update Docker Compose and Helm charts for Elasticsearch deployment
- Deprecate ChromaDB as fallback for 30-day migration window

### Architecture Reference

From `docs/System_Design.md` Section 5.3:
- KnowledgeStore interface: `index_document`, `search`, `get_by_id`, `delete`, `health_check`
- Prototype default: ChromaDB (now being replaced)
- Enterprise replacement path: Elasticsearch, OpenSearch, Azure AI Search
- Multi-tenancy via tenant-prefixed collection/index names

From `docs/Main_Features.md` Section D.14:
- Single retrieval interface for context enrichment
- Replaceable backends without agent prompt changes

### Dependencies

**Internal:**
- P01-F01: Infrastructure (Docker, Redis) - Required
- P01-F03: KnowledgeStore Foundation (existing protocol, models, factory) - Required
- P06-F05: Multi-tenancy (TenantContext) - Required

**External:**
- `elasticsearch[async]>=8.10.0` - Elasticsearch Python client with async support
- `sentence-transformers>=2.2.0` - For embedding generation (shared with ChromaDB)

### Components

#### 1. Configuration Updates (`src/infrastructure/knowledge_store/config.py`)

The configuration already includes Elasticsearch settings (added in P01-F03):
- `elasticsearch_url`: Connection URL (default: http://localhost:9200)
- `elasticsearch_api_key`: Optional API key authentication
- `es_index_prefix`: Index name prefix (default: asdlc)
- `es_num_candidates`: kNN num_candidates parameter (default: 100)

No configuration changes needed - already prepared.

#### 2. ElasticsearchStore Class (`src/infrastructure/knowledge_store/elasticsearch_store.py`)

```python
class ElasticsearchStore:
    """Elasticsearch implementation of KnowledgeStore protocol.

    Provides vector storage and semantic search using Elasticsearch
    dense_vector fields with HNSW algorithm for approximate kNN.

    Supports multi-tenancy through tenant-prefixed index names.
    """

    def __init__(self, config: KnowledgeStoreConfig) -> None:
        """Initialize Elasticsearch client and verify connection."""

    def _get_index_name(self) -> str:
        """Get index name with tenant prefix if multi-tenancy enabled."""

    async def _ensure_index_exists(self) -> None:
        """Create index with proper mapping if it doesn't exist."""

    async def index_document(self, document: Document) -> str:
        """Index document with embedding vector."""

    async def search(
        self,
        query: str,
        top_k: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """Perform kNN search with optional metadata filters."""

    async def get_by_id(self, doc_id: str) -> Document | None:
        """Retrieve document by ID."""

    async def delete(self, doc_id: str) -> bool:
        """Delete document by ID."""

    async def health_check(self) -> dict[str, Any]:
        """Check Elasticsearch cluster health."""
```

#### 3. Index Mapping

```json
{
  "mappings": {
    "properties": {
      "doc_id": { "type": "keyword" },
      "content": { "type": "text" },
      "embedding": {
        "type": "dense_vector",
        "dims": 384,
        "index": true,
        "similarity": "cosine"
      },
      "metadata": { "type": "object", "dynamic": true },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "index.knn": true
  }
}
```

#### 4. Factory Updates (`src/infrastructure/knowledge_store/factory.py`)

```python
# Add to imports
from src.infrastructure.knowledge_store.elasticsearch_store import ElasticsearchStore

# Update StoreType alias
StoreType = Union[ElasticsearchStore, ChromaDBStore, MockAnthologyStore]

# Update get_knowledge_store() backend selection:
if backend == "elasticsearch":
    logger.info(f"Connecting to Elasticsearch at {config.elasticsearch_url}")
    _knowledge_store = ElasticsearchStore(config)
elif backend == "chromadb":
    logger.warning(
        "ChromaDB backend is DEPRECATED and will be removed in 30 days. "
        "Please migrate to Elasticsearch."
    )
    _knowledge_store = ChromaDBStore(config)
```

#### 5. Embedding Generation

Reuse the embedding model pattern from ChromaDB:
- Model: `all-MiniLM-L6-v2` (384 dimensions)
- Generate embeddings at index time if not provided in Document
- Generate query embeddings for search operations

```python
class EmbeddingService:
    """Shared embedding generation service."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self._model = SentenceTransformer(model_name)
        self._dim = 384

    def embed(self, text: str) -> list[float]:
        """Generate embedding for text."""
        return self._model.encode(text).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        return self._model.encode(texts).tolist()
```

### Multi-Tenancy Strategy

**Index naming convention:**
- Single-tenant: `{es_index_prefix}_documents` (e.g., `asdlc_documents`)
- Multi-tenant: `{tenant_id}_{es_index_prefix}_documents` (e.g., `acme_asdlc_documents`)

**Tenant isolation:**
- Each tenant gets a separate index
- Index name derived from TenantContext
- No cross-tenant queries possible at index level

### kNN Search Implementation

```python
async def search(
    self,
    query: str,
    top_k: int = 10,
    filters: dict[str, Any] | None = None,
) -> list[SearchResult]:
    """Perform kNN search with Elasticsearch."""
    query_embedding = self._embedding_service.embed(query)

    knn_query = {
        "field": "embedding",
        "query_vector": query_embedding,
        "k": top_k,
        "num_candidates": self.config.es_num_candidates,
    }

    # Add filters if provided
    if filters:
        knn_query["filter"] = self._build_filter(filters)

    response = await self._client.search(
        index=self._get_index_name(),
        knn=knn_query,
        source=["doc_id", "content", "metadata"],
    )

    return [
        SearchResult(
            doc_id=hit["_source"]["doc_id"],
            content=hit["_source"]["content"],
            metadata=hit["_source"].get("metadata", {}),
            score=hit["_score"],
            source="elasticsearch",
        )
        for hit in response["hits"]["hits"]
    ]
```

### Docker Compose Changes

Replace the `chromadb` service with `elasticsearch`:

```yaml
# Container 3b: Elasticsearch Knowledge Store
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
  container_name: asdlc-elasticsearch
  hostname: elasticsearch
  ports:
    - "9200:9200"
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - ES_JAVA_OPTS=-Xms512m -Xmx512m
  volumes:
    - elasticsearch-data:/usr/share/elasticsearch/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9200/_cluster/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s
  networks:
    - asdlc-network

volumes:
  elasticsearch-data:
    name: asdlc-elasticsearch-data
```

### Helm Chart Structure

Create new Elasticsearch subchart following ChromaDB pattern:

```
helm/dox-asdlc/charts/elasticsearch/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── _helpers.tpl
    ├── statefulset.yaml
    ├── service.yaml
    ├── configmap.yaml
    └── secret.yaml (optional, for API key)
```

**Key differences from ChromaDB chart:**
- StatefulSet uses Elasticsearch image
- Probes use `/_cluster/health` endpoint
- ConfigMap includes Elasticsearch-specific settings
- Service maintains `knowledge-store` name for abstraction

### Migration Strategy

**30-day deprecation window:**
1. Default backend switches to `elasticsearch`
2. ChromaDB remains available with deprecation warning
3. Environment variable `KNOWLEDGE_STORE_BACKEND=chromadb` overrides
4. After 30 days, remove ChromaDB support

**Data migration (out of scope for this feature):**
- Export documents from ChromaDB via `get_by_id` or collection listing
- Re-index into Elasticsearch
- Separate migration script can be created as follow-up

### Error Handling

Reuse existing exceptions from `src/core/exceptions.py`:
- `BackendConnectionError`: Elasticsearch unreachable
- `IndexingError`: Document indexing failed
- `SearchError`: Search operation failed

Add Elasticsearch-specific error details:
```python
except elasticsearch.ConnectionError as e:
    raise BackendConnectionError(
        f"Failed to connect to Elasticsearch: {e}",
        details={"url": self.config.elasticsearch_url},
    ) from e
```

### Testing Strategy

1. **Unit tests**: ElasticsearchStore methods with mocked ES client
2. **Integration tests**: Full CRUD operations with real Elasticsearch
3. **Factory tests**: Backend selection logic
4. **Multi-tenancy tests**: Tenant-prefixed index isolation

**Test fixtures:**
- Use `pytest-elasticsearch` or testcontainers for integration tests
- Mock `AsyncElasticsearch` for unit tests

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/infrastructure/knowledge_store/elasticsearch_store.py` | Create |
| `src/infrastructure/knowledge_store/embedding_service.py` | Create |
| `src/infrastructure/knowledge_store/factory.py` | Modify |
| `src/infrastructure/knowledge_store/chromadb_store.py` | Add deprecation warning |
| `docker/docker-compose.yml` | Modify (replace chromadb) |
| `helm/dox-asdlc/charts/elasticsearch/` | Create (new chart) |
| `helm/dox-asdlc/values.yaml` | Modify (add elasticsearch config) |
| `requirements.txt` or `pyproject.toml` | Add elasticsearch dependency |
| `tests/unit/test_elasticsearch_store.py` | Create |
| `tests/integration/test_elasticsearch_integration.py` | Create |

### Security Considerations

1. **API Key Authentication**: Support `ELASTICSEARCH_API_KEY` for production
2. **TLS**: Production deployments should use HTTPS (configurable URL)
3. **Network Isolation**: Elasticsearch only accessible within Docker network
4. **Index-level Isolation**: Multi-tenancy prevents cross-tenant access

### Performance Considerations

1. **num_candidates**: Higher values improve recall at cost of latency
2. **Embedding Caching**: Consider caching embeddings for repeated queries
3. **Connection Pooling**: AsyncElasticsearch handles connection pooling
4. **Bulk Operations**: Future enhancement for batch indexing
