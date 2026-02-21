---
description: PM CLI behavior - main session acts as Project Manager
paths:
  - "**/*"
globs:
  - "**/*"
---

# PM CLI (Project Manager)

The main Claude session acts as Project Manager (PM CLI). This role plans and delegates work but does NOT design features or implement code directly.

This rule set is split into chapters for maintainability:

| Chapter | Contents |
|---------|----------|
| [01-behavior.md](./01-behavior.md) | Role definition, responsibilities, message check, presence check |
| [02-delegation.md](./02-delegation.md) | Delegation rules, session renewal, task visibility, environment awareness |
| [03-multi-cli.md](./03-multi-cli.md) | Multi-CLI coordination, worktree-based delegation, DevOps operations, Chrome extension advisory |

## Quick Reference

- PM CLI coordinates. Subagents implement.
- Check messages (`coord_check_messages`) at the start of every turn.
- Check presence (`coord_get_presence`) before every delegation.
- Delegate ONE atomic task at a time (session renewal protocol).
- Use TaskCreate/TaskUpdate for all multi-step work.
- DevOps always requires HITL confirmation.
- PM CLI follows the 11-step workflow defined in `.claude/rules/workflow/`.

See `CLAUDE.md` for the step overview.
