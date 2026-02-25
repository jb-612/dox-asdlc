---
id: P15-F02
parent_id: P15
type: tasks
version: 1
status: in_progress
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F06
tags:
  - templates
  - electron
---

# Tasks: Template Repository (P15-F02)

## Progress

- Started: Yes
- Tasks Complete: 5/13
- Percentage: 38%
- Status: IN_PROGRESS

---

## Phase 1: Data Model (T01–T02)

### T01: Add `status` to WorkflowMetadata + Zod schema — DONE

- [x] Estimate: 30min
- [x] Tests: `tsc --noEmit` clean; existing schema tests unaffected
- [x] Dependencies: None
- [x] Notes: In `apps/workflow-studio/src/shared/types/workflow.ts`, add `status?: 'active' | 'paused'` to `WorkflowMetadata`. In `apps/workflow-studio/src/main/schemas/workflow-schema.ts`, add `status: z.enum(['active', 'paused']).optional()` to `WorkflowMetadataSchema`. Undefined status treated as `'active'` at runtime (no default needed in schema). Verify existing tests still pass.

---

### T02: Add template IPC channel constants — DONE

- [x] Estimate: 15min
- [x] Tests: TypeScript compiles; constants match handler registrations
- [x] Dependencies: T01
- [x] Notes: In `apps/workflow-studio/src/shared/ipc-channels.ts`, add: `TEMPLATE_LIST: 'template:list'`, `TEMPLATE_LOAD: 'template:load'`, `TEMPLATE_SAVE: 'template:save'`, `TEMPLATE_DELETE: 'template:delete'`, `TEMPLATE_TOGGLE_STATUS: 'template:toggle-status'`, `TEMPLATE_DUPLICATE: 'template:duplicate'`.

---

## Phase 2: Backend IPC (T03–T05)

### T03: Implement template IPC handlers — DONE

- [x] Estimate: 1.5hr
- [x] Tests: `test/main/template-handlers.test.ts` — list, load, save, delete, toggle-status, duplicate (≥ 1 test per handler)
- [x] Dependencies: T01, T02
- [ ] Notes: Create `apps/workflow-studio/src/main/ipc/template-handlers.ts`. Export `registerTemplateHandlers(fileService: WorkflowFileService)`. Handlers:
  - `template:list` — calls `fileService.list()`, maps `status` from metadata (default `'active'`), returns `TemplateListItem[]`
  - `template:load` — delegates to `fileService.load(id)`
  - `template:save` — validates via `WorkflowDefinitionSchema`, sets `metadata.updatedAt`, calls `fileService.save()`
  - `template:delete` — delegates to `fileService.delete(id)`
  - `template:toggle-status` — loads template, flips `metadata.status` (`'active'↔'paused'`), sets `updatedAt`, re-saves; returns `{ success, status }`
  - `template:duplicate` — loads template, deep-clones, assigns new `uuidv4()` id, appends ` (Copy)` to name, sets `status: 'active'`, sets timestamps, saves; returns `{ success, id }`

---

### T04: Wire template file service in main/ipc/index.ts and main/index.ts — DONE

- [x] Estimate: 30min
- [x] Tests: App starts without errors; `template:list` returns empty array before any templates saved
- [x] Dependencies: T03
- [ ] Notes: In `main/ipc/index.ts`, add `templateFileService: WorkflowFileService` to `IPCServiceDeps` and call `registerTemplateHandlers(deps.templateFileService)`. In `main/index.ts`, instantiate a second `WorkflowFileService` with `settings.templateDirectory || path.join(app.getPath('userData'), 'templates')`. Pass as `templateFileService` dep. The default path ensures the feature works without user configuring `templateDirectory`.

---

### T05: Expose template API in preload + type declarations — DONE

- [x] Estimate: 30min
- [x] Tests: `tsc --noEmit` clean; renderer can call `window.electronAPI.template.list()`
- [x] Dependencies: T02, T04
- [ ] Notes: In `preload/preload.ts`, add `template` namespace with 6 methods (list, load, save, delete, toggleStatus, duplicate). In `preload/electron-api.d.ts`, add matching type declarations using `TemplateListItem` interface (id, name, description, tags, updatedAt, nodeCount, status).

---

## Phase 3: Frontend (T06–T09)

### T06: Rebuild TemplateManagerPage — list with real IPC and filter

- [ ] Estimate: 2hr
- [ ] Tests: Manual smoke test: templates appear after creating one; filter narrows list
- [ ] Dependencies: T05
- [ ] Notes: Replace `createMockTemplates()` with `useEffect` that calls `window.electronAPI.template.list()`. Store as `TemplateListItem[]` in component state. Add search input (client-side filter by name). Add status filter toggle (All / Active / Paused). Add tag chip filter (union of all tags in list). Each card shows status badge (green = Active, gray = Paused). Loading and error states. Keep `TemplateCard` but update its props to accept `TemplateListItem` instead of `WorkflowDefinition`.

---

### T07: Add status toggle, duplicate, and delete confirmation

- [ ] Estimate: 1hr
- [ ] Tests: Manual test: toggle persists on refresh; duplicate creates new card; delete shows dialog
- [ ] Dependencies: T06
- [ ] Notes: Status badge/button: `onClick` calls `window.electronAPI.template.toggleStatus(id)`, then optimistically flips badge state and refreshes list. Duplicate button: calls `window.electronAPI.template.duplicate(id)`, then refreshes list. Delete button: opens a `ConfirmDeleteDialog` (inline component) showing template name; "Confirm" calls `window.electronAPI.template.delete(id)` then refreshes list. "Cancel" dismisses.

---

### T08: Add Create and Edit routing with designer save target

- [ ] Estimate: 1hr
- [ ] Tests: Manual test: Create → designer → Save → template appears in list; Edit → save → changes persisted
- [ ] Dependencies: T06, T07
- [ ] Notes: Add `activeSaveTarget: 'workflow' | 'template'` to `uiStore.ts` (Zustand slice). "New Template" button: `setActiveSaveTarget('template')`, clear `workflowStore` (blank `WorkflowDefinition` with `id: ''`), `navigate('/')`. "Edit" button: `template:load(id)` → set into `workflowStore` → `setActiveSaveTarget('template')` → `navigate('/')`. In `DesignerPage.tsx` (or wherever Save is handled), check `uiStore.activeSaveTarget`: if `'template'` call `template:save`, else call `workflow:save`. After save with `activeSaveTarget === 'template'`, optionally navigate back to `/templates`.

---

### T09: Update ExecutionPage to load Active templates — PARTIAL

- [~] Estimate: 1hr
- [ ] Tests: Manual test: Paused templates absent from Execute picker; Active templates present
- [~] Dependencies: T05
- [ ] Notes: In `ExecutionPage.tsx`, replace `window.electronAPI.workflow.list()` / `workflow.load()` chain with `window.electronAPI.template.list()` filtered to `item.status !== 'paused'`, then `template.load()` for the selected one. Update section heading to "1. Select Template". Add empty state message when no Active templates: "No active templates. Visit the Templates tab to activate one." The `WorkflowSummaryCard` component is reused unchanged (it only needs a `WorkflowDefinition`, which `template.load()` returns).

---

## Phase 4: Tests + QA (T10–T11)

### T10: Unit tests for template IPC handlers — PARTIAL

- [~] Estimate: 1hr
- [~] Tests: `test/main/template-handlers.test.ts` — 8 tests minimum
- [~] Dependencies: T03
- [ ] Notes: Test cases: (1) `template:list` returns TemplateListItem with status defaulting to 'active'; (2) `template:save` with invalid schema returns error; (3) `template:toggle-status` flips active→paused; (4) `template:toggle-status` flips paused→active; (5) `template:duplicate` creates new id, new name with "(Copy)", status always 'active'; (6) `template:delete` returns `{ success: false }` for unknown id; (7) `template:list` empty when no files. Use tmp directories to avoid polluting real storage.

---

### T11: TypeScript compile + integration smoke test

- [ ] Estimate: 30min
- [ ] Tests: `tsc --noEmit` exits 0; manual end-to-end: create → edit → pause → duplicate → delete
- [ ] Dependencies: T01–T10
- [ ] Notes: Run `tsc --noEmit` in `apps/workflow-studio/`. Fix any type errors. Manual walkthrough of the full template lifecycle: create template from designer, verify it appears in Templates tab (Active), pause it, verify Execute hides it, unpause, verify Execute shows it, duplicate, edit duplicate, delete original. All steps should work without errors.

---

## Phase 3 Additions: Search, Filter, and Delete Confirmation (T12–T13)

### T12: Implement template search/filter functionality

- [ ] Estimate: 1.5hr
- [ ] Tests: Render test — search by name filters list; search by tag filters list; combined filters narrow results; empty results show message
- [ ] Dependencies: T06
- [ ] Notes: PRD FR-05 requires search by name/tag. In `TemplateManagerPage.tsx`, add a search
       input that filters templates by name and tag content. Implement debounced text search
       (300ms). When search text matches a tag, highlight the matching tag chip. Add "No templates
       match your search" empty state. Search is client-side on the loaded list (no IPC needed).

---

### T13: Add confirmation dialog for template deletion

- [ ] Estimate: 30min
- [ ] Tests: Render test — delete button shows dialog; confirm triggers delete IPC; cancel dismisses
- [ ] Dependencies: T07
- [ ] Notes: Extract the `ConfirmDeleteDialog` from T07's inline implementation into a reusable
       component. Dialog shows template name and warns "This action cannot be undone." Confirm
       button is red/destructive. Cancel button dismisses without action. This may already be
       partially implemented in T07 — if so, this task ensures the dialog is properly separated
       and tested.

---

## Estimates Summary

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: Data Model | T01–T02 | 0.75hr |
| Phase 2: Backend IPC | T03–T05 | 2.5hr |
| Phase 3: Frontend | T06–T09 | 5hr |
| Phase 3 additions | T12–T13 | 2hr |
| Phase 4: Tests + QA | T10–T11 | 1.5hr |
| **Total** | **13 tasks** | **~12hr** |

## Task Dependency Graph

```
T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08
                                 │         │
                                 T05 → T09 │
                                 │         └── T13 (delete confirmation)
                                 └── T12 (search/filter, depends T06)
              T03 → T10
     T01–T13 → T11
```
