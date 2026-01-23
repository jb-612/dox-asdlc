#!/usr/bin/env python3
"""
UserPromptSubmit hook for CLI Agent Identity Enforcement.

This hook runs before each user prompt is processed.
It does NOT block - identity selection is handled by Claude using AskUserQuestion.

The hook only provides information about the current identity state.

Exit codes:
  0 - Always allow (identity selection is interactive, not blocking)
"""

import subprocess
import sys

# Recognized CLI emails
RECOGNIZED_EMAILS = {
    "claude-backend@asdlc.local": "Backend-CLI",
    "claude-frontend@asdlc.local": "Frontend-CLI",
    "claude-orchestrator@asdlc.local": "Orchestrator-CLI",
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


def main():
    # Always allow - identity selection is handled interactively by Claude
    # The SessionStart hook signals when identity selection is needed
    # Claude will use AskUserQuestion to prompt the user
    sys.exit(0)


if __name__ == "__main__":
    main()
