---
id: P15-F10
parent_id: P15
type: design
version: 1
status: approved
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
tags:
  - shared-components
  - error-handling
  - toast
  - migration
  - phase-2
---

# Design: Shared Component Library Completion (P15-F10)

## Overview

Phase 1 shipped shared components (StatusBadge, CardLayout, TagInput, ConfirmDialog,
VirtualizedEventLog) and refactored workflowStore into Zustand slices. This feature
completes the library with error handling infrastructure and migrates remaining
feature-specific duplicates to shared components.

## What Already Exists (No Work Needed)

| Component | File | Tests |
|-----------|------|-------|
| StatusBadge | `components/shared/StatusBadge.tsx` | 7 |
| CardLayout | `components/shared/CardLayout.tsx` | 5 |
| TagInput | `components/shared/TagInput.tsx` | 7 |
| ConfirmDialog | `components/shared/ConfirmDialog.tsx` | 7 |
| VirtualizedEventLog | `components/shared/VirtualizedEventLog.tsx` | 4 |
| statusUtils | `components/shared/statusUtils.ts` | - |
| eventFormatter | `components/shared/eventFormatter.ts` | - |
| workflowStore slices | `stores/workflow/{core,nodes,studio,history}Slice.ts` | - |

## Scope (8 Items)

### 1. IpcErrorBoundary

React class component that catches errors from IPC calls and renders a fallback UI.

```typescript
interface IpcErrorBoundaryProps {
  children: React.ReactNode;
  /** Fallback UI when error occurs. Default: generic error message with retry */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}
```

Behavior:
- Catches errors from child component tree
- Shows fallback with error summary and "Retry" button
- "Retry" clears error state (re-renders children)
- Logs to console.error for debugging
- Does NOT catch async errors (those go through toast)

Location: `components/shared/IpcErrorBoundary.tsx`

### 2. Toast Notification System

Zustand store + provider + hook for transient feedback messages.

```typescript
type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number; // ms, default 5000. 0 = sticky
}

interface ToastStore {
  toasts: Toast[];
  addToast: (variant: ToastVariant, message: string, duration?: number) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// Hook for components
function useToast(): {
  success: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  info: (msg: string) => void;
};
```

`ToastProvider` renders a fixed-position container (bottom-right) with animated toast entries.
Auto-dismiss after duration. Max 5 visible toasts (oldest dismissed first).

Location: `stores/toastStore.ts`, `components/shared/ToastProvider.tsx`

### 3. VirtualizedEventLog Enhancements

Add three optional props to the existing component:

```typescript
interface VirtualizedEventLogProps {
  // ... existing props
  /** Show auto-scroll toggle button (default: false) */
  showAutoScrollToggle?: boolean;
  /** Filter predicate — events failing this are hidden */
  filterPredicate?: (event: FormattedEvent) => boolean;
  /** Highlight events matching this text */
  searchText?: string;
}
```

### 4-5. StatusBadge Migrations

Two components have their own status badge implementations:
- `ExecutionDetailsPanel` has `statusBadgeClass()` function
- `CLISessionList` has `statusBadge()` function

Replace with `<StatusBadge status={status} />` from shared.

### 6. EventLogPanel Migration

`EventLogPanel` has custom scroll management and filtering. Replace scroll logic
with `VirtualizedEventLog` (after T05 enhancements). Keep EventLogPanel as a thin
wrapper that maps execution events to `FormattedEvent[]`.

### 7-8. Integration

Wrap 5 pages (ExecutionPage, DesignerPage, StudioPage, TemplatesPage, MonitoringPage)
with `IpcErrorBoundary`. Add toast calls at key IPC failure points.

## What Should NOT Be Migrated

| Component | Reason |
|-----------|--------|
| EventStream (monitoring) | Table-based with expandable rows, too different |
| TemplateCard | Custom mini workflow preview |
| ProviderCard | Expand/collapse behavior |
| SummaryCards/MetricCard | Simple metric, no benefit |

## File Changes

### New Files
```
src/renderer/stores/toastStore.ts
src/renderer/components/shared/ToastProvider.tsx
src/renderer/components/shared/IpcErrorBoundary.tsx
test/renderer/components/shared/IpcErrorBoundary.test.tsx
test/renderer/components/shared/ToastProvider.test.tsx
test/renderer/stores/toastStore.test.ts
```

### Modified Files
```
src/renderer/components/shared/VirtualizedEventLog.tsx    # Add 3 props
src/renderer/components/shared/index.ts                   # Export new components
src/renderer/components/execution/ExecutionDetailsPanel.tsx # StatusBadge migration
src/renderer/components/cli/CLISessionList.tsx             # StatusBadge migration
src/renderer/components/execution/EventLogPanel.tsx        # VirtualizedEventLog migration
src/renderer/App.tsx                                       # IpcErrorBoundary wrapping
```
