---
id: P15-F12
parent_id: P15
type: design
version: 1
status: approved
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
dependencies:
  - P15-F03
  - P15-F04
tags:
  - diffviewer
  - github-issues
  - workitems
  - phase-2
---

# Design: DiffViewer & GitHub Issues (P15-F12)

## Overview

Phase 1 shipped stub implementations for DiffViewer and GitHub Issues integration.
- `DiffViewer.tsx` renders placeholder text; `react-diff-viewer-continued` is not installed.
- `WorkItemPickerDialog.tsx` uses `MOCK_ISSUES` for the Issues tab; GitHub CLI integration
  exists in `WorkItemService` but is not wired to the UI.
- `WorkItemService.listByType('idea')` and `listByType('manual')` return empty arrays.

Phase 2 completes both features: real diff rendering with side-by-side/unified modes,
and live GitHub Issues integration replacing mock data.

## What Already Exists

### DiffViewer
| Component | File | Status |
|-----------|------|--------|
| DiffViewer stub | `components/execution/DiffViewer.tsx` | Stub with placeholder text |
| DiffViewer test | `test/renderer/components/execution/DiffViewer.test.tsx` | Tests placeholder |
| FileDiff type | `shared/types/execution.ts:137-142` | Fully defined |
| CodeBlockDeliverables | `shared/types/execution.ts` | Has `filesChanged`, `diffSummary` |
| DeliverablesViewer | `components/execution/DeliverablesViewer.tsx` | Shows text summary only |

### GitHub Issues
| Component | File | Status |
|-----------|------|--------|
| WorkItemPickerDialog | `components/workitems/WorkItemPickerDialog.tsx` | Mock issues data |
| WorkItemCard | `components/workitems/WorkItemCard.tsx` | Fully implemented |
| WorkItemService | `main/services/workitem-service.ts:94-115` | `gh issue list` implemented |
| WorkItem handlers | `main/ipc/workitem-handlers.ts` | WORKITEM_LIST, WORKITEM_GET |
| WorkItem types | `shared/types/workitem.ts` | WorkItemReference fully typed |
| IPC channels | `shared/ipc-channels.ts:48-55` | All 4 channels defined |

## Scope (4 Items)

### 1. Install and Integrate react-diff-viewer-continued

Replace DiffViewer stub with real diff rendering:

```typescript
interface DiffViewerProps {
  diffs: FileDiff[];
  mode: 'side_by_side' | 'unified';
  onOpenInVSCode?: (filePath: string) => void;
}
```

Features:
- Side-by-side and unified diff modes (toggle button)
- Syntax highlighting via react-diff-viewer-continued's built-in support
- File-level accordion (expand/collapse per file)
- "Open in VSCode" button per file (callback already in props)
- Line numbers displayed

Integration point: `DeliverablesViewer.tsx` renders DiffViewer for code blocks
when `FileDiff[]` data is available, falling back to text `diffSummary` otherwise.

### 2. Wire GitHub Issues via `gh` CLI

Replace `MOCK_ISSUES` in `WorkItemPickerDialog.tsx` with live data:

Flow:
1. Issues tab selected -> invoke `WORKITEM_LIST` IPC with `type: 'issue'`
2. Main process -> `WorkItemService.listByType('issue')`
3. WorkItemService runs `gh issue list --json number,title,body,labels --limit 20`
4. Returns parsed `WorkItemReference[]` to renderer
5. Error handling: if `gh` CLI not available, show "GitHub CLI not installed" message

`WorkItemService.listByType('issue')` already implements the `gh` call (lines 94-115).
The gap is wiring the renderer to call IPC instead of using inline MOCK_ISSUES.

### 3. Capture FileDiff Data During Execution

Currently, code blocks produce text `diffSummary` but no structured `FileDiff[]`.
Add git diff capture after CLI execution completes:

```typescript
// In ExecutionEngine, after executeNodeReal() completes successfully:
const fileDiffs = await captureGitDiff(workingDirectory, preExecutionSha);
// Store in blockResult.deliverables.fileDiffs
```

New utility: `src/main/services/diff-capture.ts`
- `captureGitDiff(cwd, baseSha): Promise<FileDiff[]>`
- Runs `git diff <baseSha> --unified=3` and parses output
- Extracts per-file hunks into `FileDiff[]` structure

### 4. GitHub CLI Availability Check

Add `checkGhAvailable()` to `workitem-service.ts`:
- Runs `gh auth status` with 3s timeout
- Returns `{ available: boolean, authenticated: boolean }`
- WorkItemPickerDialog shows appropriate state:
  - `gh` not installed: "Install GitHub CLI to view issues"
  - Not authenticated: "Run `gh auth login` to authenticate"
  - Available: Show live issues

## File Changes

### Modified Files
```
src/renderer/components/execution/DiffViewer.tsx         # Replace stub
src/renderer/components/execution/DeliverablesViewer.tsx  # Wire DiffViewer for code blocks
src/renderer/components/workitems/WorkItemPickerDialog.tsx  # Replace MOCK_ISSUES with IPC
src/main/services/workitem-service.ts                    # Add checkGhAvailable()
src/main/services/execution-engine.ts                    # Capture git diff after execution
src/shared/types/execution.ts                           # Add fileDiffs to CodeBlockDeliverables
package.json                                             # Add react-diff-viewer-continued
```

### New Files
```
src/main/services/diff-capture.ts                        # Git diff parsing utility
test/main/diff-capture.test.ts                           # Tests for diff parsing
test/renderer/components/workitems/WorkItemPickerDialog.test.tsx  # Replace mock tests
```

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| react-diff-viewer-continued bundle size | Low | Tree-shakeable, only loaded on code blocks |
| `gh` CLI not installed on user machine | Medium | Graceful degradation with clear message |
| Large diffs slow rendering | Low | Virtualize file list, collapse by default |
| Git diff parsing edge cases | Low | Use established unified diff format |
