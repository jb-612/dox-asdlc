#!/usr/bin/env python3
"""UserPromptSubmit hook: injects guardrails context into prompts.

Reads user prompt from stdin JSON, detects context, evaluates matching
guardrails, and outputs additionalContext for Claude Code.

Input (stdin JSON):
  {"prompt": "Implement the worker pool", "sessionId": "session-abc"}

Output (stdout JSON):
  {"additionalContext": "## Active Guardrails\n..."}

Always exits 0 (never blocks user input).
"""

import asyncio
import json
import os
import sys
import tempfile
import time
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


async def evaluate_guardrails(context_dict: dict) -> dict | None:
    """Call the evaluator to get matching guidelines.

    Returns the EvaluatedContext as a dict, or None on error.
    """
    try:
        from src.core.guardrails.config import GuardrailsConfig
        from src.core.guardrails.evaluator import GuardrailsEvaluator
        from src.core.guardrails.models import TaskContext
        from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

        config = GuardrailsConfig.from_env()
        if not config.enabled:
            return None

        from elasticsearch import AsyncElasticsearch
        es_client = AsyncElasticsearch(hosts=[config.elasticsearch_url])
        try:
            store = GuardrailsStore(es_client=es_client, index_prefix=config.index_prefix)
            evaluator = GuardrailsEvaluator(store=store, cache_ttl=config.cache_ttl)

            task_context = TaskContext(**context_dict)
            result = await evaluator.get_context(task_context)
            return result.to_dict()
        finally:
            await es_client.close()
    except Exception:
        return None


def write_cache(session_id: str, context: dict, guidelines: dict | None) -> None:
    """Write guidelines cache for PreToolUse hook."""
    cache_path = Path(tempfile.gettempdir()) / f"guardrails-{session_id}.json"
    cache_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ttl_seconds": 300,
        "context": context,
        "evaluated": guidelines,
    }
    try:
        cache_path.write_text(json.dumps(cache_data))
    except Exception:
        pass  # Best-effort caching


def format_additional_context(evaluated: dict) -> str:
    """Format evaluated guidelines as additionalContext string."""
    lines = ["## Active Guardrails\n"]

    instruction = evaluated.get("combined_instruction", "")
    if instruction:
        lines.append(instruction)
        lines.append("")

    denied = evaluated.get("tools_denied", [])
    if denied:
        lines.append(f"**Tools denied:** {', '.join(denied)}")

    allowed = evaluated.get("tools_allowed", [])
    if allowed:
        lines.append(f"**Tools allowed:** {', '.join(allowed)}")

    gates = evaluated.get("hitl_gates", [])
    if gates:
        lines.append(f"**HITL gates required:** {', '.join(gates)}")

    return "\n".join(lines).strip()


def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, Exception):
        sys.exit(0)  # Never block on bad input

    prompt = input_data.get("prompt", "")
    session_id = input_data.get("sessionId", "unknown")

    # Import context_detector directly to avoid triggering src.core.__init__
    import importlib.util
    root = get_project_root()
    detector_path = root / "src" / "core" / "guardrails" / "context_detector.py"
    spec = importlib.util.spec_from_file_location("context_detector", detector_path)
    detector_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(detector_module)
    ContextDetector = detector_module.ContextDetector

    default_agent = os.environ.get("CLAUDE_INSTANCE_ID")
    detector = ContextDetector(default_agent=default_agent)
    detected = detector.detect(prompt)

    # Build context dict for evaluator
    context_dict = {}
    if detected.agent:
        context_dict["agent"] = detected.agent
    if detected.domain:
        context_dict["domain"] = detected.domain
    if detected.action:
        context_dict["action"] = detected.action
    context_dict["session_id"] = session_id
    context_dict["event"] = "UserPromptSubmit"

    # Evaluate guardrails
    evaluated = asyncio.run(evaluate_guardrails(context_dict))

    # Write cache for PreToolUse hook
    write_cache(session_id, context_dict, evaluated)

    # Output additionalContext if we have matching guidelines
    if evaluated and evaluated.get("matched_guidelines"):
        output = {"additionalContext": format_additional_context(evaluated)}
        print(json.dumps(output))

    sys.exit(0)


if __name__ == "__main__":
    main()
