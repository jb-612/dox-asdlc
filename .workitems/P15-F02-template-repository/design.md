---
id: P15-F02
parent_id: P15
type: design
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

# Design: Template Repository (P15-F02)

## Overview

The Templates tab is the primary management surface for saved workflow templates. Users browse, search, filter, and manage templates from here. Templates are a distinct concept from ad-hoc workflows: they are named, tagged, and have a lifecycle status (`active` | `paused`) that controls their visibility in the Execute tab.

This feature wires the existing mock-data `TemplateManagerPage` to real IPC-backed persistence, adds status management (pause/unpause), duplicate, and Create/Edit routing into the designer, and updates the Execute tab to pull exclusively from active templates.

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| P14-F06 (Templates Polish & Packaging) | Internal | `templateDirectory` in AppSettings; `WorkflowFileService` class reused |
| `apps/workflow-studio/src/renderer/pages/TemplateManagerPage.tsx` | Existing | Rebuilt in-place |
| `apps/workflow-studio/src/renderer/pages/ExecutionPage.tsx` | Existing | Updated to load from `template:list` |
| `apps/workflow-studio/src/main/ipc/workflow-handlers.ts` | Existing | Pattern reference for template handlers |
| `apps/workflow-studio/src/shared/types/workflow.ts` | Existing | `WorkflowMetadata` extended with `status` |

## Architecture

```
Renderer Process                      Main Process
┌─────────────────────────────┐       ┌─────────────────────────────────┐
│  TemplateManagerPage         │       │  registerTemplateHandlers()       │
│  ─────────────────────────── │       │  ─────────────────────────────── │
│  useEffect → template:list   │──IPC─▶│  template:list                   │
│  handleEdit → navigate /     │       │    WorkflowFileService.list()     │
│  handleCreate → navigate /   │       │    (templateDirectory)            │
│  handleDelete → template:del │──IPC─▶│  template:load                   │
│  handleToggle → toggle-status│──IPC─▶│  template:save                   │
│  handleDuplicate → duplicate │──IPC─▶│  template:delete                 │
│                             │       │  template:toggle-status           │
│  ExecutionPage               │       │    (flip 'active'↔'paused')      │
│  ─────────────────────────── │       │  template:duplicate               │
│  useEffect → template:list   │──IPC─▶│    (deep clone + new id/name)    │
│  (filter: status=active)     │       └─────────────────────────────────┘
└─────────────────────────────┘                    │
                                                   ▼
                                       WorkflowFileService
                                       (templateDirectory)
                                       ├── My-TDD-Workflow.json
                                       ├── Full-Pipeline.json
                                       └── Code-Review.json
```

## Interfaces

### Data Model Extension (`workflow.ts`)

```typescript
export interface WorkflowMetadata {
  name: string;
  description?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags: string[];
  status?: 'active' | 'paused';  // NEW — undefined treated as 'active'
}
```

The `status` field is optional; templates created before this feature and templates without `status` are treated as `active`. Regular workflows in `workflowDirectory` ignore this field.

> **Unified WorkflowStatus enum:** The committed `WorkflowStatus` type is
> `'active' | 'paused'`. The unified lifecycle across features is:
> - `'draft'` — new unsaved template (not yet persisted)
> - `'active'` — visible in Execute tab, default for existing templates
> - `'paused'` — hidden from Execute tab (toggle via status badge)
> - `'archived'` — soft-deleted, hidden everywhere but recoverable
>
> F02 uses `active`/`paused` for the toggle. `draft` is a transient UI state (before first
> save). `archived` is the soft-delete target for the future. The committed type currently
> only has `'active' | 'paused'`; `'draft'` and `'archived'` will be added when needed.

### IPC Channels (`ipc-channels.ts`)

```typescript
export const IPC_CHANNELS = {
  // ... existing ...

  // Template operations (NEW)
  TEMPLATE_LIST:          'template:list',
  TEMPLATE_LOAD:          'template:load',
  TEMPLATE_SAVE:          'template:save',
  TEMPLATE_DELETE:        'template:delete',
  TEMPLATE_TOGGLE_STATUS: 'template:toggle-status',
  TEMPLATE_DUPLICATE:     'template:duplicate',
};
```

### Template IPC Handlers (`main/ipc/template-handlers.ts`)

```typescript
interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  updatedAt: string;
  nodeCount: number;
  status: 'active' | 'paused';
}

// template:list → TemplateListItem[]
// template:load → WorkflowDefinition | null
// template:save → { success: boolean; id: string } | { success: false; errors: ... }
// template:delete → { success: boolean }
// template:toggle-status → { success: boolean; status: 'active' | 'paused' }
// template:duplicate → { success: boolean; id: string }
```

`template:duplicate` creates a deep clone with a new UUID and appends ` (Copy)` to the name.

`template:toggle-status` loads, flips `metadata.status`, sets `metadata.updatedAt`, then re-saves.

### Preload API (`preload.ts`)

```typescript
template: {
  list:         () => ipcRenderer.invoke('template:list'),
  load:         (id: string) => ipcRenderer.invoke('template:load', id),
  save:         (wf: unknown) => ipcRenderer.invoke('template:save', wf),
  delete:       (id: string) => ipcRenderer.invoke('template:delete', id),
  toggleStatus: (id: string) => ipcRenderer.invoke('template:toggle-status', id),
  duplicate:    (id: string) => ipcRenderer.invoke('template:duplicate', id),
},
```

### Template Service in IPC index (`main/ipc/index.ts`)

A second `WorkflowFileService` instance is created for `templateDirectory`:

```typescript
export interface IPCServiceDeps {
  // ... existing ...
  templateFileService: WorkflowFileService;  // NEW
}

export function registerAllHandlers(deps: IPCServiceDeps): void {
  // ... existing ...
  registerTemplateHandlers(deps.templateFileService);
}
```

### TemplateManagerPage UI Contract

| Action | Trigger | Behavior |
|--------|---------|----------|
| Create | Header "New Template" button | Navigate to `/` (designer) with blank workflow; auto-save saves to templateDirectory |
| Edit | Card "Edit" button | Load template → set in workflowStore → navigate to `/` |
| Delete | Card "Delete" button | Show confirmation dialog → `template:delete` → refresh list |
| Toggle | Card status badge click or toggle button | `template:toggle-status` → optimistic UI update |
| Duplicate | Card "Duplicate" button | `template:duplicate` → refresh list |
| Filter | Search input + tag/status chip filters | Client-side filter on loaded list |

### ExecutionPage Template Picker

The Execute tab replaces `window.electronAPI.workflow.list()` with `window.electronAPI.template.list()` and filters to `status !== 'paused'`. The picker label changes to "Select Template".

## Technical Approach

### Storage

Templates are persisted by `WorkflowFileService` at `settings.templateDirectory`. If `templateDirectory` is empty at startup, the main process defaults to `app.getPath('userData') + '/templates'` (creating it if needed). This mirrors how `workflowDirectory` works.

### Create → Designer Round-Trip

"Create new template" sets `workflowStore` to a blank `WorkflowDefinition` with `id: ''` and navigates to `/`. The designer detects `id === ''` and saves to `template:save` (instead of `workflow:save`) when the user presses Save. This requires a one-bit signal from the Templates tab to the designer — implemented via a `uiStore.activeSaveTarget: 'workflow' | 'template'` field.

### Edit → Designer Round-Trip

"Edit" loads the template (`template:load`), sets `uiStore.activeSaveTarget = 'template'`, loads into `workflowStore`, and navigates to the appropriate editor:
- If template has `studio-block-composer` tag → navigate to `/studio`
- Otherwise → navigate to `/` (designer)

The designer's Save button calls `template:save` instead of `workflow:save` when `activeSaveTarget === 'template'`.

> **Important:** F01-T12 (Studio save) must set `activeSaveTarget` correctly when saving
> from Studio. When a Studio workflow is saved as a template, `activeSaveTarget` must be set
> to `'template'` so that subsequent saves go through `template:save` IPC, not `workflow:save`.

### Zod Schema Update

Add `status` as an optional enum to the Zod schema:

```typescript
const WorkflowMetadataSchema = z.object({
  // ... existing ...
  status: z.enum(['active', 'paused']).optional(),
});
```

## File Structure

```
apps/workflow-studio/src/
├── shared/
│   ├── types/workflow.ts               # +status to WorkflowMetadata
│   └── ipc-channels.ts                 # +TEMPLATE_* channels
├── main/
│   ├── schemas/workflow-schema.ts      # +status to Zod schema
│   ├── ipc/
│   │   ├── template-handlers.ts        # NEW — list/load/save/delete/toggle/duplicate
│   │   └── index.ts                    # +templateFileService dep, +registerTemplateHandlers
│   ├── index.ts                        # +templateFileService init with default dir
│   └── services/workflow-file-service.ts  # no changes (reused as-is)
├── preload/
│   ├── preload.ts                      # +template API namespace
│   └── electron-api.d.ts              # +template type declarations
└── renderer/
    ├── stores/uiStore.ts               # +activeSaveTarget field
    ├── pages/
    │   ├── TemplateManagerPage.tsx     # rebuilt: real IPC, filter, status toggle, duplicate
    │   └── ExecutionPage.tsx           # updated: loads from template:list (active only)
    └── components/templates/           # existing TemplateCard.tsx updated for status
```

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `templateDirectory` not set on upgrade from P14 | Medium | Default to `userData/templates` if empty |
| Create/Edit round-trip via `activeSaveTarget` adds complexity | Medium | Keep toggle simple — single field in uiStore |
| Execute tab users confused by "no workflows" after migration | Low | Keep `workflow:list` in Execute for now as fallback; add note |
| Duplicate naming collision if user duplicates twice | Low | Append `(Copy N)` counter |
