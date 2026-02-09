---
name: feature-planning
description: Creates complete planning artifacts for a feature work item. Use when creating a new feature in .workitems/ or completing planning documents (design.md, user_stories.md, tasks.md).
---

Create planning artifacts for feature $ARGUMENTS:

## Step 1: Create Feature Folder

```bash
mkdir -p .workitems/$ARGUMENTS
```

## Step 1.5: Initialize YAML Front-Matter

All spec files must include YAML front-matter for machine-readable metadata. Use this template:

```yaml
---
id: Pnn-Fnn
parent_id: Pnn
type: [prd | design | user_stories | tasks]
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "[ISO-8601 timestamp]"
updated_at: "[ISO-8601 timestamp]"
dependencies: []
tags: []
---
```

Fields:
- `id`: Match the work item ID (e.g., P12-F05)
- `parent_id`: The parent epic (e.g., P12)
- `type`: File type (must match the file)
- `version`: Start at 1, increment on material changes
- `status`: Start as `draft`, transitions to `reviewed` then `approved`
- `dependencies`: List feature IDs this depends on
- `tags`: Freeform tags for search

## Step 1.75: Create prd.md (Recommended)

Include these sections:
- **Business Intent**: What business problem does this solve?
- **Success Metrics**: How do we measure success?
- **User Impact**: Who is affected and how?
- **Scope**: In Scope and Out of Scope
- **Constraints**: Business, regulatory, or technical constraints
- **Acceptance Criteria**: High-level criteria for feature completion

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

## Validation Checklist

Before implementation begins, verify:
- [ ] Overview explains feature purpose
- [ ] All dependencies listed and available
- [ ] Interfaces defined with signatures
- [ ] Each task is < 2 hours and testable
- [ ] Progress section initialized
