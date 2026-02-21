# P14-F05: CLI Session Management & Backend Wiring - Tasks

## Progress

- Started: 2026-02-21
- Tasks Complete: 7/7
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## Tasks

### T32: Implement CLI Spawner with node-pty
- [x] Estimate: 2hr
- [x] Tests: `test/main/cli-spawner.test.ts`
- [x] Dependencies: T09
- [x] Notes: node-pty pseudo-terminal. CLAUDE_INSTANCE_ID env. Pipe stdout/stderr via IPC. Kill: SIGTERM then SIGKILL after 5s. Track sessions in Map. Kill all on app exit.

### T33: Build CLI Manager Page with Terminal Panel
- [x] Estimate: 2hr
- [x] Tests: `test/renderer/components/cli/CLISessionList.test.tsx`, `test/renderer/components/cli/TerminalPanel.test.tsx`
- [x] Dependencies: T32
- [x] Notes: CLIManagerPage with session list and embedded terminal. CLISessionList (active/exited with badges). TerminalPanel (xterm.js, ANSI colors). SpawnDialog for manual creation.

### T34: Build CLI Store (Zustand)
- [x] Estimate: 1hr
- [x] Tests: `test/renderer/stores/cliStore.test.ts`
- [x] Dependencies: T02
- [x] Notes: Sessions map, output ring buffers (10k lines per session), selected session ID. Actions: addSession, removeSession, updateStatus, appendOutput, selectSession. Subscribe to IPC.

### T35: Implement Work Item Service (Filesystem + GitHub)
- [x] Estimate: 1.5hr
- [x] Tests: `test/main/workitem-service.test.ts`
- [x] Dependencies: T02, T09
- [x] Notes: PRDs: scan .workitems/, parse design.md. GitHub Issues: `gh issue list --json`. Replace stub handlers with real implementations.

### T36: Implement Redis Event Subscription
- [x] Estimate: 1.5hr
- [x] Tests: `test/main/redis-client.test.ts`
- [x] Dependencies: T09
- [x] Notes: ioredis XREAD streaming matching events.json schema. Forward to renderer via IPC. Connection/reconnection handling. Configurable Redis URL.

### T37: Wire Execution Engine to Real CLI Spawner
- [x] Estimate: 2hr
- [x] Tests: `test/main/execution-engine-integration.test.ts`
- [x] Dependencies: T22, T32, T36
- [x] Notes: Extend mock engine to spawn real CLI per agent node. Determine context_id and agent_role from node config. Monitor completion via Redis events. Handle failures, timeouts, cleanup. mockMode flag preserved.

### T38: Build Settings Page
- [x] Estimate: 1hr
- [x] Tests: `test/renderer/pages/SettingsPage.test.tsx`
- [x] Dependencies: T11
- [x] Notes: Form: workflow dir, template dir, auto-save interval, CLI working dir, Redis URL. Persist to ~/.asdlc/electron-config.json. Immediate effect.

---

## Estimates Summary

| Phase | Tasks | Estimate |
|-------|-------|----------|
| CLI Backend Wiring | T32-T38 | 11 hours |

## Task Dependency Graph

```
T09 -> T32
T32 -> T33
T02 -> T34
T02, T09 -> T35
T09 -> T36
T22, T32, T36 -> T37
T11 -> T38
```
