#!/usr/bin/env python3
"""
File Restriction PreToolUse Hook (P15-F03, T20)

Container-side hook that enforces file restriction glob patterns on
Write/Edit tool invocations. Reads allowed patterns from the
FILE_RESTRICTIONS environment variable (JSON array of glob strings).

Exit codes:
  0  -- Allow the tool call
  2  -- Block the tool call (writes reason to stderr)

Behavior:
  - If FILE_RESTRICTIONS is empty or unset, all paths are allowed.
  - On PreToolUse for Write or Edit tools, checks if the target file_path
    matches any allowed pattern via fnmatch.
  - If no pattern matches, exits with code 2 (BLOCK).

Modeled on the project's existing guardrails-enforce.py hook.
"""

import json
import os
import sys
from fnmatch import fnmatch


def main() -> int:
    # Read the hook payload from stdin
    try:
        payload = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        # If we cannot parse input, allow through (fail-open)
        return 0

    tool_name = payload.get("tool", "")

    # Only enforce on Write and Edit tools
    if tool_name not in ("Write", "Edit"):
        return 0

    # Read file restrictions from environment
    restrictions_raw = os.environ.get("FILE_RESTRICTIONS", "")
    if not restrictions_raw.strip():
        # No restrictions configured -- allow all
        return 0

    try:
        restrictions = json.loads(restrictions_raw)
    except json.JSONDecodeError:
        # Malformed restrictions -- fail-open
        sys.stderr.write("WARNING: FILE_RESTRICTIONS env var is not valid JSON; allowing all\n")
        return 0

    if not isinstance(restrictions, list) or len(restrictions) == 0:
        # Empty restrictions list -- allow all
        return 0

    # Extract the target file path from tool arguments
    arguments = payload.get("arguments", {})
    file_path = arguments.get("file_path", "")

    if not file_path:
        # No file_path argument -- allow (might be a different tool variant)
        return 0

    # Check if the file path matches any allowed pattern
    for pattern in restrictions:
        if fnmatch(file_path, pattern):
            return 0

    # No pattern matched -- block
    sys.stderr.write(
        f"BLOCKED: {tool_name} on '{file_path}' does not match any allowed pattern: "
        f"{json.dumps(restrictions)}\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
