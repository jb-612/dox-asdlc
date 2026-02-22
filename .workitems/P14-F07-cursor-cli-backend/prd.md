---
id: P14-F07
parent_id: P14
type: prd
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

# PRD: Cursor CLI Backend (P14-F07)

## Business Intent

The P14 Workflow Studio executes DAG workflows by dispatching agent nodes to CLI processes.
Currently only Claude Code CLI is supported, running locally via `node-pty`. Adding Cursor CLI as
a second backend enables workflows to target a different AI coding assistant, broadens the
platform's agent model, and validates the multi-backend architecture before adding further
integrations (Codex, custom agents).

## Success Metrics

| Metric | Target |
|--------|--------|
| Workflow nodes with `backend: cursor` dispatch to container | 100% |
| `/health` endpoint responds within 200ms | p99 < 200ms |
| Auth-protected `/execute` endpoint rejects unauthenticated requests | 401 on missing/wrong token |
| SSRF-safe: `file://` and other non-HTTP(S) URLs rejected by execution engine | 100% blocked |
| All new code paths covered by automated tests | ≥ 1 test per code path |

## User Impact

| User | Impact |
|------|--------|
| Workflow author | Can set `backend: cursor` on any agent node in the designer canvas |
| Developer / operator | Opts in via `docker compose --profile cursor up`; no impact on base stack |
| PM CLI / orchestrator | Can delegate tasks to Cursor-backed nodes through the same execution API |

## Scope

### In Scope

- `docker/cursor-agent/` container: Node.js Alpine, Express HTTP wrapper, Cursor CLI dispatch
- `/execute` POST endpoint with auth, path traversal protection, dynamic permissions
- `/health` GET endpoint for Docker healthcheck (unauthenticated)
- `execution-engine.ts`: `executeNodeRemote()`, `isValidRemoteUrl()`, `AbortController` wiring
- `AgentNodeConfig.backend` field (`'claude' | 'cursor' | 'codex'`)
- `cursorAgentUrl` in AppSettings, SettingsPage, and SettingsService
- `cursor` profile in Python `CLIAgentBackend` with `_CLI_BINARY` mapping
- docker-compose.yml `cursor` profile (opt-in)
- ADR: `docs/decisions/cursor-cli-integration.md`

### Out of Scope

- Cursor background/cloud mode (`-b` flag) — deferred
- MCP server integration inside container — deferred (depends on Cursor CLI MCP support)
- Budget control for Cursor (no `--max-budget-usd` equivalent)
- UI for selecting backend on individual nodes (canvas node config panel, P14-F03)
- Codex remote backend (separate feature)

## Constraints

- Cursor CLI binary (`agent`) is not freely distributable; container requires manual binary mount
- Cursor CLI lacks `--max-turns`, `--max-budget-usd`, `--system-prompt`, `--json-schema` flags
  (documented in ADR gap analysis; workarounds in place)
- Container is opt-in (`profiles: [cursor]`) to avoid breaking developers without the binary

## Acceptance Criteria

1. `docker compose --profile cursor up cursor-agent` builds and starts without error
2. `GET /health` returns `{"status":"ok"}` with HTTP 200
3. `POST /execute` without `Authorization` header returns HTTP 401 when `CURSOR_API_KEY` is set
4. `POST /execute` with valid Bearer token and `{"prompt":"..."}` dispatches `agent` CLI and
   returns `{"success":true,"result":"..."}` (requires binary mounted)
5. Workflow node with `config.backend === "cursor"` routes to `executeNodeRemote()`, not mock/CLI
6. `executeNodeRemote()` with missing or `file://` URL fails node with
   `"Invalid or missing remote agent URL"`
7. `abort()` on the execution engine cancels an in-flight Cursor fetch within ~1 second
8. `CLIAgentBackend(cli="cursor")._build_command(...)` produces `["agent", "-p", ...]`
   with `--force` and no `--max-turns` / `--system-prompt`
9. 27 Python unit tests and 14 TypeScript integration tests pass
