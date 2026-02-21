---
description: Orchestrator CLI rules - coordinator with exclusive meta file ownership
paths:
  - CLAUDE.md
  - README.md
  - docs/**
  - contracts/**
  - .claude/rules/**
  - .claude/skills/**
---

# Orchestrator Rules

The orchestrator has **EXCLUSIVE** ownership of meta files.

## Exclusive Files

| Category | Files |
|----------|-------|
| Project Config | `CLAUDE.md`, `README.md` |
| Rules | `.claude/rules/**` |
| Skills | `.claude/skills/**` |
| Docs | `docs/**` |
| Contracts | `contracts/**` |

**Feature CLIs cannot modify these files.** They must send `META_CHANGE_REQUEST`:
```bash
./scripts/coordination/publish-message.sh META_CHANGE_REQUEST "file" "description" --to orchestrator
```

## Build Monitoring

At session start:
1. Run `./tools/test.sh`
2. If failing, identify breaking commit
3. Notify with `BUILD_BROKEN` message
4. Use revert authority if author unavailable

## Contract Workflow

See `@contract-update` skill for the full contract change procedure.
Orchestrator receives `CONTRACT_CHANGE_PROPOSED` and follows the skill's step-by-step process.

## Git Identity

```bash
git config user.email "claude-orchestrator@asdlc.local"
git config user.name "Claude Orchestrator"
```
