---
id: P15-F11
parent_id: P15
type: design
version: 1
status: approved
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-28T00:00:00Z"
dependencies:
  - P15-F01
  - P15-F08
tags:
  - block-types
  - studio
  - phase-2
---

# Design: New Block Types (P15-F11)

## Overview

Phase 1 (P15-F01) shipped the Studio with only the Plan block type. The BlockType enum
includes `dev`, `test`, `review`, and `devops` but they are stubbed with empty
`defaultSystemPromptPrefix` and `defaultOutputChecklist` values, and filtered out by
`AVAILABLE_BLOCK_TYPES` (phase <= 1 filter).

Phase 2 completes all four block types by filling metadata defaults, enhancing
DeliverablesViewer rendering, and updating the phase filter.

## What Already Exists (No Work Needed)

| Component | Status |
|-----------|--------|
| `BlockType` enum in `workflow.ts` | Includes all 5 types |
| `BLOCK_TYPE_METADATA` in `constants.ts` | Entries exist with empty defaults |
| `BlockPalette.tsx` | Renders from `AVAILABLE_BLOCK_TYPES` (generic) |
| `BlockConfigPanel.tsx` | Works for any block type |
| `PromptHarnessEditor.tsx` | Edits systemPromptPrefix + outputChecklist |
| `ExecutionEngine` dispatch | Routes by backend type, not blockType — fully generic |
| `buildSystemPrompt()` | Uses systemPromptPrefix from node config |
| `AgentNodeComponent` / `ExecutionAgentNode` | Generic rendering, no blockType logic |
| `BlockDeliverables` types | Test, Review, DevOps types defined in `execution.ts` |

## What Needs Implementation (3 Items)

### 1. Fill Block Metadata Defaults

In `src/shared/constants.ts`, replace empty strings/arrays for Dev, Test, Review, DevOps:

**Dev Block** (`agentNodeType: 'coding'`):
- System prompt: TDD guidance — write failing tests, implement, refactor
- Output checklist: failing tests, implementation, lint pass, no breaking changes

**Test Block** (`agentNodeType: 'utest'`):
- System prompt: QA engineer role — comprehensive tests, coverage targets
- Output checklist: coverage report, all passing, edge cases, performance tests

**Review Block** (`agentNodeType: 'reviewer'`):
- System prompt: Senior reviewer — quality, performance, security, coverage
- Output checklist: security findings, quality concerns, performance assessment, coverage gaps

**DevOps Block** (`agentNodeType: 'deployment'`):
- System prompt: DevOps engineer — containers, K8s, CI/CD, monitoring
- Output checklist: Dockerfile, K8s manifests, CI/CD pipeline, monitoring setup

### 2. Update Phase Filter

In `src/shared/constants.ts` line ~241:
```typescript
// Before:
.filter(([, meta]) => meta.phase <= 1)
// After:
.filter(([, meta]) => meta.phase <= 2)
```

### 3. Enhance DeliverablesViewer

In `src/renderer/components/execution/DeliverablesViewer.tsx`, add rendering for:

**Test block**: Pass/fail/skip counters in colored grid + summary text
**Review block**: Approved/rejected badge + findings list with expand/collapse
**DevOps block**: Status badge + operations list

Currently these fall back to generic summary rendering.

## Scope Exclusions

- Execution dispatch changes: NOT needed (engine is generic)
- New node components: NOT needed (existing components are blockType-agnostic)
- Config panel changes: NOT needed (PromptHarnessEditor works for all types)
- Block palette changes: NOT needed beyond phase filter update

## File Changes

### Modified Files
```
src/shared/constants.ts                                    # Fill metadata, update filter
src/renderer/components/execution/DeliverablesViewer.tsx    # Add Test/Review/DevOps rendering
```

### New Files
```
test/renderer/components/execution/DeliverablesViewer.test.tsx  # Tests for new renderings
test/shared/constants.test.ts                                   # Tests for metadata + filter
```

## Estimated Effort

~200 lines of implementation:
- ~80 lines in constants.ts (block metadata defaults)
- ~120 lines in DeliverablesViewer.tsx (rendering logic)
- ~150 lines of tests

Total: ~6 hours
