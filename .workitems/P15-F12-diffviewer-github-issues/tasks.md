---
id: P15-F12
parent_id: P15
type: tasks
version: 1
status: complete
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
estimated_hours: 10
---

# Tasks: DiffViewer & GitHub Issues (P15-F12)

## Dependency Graph

```
Phase 1 (DiffViewer)
  T01 -> T02 -> T03 (install, implement, integrate)
         |
Phase 2 (Diff capture)
  T04 -> T05 (capture utility, engine wiring)
         |
Phase 3 (GitHub Issues)
  T06 -> T07 -> T08 (gh check, wire IPC, tests)
         |
Phase 4 (Integration)
  T09 (needs T03, T05, T08)
```

## Phase 1: DiffViewer (T01-T03)

### T01: Install react-diff-viewer-continued

- [x] Estimate: 0.5hr
- [x] Notes:
  - Run `npm install react-diff-viewer-continued` in apps/workflow-studio/
  - Verify package added to package.json dependencies
  - Verify no peer dependency conflicts
  - Dependencies: none

### T02: Implement DiffViewer with react-diff-viewer-continued

- [x] Estimate: 2hr
- [x] Notes:
  - RED: update `test/renderer/components/execution/DiffViewer.test.tsx`
    - Test: renders diff for single file with side-by-side mode
    - Test: renders diff for single file with unified mode
    - Test: mode toggle switches between views
    - Test: multiple files render as collapsible sections
    - Test: "Open in VSCode" button calls onOpenInVSCode callback
    - Test: renders "No changes" when diffs array is empty
  - GREEN: replace stub in `src/renderer/components/execution/DiffViewer.tsx`
    - Use ReactDiffViewer component from react-diff-viewer-continued
    - File accordion: each FileDiff in its own collapsible section
    - Mode toggle button (side-by-side / unified) at top
    - "Open in VSCode" button in each file header
  - Dependencies: T01

### T03: Integrate DiffViewer into DeliverablesViewer

- [x] Estimate: 1hr
- [x] Notes:
  - RED: add tests to DeliverablesViewer test file
    - Test: code block with fileDiffs renders DiffViewer component
    - Test: code block without fileDiffs falls back to diffSummary text
  - GREEN: in `DeliverablesViewer.tsx`, for `blockType === 'code'`:
    - If `deliverables.fileDiffs?.length > 0`: render `<DiffViewer diffs={fileDiffs} />`
    - Else: render existing text `diffSummary` (current behavior)
  - Add `fileDiffs?: FileDiff[]` to `CodeBlockDeliverables` in `execution.ts`
  - Dependencies: T02

## Phase 2: Diff Capture (T04-T05)

### T04: Create diff-capture.ts utility

- [x] Estimate: 1.5hr
- [x] Notes:
  - RED: write `test/main/diff-capture.test.ts`
    - Test: parses unified diff output into FileDiff[] array
    - Test: handles new files (no oldContent)
    - Test: handles deleted files (no newContent)
    - Test: handles modified files (both old and new content)
    - Test: returns empty array when no diff
    - Test: handles binary files gracefully
  - GREEN: create `src/main/services/diff-capture.ts`
    - `captureGitDiff(cwd: string, baseSha: string): Promise<FileDiff[]>`
    - Runs `git diff <baseSha> --unified=3`
    - Parses unified diff format into FileDiff[] structure
    - Extracts path, hunks per file
  - Dependencies: none

### T05: Wire diff capture into ExecutionEngine

- [x] Estimate: 1hr
- [x] Notes:
  - In `execution-engine.ts`, after `executeNodeReal()` succeeds for code blocks:
    - Capture current git SHA before execution starts (store in local var)
    - After CLI exit code 0, call `captureGitDiff(workDir, preExecSha)`
    - Merge `FileDiff[]` into the block's deliverables
  - RED: test that code block execution captures diff
  - GREEN: add pre-exec SHA capture + post-exec diff call
  - Dependencies: T04

## Phase 3: GitHub Issues (T06-T08)

### T06: Add checkGhAvailable() to WorkItemService

- [x] Estimate: 0.5hr
- [x] Notes:
  - RED: add tests to workitem-service tests
    - Test: returns { available: true, authenticated: true } when gh auth succeeds
    - Test: returns { available: false, authenticated: false } when gh not found
    - Test: returns { available: true, authenticated: false } when auth fails
  - GREEN: add `checkGhAvailable()` method
    - Runs `gh auth status` with 3s timeout
    - Parses exit code and stderr
  - Dependencies: none

### T07: Replace MOCK_ISSUES with IPC call in WorkItemPickerDialog

- [x] Estimate: 1.5hr
- [x] Notes:
  - RED: write `test/renderer/components/workitems/WorkItemPickerDialog.test.tsx`
    - Test: Issues tab calls WORKITEM_LIST IPC with type 'issue'
    - Test: displays loading state while fetching
    - Test: renders fetched issues
    - Test: shows "GitHub CLI not installed" when gh unavailable
    - Test: shows "Not authenticated" when gh available but not authed
    - Test: search filters fetched issues
  - GREEN: in `WorkItemPickerDialog.tsx`:
    - Remove MOCK_ISSUES constant
    - Add useEffect to fetch issues via IPC when Issues tab selected
    - Add `ghStatus` state from `checkGhAvailable()` IPC call
    - Show appropriate message per ghStatus
    - Keep existing search/filter/selection logic
  - Add IPC handler for `checkGhAvailable()` in workitem-handlers.ts
  - Dependencies: T06

### T08: Test GitHub Issues end-to-end flow

- [x] Estimate: 0.5hr
- [x] Notes:
  - Integration test: select issue -> start execution -> workItem in execution context
  - Verify WorkItemReference has source='github' and url set
  - Mock `gh issue list` response in test
  - Dependencies: T07

## Phase 4: Integration (T09)

### T09: Integration test: diff viewer + GitHub issue workflow

- [x] Estimate: 1hr
- [x] Notes:
  - Create `test/integration/diffviewer-integration.test.ts`
  - Test: code block execution produces FileDiff[] in deliverables
  - Test: DeliverablesViewer renders DiffViewer with captured diffs
  - Test: workflow started with GitHub issue shows issue context in execution header
  - Dependencies: T03, T05, T08

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Phase 1: DiffViewer | T01-T03 | 3.5hr |
| Phase 2: Diff capture | T04-T05 | 2.5hr |
| Phase 3: GitHub Issues | T06-T08 | 2.5hr |
| Phase 4: Integration | T09 | 1hr |
| **Total** | **9 tasks** | **9.5hr** |
