#!/usr/bin/env python3
"""
SessionStart hook for CLI Agent Identity Enforcement.

This hook runs at the start of each Claude Code session to:
1. Check git config for a recognized CLI email
2. If no identity set, output a signal for Claude to prompt the user
3. If identity exists, display current role information

Identity is derived from git config user.email.

Exit codes:
  0 - Success (context injected or signal emitted)
  Non-zero - Error (but session continues)
"""

import subprocess
import sys

# Map git email to identity info
IDENTITY_INFO = {
    "claude-backend@asdlc.local": {
        "instance_id": "backend",
        "role": "Backend Developer",
        "allowed": "src/workers/, src/orchestrator/, src/infrastructure/",
        "forbidden": "src/hitl_ui/, CLAUDE.md, docs/, contracts/",
        "can_merge": False,
    },
    "claude-frontend@asdlc.local": {
        "instance_id": "frontend",
        "role": "Frontend Developer",
        "allowed": "src/hitl_ui/, .workitems/P05-*",
        "forbidden": "src/workers/, CLAUDE.md, docs/, contracts/",
        "can_merge": False,
    },
    "claude-orchestrator@asdlc.local": {
        "instance_id": "orchestrator",
        "role": "Orchestrator (Master Agent)",
        "allowed": "All files",
        "forbidden": "None",
        "can_merge": True,
    },
}


def get_git_email() -> str:
    """Get the current git user.email config."""
    try:
        result = subprocess.run(
            ["git", "config", "user.email"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout.strip()
    except Exception:
        return ""


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
    git_email = get_git_email()
    identity = IDENTITY_INFO.get(git_email)
    current_branch = get_current_branch()

    if not identity:
        # Signal for Claude to prompt user for role selection
        print("startup hook success: " + "=" * 50)
        print("  IDENTITY SELECTION REQUIRED")
        print("=" * 50)
        print("")
        print("No CLI agent role is configured for this session.")
        print("Claude will prompt you to select your role.")
        print("")
        print(f"Current branch: {current_branch or '(detached HEAD)'}")
        print("=" * 50)
        sys.exit(0)

    instance_id = identity["instance_id"]

    # Print session context for established identity
    print("startup hook success: " + "=" * 50)
    print(f"  CLI Instance: {instance_id.upper()}")
    print("=" * 50)
    print("")

    print(f"Role: {identity['role']}")
    if instance_id == "orchestrator":
        print("Branch: main (exclusive write access)")
        print("Exclusive ownership: CLAUDE.md, docs/, contracts/, .claude/rules/")
        print("Can merge to main: Yes")
    else:
        print(f"Allowed: {identity['allowed']}")
        print(f"Forbidden: {identity['forbidden']}")

    print("")
    print(f"Current branch: {current_branch or '(detached HEAD)'}")

    print("")
    print("=" * 50)
    sys.exit(0)


if __name__ == "__main__":
    main()
