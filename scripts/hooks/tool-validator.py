#!/usr/bin/env python3
"""
PreToolUse hook for CLI Agent Identity Enforcement.

This hook runs before Edit, Write, and Bash (git) operations to:
1. Verify the operation doesn't touch forbidden paths
2. Block git merge/push to main for non-orchestrator instances
3. BLOCK operations that violate the identity rules

Identity is derived from git config user.email (set by launcher scripts).
This allows multiple CLI instances to run in parallel without conflict.

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

# Path rules by identity (derived from git config user.email)
IDENTITY_RULES = {
    "backend": {
        "forbidden_paths": [
            "src/hitl_ui/",
            "docker/hitl-ui/",
            "tests/unit/hitl_ui/",
            "CLAUDE.md",
            "README.md",
            "docs/",
            "contracts/",
            ".claude/rules/",
            ".claude/skills/",
            ".workitems/P05-"
        ],
        "can_merge": True,  # TBD: All CLIs can commit to main
    },
    "frontend": {
        "forbidden_paths": [
            "src/workers/",
            "src/orchestrator/",
            "src/infrastructure/",
            "docker/workers/",
            "docker/orchestrator/",
            "docker/infrastructure/",
            "CLAUDE.md",
            "README.md",
            "docs/",
            "contracts/",
            ".claude/rules/",
            ".claude/skills/",
            ".workitems/P01-",
            ".workitems/P02-",
            ".workitems/P03-",
            ".workitems/P06-"
        ],
        "can_merge": True,  # TBD: All CLIs can commit to main
    },
    "orchestrator": {
        "forbidden_paths": [],
        "can_merge": True,
    },
}

# Map git email to identity
EMAIL_TO_IDENTITY = {
    "claude-backend@asdlc.local": "backend",
    "claude-frontend@asdlc.local": "frontend",
    "claude-orchestrator@asdlc.local": "orchestrator",
}


def get_project_root() -> Path:
    """Find the project root by looking for .claude directory."""
    cwd = Path.cwd()
    for path in [cwd] + list(cwd.parents):
        if (path / ".claude").is_dir():
            return path
    return cwd


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


def get_identity_from_email(email: str) -> str:
    """Derive identity from git email."""
    return EMAIL_TO_IDENTITY.get(email, "unknown")


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

    # Get identity from git config (works with parallel CLIs)
    git_email = get_git_email()
    instance_id = get_identity_from_email(git_email)

    # If no recognized identity, allow all operations (human user)
    if instance_id == "unknown":
        allow()

    # Get rules for this identity
    rules = IDENTITY_RULES.get(instance_id, {"forbidden_paths": [], "can_merge": False})
    forbidden_paths = rules["forbidden_paths"]
    can_merge = rules["can_merge"]

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

        # TBD: All CLIs can merge/push to main
        # Path restrictions still apply via Edit/Write checks above
        # Pre-commit hook enforces test verification
        allow()

    # All other tools - allow
    allow()


if __name__ == "__main__":
    main()
