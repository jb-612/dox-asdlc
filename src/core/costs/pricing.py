"""Model pricing table for agent cost estimation.

Provides per-model token pricing and cost calculation functions.
Pricing can be overridden via environment variables.
"""

from __future__ import annotations

import os

# Model pricing: prefix -> (input_rate_per_million, output_rate_per_million)
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4": (15.0, 75.0),
    "claude-sonnet-4": (3.0, 15.0),
    "claude-haiku-4": (0.80, 4.0),
}

# Maps model prefix to env var name fragments for overrides
_ENV_OVERRIDE_MAP: dict[str, str] = {
    "claude-opus-4": "OPUS",
    "claude-sonnet-4": "SONNET",
    "claude-haiku-4": "HAIKU",
}

_FALLBACK_PREFIX = "claude-opus-4"


def get_pricing(model_name: str) -> tuple[float, float]:
    """Get pricing rates for a model.

    Matches model name by prefix against MODEL_PRICING keys.
    Falls back to Opus pricing for unknown models.
    Supports environment variable overrides in the form
    COST_PRICING_{TIER}_INPUT and COST_PRICING_{TIER}_OUTPUT.

    Args:
        model_name: Full model name (e.g. "claude-opus-4-6").

    Returns:
        Tuple of (input_rate_per_million, output_rate_per_million).
    """
    matched_prefix = _FALLBACK_PREFIX
    for prefix in MODEL_PRICING:
        if model_name.startswith(prefix):
            matched_prefix = prefix
            break

    base_input, base_output = MODEL_PRICING[matched_prefix]
    tier = _ENV_OVERRIDE_MAP[matched_prefix]

    input_override = os.environ.get(f"COST_PRICING_{tier}_INPUT")
    output_override = os.environ.get(f"COST_PRICING_{tier}_OUTPUT")

    input_rate = float(input_override) if input_override else base_input
    output_rate = float(output_override) if output_override else base_output

    return input_rate, output_rate


def calculate_cost(
    model: str, input_tokens: int, output_tokens: int
) -> float:
    """Calculate estimated USD cost for a model invocation.

    Args:
        model: Model name (matched by prefix).
        input_tokens: Number of input tokens consumed.
        output_tokens: Number of output tokens generated.

    Returns:
        Estimated cost in USD.
    """
    input_rate, output_rate = get_pricing(model)
    return (input_tokens / 1_000_000 * input_rate) + (
        output_tokens / 1_000_000 * output_rate
    )
