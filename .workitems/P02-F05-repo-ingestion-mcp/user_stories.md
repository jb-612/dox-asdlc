# P02-F05: User Stories

## Epic Summary

As a Claude Code user, I want to semantically search the codebase via MCP tools so that agents have relevant context when performing development tasks.

This feature enables:
1. Ingestion of repository code and documentation into the Elasticsearch KnowledgeStore
2. MCP server exposing search, retrieval, and indexing operations
3. Integration with Claude Code for agent-accessible semantic search

---

## US-01: Ingest Repository Files

**As** a developer,
**I want** to ingest all source code and documentation from the repository into the KnowledgeStore,
**So that** Claude agents can search and retrieve relevant context.

### Acceptance Criteria

- [ ] Repository ingestion processes all files matching include patterns
- [ ] Binary files, dependencies, and build artifacts are excluded
- [ ] Each file is indexed with its relative path and file type metadata
- [ ] Ingestion completes without errors on the current repository
- [ ] Ingestion result reports files processed, documents created, and any errors

### Test Cases

```gherkin
Scenario: Ingest repository successfully
  Given a repository with Python and Markdown files
  When I run the ingester on the repository root
  Then all .py and .md files are indexed
  And node_modules and __pycache__ directories are skipped
  And IngestionResult shows correct counts

Scenario: Skip excluded file patterns
  Given a repository containing .pyc files and .venv directory
  When I run the ingester on the repository root
  Then .pyc files are not indexed
  And files under .venv are not indexed

Scenario: Report ingestion errors gracefully
  Given a file that cannot be read (permission denied)
  When I run the ingester
  Then the error is captured in IngestionResult.errors
  And other files continue to be processed
```

---

## US-02: Chunk Large Files

**As** a developer,
**I want** large files to be split into smaller chunks for indexing,
**So that** embeddings remain effective and search results are more precise.

### Acceptance Criteria

- [ ] Files exceeding max_chunk_size are split into multiple documents
- [ ] Each chunk has a unique doc_id with chunk index (e.g., `file.py:0`, `file.py:1`)
- [ ] Chunks have overlap to preserve context at boundaries
- [ ] Chunk metadata includes chunk_index and total_chunks
- [ ] Small files (under max_chunk_size) remain as single documents

### Test Cases

```gherkin
Scenario: Chunk large file
  Given a file with 10,000 characters
  And max_chunk_size is 4000
  When the file is ingested
  Then 3 documents are created
  And doc_ids are file.py:0, file.py:1, file.py:2
  And metadata shows total_chunks=3

Scenario: Preserve small file as single document
  Given a file with 2,000 characters
  And max_chunk_size is 4000
  When the file is ingested
  Then 1 document is created
  And doc_id is file.py:0
  And metadata shows total_chunks=1

Scenario: Overlap between chunks
  Given a file that requires chunking
  And overlap_lines is 5
  When the file is chunked
  Then the last 5 lines of chunk N appear at the start of chunk N+1
```

---

## US-03: Search via MCP Tool

**As** a Claude agent,
**I want** to search the KnowledgeStore using the ks_search MCP tool,
**So that** I can find relevant code and documentation for my current task.

### Acceptance Criteria

- [ ] ks_search tool accepts query, top_k, and optional filters
- [ ] Results include doc_id, content, score, and metadata
- [ ] Results are ordered by relevance (highest score first)
- [ ] File type filter narrows results to specific extensions
- [ ] Path prefix filter narrows results to specific directories

### Test Cases

```gherkin
Scenario: Basic semantic search
  Given documents are indexed in KnowledgeStore
  When I call ks_search with query "KnowledgeStore interface"
  Then results contain documents mentioning KnowledgeStore
  And results are sorted by score descending

Scenario: Search with file type filter
  Given Python and Markdown files are indexed
  When I call ks_search with query "protocol" and file_type=".py"
  Then only Python files are returned
  And Markdown files are excluded

Scenario: Search with path prefix filter
  Given files from src/ and tests/ are indexed
  When I call ks_search with query "test" and file_path_prefix="tests/"
  Then only files under tests/ are returned
```

---

## US-04: Retrieve Document by ID

**As** a Claude agent,
**I want** to retrieve a specific document by its ID using the ks_get MCP tool,
**So that** I can read the full content of a file chunk found in search results.

### Acceptance Criteria

- [ ] ks_get tool accepts doc_id parameter
- [ ] Returns full document content and metadata on success
- [ ] Returns not_found error for non-existent doc_id
- [ ] Doc_id format is validated (path:chunk_index)

### Test Cases

```gherkin
Scenario: Retrieve existing document
  Given a document with doc_id "src/core/interfaces.py:0" exists
  When I call ks_get with doc_id "src/core/interfaces.py:0"
  Then the full content is returned
  And metadata includes file_path and file_type

Scenario: Retrieve non-existent document
  Given no document with doc_id "nonexistent.py:0" exists
  When I call ks_get with doc_id "nonexistent.py:0"
  Then success is false
  And error message indicates document not found
```

---

## US-05: Index Document via MCP Tool

**As** a Claude agent,
**I want** to index a new document using the ks_index MCP tool,
**So that** dynamically generated content can be added to the KnowledgeStore.

### Acceptance Criteria

- [ ] ks_index tool accepts doc_id, content, and optional metadata
- [ ] Document is indexed with embedding generated from content
- [ ] Existing document with same doc_id is updated (upsert)
- [ ] Returns the indexed doc_id on success

### Test Cases

```gherkin
Scenario: Index new document
  Given no document with doc_id "dynamic/context.md:0" exists
  When I call ks_index with doc_id and content
  Then success is true
  And the document can be retrieved via ks_get

Scenario: Update existing document
  Given a document with doc_id "notes.md:0" exists
  When I call ks_index with the same doc_id and new content
  Then the document content is updated
  And embedding is regenerated
```

---

## US-06: Health Check via MCP Tool

**As** a system administrator,
**I want** to check KnowledgeStore health using the ks_health MCP tool,
**So that** I can verify connectivity before running operations.

### Acceptance Criteria

- [ ] ks_health tool returns status, backend name, and cluster info
- [ ] Returns "healthy" when Elasticsearch is reachable
- [ ] Returns "unhealthy" with error when connection fails
- [ ] No authentication credentials are exposed in response

### Test Cases

```gherkin
Scenario: Healthy KnowledgeStore
  Given Elasticsearch is running and reachable
  When I call ks_health
  Then status is "healthy"
  And backend is "elasticsearch"
  And cluster_status is "green" or "yellow"

Scenario: Unhealthy KnowledgeStore
  Given Elasticsearch is not running
  When I call ks_health
  Then status is "unhealthy"
  And error message describes the connection failure
```

---

## US-07: MCP Server Integration with Claude Code

**As** a Claude Code user,
**I want** the KnowledgeStore MCP server to be configured in my project,
**So that** MCP tools are automatically available in Claude sessions.

### Acceptance Criteria

- [ ] `.mcp.json` includes knowledge-store server configuration
- [ ] Server starts successfully when Claude Code connects
- [ ] All four tools (ks_search, ks_get, ks_index, ks_health) are listed
- [ ] Tool schemas include proper descriptions and parameter definitions

### Test Cases

```gherkin
Scenario: MCP server lists tools
  Given the KnowledgeStore MCP server is running
  When Claude Code sends tools/list request
  Then response includes ks_search, ks_get, ks_index, ks_health
  And each tool has valid inputSchema

Scenario: MCP server handles initialize
  Given the KnowledgeStore MCP server is running
  When Claude Code sends initialize request
  Then response includes protocolVersion and capabilities
  And capabilities includes tools
```

---

## US-08: CLI Script for Repository Ingestion

**As** a developer,
**I want** a CLI script to trigger repository ingestion,
**So that** I can easily index the codebase without writing code.

### Acceptance Criteria

- [ ] Script accepts repository path as argument
- [ ] Script reports progress and results to stdout
- [ ] Script exits with 0 on success, non-zero on failure
- [ ] Script supports --force flag to re-index all files

### Test Cases

```gherkin
Scenario: Run ingestion script
  Given Elasticsearch is running
  When I run ./scripts/knowledge-store/ingest-repo.sh /path/to/repo
  Then ingestion completes
  And result summary is printed
  And exit code is 0

Scenario: Force re-index
  Given repository was previously indexed
  When I run ./scripts/knowledge-store/ingest-repo.sh --force /path/to/repo
  Then all files are re-indexed
  And existing documents are updated
```

---

## US-09: Exploratory Search Verification

**As** a developer,
**I want** to run sample searches after ingestion,
**So that** I can verify the KnowledgeStore contains expected content.

### Acceptance Criteria

- [ ] Sample queries return relevant results
- [ ] Search for "KnowledgeStore protocol" returns interfaces.py
- [ ] Search for "MCP server" returns coordination/mcp_server.py
- [ ] Search for "Docker Compose" returns relevant yaml/markdown files

### Test Cases

```gherkin
Scenario: Verify semantic relevance
  Given the repository has been ingested
  When I search for "elastic search vector store"
  Then results include elasticsearch_store.py
  And score is above 0.5

Scenario: Verify file type filtering works
  Given the repository has been ingested
  When I search for "deployment" with file_type=".yaml"
  Then only YAML files are returned
```

---

## Priority and Dependencies

| Story | Priority | Dependencies |
|-------|----------|--------------|
| US-01 | High | P02-F04 (Elasticsearch) |
| US-02 | High | US-01 |
| US-03 | High | US-01 |
| US-04 | Medium | US-01 |
| US-05 | Medium | US-01 |
| US-06 | Medium | P02-F04 |
| US-07 | High | US-03, US-04, US-05, US-06 |
| US-08 | Medium | US-01 |
| US-09 | Low | US-07, US-08 |
