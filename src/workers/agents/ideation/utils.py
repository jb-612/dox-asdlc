"""Shared utilities for ideation agents."""

from __future__ import annotations

import json
import re
from typing import Any


def parse_json_from_response(response: str) -> dict[str, Any] | None:
    """Parse JSON from LLM response text.

    Handles responses that may have markdown code blocks or other formatting.

    Args:
        response: The raw LLM response text.

    Returns:
        Parsed JSON as dict, or None if parsing fails.
    """
    # Try to parse the entire response as JSON directly
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from markdown code blocks
    patterns = [
        r"```json\s*\n?(.*?)\n?```",
        r"```\s*\n?(.*?)\n?```",
    ]

    for pattern in patterns:
        json_match = re.search(pattern, response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except json.JSONDecodeError:
                continue

    # Try to find JSON object in the response
    json_start = response.find("{")
    json_end = response.rfind("}")
    if json_start != -1 and json_end != -1 and json_end > json_start:
        try:
            return json.loads(response[json_start : json_end + 1])
        except json.JSONDecodeError:
            pass

    return None
