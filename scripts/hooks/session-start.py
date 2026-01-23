#!/usr/bin/env python3
"""
SessionStart hook for CLI Agent Identity Enforcement.

This hook runs at the start of each Claude Code session to:
1. Check for the presence of an identity file
2. Inject context about the current role into the session

The identity file is created by the launcher scripts (start-backend.sh, etc.)
and persists across bash sessions within the Claude Code process.

Exit codes:
  0 - Success (context injected or warning shown)
  Non-zero - Error (but session continues)
"""

import json
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Find the project root by looking for .claude directory."""
    # Start from current working directory
    cwd = Path.cwd()

    # Check current directory and parents
    for path in [cwd] + list(cwd.parents):
        if (path / ".claude").is_dir():
            return path

    # Fallback to current directory
    return cwd


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


def main():
    project_root = get_project_root()
    identity_file = project_root / ".claude" / "instance-identity.json"

    # Check if identity file exists
    if not identity_file.exists():
        # No identity file - user didn't use launcher script
        print("=" * 50)
        print("  WARNING: No CLI Identity Found")
        print("=" * 50)
        print("")
        print("You started Claude Code without using a launcher script.")
        print("This means identity enforcement hooks cannot verify your role.")
        print("")
        print("To properly start a session, use one of these commands:")
        print("  ./start-backend.sh      # For backend development")
        print("  ./start-frontend.sh     # For frontend development")
        print("  ./start-orchestrator.sh # For review/merge operations")
        print("")
        print("Continuing without identity enforcement...")
        print("=" * 50)
        sys.exit(0)

    # Load identity configuration
    try:
        with open(identity_file) as f:
            identity = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"ERROR: Could not read identity file: {e}", file=sys.stderr)
        sys.exit(0)

    instance_id = identity.get("instance_id", "unknown")
    can_merge = identity.get("can_merge", False)
    can_modify_meta = identity.get("can_modify_meta", False)

    # Get current branch
    current_branch = get_current_branch()

    # Print session context
    print("=" * 50)
    print(f"  CLI Instance: {instance_id.upper()}")
    print("=" * 50)
    print("")

    if instance_id == "backend":
        print("Role: Backend Developer")
        print("Allowed: src/workers/, src/orchestrator/, src/infrastructure/")
        print("Forbidden: src/hitl_ui/, CLAUDE.md, docs/, contracts/")
    elif instance_id == "frontend":
        print("Role: Frontend Developer")
        print("Allowed: src/hitl_ui/, .workitems/P05-*")
        print("Forbidden: src/workers/, CLAUDE.md, docs/, contracts/")
    elif instance_id == "orchestrator":
        print("Role: Orchestrator (Master Agent)")
        print("Branch: main (exclusive write access)")
        print("Exclusive ownership: CLAUDE.md, docs/, contracts/, .claude/rules/")
        print("Can merge to main: Yes")

    print("")
    print(f"Current branch: {current_branch or '(detached HEAD)'}")

    print("")
    print("=" * 50)
    sys.exit(0)


if __name__ == "__main__":
    main()
