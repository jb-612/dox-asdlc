#!/usr/bin/env python3
"""
PreToolUse hook for CLI Agent Identity Enforcement.

This hook runs before Edit, Write, and Bash (git) operations to:
1. Verify the operation doesn't touch forbidden paths
2. Block git merge/push to main for non-orchestrator instances
3. BLOCK operations that violate the identity rules

Receives tool call information via stdin as JSON:
{
  "tool_name": "Edit" | "Write" | "Bash",
  "tool_input": { ... tool-specific parameters ... }
}

Blocking mechanism:
  - Print reason to stderr
  - Exit 2 to block the operation

Exit codes:
  0 - Allow the operation
  2 - Block the operation (reason printed to stderr)
"""

import json
import re
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Find the project root by looking for .claude directory."""
    cwd = Path.cwd()
    for path in [cwd] + list(cwd.parents):
        if (path / ".claude").is_dir():
            return path
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


def block(reason: str):
    """Block the operation with the given reason."""
    print(f"BLOCKED: {reason}", file=sys.stderr)
    sys.exit(2)


def allow():
    """Allow the operation to proceed."""
    sys.exit(0)


def normalize_path(path: str, project_root: Path) -> str:
    """Normalize a path to be relative to project root."""
    try:
        p = Path(path)
        if p.is_absolute():
            try:
                return str(p.relative_to(project_root))
            except ValueError:
                return str(p)
        return str(p)
    except Exception:
        return path


def matches_pattern(path: str, pattern: str) -> bool:
    """Check if a path matches a pattern (supports * wildcard and directory prefix)."""
    # Handle directory patterns (ending with /)
    if pattern.endswith("/"):
        return path.startswith(pattern) or path.startswith(pattern.rstrip("/"))

    # Handle glob patterns with *
    if "*" in pattern:
        # Convert glob pattern to regex
        regex = pattern.replace(".", r"\.").replace("*", ".*")
        return bool(re.match(f"^{regex}", path))

    # Exact match or prefix match
    return path == pattern or path.startswith(pattern + "/")


def is_path_forbidden(path: str, forbidden_paths: list) -> bool:
    """Check if a path is in the forbidden list."""
    for pattern in forbidden_paths:
        if matches_pattern(path, pattern):
            return True
    return False


def is_git_push_command(command: str) -> bool:
    """Check if a bash command is a git push."""
    return bool(re.search(r'\bgit\s+push\b', command))


def is_git_merge_command(command: str) -> bool:
    """Check if a bash command is a git merge."""
    return bool(re.search(r'\bgit\s+merge\b', command))


def main():
    project_root = get_project_root()
    identity_file = project_root / ".claude" / "instance-identity.json"

    # If no identity file, allow all operations (human user)
    if not identity_file.exists():
        allow()

    # Load identity configuration
    try:
        with open(identity_file) as f:
            identity = json.load(f)
    except (json.JSONDecodeError, IOError):
        # Can't read identity, allow operation
        allow()

    instance_id = identity.get("instance_id", "unknown")
    forbidden_paths = identity.get("forbidden_paths", [])
    can_merge = identity.get("can_merge", False)

    # Read tool call from stdin
    try:
        tool_call = json.load(sys.stdin)
    except (json.JSONDecodeError, IOError):
        # Can't parse input, allow operation
        allow()

    tool_name = tool_call.get("tool_name", "")
    tool_input = tool_call.get("tool_input", {})

    # Handle Edit and Write operations
    if tool_name in ("Edit", "Write"):
        file_path = tool_input.get("file_path", "")
        if not file_path:
            allow()

        rel_path = normalize_path(file_path, project_root)

        # Check against forbidden paths
        if is_path_forbidden(rel_path, forbidden_paths):
            block(
                f"FORBIDDEN PATH\n"
                f"Instance '{instance_id}' cannot modify: {rel_path}\n"
                f"This path is restricted for your role.\n"
                f"Use the appropriate launcher if you need a different role."
            )

        allow()

    # Handle Bash operations (especially git commands)
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if not command:
            allow()

        current_branch = get_current_branch()

        # Check git merge (only orchestrator can merge to main)
        if is_git_merge_command(command):
            if not can_merge and current_branch == "main":
                block(
                    f"MERGE BLOCKED\n"
                    f"Instance '{instance_id}' cannot merge to main.\n"
                    f"Only the orchestrator can merge to main.\n"
                    f"Submit a READY_FOR_REVIEW message instead."
                )

        # Check git push to main (only orchestrator can push to main)
        if is_git_push_command(command):
            if "main" in command or "master" in command:
                if not can_merge:
                    block(
                        f"PUSH TO MAIN BLOCKED\n"
                        f"Instance '{instance_id}' cannot push to main.\n"
                        f"Only the orchestrator can push to main."
                    )

        allow()

    # All other tools - allow
    allow()


if __name__ == "__main__":
    main()
