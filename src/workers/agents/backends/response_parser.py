"""Shared response parsing utilities for agent backends.

Extracts structured JSON from LLM responses, handling various
formats: direct JSON, code blocks, and embedded JSON objects.
"""

from __future__ import annotations

import json
import re
from typing import Any


def parse_json_from_response(content: str) -> dict[str, Any] | None:
    """Parse JSON from an LLM response, handling code blocks.

    Tries multiple strategies in order:
    1. Direct JSON parse
    2. Extract from ```json ... ``` code blocks
    3. Extract from bare ``` ... ``` code blocks
    4. Find the outermost JSON object in the text

    Args:
        content: Raw LLM response content.

    Returns:
        dict | None: Parsed JSON or None if parsing fails.
    """
    if not content or not content.strip():
        return None

    # Strategy 1: Direct JSON parse
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # Strategy 2-3: Extract from code blocks
    for pattern in [r'```json\s*\n?(.*?)\n?```', r'```\s*\n?(.*?)\n?```']:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1).strip())
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                continue

    # Strategy 4: Find outermost JSON object
    json_start = content.find('{')
    json_end = content.rfind('}')
    if json_start != -1 and json_end > json_start:
        try:
            data = json.loads(content[json_start:json_end + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    return None
