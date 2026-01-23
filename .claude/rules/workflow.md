---
description: Core development workflow rules for feature implementation
---

# Development Workflow

**IMPORTANT: YOU MUST follow this workflow for all feature work.**

## Planning Gate

BEFORE writing any code:
1. Work item folder exists: `.workitems/Pnn-Fnn-description/`
2. All three files complete: `design.md`, `user_stories.md`, `tasks.md`
3. Each task scoped to < 2 hours

**If planning incomplete, STOP and complete it first.**

## TDD Execution

For each task:
1. **RED**: Write failing test
2. **GREEN**: Minimal code to pass
3. **REFACTOR**: Clean up while green
4. Mark `[x]` in tasks.md only after tests pass

**Never proceed to next task with failing tests.**

## Feature Completion

A feature is complete when:
- All tasks marked `[x]` in tasks.md
- `./tools/test.sh` passes
- `./tools/lint.sh` passes
- Progress shows 100%

## Commit Protocol

Commit to main when feature reaches 100%:
```
feat(Pnn-Fnn): description

- Implements {summary}
- Tests: {count} unit, {count} integration

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Never leave completed features uncommitted.**
