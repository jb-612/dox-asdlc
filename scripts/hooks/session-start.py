#!/usr/bin/env python3
"""
SessionStart hook for Claude Code sessions.

This hook runs at the start of each Claude Code session to display
environment information. Identity is read from CLAUDE_INSTANCE_ID.
Role-specific behavior is handled by subagents (backend.md, frontend.md,
orchestrator.md).

Exit codes:
  0 - Success (context injected)
  Non-zero - Error (but session continues)
"""

import os
import subprocess
import sys


def get_current_branch() -> str:
    """Get the current git branch name."""
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout.strip()
    except Exception:
        return ""


def get_instance_id() -> str:
    """Get session identity from CLAUDE_INSTANCE_ID env var."""
    return os.environ.get("CLAUDE_INSTANCE_ID", "pm")


def record_session_start(instance_id: str, branch: str) -> None:
    """Record session start event to SQLite telemetry (best-effort)."""
    try:
        from src.infrastructure.hook_telemetry.sqlite_store import record_session_start as _record
        _record(instance_id=instance_id, branch=branch, cwd=os.getcwd())
    except Exception:
        pass  # SQLite store may not be available yet


def main():
    current_branch = get_current_branch()
    instance_id = get_instance_id()
    cwd = os.getcwd()

    print("startup hook success: " + "=" * 50)
    print("  aSDLC Development Session")
    print("=" * 50)
    print("")
    print(f"Instance: {instance_id}")
    print(f"Branch:   {current_branch or '(detached HEAD)'}")
    print(f"CWD:      {cwd}")
    print("")
    print("Invoke a subagent for role-specific work:")
    print("  - backend: workers, infrastructure, P01-P03/P06")
    print("  - frontend: HITL UI, React, P05")
    print("  - orchestrator: meta files, contracts, coordination")
    print("")
    print("=" * 50)

    # Record session start to telemetry (best-effort)
    record_session_start(instance_id, current_branch)

    sys.exit(0)


if __name__ == "__main__":
    main()
