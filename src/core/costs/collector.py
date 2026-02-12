"""Cost collector for extracting token usage from hook event payloads.

Parses PostToolUse hook payloads to extract input/output token counts,
model name, and computes estimated USD cost using the pricing table.
"""

from __future__ import annotations

import hashlib
import time

from src.core.costs.models import CostRecord
from src.core.costs.pricing import calculate_cost


def extract_cost_from_hook_event(payload: dict) -> CostRecord | None:
    """Extract a CostRecord from a hook event payload.

    Looks for token usage at payload["usage"] or
    payload["response"]["usage"]. If token counts are missing
    or zero, returns None. Never raises exceptions.

    Args:
        payload: Hook event payload dictionary.

    Returns:
        CostRecord if extraction succeeds, None otherwise.
    """
    try:
        if not isinstance(payload, dict):
            return None

        # Extract usage: top-level first, then nested in response
        usage = payload.get("usage")
        if not isinstance(usage, dict):
            response = payload.get("response", {})
            if isinstance(response, dict):
                usage = response.get("usage")
            if not isinstance(usage, dict):
                return None

        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")

        if input_tokens is None or output_tokens is None:
            return None

        input_tokens = int(input_tokens)
        output_tokens = int(output_tokens)

        if input_tokens == 0 and output_tokens == 0:
            return None

        # Extract model: top-level first, then nested in response
        model = payload.get("model")
        if not model:
            response = payload.get("response", {})
            if isinstance(response, dict):
                model = response.get("model")
        if not model:
            return None

        session_id = payload.get("session_id", "unknown")
        agent_id = payload.get("agent_id", "unknown")
        tool_name = payload.get("tool_name")

        estimated_cost = calculate_cost(model, input_tokens, output_tokens)

        ts = time.time()
        hash_input = f"{ts}-{session_id}-{input_tokens}-{output_tokens}"
        short_hash = hashlib.md5(hash_input.encode()).hexdigest()[:8]
        record_id = f"cost-{int(ts)}-{short_hash}"

        return CostRecord(
            id=record_id,
            timestamp=ts,
            session_id=session_id,
            agent_id=agent_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost_usd=estimated_cost,
            tool_name=tool_name,
        )
    except Exception:
        return None
