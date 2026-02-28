---
name: feature-planning
description: Creates complete planning artifacts for a feature work item. Use when creating a new feature in .workitems/ or completing planning documents (design.md, user_stories.md, tasks.md).
---

Create planning artifacts for feature $ARGUMENTS:

## Step 1: Create Feature Folder from Templates

```bash
mkdir -p .workitems/$ARGUMENTS
cp .workitems/_templates/*.md .workitems/$ARGUMENTS/
```

Or use: `./scripts/new-feature.sh PNN FNN "name"`

See `.workitems/README.md` for naming conventions and rules.

## Step 2: Fill in design.md

Start from the template. Include:
- **Overview**: What the feature implements and why
- **Dependencies**: Features this depends on, external dependencies
- **Interfaces**: Provided and required interfaces with signatures
- **Technical Approach**: Key classes, data flow, error handling
- **File Structure**: Directory layout for the feature
- **Design Decisions**: Choices made and rationale
- **Risks**: Technical risks and mitigations

Update YAML frontmatter: set `id`, `parent_id`, `dependencies`, `tags`, timestamps.

## Step 3: Fill in user_stories.md

For each user story include:
- **As a** {role} **I want** {capability} **So that** {benefit}
- **Acceptance Criteria**: Specific, testable outcomes
- **Test Scenarios**: Given/When/Then format

## Step 4: Fill in tasks.md

Break work into atomic tasks (each < 2 hours):
- Each task produces one testable behavior change
- Include: estimate, test file path, dependencies, implementation hints
- Add dependency graph showing task ordering
- Add summary table with phase groupings

## Step 5: Update PLAN.md

Add the new feature to `.workitems/PLAN.md`:
- Add `[ ] FNN feature-name` under the appropriate project section
- Update the project's feature count in the index table

## Size Check

**Every file must be <= 100 lines.** If any file exceeds this:
- The feature scope is too large — split into sub-features
- Create separate PNN-FNN folders for each sub-feature
- Link them via dependencies in YAML frontmatter

## Validation Checklist

Before implementation begins, verify:
- [ ] All 3 files populated (design.md, user_stories.md, tasks.md)
- [ ] YAML frontmatter complete with correct id and dependencies
- [ ] Overview explains feature purpose
- [ ] Interfaces defined with signatures
- [ ] Each task is < 2 hours and testable
- [ ] Dependency graph included in tasks.md
- [ ] PLAN.md updated with new feature entry
- [ ] All files <= 100 lines

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `new-feature.sh` | Create work item from templates | `./scripts/new-feature.sh P01 F02 "name"` |
| `check-planning.sh` | Validate planning completeness | `./scripts/check-planning.sh P01-F02-name` |

## Cross-References

- `@tdd-execution` — Implement tasks after planning
- `@diagram-builder` — Create architecture diagrams during planning
- `.workitems/README.md` — Naming conventions and rules
- `.workitems/_templates/` — Template files
