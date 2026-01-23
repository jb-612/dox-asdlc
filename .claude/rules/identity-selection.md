# Identity Selection at Session Start

## When to Trigger

When you see `IDENTITY SELECTION REQUIRED` in the SessionStart hook output, you MUST immediately prompt the user to select their agent role before doing any other work.

## How to Select Identity

Use the `AskUserQuestion` tool with this configuration:

```json
{
  "questions": [{
    "question": "Which agent role do you want to use for this session?",
    "header": "Agent Role",
    "multiSelect": false,
    "options": [
      {
        "label": "Orchestrator",
        "description": "Master agent: review code, merge to main, modify docs/contracts/rules"
      },
      {
        "label": "Backend",
        "description": "Backend developer: workers, orchestrator service, infrastructure"
      },
      {
        "label": "Frontend",
        "description": "Frontend developer: HITL UI, React components"
      }
    ]
  }]
}
```

## After User Selection

Based on the user's choice, immediately set the git config:

**Orchestrator:**
```bash
git config user.email "claude-orchestrator@asdlc.local"
git config user.name "Claude Orchestrator"
```

**Backend:**
```bash
git config user.email "claude-backend@asdlc.local"
git config user.name "Claude Backend"
```

**Frontend:**
```bash
git config user.email "claude-frontend@asdlc.local"
git config user.name "Claude Frontend"
```

Then confirm the identity is set and show the user their permissions.

## Role Permissions Summary

| Role | Can Modify | Cannot Modify | Can Merge to Main |
|------|------------|---------------|-------------------|
| Orchestrator | All files | - | Yes |
| Backend | src/workers/, src/orchestrator/, src/infrastructure/, .workitems/P01-P03,P06 | src/hitl_ui/, docs/, contracts/, CLAUDE.md | No |
| Frontend | src/hitl_ui/, docker/hitl-ui/, .workitems/P05-* | src/workers/, docs/, contracts/, CLAUDE.md | No |

## Changing Identity Mid-Session

If the user needs to switch roles, they can ask to "change agent role" or "switch to backend/frontend/orchestrator". Use the same AskUserQuestion flow to re-select.
