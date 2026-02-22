---
id: P14-F07
parent_id: P14
type: user_stories
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-21T00:00:00Z"
updated_at: "2026-02-21T00:00:00Z"
dependencies: []
tags:
  - cursor
  - agent-backend
---

# User Stories: Cursor CLI Backend (P14-F07)

---

## US-01: Select Cursor as a node backend

**As a** workflow author
**I want** to set `backend: cursor` on an agent node in my workflow definition
**So that** that node is dispatched to the Cursor CLI agent container instead of Claude Code CLI

### Acceptance Criteria

- `AgentNodeConfig.backend` accepts `'cursor'` as a valid value
- A workflow node with `backend: "cursor"` routes to `executeNodeRemote()` in the execution engine
- A workflow node without `backend` (or `backend: "claude"`) routes to the existing Claude CLI path
- The `backend` field is preserved through workflow serialization/deserialization

### Test Scenarios

**Given** a workflow node with `config.backend === "cursor"`
**When** the execution engine processes it
**Then** `executeNodeRemote()` is called (not `executeNodeMock` or `executeNodeReal`)

**Given** a workflow node with no `backend` field
**When** the execution engine processes it in mock mode
**Then** `executeNodeMock()` is called (existing behavior unchanged)

---

## US-02: Configure Cursor agent URL in settings

**As a** developer or operator
**I want** to configure the Cursor agent container URL in the Workflow Studio settings page
**So that** I can point the execution engine at a local or remote cursor-agent instance

### Acceptance Criteria

- Settings page shows a "Cursor Agent URL" field with `type="url"` and `pattern="https?://.+"`
- Default value is `http://localhost:8090`
- The value persists across app restarts via `electron-config.json`
- The configured URL is passed to `ExecutionEngine` as `remoteAgentUrl` at execution start
- Invalid URL schemes (e.g. `file://`) are blocked by both the input pattern and engine validation

### Test Scenarios

**Given** the settings page is open
**When** I enter `http://cursor-agent:8090` in the Cursor Agent URL field
**Then** the value is saved to `AppSettings.cursorAgentUrl`

**Given** `cursorAgentUrl` is `file:///etc/passwd`
**When** the engine attempts to execute a Cursor node
**Then** the node fails with `"Invalid or missing remote agent URL"`

---

## US-03: Opt-in to cursor-agent container

**As a** developer
**I want** the cursor-agent service to be opt-in via a Docker Compose profile
**So that** running `docker compose up -d` does not fail for developers who don't have the Cursor binary

### Acceptance Criteria

- `docker compose up -d` (no profile) starts without pulling or building cursor-agent
- `docker compose --profile cursor up cursor-agent` starts the cursor-agent service
- cursor-agent depends on both elasticsearch (service_healthy) and redis (service_started)
- cursor-agent exposes port 8090

### Test Scenarios

**Given** the standard `docker compose up -d` command
**When** executed without `--profile cursor`
**Then** cursor-agent is not started and no build error occurs

---

## US-04: Authenticated execution endpoint

**As a** security-conscious operator
**I want** the `/execute` endpoint to require a Bearer token
**So that** unauthorized callers cannot dispatch arbitrary agent commands against the workspace

### Acceptance Criteria

- When `CURSOR_API_KEY` env var is set, `POST /execute` without `Authorization` returns HTTP 401
- When `CURSOR_API_KEY` env var is set, a wrong token returns HTTP 401
- A correct `Authorization: Bearer <key>` header is accepted
- `GET /health` is always unauthenticated (required for Docker healthcheck)
- When `CURSOR_API_KEY` is not set, all requests are accepted (open for local dev)

### Test Scenarios

**Given** `CURSOR_API_KEY=secret` is set
**When** I POST to `/execute` with `Authorization: Bearer wrong`
**Then** I receive HTTP 401 `{"success":false,"error":"Unauthorized"}`

**Given** `CURSOR_API_KEY=secret` is set
**When** I GET `/health`
**Then** I receive HTTP 200 regardless of authorization header

---

## US-05: Safe workspace path handling

**As a** security-conscious operator
**I want** the cursor-agent to reject `workspacePath` values outside `/workspace`
**So that** a malicious or misconfigured caller cannot direct the agent to write files elsewhere in the container

### Acceptance Criteria

- `workspacePath` values that resolve outside `/workspace` return HTTP 400
- Path traversal attempts (e.g. `/workspace/../etc`) are rejected after `resolve()`
- Valid paths within `/workspace` are accepted

### Test Scenarios

**Given** a POST to `/execute` with `workspacePath: "/workspace/../etc"`
**When** the server processes the request
**Then** HTTP 400 is returned with `"workspacePath must be within /workspace"`

---

## US-06: Cursor node abort cancels in-flight request

**As a** workflow author
**I want** aborting an execution to cancel the Cursor agent's in-flight HTTP request
**So that** I'm not left waiting up to 5 minutes for a long-running task to finish before the workflow stops

### Acceptance Criteria

- Calling `engine.abort()` during a Cursor node execution triggers `AbortController.abort()`
- The fetch is cancelled within ~500ms of the abort call
- The aborted node is marked `failed` with `"Execution aborted"`
- The execution reaches `status: "aborted"` after the node fails

### Test Scenarios

**Given** a Cursor node is executing (fetch in progress)
**When** `engine.abort()` is called
**Then** the node's status becomes `"failed"` with error `"Execution aborted"` within ~1s

---

## US-07: Cursor CLI profile in Python worker backend

**As a** Python worker process
**I want** `CLIAgentBackend(cli="cursor")` to build a valid `agent` CLI command
**So that** Python-side agents can also dispatch via Cursor CLI without the HTTP container

### Acceptance Criteria

- `CLIAgentBackend(cli="cursor")` initializes without error
- `_build_command()` produces `["agent", "-p", ...]` with `--force --output-format json`
- `--max-turns`, `--system-prompt`, `--max-budget-usd` are **not** added (unsupported flags)
- `--model` is added when `BackendConfig.model` is set
- `health_check()` returns `bool` (True if `agent` binary on PATH, False otherwise)

### Test Scenarios

**Given** `CLIAgentBackend(cli="cursor")`
**When** `_build_command("task", BackendConfig(max_turns=5))` is called
**Then** the result starts with `"agent"` and contains no `"--max-turns"`
