---
name: feature-planning
description: Creates complete planning artifacts for a feature work item. Use when creating a new feature in .workitems/ or completing planning documents (design.md, user_stories.md, tasks.md).
---

Create planning artifacts for feature $ARGUMENTS:

## Step 1: Create Feature Folder

```bash
mkdir -p .workitems/$ARGUMENTS
```

## Step 2: Create design.md

Include these sections:
- **Overview**: What the feature implements and why
- **Dependencies**: Features this depends on, external dependencies
- **Interfaces**: Provided and required interfaces with signatures
- **Technical Approach**: Key classes, data flow, error handling
- **File Structure**: Directory layout for the feature
- **Risks**: Technical risks and mitigations

## Step 3: Create user_stories.md

For each user story include:
- **As a** {role} **I want** {capability} **So that** {benefit}
- **Acceptance Criteria**: Specific, testable outcomes
- **Test Scenarios**: Given/When/Then format

## Step 4: Create tasks.md

Break work into atomic tasks (each < 2 hours):

```markdown
## Progress
- Started: {date}
- Tasks Complete: 0/{total}
- Percentage: 0%
- Status: NOT_STARTED

### T01: {Task description}
- [ ] Estimate: {30min | 1hr | 2hr}
- [ ] Tests: {test file path}
- [ ] Dependencies: {T00 or "None"}
- [ ] Notes: {implementation hints}
```

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `new-feature.sh` | Create work item with templates | `./scripts/new-feature.sh P01 F02 "name"` |
| `check-planning.sh` | Validate planning completeness | `./scripts/check-planning.sh P01-F02-name` |

## Validation Checklist

Before implementation begins, verify:
- [ ] Overview explains feature purpose
- [ ] All dependencies listed and available
- [ ] Interfaces defined with signatures
- [ ] Each task is < 2 hours and testable
- [ ] Progress section initialized

## Cross-References

- `@tdd-execution` — Implement tasks after planning
- `@diagram-builder` — Create architecture diagrams during planning
