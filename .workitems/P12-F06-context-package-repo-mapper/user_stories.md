# P12-F06: Context Package Assembly & Repo Mapper Agent - User Stories

## Epic Summary

Close HIGH and MEDIUM guardrails constitution gaps by implementing a formal context assembly pipeline and a Repo Mapper agent definition. Every agent task receives a pre-built, closed context package rather than relying on ad-hoc global search. The Repo Mapper agent continuously maintains structural metadata as the "Technical Source of Truth."

## User Stories

### US-01: Build Context Package for Agent Task

**As** the PM CLI delegating a task to a subagent
**I want** a closed context package assembled automatically before the agent starts
**So that** the agent receives only relevant, filtered information instead of pulling arbitrary global context

**Acceptance Criteria:**
- [ ] ContextPackageBuilder accepts task description, agent role, domain, and optional target files
- [ ] Builder queries both RepoMapper (AST/dependency) and KnowledgeStore (semantic search)
- [ ] Builder merges and deduplicates results from both sources
- [ ] Builder filters results by agent path restrictions
- [ ] Output is a valid ContextPack with relevance-scored files
- [ ] Build completes in under 5 seconds
- [ ] Build works when RepoMapper cache is cold (triggers refresh)
- [ ] Build works when KnowledgeStore is unavailable (falls back to AST-only)

**Test Scenarios:**
- Build context for a backend implementation task with explicit target files
- Build context for a task with only a description (no target files)
- Build context when KnowledgeStore is down (graceful degradation)
- Build context when RepoMapper AST cache is stale
- Verify path restrictions exclude files outside agent domain

---

### US-02: Analyze Task Description for Context Hints

**As** the ContextPackageBuilder
**I want** to extract structured context hints from a task description
**So that** I can query the right sources for relevant code

**Acceptance Criteria:**
- [ ] TaskAnalyzer extracts file paths mentioned in the description (e.g., `src/core/models.py`)
- [ ] TaskAnalyzer extracts symbol names (e.g., class names, function names)
- [ ] TaskAnalyzer detects the domain from path prefixes (e.g., `src/workers/` maps to P03)
- [ ] TaskAnalyzer detects the action type from keywords (implement, review, test, fix)
- [ ] TaskAnalyzer extracts keywords suitable for semantic search
- [ ] Analysis completes in under 50ms
- [ ] Returns a frozen TaskAnalysis dataclass

**Test Scenarios:**
- Analyze "Implement the TokenCounter class in src/workers/repo_mapper/token_counter.py"
- Analyze "Fix the bug in dependency graph resolution"
- Analyze "Review the guardrails evaluator for edge cases"
- Analyze a description with no file paths or symbol names
- Analyze a description with multiple file paths

---

### US-03: Merge AST and Semantic Search Results

**As** the ContextAssembler
**I want** to combine results from RepoMapper and KnowledgeStore into a unified scored list
**So that** the context package includes both structurally and conceptually relevant files

**Acceptance Criteria:**
- [ ] AST results include dependency graph neighbors of target files
- [ ] Semantic results come from KnowledgeStore query using extracted keywords
- [ ] Results are deduplicated by file path (same file from both sources gets combined score)
- [ ] Combined score is a weighted average: `ast_weight * ast_score + semantic_weight * semantic_score`
- [ ] Files from only one source get the single-source score with the other set to 0
- [ ] Results are sorted by combined score descending
- [ ] Agent path restrictions are applied as a filter (files outside agent domain excluded)

**Test Scenarios:**
- Merge when both sources return overlapping files (deduplication)
- Merge when AST returns files not in semantic results
- Merge when semantic returns files not in AST results
- Apply path restrictions that exclude some results
- Merge with empty AST results (KnowledgeStore only)
- Merge with empty semantic results (AST only)

---

### US-04: Enforce Token Budget on Context Package

**As** the BudgetEnforcer
**I want** to ensure the context package does not exceed its token budget
**So that** agents receive focused context within their token limits

**Acceptance Criteria:**
- [ ] Files sorted by relevance score, highest first
- [ ] Files included sequentially until budget is reached
- [ ] When a file would exceed the budget: include only its symbol signatures (truncated mode)
- [ ] Token count uses the existing TokenCounter (tiktoken cl100k_base)
- [ ] Final ContextPack.token_count is accurate
- [ ] Final ContextPack.token_budget matches the configured limit
- [ ] When total content is under budget, all files included without truncation
- [ ] Minimum relevance threshold applied (files below threshold excluded regardless of budget)

**Test Scenarios:**
- Budget of 100K tokens with 50K tokens of content (no truncation needed)
- Budget of 10K tokens with 50K tokens of content (truncation required)
- Budget enforcement with signature-only fallback for low-priority files
- All files below minimum relevance threshold
- Single very large file that exceeds entire budget

---

### US-05: Define Repo Mapper Agent

**As** the PM CLI
**I want** a Repo Mapper agent definition
**So that** structural scanning is a formal agent role with defined responsibilities and restrictions

**Acceptance Criteria:**
- [ ] Agent definition at `.claude/agents/repo-mapper.md` follows existing agent format
- [ ] Agent has READ-ONLY access to all source code paths
- [ ] Agent tools limited to Read, Glob, Grep (no Write, Edit, or Bash)
- [ ] Agent description covers: scanning codebase structure, maintaining dependency graph, extracting symbol maps
- [ ] Agent produces structured JSON output (ast_context.json, scan results)
- [ ] Agent can be invoked by PM CLI like other agents
- [ ] Agent definition references guardrails integration pattern

**Test Scenarios:**
- Verify agent definition parses correctly (valid YAML frontmatter)
- Verify tool restrictions prevent writes
- Verify agent can be invoked from PM CLI

---

### US-06: Run Repository Structure Scan

**As** the Repo Mapper agent
**I want** to scan the repository and index structural metadata into KnowledgeStore
**So that** the context assembly pipeline has up-to-date structural information

**Acceptance Criteria:**
- [ ] Incremental scan uses `git diff` to find changed files since last scan SHA
- [ ] Full scan parses all supported files (Python, TypeScript)
- [ ] Scan indexes file summaries into KnowledgeStore (path, language, symbols, exports)
- [ ] Scan indexes symbol definitions (name, kind, signature, file, line)
- [ ] Scan indexes import relationships (source module to target module)
- [ ] Scan produces a ScanResult with statistics (files scanned, symbols indexed, duration)
- [ ] Incremental scan completes in under 30 seconds for typical changes
- [ ] Full scan completes in under 5 minutes
- [ ] Scan handles parse errors gracefully (skip bad files, continue)

**Test Scenarios:**
- Full scan of test fixtures directory
- Incremental scan after modifying one file
- Scan with unparseable files (syntax errors)
- Verify indexed documents are queryable via KnowledgeStore
- Scan with no changes since last SHA

---

### US-07: Inject Context Package via SubagentStart Hook

**As** the aSDLC system
**I want** the SubagentStart hook to automatically build and inject a context package
**So that** every subagent starts with relevant, pre-filtered context

**Acceptance Criteria:**
- [ ] Hook reads task description from stdin JSON (if available in hook input)
- [ ] Hook calls ContextPackageBuilder to assemble context
- [ ] Context package formatted as a summary (file list, symbols, dependencies) not full content
- [ ] Summary injected into `additionalContext` alongside guardrails
- [ ] Summary stays within CONTEXT_PACKAGE_SUMMARY_MAX_TOKENS limit
- [ ] Hook still always exits 0 (never blocks subagent startup)
- [ ] Hook gracefully handles builder failure (logs warning, continues without context)
- [ ] Context package is cached in temp file alongside guardrails cache

**Test Scenarios:**
- SubagentStart with task description produces context summary
- SubagentStart without task description produces no context (graceful skip)
- SubagentStart when builder fails (KS down, RepoMapper error)
- Verify summary format includes file list and key symbols
- Verify summary does not exceed configured max tokens

---

### US-08: Enforce Context Package Discipline via Guardrail

**As** the guardrails system
**I want** a guideline that advises agents to work within their context package
**So that** agents are discouraged from ad-hoc global searching during implementation

**Acceptance Criteria:**
- [ ] New guideline `context-package-enforcement` added to bootstrap script
- [ ] Guideline targets backend and frontend agents during implementation actions
- [ ] Guideline is advisory (type: instruction), not blocking
- [ ] Instruction text tells agents to work within their context package
- [ ] Instruction advises reporting gaps rather than searching globally
- [ ] Bootstrap is idempotent (does not duplicate guideline on re-run)

**Test Scenarios:**
- Bootstrap creates guideline on first run
- Bootstrap skips guideline on second run (idempotent)
- Guideline matches backend agent performing "implement" action
- Guideline does not match reviewer agent
- Guideline instruction text is present in evaluated context

---

### US-09: Validate Context Package Integrity

**As** the ContextPackageBuilder
**I want** to validate that context packages are well-formed and resolvable
**So that** agents do not receive packages with broken references

**Acceptance Criteria:**
- [ ] All file_path references in the ContextPack are resolvable in the repository
- [ ] Token count matches the actual token count of included content
- [ ] Relevance scores are in valid range (0.0 to 1.0)
- [ ] No duplicate file paths in the package
- [ ] Package has at least one file (empty packages raise an error or return a clear signal)
- [ ] Validation errors produce clear error messages

**Test Scenarios:**
- Valid context package passes validation
- Package with non-existent file path fails validation
- Package with duplicate file paths fails validation
- Package with out-of-range relevance score fails validation
- Token count mismatch detected

---

### US-10: Configure Context Package System

**As** a developer
**I want** to configure context package behavior via environment variables
**So that** I can tune token budgets, scoring weights, and enable/disable the feature

**Acceptance Criteria:**
- [ ] CONTEXT_PACKAGE_ENABLED controls master enable/disable
- [ ] CONTEXT_PACKAGE_TOKEN_BUDGET sets default token budget
- [ ] CONTEXT_PACKAGE_AST_WEIGHT and CONTEXT_PACKAGE_SEMANTIC_WEIGHT control scoring
- [ ] CONTEXT_PACKAGE_MIN_RELEVANCE sets minimum inclusion threshold
- [ ] CONTEXT_PACKAGE_SUMMARY_MAX_TOKENS limits hook output size
- [ ] Configuration loaded via `ContextPackageConfig.from_env()`
- [ ] Invalid configuration values raise clear errors
- [ ] Defaults are sensible for the typical development workflow

**Test Scenarios:**
- Load config with all defaults
- Load config with custom values
- Invalid token budget (negative) raises error
- Weights that do not sum to 1.0 are normalized
- Disabled config causes builder to return empty ContextPack

---

### US-11: CLI Wrapper for Manual Repo Scan

**As** a developer
**I want** a CLI command to trigger a repository scan manually
**So that** I can refresh the structural index after major changes

**Acceptance Criteria:**
- [ ] Script at `scripts/run_repo_scan.py` with argparse CLI
- [ ] Supports `--mode full|incremental` flag
- [ ] Supports `--repo-path` flag (defaults to current directory)
- [ ] Reports scan results to stdout (files scanned, symbols indexed, duration)
- [ ] Returns exit code 0 on success, 1 on failure
- [ ] Can be run without KnowledgeStore (outputs to local files instead)

**Test Scenarios:**
- Run full scan on test fixtures
- Run incremental scan
- Run scan with invalid repo path
- Run scan without KnowledgeStore connection

## Definition of Done

- [ ] All unit tests pass for context_package module
- [ ] All unit tests pass for indexing_service
- [ ] Integration tests pass for full context assembly pipeline
- [ ] Repo Mapper agent definition created and valid
- [ ] SubagentStart hook enhanced with context injection
- [ ] Bootstrap script includes context-package-enforcement guideline
- [ ] CLI scan wrapper functional
- [ ] Documentation updated in design.md
- [ ] Performance targets met (build <5s, incremental scan <30s)
