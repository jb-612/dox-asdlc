---
id: P15-F10
parent_id: P15
type: tasks
version: 1
status: complete
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
estimated_hours: 14
---

# Tasks: Shared Component Library Completion (P15-F10)

## Dependency Graph

```
Phase 1 (New components)
  T01 -> T02 (IpcErrorBoundary)
  T03 -> T04 (Toast system)
         |
Phase 2 (Enhancements)
  T05 -> T06 (VirtualizedEventLog)
         |
Phase 3 (Migration)
  T07, T08, T09, T10 (parallel)
         |
Phase 4 (Integration)
  T11 (needs T01), T12 (needs T03)
```

## Phase 1: New Components (T01-T04)

### T01: Create IpcErrorBoundary component

- [x] Estimate: 1.5hr
- [x] Notes:
  - RED: write `test/renderer/components/shared/IpcErrorBoundary.test.tsx` first
    - Test: renders children when no error
    - Test: renders fallback when child throws
    - Test: retry button clears error and re-renders children
    - Test: onError callback called with error and errorInfo
    - Test: custom fallback render function receives error and reset
  - GREEN: create `src/renderer/components/shared/IpcErrorBoundary.tsx`
    - React class component (error boundaries require class components)
    - Props: children, fallback?, onError?
    - Default fallback: centered div with error message + Retry button
  - Dependencies: none

### T02: Write IpcErrorBoundary tests for edge cases

- [x] Estimate: 0.5hr
- [x] Notes:
  - Test: nested error boundaries (inner catches, outer does not)
  - Test: error after reset triggers boundary again
  - Test: async errors are not caught (expected behavior)
  - Dependencies: T01

### T03: Create toast notification store and provider

- [x] Estimate: 2hr
- [x] Notes:
  - RED: write `test/renderer/stores/toastStore.test.ts` first
    - Test: addToast adds toast with generated id
    - Test: removeToast removes by id
    - Test: clearAll empties array
    - Test: max 5 toasts (oldest removed)
  - GREEN: create `src/renderer/stores/toastStore.ts` (Zustand store)
  - RED: write `test/renderer/components/shared/ToastProvider.test.tsx`
    - Test: renders toasts from store
    - Test: auto-dismiss after duration
    - Test: variant styling (success=green, error=red, warning=yellow, info=blue)
    - Test: clicking dismiss removes toast
  - GREEN: create `src/renderer/components/shared/ToastProvider.tsx`
  - Export `useToast` hook from toastStore
  - Dependencies: none

### T04: Add toast and IpcErrorBoundary to barrel export

- [x] Estimate: 0.5hr
- [x] Notes:
  - Update `src/renderer/components/shared/index.ts`
  - Export: IpcErrorBoundary, IpcErrorBoundaryProps, ToastProvider
  - Export from stores: useToast (re-export convenience)
  - Dependencies: T01, T03

## Phase 2: VirtualizedEventLog Enhancements (T05-T06)

### T05: Add auto-scroll, filter, search to VirtualizedEventLog

- [x] Estimate: 1.5hr
- [x] Notes:
  - RED: add tests to existing VirtualizedEventLog test file
    - Test: showAutoScrollToggle renders toggle button
    - Test: toggle button pauses/resumes auto-scroll
    - Test: filterPredicate hides non-matching events
    - Test: searchText highlights matching text
  - GREEN: add three optional props to VirtualizedEventLog.tsx
    - `showAutoScrollToggle?: boolean` — renders a small toggle at top-right
    - `filterPredicate?: (event) => boolean` — filters the events array
    - `searchText?: string` — wraps matching text in `<mark>` elements
  - Dependencies: none

### T06: Test VirtualizedEventLog with large datasets

- [x] Estimate: 0.5hr
- [x] Notes:
  - Performance test: 10,000 events renders without jank
  - Test: filter + search combined
  - Test: auto-scroll toggle state preserved across re-renders
  - Dependencies: T05

## Phase 3: Migration (T07-T10)

### T07: Migrate ExecutionDetailsPanel to shared StatusBadge

- [x] Estimate: 1hr
- [x] Notes:
  - Find `statusBadgeClass()` in ExecutionDetailsPanel
  - Replace with `<StatusBadge status={status} />` import from shared
  - Verify visual parity (may need to add status mappings to statusUtils)
  - Run existing ExecutionDetailsPanel tests — no regressions
  - Dependencies: none (shared StatusBadge already exists)

### T08: Migrate CLISessionList to shared StatusBadge

- [x] Estimate: 1hr
- [x] Notes:
  - Find `statusBadge()` function in CLISessionList
  - Replace with `<StatusBadge status={status} />`
  - Run existing CLISessionList tests — no regressions
  - Dependencies: none

### T09: Migrate EventLogPanel to use VirtualizedEventLog

- [x] Estimate: 1.5hr
- [x] Notes:
  - EventLogPanel currently has custom scroll management and filtering
  - Replace scroll logic with `<VirtualizedEventLog>` using new filter/search props
  - Keep EventLogPanel as thin wrapper: maps ExecutionEvent[] to FormattedEvent[]
  - Pass `showAutoScrollToggle={true}` and `filterPredicate` from existing filter state
  - Run existing EventLogPanel tests — adjust for new component structure
  - Dependencies: T05

### T10: Verify barrel exports and clean up unused imports

- [x] Estimate: 0.5hr
- [x] Notes:
  - Verify all shared components are exported from index.ts
  - Remove any local StatusBadge/eventLog utilities replaced by shared versions
  - Run full test suite to catch any broken imports
  - Dependencies: T07, T08, T09

## Phase 4: Integration (T11-T12)

### T11: Wrap 5 pages with IpcErrorBoundary

- [x] Estimate: 1hr
- [x] Notes:
  - In App.tsx, wrap route elements:
    - `<IpcErrorBoundary><ExecutionPage /></IpcErrorBoundary>`
    - `<IpcErrorBoundary><DesignerPage /></IpcErrorBoundary>`
    - `<IpcErrorBoundary><StudioPage /></IpcErrorBoundary>`
    - `<IpcErrorBoundary><TemplatesPage /></IpcErrorBoundary>`
    - `<IpcErrorBoundary><MonitoringPage /></IpcErrorBoundary>`
  - Test: simulate error in each page, verify fallback renders
  - Dependencies: T01

### T12: Wire toast notifications at key IPC failure points

- [x] Estimate: 1.5hr
- [x] Notes:
  - Add `useToast()` to key components:
    - ExecutionPage: toast on execution start/complete/error
    - DesignerPage: toast on save success/failure
    - TemplateManagerPage: toast on delete/duplicate/save
    - SettingsPage: toast on save success/failure
  - Each IPC `.catch()` calls `toast.error(message)`
  - Each success path calls `toast.success(message)`
  - Wrap App root with `<ToastProvider />`
  - Dependencies: T03

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Phase 1: New components | T01-T04 | 4.5hr |
| Phase 2: Enhancements | T05-T06 | 2hr |
| Phase 3: Migration | T07-T10 | 4hr |
| Phase 4: Integration | T11-T12 | 2.5hr |
| **Total** | **12 tasks** | **13hr** |
