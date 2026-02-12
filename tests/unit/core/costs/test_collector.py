"""Tests for cost collector -- token extraction from hook events."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from src.core.costs.collector import extract_cost_from_hook_event
from src.core.costs.models import CostRecord


class TestExtractCostFromHookEvent:
    """Tests for extract_cost_from_hook_event()."""

    def test_extract_with_top_level_usage(self) -> None:
        payload = {
            "usage": {"input_tokens": 1500, "output_tokens": 800},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc123",
            "agent_id": "pm",
            "tool_name": "Read",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert isinstance(result, CostRecord)
        assert result.input_tokens == 1500
        assert result.output_tokens == 800
        assert result.model == "claude-opus-4-6"
        assert result.session_id == "sess-abc123"
        assert result.agent_id == "pm"
        assert result.tool_name == "Read"
        assert result.estimated_cost_usd > 0

    def test_extract_with_nested_response_usage(self) -> None:
        payload = {
            "response": {
                "usage": {"input_tokens": 500, "output_tokens": 200},
                "model": "claude-sonnet-4-5",
            },
            "session_id": "sess-def456",
            "agent_id": "backend",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.input_tokens == 500
        assert result.output_tokens == 200
        assert result.model == "claude-sonnet-4-5"
        assert result.session_id == "sess-def456"
        assert result.agent_id == "backend"

    def test_missing_usage_returns_none(self) -> None:
        payload = {
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is None

    def test_missing_model_returns_none(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "session_id": "sess-abc",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is None

    def test_missing_token_counts_returns_none(self) -> None:
        payload = {
            "usage": {},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is None

    def test_malformed_payload_returns_none(self) -> None:
        result = extract_cost_from_hook_event("not a dict")  # type: ignore[arg-type]
        assert result is None

    def test_empty_payload_returns_none(self) -> None:
        result = extract_cost_from_hook_event({})
        assert result is None

    def test_none_payload_returns_none(self) -> None:
        result = extract_cost_from_hook_event(None)  # type: ignore[arg-type]
        assert result is None

    def test_cost_calculation_correctness_opus(self) -> None:
        payload = {
            "usage": {"input_tokens": 1000, "output_tokens": 500},
            "model": "claude-opus-4-6",
            "session_id": "sess-test",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        # input: 1000 / 1_000_000 * 15.0 = 0.015
        # output: 500 / 1_000_000 * 75.0 = 0.0375
        # total: 0.0525
        assert result.estimated_cost_usd == pytest.approx(0.0525)

    def test_cost_calculation_correctness_sonnet(self) -> None:
        payload = {
            "usage": {"input_tokens": 10000, "output_tokens": 5000},
            "model": "claude-sonnet-4-5",
            "session_id": "sess-test",
            "agent_id": "backend",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        # input: 10000 / 1_000_000 * 3.0 = 0.03
        # output: 5000 / 1_000_000 * 15.0 = 0.075
        # total: 0.105
        assert result.estimated_cost_usd == pytest.approx(0.105)

    def test_defaults_session_id_to_unknown(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "model": "claude-opus-4-6",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.session_id == "unknown"

    def test_defaults_agent_id_to_unknown(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.agent_id == "unknown"

    def test_tool_name_is_optional(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.tool_name is None

    def test_id_format(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.id.startswith("cost-")

    def test_timestamp_is_set(self) -> None:
        before = time.time()
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        after = time.time()
        assert result is not None
        assert before <= result.timestamp <= after

    def test_model_from_top_level_preferred_over_response(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "model": "claude-opus-4-6",
            "response": {"model": "claude-sonnet-4-5"},
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.model == "claude-opus-4-6"

    def test_model_falls_back_to_response_model(self) -> None:
        payload = {
            "usage": {"input_tokens": 100, "output_tokens": 50},
            "response": {"model": "claude-sonnet-4-5"},
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is not None
        assert result.model == "claude-sonnet-4-5"

    def test_exception_in_processing_returns_none(self) -> None:
        payload = {
            "usage": {"input_tokens": "not_a_number", "output_tokens": 50},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is None

    def test_usage_with_zero_tokens_returns_none(self) -> None:
        payload = {
            "usage": {"input_tokens": 0, "output_tokens": 0},
            "model": "claude-opus-4-6",
            "session_id": "sess-abc",
            "agent_id": "pm",
        }
        result = extract_cost_from_hook_event(payload)
        assert result is None
