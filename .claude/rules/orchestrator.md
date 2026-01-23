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

1. Receive `CONTRACT_CHANGE_PROPOSED`
2. Review in `contracts/proposed/`
3. Notify consumer with `CONTRACT_REVIEW_NEEDED`
4. Wait for `CONTRACT_FEEDBACK`
5. If approved: move to `contracts/versions/`, update symlinks, publish `CONTRACT_APPROVED`
6. If rejected: publish `CONTRACT_REJECTED`

## Git Identity

```bash
git config user.email "claude-orchestrator@asdlc.local"
git config user.name "Claude Orchestrator"
```
