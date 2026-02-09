# P12-F06: Context Package Assembly & Repo Mapper Agent - Design

## Overview

This feature closes two gaps from the Guardrails Constitution audit:

1. **HIGH (H6): No context assembly pipeline** -- Agents currently pull arbitrary global information via ad-hoc `ks_search` calls. There is no formal mechanism to build a closed, filtered "Context Package" per task before execution.
2. **MEDIUM (M2): No Mapping/Scanning agent** -- The Repo Mapper role exists as implementation code (`src/workers/repo_mapper/`) but is not defined as a first-class agent with its own scanning responsibilities and agent definition.

The feature delivers a Context Package Builder that assembles pre-filtered context per task, a formal Repo Mapper agent definition, a background indexing service that maintains structural metadata in KnowledgeStore, a new guardrails guideline enforcing context package discipline, and integration with token budget enforcement.

## Goals

1. Every agent task starts with a closed, pre-assembled Context Package -- not raw global search.
2. A Repo Mapper agent continuously maintains the structural "Technical Source of Truth" in KnowledgeStore.
3. Context packages respect token budgets and prioritize by relevance.
4. The SubagentStart hook integrates context package assembly so it happens automatically.
5. A guardrails guideline warns when agents perform ad-hoc `ks_search` outside of a context package.

## Technical Approach

### Component Architecture

```
                          ┌──────────────────────────────────────┐
                          │         SubagentStart Hook           │
                          │    (guardrails-subagent.py)          │
                          │                                      │
                          │  1. Evaluate guardrails (existing)   │
                          │  2. Build context package (NEW)      │
                          │  3. Inject as additionalContext       │
                          └─────────────┬────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Context Package Builder                         │
│                  src/core/context_package/                         │
│                                                                   │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │  TaskAnalyzer    │   │  ContextAssembler│   │ BudgetEnforcer│  │
│  │                  │   │                  │   │              │  │
│  │ - Parse task desc│──▶│ - Query KS/Repo  │──▶│ - Token count│  │
│  │ - Detect paths   │   │   Mapper cache   │   │ - Truncate   │  │
│  │ - Detect domain  │   │ - Filter by role │   │ - Prioritize │  │
│  │ - Detect symbols │   │ - Score relevance│   │ - Validate   │  │
│  └─────────────────┘   └──────────────────┘   └──────────────┘  │
│                                                                   │
│  Output: ContextPack (from src/core/models.py)                    │
└───────────────────────────────────────────────────────────────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                  ┌───────────────┐           ┌───────────────┐
                  │  KnowledgeStore│           │  RepoMapper   │
                  │  (ks_search)  │           │  AST Cache    │
                  │  Semantic     │           │  Dep Graph    │
                  └───────────────┘           └───────────────┘


┌───────────────────────────────────────────────────────────────────┐
│                    Repo Mapper Agent                               │
│                  .claude/agents/repo-mapper.md                     │
│                                                                   │
│  Role: Continuous scanning of codebase structure                  │
│  Access: READ-ONLY to all code paths                              │
│  Outputs: Structural metadata indexed in KnowledgeStore           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Repo Mapper Indexing Service                                │ │
│  │  src/workers/repo_mapper/indexing_service.py                 │ │
│  │                                                              │ │
│  │  - Periodic scan (git diff-based or full)                    │ │
│  │  - Parse all supported files via ParserRegistry              │ │
│  │  - Build/refresh DependencyGraph                             │ │
│  │  - Index structural metadata into KnowledgeStore             │ │
│  │  - Generate per-module ast_context.json                      │ │
│  │  - Track scan history for incremental updates                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 1. Context Package Builder (`src/core/context_package/`)

The builder is a new module that orchestrates context assembly for any task. It wraps the existing RepoMapper and KnowledgeStore to produce a closed ContextPack.

**Pipeline:**

```
Task Description + Agent Role + Domain + File Paths
        │
        ▼
   TaskAnalyzer
   - Extract file paths from description (regex)
   - Extract symbol names (SymbolExtractor from repo_mapper)
   - Detect domain from path prefixes (P01-P06 mapping)
   - Detect action type from keywords
        │
        ▼
   ContextAssembler
   - Query RepoMapper for AST-based context (dependency graph, symbols)
   - Query KnowledgeStore for semantic matches (ks_search)
   - Merge results, deduplicate
   - Filter by agent path restrictions (from guardrails)
   - Score files by combined relevance (AST proximity + semantic similarity)
        │
        ▼
   BudgetEnforcer
   - Count tokens using TokenCounter
   - Sort by relevance_score descending
   - Include files until budget reached
   - For files that push over budget: include signature-only (truncated)
   - Final validation: all file refs resolvable, budget respected
        │
        ▼
   ContextPack (output)
```

**Key Interfaces:**

```python
# src/core/context_package/builder.py

class ContextPackageBuilder:
    """Assembles closed context packages for agent tasks."""

    def __init__(
        self,
        repo_mapper: RepoMapper,
        knowledge_store_search: Callable,  # ks_search wrapper
        token_counter: TokenCounter,
        path_restrictions: dict[str, list[str]] | None = None,
    ) -> None: ...

    async def build(
        self,
        task_description: str,
        agent_role: str,
        domain: str | None = None,
        target_files: list[str] | None = None,
        token_budget: int = 100_000,
    ) -> ContextPack: ...

    async def build_from_task_context(
        self,
        task_context: TaskContext,
        token_budget: int = 100_000,
    ) -> ContextPack: ...
```

```python
# src/core/context_package/analyzer.py

class TaskAnalyzer:
    """Extracts structured context hints from task descriptions."""

    def analyze(self, task_description: str) -> TaskAnalysis: ...

@dataclass(frozen=True)
class TaskAnalysis:
    """Result of analyzing a task description."""
    file_paths: list[str]       # Detected file paths
    symbol_names: list[str]     # Detected symbol references
    domain: str | None          # Detected domain (P01-P06)
    action: str | None          # Detected action (implement, review, test)
    keywords: list[str]         # Extracted keywords for semantic search
```

```python
# src/core/context_package/assembler.py

class ContextAssembler:
    """Merges AST and semantic search results into unified context."""

    def __init__(
        self,
        repo_mapper: RepoMapper,
        ks_search: Callable,
    ) -> None: ...

    async def assemble(
        self,
        analysis: TaskAnalysis,
        agent_role: str,
        path_restrictions: list[str] | None = None,
    ) -> list[ScoredFile]: ...

@dataclass
class ScoredFile:
    """A file with combined relevance scoring."""
    file_path: str
    content: str
    ast_score: float        # Score from RepoMapper (0-1)
    semantic_score: float   # Score from KnowledgeStore (0-1)
    combined_score: float   # Weighted combination
    symbols: list[str]
    source: str             # "ast", "semantic", or "both"
```

```python
# src/core/context_package/budget.py

class BudgetEnforcer:
    """Enforces token budget on assembled context."""

    def __init__(self, token_counter: TokenCounter) -> None: ...

    def enforce(
        self,
        scored_files: list[ScoredFile],
        token_budget: int,
        truncation_strategy: str = "relevance",  # or "signature_only"
    ) -> tuple[list[FileContent], int]:
        """Returns (files within budget, actual token count)."""
        ...
```

### 2. Repo Mapper Agent Definition (`.claude/agents/repo-mapper.md`)

A new agent definition that formalizes the Repo Mapper as a first-class scanning agent. This is a meta file owned by the orchestrator.

**Agent characteristics:**
- **READ-ONLY** access to all source code paths
- Cannot modify any files (tools: Read, Glob, Grep only)
- Primary output: structured metadata indexed in KnowledgeStore
- Invoked on-demand by PM CLI or on file change triggers
- Produces `ast_context.json` per module and dependency graph updates

### 3. Repo Mapper Indexing Service (`src/workers/repo_mapper/indexing_service.py`)

A background service that continuously maintains the structural index.

```python
class RepoMapperIndexingService:
    """Background service that maintains structural metadata in KnowledgeStore."""

    def __init__(
        self,
        repo_mapper: RepoMapper,
        knowledge_store: KnowledgeStore,
        scan_interval: int = 300,  # seconds between full scans
    ) -> None: ...

    async def run_scan(self, mode: str = "incremental") -> ScanResult:
        """Run a scan of the repository.

        Args:
            mode: "full" for complete rescan, "incremental" for git-diff based

        Returns:
            ScanResult with statistics
        """
        ...

    async def index_structural_metadata(self, ast_context: ASTContext) -> int:
        """Index structural metadata into KnowledgeStore.

        Indexes:
        - File summaries (path, language, symbols, exports)
        - Symbol definitions (name, kind, signature, file, line)
        - Import relationships (source -> target)
        - Module dependency edges

        Returns:
            Number of documents indexed
        """
        ...

    def get_changed_files(self, since_sha: str) -> list[str]:
        """Get files changed since a git SHA using git diff."""
        ...

@dataclass
class ScanResult:
    """Result of a repository scan."""
    files_scanned: int
    files_changed: int
    symbols_indexed: int
    dependencies_indexed: int
    duration_seconds: float
    git_sha: str
    mode: str  # "full" or "incremental"
```

### 4. Context Constraint Guardrail

A new guideline added to the bootstrap set that enforces context package discipline.

```json
{
  "id": "context-package-enforcement",
  "name": "Context Package Enforcement",
  "description": "Warns when agents perform ad-hoc ks_search outside of context package assembly. Agents should receive pre-assembled context packages.",
  "enabled": true,
  "category": "context_constraint",
  "priority": 750,
  "condition": {
    "agents": ["backend", "frontend"],
    "actions": ["implement", "code", "fix", "refactor", "test"]
  },
  "action": {
    "type": "instruction",
    "instruction": "You should work within the context package provided at task start. Avoid ad-hoc ks_search calls for implementation context. If the context package is insufficient, report the gap rather than searching globally."
  }
}
```

### 5. Hook Integration

The existing `guardrails-subagent.py` hook will be extended to also build a context package when a subagent starts. The context package is injected alongside guardrails as `additionalContext`.

**Modified flow in SubagentStart:**

```
1. Read agent info from stdin JSON
2. Evaluate guardrails (existing)
3. Build context package (NEW):
   a. Read task description from input (if available)
   b. Call ContextPackageBuilder.build()
   c. Format as context summary (file list + key symbols)
4. Combine guardrails + context into additionalContext
5. Write cache for cross-hook state
```

The context package output is formatted as a structured summary (not full file contents) to stay within prompt limits:

```
## Context Package
Task: Implement token budget enforcement
Files included: 5 (42,000 tokens)
Budget: 100,000 tokens

### Key Files
- src/workers/repo_mapper/token_counter.py (relevance: 0.95)
  Symbols: TokenCounter, count_tokens, count_parsed_file
- src/core/models.py (relevance: 0.85)
  Symbols: ContextPack, FileContent
...

### Dependencies
- src/core/models.py -> src/workers/repo_mapper/models.py
- src/workers/repo_mapper/token_counter.py -> tiktoken
```

## Interfaces and Dependencies

### Dependencies on Existing Components

| Component | Location | Usage |
|-----------|----------|-------|
| RepoMapper | `src/workers/repo_mapper/mapper.py` | AST-based context generation |
| ContextBuilder | `src/workers/repo_mapper/context_builder.py` | File selection and relevance scoring |
| TokenCounter | `src/workers/repo_mapper/token_counter.py` | Token counting and budget enforcement |
| SymbolExtractor | `src/workers/repo_mapper/symbol_extractor.py` | Symbol detection from descriptions |
| DependencyGraph | `src/workers/repo_mapper/dependency_graph.py` | Dependency traversal |
| ParserRegistry | `src/workers/repo_mapper/parsers/__init__.py` | Multi-language parsing |
| ContextPack | `src/core/models.py` | Output data model |
| FileContent | `src/core/models.py` | File content data model |
| KnowledgeStore | `src/core/interfaces.py` | Semantic search protocol |
| GuardrailsEvaluator | `src/core/guardrails/evaluator.py` | Path restriction retrieval |
| TaskContext | `src/core/guardrails/models.py` | Context model for guardrails |
| SubagentStart hook | `.claude/hooks/guardrails-subagent.py` | Hook integration point |
| Bootstrap script | `scripts/bootstrap_guardrails.py` | New guideline registration |

### Dependencies on External Libraries

| Library | Usage | Already in Project |
|---------|-------|--------------------|
| tiktoken | Token counting | Yes |
| tree-sitter | TypeScript parsing | Yes |
| elasticsearch | KnowledgeStore backend | Yes |

### New Interfaces Provided

| Interface | Consumer | Purpose |
|-----------|----------|---------|
| ContextPackageBuilder | SubagentStart hook, PM CLI | Build context packages on demand |
| TaskAnalyzer | ContextPackageBuilder | Parse task descriptions |
| ContextAssembler | ContextPackageBuilder | Merge AST + semantic results |
| BudgetEnforcer | ContextPackageBuilder | Token budget enforcement |
| RepoMapperIndexingService | Repo Mapper agent, cron | Maintain structural index |

## Architecture Decisions

### AD-1: Build on existing RepoMapper, do not replace

The existing `src/workers/repo_mapper/` is mature (P03-F02, 100% complete). The Context Package Builder wraps it as a higher-level orchestrator rather than reimplementing AST parsing or dependency graphs.

**Rationale:** Avoid duplication. The RepoMapper already handles AST parsing, symbol extraction, dependency graphs, and token counting. The new builder adds the assembly pipeline, KnowledgeStore integration, path filtering, and hook integration.

### AD-2: Context package as summary, not full content

The SubagentStart hook injects a context package *summary* (file list, symbols, dependency edges) rather than full file contents. Agents use the summary to know what files are relevant and can then read them with targeted tool calls.

**Rationale:** Injecting 100K tokens of file content into `additionalContext` would overwhelm the prompt. A summary of 2-5K tokens guides the agent to read the right files without bloating context.

### AD-3: Dual scoring (AST + semantic)

Files are scored by both AST proximity (from DependencyGraph) and semantic similarity (from KnowledgeStore search). The combined score uses a weighted average: `0.6 * ast_score + 0.4 * semantic_score`.

**Rationale:** AST proximity captures structural relationships (imports, call chains) that semantic search may miss. Semantic search captures conceptual relevance (similar patterns, related docs) that AST cannot detect. The combination is more robust than either alone.

### AD-4: Agent definition as meta file

The Repo Mapper agent definition (`.claude/agents/repo-mapper.md`) is a meta file owned by the orchestrator, following the existing pattern for `backend.md`, `frontend.md`, etc.

**Rationale:** Consistency with existing agent definitions. The orchestrator owns all `.claude/` files per path restrictions.

### AD-5: Indexing service as on-demand, not always-running daemon

The indexing service runs scans on-demand (invoked by the Repo Mapper agent or a manual trigger) rather than as a continuously-running background daemon.

**Rationale:** The aSDLC project uses Docker Compose for local dev. Adding a persistent daemon increases complexity. On-demand scanning with git-diff-based incremental updates is sufficient for the development workflow. A periodic cron or pre-task hook trigger can be added later.

### AD-6: Guardrail as advisory, not blocking

The context package enforcement guardrail uses `type: instruction` (advisory) rather than `type: tool_restriction` (blocking). It warns agents about ad-hoc searching but does not block `ks_search` calls.

**Rationale:** Blocking `ks_search` entirely would prevent legitimate exploratory queries during debugging or review. The advisory approach teaches agents the pattern while preserving flexibility for edge cases.

## File Structure

### New Files

```
src/core/context_package/
    __init__.py
    builder.py              # ContextPackageBuilder main class
    analyzer.py             # TaskAnalyzer for task description parsing
    assembler.py            # ContextAssembler for merging AST + semantic
    budget.py               # BudgetEnforcer for token budget management
    config.py               # ContextPackageConfig

src/workers/repo_mapper/
    indexing_service.py     # RepoMapperIndexingService

.claude/agents/
    repo-mapper.md          # Repo Mapper agent definition

scripts/
    run_repo_scan.py        # CLI wrapper for on-demand scans

tests/unit/core/context_package/
    __init__.py
    test_builder.py
    test_analyzer.py
    test_assembler.py
    test_budget.py

tests/unit/workers/repo_mapper/
    test_indexing_service.py

tests/integration/
    test_context_package_integration.py
```

### Modified Files

```
.claude/hooks/guardrails-subagent.py    # Add context package injection
scripts/bootstrap_guardrails.py          # Add context-package-enforcement guideline
src/core/exceptions.py                   # Add ContextPackageError
```

## Performance Requirements

| Operation | Target | Notes |
|-----------|--------|-------|
| TaskAnalyzer.analyze() | <50ms | Regex-based, no I/O |
| ContextAssembler.assemble() | <3s | Includes KS query + RepoMapper lookup |
| BudgetEnforcer.enforce() | <200ms | Token counting with cache |
| Full build() pipeline | <5s | End-to-end context assembly |
| Incremental repo scan | <30s | Git-diff based, parse changed files only |
| Full repo scan | <5min | Parse all files, rebuild dependency graph |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXT_PACKAGE_ENABLED` | `true` | Master enable/disable for context assembly |
| `CONTEXT_PACKAGE_TOKEN_BUDGET` | `100000` | Default token budget per task |
| `CONTEXT_PACKAGE_AST_WEIGHT` | `0.6` | Weight for AST relevance in combined score |
| `CONTEXT_PACKAGE_SEMANTIC_WEIGHT` | `0.4` | Weight for semantic relevance in combined score |
| `CONTEXT_PACKAGE_MIN_RELEVANCE` | `0.2` | Minimum combined score to include a file |
| `CONTEXT_PACKAGE_SUMMARY_MAX_TOKENS` | `4000` | Maximum tokens for the summary injected into hook |
| `REPO_SCAN_INTERVAL` | `300` | Seconds between automatic scans (0 = manual only) |
| `REPO_SCAN_MODE` | `incremental` | Default scan mode ("full" or "incremental") |
