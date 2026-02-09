# User Stories: P12-F03 Chain-of-Thought Persistence & Artifact Lineage

## Epic Reference

This feature closes two critical forensic traceability gaps identified in the Guardrails Constitution (G9):
- **CRITICAL (C3):** No Chain-of-Thought persistence -- agent reasoning is not captured, breaking the forensic trail.
- **HIGH (H4):** No Artifact Lineage tracking -- cannot trace code back through design to requirement.

## Epic Summary

As a project maintainer, I want every agent's reasoning persisted as an immutable audit trail and every artifact tagged with lineage metadata, so that I can reconstruct "why" any decision was made and trace any line of code back to its originating requirement.

## User Stories

### US-F03-01: Define CoT Trace Data Models

**As a** system architect
**I want** well-defined data models for Chain-of-Thought traces
**So that** agent reasoning has a consistent, structured schema for persistence

**Acceptance Criteria:**
- [ ] `CoTTrace` frozen dataclass defined with all fields (id, task_id, session_id, agent_id, agent_type, step_number, reasoning_text, decision, artifacts_produced, files_intended, files_actual, parent_trace_id, git_sha, epic_id, duration_ms, token_count, timestamp, metadata)
- [ ] `to_dict()` and `from_dict()` methods support JSON round-trip serialization
- [ ] `ArtifactType` enum covers all artifact categories (code, test, spec, design, config, plan, diagram, contract, review, other)
- [ ] Unit tests verify field validation, serialization, and enum values

**Priority:** High

---

### US-F03-02: Define Artifact Lineage Data Models

**As a** system architect
**I want** well-defined data models for artifact lineage records
**So that** every artifact has structured traceability metadata

**Acceptance Criteria:**
- [ ] `ArtifactLineage` frozen dataclass defined with all fields (id, artifact_path, artifact_type, source_agent_id, parent_artifact_id, task_id, epic_id, session_id, git_sha, cot_trace_id, lineage_chain, created_at, metadata)
- [ ] `ScopeAdherenceResult` frozen dataclass defined with comparison fields
- [ ] `to_dict()` and `from_dict()` methods on all models
- [ ] Unit tests verify lineage chain structure and serialization

**Priority:** High

---

### US-F03-03: Define CoT Exceptions and Configuration

**As a** developer
**I want** CoT-specific exceptions and configuration following existing patterns
**So that** error handling and configuration are consistent with guardrails and other modules

**Acceptance Criteria:**
- [ ] `CoTError` base exception inherits from `ASDLCError`
- [ ] `CoTTraceNotFoundError`, `LineageNotFoundError`, `CoTValidationError` defined
- [ ] `CoTConfig` dataclass with `from_env()` for environment-based configuration
- [ ] Config supports all documented environment variables (COT_ENABLED, COT_RETENTION_DAYS, etc.)
- [ ] Unit tests verify exception hierarchy and config loading

**Priority:** High

---

### US-F03-04: Create Elasticsearch Index Mappings

**As a** platform engineer
**I want** Elasticsearch indices for CoT traces, artifact lineage, and scope adherence
**So that** forensic data is persisted and queryable

**Acceptance Criteria:**
- [ ] `cot-traces` index mapping defined with all fields, keyword types for filters, text type for reasoning_text
- [ ] `artifact-lineage` index mapping defined with all fields
- [ ] `scope-adherence` index mapping defined with all fields
- [ ] All indices support multi-tenancy via tenant_id field
- [ ] Index creation is idempotent (same pattern as guardrails_mappings.py)
- [ ] Mappings follow existing pattern: 1 shard, 0 replicas
- [ ] Unit tests verify mapping structure

**Priority:** High

---

### US-F03-05: Implement CoT Store (Elasticsearch)

**As a** developer
**I want** an Elasticsearch store for persisting and querying CoT traces
**So that** agent reasoning is durably stored and searchable

**Acceptance Criteria:**
- [ ] `CoTStore` class with async CRUD following `GuardrailsStore` pattern
- [ ] `store_trace()` creates append-only trace documents
- [ ] `get_trace()` retrieves by ID, raises `CoTTraceNotFoundError` if missing
- [ ] `list_traces_by_task()` returns traces ordered by step_number with pagination
- [ ] `list_traces_by_session()` returns traces ordered by timestamp with pagination
- [ ] `search_traces()` supports full-text search on reasoning_text
- [ ] `store_adherence_result()` persists scope adherence results
- [ ] Index creation is idempotent
- [ ] `close()` method releases ES client resources
- [ ] Unit tests with mocked ES client cover all methods

**Priority:** High

---

### US-F03-06: Implement Lineage Store (Elasticsearch)

**As a** developer
**I want** an Elasticsearch store for persisting and querying artifact lineage
**So that** artifact traceability is durably stored and queryable

**Acceptance Criteria:**
- [ ] `LineageStore` class with async CRUD following `GuardrailsStore` pattern
- [ ] `create_lineage()` creates lineage records
- [ ] `get_lineage()` retrieves by ID, raises `LineageNotFoundError` if missing
- [ ] `get_lineage_by_path()` returns all lineage records for a file path (history)
- [ ] `get_lineage_chain()` returns the full ancestor chain for an artifact
- [ ] `get_lineage_by_task()` and `get_lineage_by_epic()` support task/epic queries
- [ ] `search_lineage()` supports filtered search (agent, type, epic)
- [ ] `close()` method releases ES client resources
- [ ] Unit tests with mocked ES client cover all methods

**Priority:** High

---

### US-F03-07: Implement Scope Adherence Checker

**As a** reviewer
**I want** automated comparison of intended vs actual file modifications
**So that** I can verify agents only modified files they claimed they would

**Acceptance Criteria:**
- [ ] `ScopeAdherenceChecker.check()` compares intended vs actual file lists
- [ ] Correctly identifies unexpected files (modified but not declared)
- [ ] Correctly identifies missing files (declared but not modified)
- [ ] Computes adherence_score as matched/max(intended, actual)
- [ ] Sets is_compliant=True only when no unexpected files exist
- [ ] Handles edge cases: empty lists, identical lists, completely disjoint lists
- [ ] Unit tests cover all comparison scenarios

**Priority:** High

---

### US-F03-08: Implement Artifact Type Detection

**As a** developer
**I want** automatic detection of artifact types from file paths
**So that** lineage records are automatically categorized without manual tagging

**Acceptance Criteria:**
- [ ] `detect_artifact_type()` correctly classifies paths by extension and path patterns
- [ ] Test files detected by path patterns (test_, _test, .test.ts, .test.tsx)
- [ ] Design docs, specs, plans, diagrams, contracts detected by path and extension
- [ ] Source code files detected by extension (.py, .ts, .tsx, .js, .sh)
- [ ] Config files detected by extension (.json, .yaml, .yml, .toml)
- [ ] Unknown files default to ArtifactType.OTHER
- [ ] Unit tests cover all artifact type classifications

**Priority:** Medium

---

### US-F03-09: Implement PR Template Generator

**As a** project maintainer
**I want** automated PR descriptions with forensic traceability data
**So that** Git history becomes a forensic map connecting reasoning to code changes

**Acceptance Criteria:**
- [ ] `PRTemplateGenerator.generate()` produces Markdown PR descriptions
- [ ] Template includes task summary, epic reference, agents involved
- [ ] Template includes condensed reasoning summary from CoT traces
- [ ] Template includes file modification table with lineage links
- [ ] Template includes scope adherence report (score, unexpected/missing files)
- [ ] Template includes test results summary if available
- [ ] Template includes links to full reasoning log in Elasticsearch
- [ ] Handles edge cases: no traces, no lineage, no test results
- [ ] Unit tests verify template generation for various inputs

**Priority:** Medium

---

### US-F03-10: Create PostToolUse CoT Capture Hook

**As a** developer
**I want** a PostToolUse hook that captures agent reasoning after tool calls
**So that** CoT traces are automatically recorded without agent modification

**Acceptance Criteria:**
- [ ] Hook script at `.claude/hooks/cot-capture.py` executes on PostToolUse for Write/Edit/Bash
- [ ] Extracts file paths from tool arguments
- [ ] Creates CoTTrace records with appropriate fields populated
- [ ] Writes to ES asynchronously (best-effort)
- [ ] Falls back to local file storage when ES unavailable
- [ ] Completes within 500ms timeout
- [ ] Always exits 0 (never blocks tool execution)
- [ ] Updates session cache with latest trace ID for chaining
- [ ] Unit tests verify hook input/output format and exit codes

**Priority:** High

---

### US-F03-11: Create CoT MCP Server

**As a** agent developer
**I want** MCP tools for logging reasoning and recording lineage
**So that** agents can explicitly record their CoT and artifact provenance

**Acceptance Criteria:**
- [ ] Standalone MCP server at `src/infrastructure/cot/cot_mcp.py`
- [ ] `cot_log_reasoning` tool accepts all trace fields and persists to ES
- [ ] `cot_get_traces` tool retrieves traces by task_id with pagination
- [ ] `lineage_record` tool accepts all lineage fields and persists to ES
- [ ] `lineage_query` tool returns the lineage chain for an artifact path
- [ ] MCP protocol: initialize, tools/list, tools/call all work correctly
- [ ] Error handling returns structured error responses
- [ ] Unit tests verify each tool and MCP protocol
- [ ] Integration tests verify full MCP flow with mocked ES

**Priority:** High

---

### US-F03-12: Implement REST API for CoT Traces

**As a** HITL UI developer
**I want** REST endpoints for querying CoT traces
**So that** the dashboard can display agent reasoning history

**Acceptance Criteria:**
- [ ] GET /api/cot/traces lists traces with task_id, session_id, agent_id filters
- [ ] GET /api/cot/traces/{trace_id} returns a single trace
- [ ] GET /api/cot/traces/search supports full-text search on reasoning
- [ ] All endpoints paginated with page/page_size parameters
- [ ] Returns 404 for missing traces
- [ ] Pydantic models for all request/response schemas
- [ ] Unit tests verify endpoints with mocked store

**Priority:** Medium

---

### US-F03-13: Implement REST API for Lineage

**As a** HITL UI developer
**I want** REST endpoints for querying artifact lineage
**So that** the dashboard can display lineage chains and artifact history

**Acceptance Criteria:**
- [ ] GET /api/lineage lists lineage records with filters (path, task, epic, agent, type)
- [ ] GET /api/lineage/{lineage_id} returns a single lineage record
- [ ] GET /api/lineage/chain/{artifact_path} returns the full lineage chain for an artifact
- [ ] All endpoints paginated
- [ ] Returns 404 for missing records
- [ ] Pydantic models for all request/response schemas
- [ ] Unit tests verify endpoints with mocked store

**Priority:** Medium

---

### US-F03-14: Implement REST API for Scope Adherence and PR Template

**As a** HITL UI developer
**I want** REST endpoints for scope adherence results and PR templates
**So that** the dashboard can display compliance data and generate PR descriptions

**Acceptance Criteria:**
- [ ] GET /api/cot/adherence lists adherence results with filters (task, agent, compliant)
- [ ] GET /api/cot/pr-template/{task_id} generates and returns a PR template
- [ ] Adherence endpoint paginated
- [ ] PR template endpoint handles missing data gracefully
- [ ] Pydantic models for request/response schemas
- [ ] Unit tests verify endpoints

**Priority:** Medium

---

### US-F03-15: Build CoT Trace Viewer UI Component

**As a** project maintainer
**I want** a UI component to browse and search CoT traces
**So that** I can understand why agents made specific decisions

**Acceptance Criteria:**
- [ ] CoTTraceViewer component displays traces for a selected task
- [ ] Each trace shows step_number, reasoning_text, decision, files, score
- [ ] Traces ordered by step_number with expand/collapse for reasoning text
- [ ] CoTTraceCard component shows summary with expandable detail
- [ ] Search input filters traces by reasoning text
- [ ] Task ID selector loads traces for the selected task
- [ ] Loading and empty states handled
- [ ] Unit tests verify rendering and interactions

**Priority:** Medium

---

### US-F03-16: Build Lineage Explorer UI Component

**As a** project maintainer
**I want** a visual lineage explorer showing the requirement-to-code chain
**So that** I can trace any artifact back to its origin

**Acceptance Criteria:**
- [ ] LineageExplorer component displays the lineage graph for an artifact
- [ ] Search by artifact path to find its lineage
- [ ] LineageChain component visualizes the chain as a tree (PRD > Design > Code > Test)
- [ ] Each node shows artifact type, source agent, timestamp
- [ ] Clicking a node navigates to the artifact detail or CoT trace
- [ ] Loading and empty states handled
- [ ] Unit tests verify rendering and navigation

**Priority:** Medium

---

### US-F03-17: Build Scope Adherence Panel and PR Preview

**As a** project maintainer
**I want** UI panels for scope adherence and PR template preview
**So that** I can verify scope compliance and preview forensic PR descriptions

**Acceptance Criteria:**
- [ ] ScopeAdherencePanel displays adherence results for a task
- [ ] Shows adherence score, unexpected files (red), missing files (yellow)
- [ ] Visual indicator (green/yellow/red) for compliance status
- [ ] PRTemplatePreview component renders the generated PR Markdown
- [ ] Copy-to-clipboard button for the PR template
- [ ] Unit tests verify rendering and copy functionality

**Priority:** Low

---

### US-F03-18: Build Lineage Page and Navigation

**As a** HITL UI user
**I want** a dedicated Forensic Traceability page accessible from the navigation
**So that** I can access all forensic tools from a single location

**Acceptance Criteria:**
- [ ] LineagePage component with tabbed layout (CoT Traces, Lineage Explorer, Scope Adherence)
- [ ] Route /lineage added to App.tsx
- [ ] Navigation item added to sidebar
- [ ] Tab state preserved during navigation
- [ ] Responsive layout
- [ ] Unit tests verify page rendering and tab switching

**Priority:** Medium

---

### US-F03-19: Create TypeScript Types and API Client

**As a** frontend developer
**I want** TypeScript types and API client functions for CoT and lineage
**So that** UI components have type-safe access to the backend

**Acceptance Criteria:**
- [ ] TypeScript interfaces for CoTTrace, ArtifactLineage, ScopeAdherenceResult, PRTemplate
- [ ] API client functions for all REST endpoints (list, get, search, chain)
- [ ] Mock data covering all artifact types and scenarios
- [ ] React Query hooks with proper cache keys
- [ ] Error handling for API failures
- [ ] Unit tests verify API functions and type contracts

**Priority:** Medium

---

### US-F03-20: Create Zustand Store for CoT/Lineage State

**As a** frontend developer
**I want** a Zustand store managing CoT and lineage UI state
**So that** components share state consistently

**Acceptance Criteria:**
- [ ] Store holds selected task, traces, lineage, adherence data
- [ ] Filter state (task_id, agent_id, search query) managed
- [ ] Tab selection state for LineagePage
- [ ] Loading and error states per data type
- [ ] Unit tests verify state transitions

**Priority:** Medium

---

### US-F03-21: Write Integration Tests

**As a** developer
**I want** integration tests for CoT and lineage stores
**So that** the ES integration is verified end-to-end

**Acceptance Criteria:**
- [ ] Integration test for CoTStore: store trace, get trace, list by task, search
- [ ] Integration test for LineageStore: create, get, get chain, search
- [ ] Integration test for CoT MCP server: log reasoning, get traces, record lineage, query lineage
- [ ] Tests use mocked ES (unit) and real ES (integration, when available)
- [ ] Tests clean up indices after execution

**Priority:** High

---

### US-F03-22: Update Hook Configuration

**As a** project maintainer
**I want** the CoT capture hook properly registered in settings.json
**So that** CoT capture activates automatically during agent execution

**Acceptance Criteria:**
- [ ] PostToolUse hook registered in `.claude/settings.json` for Write, Edit, and Bash tools
- [ ] Hook timeout set to 500ms
- [ ] Hook chains correctly with existing guardrails-enforce.py hook
- [ ] Documentation updated in CLAUDE.md and guardrails README

**Priority:** Medium
