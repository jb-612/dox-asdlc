---
id: P15-F02
parent_id: P15
type: prd
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "2026-02-22T00:00:00Z"
updated_at: "2026-02-22T00:00:00Z"
dependencies:
  - P14-F06
tags:
  - templates
  - electron
  - ipc
  - frontend
---

# PRD: Template Repository (P15-F02)

## Business Intent

The Workflow Studio Templates tab currently displays hard-coded mock templates with no persistence and no lifecycle management. Users cannot create templates that survive a session, pause templates to hide them from the Execute launcher, or duplicate existing templates to use as starting points.

This feature delivers a fully functional template repository: real IPC-backed CRUD, status management (Active/Paused), duplication, and routing to/from the designer. It also removes the friction in the Execute tab by showing only Active templates instead of all workflow files.

## Success Metrics

| Metric | Target |
|--------|--------|
| Templates persist across app restarts | 100% (no mock data in production) |
| Paused templates hidden from Execute tab | 100% |
| Create/Edit/Duplicate/Delete/Toggle all functional | 5/5 operations pass smoke test |
| Filter/search narrows template list client-side | Matches by name and tag |
| All new code paths covered by unit tests | ≥ 1 test per handler path |
| TypeScript compiles without errors | `tsc --noEmit` clean |

## User Impact

| User | Impact |
|------|--------|
| Workflow author | Saves time reusing templates; can pause templates under development without cluttering Execute |
| Power user | Duplicates existing template as a starting point for iteration |
| Operator | Active/Paused status controls what appears in Execute without permanent deletion |

## Scope

### In Scope

- `WorkflowMetadata.status?: 'active' | 'paused'` field in shared types and Zod schema
- Template IPC channels: `template:list`, `template:load`, `template:save`, `template:delete`, `template:toggle-status`, `template:duplicate`
- `registerTemplateHandlers()` using `WorkflowFileService` pointed at `templateDirectory`
- Default `templateDirectory` = `{userData}/templates` when AppSettings is empty
- Preload API namespace `window.electronAPI.template.*`
- `TemplateManagerPage` rebuilt: real IPC, search/filter, status badges, duplicate, delete confirm
- `uiStore.activeSaveTarget` for Create/Edit → designer round-trip
- `ExecutionPage` updated: loads from `template:list`, filters to Active

### Out of Scope

- Template versioning or change history
- Template sharing / import from URL
- Template categories beyond tags and status
- Template migration tool from P14 mock templates
- Execute tab redesign beyond template picker source change
- Studio canvas changes (P15-F01 scope)

## Constraints

- `WorkflowFileService` must not be modified — reused with `templateDirectory` path
- `WorkflowDefinitionSchema` backward-compatible — `status` is optional
- No breaking changes to `workflow:*` IPC channels (workflows remain separate from templates)

## Acceptance Criteria

1. `window.electronAPI.template.list()` returns an array of `TemplateListItem` with `status` field
2. Creating a template via `template:save` persists a `.json` file in `templateDirectory`
3. `template:toggle-status` flips `active` → `paused` and vice versa; change survives app restart
4. `template:duplicate` creates a new file with a new UUID and name ending in ` (Copy)`
5. `template:delete` removes the file from disk; template no longer appears in list
6. Templates with `status: 'paused'` do not appear in the Execute tab template picker
7. Clicking "Edit" on a template card loads it into the designer (Studio tab active)
8. Clicking "New Template" navigates to the designer with a blank canvas
9. Designer Save with `activeSaveTarget === 'template'` calls `template:save` not `workflow:save`
10. Search input filters the template list by name; tag chips filter by tag membership
11. Delete confirmation dialog appears before deletion; "Cancel" does not delete
