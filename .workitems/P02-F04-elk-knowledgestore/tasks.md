# P02-F04: Tasks

## Task Breakdown

### T01: Add Elasticsearch Dependency
**File:** `requirements.txt` or `pyproject.toml`

- [x] Add `elasticsearch[async]>=8.10.0` to dependencies
- [x] Verify `sentence-transformers>=2.2.0` already present
- [x] Run `pip install` and verify no conflicts
- [x] Update any lock files if applicable

**Estimate:** 0.5h
**Dependencies:** None
**User Story:** US-01
**Completed:** Already present in requirements.txt

---

### T02: Create Embedding Service
**File:** `src/infrastructure/knowledge_store/embedding_service.py`
**Test:** `tests/unit/test_embedding_service.py`

- [x] Create `EmbeddingService` class
- [x] Implement `embed(text: str) -> list[float]` method
- [x] Implement `embed_batch(texts: list[str]) -> list[list[float]]` method
- [x] Use `all-MiniLM-L6-v2` model (384 dimensions)
- [x] Add lazy model loading for performance
- [x] Write unit tests for embedding generation

**Estimate:** 1h
**Dependencies:** T01
**User Story:** US-01, US-02
**Completed:** EmbeddingService created with lazy loading, 6 tests passing

---

### T03: Create ElasticsearchStore Class - Initialization
**File:** `src/infrastructure/knowledge_store/elasticsearch_store.py`
**Test:** `tests/unit/test_elasticsearch_store.py`

- [x] Create `ElasticsearchStore` class skeleton
- [x] Implement `__init__` with config and client setup
- [x] Implement `_get_index_name()` with tenant awareness
- [x] Implement index mapping constant
- [x] Implement `_ensure_index_exists()` for index creation
- [x] Handle connection errors with `BackendConnectionError`
- [x] Write unit tests with mocked AsyncElasticsearch

**Estimate:** 1.5h
**Dependencies:** T01, T02
**User Story:** US-01, US-06
**Completed:** ElasticsearchStore class with 5 init tests passing

---

### T04: Implement index_document Method
**File:** `src/infrastructure/knowledge_store/elasticsearch_store.py`
**Test:** `tests/unit/test_elasticsearch_store.py`

- [x] Implement `index_document(document: Document) -> str`
- [x] Generate embedding if not provided using EmbeddingService
- [x] Use Elasticsearch `index` API with doc_id as `_id`
- [x] Include tenant_id in document body
- [x] Handle indexing errors with `IndexingError`
- [x] Write unit tests for indexing scenarios

**Estimate:** 1h
**Dependencies:** T03
**User Story:** US-01
**Completed:** index_document with 4 tests passing

---

### T05: Implement search Method
**File:** `src/infrastructure/knowledge_store/elasticsearch_store.py`
**Test:** `tests/unit/test_elasticsearch_store.py`

- [x] Implement `search(query, top_k, filters) -> list[SearchResult]`
- [x] Generate query embedding using EmbeddingService
- [x] Build kNN query with num_candidates from config
- [x] Convert filters to Elasticsearch filter format
- [x] Parse response into SearchResult objects
- [x] Handle search errors with `SearchError`
- [x] Write unit tests for search scenarios

**Estimate:** 1.5h
**Dependencies:** T03, T04
**User Story:** US-02, US-03
**Completed:** search method with 5 tests passing

---

### T06: Implement get_by_id Method
**File:** `src/infrastructure/knowledge_store/elasticsearch_store.py`
**Test:** `tests/unit/test_elasticsearch_store.py`

- [x] Implement `get_by_id(doc_id: str) -> Document | None`
- [x] Use Elasticsearch `get` API
- [x] Return None for NotFoundError
- [x] Convert response to Document model
- [x] Handle connection errors
- [x] Write unit tests

**Estimate:** 0.5h
**Dependencies:** T03
**User Story:** US-04
**Completed:** get_by_id with 3 tests passing

---

### T07: Implement delete Method
**File:** `src/infrastructure/knowledge_store/elasticsearch_store.py`
**Test:** `tests/unit/test_elasticsearch_store.py`

- [x] Implement `delete(doc_id: str) -> bool`
- [x] Use Elasticsearch `delete` API
- [x] Return False for NotFoundError
- [x] Return True on successful deletion
- [x] Handle connection errors
- [x] Write unit tests

**Estimate:** 0.5h
**Dependencies:** T03
**User Story:** US-05
**Completed:** delete with 2 tests passing

---

### T08: Implement health_check Method
**File:** `src/infrastructure/knowledge_store/elasticsearch_store.py`
**Test:** `tests/unit/test_elasticsearch_store.py`

- [x] Implement `health_check() -> dict[str, Any]`
- [x] Call Elasticsearch `cluster.health` API
- [x] Return status, backend name, URL, index name
- [x] Exclude API key from response
- [x] Return "unhealthy" on connection error
- [x] Write unit tests

**Estimate:** 0.5h
**Dependencies:** T03
**User Story:** US-07
**Completed:** health_check with 3 tests passing

---

### T09: Update Factory for Elasticsearch
**File:** `src/infrastructure/knowledge_store/factory.py`
**Test:** `tests/unit/test_knowledge_store_factory.py`

- [x] Import `ElasticsearchStore`
- [x] Update `StoreType` type alias
- [x] Add `elasticsearch` case to backend selection
- [x] Make `elasticsearch` the default backend
- [x] Log deprecation warning for `chromadb` selection
- [x] Update docstrings
- [x] Write/update factory unit tests

**Estimate:** 1h
**Dependencies:** T03-T08
**User Story:** US-08
**Completed:** Factory updated with 7 tests passing, lazy imports in __init__.py

---

### T10: Add Deprecation Warning to ChromaDB
**File:** `src/infrastructure/knowledge_store/chromadb_store.py`
**Test:** `tests/unit/test_chromadb_store.py`

- [x] Add deprecation warning in `__init__`
- [x] Use `warnings.warn` with DeprecationWarning category
- [x] Include migration guidance in warning message
- [x] Add docstring noting deprecation
- [x] Write test verifying warning is logged

**Estimate:** 0.5h
**Dependencies:** None
**User Story:** US-09
**Completed:** Deprecation warning added with 17 tests passing

---

### T11: Update Docker Compose
**File:** `docker/docker-compose.yml`

- [x] Replace `chromadb` service with `elasticsearch`
- [x] Use `docker.elastic.co/elasticsearch/elasticsearch:8.11.0` image
- [x] Configure single-node discovery
- [x] Set Java heap options (512m-512m for prototype)
- [x] Disable security for local development
- [x] Add healthcheck using `/_cluster/health`
- [x] Create `elasticsearch-data` volume
- [x] Update orchestrator/workers environment variables
- [x] Update service dependencies

**Estimate:** 1h
**Dependencies:** None (can be done in parallel)
**User Story:** US-10
**Completed:** docker-compose.yml updated with Elasticsearch replacing ChromaDB

---

### T12: Create Elasticsearch Helm Chart - Structure
**File:** `helm/dox-asdlc/charts/elasticsearch/`

- [x] Create `Chart.yaml` with chart metadata
- [x] Create `values.yaml` with default configuration
- [x] Create `templates/_helpers.tpl` with helper templates
- [x] Follow pattern from chromadb subchart
- [x] Maintain `knowledge-store` service name abstraction

**Estimate:** 1h
**Dependencies:** None (can be done in parallel)
**User Story:** US-11
**Completed:** Chart structure created with Chart.yaml, values.yaml, _helpers.tpl

---

### T13: Create Elasticsearch Helm Chart - Templates
**File:** `helm/dox-asdlc/charts/elasticsearch/templates/`

- [x] Create `statefulset.yaml` for Elasticsearch pod
- [x] Create `service.yaml` with ClusterIP
- [x] Create `configmap.yaml` for ES settings
- [x] Add liveness and readiness probes
- [x] Configure persistent volume claim
- [x] Add resource limits and requests

**Estimate:** 1.5h
**Dependencies:** T12
**User Story:** US-11
**Completed:** All templates created with init container for sysctl

---

### T14: Update Umbrella Chart Values
**File:** `helm/dox-asdlc/values.yaml`

- [x] Add `elasticsearch` section with config
- [x] Set `chromadb.enabled: false` by default
- [x] Set `elasticsearch.enabled: true` by default
- [x] Add ES-specific environment variables to sharedEnv
- [x] Update resource recommendations

**Estimate:** 0.5h
**Dependencies:** T12, T13
**User Story:** US-11
**Completed:** Updated values.yaml and Chart.yaml with elasticsearch dependency

---

### T15: Integration Tests - Elasticsearch Operations
**File:** `tests/integration/test_elasticsearch_store.py`

- [x] Create pytest fixtures for Elasticsearch container
- [x] Test index creation with mapping
- [x] Test document indexing and retrieval
- [x] Test kNN search with embeddings
- [x] Test metadata filtering
- [x] Test document deletion
- [x] Test multi-tenant isolation
- [x] Skip if Elasticsearch unavailable

**Estimate:** 2h
**Dependencies:** T04-T08
**User Story:** US-01 through US-07
**Completed:** Integration tests created with skip marker for CI

---

### T16: Integration Tests - Factory and Backend Switching
**File:** `tests/integration/test_knowledge_store_factory.py`

- [x] Test factory creates ElasticsearchStore by default
- [x] Test factory can still create ChromaDBStore
- [x] Test ChromaDB logs deprecation warning
- [x] Test singleton behavior across backends
- [x] Test reset_knowledge_store clears instance

**Estimate:** 1h
**Dependencies:** T09, T10
**User Story:** US-08, US-09
**Completed:** Integration tests for factory and backend switching

---

### T17: Update Configuration Documentation
**File:** `src/infrastructure/knowledge_store/config.py` (config.py has inline docs)

- [x] Config.py already documents Elasticsearch as default
- [x] ChromaDB deprecation noted in chromadb_store.py and factory.py
- [x] Environment variable documentation is current in config.py
- [x] Migration notes in deprecation warnings

**Estimate:** 0.5h
**Dependencies:** All implementation tasks
**User Story:** US-09
**Completed:** Configuration is fully documented with env vars and migration guidance

Note: docs/System_Design.md is outside backend domain (meta file).
Update to System_Design.md should be done by orchestrator agent.

---

## Progress

- Started: 2026-01-24
- Tasks Complete: 17/17
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

## Dependency Graph

```
T01 (deps)
  |
  v
T02 (embedding) --> T03 (ES init)
                      |
          +-----------+-----------+-----------+
          |           |           |           |
          v           v           v           v
        T04         T05         T06         T07
        (index)     (search)    (get)       (delete)
          |           |           |           |
          +-----------+-----------+-----------+
                      |
                      v
                    T08 (health)
                      |
                      v
                    T09 (factory)
                      |
                      v
                    T15, T16 (integration tests)
                      |
                      v
                    T17 (docs)

Parallel tracks:
T10 (chromadb deprecation) - independent
T11 (docker-compose) - independent
T12 --> T13 --> T14 (helm charts) - independent
```

## Estimates Summary

| Task | Estimate | Cumulative |
|------|----------|------------|
| T01 | 0.5h | 0.5h |
| T02 | 1.0h | 1.5h |
| T03 | 1.5h | 3.0h |
| T04 | 1.0h | 4.0h |
| T05 | 1.5h | 5.5h |
| T06 | 0.5h | 6.0h |
| T07 | 0.5h | 6.5h |
| T08 | 0.5h | 7.0h |
| T09 | 1.0h | 8.0h |
| T10 | 0.5h | 8.5h |
| T11 | 1.0h | 9.5h |
| T12 | 1.0h | 10.5h |
| T13 | 1.5h | 12.0h |
| T14 | 0.5h | 12.5h |
| T15 | 2.0h | 14.5h |
| T16 | 1.0h | 15.5h |
| T17 | 0.5h | 16.0h |

**Total Estimated Effort:** 16 hours (2-3 days)

## Completion Notes

**Completed: 2026-01-24**

### Summary
Implemented Elasticsearch as the default KnowledgeStore backend, replacing ChromaDB.

### Files Created
- `/Users/jbellish/VSProjects/dox-asdlc/src/infrastructure/knowledge_store/embedding_service.py` - Shared embedding generation service
- `/Users/jbellish/VSProjects/dox-asdlc/src/infrastructure/knowledge_store/elasticsearch_store.py` - Elasticsearch backend implementation
- `/Users/jbellish/VSProjects/dox-asdlc/tests/unit/test_embedding_service.py` - 6 unit tests
- `/Users/jbellish/VSProjects/dox-asdlc/tests/unit/test_elasticsearch_store.py` - 22 unit tests
- `/Users/jbellish/VSProjects/dox-asdlc/tests/integration/test_elasticsearch_store.py` - Integration tests
- `/Users/jbellish/VSProjects/dox-asdlc/tests/integration/test_knowledge_store_factory.py` - Factory integration tests
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/charts/elasticsearch/Chart.yaml` - Helm chart metadata
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/charts/elasticsearch/values.yaml` - Helm chart values
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/charts/elasticsearch/templates/_helpers.tpl` - Helm helpers
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/charts/elasticsearch/templates/statefulset.yaml` - K8s StatefulSet
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/charts/elasticsearch/templates/service.yaml` - K8s Service
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/charts/elasticsearch/templates/configmap.yaml` - K8s ConfigMap

### Files Modified
- `/Users/jbellish/VSProjects/dox-asdlc/src/infrastructure/knowledge_store/__init__.py` - Added lazy imports for ES
- `/Users/jbellish/VSProjects/dox-asdlc/src/infrastructure/knowledge_store/factory.py` - Added ES backend, deprecation warning
- `/Users/jbellish/VSProjects/dox-asdlc/src/infrastructure/knowledge_store/chromadb_store.py` - Added deprecation warning
- `/Users/jbellish/VSProjects/dox-asdlc/tests/unit/test_knowledge_store_factory.py` - Updated for ES default
- `/Users/jbellish/VSProjects/dox-asdlc/tests/unit/test_chromadb_store.py` - Added deprecation test
- `/Users/jbellish/VSProjects/dox-asdlc/docker/docker-compose.yml` - Replaced ChromaDB with Elasticsearch
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/Chart.yaml` - Added Elasticsearch dependency
- `/Users/jbellish/VSProjects/dox-asdlc/helm/dox-asdlc/values.yaml` - Added ES config, deprecated ChromaDB

### Test Results
- 35 new unit tests passing
- Docker Compose configuration validated
- Elasticsearch configured for kNN vector search with 384-dimensional embeddings

### Migration Path
Users should:
1. Set `KNOWLEDGE_STORE_BACKEND=elasticsearch` (now default)
2. Set `ELASTICSEARCH_URL=http://elasticsearch:9200`
3. Migrate documents by re-indexing (no API changes)
4. ChromaDB deprecated, will be removed in 30 days
