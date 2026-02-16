#!/usr/bin/env python3
"""SubagentStart hook: injects agent-specific guardrails when subagent spawns.

Reads agent info from stdin JSON, checks parent cache or evaluates directly,
and outputs additionalContext for the subagent's initial context.

Input (stdin JSON):
  {"agentName": "backend", "sessionId": "session-def456", "parentSessionId": "session-abc123"}

Output (stdout JSON):
  {"additionalContext": "## Guardrails for backend agent\n..."}

Always exits 0 (never blocks subagent startup).
"""

import asyncio
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def get_project_root() -> Path:
    """Find the project root by looking for CLAUDE.md."""
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / "CLAUDE.md").exists():
            return parent
    return Path.cwd()


def ensure_project_on_path():
    """Add project root to sys.path so we can import src modules."""
    root = get_project_root()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


def read_parent_cache(parent_session_id: str) -> dict | None:
    """Read parent session's guardrails cache.

    Returns the evaluated dict from cache, or None if cache missing/expired.
    """
    cache_path = Path(tempfile.gettempdir()) / f"guardrails-{parent_session_id}.json"
    try:
        if not cache_path.exists():
            return None
        data = json.loads(cache_path.read_text())
        # Check TTL
        ts = datetime.fromisoformat(data.get("timestamp", ""))
        ttl = data.get("ttl_seconds", 300)
        age = (datetime.now(timezone.utc) - ts.replace(tzinfo=timezone.utc)).total_seconds()
        if age > ttl:
            return None  # Cache expired
        return data.get("evaluated")
    except Exception:
        return None


def write_agent_cache(session_id: str, agent_name: str, evaluated: dict) -> None:
    """Write agent's guardrails cache for its PreToolUse hooks."""
    cache_path = Path(tempfile.gettempdir()) / f"guardrails-{session_id}.json"
    cache_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ttl_seconds": 300,
        "context": {"agent": agent_name},
        "evaluated": evaluated,
    }
    try:
        cache_path.write_text(json.dumps(cache_data))
    except Exception:
        pass  # Best-effort caching


def format_agent_context(agent_name: str, evaluated: dict) -> str:
    """Format guardrails for a specific agent as additionalContext."""
    lines = [f"## Guardrails for {agent_name} agent"]

    instruction = evaluated.get("combined_instruction", "")
    if instruction:
        lines.append("")
        lines.append(instruction)

    denied = evaluated.get("tools_denied", [])
    if denied:
        lines.append("")
        lines.append(f"**Tools denied:** {', '.join(denied)}")

    allowed = evaluated.get("tools_allowed", [])
    if allowed:
        lines.append("")
        lines.append(f"**Tools allowed:** {', '.join(allowed)}")

    gates = evaluated.get("hitl_gates", [])
    if gates:
        lines.append("")
        lines.append(f"**HITL gates required:** {', '.join(gates)}")

    return "\n".join(lines).strip()


async def evaluate_for_agent(agent_name: str, session_id: str) -> dict | None:
    """Call evaluator for agent-specific guidelines.

    Tries Elasticsearch first. If ES is unavailable and fallback_mode is
    "static", falls back to StaticGuardrailsStore reading from a local
    JSON file.

    Returns the EvaluatedContext as a dict, or None on error.
    """
    try:
        from src.core.guardrails.config import GuardrailsConfig
        from src.core.guardrails.evaluator import GuardrailsEvaluator
        from src.core.guardrails.models import TaskContext

        config = GuardrailsConfig.from_env()
        if not config.enabled:
            return None

        store = None
        es_client = None

        # Try Elasticsearch first
        try:
            from elasticsearch import AsyncElasticsearch
            from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

            es_client = AsyncElasticsearch(
                hosts=[config.elasticsearch_url],
                request_timeout=5,
            )
            # Quick connectivity check
            await es_client.ping()
            store = GuardrailsStore(es_client=es_client, index_prefix=config.index_prefix)
        except Exception:
            # ES unavailable -- close client if opened
            if es_client is not None:
                try:
                    await es_client.close()
                except Exception:
                    pass
                es_client = None

            # Fall back to static store if configured
            if config.fallback_mode == "static":
                from src.core.guardrails.evaluator import StaticGuardrailsStore
                root = get_project_root()
                static_path = root / config.static_file_path
                if static_path.exists():
                    store = StaticGuardrailsStore(static_path)

        if store is None:
            return None

        try:
            evaluator = GuardrailsEvaluator(store=store, cache_ttl=config.cache_ttl)
            task_context = TaskContext(
                agent=agent_name,
                session_id=session_id,
                event="SubagentStart"
            )
            result = await evaluator.get_context(task_context)
            return result.to_dict()
        finally:
            if es_client is not None:
                await es_client.close()
    except Exception:
        return None


def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)  # Never block on bad input

    agent_name = input_data.get("agentName", "unknown")
    session_id = input_data.get("sessionId", "unknown")
    parent_session_id = input_data.get("parentSessionId")

    # Try parent cache first
    evaluated = None
    if parent_session_id:
        evaluated = read_parent_cache(parent_session_id)

    # If no cache, try direct evaluator call
    if evaluated is None:
        ensure_project_on_path()
        evaluated = asyncio.run(evaluate_for_agent(agent_name, session_id))

    # Write this agent's cache for its own PreToolUse hooks
    if evaluated:
        write_agent_cache(session_id, agent_name, evaluated)

    # Output additionalContext
    if evaluated and (evaluated.get("matched_guidelines") or evaluated.get("combined_instruction")):
        context_text = format_agent_context(agent_name, evaluated)
        # Only output if there's meaningful content beyond just the header
        header_only = f"## Guardrails for {agent_name} agent"
        if context_text and context_text != header_only:
            output = {"additionalContext": context_text}
            print(json.dumps(output))

    sys.exit(0)


if __name__ == "__main__":
    main()
