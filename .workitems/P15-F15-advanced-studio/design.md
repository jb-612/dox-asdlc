---
id: P15-F15
parent_id: P15
type: design
version: 3
status: approved
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
dependencies: [P15-F01, P15-F11]
tags: [studio, workflow-engine, phase-3]
estimated_hours: 28
---

# Design: Advanced Studio (P15-F15)

## Overview

Adds Condition, ForEach, and SubWorkflow control-flow blocks, an expression evaluator, engine loop support, and canvas rendering. Control-flow nodes are NOT agents -- they use a discriminated `kind` field to separate concerns from agent execution.

## Type Changes (workflow.ts)

```typescript
export type BlockType = 'plan'|'dev'|'test'|'review'|'devops'|'condition'|'forEach'|'subWorkflow';
// AgentNode gains: kind: 'agent' | 'control' (default 'agent' for backward compat)
// New optional fields on AgentNodeConfig: conditionConfig?, forEachConfig?, subWorkflowConfig?
// WorkflowVariable.type gains 'array' option for ForEach collection variables
```

`ConditionConfig { expression, trueBranchNodeId, falseBranchNodeId }`. `ForEachConfig { collectionVariable, itemVariable, bodyNodeIds[], maxIterations? (default 100) }`. `SubWorkflowConfig { workflowId, inputMappings?, outputMappings? }`.

## Expression Evaluator (`src/main/services/expression-evaluator.ts`)

Sandboxed `evaluateExpression(expr, variables): boolean`. AST-based. Allowlist: `==, !=, <, >, <=, >=, &&, ||, !`, literals, variable refs, single-level property access (e.g. `items.length`). Deny `__proto__`, `constructor`, `prototype`. No `eval()`, no function calls, no assignment.

## Engine Changes (execution-engine.ts)

- **Condition**: evaluate expression, store in `variables.__condition_<id>`, mark chosen branch active.
- **ForEach**: Filter bodyNodeIds + their edges from main topo sort input. Compare sorted length against filtered node count (not total). Handler runs body nodes N times with item variable. `json`-typed variables validated as arrays at runtime.
- **SubWorkflow**: load child via `WorkflowFileService` (main process, same context). Create child ExecutionEngine, map variables in/out. Max depth 3. Circular refs detected via DFS with visited workflowId set.
- **shouldExecuteNode**: replace `expression` fall-through with `evaluateExpression()` call.
- **Dispatch**: check `node.config.blockType` -- control-flow types dispatch to new handlers instead of CLI spawner.

## Canvas Changes

`ReactFlowCanvas.tsx`: register `condition`, `forEach`, `subWorkflow` node types. `StudioCanvas.tsx`: `workflowNodesToReactFlow()` maps `kind==='control'` to appropriate ReactFlow type. `handleDrop` handles control-flow node kinds (no CLI spawner config).

## BLOCK_TYPE_METADATA

New `ControlFlowBlockMetadata` interface (no agentNodeType/systemPrompt/outputChecklist). Three entries added with `phase: 3`. `AVAILABLE_BLOCK_TYPES` filter updated for union type.

## File Changes

**New**: `expression-evaluator.ts`, `{Condition,ForEach,SubWorkflow}NodeComponent.tsx`, `{Condition,ForEach,SubWorkflow}ConfigPanel.tsx`, `workflow-validator.ts` + tests.
**Modified**: `workflow.ts`, `constants.ts`, `execution-engine.ts`, `BlockPalette.tsx`, `StudioCanvas.tsx`, `ReactFlowCanvas.tsx`, `BlockConfigPanel.tsx`.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Node discrimination | `kind: 'agent'\|'control'` | Avoids polluting agent metadata with control-flow |
| Expression property access | One level, deny proto | Security; `items.length` supported |
| ForEach topo sort | Filter body from sort input | Prevents false cycle detection |
| SubWorkflow resolution | Runtime via WorkflowFileService | Main process has access; no new IPC |

## Risks

| Risk | Mitigation |
|------|------------|
| Loop back-edges break topo sort | Filter body edges; compare against filtered count |
| Expression injection | AST evaluator, operator+property allowlist |
| Deep sub-workflow nesting | Max depth 3; DFS circular ref detection |
| Large ForEach collections | maxIterations cap; abort inside loops |
