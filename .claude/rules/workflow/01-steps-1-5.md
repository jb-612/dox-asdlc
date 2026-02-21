# Steps 1-5: Workplan through Re-plan

## Step 1: Workplan

**Purpose:** PM CLI interprets user intent and drafts an overall plan for the work.

| Aspect | Details |
|--------|---------|
| Executor | PM CLI |
| Inputs | User request, project context |
| Outputs | High-level work plan with scope and dependencies |
| HITL Gates | None |

PM CLI identifies:
- What needs to be built or changed
- Which agents will be needed
- Rough sequencing and dependencies
- Potential blockers or risks

## Step 2: Planning

**Purpose:** Create formal work item artifacts that define the feature.

| Aspect | Details |
|--------|---------|
| Executor | Planner agent |
| Inputs | Work plan from Step 1 |
| Outputs | `.workitems/Pnn-Fnn-description/` with design.md, user_stories.md, tasks.md |
| HITL Gates | None |
| Skill | feature-planning |

The planner creates:
- `design.md` - Technical approach, interfaces, architecture decisions
- `user_stories.md` - User-facing requirements with acceptance criteria
- `tasks.md` - Atomic tasks scoped to less than 2 hours each

**Context gathering:** Use `ks_search` to find existing patterns before designing. This ensures consistency with the codebase.

**Auto-trigger:** diagram-builder skill is invoked automatically to create architecture diagrams when design.md is created.

## Step 3: Diagrams

**Purpose:** Create additional diagrams not auto-generated in Step 2.

| Aspect | Details |
|--------|---------|
| Executor | Planner or Orchestrator agent |
| Inputs | Design.md, explicit diagram requests |
| Outputs | Mermaid diagrams in `docs/diagrams/` |
| HITL Gates | None |
| Skill | diagram-builder |

Explicit diagram requests may include:
- Sequence diagrams for API flows
- State diagrams for complex workflows
- Data flow diagrams

## Step 4: Design Review

**Purpose:** Validate the design before implementation begins.

| Aspect | Details |
|--------|---------|
| Executor | Reviewer agent |
| Inputs | All planning artifacts from Steps 2-3 |
| Outputs | Review report with concerns or approval |
| HITL Gates | **Design Review Concerns** (advisory) |

If concerns are found, HITL gate presents:
```
Design review found [N] concerns:
 - [concern 1]
 - [concern 2]

Options:
 A) Address concerns before proceeding
 B) Proceed anyway (acknowledge concerns)
 C) Abort this task
```

## Step 5: Re-plan

**Purpose:** PM CLI assigns work to specific agents and plans execution strategy.

| Aspect | Details |
|--------|---------|
| Executor | PM CLI |
| Inputs | Approved design, tasks.md |
| Outputs | Agent assignments, multi-CLI strategy if needed |
| HITL Gates | **Complex Operation** (advisory) |

PM CLI determines:
- Which tasks go to backend vs frontend agents
- Whether multi-CLI coordination is needed
- If Chrome extension advisory should be triggered

**Advisory trigger:** If operation spans more than 10 files or crosses domains, PM CLI advises:
```
This operation is complex. Consider:
 - Opening a new CLI window with Claude Chrome extension
 - Running the [backend/frontend] portion there
 - Report back when complete
```
