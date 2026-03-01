---
id: P15-F18
parent_id: P15
type: tasks
version: 3
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
estimated_hours: 26.5
---

# Tasks: Collaboration (P15-F18)

## Dependency Graph

```
T01->T02 | T01->T03->T04─>T05->T07 | T04->T06 | T05+T06->T08
T01->T09->T10->T11 | T01->T12->T13->T14->T15
T08->T16 | T11->T17 | T15->T18
```

## P1: Types + Settings

**T01** (1.5hr): Create `shared/types/collaboration.ts` (AdvisoryLock, PresenceInfo).
Add `source` to WorkflowSummary (computed). Reuse `createdBy` as author. Extend AppSettings
(+sharedTemplateDirectory, +userName, +presencePort). Update Zod schema + electron-api.d.ts.
RED: test defaults; userName defaults to os.userInfo().username. GREEN: create types + Zod. Deps: none.
**T02** (1.5hr): Settings > Collaboration UI section: shared dir picker, user name,
presence port. Validate dir exists; warn if not Git repo.
RED: test renders; test OS username pre-filled. GREEN: implement settings panel. Deps: T01.

## P2: Shared Templates

**T03** (1.5hr): Add `listFromDir(dir)` to WorkflowFileService; populate `source` field.
RED: test two-dir scan merges results. GREEN: implement listFromDir. Deps: T01.
**T04** (1.5hr): Add TEMPLATE_PUBLISH + TEMPLATE_IMPORT to IPC. Publish: validate, stamp
createdBy, strip runtime, write to shared dir. Import: copy shared->local.
RED: test publish writes, test import copies. GREEN: implement handlers. Deps: T03.
**T05** (1hr): Modify TEMPLATE_LIST to merge local+shared; deduplicate by ID (local wins).
RED: test merged list, dedup, source labels. GREEN: update list handler. Deps: T03, T04.
**T06** (1.5hr): New PublishTemplateDialog.tsx: author, description, tags, version.
Calls TEMPLATE_PUBLISH; success/error toasts. RED: test submit. GREEN: implement dialog. Deps: T04.

## P3: Template Browser

**T07** (2hr): New TemplateBrowser.tsx: tabs All/Local/Shared, search by name/tag/author,
sort (name, date, nodeCount). RED: test filter, sort, tab switch. GREEN: implement component. Deps: T05.
**T08** (1hr): TemplateManagerPage.tsx inline TemplateCard: add Shared/Local badge, author
line, Publish button on local cards; shared cards show Import action (no direct edit).
RED: test badge by source; test shared card has Import not Edit. GREEN: update card. Deps: T05, T06.

## P4: Advisory Locking

**T09** (2hr): New lock-service.ts: acquireLock, releaseLock, checkLock, cleanExpired.
`.dox/locks/<id>.lock` JSON, O_EXCL + write-then-verify. 30min UTC expiry.
RED: test acquire, release, expiry, concurrent reject. GREEN: implement 4 functions. Deps: T01.
**T10** (1.5hr): Add LOCK_ACQUIRE/RELEASE/CHECK IPC. Register handlers. Wire acquireLock
on open-for-edit, releaseLock on close. cleanExpired on startup.
RED: test acquire IPC, release on close, cleanExpired on startup, skip when no sharedDir. GREEN: implement handlers. Deps: T09.
**T11** (1.5hr): Lock icon + holder on shared workflow cards. Warning banner on locked
open; read-only mode. Release button for holder.
RED: test locked warning shows holder name; non-holder read-only; release for holder. GREEN: implement UI. Deps: T10.

## P5: Presence Awareness

**T12** (2hr): New presence-server.ts (ws + @types/ws). Bind local interface only.
Messages: join, leave, heartbeat. Broadcast on change; stale removal at 60s. Port conflict
handled gracefully (toast warning).
RED: test join/leave/stale/port-conflict. GREEN: implement server + install ws dep. Deps: T01.
**T13** (1.5hr): New presence-client.ts: connect, 15s heartbeat, Zustand atom,
auto-reconnect (backoff 1s-30s).
RED: test connect, heartbeat, reconnect. GREEN: implement client. Deps: T12.
**T14** (1hr): PRESENCE_START/STOP IPC. Start server in index.ts when shared dir set.
Shutdown hook. RED: test conditional start/stop. GREEN: implement IPC + wiring. Deps: T12, T13.
**T15** (1.5hr): New PresenceAvatars.tsx: avatar circles, initials, colors, tooltip.
Renders only with peers. RED: test render, tooltip, empty. GREEN: implement component. Deps: T13.

## P6: Integration + E2E

**T16** (1.5hr): Publish->browse->import round-trip | US-01,US-02,US-03
RED: publish template, verify in shared tab, import to local, verify metadata+dedup.
GREEN: temp dirs for local+shared. Deps: T08.
**T17** (1hr): Lock contention round-trip | US-04
RED: A acquires, B warned, A releases, B acquires; test expiry. GREEN: test fixtures. Deps: T11.
**T18** (1.5hr): Presence + solo-mode degradation | US-05,US-07
RED: two clients see each other; disconnect->removal; stale at 60s. Solo-mode (no shared
dir): presence not started, template browser works, locking skipped. GREEN: mock setup. Deps: T15.

## Summary

| Phase | Tasks | Hours |
|-------|-------|-------|
| P1: Types + Settings | T01-T02 | 3 |
| P2: Shared Templates | T03-T06 | 5.5 |
| P3: Template Browser | T07-T08 | 3 |
| P4: Advisory Locking | T09-T11 | 5 |
| P5: Presence | T12-T15 | 6 |
| P6: Integration | T16-T18 | 4 |
| **Total** | **18** | **26.5hr** |
