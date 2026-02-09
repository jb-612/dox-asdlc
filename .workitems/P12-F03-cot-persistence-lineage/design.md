# P12-F03: Chain-of-Thought Persistence & Artifact Lineage - Technical Design

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft

## 1. Overview

Implement Chain-of-Thought (CoT) persistence and artifact lineage tracking to close two critical forensic traceability gaps identified in the Guardrails Constitution (G9):

1. **CRITICAL (C3):** Agent reasoning is not captured or stored. Cannot reconstruct "why" an agent made a decision.
2. **HIGH (H4):** No Source_Agent_ID or Parent_Artifact_ID on artifacts. Cannot trace a line of code back through design to requirement.

### 1.1 Goals

1. Capture structured agent reasoning (CoT traces) at each step and persist to an immutable append-only Elasticsearch index
2. Tag every artifact with lineage metadata (Source_Agent_ID, Parent_Artifact_ID, Task_ID, Git_SHA) enabling 1:1 traceability from production code to PRD requirement
3. Implement file scope adherence checking that compares intended vs actual file modifications
4. Provide automated Git-forensic PR templates with reasoning summaries and scope verification
5. Build a lineage dashboard in the HITL UI for tracing any artifact back to its origin

### 1.2 Non-Goals

- Real-time streaming of CoT traces (batch write is sufficient)
- Modifying existing agent implementations in P03/P04 beyond adding CoT output fields (agents produce CoT, this feature persists it)
- Replacing Git as the source of truth for artifacts (lineage metadata supplements Git)
- Building a full graph database for lineage (Elasticsearch with parent-child queries is sufficient for v1)
- Automatic remediation when scope adherence fails (flag only, human decides)

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P01-F03 | Complete | KnowledgeStore interface and ES patterns |
| P02-F04 | Complete | Elasticsearch backend with kNN search |
| P11-F01 | Complete | Guardrails system (hooks pattern, ES store pattern, audit index pattern) |
| P02-F01 | Complete | Redis Streams and ASDLCEvent model |
| P05-F01 | Complete | HITL UI infrastructure |
| P02-F08 | Complete | Agent telemetry API (integration point) |

### 2.2 External Dependencies

- `elasticsearch[async]>=8.10.0` - Already in requirements
- No new Python dependencies required
- No new npm packages required (HITL UI uses existing React/Zustand stack)

## 3. Data Models

### 3.1 CoT Trace Model

```python
@dataclass(frozen=True)
class CoTTrace:
    """A single Chain-of-Thought reasoning trace from an agent step.

    Immutable record of agent reasoning. Once created and persisted,
    a CoT trace cannot be modified (append-only storage).

    Attributes:
        id: Unique trace ID (UUID).
        task_id: The task being executed.
        session_id: The aSDLC session.
        agent_id: Agent identifier (e.g., "backend", "coding_agent").
        agent_type: Agent type from AgentTypeEnum (e.g., "coding", "reviewer").
        step_number: Sequential step within the task (1-based).
        reasoning_text: The agent's reasoning/rationale for this step.
        decision: The decision or action taken.
        artifacts_produced: Paths of artifacts created in this step.
        files_intended: Files the agent planned to modify (from reasoning).
        files_actual: Files actually modified (from git diff or tool log).
        parent_trace_id: Previous trace in the chain (for multi-step tasks).
        git_sha: Git SHA at the time of this trace.
        epic_id: Epic identifier for requirement traceability.
        duration_ms: Time spent on this step in milliseconds.
        token_count: Tokens consumed in this step.
        timestamp: When this trace was created.
        metadata: Additional extensible metadata.
    """
    id: str
    task_id: str
    session_id: str
    agent_id: str
    agent_type: str
    step_number: int
    reasoning_text: str
    decision: str
    artifacts_produced: list[str]
    files_intended: list[str]
    files_actual: list[str]
    parent_trace_id: str | None
    git_sha: str | None
    epic_id: str | None
    duration_ms: int
    token_count: int
    timestamp: datetime
    metadata: dict[str, Any]
```

### 3.2 Artifact Lineage Model

```python
@dataclass(frozen=True)
class ArtifactLineage:
    """Lineage metadata for a tracked artifact.

    Links an artifact to its source agent, parent artifact, task, and
    git revision. Enables tracing from production code back to the
    originating requirement.

    Attributes:
        id: Unique lineage record ID (UUID).
        artifact_path: Path to the artifact (relative to repo root).
        artifact_type: Type of artifact (code, test, spec, design, config).
        source_agent_id: Agent that created/modified this artifact.
        parent_artifact_id: ID of the parent artifact that led to this one.
        task_id: Task that produced this artifact.
        epic_id: Epic/feature this artifact belongs to.
        session_id: Session in which the artifact was created.
        git_sha: Git commit SHA where this artifact version was introduced.
        cot_trace_id: CoT trace that records the reasoning for this artifact.
        lineage_chain: Ordered list of ancestor artifact IDs (root first).
        created_at: When this lineage record was created.
        metadata: Additional extensible metadata.
    """
    id: str
    artifact_path: str
    artifact_type: str
    source_agent_id: str
    parent_artifact_id: str | None
    task_id: str
    epic_id: str | None
    session_id: str
    git_sha: str | None
    cot_trace_id: str | None
    lineage_chain: list[str]
    created_at: datetime
    metadata: dict[str, Any]
```

### 3.3 Scope Adherence Result

```python
@dataclass(frozen=True)
class ScopeAdherenceResult:
    """Result of comparing intended vs actual file modifications.

    Attributes:
        trace_id: The CoT trace being checked.
        task_id: The task.
        agent_id: The agent.
        files_intended: Files the agent said it would modify.
        files_actual: Files actually modified.
        files_unexpected: Files modified but not declared in reasoning.
        files_missing: Files declared in reasoning but not modified.
        adherence_score: 0.0-1.0 score (1.0 = perfect adherence).
        is_compliant: True if no unexpected files were modified.
        timestamp: When this check was performed.
    """
    trace_id: str
    task_id: str
    agent_id: str
    files_intended: list[str]
    files_actual: list[str]
    files_unexpected: list[str]
    files_missing: list[str]
    adherence_score: float
    is_compliant: bool
    timestamp: datetime
```

### 3.4 Artifact Type Enum

```python
class ArtifactType(str, Enum):
    """Types of tracked artifacts."""
    CODE = "code"           # Source code files
    TEST = "test"           # Test files
    SPEC = "spec"           # Specification documents
    DESIGN = "design"       # Design documents (design.md)
    CONFIG = "config"       # Configuration files
    PLAN = "plan"           # Planning artifacts (tasks.md, user_stories.md)
    DIAGRAM = "diagram"     # Architecture diagrams
    CONTRACT = "contract"   # API contracts
    REVIEW = "review"       # Review reports
    OTHER = "other"         # Catch-all
```

## 4. Elasticsearch Indices

### 4.1 cot-traces Index

Stores immutable CoT trace documents. Append-only -- no updates or deletes.

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "task_id": { "type": "keyword" },
      "session_id": { "type": "keyword" },
      "agent_id": { "type": "keyword" },
      "agent_type": { "type": "keyword" },
      "step_number": { "type": "integer" },
      "reasoning_text": { "type": "text" },
      "decision": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "artifacts_produced": { "type": "keyword" },
      "files_intended": { "type": "keyword" },
      "files_actual": { "type": "keyword" },
      "parent_trace_id": { "type": "keyword" },
      "git_sha": { "type": "keyword" },
      "epic_id": { "type": "keyword" },
      "duration_ms": { "type": "integer" },
      "token_count": { "type": "integer" },
      "timestamp": { "type": "date" },
      "metadata": { "type": "object", "enabled": false },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

### 4.2 artifact-lineage Index

Stores artifact lineage records. Updated when artifacts are modified in subsequent steps.

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "artifact_path": { "type": "keyword" },
      "artifact_type": { "type": "keyword" },
      "source_agent_id": { "type": "keyword" },
      "parent_artifact_id": { "type": "keyword" },
      "task_id": { "type": "keyword" },
      "epic_id": { "type": "keyword" },
      "session_id": { "type": "keyword" },
      "git_sha": { "type": "keyword" },
      "cot_trace_id": { "type": "keyword" },
      "lineage_chain": { "type": "keyword" },
      "created_at": { "type": "date" },
      "metadata": { "type": "object", "enabled": false },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

### 4.3 scope-adherence Index

Stores scope adherence check results. Append-only.

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "trace_id": { "type": "keyword" },
      "task_id": { "type": "keyword" },
      "agent_id": { "type": "keyword" },
      "files_intended": { "type": "keyword" },
      "files_actual": { "type": "keyword" },
      "files_unexpected": { "type": "keyword" },
      "files_missing": { "type": "keyword" },
      "adherence_score": { "type": "float" },
      "is_compliant": { "type": "boolean" },
      "timestamp": { "type": "date" },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

### 4.4 Index Lifecycle Policy

CoT traces accumulate rapidly (~10KB per trace). A retention policy prevents unbounded growth.

| Index | Retention | Rollover | Archive |
|-------|-----------|----------|---------|
| cot-traces | 90 days hot | Daily rollover at 50GB | After 90 days: delete or cold tier |
| artifact-lineage | Indefinite | No rollover (small) | Never (lineage is permanent) |
| scope-adherence | 90 days | Monthly rollover | After 90 days: delete |

## 5. CoT Capture System

### 5.1 Architecture Overview

```
+--------------------+     +------------------------+     +-------------------+
| Agent Execution    |     | CoT Capture Hook       |     | CoT Store (ES)    |
|                    |     |                        |     |                   |
| Agent produces     |---->| PostToolUse hook        |---->| cot-traces index  |
| reasoning + output |     | Extracts reasoning     |     | (append-only)     |
|                    |     | Extracts file lists     |     |                   |
+--------------------+     | Creates CoTTrace       |     +-------------------+
                           | Writes to ES (async)   |
                           +------------------------+
                                    |
                                    v
                           +------------------------+
                           | Scope Adherence Check  |
                           | Compare intended vs    |
                           | actual files           |
                           | Flag discrepancies     |
                           +------------------------+
```

### 5.2 CoT Capture Hook

**File:** `.claude/hooks/cot-capture.py`
**Event:** PostToolUse (after Write, Edit, Bash tool calls)

The hook captures the agent's reasoning by reading the tool output context and extracting structured data. It runs after every Write/Edit/Bash tool call to log what the agent did and why.

**Hook Input (stdin):**
```json
{
  "tool": "Write",
  "arguments": {"file_path": "src/workers/pool.py", "content": "..."},
  "result": "File written successfully",
  "sessionId": "session-abc123"
}
```

**Behavior:**
1. Read tool output from stdin JSON
2. Extract file path(s) from tool arguments
3. Read the current CoT context from session cache (written by UserPromptSubmit hook)
4. Create a CoTTrace record
5. Write to Elasticsearch asynchronously (best-effort, do not block agent execution)
6. Update session cache with latest trace ID for chaining
7. Always exit 0 (never block tool execution)

**Performance constraint:** Hook must complete in <500ms. ES writes are async with no wait_for. If ES is unavailable, log to local file as fallback.

### 5.3 CoT Store

**File:** `src/infrastructure/cot/cot_store.py`

Follows the same pattern as `GuardrailsStore`:

```python
class CoTStore:
    """Elasticsearch store for CoT traces and scope adherence results.

    Append-only: traces are never updated or deleted.
    """

    def __init__(
        self,
        es_client: AsyncElasticsearch,
        index_prefix: str = "",
    ) -> None: ...

    async def store_trace(self, trace: CoTTrace) -> str:
        """Store a CoT trace. Returns trace ID."""

    async def get_trace(self, trace_id: str) -> CoTTrace:
        """Get a trace by ID."""

    async def list_traces_by_task(
        self, task_id: str, page: int = 1, page_size: int = 50
    ) -> tuple[list[CoTTrace], int]:
        """List traces for a task, ordered by step_number."""

    async def list_traces_by_session(
        self, session_id: str, page: int = 1, page_size: int = 50
    ) -> tuple[list[CoTTrace], int]:
        """List traces for a session, ordered by timestamp."""

    async def search_traces(
        self, query: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[CoTTrace], int]:
        """Full-text search across reasoning_text and decision."""

    async def store_adherence_result(
        self, result: ScopeAdherenceResult
    ) -> str:
        """Store a scope adherence check result."""

    async def get_adherence_by_task(
        self, task_id: str
    ) -> list[ScopeAdherenceResult]:
        """Get all adherence results for a task."""

    async def close(self) -> None:
        """Close the ES client."""
```

## 6. Artifact Lineage System

### 6.1 Architecture Overview

```
+--------------------+     +------------------------+     +---------------------+
| Agent Produces     |     | Lineage Tracker        |     | Lineage Store (ES)  |
| Artifact           |     |                        |     |                     |
| (Write/Edit tool)  |---->| Determines artifact    |---->| artifact-lineage    |
|                    |     | type from path          |     | index               |
+--------------------+     | Links to parent via    |     +---------------------+
                           | task/epic context       |           |
                           | Records source agent   |           v
                           | Builds lineage chain   |    +---------------------+
                           +------------------------+    | Lineage Query API   |
                                                         | Trace any file to   |
                                                         | its origin          |
                                                         +---------------------+
```

### 6.2 Lineage Store

**File:** `src/infrastructure/cot/lineage_store.py`

```python
class LineageStore:
    """Elasticsearch store for artifact lineage records."""

    def __init__(
        self,
        es_client: AsyncElasticsearch,
        index_prefix: str = "",
    ) -> None: ...

    async def create_lineage(self, lineage: ArtifactLineage) -> str:
        """Create a lineage record. Returns lineage ID."""

    async def get_lineage(self, lineage_id: str) -> ArtifactLineage:
        """Get a lineage record by ID."""

    async def get_lineage_by_path(
        self, artifact_path: str
    ) -> list[ArtifactLineage]:
        """Get all lineage records for a file path (history)."""

    async def get_lineage_chain(
        self, artifact_path: str
    ) -> list[ArtifactLineage]:
        """Get the full lineage chain for an artifact (root to leaf)."""

    async def get_lineage_by_task(
        self, task_id: str
    ) -> list[ArtifactLineage]:
        """Get all artifacts produced by a task."""

    async def get_lineage_by_epic(
        self, epic_id: str
    ) -> list[ArtifactLineage]:
        """Get all artifacts in an epic."""

    async def search_lineage(
        self, agent_id: str | None = None,
        artifact_type: str | None = None,
        epic_id: str | None = None,
        page: int = 1, page_size: int = 50
    ) -> tuple[list[ArtifactLineage], int]:
        """Search lineage with filters."""

    async def close(self) -> None:
        """Close the ES client."""
```

### 6.3 Artifact Type Detection

```python
def detect_artifact_type(file_path: str) -> ArtifactType:
    """Detect artifact type from file path using path heuristics.

    Args:
        file_path: Relative path to the artifact.

    Returns:
        ArtifactType enum value.
    """
    path = file_path.lower()

    # Test files
    if "test" in path or path.endswith("_test.py") or path.endswith(".test.ts"):
        return ArtifactType.TEST

    # Design documents
    if "design.md" in path:
        return ArtifactType.DESIGN

    # Planning artifacts
    if "tasks.md" in path or "user_stories.md" in path:
        return ArtifactType.PLAN

    # Specifications
    if path.endswith(".md") and "spec" in path:
        return ArtifactType.SPEC

    # Diagrams
    if path.endswith(".mmd") or path.endswith(".mermaid"):
        return ArtifactType.DIAGRAM

    # Contracts
    if "contracts/" in path:
        return ArtifactType.CONTRACT

    # Config files
    if path.endswith((".json", ".yaml", ".yml", ".toml", ".cfg", ".ini")):
        return ArtifactType.CONFIG

    # Source code
    if path.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".sh")):
        return ArtifactType.CODE

    return ArtifactType.OTHER
```

### 6.4 Lineage Chain Building

When a new artifact is created, the lineage tracker:

1. Checks the current task context for `parent_artifact_id` (from the design doc or task definition)
2. If creating code from a design doc, the design doc's lineage ID becomes the parent
3. If modifying existing code, the previous lineage record for that file becomes the parent
4. Builds the `lineage_chain` by prepending ancestors (root-first order)

**Lineage hierarchy example:**
```
PRD Requirement (spec) -> Design Doc (design) -> Implementation (code) -> Test (test)
```

## 7. File Scope Adherence Checker

### 7.1 Design

The scope adherence checker compares the files an agent *said* it would modify (from its CoT reasoning) against the files it *actually* modified (from tool call logs).

**File:** `src/core/cot/scope_checker.py`

```python
class ScopeAdherenceChecker:
    """Compares intended file scope against actual modifications.

    Implements Logic-Reality Alignment from Guardrail G9:
    - File Scope Adherence: verify agent only modified files it claimed it would
    - Flag discrepancies as warnings
    """

    def check(
        self,
        files_intended: list[str],
        files_actual: list[str],
    ) -> ScopeAdherenceResult:
        """Compare intended vs actual file lists.

        Args:
            files_intended: Files declared in agent reasoning.
            files_actual: Files actually modified (from tool log).

        Returns:
            ScopeAdherenceResult with adherence score and flags.
        """
```

**Adherence Score Calculation:**
```
adherence_score = matched_files / max(len(intended), len(actual), 1)

Where:
  matched_files = len(set(intended) & set(actual))
  files_unexpected = set(actual) - set(intended)
  files_missing = set(intended) - set(actual)
  is_compliant = len(files_unexpected) == 0
```

### 7.2 Integration Point

The scope checker is invoked:
1. **During task execution:** After each agent step, the PostToolUse hook accumulates file modifications and compares against the step's declared intent
2. **At task completion:** A final check compares the full set of modifications against the task's declared scope
3. **In reviews:** The reviewer agent can query scope adherence results to identify discrepancies

## 8. Git-Forensic PR Template

### 8.1 PR Description Generator

**File:** `src/core/cot/pr_template.py`

Generates PR descriptions that include forensic traceability data.

```python
class PRTemplateGenerator:
    """Generates Git-forensic PR descriptions from CoT traces and lineage."""

    def generate(
        self,
        task_id: str,
        traces: list[CoTTrace],
        lineage: list[ArtifactLineage],
        adherence: list[ScopeAdherenceResult],
        test_results: dict[str, Any] | None = None,
    ) -> str:
        """Generate a PR description with forensic traceability.

        Returns:
            Markdown-formatted PR description with sections:
            - Task Summary (task_id, epic_id, agent(s) involved)
            - Reasoning Summary (condensed CoT chain)
            - Files Modified (with lineage links)
            - Scope Adherence Report
            - Test Results
            - Full Reasoning Log Link (ES query URL)
        """
```

**PR Template Output:**
```markdown
## Task: {task_id}
**Epic:** {epic_id} | **Agent(s):** {agents} | **Git SHA:** {git_sha}

### Reasoning Summary
{condensed reasoning from CoT traces, max 500 words}

### Files Modified ({count})
| File | Type | Agent | Parent Artifact | Lineage |
|------|------|-------|-----------------|---------|
| src/core/foo.py | code | backend | design-123 | PRD > Design > Code |
| tests/test_foo.py | test | backend | code-456 | PRD > Design > Code > Test |

### Scope Adherence
- Score: {score}%
- Unexpected files: {list or "None"}
- Missing files: {list or "None"}

### Test Results
- Unit: {pass}/{total}
- Integration: {pass}/{total}

### Forensic Links
- [Full Reasoning Log](http://localhost:9200/cot-traces/_search?q=task_id:{task_id})
- [Lineage Records](http://localhost:9200/artifact-lineage/_search?q=task_id:{task_id})
```

## 9. REST API

### 9.1 CoT Traces Endpoints

```python
# src/orchestrator/routes/cot_api.py

@router.get("/cot/traces")
async def list_traces(
    task_id: str | None = None,
    session_id: str | None = None,
    agent_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> CoTTracesListResponse: ...

@router.get("/cot/traces/{trace_id}")
async def get_trace(trace_id: str) -> CoTTraceResponse: ...

@router.get("/cot/traces/search")
async def search_traces(
    q: str,
    page: int = 1,
    page_size: int = 20,
) -> CoTTracesListResponse: ...
```

### 9.2 Lineage Endpoints

```python
@router.get("/lineage")
async def list_lineage(
    artifact_path: str | None = None,
    task_id: str | None = None,
    epic_id: str | None = None,
    agent_id: str | None = None,
    artifact_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> LineageListResponse: ...

@router.get("/lineage/{lineage_id}")
async def get_lineage(lineage_id: str) -> LineageResponse: ...

@router.get("/lineage/chain/{artifact_path:path}")
async def get_lineage_chain(
    artifact_path: str,
) -> LineageChainResponse: ...
```

### 9.3 Scope Adherence Endpoints

```python
@router.get("/cot/adherence")
async def list_adherence(
    task_id: str | None = None,
    agent_id: str | None = None,
    compliant: bool | None = None,
    page: int = 1,
    page_size: int = 50,
) -> AdherenceListResponse: ...
```

### 9.4 PR Template Endpoint

```python
@router.get("/cot/pr-template/{task_id}")
async def get_pr_template(task_id: str) -> PRTemplateResponse: ...
```

## 10. MCP Tools

### 10.1 CoT MCP Server

**File:** `src/infrastructure/cot/cot_mcp.py`

A standalone MCP server exposing CoT and lineage tools for agent consumption.

```python
# Tools

async def cot_log_reasoning(
    task_id: str,
    agent_id: str,
    step_number: int,
    reasoning_text: str,
    decision: str,
    files_intended: list[str] | None = None,
    artifacts_produced: list[str] | None = None,
    parent_trace_id: str | None = None,
    duration_ms: int = 0,
    token_count: int = 0,
) -> dict:
    """Log a chain-of-thought reasoning trace.

    Called by agents to record their reasoning before or after
    producing artifacts.

    Returns: {"success": true, "trace_id": "..."}
    """

async def cot_get_traces(
    task_id: str,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """Get CoT traces for a task.

    Returns: {"traces": [...], "total": N}
    """

async def lineage_record(
    artifact_path: str,
    source_agent_id: str,
    task_id: str,
    parent_artifact_id: str | None = None,
    epic_id: str | None = None,
    git_sha: str | None = None,
    cot_trace_id: str | None = None,
) -> dict:
    """Record lineage for an artifact.

    Called after an artifact is created or modified to establish
    traceability.

    Returns: {"success": true, "lineage_id": "..."}
    """

async def lineage_query(
    artifact_path: str,
) -> dict:
    """Query the lineage chain for an artifact.

    Returns: {"chain": [...], "total_depth": N}
    """
```

### 10.2 MCP Configuration

```json
{
  "mcpServers": {
    "cot-lineage": {
      "command": "python",
      "args": ["-m", "src.infrastructure.cot.cot_mcp"],
      "env": {"ELASTICSEARCH_URL": "http://localhost:9200"}
    }
  }
}
```

## 11. HITL UI Components

### 11.1 Component Architecture

```
docker/hitl-ui/src/
  components/
    lineage/
      LineagePage.tsx             # Main page layout
      LineagePage.test.tsx
      CoTTraceViewer.tsx          # CoT trace list and detail view
      CoTTraceViewer.test.tsx
      CoTTraceCard.tsx            # Single trace card
      CoTTraceCard.test.tsx
      LineageExplorer.tsx         # Artifact lineage tree/graph
      LineageExplorer.test.tsx
      LineageChain.tsx            # Visual chain from requirement to code
      LineageChain.test.tsx
      ScopeAdherencePanel.tsx     # Scope adherence results
      ScopeAdherencePanel.test.tsx
      PRTemplatePreview.tsx       # PR template preview
      PRTemplatePreview.test.tsx
      index.ts                   # Barrel export
  api/
    cot.ts                       # API client functions
    cot.test.ts
    mocks/
      cot.ts                     # Mock data
  stores/
    cotStore.ts                  # Zustand store
    cotStore.test.ts
```

### 11.2 Page Layout

```
+--------------------------------------------------------------+
| Header: "Forensic Traceability"    [Task ID: ____] [Search]  |
+--------------------------------------------------------------+
| Tab: [CoT Traces] [Lineage Explorer] [Scope Adherence]       |
+--------------------------------------------------------------+
|                                                                |
| CoT Traces Tab:                                                |
| +----------------------------------------------------------+ |
| | Task: P12-T01 | Agent: backend | Steps: 5                 | |
| | +------------------------------------------------------+ | |
| | | Step 1: Analyzing requirements...                     | | |
| | |   Decision: Create data models                       | | |
| | |   Files intended: src/core/cot/models.py             | | |
| | |   Files actual: src/core/cot/models.py               | | |
| | |   Score: 100%                                        | | |
| | +------------------------------------------------------+ | |
| | | Step 2: Implementing store layer...                   | | |
| | |   Decision: Create CoTStore with ES backend          | | |
| | |   Files intended: src/infrastructure/cot/cot_store.py| | |
| | |   Files actual: src/infrastructure/cot/cot_store.py, | | |
| | |                  src/infrastructure/cot/__init__.py   | | |
| | |   Score: 67% (unexpected: __init__.py)               | | |
| | +------------------------------------------------------+ | |
| +----------------------------------------------------------+ |
|                                                                |
| Lineage Explorer Tab:                                          |
| +----------------------------------------------------------+ |
| | Search: [src/core/cot/models.py______________] [Trace]   | |
| |                                                           | |
| | PRD Requirement: US-F03-01 (requirement)                  | |
| |   |                                                        | |
| |   +-> design.md (design, by: planner)                     | |
| |         |                                                  | |
| |         +-> src/core/cot/models.py (code, by: backend)    | |
| |         |     |                                            | |
| |         |     +-> tests/test_models.py (test, by: backend) | |
| |         |                                                  | |
| |         +-> src/infrastructure/cot/cot_store.py (code)     | |
| +----------------------------------------------------------+ |
+--------------------------------------------------------------+
```

## 12. Configuration

### 12.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COT_ENABLED` | `true` | Master enable/disable for CoT capture |
| `COT_ELASTICSEARCH_URL` | `http://localhost:9200` | ES connection (reuses ELASTICSEARCH_URL if not set) |
| `COT_INDEX_PREFIX` | `""` | Tenant prefix for ES indices |
| `COT_RETENTION_DAYS` | `90` | Days to retain CoT traces |
| `COT_MAX_REASONING_LENGTH` | `10000` | Max characters for reasoning_text field |
| `COT_HOOK_TIMEOUT_MS` | `500` | Max time for PostToolUse hook |
| `COT_FALLBACK_DIR` | `/tmp/cot-fallback` | Local fallback directory when ES unavailable |
| `LINEAGE_ENABLED` | `true` | Master enable/disable for lineage tracking |

### 12.2 Config Class

```python
@dataclass(frozen=True)
class CoTConfig:
    """Configuration for CoT persistence and lineage tracking."""
    enabled: bool = True
    elasticsearch_url: str = "http://localhost:9200"
    index_prefix: str = ""
    retention_days: int = 90
    max_reasoning_length: int = 10000
    hook_timeout_ms: int = 500
    fallback_dir: str = "/tmp/cot-fallback"
    lineage_enabled: bool = True

    @classmethod
    def from_env(cls) -> CoTConfig: ...
```

## 13. File Structure

```
src/
  core/
    cot/
      __init__.py
      models.py                  # CoTTrace, ArtifactLineage, ScopeAdherenceResult
      config.py                  # CoTConfig
      exceptions.py              # CoT-specific exceptions
      scope_checker.py           # ScopeAdherenceChecker
      pr_template.py             # PRTemplateGenerator
      artifact_type.py           # ArtifactType enum and detect_artifact_type()
  infrastructure/
    cot/
      __init__.py
      cot_store.py               # ES store for CoT traces
      lineage_store.py           # ES store for artifact lineage
      cot_mappings.py            # ES index mappings
      cot_mcp.py                 # Standalone MCP server

src/orchestrator/
  routes/
    cot_api.py                   # REST API endpoints
  api/
    models/
      cot.py                     # Pydantic request/response models

.claude/hooks/
  cot-capture.py                 # PostToolUse hook for CoT capture

docker/hitl-ui/src/
  components/
    lineage/                     # All lineage UI components
  api/
    cot.ts                       # API client
    mocks/
      cot.ts                     # Mock data
  stores/
    cotStore.ts                  # Zustand store

tests/
  unit/
    core/
      cot/
        test_models.py
        test_scope_checker.py
        test_pr_template.py
        test_artifact_type.py
    infrastructure/
      cot/
        test_cot_store.py
        test_lineage_store.py
    orchestrator/
      routes/
        test_cot_api.py
    hooks/
      test_cot_capture.py
  integration/
    test_cot_store.py
    test_lineage_store.py
    test_cot_mcp.py
```

## 14. Security Considerations

1. **Immutability:** CoT traces are append-only. ES index template can enforce write-only access
2. **Data sensitivity:** Reasoning text may contain sensitive information. Apply same access controls as audit log
3. **Path sanitization:** All artifact paths sanitized using the same patterns as guardrails (reject `..`, normalize separators)
4. **Size limits:** `max_reasoning_length` prevents unbounded storage growth from verbose reasoning
5. **Retention:** Automatic cleanup via ES ILM policy prevents unbounded index growth

## 15. Performance Considerations

1. **Async writes:** CoT hook writes to ES asynchronously (no `refresh=wait_for`) to avoid blocking agent execution
2. **Local fallback:** When ES is unavailable, writes to local JSON files in `COT_FALLBACK_DIR` for later ingestion
3. **Batch ingestion:** Local fallback files are batch-ingested when ES reconnects
4. **Hook timeout:** PostToolUse hook hard-capped at 500ms via hook timeout configuration
5. **Index optimization:** Keyword fields for filters, text fields only for reasoning_text and decision
6. **Pagination:** All list APIs are paginated to prevent large response payloads

## 16. Integration Points

### 16.1 With Guardrails System (P11-F01)

- CoT traces feed into guardrails audit log for combined forensic view
- Scope adherence results can trigger advisory guardrail warnings
- Shared ES client patterns and index naming conventions

### 16.2 With Agent Telemetry (P02-F08)

- CoT traces include `duration_ms` and `token_count` that feed into telemetry metrics
- Agent activity dashboard can link to CoT traces for detail drill-down

### 16.3 With Event Stream (P02-F01)

- New event types: `COT_TRACE_CREATED`, `LINEAGE_RECORDED`, `SCOPE_CHECK_COMPLETED`
- Events carry trace/lineage IDs for cross-referencing

### 16.4 With Agent Protocols (P03-F01)

- `AgentResult` gains optional `cot_trace_ids` field listing traces produced during execution
- `AgentContext` gains optional `parent_artifact_ids` for lineage chaining

## 17. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CoT capture slows agent execution | Medium | Async writes, 500ms timeout, local fallback |
| ES storage growth unbounded | Medium | Retention policy, ILM, size limits on reasoning_text |
| Lineage chain becomes inconsistent | High | Idempotent writes, validate chain integrity on query |
| Scope checker false positives | Medium | Allow list for boilerplate files (__init__.py, etc.) |
| Hook complexity increases system fragility | Medium | Independent hook, fail-open, comprehensive tests |
| PR template generation fails | Low | Graceful degradation to minimal template |

## 18. Open Questions

1. Should CoT traces be stored per-step or per-task? (Design assumes per-step for granularity)
2. Should lineage records be immutable like CoT traces, or updateable when artifacts are modified?
3. Should there be a max depth limit for lineage chains?
4. Should the scope checker have a configurable allow-list for commonly auto-generated files?
