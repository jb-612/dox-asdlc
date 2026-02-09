# P12-F03: Chain-of-Thought Persistence & Artifact Lineage - Tasks

## Overview

This task breakdown covers implementing CoT persistence and artifact lineage tracking. Tasks are organized into 7 phases following the technical architecture from design.md.

## Dependencies

### External Dependencies

- P01-F03: KnowledgeStore interface - COMPLETE
- P02-F04: Elasticsearch backend - COMPLETE
- P11-F01: Guardrails system (patterns) - COMPLETE
- P02-F01: Redis Streams / ASDLCEvent - COMPLETE
- P05-F01: HITL UI infrastructure - COMPLETE

### Phase Dependencies

```
Phase 1 (Models & Config) ────┐
                               ├──> Phase 3 (CoT Store) ──> Phase 5 (MCP + Hook)
Phase 2 (ES Mappings) ────────┘          |
                                         └──> Phase 4 (Lineage Store + Scope Checker)
                                                       |
                                              Phase 6 (REST API) <───────────┘
                                                       |
                                              Phase 7 (UI) <────────────────┘
```

---

## Phase 1: Data Models, Exceptions, and Configuration (Backend)

### T01: Create CoT Trace and Lineage Data Models

**Estimate**: 1.5hr
**Stories**: US-F03-01, US-F03-02

**Description**: Define core data models for CoT traces, artifact lineage, and scope adherence results.

**Subtasks**:
- [ ] Create `src/core/cot/__init__.py`
- [ ] Create `src/core/cot/models.py` with CoTTrace, ArtifactLineage, ScopeAdherenceResult frozen dataclasses
- [ ] Add `to_dict()` and `from_dict()` methods on all models
- [ ] Ensure all models are frozen (immutable)
- [ ] Write unit tests at `tests/unit/core/cot/test_models.py`

**Acceptance Criteria**:
- [ ] All dataclasses are frozen
- [ ] JSON serialization round-trips correctly
- [ ] Datetime fields handle ISO 8601 parsing
- [ ] Unit tests verify field validation and serialization

**Test Cases**:
- [ ] Test CoTTrace creation with all fields
- [ ] Test CoTTrace creation with minimal fields
- [ ] Test ArtifactLineage creation and serialization
- [ ] Test ScopeAdherenceResult creation and serialization
- [ ] Test JSON round-trip for each model
- [ ] Test datetime parsing from ISO strings

---

### T02: Create ArtifactType Enum and Detection Logic

**Estimate**: 1hr
**Stories**: US-F03-08

**Description**: Define the ArtifactType enum and implement path-based artifact type detection.

**Subtasks**:
- [ ] Create `src/core/cot/artifact_type.py` with ArtifactType enum
- [ ] Implement `detect_artifact_type(file_path: str) -> ArtifactType` function
- [ ] Handle all documented path patterns (test files, design docs, specs, diagrams, contracts, config, code)
- [ ] Default unknown paths to ArtifactType.OTHER
- [ ] Write unit tests at `tests/unit/core/cot/test_artifact_type.py`

**Acceptance Criteria**:
- [ ] Enum covers all artifact categories
- [ ] Detection function correctly classifies paths by extension and path patterns
- [ ] Edge cases handled (no extension, unusual paths)
- [ ] Unit tests cover all classifications

**Test Cases**:
- [ ] Test detection for .py source files
- [ ] Test detection for test files (test_, _test.py, .test.ts, .test.tsx)
- [ ] Test detection for design.md, tasks.md, user_stories.md
- [ ] Test detection for .mmd diagram files
- [ ] Test detection for contracts/ path
- [ ] Test detection for .json, .yaml config files
- [ ] Test detection for unknown extensions

---

### T03: Create CoT Exceptions and Configuration

**Estimate**: 1hr
**Stories**: US-F03-03

**Description**: Add CoT-specific exceptions and configuration class following guardrails patterns.

**Subtasks**:
- [ ] Create `src/core/cot/exceptions.py` with CoTError, CoTTraceNotFoundError, LineageNotFoundError, CoTValidationError
- [ ] Ensure all exceptions inherit from ASDLCError
- [ ] Create `src/core/cot/config.py` with CoTConfig dataclass and `from_env()` method
- [ ] Support all documented environment variables
- [ ] Write unit tests at `tests/unit/core/cot/test_exceptions.py` and `tests/unit/core/cot/test_config.py`

**Acceptance Criteria**:
- [ ] Exceptions follow ASDLCError pattern (message, details, to_dict)
- [ ] Config loads from environment with sensible defaults
- [ ] Config is frozen (immutable)
- [ ] Unit tests verify exception hierarchy and config loading

**Test Cases**:
- [ ] Test exception instantiation and inheritance
- [ ] Test exception to_dict() output
- [ ] Test config from_env() with defaults
- [ ] Test config from_env() with overrides
- [ ] Test COT_ENABLED parsing (true/false/1/0)

---

## Phase 2: Elasticsearch Index Mappings (Backend)

### T04: Create ES Index Mappings for CoT and Lineage

**Estimate**: 1hr
**Stories**: US-F03-04

**Description**: Define Elasticsearch index mappings for all three indices.

**Subtasks**:
- [ ] Create `src/infrastructure/cot/__init__.py`
- [ ] Create `src/infrastructure/cot/cot_mappings.py`
- [ ] Define COT_TRACES_INDEX constant and COT_TRACES_MAPPING
- [ ] Define ARTIFACT_LINEAGE_INDEX constant and ARTIFACT_LINEAGE_MAPPING
- [ ] Define SCOPE_ADHERENCE_INDEX constant and SCOPE_ADHERENCE_MAPPING
- [ ] All mappings include tenant_id keyword field
- [ ] All mappings use 1 shard, 0 replicas (matching guardrails pattern)
- [ ] Write unit tests at `tests/unit/infrastructure/cot/test_cot_mappings.py`

**Acceptance Criteria**:
- [ ] Mappings are valid JSON objects
- [ ] All required fields present with correct types
- [ ] Keyword fields used for exact matching (task_id, agent_id, etc.)
- [ ] Text fields used for full-text search (reasoning_text, decision)
- [ ] tenant_id field present in all mappings
- [ ] Unit tests verify mapping structure

**Test Cases**:
- [ ] Test COT_TRACES_MAPPING structure
- [ ] Test ARTIFACT_LINEAGE_MAPPING structure
- [ ] Test SCOPE_ADHERENCE_MAPPING structure
- [ ] Test all required fields present
- [ ] Test field types are correct

---

## Phase 3: CoT Store (Backend)

### T05: Implement CoTStore Core Operations

**Estimate**: 2hr
**Stories**: US-F03-05

**Description**: Create the Elasticsearch store for CoT traces with async CRUD operations.

**Subtasks**:
- [ ] Create `src/infrastructure/cot/cot_store.py`
- [ ] Implement `__init__` with ES client and index prefix
- [ ] Implement `_ensure_indices_exist()` following guardrails pattern
- [ ] Implement `store_trace()` -- append-only, no refresh=wait_for (async performance)
- [ ] Implement `get_trace()` with CoTTraceNotFoundError on miss
- [ ] Implement `list_traces_by_task()` with step_number sort and pagination
- [ ] Implement `list_traces_by_session()` with timestamp sort and pagination
- [ ] Implement `search_traces()` with full-text query on reasoning_text
- [ ] Implement `store_adherence_result()` -- append-only
- [ ] Implement `get_adherence_by_task()` with task_id filter
- [ ] Implement `close()` method
- [ ] Write unit tests at `tests/unit/infrastructure/cot/test_cot_store.py` with mocked ES client

**Acceptance Criteria**:
- [ ] All operations work correctly with mocked ES
- [ ] Index creation is idempotent
- [ ] Traces are append-only (no update/delete methods)
- [ ] Pagination works correctly
- [ ] Full-text search returns ranked results
- [ ] close() releases resources

**Test Cases**:
- [ ] Test store_trace creates document
- [ ] Test get_trace returns existing trace
- [ ] Test get_trace raises CoTTraceNotFoundError for missing
- [ ] Test list_traces_by_task returns ordered results
- [ ] Test list_traces_by_task pagination
- [ ] Test list_traces_by_session returns ordered results
- [ ] Test search_traces with matching query
- [ ] Test search_traces with no matches
- [ ] Test store_adherence_result
- [ ] Test get_adherence_by_task

---

## Phase 4: Lineage Store and Scope Checker (Backend)

### T06: Implement LineageStore

**Estimate**: 2hr
**Stories**: US-F03-06

**Description**: Create the Elasticsearch store for artifact lineage with async CRUD operations.

**Subtasks**:
- [ ] Create `src/infrastructure/cot/lineage_store.py`
- [ ] Implement `__init__` with ES client and index prefix
- [ ] Implement `_ensure_indices_exist()` for artifact-lineage index
- [ ] Implement `create_lineage()` -- creates lineage records
- [ ] Implement `get_lineage()` with LineageNotFoundError on miss
- [ ] Implement `get_lineage_by_path()` returning all records for a file path, ordered by created_at desc
- [ ] Implement `get_lineage_chain()` -- build full ancestor chain by traversing parent_artifact_id
- [ ] Implement `get_lineage_by_task()` with task_id filter
- [ ] Implement `get_lineage_by_epic()` with epic_id filter
- [ ] Implement `search_lineage()` with filters (agent_id, artifact_type, epic_id) and pagination
- [ ] Implement `close()` method
- [ ] Write unit tests at `tests/unit/infrastructure/cot/test_lineage_store.py` with mocked ES client

**Acceptance Criteria**:
- [ ] All CRUD operations work correctly
- [ ] get_lineage_chain correctly traverses parent relationships
- [ ] Pagination and filtering work across all list/search methods
- [ ] close() releases resources

**Test Cases**:
- [ ] Test create_lineage stores document
- [ ] Test get_lineage returns existing record
- [ ] Test get_lineage raises LineageNotFoundError for missing
- [ ] Test get_lineage_by_path returns history for a file
- [ ] Test get_lineage_chain builds correct ancestor chain
- [ ] Test get_lineage_chain with no parents (root artifact)
- [ ] Test get_lineage_by_task
- [ ] Test get_lineage_by_epic
- [ ] Test search_lineage with agent filter
- [ ] Test search_lineage with type filter
- [ ] Test search_lineage pagination

---

### T07: Implement Scope Adherence Checker

**Estimate**: 1hr
**Stories**: US-F03-07

**Description**: Create the scope adherence checker that compares intended vs actual file modifications.

**Subtasks**:
- [ ] Create `src/core/cot/scope_checker.py`
- [ ] Implement `ScopeAdherenceChecker.check()` method
- [ ] Compute files_unexpected (actual - intended)
- [ ] Compute files_missing (intended - actual)
- [ ] Compute adherence_score (matched / max(intended, actual, 1))
- [ ] Set is_compliant = len(files_unexpected) == 0
- [ ] Handle edge cases: empty lists, identical lists, disjoint lists
- [ ] Write unit tests at `tests/unit/core/cot/test_scope_checker.py`

**Acceptance Criteria**:
- [ ] Correctly identifies unexpected and missing files
- [ ] Score of 1.0 when lists are identical
- [ ] Score of 0.0 when lists are completely disjoint
- [ ] is_compliant is True only when no unexpected files
- [ ] Empty intended list with actual files still flags unexpected

**Test Cases**:
- [ ] Test identical file lists (score=1.0, compliant=True)
- [ ] Test completely disjoint lists (score=0.0, compliant=False)
- [ ] Test actual has unexpected files (compliant=False)
- [ ] Test actual missing some intended files (compliant=True if no unexpected)
- [ ] Test both empty lists (score=1.0, compliant=True)
- [ ] Test only intended empty, actual non-empty (compliant=False)
- [ ] Test only actual empty, intended non-empty (compliant=True)

---

### T08: Implement PR Template Generator

**Estimate**: 1.5hr
**Stories**: US-F03-09

**Description**: Create the PR template generator that produces forensic PR descriptions.

**Subtasks**:
- [ ] Create `src/core/cot/pr_template.py`
- [ ] Implement `PRTemplateGenerator.generate()` method
- [ ] Generate task summary section (task_id, epic_id, agents, git_sha)
- [ ] Generate reasoning summary from CoT traces (condensed, max 500 words)
- [ ] Generate files modified table with lineage links
- [ ] Generate scope adherence report
- [ ] Generate test results section if available
- [ ] Generate forensic links to ES queries
- [ ] Handle edge cases: no traces, no lineage, no test results
- [ ] Write unit tests at `tests/unit/core/cot/test_pr_template.py`

**Acceptance Criteria**:
- [ ] Output is valid Markdown
- [ ] All sections populated when data available
- [ ] Graceful degradation when data missing
- [ ] Reasoning summary stays within length limit
- [ ] File table includes type, agent, parent, and lineage chain columns

**Test Cases**:
- [ ] Test full template with all data
- [ ] Test template with no traces (reasoning section omitted)
- [ ] Test template with no lineage
- [ ] Test template with no test results
- [ ] Test reasoning truncation at 500 words
- [ ] Test Markdown validity (no broken tables)

---

## Phase 5: MCP Server and Hook (Backend)

### T09: Create CoT/Lineage MCP Server

**Estimate**: 2hr
**Stories**: US-F03-11

**Description**: Create a standalone MCP server exposing CoT and lineage tools.

**Subtasks**:
- [ ] Create `src/infrastructure/cot/cot_mcp.py` as standalone MCP server
- [ ] Implement `cot_log_reasoning` tool (accepts trace fields, persists to CoTStore)
- [ ] Implement `cot_get_traces` tool (retrieves traces by task_id)
- [ ] Implement `lineage_record` tool (accepts lineage fields, persists to LineageStore)
- [ ] Implement `lineage_query` tool (returns lineage chain for artifact path)
- [ ] Add tool schemas in `get_tool_schemas()`
- [ ] Implement `handle_request()` routing
- [ ] Lazy ES client initialization
- [ ] Error handling returns structured responses
- [ ] Write unit tests at `tests/unit/infrastructure/cot/test_cot_mcp.py`

**Acceptance Criteria**:
- [ ] MCP server starts independently
- [ ] All four tools work via MCP protocol (initialize, tools/list, tools/call)
- [ ] Tool schemas are valid MCP format
- [ ] Error responses include clear messages
- [ ] Lazy init prevents startup overhead

**Test Cases**:
- [ ] Test cot_log_reasoning with full parameters
- [ ] Test cot_log_reasoning with minimal parameters
- [ ] Test cot_get_traces returns paginated results
- [ ] Test lineage_record with full parameters
- [ ] Test lineage_query returns chain
- [ ] Test MCP protocol (initialize, tools/list)
- [ ] Test error handling for invalid parameters
- [ ] Test lazy initialization

---

### T10: Create PostToolUse CoT Capture Hook

**Estimate**: 1.5hr
**Stories**: US-F03-10

**Description**: Create the PostToolUse hook that captures CoT traces after tool calls.

**Subtasks**:
- [ ] Create `.claude/hooks/cot-capture.py`
- [ ] Read tool call info from stdin JSON (tool, arguments, result, sessionId)
- [ ] Extract file paths from tool arguments (reuse pattern from guardrails-enforce.py)
- [ ] Read session cache for current task context (task_id, agent_id, etc.)
- [ ] Create CoTTrace record from tool context
- [ ] Write to ES asynchronously (best-effort, no wait_for)
- [ ] Fall back to local file if ES unavailable (write JSON to COT_FALLBACK_DIR)
- [ ] Update session cache with latest trace_id for parent chaining
- [ ] Always exit 0
- [ ] Write unit tests at `tests/unit/hooks/test_cot_capture.py`

**Acceptance Criteria**:
- [ ] Hook captures file paths from Write/Edit tool calls
- [ ] CoTTrace records include all available context
- [ ] ES writes are async and do not block
- [ ] Local fallback works when ES unavailable
- [ ] Hook completes within 500ms
- [ ] Always exits 0

**Test Cases**:
- [ ] Test hook with Write tool input
- [ ] Test hook with Edit tool input
- [ ] Test hook with Bash tool input
- [ ] Test file path extraction from arguments
- [ ] Test session cache reading
- [ ] Test ES unavailable fallback to local file
- [ ] Test hook output (always exit 0)
- [ ] Test trace_id chaining via session cache

---

### T11: Configure MCP Server and Hook Registration

**Estimate**: 30min
**Stories**: US-F03-22

**Description**: Register the MCP server in .mcp.json and the hook in settings.json.

**Subtasks**:
- [ ] Add cot-lineage MCP entry to `.mcp.json`
- [ ] Add PostToolUse hook entry to `.claude/settings.json` for Write, Edit, Bash tools
- [ ] Set hook timeout to 500ms
- [ ] Ensure hook chains correctly after existing guardrails-enforce.py
- [ ] Verify hook fires on Write/Edit/Bash tool calls

**Acceptance Criteria**:
- [ ] MCP server discoverable by Claude CLI
- [ ] PostToolUse hook fires after Write/Edit/Bash
- [ ] Hook does not interfere with existing hooks
- [ ] Timeout correctly configured

**Test Cases**:
- [ ] Verify .mcp.json has valid JSON structure
- [ ] Verify settings.json hook configuration is valid

---

## Phase 6: REST API (Backend)

### T12: Create Pydantic Models for CoT/Lineage API

**Estimate**: 1hr
**Stories**: US-F03-12, US-F03-13, US-F03-14

**Description**: Create Pydantic request/response models for the REST API.

**Subtasks**:
- [ ] Create `src/orchestrator/api/models/cot.py`
- [ ] Define CoTTraceResponse model
- [ ] Define CoTTracesListResponse model
- [ ] Define LineageResponse model
- [ ] Define LineageListResponse model
- [ ] Define LineageChainResponse model
- [ ] Define AdherenceResultResponse model
- [ ] Define AdherenceListResponse model
- [ ] Define PRTemplateResponse model
- [ ] Write unit tests at `tests/unit/orchestrator/api/models/test_cot.py`

**Acceptance Criteria**:
- [ ] Models match backend dataclasses
- [ ] Proper field validation
- [ ] Enum types for artifact_type
- [ ] Pagination fields on list responses

**Test Cases**:
- [ ] Test valid model creation for each response type
- [ ] Test validation errors for required fields
- [ ] Test enum validation

---

### T13: Implement CoT Traces REST Endpoints

**Estimate**: 1.5hr
**Stories**: US-F03-12

**Description**: Implement REST endpoints for querying CoT traces.

**Subtasks**:
- [ ] Create `src/orchestrator/routes/cot_api.py`
- [ ] Implement GET /api/cot/traces with filters (task_id, session_id, agent_id)
- [ ] Implement GET /api/cot/traces/search with full-text query parameter q
- [ ] Implement GET /api/cot/traces/{trace_id}
- [ ] Register static paths (/search) BEFORE dynamic paths (/{trace_id}) in router
- [ ] Add pagination parameters
- [ ] Register router in main app
- [ ] Write unit tests at `tests/unit/orchestrator/routes/test_cot_api.py`

**Acceptance Criteria**:
- [ ] List endpoint returns paginated results with filters
- [ ] Search endpoint returns full-text search results
- [ ] Get endpoint returns 404 for missing traces
- [ ] Route ordering prevents path parameter capturing static routes

**Test Cases**:
- [ ] Test list traces with task_id filter
- [ ] Test list traces with pagination
- [ ] Test search traces with query string
- [ ] Test get existing trace
- [ ] Test get non-existent trace (404)

---

### T14: Implement Lineage REST Endpoints

**Estimate**: 1.5hr
**Stories**: US-F03-13

**Description**: Implement REST endpoints for querying artifact lineage.

**Subtasks**:
- [ ] Add lineage endpoints to `src/orchestrator/routes/cot_api.py`
- [ ] Implement GET /api/lineage with filters (artifact_path, task_id, epic_id, agent_id, artifact_type)
- [ ] Implement GET /api/lineage/chain/{artifact_path:path} (path parameter with slash support)
- [ ] Implement GET /api/lineage/{lineage_id}
- [ ] Register static paths (/chain/) BEFORE dynamic paths (/{lineage_id})
- [ ] Add pagination parameters
- [ ] Write unit tests at `tests/unit/orchestrator/routes/test_lineage_api.py`

**Acceptance Criteria**:
- [ ] List endpoint returns paginated results with all filters
- [ ] Chain endpoint returns full ancestor chain for a file path
- [ ] Get endpoint returns 404 for missing records
- [ ] Path parameter supports slashes in artifact paths

**Test Cases**:
- [ ] Test list lineage with task_id filter
- [ ] Test list lineage with artifact_type filter
- [ ] Test get lineage chain for multi-level path
- [ ] Test get lineage chain for root artifact
- [ ] Test get existing lineage record
- [ ] Test get non-existent lineage record (404)

---

### T15: Implement Adherence and PR Template Endpoints

**Estimate**: 1hr
**Stories**: US-F03-14

**Description**: Implement REST endpoints for scope adherence results and PR template generation.

**Subtasks**:
- [ ] Add adherence endpoint to `src/orchestrator/routes/cot_api.py`
- [ ] Implement GET /api/cot/adherence with filters (task_id, agent_id, compliant)
- [ ] Implement GET /api/cot/pr-template/{task_id}
- [ ] PR template endpoint calls PRTemplateGenerator with data from stores
- [ ] Handle missing data gracefully in PR template
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Adherence endpoint returns paginated, filtered results
- [ ] PR template endpoint generates valid Markdown
- [ ] Missing data produces minimal but valid template
- [ ] Proper error handling

**Test Cases**:
- [ ] Test adherence list with task filter
- [ ] Test adherence list with compliant filter
- [ ] Test PR template generation
- [ ] Test PR template with missing traces (graceful degradation)

---

## Phase 7: HITL UI (Frontend)

### T16: Create TypeScript Types and API Client

**Estimate**: 1.5hr
**Stories**: US-F03-19

**Description**: Create TypeScript types and API client functions for CoT and lineage.

**Subtasks**:
- [ ] Add CoT/Lineage types to `docker/hitl-ui/src/api/types/cot.ts`
- [ ] Create `docker/hitl-ui/src/api/cot.ts` with API client functions
- [ ] Implement listTraces(), getTrace(), searchTraces()
- [ ] Implement listLineage(), getLineage(), getLineageChain()
- [ ] Implement listAdherence(), getPRTemplate()
- [ ] Create React Query hooks with proper cache keys
- [ ] Write unit tests at `docker/hitl-ui/src/api/cot.test.ts`

**Acceptance Criteria**:
- [ ] Types match backend Pydantic models
- [ ] All API functions implemented
- [ ] React Query hooks with proper keys and stale times
- [ ] Error handling for API failures

**Test Cases**:
- [ ] Test API function calls
- [ ] Test error handling
- [ ] Test React Query hooks

---

### T17: Create Mock Data

**Estimate**: 1hr
**Stories**: US-F03-19

**Description**: Create mock data for development and testing.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/api/mocks/cot.ts`
- [ ] Define mock CoT traces covering multiple steps and agents
- [ ] Define mock lineage records with parent-child relationships
- [ ] Define mock scope adherence results (compliant and non-compliant)
- [ ] Define mock PR template
- [ ] Toggle via VITE_USE_MOCKS env var (existing pattern)
- [ ] Write unit tests at `docker/hitl-ui/src/api/mocks/cot.test.ts`

**Acceptance Criteria**:
- [ ] Mock data is realistic and covers all scenarios
- [ ] Lineage mocks include multi-level chains
- [ ] Environment toggle works

**Test Cases**:
- [ ] Test mock data structure
- [ ] Test mock service responses

---

### T18: Create Zustand Store

**Estimate**: 1hr
**Stories**: US-F03-20

**Description**: Create Zustand store for CoT/lineage state management.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/stores/cotStore.ts`
- [ ] Define state interface (traces, lineage, adherence, selectedTask, filters, tabs)
- [ ] Implement actions: setTraces, setLineage, setAdherence, selectTask, setFilters, setTab
- [ ] Manage loading and error states per data type
- [ ] Write unit tests at `docker/hitl-ui/src/stores/cotStore.test.ts`

**Acceptance Criteria**:
- [ ] Store holds all required state
- [ ] Actions update state correctly
- [ ] Tab selection state preserved
- [ ] Tests verify state transitions

**Test Cases**:
- [ ] Test setTraces
- [ ] Test selectTask clears previous data
- [ ] Test filter changes
- [ ] Test tab selection
- [ ] Test loading/error state management

---

### T19: Build CoTTraceCard and CoTTraceViewer Components

**Estimate**: 1.5hr
**Stories**: US-F03-15

**Description**: Create components for displaying CoT traces.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/lineage/CoTTraceCard.tsx`
- [ ] Display step_number, decision, adherence score in card summary
- [ ] Expandable section showing reasoning_text, files_intended, files_actual
- [ ] Color-coded adherence indicator (green/yellow/red)
- [ ] Create `docker/hitl-ui/src/components/lineage/CoTTraceViewer.tsx`
- [ ] List of CoTTraceCard components ordered by step_number
- [ ] Task ID selector to load traces for a task
- [ ] Search input to filter traces by reasoning text
- [ ] Loading and empty states
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Cards display all trace summary fields
- [ ] Expand/collapse works for reasoning detail
- [ ] Adherence indicator color-coded correctly
- [ ] Search filters traces
- [ ] Loading and empty states rendered

**Test Cases**:
- [ ] Test card rendering with full data
- [ ] Test card expand/collapse
- [ ] Test adherence color coding (green >= 0.9, yellow >= 0.7, red < 0.7)
- [ ] Test viewer list rendering
- [ ] Test search filtering
- [ ] Test empty state

---

### T20: Build LineageExplorer and LineageChain Components

**Estimate**: 2hr
**Stories**: US-F03-16

**Description**: Create components for visualizing artifact lineage.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/lineage/LineageChain.tsx`
- [ ] Render lineage chain as a vertical tree (root at top, leaf at bottom)
- [ ] Each node shows artifact_type badge, source_agent, artifact_path, timestamp
- [ ] Connecting lines between nodes
- [ ] Create `docker/hitl-ui/src/components/lineage/LineageExplorer.tsx`
- [ ] Search input for artifact path
- [ ] Calls lineage chain API on search
- [ ] Displays LineageChain component with results
- [ ] Clicking a node could navigate to CoT trace (if cot_trace_id set)
- [ ] Loading and empty states
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Chain visualizes parent-child relationships correctly
- [ ] Artifact type badges use consistent colors
- [ ] Search triggers API call and renders results
- [ ] Node click navigates or shows detail
- [ ] Tree renders correctly for chains of varying depth

**Test Cases**:
- [ ] Test chain rendering with 1 node
- [ ] Test chain rendering with 3-level chain
- [ ] Test chain rendering with 5-level chain
- [ ] Test search trigger
- [ ] Test node click callback
- [ ] Test empty search results

---

### T21: Build ScopeAdherencePanel and PRTemplatePreview

**Estimate**: 1.5hr
**Stories**: US-F03-17

**Description**: Create components for scope adherence display and PR template preview.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/lineage/ScopeAdherencePanel.tsx`
- [ ] Display adherence score with visual indicator
- [ ] List unexpected files (red) and missing files (yellow)
- [ ] Overall compliance badge (green check / red X)
- [ ] Create `docker/hitl-ui/src/components/lineage/PRTemplatePreview.tsx`
- [ ] Render PR template Markdown as HTML (using existing markdown renderer)
- [ ] Copy-to-clipboard button
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Score displayed as percentage with color
- [ ] Unexpected files highlighted in red
- [ ] Missing files highlighted in yellow
- [ ] PR template renders valid Markdown as HTML
- [ ] Copy button copies raw Markdown to clipboard

**Test Cases**:
- [ ] Test adherence panel with perfect score (green)
- [ ] Test adherence panel with low score (red)
- [ ] Test unexpected files display
- [ ] Test missing files display
- [ ] Test PR preview rendering
- [ ] Test copy-to-clipboard

---

### T22: Build LineagePage and Navigation

**Estimate**: 1.5hr
**Stories**: US-F03-18

**Description**: Create the main page layout and add to navigation.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/lineage/LineagePage.tsx`
- [ ] Add tabbed layout: CoT Traces, Lineage Explorer, Scope Adherence
- [ ] Integrate CoTTraceViewer in first tab
- [ ] Integrate LineageExplorer in second tab
- [ ] Integrate ScopeAdherencePanel and PRTemplatePreview in third tab
- [ ] Create barrel export `docker/hitl-ui/src/components/lineage/index.ts`
- [ ] Add route /lineage to App.tsx
- [ ] Add navigation item "Forensic Traceability" to sidebar
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Page accessible via /lineage
- [ ] Navigation item visible in sidebar
- [ ] Tab switching works and preserves state
- [ ] Responsive layout
- [ ] All three tabs render their components

**Test Cases**:
- [ ] Test page rendering
- [ ] Test tab switching
- [ ] Test navigation link
- [ ] Test responsive layout

---

### T23: Write Integration Tests

**Estimate**: 1.5hr
**Stories**: US-F03-21

**Description**: Create integration tests for CoT and lineage stores and MCP server.

**Subtasks**:
- [ ] Create `tests/integration/test_cot_store.py` -- store, get, list, search with mocked ES
- [ ] Create `tests/integration/test_lineage_store.py` -- create, get, chain, search with mocked ES
- [ ] Create `tests/integration/test_cot_mcp.py` -- full MCP protocol flow
- [ ] Test CoT capture hook end-to-end with mocked ES
- [ ] Verify index creation is idempotent
- [ ] Verify traces are append-only (no update method exposed)

**Acceptance Criteria**:
- [ ] Integration tests pass against mocked ES (full store chain)
- [ ] MCP protocol tests verify initialize, tools/list, tools/call
- [ ] Tests clean up after themselves
- [ ] All operations verified end-to-end

**Test Cases**:
- [ ] Test full CoTStore flow: store -> get -> list -> search
- [ ] Test full LineageStore flow: create -> get -> chain -> search
- [ ] Test MCP cot_log_reasoning flow
- [ ] Test MCP lineage_record flow
- [ ] Test MCP lineage_query flow
- [ ] Test index idempotency

---

## Progress

- **Started**: Not started
- **Tasks Complete**: 0/23
- **Percentage**: 0%
- **Status**: PENDING
- **Blockers**: None

## Task Summary

| Phase | Tasks | Estimate | Status |
|-------|-------|----------|--------|
| Phase 1: Models & Config | T01-T03 | 3.5hr | [ ] |
| Phase 2: ES Mappings | T04 | 1hr | [ ] |
| Phase 3: CoT Store | T05 | 2hr | [ ] |
| Phase 4: Lineage Store + Scope | T06-T08 | 4.5hr | [ ] |
| Phase 5: MCP + Hook | T09-T11 | 4hr | [ ] |
| Phase 6: REST API | T12-T15 | 5hr | [ ] |
| Phase 7: UI | T16-T23 | 11.5hr | [ ] |

**Total Estimated Time**: ~31.5 hours

## Task Dependencies

```
T01 (Models) ────┐
                  ├──> T04 (Mappings) ──> T05 (CoT Store) ──> T09 (MCP)
T02 (ArtifactType)┘                              |               |
                                                  |               ├──> T10 (Hook)
T03 (Exceptions/Config)──────────────────────────┘               |
                                                                  └──> T11 (Config)
                                         T06 (Lineage Store) ◄───── T04
                                                  |
                                         T07 (Scope Checker) ◄───── T01
                                                  |
                                         T08 (PR Template) ◄─── T07

T12 (API Models) ◄──── T01
      |
T13 (CoT API) ◄──── T05, T12
      |
T14 (Lineage API) ◄──── T06, T12
      |
T15 (Adherence+PR API) ◄──── T07, T08, T12

T16 (TS Types) ◄──── T12
T17 (Mock Data) ◄──── T16
T18 (Store) ◄──── T16
T19 (Trace UI) ◄──── T17, T18
T20 (Lineage UI) ◄──── T17, T18
T21 (Adherence UI) ◄──── T17, T18
T22 (Page) ◄──── T19, T20, T21
T23 (Integration Tests) ◄──── T05, T06, T09, T10
```

## Implementation Order (Recommended Build Sequence)

```
Phase 1 -> Phase 2 -> Phase 3+4 (parallel) -> Phase 5 -> Phase 6 -> Phase 7
```

**Week 1: Backend Foundation**
1. T01, T02, T03 (Models, ArtifactType, Exceptions/Config) -- can be parallel
2. T04 (ES Mappings)
3. T05 (CoT Store)
4. T06 (Lineage Store)
5. T07 (Scope Checker)

**Week 2: Backend Integration**
6. T08 (PR Template Generator)
7. T09 (MCP Server)
8. T10 (PostToolUse Hook)
9. T11 (MCP + Hook Registration)
10. T23 (Integration Tests)

**Week 3: REST API + Frontend**
11. T12 (Pydantic API Models)
12. T13, T14, T15 (REST Endpoints) -- can be parallel
13. T16 (TS Types + API Client)
14. T17 (Mock Data)
15. T18 (Zustand Store)

**Week 4: Frontend Components**
16. T19 (CoT Trace Viewer)
17. T20 (Lineage Explorer)
18. T21 (Scope Adherence + PR Preview)
19. T22 (Page + Navigation)

## Testing Strategy

- Unit tests mock ES client for fast execution
- Integration tests use mocked ES store (full class chain)
- UI tests use mock data by default
- Hook tests verify stdin/stdout JSON contract and exit codes
- All new stores follow GuardrailsStore test patterns
- Test fixtures provide sample traces, lineage records, adherence results

## Risk Mitigation

1. **Performance**: Async ES writes in hook, 500ms timeout, local fallback
2. **Storage Growth**: Retention policy, max_reasoning_length limit, ILM
3. **Scope Checker False Positives**: Allow-list for boilerplate files (__init__.py)
4. **Hook Fragility**: Independent hook, fail-open, comprehensive tests
5. **Lineage Consistency**: Idempotent writes, chain validation on query
6. **UI Complexity**: Start with minimal viable components, iterate

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `./tools/test.sh tests/unit/`
- [ ] All integration tests pass: `./tools/test.sh tests/integration/`
- [ ] Linter passes: `./tools/lint.sh src/`
- [ ] Documentation updated
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md
