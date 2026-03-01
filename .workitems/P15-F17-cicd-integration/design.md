---
id: P15-F17
parent_id: P15
type: design
version: 3
status: approved
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
dependencies: [P15-F05, P15-F09, P15-F14]
tags: [cicd, github-actions, webhooks, headless, phase-3]
estimated_hours: 20
---

# Design: CI/CD Integration (P15-F17)

## Overview

Enable Studio workflows to run outside Electron. Dependencies: F05 (parallel, complete), F09 (containers, complete), F14 (execution history, planned -- shares engine patterns). Headless mode avoids all Electron and node-pty dependencies.

## 1. Engine Abstraction

```typescript
interface EngineHost { send(channel: string, ...args: unknown[]): void; }
```

ExecutionEngine constructor changes from `BrowserWindow` to `EngineHost`. BrowserWindow satisfies via `webContents.send()`. `NullWindow` writes NDJSON to stdout / human-readable to stderr. **Critical**: remove static `import { BrowserWindow } from 'electron'` from execution-engine.ts -- use type-only import. Update `startParallel` emitIPC lambda to use `this.host.send()`.

## 2. Headless CLI (`dox run`)

Standalone Node.js at `src/cli/run.ts`. **No Electron, no node-pty**. Uses `HeadlessCLISpawner` wrapping `child_process.spawn()` (not PTY) for real execution. Dynamic imports prevent transitive node-pty loading.

- `dox run --workflow <id-or-path> [--workflow-dir <dir>] [--var K=V...] [--repo <path>] [--mock] [--json]`
- Exit codes: 0=completed, 1=failed, 2=aborted, 3=invalid input, 4=gate-blocked
- `--gate-mode=auto` (default) auto-continues; `--gate-mode=fail` exits 4. Gate resolver injects auto-approve callback via `ExecutionEngineOptions.gateHandler`
- `DOX_VAR_<name>` env vars -> workflow variables (--var takes precedence)
- `--workflow-dir` resolves workflow directory; defaults to cwd

## 3. Webhook Server

Node `http` module (zero deps). `dox webhook` or Settings toggle.

- `POST /api/v1/trigger/:workflowId` -- HMAC-SHA256 auth via `X-Dox-Signature`
- GitHub: detects `X-GitHub-Event`, extracts repo/ref/PR into variables
- Concurrency: 429 if execution in progress (global; per-workflow deferred)
- Config: `AppSettings.webhookPort` (9480), `AppSettings.webhookSecret`. CLI: `--secret` flag or `DOX_WEBHOOK_SECRET` env var

## 4. Workflow Export

- **JSON**: `WorkflowFileService.save()` + `exportedAt`. Import validated by existing Zod schema.
- **GHA YAML**: `exportToGHA()` -- nodes->steps, parallel->jobs, gates->`# MANUAL`. Template strings. Test validation via `yaml` dev-dependency parse.
- **CLI**: `dox export --workflow <id> --format json|gha [--out <path>]`

## Type Changes

`AppSettings` += `webhookPort?`, `webhookSecret?`. `ExecutionEngine` constructor: `EngineHost`. `WorkflowMetadata` += `exportedAt?`. `IPC_CHANNELS` += `WEBHOOK_STATUS`, `WEBHOOK_TOGGLE`. New: `src/cli/types.ts`, `HeadlessCLISpawner`.

## File Changes

**New**: `src/cli/{run,webhook-server,gha-exporter,null-window,headless-cli-spawner,types,arg-parser,hmac-auth,github-event-parser,index}.ts` + tests.
**Modified**: `execution-engine.ts` (EngineHost, type-only BrowserWindow), `execution-handlers.ts` (wrapper), `settings.ts`, `ipc-channels.ts`, `package.json` (bin.dox + yaml dev-dep + CLI build config)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Headless runtime | Node.js, no Electron | Avoids Chromium in CI |
| CLI spawner | HeadlessCLISpawner (child_process) | Avoids node-pty native module |
| Gate handling | Auto-continue or fail-fast | No human in CI |
| GHA validation | yaml dev-dep for tests | Ensures valid output |

## Risks

| Risk | Mitigation |
|------|------------|
| Engine imports Electron | Type-only import; audit at build |
| node-pty in bundle | Dynamic import; separate CLI build config |
| GHA YAML invalid | Test with yaml parser |
| Webhook secret in logs | Never log; mask in settings |
