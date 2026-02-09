# P12-F06: Context Package Assembly & Repo Mapper Agent - Tasks

## Overview

Task breakdown for implementing the Context Package Assembly pipeline and Repo Mapper agent. Organized into 6 phases matching the technical architecture layers.

## Dependencies

### External Dependencies

- P03-F02: Repo Mapper (context pack generation) - COMPLETE
- P11-F01: Guardrails Configuration System - COMPLETE (95%)
- P01-F03: KnowledgeStore interface - COMPLETE
- P02-F04: Elasticsearch backend - COMPLETE

### Phase Dependencies

```
Phase 1 (Config & Models) ───┐
                              ├──► Phase 3 (Context Assembler)
Phase 2 (Task Analyzer) ─────┘         │
                                        ├──► Phase 4 (Builder & Budget)
                                        │
Phase 5 (Indexing Service) ◄────────────┘
                                        │
Phase 6 (Hook & Guardrail Integration) ◄┘
```

---

## Phase 1: Configuration and Exception Models (Backend)

### T01: Create ContextPackage Configuration

**File:** `src/core/context_package/config.py`
**Test:** `tests/unit/core/context_package/test_config.py`
**Estimate:** 45min
**Stories:** US-10

**Subtasks:**
- [ ] Create `src/core/context_package/__init__.py`
- [ ] Create `ContextPackageConfig` frozen dataclass
- [ ] Implement `from_env()` class method loading from environment variables
- [ ] Add validation in `__post_init__` (budget > 0, weights in 0-1, etc.)
- [ ] Add weight normalization (if ast_weight + semantic_weight != 1.0, normalize)
- [ ] Write unit tests for config loading, validation, and defaults

**Acceptance Criteria:**
- [ ] Config loads from environment variables with sensible defaults
- [ ] Invalid values raise ValueError with clear message
- [ ] Weights are auto-normalized to sum to 1.0
- [ ] Config is frozen (immutable)

---

### T02: Add ContextPackage Exceptions

**File:** `src/core/exceptions.py`
**Test:** `tests/unit/core/test_exceptions.py` (extend existing)
**Estimate:** 20min
**Stories:** US-09

**Subtasks:**
- [ ] Add `ContextPackageError(ASDLCError)` base exception
- [ ] Add `ContextAssemblyError(ContextPackageError)` for assembly failures
- [ ] Add `ContextValidationError(ContextPackageError)` for validation failures
- [ ] Add `ContextBudgetExceededError(ContextPackageError)` for budget overruns
- [ ] Write unit tests for exception hierarchy and serialization

**Acceptance Criteria:**
- [ ] Exceptions inherit from ASDLCError
- [ ] Exceptions include message and details fields
- [ ] `to_dict()` serialization works

---

## Phase 2: Task Analyzer (Backend)

### T03: Implement TaskAnalysis Data Model

**File:** `src/core/context_package/analyzer.py`
**Test:** `tests/unit/core/context_package/test_analyzer.py`
**Estimate:** 30min
**Stories:** US-02

**Subtasks:**
- [ ] Define `TaskAnalysis` frozen dataclass (file_paths, symbol_names, domain, action, keywords)
- [ ] Add `to_dict()` and `from_dict()` methods
- [ ] Write unit tests for model creation and serialization

**Acceptance Criteria:**
- [ ] Dataclass is frozen (immutable)
- [ ] All fields have correct types and defaults
- [ ] JSON round-trip works

---

### T04: Implement TaskAnalyzer

**File:** `src/core/context_package/analyzer.py`
**Test:** `tests/unit/core/context_package/test_analyzer.py`
**Estimate:** 1.5hr
**Stories:** US-02

**Subtasks:**
- [ ] Create `TaskAnalyzer` class
- [ ] Implement file path extraction via regex (detect `src/`, `tests/`, `docker/` patterns)
- [ ] Implement symbol name extraction (reuse `SymbolExtractor.extract_symbol_names()` from repo_mapper)
- [ ] Implement domain detection from file path prefixes:
  - `src/workers/` -> P03
  - `src/orchestrator/` -> P02
  - `src/infrastructure/` -> P01
  - `src/hitl_ui/`, `docker/hitl-ui/` -> P05
  - `docker/`, `helm/` -> P06
  - `src/core/guardrails/` -> P11
- [ ] Implement action detection from keywords:
  - "implement", "create", "build", "add" -> "implement"
  - "fix", "debug", "resolve" -> "fix"
  - "review", "inspect", "check" -> "review"
  - "test", "verify", "validate" -> "test"
  - "refactor", "clean", "improve" -> "refactor"
- [ ] Implement keyword extraction for semantic search (nouns, technical terms)
- [ ] Write comprehensive unit tests with diverse task descriptions

**Acceptance Criteria:**
- [ ] File paths extracted from descriptions like "modify src/core/models.py"
- [ ] Symbol names detected from descriptions like "update the ContextPack class"
- [ ] Domain correctly inferred from detected file paths
- [ ] Action correctly detected from description keywords
- [ ] Keywords suitable for semantic search extracted
- [ ] Analysis completes in under 50ms

---

## Phase 3: Context Assembler (Backend)

### T05: Implement ScoredFile Data Model

**File:** `src/core/context_package/assembler.py`
**Test:** `tests/unit/core/context_package/test_assembler.py`
**Estimate:** 20min
**Stories:** US-03

**Subtasks:**
- [ ] Define `ScoredFile` dataclass (file_path, content, ast_score, semantic_score, combined_score, symbols, source)
- [ ] Add `to_dict()` method
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] Dataclass has all required fields with correct types
- [ ] Serialization works

---

### T06: Implement ContextAssembler

**File:** `src/core/context_package/assembler.py`
**Test:** `tests/unit/core/context_package/test_assembler.py`
**Estimate:** 2hr
**Stories:** US-03

**Subtasks:**
- [ ] Create `ContextAssembler` class with RepoMapper and ks_search dependencies
- [ ] Implement AST-based context retrieval:
  - Use RepoMapper.generate_context_pack() for target files
  - Extract dependency graph neighbors
  - Score based on relevance_score from ContextBuilder
- [ ] Implement semantic search retrieval:
  - Call ks_search with extracted keywords
  - Map results to ScoredFile with semantic_score from search relevance
- [ ] Implement result merging:
  - Deduplicate by file_path
  - Combined score = ast_weight * ast_score + semantic_weight * semantic_score
  - Files from single source get 0 for the missing score
- [ ] Implement path restriction filtering:
  - Accept list of allowed path patterns (from guardrails)
  - Filter results using fnmatch glob matching
- [ ] Sort results by combined_score descending
- [ ] Handle RepoMapper errors gracefully (fall back to semantic only)
- [ ] Handle KnowledgeStore errors gracefully (fall back to AST only)
- [ ] Write unit tests with mocked dependencies

**Acceptance Criteria:**
- [ ] AST and semantic results merged correctly
- [ ] Deduplication works when same file found by both sources
- [ ] Path restrictions filter results correctly
- [ ] Graceful degradation when either source fails
- [ ] Results sorted by combined score

---

## Phase 4: Builder and Budget Enforcement (Backend)

### T07: Implement BudgetEnforcer

**File:** `src/core/context_package/budget.py`
**Test:** `tests/unit/core/context_package/test_budget.py`
**Estimate:** 1.5hr
**Stories:** US-04

**Subtasks:**
- [ ] Create `BudgetEnforcer` class with TokenCounter dependency
- [ ] Implement `enforce()` method:
  - Sort scored_files by combined_score descending
  - Include files sequentially until budget reached
  - For files that would exceed budget: truncation strategy
    - "relevance": skip file entirely
    - "signature_only": include only symbol signatures from the file
  - Return (list[FileContent], actual_token_count)
- [ ] Implement minimum relevance threshold filtering (exclude below threshold)
- [ ] Handle edge cases:
  - Empty file list returns empty result
  - Single file exceeding budget: include signature-only
  - All files below minimum relevance: return empty result
- [ ] Write unit tests covering all truncation scenarios

**Acceptance Criteria:**
- [ ] Budget never exceeded in output
- [ ] Highest-relevance files always included first
- [ ] Signature-only fallback works for marginal files
- [ ] Minimum relevance threshold applied before budget check
- [ ] Accurate token count in output

---

### T08: Implement ContextPackageBuilder

**File:** `src/core/context_package/builder.py`
**Test:** `tests/unit/core/context_package/test_builder.py`
**Estimate:** 2hr
**Stories:** US-01, US-09

**Subtasks:**
- [ ] Create `ContextPackageBuilder` class with injected dependencies:
  - RepoMapper
  - KnowledgeStore search callable
  - TokenCounter
  - ContextPackageConfig
- [ ] Implement `build()` method orchestrating the full pipeline:
  1. TaskAnalyzer.analyze(task_description)
  2. ContextAssembler.assemble(analysis, agent_role, path_restrictions)
  3. BudgetEnforcer.enforce(scored_files, token_budget)
  4. Construct ContextPack from results
  5. Validate output
- [ ] Implement `build_from_task_context()` convenience method (takes TaskContext)
- [ ] Implement `validate()` method for ContextPack:
  - All file paths resolvable in repository
  - Token count matches actual count
  - Relevance scores in 0.0-1.0 range
  - No duplicate file paths
  - At least one file (or explicit empty signal)
- [ ] Implement path restriction resolution from guardrails:
  - Accept agent_role, look up path restrictions from guardrails evaluator
  - Or accept explicit path_restrictions parameter
- [ ] Handle disabled config (CONTEXT_PACKAGE_ENABLED=false): return empty ContextPack
- [ ] Handle builder errors: log, raise ContextAssemblyError
- [ ] Write unit tests with mocked dependencies covering success, failure, and edge cases

**Acceptance Criteria:**
- [ ] Full pipeline executes in under 5 seconds
- [ ] Output ContextPack is valid and well-formed
- [ ] Validation catches broken file references
- [ ] Graceful handling of disabled config
- [ ] Error handling is clean and informative

---

### T09: Context Package Integration Tests

**File:** `tests/integration/test_context_package_integration.py`
**Estimate:** 1.5hr
**Stories:** US-01, US-03, US-04

**Subtasks:**
- [ ] Create test fixtures with sample repository files
- [ ] Test full build pipeline with real RepoMapper (using test fixtures)
- [ ] Test build with mocked KnowledgeStore (semantic search)
- [ ] Test budget enforcement with real token counting
- [ ] Test path restriction filtering
- [ ] Test validation catches broken references
- [ ] Test performance: full build under 5 seconds

**Acceptance Criteria:**
- [ ] Integration tests pass against real RepoMapper
- [ ] Token budget enforcement verified with real counts
- [ ] Performance target met

---

## Phase 5: Repo Mapper Indexing Service (Backend)

### T10: Implement RepoMapperIndexingService

**File:** `src/workers/repo_mapper/indexing_service.py`
**Test:** `tests/unit/workers/repo_mapper/test_indexing_service.py`
**Estimate:** 2hr
**Stories:** US-06

**Subtasks:**
- [ ] Create `RepoMapperIndexingService` class with RepoMapper and KnowledgeStore dependencies
- [ ] Implement `get_changed_files(since_sha)` using `git diff --name-only`
- [ ] Implement `run_scan(mode)`:
  - "full": parse all supported files via ParserRegistry
  - "incremental": parse only changed files from git diff
  - Build/refresh ASTContext
  - Return ScanResult with statistics
- [ ] Implement `index_structural_metadata(ast_context)`:
  - Index file summaries (path, language, symbol count, exports)
  - Index symbol definitions (name, kind, signature, file, line)
  - Index import relationships
  - Use KnowledgeStore.index_document() for each entry
  - Return count of documents indexed
- [ ] Define `ScanResult` dataclass
- [ ] Handle parse errors gracefully (skip bad files, log warning)
- [ ] Write unit tests with mocked KnowledgeStore

**Acceptance Criteria:**
- [ ] Full scan parses all supported file types
- [ ] Incremental scan only processes changed files
- [ ] Structural metadata indexed into KnowledgeStore
- [ ] Parse errors handled gracefully
- [ ] ScanResult has accurate statistics

---

### T11: Implement CLI Scan Wrapper

**File:** `scripts/run_repo_scan.py`
**Test:** `tests/unit/scripts/test_run_repo_scan.py`
**Estimate:** 45min
**Stories:** US-11

**Subtasks:**
- [ ] Create CLI script with argparse
- [ ] Add `--mode full|incremental` flag (default: incremental)
- [ ] Add `--repo-path` flag (default: current directory)
- [ ] Add `--es-url` flag for KnowledgeStore connection
- [ ] Add `--local-only` flag to output to local files instead of KnowledgeStore
- [ ] Report scan results to stdout (JSON format)
- [ ] Return exit code 0/1
- [ ] Write basic unit tests for CLI argument parsing

**Acceptance Criteria:**
- [ ] CLI parses arguments correctly
- [ ] Full and incremental modes work
- [ ] Local-only mode works without KnowledgeStore
- [ ] Results printed as JSON to stdout

---

### T12: Indexing Service Integration Tests

**File:** `tests/integration/test_indexing_service_integration.py`
**Estimate:** 1hr
**Stories:** US-06

**Subtasks:**
- [ ] Test full scan on project source files (limited scope directory)
- [ ] Test incremental scan after file modification
- [ ] Test metadata indexing with mocked KnowledgeStore
- [ ] Verify indexed documents contain expected fields
- [ ] Test scan with syntax errors in fixtures

**Acceptance Criteria:**
- [ ] Full and incremental scans work on real files
- [ ] Indexed metadata is correctly structured
- [ ] Error handling verified

---

## Phase 6: Hook Integration and Guardrail (Backend + Orchestrator)

### T13: Create Repo Mapper Agent Definition

**File:** `.claude/agents/repo-mapper.md`
**Estimate:** 30min
**Stories:** US-05

**Subtasks:**
- [ ] Create agent definition following existing format (YAML frontmatter + markdown body)
- [ ] Set tools to Read, Glob, Grep only (READ-ONLY)
- [ ] Write agent description covering scanning responsibilities
- [ ] Reference guardrails integration pattern
- [ ] Document invocation pattern for PM CLI

**Acceptance Criteria:**
- [ ] Agent definition is valid (parseable frontmatter)
- [ ] Tools limited to read-only operations
- [ ] Description is clear and complete

---

### T14: Add Context Package Enforcement Guardrail

**File:** `scripts/bootstrap_guardrails.py` (modify existing)
**Test:** `tests/unit/scripts/test_bootstrap_guardrails.py` (extend existing)
**Estimate:** 30min
**Stories:** US-08

**Subtasks:**
- [ ] Add `context-package-enforcement` guideline to bootstrap script
- [ ] Set category to `context_constraint`, priority to 750
- [ ] Target backend and frontend agents during implement/code/fix/refactor/test actions
- [ ] Set type to `instruction` (advisory, not blocking)
- [ ] Write instruction text advising agents to work within context packages
- [ ] Verify idempotency (existing guideline not duplicated)
- [ ] Write unit test for the new guideline

**Acceptance Criteria:**
- [ ] Guideline created on bootstrap
- [ ] Idempotent on repeated runs
- [ ] Matches correct agents and actions
- [ ] Instruction text is clear

---

### T15: Enhance SubagentStart Hook with Context Injection

**File:** `.claude/hooks/guardrails-subagent.py` (modify existing)
**Test:** `tests/unit/hooks/test_guardrails_subagent.py` (extend existing)
**Estimate:** 1.5hr
**Stories:** US-07

**Subtasks:**
- [ ] Add context package building to SubagentStart hook:
  - Check if CONTEXT_PACKAGE_ENABLED
  - Read task description from hook input JSON (field: `taskDescription` if available)
  - Import and call ContextPackageBuilder.build()
  - Format context package as summary (file list, symbols, dependencies)
- [ ] Implement summary formatting:
  - Header with task, file count, token count, budget
  - Key files section with path, relevance score, and top symbols
  - Dependencies section with import edges
  - Respect CONTEXT_PACKAGE_SUMMARY_MAX_TOKENS limit
- [ ] Combine context summary with guardrails into `additionalContext`
- [ ] Cache context package in temp file alongside guardrails cache
- [ ] Handle builder failure gracefully (log warning, continue without context)
- [ ] Write unit tests for context injection and summary formatting

**Acceptance Criteria:**
- [ ] Hook builds and injects context package summary
- [ ] Summary format is clear and structured
- [ ] Summary stays within token limit
- [ ] Hook still always exits 0
- [ ] Builder failure does not block subagent startup

---

### T16: End-to-End Integration Tests

**File:** `tests/integration/test_context_package_e2e.py`
**Estimate:** 1.5hr
**Stories:** US-01, US-07, US-08

**Subtasks:**
- [ ] Test full SubagentStart hook with context package injection
- [ ] Test context package builder with real RepoMapper on project files
- [ ] Test guardrail bootstrap includes context-package-enforcement
- [ ] Test guardrail evaluates correctly for backend implement action
- [ ] Test end-to-end: hook input -> analysis -> assembly -> budget -> summary output
- [ ] Test performance: full hook execution under 5 seconds

**Acceptance Criteria:**
- [ ] E2E flow works from hook input to additionalContext output
- [ ] Guardrail correctly matches and provides instruction
- [ ] Performance target met

---

## Progress

- **Started**: --
- **Tasks Complete**: 0/16
- **Percentage**: 0%
- **Status**: NOT_STARTED
- **Blockers**: None

## Task Summary

| Task | Description | Phase | Estimate | Status | Stories |
|------|-------------|-------|----------|--------|---------|
| T01 | ContextPackage Configuration | 1 | 45min | [ ] | US-10 |
| T02 | ContextPackage Exceptions | 1 | 20min | [ ] | US-09 |
| T03 | TaskAnalysis Data Model | 2 | 30min | [ ] | US-02 |
| T04 | TaskAnalyzer Implementation | 2 | 1.5hr | [ ] | US-02 |
| T05 | ScoredFile Data Model | 3 | 20min | [ ] | US-03 |
| T06 | ContextAssembler Implementation | 3 | 2hr | [ ] | US-03 |
| T07 | BudgetEnforcer Implementation | 4 | 1.5hr | [ ] | US-04 |
| T08 | ContextPackageBuilder Implementation | 4 | 2hr | [ ] | US-01, US-09 |
| T09 | Context Package Integration Tests | 4 | 1.5hr | [ ] | US-01, US-03, US-04 |
| T10 | RepoMapperIndexingService | 5 | 2hr | [ ] | US-06 |
| T11 | CLI Scan Wrapper | 5 | 45min | [ ] | US-11 |
| T12 | Indexing Service Integration Tests | 5 | 1hr | [ ] | US-06 |
| T13 | Repo Mapper Agent Definition | 6 | 30min | [ ] | US-05 |
| T14 | Context Package Enforcement Guardrail | 6 | 30min | [ ] | US-08 |
| T15 | SubagentStart Hook Enhancement | 6 | 1.5hr | [ ] | US-07 |
| T16 | End-to-End Integration Tests | 6 | 1.5hr | [ ] | US-01, US-07, US-08 |

**Total Estimated Time:** ~16.5 hours

## Task Dependencies

```
T01 ──┐
      ├──► T03 ──► T04 ──► T05 ──► T06 ──► T07 ──► T08 ──► T09
T02 ──┘                                                  │
                                                         │
                    T10 ──► T11 ──► T12 ◄────────────────┘
                                                         │
                    T13 ──► T14 ──► T15 ──► T16 ◄────────┘
```

**Parallelization opportunities:**
- T01 and T02 can run in parallel (config and exceptions are independent)
- T10-T12 (indexing service) can start after T06 (assembler needs indexing service only for integration)
- T13 (agent definition) can start independently (meta file, no code dependency)

## Implementation Order (Recommended Build Sequence)

```
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 (can overlap with Phase 4) -> Phase 6
```

**Day 1: Foundation (Phase 1 + 2)**
1. T01, T02 (Config, Exceptions) -- parallel
2. T03 (TaskAnalysis model)
3. T04 (TaskAnalyzer implementation)

**Day 2: Assembly (Phase 3 + start of Phase 4)**
4. T05 (ScoredFile model)
5. T06 (ContextAssembler)
6. T07 (BudgetEnforcer)

**Day 3: Builder + Indexing (Phase 4 + 5)**
7. T08 (ContextPackageBuilder)
8. T09 (Integration tests)
9. T10 (IndexingService) -- can start in parallel with T08
10. T11 (CLI scan wrapper)
11. T12 (Indexing integration tests)

**Day 4: Integration (Phase 6)**
12. T13 (Agent definition)
13. T14 (Guardrail bootstrap)
14. T15 (Hook enhancement)
15. T16 (E2E integration tests)

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `pytest tests/unit/core/context_package/ -v`
- [ ] All unit tests pass: `pytest tests/unit/workers/repo_mapper/test_indexing_service.py -v`
- [ ] All integration tests pass: `pytest tests/integration/test_context_package*.py -v`
- [ ] Linter passes: `./tools/lint.sh src/core/context_package/`
- [ ] No type errors: `mypy src/core/context_package/`
- [ ] Agent definition created at `.claude/agents/repo-mapper.md`
- [ ] Bootstrap script updated with new guideline
- [ ] SubagentStart hook enhanced with context injection
- [ ] Performance targets met (build <5s, scan <30s)
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md

## Notes

### Testing Strategy

- **Unit tests** mock RepoMapper, KnowledgeStore, and TokenCounter for fast execution
- **Integration tests** use real RepoMapper with test fixture files
- **KnowledgeStore** mocked in integration tests (real ES requires Docker)
- **Performance tests** verify timing constraints with real components
- **Hook tests** verify stdin/stdout JSON contract and exit codes

### Risk Mitigation

1. **RepoMapper cache cold on first run**: First build triggers AST refresh. Subsequent builds use cache. Documented as expected behavior.
2. **KnowledgeStore unavailable**: Graceful fallback to AST-only context. Documented in US-01.
3. **Large repositories**: Token budget and incremental scanning prevent runaway processing. Configurable limits.
4. **Hook latency**: Context package build targets <5s. If exceeded, hook logs warning and continues without context.
5. **Prompt size**: Context summary (not full content) keeps hook output small. Configurable max tokens.
