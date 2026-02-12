"""Tests for model pricing table and cost calculation."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from src.core.costs.pricing import (
    MODEL_PRICING,
    calculate_cost,
    get_pricing,
)


class TestModelPricing:
    """Tests for the MODEL_PRICING dictionary."""

    def test_opus_pricing_exists(self) -> None:
        assert "claude-opus-4" in MODEL_PRICING

    def test_sonnet_pricing_exists(self) -> None:
        assert "claude-sonnet-4" in MODEL_PRICING

    def test_haiku_pricing_exists(self) -> None:
        assert "claude-haiku-4" in MODEL_PRICING

    def test_opus_rates(self) -> None:
        input_rate, output_rate = MODEL_PRICING["claude-opus-4"]
        assert input_rate == 15.0
        assert output_rate == 75.0

    def test_sonnet_rates(self) -> None:
        input_rate, output_rate = MODEL_PRICING["claude-sonnet-4"]
        assert input_rate == 3.0
        assert output_rate == 15.0

    def test_haiku_rates(self) -> None:
        input_rate, output_rate = MODEL_PRICING["claude-haiku-4"]
        assert input_rate == 0.80
        assert output_rate == 4.0


class TestGetPricing:
    """Tests for get_pricing() function."""

    def test_exact_prefix_match_opus(self) -> None:
        input_rate, output_rate = get_pricing("claude-opus-4-6")
        assert input_rate == 15.0
        assert output_rate == 75.0

    def test_exact_prefix_match_sonnet(self) -> None:
        input_rate, output_rate = get_pricing("claude-sonnet-4-5")
        assert input_rate == 3.0
        assert output_rate == 15.0

    def test_exact_prefix_match_haiku(self) -> None:
        input_rate, output_rate = get_pricing("claude-haiku-4-5")
        assert input_rate == 0.80
        assert output_rate == 4.0

    def test_prefix_match_with_date_suffix(self) -> None:
        input_rate, output_rate = get_pricing("claude-opus-4-6-20260210")
        assert input_rate == 15.0
        assert output_rate == 75.0

    def test_unknown_model_falls_back_to_opus(self) -> None:
        input_rate, output_rate = get_pricing("unknown-model-v1")
        assert input_rate == 15.0
        assert output_rate == 75.0

    def test_empty_model_name_falls_back_to_opus(self) -> None:
        input_rate, output_rate = get_pricing("")
        assert input_rate == 15.0
        assert output_rate == 75.0

    def test_env_override_opus_input(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_OPUS_INPUT": "20.0"}):
            input_rate, output_rate = get_pricing("claude-opus-4-6")
            assert input_rate == 20.0
            assert output_rate == 75.0

    def test_env_override_opus_output(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_OPUS_OUTPUT": "100.0"}):
            input_rate, output_rate = get_pricing("claude-opus-4-6")
            assert input_rate == 15.0
            assert output_rate == 100.0

    def test_env_override_sonnet_input(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_SONNET_INPUT": "5.0"}):
            input_rate, output_rate = get_pricing("claude-sonnet-4-5")
            assert input_rate == 5.0
            assert output_rate == 15.0

    def test_env_override_sonnet_output(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_SONNET_OUTPUT": "20.0"}):
            input_rate, output_rate = get_pricing("claude-sonnet-4-5")
            assert input_rate == 3.0
            assert output_rate == 20.0

    def test_env_override_haiku_input(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_HAIKU_INPUT": "1.0"}):
            input_rate, output_rate = get_pricing("claude-haiku-4-5")
            assert input_rate == 1.0
            assert output_rate == 4.0

    def test_env_override_haiku_output(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_HAIKU_OUTPUT": "6.0"}):
            input_rate, output_rate = get_pricing("claude-haiku-4-5")
            assert input_rate == 0.80
            assert output_rate == 6.0

    def test_env_override_does_not_affect_other_models(self) -> None:
        with patch.dict(os.environ, {"COST_PRICING_OPUS_INPUT": "99.0"}):
            input_rate, output_rate = get_pricing("claude-sonnet-4-5")
            assert input_rate == 3.0
            assert output_rate == 15.0


class TestCalculateCost:
    """Tests for calculate_cost() function."""

    def test_opus_cost_calculation(self) -> None:
        cost = calculate_cost("claude-opus-4-6", input_tokens=1000, output_tokens=500)
        # input: 1000 / 1_000_000 * 15.0 = 0.015
        # output: 500 / 1_000_000 * 75.0 = 0.0375
        # total: 0.0525
        assert cost == pytest.approx(0.0525)

    def test_sonnet_cost_calculation(self) -> None:
        cost = calculate_cost(
            "claude-sonnet-4-5", input_tokens=10000, output_tokens=5000
        )
        # input: 10000 / 1_000_000 * 3.0 = 0.03
        # output: 5000 / 1_000_000 * 15.0 = 0.075
        # total: 0.105
        assert cost == pytest.approx(0.105)

    def test_haiku_cost_calculation(self) -> None:
        cost = calculate_cost(
            "claude-haiku-4-5", input_tokens=100000, output_tokens=50000
        )
        # input: 100000 / 1_000_000 * 0.80 = 0.08
        # output: 50000 / 1_000_000 * 4.0 = 0.20
        # total: 0.28
        assert cost == pytest.approx(0.28)

    def test_zero_tokens(self) -> None:
        cost = calculate_cost("claude-opus-4-6", input_tokens=0, output_tokens=0)
        assert cost == 0.0

    def test_only_input_tokens(self) -> None:
        cost = calculate_cost(
            "claude-opus-4-6", input_tokens=1000000, output_tokens=0
        )
        assert cost == pytest.approx(15.0)

    def test_only_output_tokens(self) -> None:
        cost = calculate_cost(
            "claude-opus-4-6", input_tokens=0, output_tokens=1000000
        )
        assert cost == pytest.approx(75.0)

    def test_unknown_model_uses_opus_pricing(self) -> None:
        cost = calculate_cost("gpt-4o", input_tokens=1000, output_tokens=500)
        assert cost == pytest.approx(0.0525)

    def test_cost_with_env_override(self) -> None:
        with patch.dict(
            os.environ,
            {"COST_PRICING_OPUS_INPUT": "10.0", "COST_PRICING_OPUS_OUTPUT": "50.0"},
        ):
            cost = calculate_cost(
                "claude-opus-4-6", input_tokens=1000, output_tokens=500
            )
            # input: 1000 / 1_000_000 * 10.0 = 0.01
            # output: 500 / 1_000_000 * 50.0 = 0.025
            # total: 0.035
            assert cost == pytest.approx(0.035)
