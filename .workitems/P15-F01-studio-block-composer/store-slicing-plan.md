# Zustand Store Slicing Plan — P15 Cross-Cutting Design

**Status:** Draft
**Date:** 2026-02-22
**Author:** Planner
**Addresses:** Decision 7 (Architect Synthesis), Zustand store sprawl risk
**Features:** F01, F04, F07, F08

---

## Overview

The `workflowStore.ts` is currently 523 lines with ~25 actions covering workflow CRUD,
node/edge management, gate operations, undo/redo, and metadata. F01 adds ~8 new actions
(prompt harness, rules, parallel groups). Without intervention, the store will grow to
600+ lines and become difficult to maintain.

This document defines a plan to split the store into focused slices using Zustand's
slice pattern, plus defines new stores for F07 (monitoring) and F08 (settings).

---

## Current State Analysis

### `workflowStore.ts` — 523 lines

| Section | Lines | Actions | Responsibility |
|---------|-------|---------|----------------|
| State interface | 1-78 | 25 action signatures | Type definitions |
| Helpers | 80-155 | 5 helper functions | `createEmptyWorkflow`, `createDefaultNode`, `createDefaultGate`, `cloneWorkflow`, `touchUpdatedAt` |
| Workflow lifecycle | 174-202 | 3 (`setWorkflow`, `clearWorkflow`, `newWorkflow`) | CRUD |
| Node actions | 208-311 | 5 (`addNode`, `removeNode`, `updateNode`, `updateNodeConfig`, `moveNode`) | Node/edge graph |
| Edge actions | 317-382 | 3 (`addEdge`, `removeEdge`, `updateEdge`) | Node/edge graph |
| Gate actions | 388-445 | 3 (`addGate`, `removeGate`, `updateGate`) | Gate management |
| Selection | 451-458 | 3 (`selectNode`, `selectEdge`, `clearSelection`) | UI state |
| Undo/redo | 464-492 | 2 (`undo`, `redo`) | History |
| Metadata | 498-522 | 3 (`updateMetadata`, `setFilePath`, `markClean`) | File tracking |

### New Actions Needed (from F01 design)

```typescript
setNodeSystemPromptPrefix(nodeId: string, prefix: string): void;
setNodeOutputChecklist(nodeId: string, checklist: string[]): void;
setNodeBackend(nodeId: string, backend: 'claude' | 'cursor' | 'codex'): void;
addWorkflowRule(rule: string): void;
removeWorkflowRule(index: number): void;
addParallelGroup(nodeIds: string[]): void;
removeParallelGroup(groupId: string): void;
addNodeToParallelGroup(groupId: string, nodeId: string): void;
removeNodeFromParallelGroup(groupId: string, nodeId: string): void;
setParallelGroupLanes(groupId: string, nodeIds: string[]): void;
```

---

## Proposed Slices

### Slice 1: `workflowCoreSlice`

**File:** `stores/workflow/coreSlice.ts`

**Responsibility:** Workflow lifecycle, metadata, file path, dirty flag.

**State:**
```typescript
interface WorkflowCoreState {
  workflow: WorkflowDefinition | null;
  isDirty: boolean;
  filePath: string | null;
}
```

**Actions:**
```typescript
interface WorkflowCoreActions {
  setWorkflow: (workflow: WorkflowDefinition) => void;
  clearWorkflow: () => void;
  newWorkflow: (name?: string) => void;
  updateMetadata: (updates: Partial<WorkflowMetadata>) => void;
  setFilePath: (path: string | null) => void;
  markClean: () => void;
}
```

**Helpers migrated:** `createEmptyWorkflow`, `cloneWorkflow`, `touchUpdatedAt`

**Estimated size:** ~100 lines

---

### Slice 2: `workflowNodesSlice`

**File:** `stores/workflow/nodesSlice.ts`

**Responsibility:** Node, edge, and gate CRUD operations. Selection state.

**State:**
```typescript
interface WorkflowNodesState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
}
```

**Actions:**
```typescript
interface WorkflowNodesActions {
  // Nodes
  addNode: (type: AgentNodeType, position: { x: number; y: number }) => string;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<AgentNode>) => void;
  updateNodeConfig: (nodeId: string, config: Partial<AgentNodeConfig>) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;

  // Edges
  addEdge: (sourceNodeId: string, targetNodeId: string, condition?: TransitionCondition) => string;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<Transition>) => void;

  // Gates
  addGate: (nodeId: string) => string;
  removeGate: (gateId: string) => void;
  updateGate: (gateId: string, updates: Partial<HITLGateDefinition>) => void;

  // Selection
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
}
```

**Helpers migrated:** `createDefaultNode`, `createDefaultGate`

**Estimated size:** ~200 lines

---

### Slice 3: `workflowStudioSlice` (NEW for F01)

**File:** `stores/workflow/studioSlice.ts`

**Responsibility:** F01 Studio-specific actions — prompt harness, workflow rules,
parallel groups. These are all extensions to `WorkflowDefinition` that exist only
in the Studio context.

**State:** No additional state (operates on `workflow` from coreSlice)

**Actions:**
```typescript
interface WorkflowStudioActions {
  // Prompt harness
  setNodeSystemPromptPrefix: (nodeId: string, prefix: string) => void;
  setNodeOutputChecklist: (nodeId: string, checklist: string[]) => void;
  setNodeBackend: (nodeId: string, backend: 'claude' | 'cursor' | 'codex') => void;

  // Workflow rules
  addWorkflowRule: (rule: string) => void;
  removeWorkflowRule: (index: number) => void;

  // Parallel groups
  addParallelGroup: (nodeIds: string[]) => void;
  removeParallelGroup: (groupId: string) => void;
  addNodeToParallelGroup: (groupId: string, nodeId: string) => void;
  removeNodeFromParallelGroup: (groupId: string, nodeId: string) => void;
  setParallelGroupLanes: (groupId: string, nodeIds: string[]) => void;
}
```

**Estimated size:** ~120 lines

---

### Slice 4: `workflowHistorySlice`

**File:** `stores/workflow/historySlice.ts`

**Responsibility:** Undo/redo stack management.

**State:**
```typescript
interface WorkflowHistoryState {
  undoStack: WorkflowDefinition[];
  redoStack: WorkflowDefinition[];
}
```

**Actions:**
```typescript
interface WorkflowHistoryActions {
  undo: () => void;
  redo: () => void;
  /** Push current state to undo stack (called by other slices before mutations) */
  pushHistory: () => void;
}
```

**Key change:** Extract the undo-push pattern into a `pushHistory()` action that other
slices call before mutating `workflow`. Currently, every mutation action manually manages
the undo stack. With `pushHistory()`, the pattern becomes:

```typescript
// Before (in every action):
const snapshot = cloneWorkflow(workflow);
set({ undoStack: [...undoStack, snapshot].slice(-MAX_UNDO_DEPTH), redoStack: [] });

// After (using pushHistory):
get().pushHistory();
// ... mutate workflow ...
set({ workflow: updated, isDirty: true });
```

**Estimated size:** ~60 lines

---

## Combined Store

**File:** `stores/workflowStore.ts` (replaces current file)

The combined store re-exports all slices as a single Zustand store for backward
compatibility. Existing imports (`import { useWorkflowStore } from './stores/workflowStore'`)
continue to work without changes.

```typescript
import { create } from 'zustand';
import { createCoreSlice, WorkflowCoreSlice } from './workflow/coreSlice';
import { createNodesSlice, WorkflowNodesSlice } from './workflow/nodesSlice';
import { createStudioSlice, WorkflowStudioSlice } from './workflow/studioSlice';
import { createHistorySlice, WorkflowHistorySlice } from './workflow/historySlice';

export type WorkflowState =
  & WorkflowCoreSlice
  & WorkflowNodesSlice
  & WorkflowStudioSlice
  & WorkflowHistorySlice;

export const useWorkflowStore = create<WorkflowState>()((...args) => ({
  ...createCoreSlice(...args),
  ...createNodesSlice(...args),
  ...createStudioSlice(...args),
  ...createHistorySlice(...args),
}));
```

**Slice creator pattern:**

Each slice follows the standard Zustand slice pattern:

```typescript
import { StateCreator } from 'zustand';
import type { WorkflowState } from '../workflowStore';

export interface WorkflowCoreSlice {
  // state + actions
}

export const createCoreSlice: StateCreator<
  WorkflowState,
  [],
  [],
  WorkflowCoreSlice
> = (set, get) => ({
  // ... implementation
});
```

This allows each slice to access the full store via `get()` while only defining its
own subset of state and actions.

---

## New Stores

### `monitoringStore` (F07)

**File:** `stores/monitoringStore.ts`

**Purpose:** Manages real-time telemetry events, agent sessions, and monitoring stats
for the F07 Monitoring Dashboard.

**State:**
```typescript
interface MonitoringState {
  /** Ring buffer of recent telemetry events (max 1000) */
  events: TelemetryEvent[];
  /** Active and recent agent sessions */
  sessions: AgentSession[];
  /** Aggregate statistics */
  stats: TelemetryStats | null;
  /** Whether the telemetry receiver is active */
  receiverActive: boolean;
  /** Filter: selected agent ID (null = all) */
  selectedAgentId: string | null;
  /** Filter: selected session ID (null = all) */
  selectedSessionId: string | null;
}
```

**Actions:**
```typescript
interface MonitoringActions {
  /** Add a new telemetry event to the ring buffer */
  pushEvent: (event: TelemetryEvent) => void;
  /** Batch-add events (for initial load or reconnect) */
  pushEvents: (events: TelemetryEvent[]) => void;
  /** Update or add an agent session */
  upsertSession: (session: AgentSession) => void;
  /** Update aggregate stats */
  setStats: (stats: TelemetryStats) => void;
  /** Set receiver active/inactive status */
  setReceiverActive: (active: boolean) => void;
  /** Set agent filter */
  selectAgent: (agentId: string | null) => void;
  /** Set session filter */
  selectSession: (sessionId: string | null) => void;
  /** Clear all events and sessions (e.g., on workflow restart) */
  clearAll: () => void;
}
```

**Ring buffer behavior:**
- `pushEvent` adds to the end of the array
- When `events.length > 1000`, slice from the end (drop oldest)
- This prevents unbounded memory growth during long-running workflows

**IPC integration:**
- `execution:telemetry-event` push from main process -> calls `pushEvent`
- `execution:session-update` push from main process -> calls `upsertSession`
- `execution:telemetry-stats` push from main process -> calls `setStats`

**Estimated size:** ~120 lines

---

### `settingsStore` (F08)

**File:** `stores/settingsStore.ts`

**Purpose:** Manages application settings and AI provider configuration. Provides
the interface for F01's `AgentBackendSelector` to read provider availability.

**State:**
```typescript
interface SettingsState {
  /** Full application settings (loaded from main process) */
  settings: AppSettings | null;
  /** Loading state for settings operations */
  loading: boolean;
  /** Whether settings have unsaved changes */
  isDirty: boolean;
}
```

**Actions:**
```typescript
interface SettingsActions {
  /** Load settings from main process via IPC */
  loadSettings: () => Promise<void>;
  /** Save settings to main process via IPC */
  saveSettings: () => Promise<void>;
  /** Update a settings field */
  updateSettings: (updates: Partial<AppSettings>) => void;
  /** Update a specific provider's config */
  updateProvider: (id: ProviderId, config: Partial<ProviderConfig>) => void;
  /** Mark settings as clean (after save) */
  markClean: () => void;

  // --- Provider query interface (used by F01 AgentBackendSelector) ---

  /** Get list of provider IDs that have API keys configured */
  getConfiguredProviders: () => ProviderId[];
  /** Get a specific provider's config (or null if not configured) */
  getProviderConfig: (id: ProviderId) => ProviderConfig | null;
}
```

**F01 integration (MT-14):**

F01's `AgentBackendSelector` consumes the provider query interface:

```typescript
// In AgentBackendSelector.tsx
const configuredProviders = useSettingsStore(s => s.getConfiguredProviders());
const anthropicConfig = useSettingsStore(s => s.getProviderConfig('anthropic'));

// Show which backends are available based on configured providers
const backends = [
  { id: 'claude', label: 'Claude Code', available: configuredProviders.includes('anthropic') },
  { id: 'cursor', label: 'Cursor CLI', available: true },  // Cursor uses its own auth
  { id: 'codex', label: 'Codex CLI', available: configuredProviders.includes('openai') },
];
```

**Estimated size:** ~100 lines

---

### `executionStore` (Existing — Expansion Notes)

The execution store already exists (used by F04 `ExecutionPage`). For P15, it may need:

- `repoMount: RepoMount | null` — from F03 launcher
- `currentBlockOutput: BlockOutput | null` — from agent-contract.md
- `gateState` — from F04 multi-step UX

These are documented here for awareness but should be implemented as part of F03/F04
tasks, not in Phase 0.

---

## Migration Path

### Phase 0 (Before Feature Work)

1. **Create slice files:** Split `workflowStore.ts` into 4 slice files
2. **Extract `pushHistory()`:** Centralize undo-push logic in historySlice
3. **Update `workflowStore.ts`:** Replace implementation with slice composition
4. **Verify backward compatibility:** All existing imports and usages unchanged
5. **Create `settingsStore.ts`:** Empty shell with `loadSettings()`
6. **Create `monitoringStore.ts`:** Empty shell with `pushEvent()`

### Phase 1 (During Feature Work)

- F01 adds actions to `workflowStudioSlice`
- F07 populates `monitoringStore` with IPC listeners
- F08 populates `settingsStore` with provider management

### No Breaking Changes

The migration is purely structural:
- `useWorkflowStore` continues to work as before
- All actions remain on the same hook
- No component updates needed
- Selectors like `useWorkflowStore(s => s.workflow)` are unchanged

---

## File Structure

```
apps/workflow-studio/src/renderer/stores/
├── workflowStore.ts                     # REPLACED: slim composition file (~30 lines)
├── workflow/
│   ├── coreSlice.ts                     # NEW: lifecycle, metadata, dirty flag
│   ├── nodesSlice.ts                    # NEW: node/edge/gate CRUD, selection
│   ├── studioSlice.ts                   # NEW: F01 prompt harness, rules, parallel groups
│   └── historySlice.ts                  # NEW: undo/redo with pushHistory()
├── monitoringStore.ts                   # NEW: F07 telemetry events and sessions
├── settingsStore.ts                     # NEW: F08 app settings and provider config
└── executionStore.ts                    # EXISTING: expand during F03/F04
```

---

## Effort Estimate

| Task | Effort |
|------|--------|
| Create 4 slice files + extract code | 1.5hr |
| Extract `pushHistory()` and refactor all mutation actions | 1hr |
| Update `workflowStore.ts` to composition pattern | 30min |
| Create `settingsStore.ts` shell | 15min |
| Create `monitoringStore.ts` shell | 15min |
| Verify all existing tests pass | 30min |
| **Total** | **~4hr** |
