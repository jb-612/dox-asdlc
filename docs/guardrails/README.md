# Guardrails Configuration System (P11-F01)

The Guardrails Configuration System provides contextually-conditional rules for agent behavior in the aSDLC project. Instead of relying solely on static markdown rules, guidelines are stored in Elasticsearch, evaluated at runtime, and injected into agent sessions through Claude Code hooks. This enables dynamic, per-context enforcement of cognitive isolation, HITL gates, TDD protocols, and more.

## Architecture

The system architecture is documented in Mermaid diagrams:

- [Component Architecture](../diagrams/26-guardrails-architecture.mmd) - Full system topology
- [Hook Lifecycle Sequence](../diagrams/27-guardrails-hook-sequence.mmd) - UserPromptSubmit, PreToolUse, SubagentStart flows
- [Data Flow](../diagrams/28-guardrails-data-flow.mmd) - Guideline lifecycle from creation through enforcement to audit

### Component Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| Models | `src/core/guardrails/models.py` | Frozen dataclasses: `Guideline`, `GuidelineCondition`, `GuidelineAction`, `TaskContext`, `EvaluatedContext`, `EvaluatedGuideline`, `GateDecision` |
| Evaluator | `src/core/guardrails/evaluator.py` | TTL-cached guideline evaluation with condition matching, match scoring, and priority-based conflict resolution |
| Config | `src/core/guardrails/config.py` | Environment-based configuration (`GuardrailsConfig.from_env()`) |
| Exceptions | `src/core/guardrails/exceptions.py` | `GuardrailsError`, `GuidelineNotFoundError`, `GuidelineValidationError`, `GuidelineConflictError` |
| ES Store | `src/infrastructure/guardrails/guardrails_store.py` | Async CRUD for guidelines, append-only audit log, optimistic locking, multi-tenant index support |
| ES Mappings | `src/infrastructure/guardrails/guardrails_mappings.py` | Elasticsearch index mappings for `guardrails-config` and `guardrails-audit` |
| MCP Server | `src/infrastructure/guardrails/guardrails_mcp.py` | `guardrails_get_context` and `guardrails_log_decision` tools over stdio MCP transport |
| REST API | `src/orchestrator/routes/guardrails_api.py` | FastAPI CRUD, evaluate, audit, import/export endpoints |
| API Models | `src/orchestrator/api/models/guardrails.py` | Pydantic request/response models for the REST API |
| Bootstrap | `scripts/bootstrap_guardrails.py` | Generates 11 default guidelines from project rules and loads them into Elasticsearch |
| Hooks | `.claude/hooks/guardrails-*.py` | UserPromptSubmit, PreToolUse, SubagentStart hook scripts |
| HITL UI | `docker/hitl-ui/src/components/guardrails/` | React components for managing guidelines through the web interface |

## Quick Start

### 1. Bootstrap Default Guidelines

Load the 11 built-in guidelines (cognitive isolation, HITL gates, TDD protocol, context constraints) into Elasticsearch:

```bash
python scripts/bootstrap_guardrails.py --es-url http://localhost:9200
```

Use `--dry-run` to preview what would be created without writing to Elasticsearch:

```bash
python scripts/bootstrap_guardrails.py --dry-run
```

For multi-tenant setups, add an index prefix:

```bash
python scripts/bootstrap_guardrails.py --es-url http://localhost:9200 --index-prefix tenant1
```

### 2. Access the HITL UI

Navigate to the `/guardrails` route in the HITL UI:

- **Local Dev (Docker Compose):** `http://localhost:3000/guardrails`
- **K8s (port-forward):** `http://localhost:3000/guardrails`
- **K8s (ingress):** `http://dox.local/guardrails`

The UI provides a two-column layout:
- Left: filterable, sortable, paginated guidelines list
- Right: guideline editor or preview
- Bottom: collapsible audit log viewer
- Header: import/export controls

### 3. Evaluate via MCP

Use the `guardrails_get_context` MCP tool to evaluate which guidelines apply to a given context:

```
guardrails_get_context(agent="backend", action="implement", domain="P01")
```

This returns matched guidelines, combined instructions, tool restrictions, and HITL gate requirements.

## Configuration

Configuration is loaded from environment variables via `GuardrailsConfig.from_env()`.

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GUARDRAILS_ENABLED` | `true` | Master enable/disable for the guardrails system. Accepts `true` or `1` (case-insensitive) as enabled. |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch connection URL. |
| `GUARDRAILS_INDEX_PREFIX` | `""` (empty) | Tenant prefix for Elasticsearch indices. When set, indices become `<prefix>_guardrails-config` and `<prefix>_guardrails-audit`. |
| `GUARDRAILS_CACHE_TTL` | `60.0` | Seconds to cache enabled guidelines in the evaluator. Set to `0` to disable caching. |
| `GUARDRAILS_FALLBACK_MODE` | `permissive` | Behavior when Elasticsearch is unavailable: `permissive` (allow all) or `restrictive` (block). |

## Guideline Schema Reference

A guideline is the core data model. All fields are required unless noted.

### Guideline

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g., `"cognitive-isolation-backend"`). |
| `name` | `string` | Human-readable name. |
| `description` | `string` | Detailed description of the guideline's purpose. |
| `enabled` | `boolean` | Master enable/disable toggle. |
| `category` | `GuidelineCategory` | Category for grouping and filtering. |
| `priority` | `integer` (0-1000) | Priority for conflict resolution. Higher values win. |
| `condition` | `GuidelineCondition` | When the guideline applies. |
| `action` | `GuidelineAction` | What to do when condition matches. |
| `metadata` | `dict` | Additional metadata for extensibility. |
| `version` | `integer` | Version number for optimistic locking. |
| `created_at` | `datetime` (ISO 8601) | Creation timestamp. |
| `updated_at` | `datetime` (ISO 8601) | Last update timestamp. |
| `created_by` | `string` | Creator identifier (e.g., `"bootstrap"`, `"api"`). |

### GuidelineCategory

| Value | Description |
|-------|-------------|
| `cognitive_isolation` | Agent path restrictions and domain boundaries. |
| `hitl_gate` | Human-in-the-loop gate requirements. |
| `tdd_protocol` | Test-driven development enforcement. |
| `context_constraint` | Commit size limits, review requirements, etc. |
| `audit_telemetry` | Audit and telemetry rules. |
| `security` | Security-related guardrails. |
| `custom` | User-defined category. |

### GuidelineCondition

All fields use AND logic between them (all specified fields must match). Lists within each field use OR logic (any item matching is sufficient). A field set to `null` acts as a wildcard (matches anything).

| Field | Type | Description |
|-------|------|-------------|
| `agents` | `list[string]` or `null` | Agent role names to match (e.g., `["backend", "frontend"]`). |
| `domains` | `list[string]` or `null` | Domain identifiers (e.g., `["P01", "P02"]`). |
| `actions` | `list[string]` or `null` | Action types (e.g., `["implement", "review", "commit"]`). |
| `paths` | `list[string]` or `null` | File path glob patterns (e.g., `["src/workers/*", "docker/**"]`). Uses `fnmatch` for matching. |
| `events` | `list[string]` or `null` | Triggering event types (e.g., `["commit", "devops_invocation"]`). |
| `gate_types` | `list[string]` or `null` | HITL gate types (e.g., `["devops_invocation", "protected_path_commit"]`). |
| `custom` | `dict` or `null` | Additional custom condition fields (not indexed in ES). |

### GuidelineAction

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ActionType` | **Required.** Action type (see table below). |
| `instruction` | `string` or `null` | Instruction text injected into agent context. |
| `tools_allowed` | `list[string]` or `null` | Tool names the agent is allowed to use. |
| `tools_denied` | `list[string]` or `null` | Tool names the agent is denied from using. Denied always wins over allowed. |
| `gate_type` | `string` or `null` | HITL gate type to trigger (e.g., `"devops_invocation"`). |
| `gate_threshold` | `string` or `null` | Gate threshold (e.g., `"mandatory"`, `"advisory"`). |
| `max_files` | `integer` or `null` | Maximum files allowed in a commit. |
| `require_tests` | `boolean` or `null` | Whether tests are required before proceeding. |
| `require_review` | `boolean` or `null` | Whether independent review is required. |
| `parameters` | `dict` or `null` | Additional action parameters (not indexed in ES). |

### ActionType

| Value | Description |
|-------|-------------|
| `instruction` | Inject instruction text into agent context. |
| `tool_restriction` | Restrict which tools an agent can use. |
| `hitl_gate` | Require a human-in-the-loop gate before proceeding. |
| `constraint` | Enforce a constraint (commit size, tests required, etc.). |
| `telemetry` | Audit and telemetry logging. |

## Common Patterns

### Cognitive Isolation Guideline

Restricts an agent to its domain paths:

```json
{
  "id": "cognitive-isolation-backend",
  "name": "Cognitive Isolation: Backend",
  "description": "Restricts backend agent to its domain paths.",
  "enabled": true,
  "category": "cognitive_isolation",
  "priority": 900,
  "condition": {
    "agents": ["backend"]
  },
  "action": {
    "type": "tool_restriction",
    "instruction": "Backend agent may only modify files under: src/workers/, src/orchestrator/, src/infrastructure/, src/core/. Read access to other paths is allowed for context.",
    "tools_allowed": ["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
    "tools_denied": []
  },
  "metadata": {"source": "parallel-coordination.md"},
  "version": 1,
  "created_at": "2026-02-05T00:00:00Z",
  "updated_at": "2026-02-05T00:00:00Z",
  "created_by": "bootstrap"
}
```

### HITL Gate Guideline

Requires human confirmation before a critical operation:

```json
{
  "id": "hitl-gate-devops-invocation",
  "name": "HITL Gate: DevOps Invocation",
  "description": "Mandatory HITL gate before any devops operation.",
  "enabled": true,
  "category": "hitl_gate",
  "priority": 950,
  "condition": {
    "events": ["devops_invocation"],
    "gate_types": ["devops_invocation"]
  },
  "action": {
    "type": "hitl_gate",
    "gate_type": "devops_invocation",
    "gate_threshold": "mandatory",
    "instruction": "Before any devops operation, present options: A) Run devops agent here, B) Send to separate DevOps CLI, C) Show instructions for manual execution."
  },
  "metadata": {"source": "hitl-gates.md", "gate_number": 1},
  "version": 1,
  "created_at": "2026-02-05T00:00:00Z",
  "updated_at": "2026-02-05T00:00:00Z",
  "created_by": "bootstrap"
}
```

### TDD Enforcement Guideline

Enforces test-driven development for implementation tasks:

```json
{
  "id": "tdd-protocol",
  "name": "TDD Protocol: Red-Green-Refactor",
  "description": "Enforces TDD for all implementation tasks.",
  "enabled": true,
  "category": "tdd_protocol",
  "priority": 800,
  "condition": {
    "actions": ["implement", "code", "fix", "refactor"]
  },
  "action": {
    "type": "constraint",
    "instruction": "Follow Red-Green-Refactor: 1) RED: Write a failing test first. 2) GREEN: Write minimal code to make the test pass. 3) REFACTOR: Clean up while keeping tests green. Never proceed to the next task with failing tests.",
    "require_tests": true
  },
  "metadata": {"source": "workflow.md"},
  "version": 1,
  "created_at": "2026-02-05T00:00:00Z",
  "updated_at": "2026-02-05T00:00:00Z",
  "created_by": "bootstrap"
}
```

## REST API Reference

All endpoints are prefixed with `/api/guardrails`. The API is served by FastAPI as part of the orchestrator service.

### List Guidelines

```
GET /api/guardrails
```

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | `string` | `null` | Filter by category (e.g., `cognitive_isolation`, `hitl_gate`). |
| `enabled` | `boolean` | `null` | Filter by enabled status. |
| `page` | `integer` | `1` | Page number (1-based). |
| `page_size` | `integer` | `20` | Results per page (1-100). |

Response: `GuidelinesListResponse` with `guidelines`, `total`, `page`, `page_size`.

### Get Guideline

```
GET /api/guardrails/{guideline_id}
```

Returns a single `GuidelineResponse`. Returns 404 if not found.

### Create Guideline

```
POST /api/guardrails
```

Request body: `GuidelineCreate` (name, description, category, priority, enabled, condition, action).

Returns 201 with the created `GuidelineResponse`. A UUID is generated for the `id` field.

### Update Guideline

```
PUT /api/guardrails/{guideline_id}
```

Request body: `GuidelineUpdate` (all fields optional except `version`). Uses optimistic locking: the `version` field must match the current version in the store. Returns 409 on version conflict.

### Delete Guideline

```
DELETE /api/guardrails/{guideline_id}
```

Returns 204 No Content on success. Returns 404 if not found.

### Toggle Enabled State

```
POST /api/guardrails/{guideline_id}/toggle
```

Flips the `enabled` flag on the guideline. Returns the updated `GuidelineResponse`. Uses optimistic locking internally.

### Get Audit Log

```
GET /api/guardrails/audit
```

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `guideline_id` | `string` | `null` | Filter by guideline ID. |
| `event_type` | `string` | `null` | Filter by event type (e.g., `guideline_created`, `gate_decision`). |
| `date_from` | `string` | `null` | ISO date lower bound (inclusive). |
| `date_to` | `string` | `null` | ISO date upper bound (inclusive). |
| `page` | `integer` | `1` | Page number (1-based). |
| `page_size` | `integer` | `50` | Results per page (1-200). |

Response: `AuditLogResponse` with `entries` and `total`.

### Evaluate Context

```
POST /api/guardrails/evaluate
```

Request body: `TaskContextRequest` with fields `agent`, `domain`, `action`, `paths`, `event`, `gate_type`, `session_id` (all optional).

Response: `EvaluatedContextResponse` with `matched_count`, `combined_instruction`, `tools_allowed`, `tools_denied`, `hitl_gates`, and `guidelines` (list of matched guidelines with match scores).

### Export Guidelines

```
GET /api/guardrails/export
```

Query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | `string` | `null` | Optional category filter. |

Returns a flat JSON array of all guidelines (up to 10,000).

### Import Guidelines

```
POST /api/guardrails/import
```

Request body: JSON array of `GuidelineCreate` objects.

Response: `{"imported": N, "errors": [...]}`. Individual failures are captured without aborting the entire import.

## MCP Tool Reference

The Guardrails MCP server exposes two tools over stdio JSON-RPC transport.

### guardrails_get_context

Evaluate guardrails for a task context and get applicable guidelines.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent` | `string` | No | Agent role name (e.g., `"backend"`, `"frontend"`). |
| `domain` | `string` | No | Domain context (e.g., `"P01"`, `"P05"`). |
| `action` | `string` | No | Action being performed (e.g., `"implement"`, `"review"`). |
| `paths` | `list[string]` | No | File paths involved in the action. |
| `event` | `string` | No | Hook event type (e.g., `"commit"`, `"pre_tool_use"`). |
| `gate_type` | `string` | No | HITL gate type (e.g., `"devops_invocation"`). |
| `session_id` | `string` | No | Session identifier for audit tracking. |

**Response:**

```json
{
  "success": true,
  "matched_count": 2,
  "combined_instruction": "Follow TDD protocol...\n\nBackend agent may only modify...",
  "tools_allowed": ["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
  "tools_denied": [],
  "hitl_gates": ["devops_invocation"],
  "guidelines": [
    {
      "id": "tdd-protocol",
      "name": "TDD Protocol: Red-Green-Refactor",
      "priority": 800,
      "match_score": 1.0,
      "matched_fields": ["actions"]
    }
  ]
}
```

When `GUARDRAILS_ENABLED=false`, returns an empty result with `matched_count: 0`.

### guardrails_log_decision

Log a HITL gate decision for audit trail.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guideline_id` | `string` | Yes | The guideline that triggered the gate. |
| `result` | `string` | Yes | Decision result: `"approved"`, `"rejected"`, or `"skipped"`. |
| `reason` | `string` | Yes | Reason for the decision. |
| `user_response` | `string` | No | The user's response text. |
| `agent` | `string` | No | Agent role name. |
| `domain` | `string` | No | Domain context. |
| `action` | `string` | No | Action being performed. |
| `session_id` | `string` | No | Session identifier. |

**Response:**

```json
{
  "success": true,
  "audit_id": "a1b2c3d4-e5f6-..."
}
```

## Hook Integration

Three Claude Code hooks provide runtime guardrails enforcement. All hooks are Python scripts located at `.claude/hooks/`.

### UserPromptSubmit: guardrails-inject.py

**When:** Every time the user submits a prompt.

**What it does:**
1. Reads the user prompt from stdin JSON (`{"prompt": "...", "sessionId": "..."}`)
2. Uses `ContextDetector` to extract context from the prompt (agent, domain, action) via keyword matching
3. Calls the `GuardrailsEvaluator` to find matching guidelines
4. Writes the evaluation result to a temp file (`/tmp/guardrails-{sessionId}.json`) for cross-hook state sharing
5. Outputs `{"additionalContext": "## Active Guardrails\n..."}` to inject matched guidelines into the prompt context

**Exit behavior:** Always exits 0 (never blocks user input).

### PreToolUse: guardrails-enforce.py

**When:** Every time Claude invokes a tool (Write, Edit, Bash, etc.).

**What it does:**
1. Reads tool call info from stdin JSON (`{"tool": "Write", "arguments": {"file_path": "..."}, "sessionId": "..."}`)
2. Reads the cached guardrails from `/tmp/guardrails-{sessionId}.json` (written by UserPromptSubmit hook)
3. Sanitizes file paths (rejects directory traversal patterns like `..`)
4. Checks tool restrictions:
   - If tool is in `tools_denied`: exits 2 (BLOCK) with reason on stderr
   - If `tools_allowed` is set and tool is not on the list: outputs a WARNING as `additionalContext`
   - Otherwise: exits 0 (clean pass)

**Exit behavior:**
- Exit 0: Allow the tool call (optionally with a warning in `additionalContext`)
- Exit 2: Block the tool call (reason printed to stderr)

### SubagentStart: guardrails-subagent.py

**When:** Every time a subagent is spawned (e.g., PM CLI spawns a backend subagent).

**What it does:**
1. Reads agent info from stdin JSON (`{"agentName": "backend", "sessionId": "...", "parentSessionId": "..."}`)
2. Tries to read the parent session's cached guardrails first
3. If no parent cache, calls the evaluator directly for the agent
4. Writes the agent's own guardrails cache for its PreToolUse hooks
5. Outputs `{"additionalContext": "## Guardrails for backend agent\n..."}` with agent-specific rules

**Exit behavior:** Always exits 0 (never blocks subagent startup).

### Cross-Hook State

The hooks share state through temporary JSON files:

```
/tmp/guardrails-{sessionId}.json
```

File structure:

```json
{
  "timestamp": "2026-02-05T10:00:00+00:00",
  "ttl_seconds": 300,
  "context": {"agent": "backend", "domain": "P01", "action": "implement"},
  "evaluated": {
    "matched_guidelines": [...],
    "combined_instruction": "...",
    "tools_allowed": [...],
    "tools_denied": [...],
    "hitl_gates": [...]
  }
}
```

The cache has a 5-minute TTL. If the cache is expired or missing, the PreToolUse hook allows the tool call through (fail-open behavior). The UserPromptSubmit hook refreshes the cache on every prompt.

## Evaluation Logic

### Condition Matching

The evaluator checks each enabled guideline's condition against the current `TaskContext`:

1. **Scalar fields** (agents, domains, actions, events, gate_types): The condition specifies a list of allowed values. The context provides a single value. If the context value is in the condition's list, the field matches. If the condition field is `null` or empty, it acts as a wildcard.

2. **Path matching**: Uses `fnmatch.fnmatch` for glob patterns. Any context path matching any condition pattern counts as a match.

3. **AND across fields**: All non-wildcard condition fields must match for the guideline to activate.

4. **OR within fields**: Any value in a condition list matching the context value is sufficient.

### Match Score

Each matched guideline receives a score: `matched_fields / total_non_wildcard_fields`. A guideline with all conditions specified and matched gets a score of 1.0. A guideline with only wildcards gets a default score of 1.0 (it matches everything).

### Conflict Resolution

When multiple guidelines match:

1. Guidelines are sorted by `priority` descending (stable sort preserves order for equal priorities).
2. Instructions are concatenated in priority order, separated by double newlines.
3. `tools_allowed` are merged as a union across all matched guidelines.
4. `tools_denied` are merged as a union. **Denied always wins over allowed**: if a tool appears in both sets, it is removed from allowed.
5. `hitl_gates` are collected as a union of unique gate types.

### Caching

The evaluator caches the full list of enabled guidelines in memory with a configurable TTL (default 60 seconds). This reduces Elasticsearch queries during rapid evaluation cycles. Use `evaluator.invalidate_cache()` to force a fresh fetch.

## Default Guidelines

The bootstrap script creates 11 default guidelines derived from project rules:

| ID | Category | Priority | Description |
|----|----------|----------|-------------|
| `cognitive-isolation-backend` | cognitive_isolation | 900 | Restricts backend agent to its domain paths |
| `cognitive-isolation-frontend` | cognitive_isolation | 900 | Restricts frontend agent to its domain paths |
| `cognitive-isolation-orchestrator` | cognitive_isolation | 900 | Restricts orchestrator to meta file paths |
| `cognitive-isolation-devops` | cognitive_isolation | 900 | Restricts devops agent to infrastructure paths |
| `hitl-gate-devops-invocation` | hitl_gate | 950 | Mandatory gate before devops operations |
| `hitl-gate-protected-path-commit` | hitl_gate | 950 | Mandatory gate for commits to contracts/ or .claude/ |
| `hitl-gate-contract-change` | hitl_gate | 950 | Mandatory gate for API contract modifications |
| `hitl-gate-destructive-workstation-op` | hitl_gate | 950 | Mandatory gate for destructive operations on workstation |
| `tdd-protocol` | tdd_protocol | 800 | Enforces Red-Green-Refactor for implementation tasks |
| `context-constraint-commit-size` | context_constraint | 700 | Limits commit size to 10 files |
| `context-constraint-review-required` | context_constraint | 700 | Requires independent review before feature completion |

The bootstrap is idempotent: existing guidelines are skipped without modification.

## HITL UI Components

The guardrails management UI is built with React and lives in `docker/hitl-ui/src/components/guardrails/`. Components are exported via the barrel file `index.ts`.

| Component | File | Purpose |
|-----------|------|---------|
| `GuardrailsPage` | `GuardrailsPage.tsx` | Main page layout: two-column with collapsible audit panel |
| `GuidelinesList` | `GuidelinesList.tsx` | Filterable, sortable, paginated list of guidelines |
| `GuidelineCard` | `GuidelineCard.tsx` | Individual guideline summary card with enable/disable toggle |
| `GuidelineEditor` | `GuidelineEditor.tsx` | Create/edit form for guidelines |
| `GuidelinePreview` | `GuidelinePreview.tsx` | Read-only detail view of a selected guideline |
| `ConditionBuilder` | `ConditionBuilder.tsx` | Visual builder for guideline conditions (agents, domains, paths, etc.) |
| `ActionBuilder` | `ActionBuilder.tsx` | Visual builder for guideline actions (type, instruction, tools, gates) |
| `AuditLogViewer` | `AuditLogViewer.tsx` | Displays audit log entries with filtering |
| `ImportExportPanel` | `ImportExportPanel.tsx` | Bulk import/export controls |

## Elasticsearch Indices

### guardrails-config

Stores guideline documents. Key mapping properties:

- `id` (keyword), `name` (text + keyword), `description` (text)
- `enabled` (boolean), `category` (keyword), `priority` (integer)
- `condition.agents`, `condition.domains`, `condition.actions`, `condition.paths`, `condition.events`, `condition.gate_types` (all keyword)
- `action.type` (keyword), `action.instruction` (text), `action.tools_allowed`, `action.tools_denied` (keyword)
- `version` (integer), `created_at`, `updated_at` (date), `created_by` (keyword)

Index settings: 1 shard, 0 replicas (single-node development).

### guardrails-audit

Stores audit log entries (append-only). Key mapping properties:

- `id` (keyword), `event_type` (keyword), `timestamp` (date)
- `guideline_id` (keyword), `guideline_name` (text)
- `context.agent`, `context.domain`, `context.action`, `context.session_id` (keyword)
- `decision.result` (keyword), `decision.reason` (text), `decision.user_response` (keyword)
- `changes.field`, `changes.old_value`, `changes.new_value` (keyword/text)
- `actor` (keyword), `tenant_id` (keyword)

## Error Handling

All guardrails exceptions inherit from `GuardrailsError`, which inherits from `ASDLCError`:

| Exception | When Raised | HTTP Status |
|-----------|------------|-------------|
| `GuardrailsError` | Base exception for any guardrails failure | 503 |
| `GuidelineNotFoundError` | Guideline ID does not exist in the store | 404 |
| `GuidelineValidationError` | Guideline data fails validation | 400 |
| `GuidelineConflictError` | Version mismatch during update (optimistic locking) | 409 |

The hooks and MCP server use fail-open behavior: if Elasticsearch is unavailable, the system allows operations to proceed (in `permissive` fallback mode) rather than blocking all agent work.

## Troubleshooting

### Guardrails not loading

1. Verify Elasticsearch is running: `curl http://localhost:9200/_cluster/health`
2. Check that guidelines exist: `curl http://localhost:9200/guardrails-config/_count`
3. Verify `GUARDRAILS_ENABLED` is not set to `false`
4. Run bootstrap if indices are empty: `python scripts/bootstrap_guardrails.py`

### Hook not firing

1. Verify hook files exist at `.claude/hooks/guardrails-*.py`
2. Check that hooks are executable: `ls -la .claude/hooks/guardrails-*.py`
3. Check hook stderr output for errors (hooks log to stderr)
4. Verify the cache file exists: `ls /tmp/guardrails-*.json`

### Tool unexpectedly blocked

1. Check the cached guardrails: `cat /tmp/guardrails-{sessionId}.json`
2. Review the `tools_denied` list in the cached evaluation
3. Check which guidelines matched by examining `matched_guidelines`
4. Disable the offending guideline via the UI or API: `POST /api/guardrails/{id}/toggle`

### Stale cache

The cache TTL is 5 minutes. If you change guidelines and need immediate effect:
1. Delete the cache file: `rm /tmp/guardrails-*.json`
2. The next prompt submission will re-evaluate and create a fresh cache
