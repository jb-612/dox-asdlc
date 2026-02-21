# P14-F01: Shared Types & Validation Schemas

**Version:** 1.0
**Date:** 2026-02-21
**Status:** COMPLETE

## Overview

Establishes all TypeScript type definitions, Zod validation schemas, IPC channel constants, and graph utility functions for the Electron Workflow Studio. This is the pure type-safety foundation -- no runtime code, no UI, no Electron. All other P14 features depend on these contracts.

## Architecture

This feature produces shared code consumed by both the Electron main process and the renderer process:

```
src/shared/
  types/
    workflow.ts      -- WorkflowDefinition, AgentNode, Transition, HITLGateDefinition
    execution.ts     -- Execution, ExecutionStatus, NodeExecutionState, ExecutionEvent
    workitem.ts      -- WorkItemType, WorkItemReference, WorkItemSource, WorkItem
    cli.ts           -- CLISpawnConfig, CLISession
  ipc-channels.ts    -- IPC channel constants (WORKFLOW_SAVE, CLI_SPAWN, etc.)
  constants.ts       -- Node type metadata (colors, labels, icons)

src/main/schemas/
  workflow-schema.ts -- Zod schema mirroring WorkflowDefinition
  execution-schema.ts -- Zod schema mirroring ExecutionConfig

src/renderer/utils/
  graph-utils.ts     -- Topological sort, cycle detection, reachability
  validation.ts      -- 8 workflow validation rules
```

## Key Interfaces

### WorkflowDefinition
Top-level workflow model persisted as JSON. Contains nodes (AgentNode[]), edges (Transition[]), gates (HITLGateDefinition[]), and variables (WorkflowVariable[]).

### AgentNode
Canvas node with type (planner, backend, frontend, reviewer, etc.), position, config (model, max_turns, tools, system_prompt), and input/output ports.

### Execution
Runtime execution state: workflow reference, work item, node states map, event history, status (pending/running/paused_gate/paused_user/completed/failed/aborted).

### IPC Channels
Constants for all IPC communication: workflow CRUD, work item operations, CLI spawner, execution control, Redis events, system dialogs.

## Dependencies

- None (this is the foundation feature)

## Status

**COMPLETE** -- All 5 tasks (T01-T05) implemented in earlier phases.
