---
id: P15-F17
parent_id: P15
type: tasks
version: 3
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
estimated_hours: 20
---

# Tasks: CI/CD Integration (P15-F17)

## Dependency Graph

```
T01->T02->T03─┐  T01->T04->T07─┘->T05->T06
T05+T08+T10->T09  T04+T12->T13  T11(standalone)
T05+T09+T13->T14->T15
```

## Phase 1: Engine Abstraction (T01-T03)

**T01** (1hr): Define EngineHost interface + HeadlessRunConfig types in `src/cli/types.ts`. RED: test EngineHost.send signature; test HeadlessRunConfig fields. GREEN: create types file.

**T02** (1hr): NullWindow adapter (`src/cli/null-window.ts`). RED: test NDJSON output to writable stream; test human-readable stderr mode; test no-throw on any channel. GREEN: implement. Deps: T01.

**T03** (2hr): Refactor ExecutionEngine to accept EngineHost. RED: test engine accepts EngineHost; test Electron wraps BrowserWindow; test NullWindow works. GREEN: remove static `import { BrowserWindow }` (type-only import), change constructor, update `startParallel` emitIPC to use `this.host.send()`, update execution-handlers.ts wrapper. CC<=5. Deps: T02.

## Phase 2: Headless CLI (T04-T07)

**T04** (1.5hr): CLI arg parser (`src/cli/arg-parser.ts`). RED: test --workflow, --var K=V, --repo, --mock, --json, --gate-mode parsing; test error on missing --workflow; test error on invalid --gate-mode. GREEN: implement with process.argv. Deps: T01.

**T05** (2hr): `dox run` entry point (`src/cli/run.ts`) + HeadlessCLISpawner (`src/cli/headless-cli-spawner.ts`). RED: test loads workflow by path or --workflow-dir; test HeadlessCLISpawner uses child_process (no node-pty); test exit 0/1/2/3. GREEN: implement main() with dynamic imports to avoid node-pty. Deps: T03, T04, T07.

**T06** (1hr): Headless gate handling. RED: test auto-continue default; test --gate-mode=fail exits 4; test gate events in NDJSON. GREEN: inject auto-approve callback via `ExecutionEngineOptions.gateHandler` that calls `submitGateDecision()` immediately. Deps: T05.

**T07** (0.5hr): Env var injection. RED: test DOX_VAR_FOO=bar -> {foo:'bar'}; test prefix stripped + lowercased; test --var overrides env. GREEN: add to arg-parser.ts. Deps: T04.

## Phase 3: Webhook Server (T08-T11)

**T08** (1hr): HMAC-SHA256 auth (`src/cli/hmac-auth.ts`). RED: test valid sig returns true; test tampered body false; test wrong secret false; test timing-safe compare; test sha256=hex format. GREEN: implement with crypto. Deps: none.

**T09** (2hr): Webhook HTTP server (`src/cli/webhook-server.ts`). RED: test starts on port; test POST returns {executionId,status:'started'}; test 401 on bad HMAC; test 404 unknown workflow; test 429 if busy; test 405 non-POST; test clean shutdown; test GitHub vars injected. GREEN: http.createServer. CC<=5. Deps: T05, T08, T10.

**T10** (1hr): GitHub event parser (`src/cli/github-event-parser.ts`). RED: test push extracts ref/repo/head_commit.id as github_ref/github_repo/github_sha; test PR extracts number/head/base; test no header returns null; test generic payload as-is. GREEN: implement. Deps: none.

**T11** (0.5hr): Webhook settings. RED: test webhookPort default 9480; test webhookSecret; test IPC channels exist. GREEN: update settings.ts, ipc-channels.ts. Deps: none.

## Phase 4: Export (T12-T13)

**T12** (2hr): GHA YAML exporter (`src/cli/gha-exporter.ts`). RED: test valid YAML with triggers; test configurable trigger events (push/PR/dispatch); test sequential nodes as steps; test parallel groups as jobs; test gate nodes get MANUAL comment; test runner label. GREEN: template strings. CC<=5. Deps: none.

**T13** (1hr): `dox export` CLI command. RED: test --format json writes JSON; test --format gha writes YAML; test --out writes to file; test exit 3 unknown workflow. GREEN: add export subcommand; add `exportedAt?: string` to WorkflowMetadata in workflow.ts. Deps: T04, T12.

## Phase 5: Integration (T14-T15)

**T14** (1hr): Wire bin entry + package.json + CLI build config. RED: test bin.dox exists; test dispatches run/webhook/export; test unknown subcommand prints help; test CLI build excludes node-pty. GREEN: create `src/cli/index.ts`, update package.json (bin.dox, yaml dev-dep, CLI build config). Deps: T05, T09, T13.

**T15** (2hr): E2E integration test. RED: mock workflow run via CLI outputs NDJSON; webhook trigger with valid HMAC returns 200; GHA export passes yaml parse; DOX_VAR_ injected into workflow. GREEN: wire test fixtures with temp dirs + ephemeral ports. Deps: T14.

## Summary

| Phase | Tasks | Hours |
|-------|-------|-------|
| Engine Abstraction | T01-T03 | 4 |
| Headless CLI | T04-T07 | 5 |
| Webhook Server | T08-T11 | 4.5 |
| Export | T12-T13 | 3 |
| Integration | T14-T15 | 3 |
| **Total** | **15** | **20** |
