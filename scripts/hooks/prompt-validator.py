#!/usr/bin/env python3
"""
Prompt validator hook for Claude Code.

This hook validates prompts before submission. Currently a pass-through
that approves all prompts. Add validation logic as needed.

Exit codes:
  0 - Prompt approved
  1 - Prompt rejected (blocks submission)
"""

import sys


def validate_prompt(prompt: str) -> bool:
    """Validate the prompt. Returns True if approved."""
    # Currently a pass-through - add validation logic as needed
    return True


def main() -> int:
    """Read prompt from stdin and validate."""
    try:
        # Read prompt from stdin (hook receives input this way)
        prompt = sys.stdin.read() if not sys.stdin.isatty() else ""

        if validate_prompt(prompt):
            return 0  # Approved
        else:
            print("Prompt validation failed", file=sys.stderr)
            return 1  # Rejected
    except Exception as e:
        # On error, allow the prompt to proceed
        print(f"Warning: prompt-validator error: {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main())
