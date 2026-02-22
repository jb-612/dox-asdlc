---
id: P14-F07
parent_id: P14
type: tasks
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
---

# Tasks: Cursor CLI Backend (P14-F07)

> **Note:** This is a retroactive work item. All tasks below are already implemented and verified.
> Status reflects the completed state as of 2026-02-21.

## Progress

- Started: 2026-02-21
- Tasks Complete: 12/12
- Percentage: 100%
- Status: COMPLETE

---

### T01: Write gap analysis ADR

- [x] Estimate: 1hr
- [x] Tests: N/A (documentation)
- [x] Dependencies: None
- [x] Notes: `docs/decisions/cursor-cli-integration.md` — covers capability gaps, permission
       format mapping, workarounds, container architecture decision, and consequences.

---

### T02: Create Dockerfile and package.json

- [x] Estimate: 30min
- [x] Tests: Container builds without error
- [x] Dependencies: None
- [x] Notes: `docker/cursor-agent/Dockerfile` — Node.js 20 Alpine base. Cursor binary must be
       mounted at `/usr/local/bin/agent`; removed curl-pipe-bash install (security fix #268).
       `package.json`: express + tsx + tsc. Non-root `asdlc` user.

---

### T03: Implement Express HTTP server

- [x] Estimate: 2hr
- [x] Tests: Manual curl smoke test; TypeScript compiles clean
- [x] Dependencies: T02
- [x] Notes: `docker/cursor-agent/server.ts` — `/health` (unauthenticated) + `/execute` (auth).
       Builds `agent` CLI args, enforces timeout via `execFile`, parses JSON output with raw
       stdout fallback, handles ENOENT for missing binary.

---

### T04: Add auth middleware and security controls

- [x] Estimate: 1hr
- [x] Tests: Manual test: 401 without token, 200 with correct token
- [x] Dependencies: T03
- [x] Notes: `requireAuth` Bearer token middleware (#267). `resolveWorkspacePath()` rejects
       paths outside `/workspace` (#276). `agentEnv` allowlist restricts env vars to execFile
       (#274).

---

### T05: Create default permissions and role rules

- [x] Estimate: 30min
- [x] Tests: N/A (static config files)
- [x] Dependencies: None
- [x] Notes: `docker/cursor-agent/.cursor/cli.json` — base permission config (allow git read,
       npm/pytest; deny rm-rf, force-push). `.cursor/rules/backend.mdc`, `frontend.mdc`,
       `reviewer.mdc`, `planner.mdc` — role-specific system-prompt equivalents auto-loaded by
       Cursor CLI.

---

### T06: Create MCP config for container network

- [x] Estimate: 30min
- [x] Tests: N/A (static config)
- [x] Dependencies: None
- [x] Notes: `docker/cursor-agent/mcp.json` — points at `elasticsearch:9200` on Docker network.
       MCP integration depends on Cursor CLI MCP support; graceful fallback if unavailable.

---

### T07: Add cursor-agent service to docker-compose.yml

- [x] Estimate: 30min
- [x] Tests: `docker compose --profile cursor config` validates YAML
- [x] Dependencies: T02, T03
- [x] Notes: `docker/docker-compose.yml` — `profiles: [cursor]` for opt-in (#271). Port 8090.
       `depends_on` elasticsearch (service_healthy) + redis (service_started) (#272).
       Workspace mounted read-write at `/workspace`.

---

### T08: Add `backend` field to AgentNodeConfig

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; existing tests unaffected
- [x] Dependencies: None
- [x] Notes: `apps/workflow-studio/src/shared/types/workflow.ts` — `backend?: 'claude' | 'cursor' | 'codex'`
       added to `AgentNodeConfig`.

---

### T09: Add remote dispatch to execution engine

- [x] Estimate: 2hr
- [x] Tests: `test/main/execution-engine-integration.test.ts` — 6 new remote-dispatch tests (14 total, all pass)
- [x] Dependencies: T03, T08
- [x] Notes: `execution-engine.ts` — `isValidRemoteUrl()` (SSRF guard, #266),
       `executeNodeRemote()` with `AbortController` + 500ms abort poller (#269),
       `response.ok` check (#270). Dispatch routing: `backend === "cursor"` always goes to
       `executeNodeRemote()` regardless of `remoteAgentUrl` (URL validated inside).

---

### T10: Add cursorAgentUrl to settings

- [x] Estimate: 30min
- [x] Tests: TypeScript compiles; manual settings UI test
- [x] Dependencies: T08
- [x] Notes: `settings.ts` — `cursorAgentUrl: string` field + `DEFAULT_SETTINGS` default.
       `settings-service.ts` — uses `DEFAULT_SETTINGS.cursorAgentUrl` (deduplication #277).
       `SettingsPage.tsx` — `type="url"` + `pattern="https?://.+"` (#275). `execution-handlers.ts`
       and `ipc/index.ts` — wired to pass `cursorAgentUrl` as `remoteAgentUrl` to engine.

---

### T11: Add cursor profile to Python CLI backend

- [x] Estimate: 1hr
- [x] Tests: `tests/unit/workers/agents/backends/test_cli_backend.py::TestCursorCLIProfile` — 9 tests, all pass
- [x] Dependencies: None
- [x] Notes: `src/workers/agents/backends/cli_backend.py` — `_CLI_BINARY` dict maps profile
       name to binary name (`"cursor"` → `"agent"`). `_CLI_PROFILES["cursor"]` with `None` for
       unsupported flags. `_build_command` and `health_check` updated to use `_CLI_BINARY`.

---

### T12: Code review and security hardening

- [x] Estimate: 1hr
- [x] Tests: All 27 Python + 14 TypeScript tests pass; tsc --noEmit clean
- [x] Dependencies: T01-T11
- [x] Notes: Addressed GitHub issues #266–#277 from code review:
       3 critical (SSRF, auth, Dockerfile), 5 warnings (abort, response.ok, compose profile,
       redis dep, tests), 4 suggestions (env restriction, URL validation, path traversal, dedup).
