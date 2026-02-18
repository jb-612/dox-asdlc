#!/usr/bin/env python3
"""PreToolUse hook: enforces guardrails on tool calls.

Reads tool call info from stdin JSON, checks against cached guardrails,
and blocks or warns on violations.

Input (stdin JSON):
  {"tool": "Write", "arguments": {"file_path": "..."}, "sessionId": "session-abc"}

Block output (exit 2, reason to stderr):
  stderr: Guardrail violation: ...

Warning output (exit 0):
  {"additionalContext": "WARNING: ..."}

Clean pass (exit 0, no output).
"""

import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def read_cache(session_id: str) -> dict | None:
    """Read guardrails cache written by UserPromptSubmit hook."""
    cache_path = Path(tempfile.gettempdir()) / f"guardrails-{session_id}.json"
    try:
        data = json.loads(cache_path.read_text())
        # Check TTL
        ts = datetime.fromisoformat(data.get("timestamp", ""))
        ttl = data.get("ttl_seconds", 300)
        age = (datetime.now(timezone.utc) - ts.replace(tzinfo=timezone.utc)).total_seconds()
        if age > ttl:
            return None  # Cache expired
        return data.get("evaluated")
    except (FileNotFoundError, json.JSONDecodeError, KeyError, ValueError, OSError):
        return None


def sanitize_path(path: str) -> str | None:
    """Sanitize a file path. Returns None if path is unsafe."""
    if not path:
        return None
    # Normalize separators
    path = path.replace("\\", "/")
    # Reject directory traversal
    if ".." in path.split("/"):
        return None
    return path


def extract_paths_from_arguments(tool: str, arguments: dict) -> list[str]:
    """Extract file paths from tool arguments based on tool type."""
    paths = []
    # Common path fields
    for field in ["file_path", "path", "file", "directory"]:
        val = arguments.get(field)
        if val and isinstance(val, str):
            sanitized = sanitize_path(val)
            if sanitized:
                paths.append(sanitized)
    # For Bash tool, we don't try to parse commands for paths
    return paths


def check_tool_restriction(tool: str, evaluated: dict) -> tuple[str | None, bool]:
    """Check if tool is restricted.

    Returns (reason, is_mandatory).
    - (None, False) = no restriction
    - (reason, True) = mandatory block
    - (reason, False) = advisory warning
    """
    tools_denied = set(evaluated.get("tools_denied", []))
    tools_allowed = set(evaluated.get("tools_allowed", []))

    # Check explicit deny
    if tool in tools_denied:
        return f"Tool '{tool}' is denied by active guardrails", True

    # If there's an allow list and tool is not on it, warn (advisory)
    if tools_allowed and tool not in tools_allowed:
        return f"Tool '{tool}' is not in the allowed tools list", False

    return None, False


def check_path_restriction(paths: list[str], evaluated: dict) -> tuple[str | None, bool]:
    """Check if any paths violate restrictions.

    Returns (reason, is_mandatory).
    """
    # For now, path restrictions come from the combined instruction context
    # The actual path enforcement is done by checking tools_denied patterns
    # This is a placeholder for future path-specific enforcement
    return None, False


def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARNING: guardrails-enforce failed to parse input: {e}", file=sys.stderr)
        sys.exit(0)  # Fail-open

    tool = input_data.get("tool", "")
    arguments = input_data.get("arguments", {})
    session_id = input_data.get("sessionId", "unknown")

    # Read cached guardrails
    evaluated = read_cache(session_id)
    if not evaluated:
        print(f"INFO: No guardrails cache for session {session_id}, allowing tool '{tool}'", file=sys.stderr)
        sys.exit(0)  # Fail-open

    # Check path sanitization first
    paths = extract_paths_from_arguments(tool, arguments)
    for path_field in ["file_path", "path"]:
        raw_path = arguments.get(path_field, "")
        if raw_path and sanitize_path(raw_path) is None:
            # Unsafe path - block
            print(f"Path sanitization failed: '{raw_path}' contains directory traversal", file=sys.stderr)
            sys.exit(2)

    # Check tool restrictions
    reason, is_mandatory = check_tool_restriction(tool, evaluated)
    if reason:
        if is_mandatory:
            print(reason, file=sys.stderr)
            sys.exit(2)
        else:
            output = {"additionalContext": f"WARNING: {reason}"}
            print(json.dumps(output))
            sys.exit(0)

    # Clean pass
    sys.exit(0)


if __name__ == "__main__":
    main()
