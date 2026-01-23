#!/usr/bin/env python3
"""
UserPromptSubmit hook for CLI Agent Identity Enforcement.

This hook runs before each user prompt is processed to:
1. Verify an identity file exists (launcher was used)
2. BLOCK the prompt if no identity is found

Blocking mechanism:
  - Output JSON: {"decision": "block", "reason": "..."}
  - Exit 0 to block the prompt with the given reason

Exit codes:
  0 - Always (either allow or block via JSON output)
"""

import json
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Find the project root by looking for .claude directory."""
    cwd = Path.cwd()
    for path in [cwd] + list(cwd.parents):
        if (path / ".claude").is_dir():
            return path
    return cwd


def block(reason: str):
    """Block the prompt with the given reason."""
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


def allow():
    """Allow the prompt to proceed."""
    # Output nothing, just exit 0
    sys.exit(0)


def main():
    project_root = get_project_root()
    identity_file = project_root / ".claude" / "instance-identity.json"

    # Check: Identity file must exist
    if not identity_file.exists():
        block(
            "NO LAUNCHER USED\n\n"
            "You must start Claude Code using a launcher script:\n"
            "  ./start-backend.sh      # For backend development\n"
            "  ./start-frontend.sh     # For frontend development\n"
            "  ./start-orchestrator.sh # For review/merge operations\n\n"
            "Please exit and restart using the appropriate launcher."
        )

    # Load identity configuration (validate file is readable)
    try:
        with open(identity_file) as f:
            identity = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        block(f"IDENTITY FILE CORRUPT\n\nCould not read identity file: {e}\n\nRestart using a launcher script.")

    # Identity file exists and is valid - allow prompt
    allow()


if __name__ == "__main__":
    main()
