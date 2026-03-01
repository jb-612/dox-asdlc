---
id: P15-F15
parent_id: P15
type: tasks
version: 3
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
estimated_hours: 28
---

# Tasks: Advanced Studio (P15-F15)

## Dependency Graph

```
T01(types)─┬─>T04(cond)─>T05(forEach)─>T06(subWf)──────────────────┐
T03(eval)──┴─>T04  T03+T04─>T07(shouldExec)                        ├>T13─>T14
T01─>T08─>T11  T01─>T09─>T11  T01─>T10─>T11───────────────────────┘
T01+T02─>T12(palette+handleDrop)
```

## Phase 1: Types & Evaluator

**T01** (1.5hr) Add control-flow types to `workflow.ts` | US-01/02/03 AC1
- RED: test ConditionConfig, ForEachConfig, SubWorkflowConfig interfaces; BlockType includes new values; AgentNodeConfig accepts optional configs
- GREEN: add interfaces, extend BlockType union + AgentNodeConfig + 'array' to WorkflowVariable.type

**T02** (1hr) Add control-flow metadata to `constants.ts` | US-01/02/03 AC1
- RED: test BLOCK_TYPE_METADATA has condition/forEach/subWorkflow entries with phase=3
- GREEN: add three entries; deps: T01

**T03** (2hr) Build expression evaluator | US-04 AC2
- RED: test `status=="success"`->true, `count>5`->false, `a&&b`->false, `!failed`->true, `items.length>=1`->true, invalid expr throws, disallowed constructs throw, undefined var->false
- GREEN: implement `evaluateExpression()` via AST parser in `expression-evaluator.ts`

## Phase 2: Engine Handlers

**T04** (2hr) `executeConditionNode()` | US-01 AC5/AC6
- RED: true expr follows trueBranch, false follows falseBranch, skipped branch gets "skipped", missing config throws
- GREEN: evaluate expr, store in `variables.__condition_<id>`, update `start()` dispatch; deps: T01,T03

**T05** (2hr) `executeForEachNode()` | US-02 AC4-AC7
- RED: 3-item array runs body 3x with iteration index+item in event log, item var injected, empty skips, maxIterations cap
- GREEN: read collection, run body nodes per item, exclude body from topo sort; deps: T04

**T06** (2hr) `executeSubWorkflowNode()` | US-03 AC5-AC7
- RED: loads child workflow, maps vars in/out, depth>3 throws, missing ID throws
- GREEN: create child engine, map variables, enforce depth limit; deps: T05

**T07** (1.5hr) Update `shouldExecuteNode()` for expressions | US-04 AC2/AC3
- RED: expression transition with true/false result allows/skips node, invalid expr skips safely
- GREEN: replace `case 'expression'` fall-through with `evaluateExpression()` call; deps: T03,T04

## Phase 3: Canvas Components

**T08** (1.5hr) `ConditionNodeComponent.tsx` diamond shape | US-01 AC2/AC4
- RED: renders diamond SVG, displays expression, two labeled handles (true/false), truncates long expr
- GREEN: custom ReactFlow node + register in ReactFlowCanvas/StudioCanvas; deps: T01

**T09** (1.5hr) `ForEachNodeComponent.tsx` loop badge | US-02 AC3
- RED: renders loop icon + collection var name, iteration badge during execution, dashed body border
- GREEN: custom ReactFlow node with overlay + register in ReactFlowCanvas/StudioCanvas; deps: T01

**T10** (1.5hr) `SubWorkflowNodeComponent.tsx` | US-03 AC4
- RED: renders nested-workflow icon, shows workflow name, mapping count badge, click navigates
- GREEN: custom ReactFlow node + register in ReactFlowCanvas/StudioCanvas; deps: T01

**T11** (1.5hr) Route control-flow blocks to config panels | US-01 AC3, US-02 AC2, US-03 AC2
- RED: selecting condition/forEach/subWorkflow renders correct config panel; edge expression field shown when type='expression'; invalid expression shows inline error
- GREEN: create three config panel components + routing in BlockConfigPanel; deps: T08-T10

**T12** (1hr) BlockPalette control-flow section | US-01/02/03 AC1
- RED: "Control Flow" header appears when phase>=3, three cards render, handleDrop creates control-flow node (no CLI spawner config) in StudioCanvas
- GREEN: add section divider + filter + handleDrop control-flow branch; deps: T01,T02

## Phase 4: Validation & Integration

**T13** (2hr) Control-flow validation | US-05 all AC
- RED: condition <2 edges warns, empty bodyNodeIds warns, non-existent subWf errors, circular ref errors
- GREEN: `workflow-validator.ts` with `validateWorkflow()`, called on save+start; deps: T04-T06

**T14** (2hr) Integration round-trip | US-01-05 integration
- RED/GREEN: condition branch workflow mock execution, forEach 3-item body, subWorkflow child completes, save/reload preserves structure, validation blocks bad config; deps: T07,T11-T13

## Summary

| Phase | Tasks | Hours |
|-------|-------|-------|
| 1: Types & evaluator | T01-T03 | 4.5 |
| 2: Engine handlers | T04-T07 | 7.5 |
| 3: Canvas components | T08-T12 | 7.0 |
| 4: Validation + integration | T13-T14 | 4.0 |
| **Total** | **14 tasks** | **23 + 5 buffer = 28** |
