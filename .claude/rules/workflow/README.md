---
description: 11-step development workflow with HITL gates
paths:
  - "**/*"
---

# Development Workflow

The PM CLI orchestrates work through 11 sequential steps. Each step has clear entry/exit criteria and HITL gates at specific points. This workflow ensures quality, traceability, and human oversight.

**IMPORTANT: YOU MUST follow this workflow for all feature work.**

## Overview

```
 1. Workplan         -> PM CLI drafts plan
 2. Planning         -> Planner creates work items
                        |-> diagram-builder (auto) for architecture
 3. Diagrams         -> Explicit diagram requests if needed
 4. Design Review    -> Reviewer validates
                        |-> HITL if concerns found
 5. Re-plan          -> PM CLI assigns scopes, considers multi-CLI
                        |-> Advisory: Chrome extension for complex ops
 6. Parallel Build   -> Backend/Frontend (atomic tasks)
                        |-> Permission forwarding if blocked
 7. Testing          -> Unit/integration tests
                        |-> HITL if failures > 3
 8. Review           -> Reviewer inspects, issues created
 9. Orchestration    -> Orchestrator runs E2E
                        |-> HITL for protected path commits
10. DevOps           -> PM CLI coordinates (HITL required)
                        |-> Local / Separate CLI / Instructions
11. Closure          -> PM CLI summarizes, closes issues
```

## Chapters

- [Steps 1-5: Workplan through Re-plan](./01-steps-1-5.md)
- [Steps 6-9: Parallel Build through Orchestration](./02-steps-6-9.md)
- [Steps 10-11: DevOps, Closure, and Cross-Cutting Concerns](./03-steps-10-11.md)
