#!/usr/bin/env python3
"""Hook execution wrapper for telemetry.

Wraps Claude Code hook commands to capture execution timing,
exit codes, and errors. Writes to both a JSONL file (for backward
compat with Prometheus exporter) and a SQLite database (for the
telemetry dashboard).

Usage:
    python3 scripts/hooks/hook-wrapper.py <hook-name> <command> [args...]

Example:
    python3 scripts/hooks/hook-wrapper.py session-start python3 scripts/hooks/session-start.py
    python3 scripts/hooks/hook-wrapper.py guardrails-enforce python3 .claude/hooks/guardrails-enforce.py
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

TELEMETRY_FILE = Path("/tmp/hook-telemetry.jsonl")

# Map hook name patterns to event types
_EVENT_TYPE_MAP = {
    "session-start": "SessionStart",
    "guardrails-enforce": "PreToolUse",
    "guardrails-inject": "UserPromptSubmit",
    "guardrails-subagent": "SubagentStart",
    "post-tool": "PostToolUse",
    "stop": "Stop",
    "notification": "Notification",
}


def _resolve_event_type(hook_name: str) -> str:
    """Map a hook name to its canonical event type."""
    for pattern, etype in _EVENT_TYPE_MAP.items():
        if pattern in hook_name:
            return etype
    return "unknown"


def _parse_stdin_fields(stdin_data: bytes) -> dict:
    """Best-effort extraction of session_id, tool_name, agent_id from stdin JSON."""
    fields: dict = {}
    try:
        payload = json.loads(stdin_data)
        if not isinstance(payload, dict):
            return fields
        # session_id: direct field or nested in sessionId
        fields["session_id"] = payload.get("sessionId") or payload.get("session_id")
        # tool_name: direct field (PreToolUse hooks send {"tool": "Write", ...})
        fields["tool_name"] = payload.get("tool") or payload.get("tool_name")
        # agent_id: agentName from SubagentStart, or fallback to env
        fields["agent_id"] = (
            payload.get("agentName")
            or payload.get("agent_id")
            or payload.get("agent")
        )
        # blocked: exit_code 2 means blocked, but also check payload
        fields["blocked"] = payload.get("blocked", False)
    except (json.JSONDecodeError, TypeError, AttributeError):
        pass
    return fields


def main() -> int:
    if len(sys.argv) < 3:
        # If called with fewer args, just pass through
        print("Usage: hook-wrapper.py <hook-name> <command> [args...]", file=sys.stderr)
        return 1

    hook_name = sys.argv[1]
    command = sys.argv[2:]

    # Read stdin to pass through to the wrapped command
    stdin_data = sys.stdin.buffer.read()

    start_time = time.monotonic()
    start_ts = time.time()
    exit_code = 0
    stderr_output = ""

    try:
        result = subprocess.run(
            command,
            input=stdin_data,
            capture_output=True,
            timeout=30,
        )
        exit_code = result.returncode
        stderr_output = result.stderr.decode("utf-8", errors="replace")[:500]

        # Pass through stdout and stderr from the wrapped command
        if result.stdout:
            sys.stdout.buffer.write(result.stdout)
            sys.stdout.buffer.flush()
        if result.stderr:
            sys.stderr.buffer.write(result.stderr)
            sys.stderr.buffer.flush()

    except subprocess.TimeoutExpired:
        exit_code = 124  # Standard timeout exit code
        stderr_output = "Hook timed out after 30s"
        print(stderr_output, file=sys.stderr)
    except FileNotFoundError:
        exit_code = 127  # Command not found
        stderr_output = f"Command not found: {command[0]}"
        print(stderr_output, file=sys.stderr)
    except Exception as e:
        exit_code = 1
        stderr_output = str(e)[:500]
        print(f"Hook wrapper error: {e}", file=sys.stderr)

    duration = time.monotonic() - start_time

    # Determine event type from hook name
    event_type = _resolve_event_type(hook_name)

    # Parse stdin JSON for extra fields (session_id, tool_name, agent_id)
    stdin_fields = _parse_stdin_fields(stdin_data)
    session_id = stdin_fields.get("session_id")
    tool_name = stdin_fields.get("tool_name")
    agent_id = stdin_fields.get("agent_id") or os.environ.get("CLAUDE_INSTANCE_ID")
    blocked = exit_code == 2 or stdin_fields.get("blocked", False)

    # Append JSONL telemetry record (backward compat with Prometheus exporter)
    record = {
        "hook_name": hook_name,
        "event_type": event_type,
        "exit_code": exit_code,
        "duration_seconds": round(duration, 4),
        "timestamp": start_ts,
        "session_id": session_id,
        "tool_name": tool_name,
        "agent_id": agent_id,
        "blocked": blocked,
        "error": stderr_output if exit_code != 0 else None,
    }

    try:
        with open(TELEMETRY_FILE, "a") as f:
            f.write(json.dumps(record) + "\n")
    except OSError:
        pass

    # Write to SQLite telemetry store (silent on failure)
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "telemetry"))
        import sqlite_store
        sqlite_store.init_db()
        sqlite_store.record_event(
            hook_name=hook_name,
            hook_event_type=event_type,
            exit_code=exit_code,
            duration_seconds=duration,
            timestamp=start_ts,
            session_id=session_id,
            tool_name=tool_name,
            agent_id=agent_id,
            blocked=blocked,
            error=stderr_output if exit_code != 0 else None,
        )
    except Exception:
        # Never break hooks due to SQLite issues
        pass

    # Record cost data for PostToolUse events (silent on failure)
    if event_type == "PostToolUse":
        try:
            sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
            from src.core.costs.collector import extract_cost_from_hook_event

            stdin_payload = {}
            try:
                stdin_payload = json.loads(stdin_data)
                if not isinstance(stdin_payload, dict):
                    stdin_payload = {}
            except (json.JSONDecodeError, TypeError):
                pass

            cost_record = extract_cost_from_hook_event(stdin_payload)
            if cost_record is not None:
                import sqlite_store as _ss
                _ss.record_cost(cost_record=cost_record)
        except Exception:
            pass

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
