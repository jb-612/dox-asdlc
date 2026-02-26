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

import fnmatch
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


# Agent path restrictions: map agent role to allowed path patterns.
# Agents may only write/edit files matching these patterns.
_AGENT_PATH_RULES: dict[str, list[str]] = {
    "backend": [
        "src/workers/*",
        "src/workers/**",
        "src/orchestrator/*",
        "src/orchestrator/**",
        "src/infrastructure/*",
        "src/infrastructure/**",
        "src/core/*",
        "src/core/**",
        "docker/workers/*",
        "docker/workers/**",
        "docker/orchestrator/*",
        "docker/orchestrator/**",
        "tests/*",
        "tests/**",
        ".workitems/P01-*",
        ".workitems/P01-**",
        ".workitems/P02-*",
        ".workitems/P02-**",
        ".workitems/P03-*",
        ".workitems/P03-**",
        ".workitems/P06-*",
        ".workitems/P06-**",
    ],
    "frontend": [
        "src/hitl_ui/*",
        "src/hitl_ui/**",
        "docker/hitl-ui/*",
        "docker/hitl-ui/**",
        ".workitems/P05-*",
        ".workitems/P05-**",
    ],
    "test-writer": [
        "tests/*",
        "tests/**",
        "**/test_*",
        "**/*.test.*",
        "**/tests/**",
    ],
    "devops": [
        "docker/*",
        "docker/**",
        "helm/*",
        "helm/**",
        ".github/workflows/*",
        ".github/workflows/**",
        "scripts/k8s/*",
        "scripts/k8s/**",
        "scripts/deploy/*",
        "scripts/deploy/**",
    ],
}


def _is_path_allowed(file_path: str, agent: str | None) -> bool:
    """Check whether file_path is allowed for the given agent role.

    Args:
        file_path: Sanitized file path (forward slashes).
        agent: Agent role name, or None if unknown.

    Returns:
        True if the path is allowed (or agent is unknown / unrestricted).
    """
    if agent is None:
        return True  # No agent context -- allow

    allowed_patterns = _AGENT_PATH_RULES.get(agent)
    if allowed_patterns is None:
        return True  # Agent role not in restriction map -- allow

    for pattern in allowed_patterns:
        if fnmatch.fnmatch(file_path, pattern):
            return True
    return False


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


def read_cache_context(session_id: str) -> dict | None:
    """Read the context block from the guardrails cache."""
    cache_path = Path(tempfile.gettempdir()) / f"guardrails-{session_id}.json"
    try:
        data = json.loads(cache_path.read_text())
        return data.get("context")
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
    for field in ["file_path", "path", "file", "directory", "notebook_path"]:
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
    tools_denied = set(t.lower() for t in evaluated.get("tools_denied", []))
    tools_allowed = set(t.lower() for t in evaluated.get("tools_allowed", []))
    tool_lower = tool.lower()

    # Check explicit deny (case-insensitive)
    if tool_lower in tools_denied:
        return f"Tool '{tool}' is denied by active guardrails", True

    # If there's an allow list and tool is not on it, block (mandatory)
    if tools_allowed and tool_lower not in tools_allowed:
        return f"Tool '{tool}' is not in the allowed tools list", True

    return None, False


def check_path_restriction(paths: list[str], evaluated: dict, context: dict | None = None) -> tuple[str | None, bool]:
    """Check if any paths violate agent path restrictions.

    Returns (reason, is_mandatory).
    """
    if not paths or context is None:
        return None, False

    agent = context.get("agent")
    if agent is None:
        return None, False

    for file_path in paths:
        if not _is_path_allowed(file_path, agent):
            return (
                f"Agent '{agent}' is not allowed to modify '{file_path}'. "
                f"Path outside permitted domain.",
                True,
            )
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
        sys.exit(0)  # Fail-open

    # Read context (agent, domain, action) from cache
    context = read_cache_context(session_id)

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

    # Check path restrictions for Write, Edit, MultiEdit, and NotebookEdit tools
    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit") and paths:
        reason, is_mandatory = check_path_restriction(paths, evaluated, context)
        if reason and is_mandatory:
            print(reason, file=sys.stderr)
            sys.exit(2)

    # Clean pass
    sys.exit(0)


if __name__ == "__main__":
    main()
