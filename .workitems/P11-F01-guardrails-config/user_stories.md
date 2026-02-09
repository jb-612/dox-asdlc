# User Stories: P11-F01 Guardrails Configuration System

## Epic Reference

This feature implements a **Contextually-Conditional Guardrails System** following Parlant's alignment modeling pattern. It replaces static system prompts with modular, evaluatable guidelines that activate based on task context.

## Epic Summary

As a project maintainer, I want to configure agent behavior through modular guidelines that activate based on context, so that agents receive focused, relevant instructions without context overload from static prompts.

## User Stories

### US-F01-01: Define Guideline Data Models

**As a** system architect
**I want** well-defined data models for guidelines, conditions, and actions
**So that** the system has a consistent schema for configuration

**Acceptance Criteria:**
- [ ] `Guideline` dataclass defined with all required fields
- [ ] `GuidelineCondition` dataclass supports agents, domains, actions, paths, events
- [ ] `GuidelineAction` dataclass supports instructions, tool restrictions, HITL gates
- [ ] `TaskContext` dataclass captures evaluation input
- [ ] All models support JSON serialization
- [ ] Models are validated with Pydantic for API layer
- [ ] Unit tests verify model constraints

**Priority:** High

---

### US-F01-02: Create Elasticsearch Indices

**As a** platform engineer
**I want** Elasticsearch indices for guidelines and audit logs
**So that** configuration is persisted and searchable

**Acceptance Criteria:**
- [ ] `guardrails-config` index created with proper mapping
- [ ] `guardrails-audit` index created with proper mapping
- [ ] Indices support multi-tenancy via tenant_id field
- [ ] Index creation is idempotent
- [ ] Mappings support efficient condition queries
- [ ] Integration tests verify index operations

**Priority:** High

---

### US-F01-03: Implement GuardrailsEvaluator Core

**As a** developer
**I want** an evaluator that matches guidelines to task context
**So that** agents receive only relevant guidelines

**Acceptance Criteria:**
- [ ] `GuardrailsEvaluator` class implements context evaluation
- [ ] Conditions use AND logic across fields
- [ ] Lists within fields use OR logic (any match)
- [ ] Empty/None fields act as wildcards
- [ ] Path patterns support glob syntax
- [ ] Results sorted by priority (highest first)
- [ ] Unit tests cover all condition matching scenarios

**Priority:** High

---

### US-F01-04: Implement Conflict Resolution

**As a** configuration maintainer
**I want** conflicts between guidelines resolved by priority
**So that** the system behaves predictably

**Acceptance Criteria:**
- [ ] Higher priority guidelines take precedence
- [ ] Tool deny lists always override allow lists
- [ ] HITL gates from all matching guidelines are combined
- [ ] Instructions are concatenated in priority order
- [ ] Conflict resolution is deterministic
- [ ] Unit tests verify conflict scenarios

**Priority:** High

---

### US-F01-05: Add Audit Logging

**As a** compliance officer
**I want** all gate decisions and config changes logged
**So that** there is an audit trail for governance

**Acceptance Criteria:**
- [ ] `log_decision()` records gate decisions to audit index
- [ ] Config changes are logged with old/new values
- [ ] Audit entries include actor, timestamp, context
- [ ] Audit log is append-only
- [ ] Integration tests verify audit logging

**Priority:** High

---

### US-F01-06: Implement guardrails_get_context in Standalone Guardrails MCP

**As an** agent
**I want** to call `guardrails_get_context` to get applicable guidelines
**So that** I receive focused context for my current task

**Acceptance Criteria:**
- [ ] `guardrails_get_context` tool implemented in the standalone Guardrails MCP server (`src/infrastructure/guardrails/guardrails_mcp.py`)
- [ ] Tool accepts agent, domain, action, paths, event parameters
- [ ] Response includes matching guidelines sorted by priority
- [ ] Response includes combined instruction text
- [ ] Response includes aggregated tool allow/deny lists
- [ ] Tool schema is properly defined
- [ ] Unit tests with mocked evaluator

**Priority:** High

---

### US-F01-07: Implement guardrails_log_decision in Standalone Guardrails MCP

**As an** agent
**I want** to log gate decisions via MCP
**So that** decisions are recorded for audit

**Acceptance Criteria:**
- [ ] `guardrails_log_decision` tool implemented in the standalone Guardrails MCP server (`src/infrastructure/guardrails/guardrails_mcp.py`)
- [ ] Tool accepts guideline_id, context, result, reason
- [ ] Decision logged to audit index
- [ ] Returns audit entry ID
- [ ] Unit tests verify logging

**Priority:** Medium

---

### US-F01-08: Implement REST API List/Get Endpoints

**As a** UI developer
**I want** REST endpoints to list and get guidelines
**So that** the UI can display configuration

**Acceptance Criteria:**
- [ ] `GET /api/guardrails` lists guidelines with filtering
- [ ] `GET /api/guardrails/{id}` gets single guideline
- [ ] Filtering supports category, enabled status
- [ ] Pagination with page/page_size parameters
- [ ] Response matches defined schema
- [ ] Unit tests with mocked store

**Priority:** High

---

### US-F01-09: Implement REST API Create/Update/Delete

**As a** configuration maintainer
**I want** REST endpoints to manage guidelines
**So that** I can configure the system via API

**Acceptance Criteria:**
- [ ] `POST /api/guardrails` creates a guideline
- [ ] `PUT /api/guardrails/{id}` updates a guideline
- [ ] `DELETE /api/guardrails/{id}` deletes a guideline
- [ ] `POST /api/guardrails/{id}/toggle` toggles enabled status
- [ ] Updates use version for optimistic locking
- [ ] Validation errors return 400 with details
- [ ] Unit tests cover success and error cases

**Priority:** High

---

### US-F01-10: Implement REST API Audit Endpoints

**As an** auditor
**I want** REST endpoints to query audit logs
**So that** I can review decision history

**Acceptance Criteria:**
- [ ] `GET /api/guardrails/audit` lists audit entries
- [ ] Filtering by guideline_id, event_type, date range
- [ ] Pagination support
- [ ] Response includes all audit entry fields
- [ ] Unit tests verify filtering

**Priority:** Medium

---

### US-F01-11: Implement REST API Evaluate Endpoint

**As a** configuration tester
**I want** an endpoint to preview guideline evaluation
**So that** I can test configurations before deploying

**Acceptance Criteria:**
- [ ] `POST /api/guardrails/evaluate` accepts TaskContext
- [ ] Response shows which guidelines would match
- [ ] Response includes combined instruction and tool lists
- [ ] No side effects (read-only)
- [ ] Unit tests verify evaluation

**Priority:** Medium

---

### US-F01-12: Implement Import/Export Endpoints

**As a** system administrator
**I want** to import and export guidelines
**So that** I can backup and share configurations

**Acceptance Criteria:**
- [ ] `GET /api/guardrails/export` returns all guidelines as JSON
- [ ] `POST /api/guardrails/import` bulk creates guidelines
- [ ] Export supports filtering by category
- [ ] Import handles duplicates (update or skip)
- [ ] Unit tests verify round-trip

**Priority:** Low

---

### US-F01-13: Build GuidelinesList Component

**As a** UI user
**I want** a list view of all guidelines
**So that** I can browse and manage configuration

**Acceptance Criteria:**
- [ ] List displays guideline name, category, priority, enabled status
- [ ] Category shown with colored badge
- [ ] Enable/disable toggle per guideline
- [ ] Search by name or description
- [ ] Filter by category and enabled status
- [ ] Sort by priority, name, or category
- [ ] Click to select and view details
- [ ] Unit tests with mock data

**Priority:** High

---

### US-F01-14: Build GuidelineCard Component

**As a** UI user
**I want** a card showing guideline summary
**So that** I can quickly understand each guideline

**Acceptance Criteria:**
- [ ] Card shows name, category badge, priority
- [ ] Shows condition summary (agents, domains)
- [ ] Shows action type indicator
- [ ] Toggle button for enabled status
- [ ] Click opens editor
- [ ] Visual distinction for disabled guidelines
- [ ] Unit tests verify rendering

**Priority:** High

---

### US-F01-15: Build GuidelineEditor Component

**As a** configuration maintainer
**I want** a form to create and edit guidelines
**So that** I can configure agent behavior

**Acceptance Criteria:**
- [ ] Form fields for all guideline properties
- [ ] Priority slider with numeric input (0-1000)
- [ ] Category dropdown
- [ ] Integrated ConditionBuilder and ActionBuilder
- [ ] Validation with inline error messages
- [ ] Save and Cancel buttons
- [ ] Loading state during save
- [ ] Version conflict detection on save
- [ ] Unit tests verify form behavior

**Priority:** High

---

### US-F01-16: Build ConditionBuilder Component

**As a** configuration maintainer
**I want** a visual builder for conditions
**So that** I can easily define when guidelines apply

**Acceptance Criteria:**
- [ ] Multi-select for agents (checkbox or tag input)
- [ ] Multi-select for domains
- [ ] Multi-select for actions
- [ ] Path pattern input with validation
- [ ] Event type selection
- [ ] Gate type selection
- [ ] Custom JSON editor for advanced conditions
- [ ] Live preview of condition matching
- [ ] Unit tests verify input handling

**Priority:** High

---

### US-F01-17: Build ActionBuilder Component

**As a** configuration maintainer
**I want** a visual builder for actions
**So that** I can define what guidelines do

**Acceptance Criteria:**
- [ ] Action type dropdown (instruction, tool_restriction, etc.)
- [ ] Instruction textarea for text content
- [ ] Tools allowed/denied tag inputs
- [ ] HITL gate type selector
- [ ] Gate threshold toggle (mandatory/advisory)
- [ ] Constraint fields (max_files, require_tests, etc.)
- [ ] Fields show/hide based on action type
- [ ] Unit tests verify conditional fields

**Priority:** High

---

### US-F01-18: Build GuidelinePreview Component

**As a** configuration tester
**I want** to preview how a guideline evaluates
**So that** I can verify it works as expected

**Acceptance Criteria:**
- [ ] Input fields for test context (agent, domain, etc.)
- [ ] "Evaluate" button triggers preview
- [ ] Shows whether guideline would match
- [ ] Shows which condition fields matched
- [ ] Shows effective instruction and tool lists
- [ ] Updates in real-time as condition changes
- [ ] Unit tests verify preview logic

**Priority:** Medium

---

### US-F01-19: Build AuditLogViewer Component

**As an** auditor
**I want** to view the audit log in the UI
**So that** I can review decision history

**Acceptance Criteria:**
- [ ] Table view of audit entries
- [ ] Columns: timestamp, guideline, event type, result, actor
- [ ] Expandable row for full details
- [ ] Filter by guideline, event type, date range
- [ ] Pagination
- [ ] Export to CSV
- [ ] Collapsible panel in GuardrailsPage
- [ ] Unit tests verify rendering and filtering

**Priority:** Medium

---

### US-F01-20: Build ImportExportPanel Component

**As a** system administrator
**I want** UI controls for import/export
**So that** I can backup and restore configuration

**Acceptance Criteria:**
- [ ] Export button downloads JSON file
- [ ] Import button opens file picker
- [ ] Preview imported guidelines before confirming
- [ ] Handle duplicate detection
- [ ] Progress indicator for bulk operations
- [ ] Error messages for invalid files
- [ ] Unit tests verify file handling

**Priority:** Low

---

### US-F01-21: Implement Guardrails API Client

**As a** frontend developer
**I want** TypeScript API client functions
**So that** components can fetch and update data

**Acceptance Criteria:**
- [ ] `listGuidelines()` with filtering
- [ ] `getGuideline(id)` single guideline
- [ ] `createGuideline(data)` create new
- [ ] `updateGuideline(id, data)` update existing
- [ ] `deleteGuideline(id)` delete
- [ ] `toggleGuideline(id)` toggle enabled
- [ ] `listAuditLogs()` with filtering
- [ ] `evaluateContext(context)` preview
- [ ] `exportGuidelines()` and `importGuidelines()`
- [ ] React Query hooks for data fetching
- [ ] Unit tests with mocked axios

**Priority:** High

---

### US-F01-22: Implement Guardrails Store

**As a** frontend developer
**I want** a Zustand store for guardrails state
**So that** components share state efficiently

**Acceptance Criteria:**
- [ ] Store holds guidelines, filters, selection
- [ ] Actions for CRUD operations
- [ ] Editor state (open, editing guideline)
- [ ] Audit log state
- [ ] Persists filter preferences
- [ ] Unit tests verify state transitions

**Priority:** High

---

### US-F01-23: Build GuardrailsPage

**As a** UI user
**I want** a dedicated page for guardrails configuration
**So that** I can manage all guidelines in one place

**Acceptance Criteria:**
- [ ] Page accessible via sidebar navigation
- [ ] Header with title, import/export buttons
- [ ] Three-column layout: filters, list, editor
- [ ] Collapsible audit log panel at bottom
- [ ] Loading and error states
- [ ] Responsive layout
- [ ] Unit tests verify page composition

**Priority:** High

---

### US-F01-24: Add Navigation and Routing

**As a** UI user
**I want** guardrails accessible from navigation
**So that** I can find the configuration page

**Acceptance Criteria:**
- [ ] Add route `/guardrails` to router
- [ ] Add navigation item to sidebar
- [ ] Icon appropriate for configuration
- [ ] Active state when on page
- [ ] Guard route if feature flag disabled

**Priority:** High

---

### US-F01-25: Create Mock Data for Development

**As a** frontend developer
**I want** mock data for guardrails
**So that** I can develop UI without backend

**Acceptance Criteria:**
- [ ] Mock guidelines covering all categories
- [ ] Mock audit log entries
- [ ] Mock service implementing all API functions
- [ ] Simulated network delay
- [ ] Toggle between mock and real via env var
- [ ] Unit tests use mock data

**Priority:** High

---

### US-F01-26: Bootstrap Default Guidelines

**As a** system maintainer
**I want** default guidelines from existing rules
**So that** the system works out of the box

**Acceptance Criteria:**
- [ ] Script converts `.claude/rules/*.md` to guidelines
- [ ] Default guidelines cover cognitive isolation per agent
- [ ] Default guidelines cover HITL gates
- [ ] Default guidelines cover TDD protocol
- [ ] Bootstrap is idempotent (skip existing)
- [ ] Can be run via CLI or on startup

**Priority:** Medium

---

### US-F01-27: Integrate Agents with Guardrails

**As an** agent developer
**I want** agents to call guardrails_get_context
**So that** they receive dynamic guidelines

**Acceptance Criteria:**
- [ ] Agents call `guardrails_get_context` at task start
- [ ] Context includes current agent role
- [ ] Context includes domain from task
- [ ] Context includes action type
- [ ] Context includes paths being accessed
- [ ] Agent receives combined instructions
- [ ] Agent receives tool allow/deny lists
- [ ] Documentation updated for agent developers

**Priority:** Medium

---

### US-F01-28: Document Guardrails System

**As a** project maintainer
**I want** documentation for the guardrails system
**So that** users understand how to configure it

**Acceptance Criteria:**
- [ ] Overview document explaining the concept
- [ ] Schema reference for guidelines
- [ ] Examples of common guideline patterns
- [ ] UI user guide
- [ ] API reference
- [ ] Migration guide from static rules

**Priority:** Low

---

## Non-Functional Requirements

### Performance

- Guideline evaluation completes in < 100ms
- List endpoint returns in < 200ms for 100 guidelines
- Audit log queries return in < 500ms for 1000 entries
- UI remains responsive during save operations

### Reliability

- Elasticsearch unavailable does not crash agents (fallback to defaults)
- Version conflicts are handled gracefully
- Import failures do not corrupt existing data

### Maintainability

- All public APIs have comprehensive documentation
- Test coverage > 80% for backend, > 70% for frontend
- Components follow existing HITL UI patterns

### Security

- All inputs validated and sanitized
- Glob patterns cannot traverse outside project
- Audit trail is tamper-evident

## Story Dependencies

```
US-F01-01 (Models)
    |
    +---> US-F01-02 (ES Indices)
    |         |
    |         +---> US-F01-03 (Evaluator Core)
    |         |         |
    |         |         +---> US-F01-04 (Conflict Resolution)
    |         |         |
    |         |         +---> US-F01-05 (Audit Logging)
    |         |         |
    |         |         +---> US-F01-06 (MCP get_context)
    |         |         |
    |         |         +---> US-F01-07 (MCP log_decision)
    |         |
    |         +---> US-F01-08 (REST List/Get)
    |         |
    |         +---> US-F01-09 (REST Create/Update/Delete)
    |         |
    |         +---> US-F01-10 (REST Audit)
    |         |
    |         +---> US-F01-11 (REST Evaluate)
    |         |
    |         +---> US-F01-12 (REST Import/Export)
    |
    +---> US-F01-25 (Mock Data) ---> US-F01-21 (API Client)
                                         |
    US-F01-22 (Store) <------------------+
         |
         +---> US-F01-13 (GuidelinesList)
         |         |
         |         +---> US-F01-14 (GuidelineCard)
         |
         +---> US-F01-15 (GuidelineEditor)
         |         |
         |         +---> US-F01-16 (ConditionBuilder)
         |         |
         |         +---> US-F01-17 (ActionBuilder)
         |         |
         |         +---> US-F01-18 (GuidelinePreview)
         |
         +---> US-F01-19 (AuditLogViewer)
         |
         +---> US-F01-20 (ImportExportPanel)
         |
         +---> US-F01-23 (GuardrailsPage)
                   |
                   +---> US-F01-24 (Navigation)

US-F01-26 (Bootstrap) depends on US-F01-09
US-F01-27 (Agent Integration) depends on US-F01-06
US-F01-28 (Documentation) depends on all others
```

## Priority Summary

| Priority | Stories |
|----------|---------|
| High | US-F01-01, 02, 03, 04, 05, 06, 08, 09, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25 |
| Medium | US-F01-07, 10, 11, 18, 19, 26, 27 |
| Low | US-F01-12, 20, 28 |
