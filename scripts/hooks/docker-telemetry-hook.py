#!/usr/bin/env python3
"""Docker container telemetry hook for Claude CLI.

Reads a Claude Code hook payload from stdin and forwards it as a TelemetryEvent
to the workflow-studio monitoring endpoint (TELEMETRY_URL).  If TELEMETRY_URL is
not set the hook exits immediately so it never blocks Claude CLI execution.

Hook type → TelemetryEventType mapping
  PostToolUse   → tool_call
  PreToolUse    → tool_call
  SubagentStart → lifecycle  (subType: start)
  Stop          → lifecycle  (subType: finalized)
  <other>       → custom
"""

# Known limitation: This hook only captures top-level tool calls from the Claude CLI
# session running in this container. If the agent spawns subagents (nested Claude calls),
# those inner tool calls are NOT captured unless the hook is configured recursively inside
# each subagent's .claude/settings.json. This is a depth limitation of the hook architecture
# and does not affect the accuracy of captured events for the top-level session.

import json
import os
import socket
import sys
import uuid
from datetime import datetime, timezone
from urllib import request
from urllib.error import URLError

_HOOK_TO_EVENT_TYPE = {
    "PostToolUse": "tool_call",
    "PreToolUse": "tool_call",
    "SubagentStart": "lifecycle",
    "Stop": "lifecycle",
}

_LIFECYCLE_SUBTYPE = {
    "SubagentStart": "start",
    "Stop": "finalized",
}

_MAX_DATA_LEN = 512


def _read_container_id() -> str:
    """Return first 12 chars of container hash from /proc/self/cgroup, else hostname."""
    try:
        with open("/proc/self/cgroup") as fh:
            for line in fh:
                parts = line.strip().split("/")
                for part in reversed(parts):
                    if len(part) >= 12 and all(c in "0123456789abcdef" for c in part[:12]):
                        return part[:12]
    except OSError:
        pass
    return socket.gethostname()


def _truncate(value: object) -> str:
    """Serialise value to JSON string and truncate to _MAX_DATA_LEN chars."""
    text = json.dumps(value) if not isinstance(value, str) else value
    return text[:_MAX_DATA_LEN]


def main() -> None:
    telemetry_url = os.environ.get("TELEMETRY_URL", "").strip()
    if not telemetry_url:
        sys.exit(0)

    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        payload = {}

    hook_type: str = payload.get("type", "")
    tool_name: str = payload.get("toolName", "")
    tool_input = payload.get("toolInput", {})
    tool_result = payload.get("toolResult", {})
    session_id: str = payload.get("sessionId", "")

    event_type = _HOOK_TO_EVENT_TYPE.get(hook_type, "custom")

    data: dict = {
        "toolName": tool_name,
        "toolInput": _truncate(tool_input),
        "toolResult": _truncate(tool_result),
    }
    if hook_type in _LIFECYCLE_SUBTYPE:
        data["subType"] = _LIFECYCLE_SUBTYPE[hook_type]

    agent_id = os.environ.get("CLAUDE_INSTANCE_ID", "").strip() or socket.gethostname()
    container_id = _read_container_id()

    event: dict = {
        "id": str(uuid.uuid4()),
        "type": event_type,
        "agentId": agent_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
        "sessionId": session_id or None,
        "containerId": container_id,
    }

    try:
        body = json.dumps(event).encode()
        req = request.Request(
            telemetry_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=2):
            pass
    except (URLError, OSError, Exception) as exc:
        print(f"docker-telemetry-hook: POST failed: {exc}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
