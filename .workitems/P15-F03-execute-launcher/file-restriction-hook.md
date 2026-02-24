# File Restriction Hook — Container-Side Enforcement Design

**Status:** Draft
**Date:** 2026-02-22
**Author:** Planner
**Addresses:** Decision 4 (Architect Synthesis), MT-8
**Features:** F03, F05

---

## Overview

This document designs a container-side PreToolUse hook that enforces file restriction
patterns inside agent containers. The product owner requirement is: "sets restrictions
via rules to work only on specific chunk of files." A system prompt instruction alone
is a soft restriction that an LLM may ignore. This hook provides hard, deterministic
enforcement.

The hook is modeled on the existing `guardrails-enforce.py` pattern from `.claude/hooks/`.

---

## Three-Layer Enforcement Model

File restrictions are enforced at three layers, each progressively harder:

| Layer | Mechanism | Strength | Implementation |
|-------|-----------|----------|----------------|
| 1. System prompt | `"Only modify files matching: [patterns]"` appended to system prompt | **Soft** — LLM may ignore | Already designed in F03 (ADR-4) |
| 2. PreToolUse hook | `file-restriction-hook.py` blocks tool calls at the Claude Code hook level | **Hard** — deterministic Python check | NEW (this design) |
| 3. Docker bind mount | Mount only allowed subdirectories instead of entire repo | **Hardest** — OS-level enforcement | Future (deferred) |

Layer 2 (this design) is the minimum viable hard enforcement. It runs inside the
container alongside the Claude CLI agent and intercepts every Write/Edit tool call.

---

## Hook Design: `file-restriction-hook.py`

### Location

```
scripts/hooks/file-restriction-hook.py
```

This file lives in the host repository and is bind-mounted into containers at:
```
/home/user/.claude/hooks/file-restriction-hook.py
```

### Trigger

Registered as a `PreToolUse` hook in the container's `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "python3 /home/user/.claude/hooks/file-restriction-hook.py"
      }
    ]
  }
}
```

The hook fires on every `Write` and `Edit` tool invocation.

### Input (stdin)

Claude Code passes the tool call as JSON on stdin:

```json
{
  "tool": "Write",
  "arguments": {
    "file_path": "/workspace/src/workers/pool.ts",
    "content": "..."
  },
  "sessionId": "session-12345"
}
```

For `Edit` tool:
```json
{
  "tool": "Edit",
  "arguments": {
    "file_path": "/workspace/src/workers/pool.ts",
    "old_string": "...",
    "new_string": "..."
  },
  "sessionId": "session-12345"
}
```

### Logic

```python
#!/usr/bin/env python3
"""
Container-side PreToolUse hook that enforces file restriction patterns.

Reads FILE_RESTRICTIONS environment variable (JSON array of glob patterns).
Blocks Write/Edit tool calls to files outside the allowed patterns.

Exit codes:
  0 — Allow the tool call
  2 — Block the tool call (reason on stderr)
"""

import json
import os
import sys
from fnmatch import fnmatch
from pathlib import PurePosixPath


def normalize_path(file_path: str, workspace: str = "/workspace") -> str:
    """Normalize file_path to a relative path from workspace root."""
    path = file_path
    # Strip workspace prefix if present
    if path.startswith(workspace):
        path = path[len(workspace):]
    # Strip leading slash
    path = path.lstrip("/")
    return path


def matches_any_pattern(rel_path: str, patterns: list[str]) -> bool:
    """Check if rel_path matches any of the glob patterns."""
    for pattern in patterns:
        # Normalize pattern (strip leading slash or ./)
        norm_pattern = pattern.lstrip("./")
        if fnmatch(rel_path, norm_pattern):
            return True
        # Also check parent directories for ** patterns
        # e.g., "src/workers/**" should match "src/workers/pool.ts"
        if "**" in norm_pattern:
            # fnmatch doesn't handle ** natively; use pathlib matching
            if PurePosixPath(rel_path).match(norm_pattern):
                return True
    return False


def main():
    # Read file restrictions from environment
    restrictions_json = os.environ.get("FILE_RESTRICTIONS", "[]")
    try:
        patterns = json.loads(restrictions_json)
    except json.JSONDecodeError:
        # If env var is malformed, fail open (allow)
        sys.exit(0)

    # Empty patterns = unrestricted
    if not patterns:
        sys.exit(0)

    # Read tool call from stdin
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        # Can't parse input — fail open
        sys.exit(0)

    tool = payload.get("tool", "")
    arguments = payload.get("arguments", {})

    # Only enforce on Write and Edit
    if tool not in ("Write", "Edit"):
        sys.exit(0)

    file_path = arguments.get("file_path", "")
    if not file_path:
        sys.exit(0)

    # Reject directory traversal
    if ".." in file_path:
        print(
            f"File restriction: path contains directory traversal: {file_path}",
            file=sys.stderr,
        )
        sys.exit(2)

    # Normalize to relative path
    rel_path = normalize_path(file_path)

    # Check against patterns
    if matches_any_pattern(rel_path, patterns):
        # Allowed
        sys.exit(0)
    else:
        # Blocked
        print(
            f"File restriction: {rel_path} is outside allowed patterns: {patterns}",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
```

### Exit Codes

| Code | Meaning | Behavior |
|------|---------|----------|
| 0 | Allow | Tool call proceeds normally |
| 2 | Block | Tool call is rejected; stderr message shown to agent |

### Pattern Matching

The hook uses Python's `fnmatch` module with `PurePosixPath.match()` fallback for
`**` glob patterns:

| Pattern | Matches | Does Not Match |
|---------|---------|----------------|
| `src/workers/**` | `src/workers/pool.ts`, `src/workers/sub/deep.ts` | `src/core/utils.ts` |
| `src/**/*.ts` | `src/workers/pool.ts`, `src/core/utils.ts` | `docs/README.md` |
| `*.md` | `README.md` | `src/README.md` (no path prefix) |
| `docker/**` | `docker/Dockerfile`, `docker/compose.yml` | `src/docker.ts` |

### Fail-Open Behavior

The hook fails open (allows the tool call) when:
- `FILE_RESTRICTIONS` environment variable is missing or empty
- `FILE_RESTRICTIONS` contains invalid JSON
- stdin payload cannot be parsed
- Tool is not Write or Edit

This matches the fail-open philosophy of the existing guardrails hooks.

---

## Integration with Container Lifecycle

### Container Creation (`ContainerPool.createContainer()`)

When F05's `ContainerPool` creates a container, it must:

1. Set the `FILE_RESTRICTIONS` environment variable from `RepoMount.fileRestrictions`:

```typescript
const env = [
  `WORKFLOW_ID=${workflowId}`,
  `NODE_ID=${nodeId}`,
  `FILE_RESTRICTIONS=${JSON.stringify(repoMount.fileRestrictions ?? [])}`,
  // ... other env vars from agent-contract.md
];
```

2. Bind-mount the hook script and a container-specific `.claude/settings.json`:

```typescript
const binds = [
  `${repoMount.localPath}:/workspace`,
  `${hookScriptPath}:/home/user/.claude/hooks/file-restriction-hook.py:ro`,
  `${containerSettingsPath}:/home/user/.claude/settings.json:ro`,
];
```

### Container Settings File

A generated `.claude/settings.json` is written to a temp directory and bind-mounted
into each container. It registers the file restriction hook:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "python3 /home/user/.claude/hooks/file-restriction-hook.py"
      }
    ]
  }
}
```

If the telemetry hook is also needed (F07), it is added to the same settings file:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "python3 /home/user/.claude/hooks/file-restriction-hook.py"
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "command": "python3 /home/user/.claude/hooks/docker-telemetry-hook.py"
      }
    ]
  }
}
```

### F03 Execute Launcher Integration

F03's `EXECUTION_START` handler passes `RepoMount.fileRestrictions` through to the
execution engine:

```typescript
// execution-handlers.ts
const startPayload = {
  workflowId,
  workflow,
  repoMount: {
    source: 'local',
    localPath: '/Users/dev/myproject',
    fileRestrictions: ['src/workers/**', 'src/core/**'],
  },
};
```

The execution engine reads `fileRestrictions` and:
1. Passes them as `FILE_RESTRICTIONS` env var to containers (Layer 2)
2. Appends the soft restriction to the system prompt (Layer 1)

---

## Testing Strategy

### Unit Tests

Test `file-restriction-hook.py` directly:

```python
# test_file_restriction_hook.py

def test_allow_matching_path():
    """Path matching a restriction pattern should be allowed (exit 0)."""

def test_block_non_matching_path():
    """Path outside restriction patterns should be blocked (exit 2)."""

def test_empty_restrictions_allows_all():
    """No restrictions configured should allow all paths."""

def test_directory_traversal_blocked():
    """Paths with '..' should always be blocked."""

def test_glob_double_star():
    """'src/workers/**' should match deeply nested files."""

def test_malformed_env_var_fails_open():
    """Invalid JSON in FILE_RESTRICTIONS should fail open."""

def test_missing_file_path_allows():
    """Tool call without file_path should be allowed."""
```

### Integration Tests

Test the full flow: container creation -> hook registration -> tool call blocking:

1. Create a container with `FILE_RESTRICTIONS=["src/**"]`
2. Attempt to write to `src/foo.ts` -> should succeed
3. Attempt to write to `docs/bar.md` -> should be blocked
4. Verify blocked message appears in agent output

---

## File Structure

```
scripts/hooks/
└── file-restriction-hook.py              # NEW: container-side PreToolUse hook

apps/workflow-studio/src/main/
├── services/
│   └── container-pool.ts                 # MODIFY: add FILE_RESTRICTIONS env var + hook bind mount
└── utils/
    └── container-settings-generator.ts   # NEW: generates per-container .claude/settings.json

apps/workflow-studio/test/main/
└── file-restriction-hook.test.ts         # NEW: unit tests for hook logic
```

---

## Security Considerations

1. **Directory traversal:** The hook explicitly rejects paths containing `..`
2. **Bind mount is read-only:** The hook script is mounted `:ro` so agents cannot modify it
3. **Fail-open:** If the hook itself fails, the tool call is allowed. This prevents
   hook bugs from blocking all work. The system prompt (Layer 1) still provides guidance.
4. **No shell injection:** The hook reads JSON from stdin; no shell command construction.
5. **Pattern validation:** Patterns come from the UI via `RepoMount.fileRestrictions`,
   which is validated by the execution handlers before being passed to containers.
