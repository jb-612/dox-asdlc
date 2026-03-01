---
id: P15-F11
parent_id: P15
type: tasks
version: 1
status: complete
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
estimated_hours: 6
---

# Tasks: New Block Types (P15-F11)

## Dependency Graph

```
Phase 1 (Metadata)
  T01 -> T02 (constants + filter)
         |
Phase 2 (Viewer)
  T03 -> T04 (DeliverablesViewer)
         |
Phase 3 (Integration)
  T05 (round-trip test, needs T01+T03)
```

## Phase 1: Block Metadata (T01-T02)

### T01: Fill system prompt prefixes and output checklists for all Phase 2 blocks

- [x] Estimate: 1.5hr
- [x] Notes:
  - RED: write `test/shared/constants.test.ts`
    - Test: each block type in BLOCK_TYPE_METADATA has non-empty defaultSystemPromptPrefix
    - Test: each block type has non-empty defaultOutputChecklist
    - Test: dev block agentNodeType === 'coding'
    - Test: test block agentNodeType === 'utest'
    - Test: review block agentNodeType === 'reviewer'
    - Test: devops block agentNodeType === 'deployment'
  - GREEN: fill defaults in `src/shared/constants.ts` BLOCK_TYPE_METADATA
    - dev: TDD guidance (write failing tests, implement, refactor)
    - test: QA engineer (comprehensive tests, coverage >85%)
    - review: Senior reviewer (quality, performance, security, coverage)
    - devops: DevOps engineer (Docker, K8s, CI/CD, monitoring)
  - Dependencies: none

### T02: Update AVAILABLE_BLOCK_TYPES phase filter

- [x] Estimate: 0.5hr
- [x] Notes:
  - RED: add test to `test/shared/constants.test.ts`
    - Test: AVAILABLE_BLOCK_TYPES includes 'plan', 'dev', 'test', 'review', 'devops'
    - Test: AVAILABLE_BLOCK_TYPES.length === 5
  - GREEN: change filter from `meta.phase <= 1` to `meta.phase <= 2`
  - File: `src/shared/constants.ts` line ~241
  - Dependencies: T01

## Phase 2: DeliverablesViewer Enhancement (T03-T04)

### T03: Add Test block rendering to DeliverablesViewer

- [x] Estimate: 1hr
- [x] Notes:
  - RED: write `test/renderer/components/execution/DeliverablesViewer.test.tsx`
    - Test: TestBlockDeliverables renders pass/fail/skip counters
    - Test: TestBlockDeliverables renders summary text
    - Test: handles missing testResults gracefully
  - GREEN: add `blockType === 'test'` branch in DeliverablesViewer.tsx
    - Render colored grid: green (passed), red (failed), yellow (skipped)
    - Render summary text below
  - Dependencies: none

### T04: Add Review and DevOps block rendering to DeliverablesViewer

- [x] Estimate: 1.5hr
- [x] Notes:
  - RED: add tests to existing DeliverablesViewer test file
    - Test: ReviewBlockDeliverables renders approved/rejected badge
    - Test: ReviewBlockDeliverables renders expandable findings list
    - Test: DevopsBlockDeliverables renders status and operations list
    - Test: handles empty findings/operations arrays
  - GREEN: add `blockType === 'review'` and `blockType === 'devops'` branches
    - Review: approved badge (green/red), findings list with expand/collapse
    - DevOps: status text, operations list in mono font
  - Dependencies: T03

## Phase 3: Integration (T05)

### T05: Studio round-trip test for new block types

- [x] Estimate: 1.5hr
- [x] Notes:
  - Add to existing `test/integration/studio-round-trip.test.ts`
    - Test: can add Dev block from palette, configure prompt, save workflow, reload
    - Test: can add Test block, verify default checklist populated
    - Test: can add Review block, verify default prompt populated
    - Test: can add DevOps block, verify metadata correct
  - Verify: all 5 block types appear in BlockPalette
  - Verify: execution with Dev block uses system prompt prefix in CLI args
  - Dependencies: T01, T03

## Summary

| Phase | Tasks | Est. Hours |
|-------|-------|-----------|
| Phase 1: Block metadata | T01-T02 | 2hr |
| Phase 2: Viewer enhancement | T03-T04 | 2.5hr |
| Phase 3: Integration | T05 | 1.5hr |
| **Total** | **5 tasks** | **6hr** |
