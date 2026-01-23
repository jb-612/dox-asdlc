# P01-F03: KnowledgeStore Interface and ChromaDB Backend - Tasks

## Overview

This task breakdown covers implementing the KnowledgeStore interface and ChromaDB backend for the RAG abstraction layer.

## Dependencies

- **P01-F01**: Infrastructure setup - COMPLETE
- **P01-F02**: Bash tool abstraction layer - COMPLETE

## Task List

### T01: Add KnowledgeStore exceptions to exception hierarchy

**Model**: haiku
**Description**: Extend the existing exception hierarchy with KnowledgeStore-specific exceptions.

**Subtasks**:
- [x] Add `KnowledgeStoreError` base exception
- [x] Add `DocumentNotFoundError` exception
- [x] Add `IndexingError` exception
- [x] Add `SearchError` exception
- [x] Add `EmbeddingError` exception
- [x] Add `BackendConnectionError` exception
- [x] Write unit tests for exception hierarchy

**Acceptance Criteria**:
- [x] All exceptions inherit from appropriate base classes
- [x] Exceptions include `message` and `details` fields
- [x] Exceptions support JSON serialization via `to_dict()`
- [x] Unit tests verify inheritance chain

**Test Cases**:
- [x] Test exception instantiation with message
- [x] Test exception instantiation with details
- [x] Test to_dict() serialization
- [x] Test inheritance from ASDLCError

**Estimate**: 30min

---

### T02: Define data models (Document, SearchResult)

**Model**: haiku
**Description**: Create dataclass models for documents and search results.

**Subtasks**:
- [x] Create `src/infrastructure/knowledge_store/` directory
- [x] Create `models.py` with `Document` dataclass
- [x] Create `SearchResult` dataclass
- [x] Add JSON serialization methods
- [x] Write unit tests for models

**Acceptance Criteria**:
- [x] `Document` has fields: `doc_id`, `content`, `metadata`, `embedding`
- [x] `SearchResult` has fields: `doc_id`, `content`, `metadata`, `score`, `source`
- [x] Metadata supports str, int, float, bool values
- [x] Models are immutable (frozen dataclass)
- [x] Unit tests verify field types and serialization

**Test Cases**:
- [x] Test Document creation with all fields
- [x] Test Document creation with minimal fields
- [x] Test SearchResult creation and score validation
- [x] Test JSON serialization round-trip
- [x] Test metadata type validation

**Estimate**: 45min

---

### T03: Define KnowledgeStore protocol interface

**Model**: haiku
**Description**: Create the abstract interface that all backends must implement.

**Subtasks**:
- [x] Create `src/core/interfaces.py` (or add to existing)
- [x] Define `KnowledgeStore` Protocol class
- [x] Define `index_document` method signature
- [x] Define `search` method signature
- [x] Define `get_by_id` method signature
- [x] Define `delete` method signature
- [x] Define `health_check` method signature
- [x] Add comprehensive docstrings
- [x] Write unit tests for protocol compliance

**Acceptance Criteria**:
- [x] Protocol is defined using `typing.Protocol`
- [x] All methods are `async`
- [x] Type hints are complete and mypy-compliant
- [x] Docstrings follow Google style
- [x] Protocol can be used for static type checking

**Test Cases**:
- [x] Test protocol defines required methods
- [x] Test mypy compliance with protocol
- [x] Test that non-compliant class fails type check

**Estimate**: 45min

---

### T04: Create KnowledgeStore configuration

**Model**: haiku
**Description**: Add configuration dataclass for KnowledgeStore settings.

**Subtasks**:
- [x] Create `src/infrastructure/knowledge_store/config.py`
- [x] Define `KnowledgeStoreConfig` dataclass
- [x] Implement `from_env()` class method
- [x] Add configuration to main `AppConfig`
- [x] Write unit tests for configuration

**Acceptance Criteria**:
- [x] Config includes: `host`, `port`, `collection_name`, `embedding_model`
- [x] Config loads from environment variables with defaults
- [x] Config integrates with existing `AppConfig` pattern
- [x] Missing required config raises `ConfigurationError`
- [x] Unit tests verify default values and env loading

**Test Cases**:
- [x] Test default configuration values
- [x] Test configuration from environment variables
- [x] Test configuration validation
- [x] Test integration with AppConfig

**Estimate**: 30min

---

### T05: Update Docker Compose with ChromaDB service

**Model**: haiku
**Description**: Add ChromaDB to the infrastructure container configuration.

**Subtasks**:
- [x] Add ChromaDB service to `docker/docker-compose.yml`
- [x] Configure persistent volume for ChromaDB data
- [x] Add health check for ChromaDB
- [x] Configure network connectivity
- [x] Update environment variables for other services
- [x] Test container startup

**Acceptance Criteria**:
- [x] ChromaDB service runs on port 8000 (internal)
- [x] Data persists across container restarts
- [x] Health check verifies ChromaDB is responding
- [x] Orchestrator and workers can reach ChromaDB
- [x] `docker compose up` starts all services

**Test Cases**:
- [x] Test docker compose config is valid
- [x] Test ChromaDB health check endpoint
- [x] Test volume persistence (manual verification)
- [x] Test network connectivity from other containers

**Estimate**: 1hr

---

### T06: Add ChromaDB and embedding dependencies

**Model**: haiku
**Description**: Update requirements with ChromaDB and sentence-transformers.

**Subtasks**:
- [x] Add `chromadb` to requirements.txt
- [x] Add `sentence-transformers` to requirements.txt
- [x] Update `pyproject.toml` with dependency groups
- [x] Verify dependencies install correctly
- [x] Test import in Python

**Acceptance Criteria**:
- [x] `pip install -r requirements.txt` succeeds
- [x] `import chromadb` works
- [x] `import sentence_transformers` works
- [x] No dependency conflicts
- [x] Docker build includes new dependencies

**Test Cases**:
- [x] Test dependency installation
- [x] Test imports in Python shell
- [x] Test Docker build with new dependencies

**Estimate**: 30min

---

### T07: Implement ChromaDB client wrapper

**Model**: sonnet
**Description**: Create the ChromaDB backend implementation of KnowledgeStore.

**Subtasks**:
- [x] Create `src/infrastructure/knowledge_store/chromadb_store.py`
- [x] Implement `__init__` with connection setup
- [x] Implement `index_document` method
- [x] Implement `search` method
- [x] Implement `get_by_id` method
- [x] Implement `delete` method
- [x] Implement `health_check` method
- [x] Handle ChromaDB-specific errors
- [x] Write comprehensive unit tests (mocked)

**Acceptance Criteria**:
- [x] Class implements `KnowledgeStore` protocol
- [x] Connects to ChromaDB via HTTP client
- [x] Handles connection errors with `BackendConnectionError`
- [x] Generates embeddings using configured model
- [x] All methods have proper error handling
- [x] Unit tests cover all methods and error cases

**Test Cases**:
- [x] Test successful index_document
- [x] Test index_document with existing doc (update)
- [x] Test search returns ranked results
- [x] Test search with filters
- [x] Test search with empty results
- [x] Test get_by_id found
- [x] Test get_by_id not found
- [x] Test delete success
- [x] Test delete not found
- [x] Test health_check healthy
- [x] Test health_check unhealthy
- [x] Test connection error handling

**Estimate**: 2hr

---

### T08: Implement embedding function wrapper

**Model**: haiku
**Description**: Create a wrapper for embedding generation that works with ChromaDB.

**Subtasks**:
- [x] Create embedding function class compatible with ChromaDB
- [x] Support sentence-transformers models
- [x] Handle embedding errors gracefully
- [x] Add caching for repeated texts (optional)
- [x] Write unit tests

**Acceptance Criteria**:
- [x] Embedding function generates 384-dimensional vectors (MiniLM)
- [x] Works with ChromaDB's embedding function interface
- [x] Raises `EmbeddingError` on failure
- [x] Model is configurable via config
- [x] Unit tests verify embedding generation

**Test Cases**:
- [x] Test embedding generation for single text
- [x] Test embedding generation for batch
- [x] Test embedding dimensions
- [x] Test error handling for invalid input
- [x] Test model loading

**Estimate**: 1hr

---

### T09: Create factory function for KnowledgeStore

**Model**: haiku
**Description**: Implement factory function for obtaining configured KnowledgeStore instance.

**Subtasks**:
- [x] Create `src/infrastructure/knowledge_store/factory.py`
- [x] Implement `get_knowledge_store()` async function
- [x] Support singleton pattern for connection reuse
- [x] Support async context manager
- [x] Write unit tests

**Acceptance Criteria**:
- [x] Factory returns `ChromaDBStore` instance
- [x] Factory reads config from environment
- [x] Multiple calls return same instance (singleton)
- [x] Factory handles configuration errors
- [x] Unit tests verify factory behavior

**Test Cases**:
- [x] Test factory returns KnowledgeStore instance
- [x] Test singleton behavior
- [x] Test configuration from environment
- [x] Test error handling for missing config

**Estimate**: 45min

---

### T10: Write integration tests with real ChromaDB

**Model**: sonnet
**Description**: Create integration tests that run against actual ChromaDB instance.

**Subtasks**:
- [x] Create `tests/integration/test_chromadb_store.py`
- [x] Test full index/search/retrieve/delete cycle
- [x] Test search relevance ordering
- [x] Test metadata filtering
- [x] Test concurrent operations
- [x] Add pytest fixtures for test data

**Acceptance Criteria**:
- [x] Tests run against Docker ChromaDB
- [x] Tests clean up after themselves
- [x] Tests verify actual semantic search works
- [x] Tests pass in CI/CD environment
- [x] Test coverage > 80%

**Test Cases**:
- [x] Test index and immediate search
- [x] Test multiple document indexing
- [x] Test search relevance (similar docs ranked higher)
- [x] Test metadata filter accuracy
- [x] Test document update (re-index)
- [x] Test delete and verify removal
- [x] Test health check against real server

**Estimate**: 1.5hr

---

### T11: Update infrastructure health checks

**Model**: haiku
**Description**: Add KnowledgeStore health check to infrastructure monitoring.

**Subtasks**:
- [x] Update `src/infrastructure/health.py` with knowledge store check
- [x] Add KnowledgeStore status to health endpoint response
- [x] Handle unavailable knowledge store gracefully
- [x] Write unit tests

**Acceptance Criteria**:
- [x] Health endpoint includes knowledge store status
- [x] Unhealthy knowledge store doesn't crash health check
- [x] Status includes connection details
- [x] Unit tests verify health check behavior

**Test Cases**:
- [x] Test health check with healthy knowledge store
- [x] Test health check with unhealthy knowledge store
- [x] Test health response format

**Estimate**: 30min

---

### T12: Create module exports and documentation

**Model**: haiku
**Description**: Set up clean module exports and add documentation.

**Subtasks**:
- [x] Create `src/infrastructure/knowledge_store/__init__.py` with exports
- [x] Add docstrings to all public functions
- [x] Create usage examples in docstrings
- [x] Update design.md with final implementation notes

**Acceptance Criteria**:
- [x] `from src.infrastructure.knowledge_store import KnowledgeStore, get_knowledge_store` works
- [x] All public APIs have docstrings
- [x] Examples are accurate and runnable
- [x] Documentation matches implementation

**Test Cases**:
- [x] Test module imports
- [x] Test exported symbols match documentation

**Estimate**: 30min

---

## Progress

- **Started**: 2026-01-22
- **Tasks Complete**: 12/12
- **Percentage**: 100%
- **Status**: COMPLETE
- **Blockers**: None

## Task Summary

| Task | Description | Estimate | Status |
|------|-------------|----------|--------|
| T01 | Add KnowledgeStore exceptions | 30 min | [x] |
| T02 | Define data models | 45 min | [x] |
| T03 | Define KnowledgeStore protocol | 45 min | [x] |
| T04 | Create configuration | 30 min | [x] |
| T05 | Update Docker Compose with ChromaDB | 1 hr | [x] |
| T06 | Add dependencies | 30 min | [x] |
| T07 | Implement ChromaDB backend | 2 hr | [x] |
| T08 | Implement embedding wrapper | 1 hr | [x] |
| T09 | Create factory function | 45 min | [x] |
| T10 | Write integration tests | 1.5 hr | [x] |
| T11 | Update health checks | 30 min | [x] |
| T12 | Module exports and documentation | 30 min | [x] |

**Total Estimated Time**: 10 hours

## Completion Checklist

- [x] All tasks in Task List are marked complete
- [x] All unit tests pass: `./tools/test.sh tests/unit/`
- [x] All integration tests pass: `./tools/test.sh tests/integration/`
- [x] E2E tests pass: `./tools/e2e.sh`
- [x] Linter passes: `./tools/lint.sh src/`
- [x] No type errors: `mypy src/`
- [x] Documentation updated
- [x] Interface contracts verified against design.md
- [x] Progress marked as 100% in tasks.md

## Notes

### Task Dependencies

```
T01 ────┐
        ├──► T03 ──► T07 ──► T09 ──► T10
T02 ────┘              │
                       ▼
T04 ──────────────► T07
                       │
T05 ──────────────►────┘
T06 ──────────────►────┘
                       │
T08 ──────────────►────┘

T11 depends on T07
T12 depends on all others
```

### Implementation Order

1. Foundation: T01, T02 (parallel)
2. Interface: T03
3. Infrastructure: T04, T05, T06 (parallel)
4. Implementation: T07, T08
5. Factory: T09
6. Testing: T10, T11 (parallel)
7. Documentation: T12

### Testing Strategy

- Unit tests mock ChromaDB client for fast execution
- Integration tests use real ChromaDB in Docker
- Test fixtures provide sample documents and queries
- Cleanup ensures test isolation
