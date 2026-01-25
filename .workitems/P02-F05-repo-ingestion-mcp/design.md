# P02-F05: Repo Ingestion and KnowledgeStore MCP Server

## Technical Design

### Overview

This feature enables ingestion of repository code and documentation into the Elasticsearch KnowledgeStore, and exposes the KnowledgeStore operations via MCP (Model Context Protocol) for Claude Code access. This allows Claude agents to semantically search and retrieve relevant code and documentation during development tasks.

**Goals:**
- Create a repository ingestion service that walks the codebase and indexes files
- Implement chunking strategy for large files to optimize embedding efficiency
- Build an MCP server exposing KnowledgeStore operations (search, get, index, health)
- Integrate with Claude Code via `.mcp.json` configuration
- Enable semantic code search for agent context enrichment

### Architecture Reference

From `docs/System_Design.md` Section 5.3:
- KnowledgeStore interface: `index_document`, `search`, `get_by_id`, `delete`, `health_check`
- Prototype backend: Elasticsearch with dense_vector (384 dims, all-MiniLM-L6-v2)

From `docs/Main_Features.md` Section D.14:
- Single retrieval interface for context enrichment
- Agents query without coupling to specific implementation

### Dependencies

**Internal:**
- P02-F04: Elasticsearch KnowledgeStore (COMPLETE) - Required
  - `src/infrastructure/knowledge_store/elasticsearch_store.py`
  - `src/infrastructure/knowledge_store/embedding_service.py`
  - `src/infrastructure/knowledge_store/models.py` (Document, SearchResult)
- P01-F04: CLI Coordination MCP (COMPLETE) - Pattern reference
  - `src/infrastructure/coordination/mcp_server.py`

**External:**
- `elasticsearch[async]>=8.10.0` - Already in requirements
- `sentence-transformers>=2.2.0` - Already in requirements

### Components

#### 1. Repo Ingester Service (`src/infrastructure/repo_ingestion/ingester.py`)

```python
class RepoIngester:
    """Service for ingesting repository files into KnowledgeStore.

    Walks the repository directory tree, filters files by extension,
    chunks large files, and indexes content with metadata.
    """

    def __init__(
        self,
        store: KnowledgeStore,
        config: IngestionConfig,
    ) -> None:
        """Initialize with KnowledgeStore and configuration."""

    async def ingest_repository(
        self,
        repo_path: str,
        force_reindex: bool = False,
    ) -> IngestionResult:
        """Ingest all matching files from repository.

        Args:
            repo_path: Absolute path to repository root.
            force_reindex: If True, re-index even if document exists.

        Returns:
            IngestionResult with counts and any errors.
        """

    async def ingest_file(
        self,
        file_path: str,
        repo_path: str,
    ) -> list[str]:
        """Ingest a single file, returning document IDs created.

        Large files are chunked into multiple documents.
        """

    def _should_include(self, file_path: str) -> bool:
        """Check if file should be included based on filters."""

    def _chunk_content(
        self,
        content: str,
        max_chars: int = 4000,
    ) -> list[str]:
        """Split content into chunks respecting line boundaries."""
```

#### 2. Ingestion Configuration (`src/infrastructure/repo_ingestion/config.py`)

```python
@dataclass(frozen=True)
class IngestionConfig:
    """Configuration for repository ingestion.

    Attributes:
        include_extensions: File extensions to include.
        exclude_patterns: Glob patterns for directories/files to exclude.
        max_chunk_size: Maximum characters per document chunk.
        overlap_lines: Number of lines to overlap between chunks.
        max_file_size_bytes: Maximum file size in bytes (files exceeding this are skipped).
    """

    include_extensions: frozenset[str] = frozenset({
        ".py", ".ts", ".js", ".tsx", ".jsx",
        ".md", ".yaml", ".yml", ".json",
        ".sh", ".toml", ".html", ".css",
    })

    exclude_patterns: frozenset[str] = frozenset({
        "**/node_modules/**",
        "**/__pycache__/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/*.pyc",
        "**/*.whl",
        "**/*.tar*",
        "**/*.zip",
        "**/*.png",
        "**/*.jpg",
        "**/*.gif",
        "**/*.ico",
        "**/*.egg-info/**",
        "**/.venv/**",
        "**/venv/**",
    })

    max_chunk_size: int = 4000
    overlap_lines: int = 5
    max_file_size_bytes: int = 10_000_000  # 10MB limit

    @classmethod
    def from_env(cls) -> IngestionConfig:
        """Create configuration from environment variables."""
```

#### 3. Ingestion Result Model (`src/infrastructure/repo_ingestion/models.py`)

```python
@dataclass(frozen=True)
class IngestionResult:
    """Result of repository ingestion operation.

    Attributes:
        files_processed: Number of files processed.
        documents_created: Number of documents indexed.
        files_skipped: Number of files skipped (excluded or unchanged).
        errors: List of (file_path, error_message) tuples.
        duration_seconds: Time taken for ingestion.
    """

    files_processed: int
    documents_created: int
    files_skipped: int
    errors: list[tuple[str, str]]
    duration_seconds: float

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
```

#### 4. KnowledgeStore MCP Server (`src/infrastructure/knowledge_store/mcp_server.py`)

Following the pattern from `src/infrastructure/coordination/mcp_server.py`:

```python
class KnowledgeStoreMCPServer:
    """MCP server providing KnowledgeStore tools.

    Exposes tools for Claude Code to interact with the KnowledgeStore:
    - ks_search: Semantic search for documents
    - ks_get: Retrieve document by ID
    - ks_index: Index a document
    - ks_health: Check KnowledgeStore health
    - ks_ingest_repo: Ingest repository (optional, advanced)
    """

    def __init__(self) -> None:
        """Initialize the MCP server."""
        self._store: ElasticsearchStore | None = None
        self._config = KnowledgeStoreConfig.from_env()

    async def _get_store(self) -> ElasticsearchStore:
        """Get or create the KnowledgeStore client."""

    async def ks_search(
        self,
        query: str,
        top_k: int = 10,
        file_type: str | None = None,
        file_path_prefix: str | None = None,
    ) -> dict[str, Any]:
        """Search for documents similar to the query.

        Args:
            query: Natural language search query.
            top_k: Maximum number of results.
            file_type: Optional filter by file extension.
            file_path_prefix: Optional filter by path prefix.

        Returns:
            Dict with success status and search results.
        """

    async def ks_get(self, doc_id: str) -> dict[str, Any]:
        """Retrieve a document by its ID.

        Args:
            doc_id: The document ID (format: path/to/file.py:chunk_0)

        Returns:
            Dict with success status and document content.
        """

    async def ks_index(
        self,
        doc_id: str,
        content: str,
        file_path: str | None = None,
        file_type: str | None = None,
    ) -> dict[str, Any]:
        """Index a document in the KnowledgeStore.

        Args:
            doc_id: Unique document identifier.
            content: Document content text.
            file_path: Optional file path metadata.
            file_type: Optional file type metadata.

        Returns:
            Dict with success status and indexed doc_id.
        """

    async def ks_health(self) -> dict[str, Any]:
        """Check KnowledgeStore health status.

        Returns:
            Dict with health information (status, backend, cluster info).
        """

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Get MCP tool schema definitions."""

    async def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """Handle an incoming MCP request."""

    async def run_stdio(self) -> None:
        """Run the MCP server using stdio transport."""
```

#### 5. Document ID Convention

Document IDs follow a consistent format for retrieval:
```
{relative_path}:{chunk_index}
```

Examples:
- `src/core/interfaces.py:0` - First (or only) chunk
- `src/infrastructure/knowledge_store/elasticsearch_store.py:1` - Second chunk
- `docs/System_Design.md:3` - Fourth chunk of a large file

#### 6. Metadata Schema

Each indexed document includes metadata:
```json
{
  "file_path": "src/core/interfaces.py",
  "file_type": ".py",
  "chunk_index": 0,
  "total_chunks": 1,
  "repo_path": "/Users/jbellish/VSProjects/dox-asdlc",
  "indexed_at": "2026-01-25T12:00:00Z"
}
```

### MCP Configuration

#### Server Launcher Script (`scripts/knowledge-store/mcp-server.sh`)

```bash
#!/bin/bash
# MCP server launcher for KnowledgeStore tools
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

exec python3 -m src.infrastructure.knowledge_store.mcp_server
```

#### Claude Code Configuration (`.mcp.json` update)

```json
{
  "mcpServers": {
    "redis": { ... },
    "coordination": { ... },
    "knowledge-store": {
      "command": "/Users/jbellish/VSProjects/dox-asdlc/.venv/bin/python",
      "args": ["-m", "src.infrastructure.knowledge_store.mcp_server"],
      "cwd": "/Users/jbellish/VSProjects/dox-asdlc",
      "env": {
        "PYTHONPATH": "/Users/jbellish/VSProjects/dox-asdlc",
        "ELASTICSEARCH_URL": "http://localhost:9200"
      }
    }
  }
}
```

### Chunking Strategy

**Why chunking?**
- Embedding models have optimal input size (~256-512 tokens)
- Large files exceed practical embedding limits
- Smaller chunks enable more precise retrieval

**Chunking approach:**
1. Split on natural boundaries (double newlines, function definitions)
2. Target ~4000 characters per chunk (approximately 1000 tokens)
3. Overlap by 5 lines to preserve context at boundaries
4. Preserve complete code blocks when possible

```python
def _chunk_content(self, content: str, max_chars: int = 4000) -> list[str]:
    """Split content into chunks respecting line boundaries."""
    if len(content) <= max_chars:
        return [content]

    lines = content.split('\n')
    chunks = []
    current_chunk = []
    current_size = 0

    for line in lines:
        line_size = len(line) + 1  # +1 for newline

        if current_size + line_size > max_chars and current_chunk:
            chunks.append('\n'.join(current_chunk))
            # Keep overlap_lines for context
            current_chunk = current_chunk[-self._config.overlap_lines:]
            current_size = sum(len(l) + 1 for l in current_chunk)

        current_chunk.append(line)
        current_size += line_size

    if current_chunk:
        chunks.append('\n'.join(current_chunk))

    return chunks
```

### File Encoding Handling

Files are read with the following encoding strategy:

1. **Primary attempt**: Try UTF-8 encoding (most common for source code)
2. **Fallback**: If UTF-8 fails, try latin-1 encoding (handles any byte sequence)
3. **Binary detection**: If both fail, skip the file as binary

```python
def _read_file_content(self, file_path: str) -> str | None:
    """Read file content with encoding fallback.

    Args:
        file_path: Path to the file to read.

    Returns:
        File content as string, or None if file is binary/unreadable.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        try:
            logger.warning(f"UTF-8 decode failed for {file_path}, trying latin-1")
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read()
        except Exception:
            logger.warning(f"Skipping binary file: {file_path}")
            return None
```

When latin-1 fallback is used, a warning is logged for visibility.

### File Size Validation

Before reading file content, check file size against `max_file_size_bytes`:

```python
def _check_file_size(self, file_path: str) -> bool:
    """Check if file size is within limits.

    Args:
        file_path: Path to the file to check.

    Returns:
        True if file is within size limit, False otherwise.
    """
    file_size = os.path.getsize(file_path)
    if file_size > self._config.max_file_size_bytes:
        logger.warning(
            f"Skipping oversized file: {file_path} "
            f"({file_size} bytes > {self._config.max_file_size_bytes} limit)"
        )
        return False
    return True
```

Files exceeding the limit are skipped with a warning logged.

### File Filtering

**Include patterns:** Source code and documentation
```python
INCLUDE_EXTENSIONS = {
    ".py", ".ts", ".js", ".tsx", ".jsx",  # Code
    ".md", ".yaml", ".yml", ".json",       # Config/docs
    ".sh", ".toml", ".html", ".css",       # Scripts/web
}
```

**Exclude patterns:** Binaries, dependencies, build artifacts
```python
EXCLUDE_PATTERNS = {
    "**/node_modules/**",
    "**/__pycache__/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/*.pyc",
    "**/*.whl",
    "**/*.tar*",
    "**/*.zip",
    "**/*.png", "**/*.jpg", "**/*.gif", "**/*.ico",
    "**/*.egg-info/**",
    "**/.venv/**", "**/venv/**",
}
```

### Error Handling

Use existing exceptions from `src/core/exceptions.py`:
- `BackendConnectionError`: Elasticsearch unreachable
- `IndexingError`: Document indexing failed
- `SearchError`: Search operation failed

Add ingestion-specific exception to `src/core/exceptions.py` (in T01):
```python
class IngestionError(ASDLCError):
    """Error during repository ingestion.

    Attributes:
        file_path: Path to the file that caused the error (if applicable).
        cause: The underlying exception that caused this error.
    """

    def __init__(
        self,
        message: str,
        file_path: str | None = None,
        cause: Exception | None = None,
    ):
        super().__init__(message)
        self.file_path = file_path
        self.cause = cause
```

**Note:** `IngestionError` inherits from `ASDLCError` (not bare `Exception`) to maintain consistency with the project's exception hierarchy.

### Testing Strategy

1. **Unit tests**: Ingester logic with mocked KnowledgeStore
2. **Unit tests**: MCP server request handling with mocked store
3. **Integration tests**: Full ingestion with real Elasticsearch
4. **MCP tests**: Server startup and tool schema validation

**Test fixtures:**
- Small sample repository with known file structure
- Mock files with various sizes for chunk testing

### Files to Create

| File | Purpose |
|------|---------|
| `src/infrastructure/repo_ingestion/__init__.py` | Package init |
| `src/infrastructure/repo_ingestion/config.py` | Ingestion configuration |
| `src/infrastructure/repo_ingestion/models.py` | Result models |
| `src/infrastructure/repo_ingestion/ingester.py` | Main ingestion service |
| `src/infrastructure/knowledge_store/mcp_server.py` | MCP server for KS tools |
| `scripts/knowledge-store/mcp-server.sh` | MCP launcher script |
| `scripts/knowledge-store/ingest-repo.sh` | CLI for repo ingestion |
| `tests/unit/infrastructure/test_repo_ingester.py` | Unit tests for ingester |
| `tests/unit/infrastructure/test_knowledge_store_mcp.py` | Unit tests for MCP server |
| `tests/integration/infrastructure/test_repo_ingestion.py` | Integration tests |

### Files to Modify

| File | Change |
|------|--------|
| `.mcp.json` | Add knowledge-store server configuration |
| `src/infrastructure/knowledge_store/__init__.py` | Export MCP server |

### Security Measures

#### Path Traversal Prevention (CRITICAL)

The RepoIngester MUST validate all file paths before reading to prevent path traversal attacks. This validation must occur before any file read operation.

```python
def _validate_path_within_repo(self, file_path: str, repo_path: str) -> bool:
    """Ensure file_path is within repo_path after resolving symlinks.

    This prevents path traversal attacks where malicious symlinks or
    relative paths (../) could escape the repository boundary.

    Args:
        file_path: Path to the file being ingested.
        repo_path: Root path of the repository being ingested.

    Returns:
        True if file_path is safely within repo_path, False otherwise.
    """
    real_file = os.path.realpath(file_path)
    real_repo = os.path.realpath(repo_path)
    return real_file.startswith(real_repo + os.sep)
```

This method MUST be called:
1. In `ingest_file()` before reading file content
2. In `ingest_repository()` for each file discovered during walk
3. After resolving any symlinks to prevent symlink-based escapes

If validation fails, the file is skipped and an error is logged.

#### Additional Security Considerations

1. **Content size limits**: Cap maximum content per document (see `max_file_size_bytes` in IngestionConfig)
2. **Rate limiting**: Consider limits on ingestion to prevent resource exhaustion
3. **Credential isolation**: Elasticsearch credentials only in MCP server process

### Performance Considerations

1. **Batch embedding**: Use `embed_batch()` for multiple chunks
2. **Async indexing**: Index documents concurrently with semaphore limit
3. **Incremental updates**: Skip unchanged files based on mtime
4. **Progress reporting**: Log progress for large repositories

### Usage Flow

1. **Start Elasticsearch** (via Docker Compose)
2. **Run ingestion** script to index repository
3. **Start MCP server** (automatically via Claude Code)
4. **Query via Claude Code** using ks_search tool

Example Claude Code usage:
```
Use the ks_search tool to find all files related to "KnowledgeStore interface"
```

Response from MCP:
```json
{
  "success": true,
  "count": 5,
  "results": [
    {
      "doc_id": "src/core/interfaces.py:0",
      "content": "...",
      "score": 0.89,
      "metadata": {
        "file_path": "src/core/interfaces.py",
        "file_type": ".py"
      }
    }
  ]
}
```
