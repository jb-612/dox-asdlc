# Feature Planning Skill

## Description

This skill guides the creation of complete planning artifacts for a feature work item. Use this skill when creating a new feature folder in `.workitems/` or when completing incomplete planning documents.

## When to Use

Use this skill when:
- Creating a new feature work item
- Completing a `design.md` file
- Completing a `user_stories.md` file
- Completing a `tasks.md` file
- Validating planning completeness before implementation

## Planning Artifacts

### 1. Design Document (design.md)

The design document captures technical decisions and implementation approach.

**Required Sections:**

```markdown
# Feature Design: {Pnn-Fnn} {Feature Name}

## Overview
Brief description of what this feature implements and why.

## Dependencies
- List features this depends on (e.g., P01-F01 must be complete)
- List external dependencies (libraries, services)

## Interfaces

### Provided Interfaces
Interfaces this feature exposes to other components.

### Required Interfaces  
Interfaces this feature consumes from other components.

## Technical Approach
How the feature will be implemented. Include:
- Key classes/modules
- Data flow
- Error handling strategy

## File Structure
```
src/path/to/feature/
├── __init__.py
├── core.py
├── interfaces.py
└── tests/
    └── test_core.py
```

## Open Questions
Questions that need resolution before or during implementation.

## Risks
Technical risks and mitigation strategies.
```

### 2. User Stories (user_stories.md)

User stories define success criteria and acceptance tests.

**Required Sections:**

```markdown
# User Stories: {Pnn-Fnn} {Feature Name}

## US-{nn}: {Story Title}

**As a** {role}  
**I want** {capability}  
**So that** {benefit}

### Acceptance Criteria

- [ ] Criterion 1: Specific, measurable outcome
- [ ] Criterion 2: Specific, measurable outcome

### Test Scenarios

1. **Scenario**: {description}
   - Given: {precondition}
   - When: {action}
   - Then: {expected result}

---

## US-{nn}: {Next Story}
...
```

### 3. Task Breakdown (tasks.md)

Tasks are atomic units of work, each completable in under 2 hours.

**Required Sections:**

```markdown
# Tasks: {Pnn-Fnn} {Feature Name}

## Progress

- Started: {date or "Not started"}
- Tasks Complete: 0/{total}
- Percentage: 0%
- Status: NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETE
- Blockers: None

## Task List

### T01: {Task description}
- [ ] Estimate: {30min | 1hr | 2hr}
- [ ] Tests: {test file or "N/A"}
- [ ] Dependencies: {T00 or "None"}
- [ ] Notes: {implementation hints}

### T02: {Next task}
...

## Completion Checklist

- [ ] All tasks marked complete
- [ ] All unit tests pass
- [ ] E2E tests pass
- [ ] Linter passes
- [ ] Documentation updated
- [ ] Interfaces verified
- [ ] Progress: 100%
```

## Validation Checklist

Before implementation begins, verify:

1. **Design completeness**
   - [ ] Overview explains the feature purpose
   - [ ] All dependencies are listed and available
   - [ ] Interfaces are defined with signatures
   - [ ] Technical approach is clear
   - [ ] File structure is specified

2. **User stories completeness**
   - [ ] At least one user story exists
   - [ ] Each story has acceptance criteria
   - [ ] Acceptance criteria are testable
   - [ ] Test scenarios are defined

3. **Tasks completeness**
   - [ ] All work is broken into tasks
   - [ ] Each task is < 2 hours
   - [ ] Task dependencies are explicit
   - [ ] Estimates are provided
   - [ ] Progress section is initialized

## Example Usage

To create a new feature:

```bash
# 1. Create the folder structure
mkdir -p .workitems/P01-F02-bash-tools

# 2. Create design.md
# 3. Create user_stories.md  
# 4. Create tasks.md

# 5. Validate completeness
./scripts/check-planning.sh P01-F02-bash-tools
```
