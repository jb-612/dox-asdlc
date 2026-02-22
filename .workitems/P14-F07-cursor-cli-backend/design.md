---
id: P14-F07
parent_id: P14
type: design
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-21T00:00:00Z"
updated_at: "2026-02-21T00:00:00Z"
dependencies:
  - P14-F04
  - P14-F05
tags:
  - cursor
  - agent-backend
  - docker
  - execution-engine
---

# Design: Cursor CLI Backend (P14-F07)

## Overview

This feature adds Cursor CLI as a second agent backend for the P14 Workflow Studio execution
engine. The design follows the decision recorded in `docs/decisions/cursor-cli-integration.md`.

Cursor CLI differs from Claude Code CLI in several key ways (see ADR gap analysis). Rather than
folding it into the existing Python workers container, it runs in a **new minimal container**
(`docker/cursor-agent/`) with a lightweight Express HTTP API. The Electron execution engine
dispatches nodes with `config.backend === "cursor"` via `fetch()` to this container, receives a
JSON result, and continues the DAG traversal — the same as any other node execution path.

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| P14-F04 (Execution Walkthrough) | Internal | `ExecutionEngine` class must exist |
| P14-F05 (CLI Backend Wiring) | Internal | `AgentNodeConfig`, IPC channels, settings infrastructure |
| `docs/decisions/cursor-cli-integration.md` | ADR | Gap analysis and architecture rationale |
| Cursor CLI binary (`agent`) | External | Not bundled; must be mounted at runtime |
| Node.js 20 Alpine | External | Container base image |
| Express 4 | External | HTTP server inside container |

## Architecture

> Diagram: [`docs/diagrams/31-cursor-agent-architecture.mmd`](../../../docs/diagrams/31-cursor-agent-architecture.mmd)

```
Electron Main Process                  Docker Network (asdlc-network)
┌────────────────────────────┐         ┌──────────────────────────────────┐
│  ExecutionEngine            │         │  cursor-agent:8090               │
│  ─────────────────          │         │  ┌────────────────────────────┐  │
│  executeNode(nodeId, node)  │         │  │  requireAuth middleware     │  │
│    if backend === "cursor"  │         │  │  (Bearer CURSOR_API_KEY)   │  │
│      executeNodeRemote()    │─POST───▶│  ├────────────────────────────┤  │
│        isValidRemoteUrl()   │         │  │  POST /execute             │  │
│        AbortController      │◀─JSON──│  │  resolveWorkspacePath()    │  │
│        fetch /execute       │         │  │  write .cursor/cli.json    │  │
│        check response.ok    │         │  │  copy role .mdc rules      │  │
│        parse result         │         │  ├────────────────────────────┤  │
│                             │         │  │  execFile("agent", args,   │  │
└────────────────────────────┘         │  │    { env: agentEnv,        │  │
                                        │  │      timeout, cwd })       │  │
                                        │  └────────────────────────────┘  │
                                        │                                   │
                                        │  /workspace (mounted ../: rw)    │
                                        │  /app/.cursor-defaults/rules/    │
                                        └──────────────────────────────────┘
```

## Interfaces

### HTTP API (`docker/cursor-agent/server.ts`)

```typescript
// POST /execute
interface ExecuteRequest {
  prompt: string;              // required
  model?: string;              // default: "auto"
  mode?: "agent"|"plan"|"ask"; // default: "agent"
  timeoutSeconds?: number;     // default: 300
  workspacePath?: string;      // default: "/workspace", must be within /workspace
  permissions?: {
    allow?: string[];          // written to .cursor/cli.json
    deny?: string[];
  };
  agentRole?: string;          // loads /app/.cursor-defaults/rules/{role}.mdc
  extraFlags?: string[];       // appended to agent CLI args
}

interface ExecuteResponse {
  success: boolean;
  result: string;
  sessionId?: string;
  durationMs?: number;
  durationApiMs?: number;
  error?: string;
}

// GET /health  (unauthenticated)
// → { status: "ok", service: "cursor-agent", timestamp: string }
```

Auth: `Authorization: Bearer ${CURSOR_API_KEY}` required on `/execute` when env var is set.

### Execution Engine Extension (`execution-engine.ts`)

```typescript
// New option
interface ExecutionEngineOptions {
  remoteAgentUrl?: string;   // e.g. "http://localhost:8090"
}

// New static helper
static isValidRemoteUrl(url: string): boolean
  // Returns true only for http: or https: schemes

// New private method
private async executeNodeRemote(nodeId: string, node: AgentNode): Promise<void>
  // Validates URL, checks isAborted, POSTs to /execute,
  // checks response.ok, parses result, updates node state.
  // Uses AbortController polled every 500ms against this.isAborted.
```

### Workflow Types (`workflow.ts`)

```typescript
interface AgentNodeConfig {
  backend?: 'claude' | 'cursor' | 'codex';  // added field
}
```

### Settings (`settings.ts`, `settings-service.ts`, `SettingsPage.tsx`)

```typescript
interface AppSettings {
  cursorAgentUrl: string;   // default: "http://localhost:8090"
}
```

### Python CLI Backend (`cli_backend.py`)

```python
_CLI_BINARY: dict[str, str] = {
    "claude": "claude",
    "codex": "codex",
    "cursor": "agent",      # Cursor binary is named 'agent'
}

_CLI_PROFILES["cursor"] = {
    "print_flag": "-p",
    "output_flag": ["--output-format", "json"],
    "skip_permissions": "--force",
    "max_turns_flag": None,        # not supported
    "budget_flag": None,           # not supported
    "model_flag": "--model",
    "schema_flag": None,           # not supported
    "system_prompt_flag": None,    # use .cursor/rules/ instead
    "allowed_tools_flag": None,    # use .cursor/cli.json instead
}
```

## Technical Approach

### Dispatch Routing

Node dispatch priority in `executeNode()`:

```
backend === "cursor"  →  executeNodeRemote()   (always, URL validated inside)
mockMode === true     →  executeNodeMock()
else                  →  executeNodeReal()      (Claude CLI via node-pty)
```

### Security Controls

| Threat | Control |
|--------|---------|
| SSRF via `remoteAgentUrl` | `isValidRemoteUrl()`: only `http:`/`https:` allowed |
| Unauthenticated access | `requireAuth` middleware: validates `Bearer CURSOR_API_KEY` |
| Path traversal in `workspacePath` | `resolveWorkspacePath()`: rejects paths outside `/workspace` |
| Supply chain (curl-pipe-bash) | Removed; binary must be mounted explicitly |
| Env leakage to subprocess | `agentEnv` allowlist: only 5 vars passed to `execFile` |

### Abort Handling

`executeNodeRemote` creates an `AbortController` and polls `this.isAborted` every 500ms. When
abort is detected, `controller.abort()` is called, the fetch throws `AbortError`, and the catch
block sets the node state to `failed` with `"Execution aborted"`. The `finally` block always
clears the interval.

### Permission Gap Workarounds (from ADR)

| Cursor Gap | Workaround |
|------------|------------|
| No `--max-turns` | HTTP wrapper `timeoutSeconds` enforces wall-clock limit |
| No `--system-prompt` | Role `.mdc` files copied from `/app/.cursor-defaults/rules/` |
| No `--allowedTools` | `permissions` field generates `.cursor/cli.json` per request |
| No `--max-budget-usd` | `durationApiMs` in response; external monitoring only |

## File Structure

```
docker/cursor-agent/
├── Dockerfile                      # Node 20 Alpine, requires binary mount
├── server.ts                       # Express HTTP server
├── package.json                    # dependencies: express; devDeps: tsx, tsc
├── tsconfig.json
├── mcp.json                        # MCP config for ES + Redis on Docker network
└── .cursor/
    ├── cli.json                    # Default permission config
    └── rules/
        ├── backend.mdc             # Backend agent role rules
        ├── frontend.mdc
        ├── reviewer.mdc
        └── planner.mdc

apps/workflow-studio/src/
├── main/services/execution-engine.ts   # +isValidRemoteUrl, +executeNodeRemote
├── main/services/settings-service.ts   # +cursorAgentUrl default
├── main/ipc/execution-handlers.ts      # +settingsService dep, passes remoteAgentUrl
├── main/ipc/index.ts                   # wires settingsService to execution handlers
├── renderer/pages/SettingsPage.tsx     # +Cursor Agent URL input (type=url)
└── shared/types/
    ├── workflow.ts                     # +backend field on AgentNodeConfig
    └── settings.ts                     # +cursorAgentUrl field + DEFAULT_SETTINGS

src/workers/agents/backends/cli_backend.py  # +cursor profile + _CLI_BINARY mapping
docker/docker-compose.yml                   # +cursor-agent service (profiles: [cursor])
docs/decisions/cursor-cli-integration.md    # ADR
```

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Cursor binary not available in container | High (no bundling) | Mount instructions in Dockerfile; clear `"agent binary not found"` error |
| Cursor CLI output format changes | Medium | JSON parse falls back to raw stdout |
| AbortController not cancelling agent mid-task | Low | 500ms poll means max 500ms overshoot; acceptable |
| Port 8090 conflicts with other services | Low | `profiles: [cursor]` keeps container opt-in |
