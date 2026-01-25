# P02-F05: Tasks

## Task Breakdown

### T01: Create Repo Ingestion Package Structure
**Files:** `src/infrastructure/repo_ingestion/__init__.py`, `config.py`, `models.py`, `src/core/exceptions.py`

- [x] Create `src/infrastructure/repo_ingestion/` directory
- [x] Create `__init__.py` with exports
- [x] Create `config.py` with `IngestionConfig` dataclass
- [x] Create `models.py` with `IngestionResult` dataclass
- [x] Add include_extensions and exclude_patterns to config
- [x] Add `max_file_size_bytes: int = 10_000_000` to config (10MB limit)
- [x] Implement `IngestionConfig.from_env()` method
- [x] Implement `IngestionResult.to_dict()` method
- [x] Add `IngestionError(ASDLCError)` to `src/core/exceptions.py`

**Estimate:** 1h
**Dependencies:** None
**User Story:** US-01
**Status:** COMPLETE

---

### T02: Create Repo Ingestion Package Tests (RED)
**File:** `tests/unit/infrastructure/test_repo_ingestion_config.py`

- [x] Write test for IngestionConfig default values
- [x] Write test for IngestionConfig.from_env() with env vars
- [x] Write test for IngestionResult.to_dict() serialization
- [x] Write test for include_extensions contains expected types
- [x] Write test for exclude_patterns contains expected patterns
- [x] Verify tests fail (RED phase)

**Estimate:** 0.5h
**Dependencies:** T01
**User Story:** US-01
**Status:** COMPLETE

---

### T03: Implement Chunking Logic
**File:** `src/infrastructure/repo_ingestion/ingester.py`

- [x] Create `RepoIngester` class skeleton
- [x] Implement `_chunk_content(content, max_chars)` method
- [x] Handle edge case: content smaller than max_chars
- [x] Split on line boundaries, not mid-line
- [x] Implement overlap_lines for context preservation
- [x] Return list of chunks with proper boundaries

**Estimate:** 1.5h
**Dependencies:** T01
**User Story:** US-02
**Status:** COMPLETE

---

### T04: Create Chunking Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_repo_ingester.py`

- [x] Write test for small file (no chunking needed)
- [x] Write test for large file (multiple chunks)
- [x] Write test for chunk overlap preservation
- [x] Write test for line boundary respect
- [x] Write test for empty content
- [x] Verify tests pass (GREEN phase)

**Estimate:** 1h
**Dependencies:** T03
**User Story:** US-02
**Status:** COMPLETE

---

### T05: Implement File Filtering Logic
**File:** `src/infrastructure/repo_ingestion/ingester.py`

- [x] Implement `_should_include(file_path)` method
- [x] Check file extension against include_extensions
- [x] Check file path against exclude_patterns using fnmatch
- [x] Handle case sensitivity (lowercase comparison)
- [x] Return boolean indicating inclusion

**Estimate:** 1h
**Dependencies:** T03
**User Story:** US-01
**Status:** COMPLETE

---

### T06: Create File Filtering Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_repo_ingester.py`

- [x] Write test for included Python file
- [x] Write test for included Markdown file
- [x] Write test for excluded .pyc file
- [x] Write test for excluded node_modules directory
- [x] Write test for excluded .venv directory
- [x] Write test for file with unknown extension (excluded)
- [x] Verify tests pass (GREEN phase)

**Estimate:** 1h
**Dependencies:** T05
**User Story:** US-01
**Status:** COMPLETE

---

### T07: Implement Single File Ingestion
**File:** `src/infrastructure/repo_ingestion/ingester.py`

- [x] Implement `ingest_file(file_path, repo_path)` method
- [x] Implement `_validate_path_within_repo(file_path, repo_path)` for path traversal prevention (CRITICAL)
- [x] Call path validation BEFORE reading any file content
- [x] Implement `_check_file_size(file_path)` to enforce max_file_size_bytes limit
- [x] Implement `_read_file_content(file_path)` with encoding handling:
  - Try UTF-8 first
  - Fallback to latin-1 if UTF-8 fails (log warning)
  - Skip binary files that fail both encodings
- [x] Calculate relative path from repo_path
- [x] Determine file type from extension
- [x] Chunk content if necessary
- [x] Generate doc_id as `{relative_path}:{chunk_index}`
- [x] Create Document with metadata (file_path, file_type, chunk_index, total_chunks)
- [x] Call store.index_document for each chunk
- [x] Return list of created doc_ids

**Estimate:** 2h
**Dependencies:** T03, T05
**User Story:** US-01, US-02
**Status:** COMPLETE

---

### T08: Create Single File Ingestion Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_repo_ingester.py`

- [x] Write test for ingesting small file (single document)
- [x] Write test for ingesting large file (multiple documents)
- [x] Write test for correct doc_id format
- [x] Write test for correct metadata in indexed document
- [x] Write test for file read error handling
- [x] Mock KnowledgeStore.index_document for unit tests
- [x] Verify tests pass (GREEN phase)

**Estimate:** 1h
**Dependencies:** T07
**User Story:** US-01, US-02
**Status:** COMPLETE

---

### T09: Implement Repository Walk
**File:** `src/infrastructure/repo_ingestion/ingester.py`

- [x] Implement `ingest_repository(repo_path, force_reindex)` method
- [x] Use os.walk to traverse directory tree
- [x] Apply `_should_include()` filter to each file
- [x] Call `ingest_file()` for matching files
- [x] Track files_processed, documents_created, files_skipped
- [x] Collect errors as (file_path, error_message) tuples
- [x] Measure duration_seconds
- [x] Return IngestionResult with all metrics

**Estimate:** 1.5h
**Dependencies:** T07
**User Story:** US-01
**Status:** COMPLETE

---

### T10: Create Repository Walk Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_repo_ingester.py`

- [x] Create test fixture with sample directory structure
- [x] Write test for processing all matching files
- [x] Write test for skipping excluded patterns
- [x] Write test for error collection (mocked read failure)
- [x] Write test for correct result counts
- [x] Write test for duration tracking
- [x] Verify tests pass (GREEN phase)

**Estimate:** 1h
**Dependencies:** T09
**User Story:** US-01
**Status:** COMPLETE

---

### T11: Create KnowledgeStore MCP Server Skeleton
**File:** `src/infrastructure/knowledge_store/mcp_server.py`

- [x] Create `KnowledgeStoreMCPServer` class
- [x] Implement `__init__` with config loading
- [x] Implement `_get_store()` for lazy store initialization
- [x] Implement `get_tool_schemas()` returning tool definitions
- [x] Implement `handle_request()` for JSON-RPC routing
- [x] Implement `run_stdio()` for stdin/stdout communication
- [x] Add main entry point

**Estimate:** 1.5h
**Dependencies:** P02-F04 (existing ElasticsearchStore)
**User Story:** US-07
**Status:** COMPLETE

---

### T12: Create MCP Server Skeleton Tests (RED)
**File:** `tests/unit/infrastructure/test_knowledge_store_mcp.py`

- [x] Write test for tool schema structure
- [x] Write test for initialize request handling
- [x] Write test for tools/list request handling
- [x] Write test for unknown method error
- [x] Verify tests fail (RED phase)

**Estimate:** 0.5h
**Dependencies:** T11
**User Story:** US-07
**Status:** COMPLETE

---

### T13: Implement ks_health Tool
**File:** `src/infrastructure/knowledge_store/mcp_server.py`

- [x] Implement `ks_health()` method
- [x] Call store.health_check()
- [x] Return formatted result with success status
- [x] Handle connection errors gracefully
- [x] Add tool schema to get_tool_schemas()

**Estimate:** 0.5h
**Dependencies:** T11
**User Story:** US-06
**Status:** COMPLETE

---

### T14: Create ks_health Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_knowledge_store_mcp.py`

- [x] Write test for healthy store response
- [x] Write test for unhealthy store response
- [x] Write test for tools/call routing to ks_health
- [x] Mock ElasticsearchStore.health_check()
- [x] Verify tests pass (GREEN phase)

**Estimate:** 0.5h
**Dependencies:** T13
**User Story:** US-06
**Status:** COMPLETE

---

### T15: Implement ks_search Tool
**File:** `src/infrastructure/knowledge_store/mcp_server.py`

- [x] Implement `ks_search(query, top_k, file_type, file_path_prefix)` method
- [x] Build filters dict from file_type and file_path_prefix
- [x] Call store.search() with query, top_k, filters
- [x] Convert SearchResult list to dict format
- [x] Return success status and results array
- [x] Handle search errors gracefully
- [x] Add tool schema to get_tool_schemas()

**Estimate:** 1h
**Dependencies:** T11
**User Story:** US-03
**Status:** COMPLETE

---

### T16: Create ks_search Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_knowledge_store_mcp.py`

- [x] Write test for basic search
- [x] Write test for search with file_type filter
- [x] Write test for search with path_prefix filter
- [x] Write test for search error handling
- [x] Write test for empty results
- [x] Mock ElasticsearchStore.search()
- [x] Verify tests pass (GREEN phase)

**Estimate:** 1h
**Dependencies:** T15
**User Story:** US-03
**Status:** COMPLETE

---

### T17: Implement ks_get Tool
**File:** `src/infrastructure/knowledge_store/mcp_server.py`

- [x] Implement `ks_get(doc_id)` method
- [x] Validate doc_id format
- [x] Call store.get_by_id()
- [x] Return document content and metadata on success
- [x] Return not_found error when document is None
- [x] Add tool schema to get_tool_schemas()

**Estimate:** 0.5h
**Dependencies:** T11
**User Story:** US-04
**Status:** COMPLETE

---

### T18: Create ks_get Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_knowledge_store_mcp.py`

- [x] Write test for successful document retrieval
- [x] Write test for document not found
- [x] Write test for invalid doc_id format
- [x] Mock ElasticsearchStore.get_by_id()
- [x] Verify tests pass (GREEN phase)

**Estimate:** 0.5h
**Dependencies:** T17
**User Story:** US-04
**Status:** COMPLETE

---

### T19: Implement ks_index Tool
**File:** `src/infrastructure/knowledge_store/mcp_server.py`

- [x] Implement `ks_index(doc_id, content, file_path, file_type)` method
- [x] Create Document with provided content and metadata
- [x] Call store.index_document()
- [x] Return success status and doc_id
- [x] Handle indexing errors gracefully
- [x] Add tool schema to get_tool_schemas()

**Estimate:** 0.5h
**Dependencies:** T11
**User Story:** US-05
**Status:** COMPLETE

---

### T20: Create ks_index Tests (RED then GREEN)
**File:** `tests/unit/infrastructure/test_knowledge_store_mcp.py`

- [x] Write test for successful indexing
- [x] Write test for indexing with metadata
- [x] Write test for indexing error handling
- [x] Mock ElasticsearchStore.index_document()
- [x] Verify tests pass (GREEN phase)

**Estimate:** 0.5h
**Dependencies:** T19
**User Story:** US-05
**Status:** COMPLETE

---

### T21: Make MCP Server Skeleton Tests Pass (GREEN)
**File:** `tests/unit/infrastructure/test_knowledge_store_mcp.py`

- [x] Run all MCP server unit tests
- [x] Fix any failing tests from T12
- [x] Ensure all tool methods are properly integrated
- [x] Verify handle_request routes correctly
- [x] All unit tests passing

**Estimate:** 0.5h
**Dependencies:** T13-T20
**User Story:** US-07
**Status:** COMPLETE

---

### T22: Create MCP Launcher Script
**File:** `scripts/knowledge-store/mcp-server.sh`

- [x] Create `scripts/knowledge-store/` directory
- [x] Create launcher script with proper shebang
- [x] Set PYTHONPATH for module imports
- [x] Export ELASTICSEARCH_URL from environment
- [x] Execute python module
- [x] Make script executable

**Estimate:** 0.5h
**Dependencies:** T11
**User Story:** US-07
**Status:** COMPLETE

---

### T23: Update .mcp.json Configuration
**File:** `.mcp.json`

- [ ] Add knowledge-store server configuration
- [ ] Set command to Python path
- [ ] Set args to run mcp_server module
- [ ] Set cwd to project root
- [ ] Set env with PYTHONPATH and ELASTICSEARCH_URL
- [ ] Test Claude Code can connect to server

**Estimate:** 0.5h
**Dependencies:** T22
**User Story:** US-07

---

### T24: Create Ingestion CLI Script
**File:** `scripts/knowledge-store/ingest-repo.sh`

- [ ] Create CLI script for repository ingestion
- [ ] Parse --force flag and repo_path argument
- [ ] Set PYTHONPATH and environment
- [ ] Call Python ingestion entry point
- [ ] Report results to stdout
- [ ] Exit with appropriate code

**Estimate:** 0.5h
**Dependencies:** T09
**User Story:** US-08

---

### T25: Create Ingestion Entry Point
**File:** `src/infrastructure/repo_ingestion/__main__.py`

- [ ] Create __main__.py for CLI execution
- [ ] Parse command line arguments
- [ ] Initialize ElasticsearchStore
- [ ] Initialize RepoIngester
- [ ] Run ingestion
- [ ] Print results
- [ ] Handle errors with appropriate exit codes

**Estimate:** 1h
**Dependencies:** T09
**User Story:** US-08

---

### T26: Integration Test - Full Ingestion
**File:** `tests/integration/infrastructure/test_repo_ingestion.py`

- [ ] Create test with real Elasticsearch (skip if unavailable)
- [ ] Create temporary test repository with sample files
- [ ] Run full ingestion
- [ ] Verify documents are indexed
- [ ] Verify search returns expected results
- [ ] Clean up test index after test
- [ ] **Failure mode tests:**
  - [ ] Test behavior when Elasticsearch is unavailable during ingestion
  - [ ] Test behavior when embedding service fails mid-ingestion
  - [ ] Test graceful handling of partial ingestion failures

**Estimate:** 2h
**Dependencies:** T09, T15
**User Story:** US-01, US-03

---

### T27: Integration Test - MCP Server
**File:** `tests/integration/infrastructure/test_mcp_knowledge_store.py`

- [ ] Create test with real Elasticsearch (skip if unavailable)
- [ ] Test ks_health returns healthy status
- [ ] Test ks_index creates document
- [ ] Test ks_search finds indexed document
- [ ] Test ks_get retrieves document by ID
- [ ] Clean up test index after test
- [ ] **Failure mode tests:**
  - [ ] Test ks_health when Elasticsearch is unavailable
  - [ ] Test ks_index when index creation fails
  - [ ] Test ks_search when Elasticsearch connection drops mid-request
  - [ ] Verify graceful error responses (not crashes) for all failure modes

**Estimate:** 1.5h
**Dependencies:** T21
**User Story:** US-03, US-04, US-05, US-06

---

### T28: Verify MCP Reachability
**File:** Manual test

- [ ] Start Elasticsearch via Docker Compose
- [ ] Verify MCP server starts without error
- [ ] Open separate terminal with Claude Code
- [ ] Verify ks_health tool is accessible
- [ ] Verify tools/list returns all 4 tools
- [ ] Document any configuration issues

**Estimate:** 0.5h
**Dependencies:** T23
**User Story:** US-07

---

### T29: Run Repository Ingestion
**File:** Manual test

- [ ] Start Elasticsearch via Docker Compose
- [ ] Run ingestion script on dox-asdlc repository
- [ ] Verify no errors in ingestion output
- [ ] Verify document count matches expectations
- [ ] Note any files that failed to ingest

**Estimate:** 0.5h
**Dependencies:** T24, T25
**User Story:** US-01, US-08

---

### T30: Exploratory Search Verification
**File:** Manual test

- [ ] Query "KnowledgeStore protocol" - expect interfaces.py
- [ ] Query "MCP server coordination" - expect mcp_server.py
- [ ] Query "Docker Compose elasticsearch" - expect docker-compose.yml
- [ ] Query "HITL gate approval" - expect hitl-gates.md
- [ ] Verify scores are reasonable (> 0.5)
- [ ] Document any relevance issues

**Estimate:** 0.5h
**Dependencies:** T29
**User Story:** US-09

---

### T31: Code Review Preparation
**File:** All implementation files

- [ ] Run ./tools/lint.sh on new files
- [ ] Fix any linting errors
- [ ] Run ./tools/test.sh on new tests
- [ ] Verify all tests pass
- [ ] Prepare summary of changes for reviewer

**Estimate:** 0.5h
**Dependencies:** T26, T27
**User Story:** All

---

## Progress

- Started: 2026-01-25
- Tasks Complete: 18/31 (T01-T10, T11-T18)
- Percentage: 58%
- Status: IN PROGRESS
- Blockers: None
- Last Update: 2026-01-25 - Completed RepoIngester service (Track A T01-T10), 47 unit tests passing

## Dependency Graph

```
T01 (package structure)
  |
  +---> T02 (config tests)
  |
  +---> T03 (chunking) ----> T04 (chunk tests)
  |       |
  |       +---> T05 (filtering) ----> T06 (filter tests)
  |               |
  |               +---> T07 (single file) ----> T08 (file tests)
  |                       |
  |                       +---> T09 (repo walk) ----> T10 (walk tests)
  |                               |
  |                               +---> T24 (CLI script)
  |                               |
  |                               +---> T25 (entry point)
  |                               |
  |                               +---> T26 (integration test)
  |
  +---> T11 (MCP skeleton)
          |
          +---> T12 (skeleton tests)
          |
          +---> T13 (ks_health) ----> T14 (health tests)
          |
          +---> T15 (ks_search) ----> T16 (search tests)
          |
          +---> T17 (ks_get) ----> T18 (get tests)
          |
          +---> T19 (ks_index) ----> T20 (index tests)
          |
          +---> T21 (make tests pass)
          |       |
          |       +---> T22 (launcher script)
          |               |
          |               +---> T23 (.mcp.json)
          |                       |
          |                       +---> T28 (manual reachability)
          |
          +---> T27 (MCP integration test)

T29 (run ingestion) depends on T24, T25, T28
T30 (exploratory search) depends on T29
T31 (code review prep) depends on T26, T27
```

## Parallel Tracks

The following can be developed in parallel:

**Track A: Ingestion Service (T01-T10, T24-T26)**
- Core ingestion logic
- CLI tooling
- Integration tests

**Track B: MCP Server (T11-T23, T27-T28)**
- MCP protocol implementation
- Tool implementations
- Claude Code integration

## Estimates Summary

| Task | Estimate | Cumulative |
|------|----------|------------|
| T01 | 1.0h | 1.0h |
| T02 | 0.5h | 1.5h |
| T03 | 1.5h | 3.0h |
| T04 | 1.0h | 4.0h |
| T05 | 1.0h | 5.0h |
| T06 | 1.0h | 6.0h |
| T07 | 2.0h | 8.0h |
| T08 | 1.0h | 9.0h |
| T09 | 1.5h | 10.5h |
| T10 | 1.0h | 11.5h |
| T11 | 1.5h | 13.0h |
| T12 | 0.5h | 13.5h |
| T13 | 0.5h | 14.0h |
| T14 | 0.5h | 14.5h |
| T15 | 1.0h | 15.5h |
| T16 | 1.0h | 16.5h |
| T17 | 0.5h | 17.0h |
| T18 | 0.5h | 17.5h |
| T19 | 0.5h | 18.0h |
| T20 | 0.5h | 18.5h |
| T21 | 0.5h | 19.0h |
| T22 | 0.5h | 19.5h |
| T23 | 0.5h | 20.0h |
| T24 | 0.5h | 20.5h |
| T25 | 1.0h | 21.5h |
| T26 | 2.0h | 23.5h |
| T27 | 1.5h | 25.0h |
| T28 | 0.5h | 25.5h |
| T29 | 0.5h | 26.0h |
| T30 | 0.5h | 26.5h |
| T31 | 0.5h | 27.0h |

**Total Estimated Effort:** 27.0 hours (3-4 days)

## Notes

- T28-T30 are manual verification tasks requiring user interaction
- Integration tests (T26, T27) require running Elasticsearch
- MCP server follows pattern from coordination/mcp_server.py
- All tasks follow TDD: write tests (RED), implement (GREEN), refactor
