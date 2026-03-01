---
id: P15-F18
parent_id: P15
type: design
version: 3
status: approved
created_by: planner
created_at: "2026-02-28T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
dependencies: [P15-F01, P15-F02]
tags: [collaboration, multi-user, templates, phase-3]
estimated_hours: 27
---

# Design: Collaboration (P15-F18)

## Overview

Transform Studio from single-user to team-aware. Phase A (this feature): shared template publishing (Git-backed), template browser, advisory locking, presence. Phase B (follow-on): Yjs CRDT co-editing. Shared directory must be a local Git clone (not NFS/CIFS mount -- O_EXCL not guaranteed atomic on network FS).

## Scope 1: Shared Template Publishing

Second Git-backed directory (`<repo>/.dox/templates/`). Publish strips runtime state, stamps metadata.

**Type changes**: Reuse existing `WorkflowMetadata.createdBy` as author (no new `author` field). Add `source?: 'local' | 'shared'` to `WorkflowSummary` only (computed at list time, NOT persisted in JSON). `AppSettings` += `sharedTemplateDirectory?`, `userName?`.

**File changes**: `workflow-file-service.ts` (`listFromDir()` multi-dir scan), `template-handlers.ts` (merge, `TEMPLATE_PUBLISH`, `TEMPLATE_IMPORT`), `ipc-channels.ts` (3 channels), `workflow-schema.ts` (Zod update for new metadata fields), `electron-api.d.ts` (`WorkflowSummary` += source), new `PublishTemplateDialog.tsx`.

## Scope 2: Template Browser Enhancements

Refactor `TemplateManagerPage.tsx` body into `TemplateBrowser.tsx` component (replaces inline list, not the page). Tabs: All/Local/Shared. Search by name, tag, createdBy. Sort: name, date, node count. Existing `TemplateCard` in `TemplateManagerPage.tsx` (inline component) gets origin badge and "Publish" button for local cards.

## Scope 3: Advisory Locking

`.dox/locks/<id>.lock` JSON with 30min auto-expiry. Atomic via `O_EXCL` (local FS only -- documented constraint). Write-then-verify fallback: after O_EXCL write, re-read and compare contents to confirm ownership. Warn on open if locked; read-only for non-holder.

**New**: `lock-service.ts` -- `acquireLock()`, `releaseLock()`, `checkLock()`, `cleanExpiredLocks()`. Uses UTC timestamps exclusively to reduce clock-skew impact.
**IPC**: `LOCK_ACQUIRE`, `LOCK_RELEASE`, `LOCK_CHECK`. Lock icon on shared workflow cards.

## Scope 4: Presence (WebSocket)

`ws` WebSocket relay in main process. Bind to local network interface only (not `0.0.0.0`). Messages: join, leave, heartbeat. Stale removal at 60s. Renderer client: 15s heartbeat, exponential backoff reconnect. `PresenceAvatars.tsx` on canvas toolbar.

**Settings**: `presencePort?` (default 9380). Server only starts when `sharedTemplateDirectory` configured. Port conflict handled gracefully (toast warning, no crash).

## File Changes

**New**: `lock-service.ts`, `presence-server.ts`, `presence-client.ts`, `PublishTemplateDialog.tsx`, `TemplateBrowser.tsx`, `PresenceAvatars.tsx` + tests.
**Modified**: `workflow-file-service.ts`, `template-handlers.ts`, `ipc-channels.ts`, `settings.ts`, `workflow-schema.ts`, `electron-api.d.ts` (WorkflowSummary), `TemplateManagerPage.tsx` (inline TemplateCard + TemplateBrowser swap), `package.json` (ws, @types/ws).

## Decisions

| Decision | Direction | Rationale |
|----------|-----------|-----------|
| Shared storage | Git-native local clone | O_EXCL safe on local FS; NFS excluded |
| Author field | Reuse `createdBy` | No field duplication |
| source field | On WorkflowSummary, not persisted | Computed at list time from directory |
| Lock verification | Write-then-verify | Extra safety for edge cases |
| Presence binding | Local interface only | Security; no internet exposure |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Shared dir on network mount | Medium | Documented constraint; validate at config |
| Lock left by crash | Medium | 30min auto-expire + manual release |
| WebSocket port conflict | Low | Configurable; graceful fail with toast |
| Clock skew across machines | Low | UTC timestamps; document limitation |
