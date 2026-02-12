"""Tests for cost data models."""

from __future__ import annotations

import pytest

from src.core.costs.models import CostFilter, CostRecord


class TestCostRecord:
    """Tests for the CostRecord frozen dataclass."""

    def test_create_cost_record_with_all_fields(self) -> None:
        record = CostRecord(
            id="cost-001",
            timestamp=1707580800.0,
            session_id="sess-abc123",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=1500,
            output_tokens=800,
            estimated_cost_usd=0.0825,
            tool_name="Read",
            hook_event_id=42,
        )
        assert record.id == "cost-001"
        assert record.timestamp == 1707580800.0
        assert record.session_id == "sess-abc123"
        assert record.agent_id == "pm"
        assert record.model == "claude-opus-4-6"
        assert record.input_tokens == 1500
        assert record.output_tokens == 800
        assert record.estimated_cost_usd == 0.0825
        assert record.tool_name == "Read"
        assert record.hook_event_id == 42

    def test_create_cost_record_with_optional_fields_none(self) -> None:
        record = CostRecord(
            id="cost-002",
            timestamp=1707580900.0,
            session_id="sess-def456",
            agent_id="backend",
            model="claude-sonnet-4-5",
            input_tokens=500,
            output_tokens=200,
            estimated_cost_usd=0.0045,
        )
        assert record.tool_name is None
        assert record.hook_event_id is None

    def test_cost_record_is_frozen(self) -> None:
        record = CostRecord(
            id="cost-003",
            timestamp=1707581000.0,
            session_id="sess-ghi789",
            agent_id="frontend",
            model="claude-haiku-4-5",
            input_tokens=100,
            output_tokens=50,
            estimated_cost_usd=0.0003,
        )
        with pytest.raises(AttributeError):
            record.id = "modified"  # type: ignore[misc]

    def test_cost_record_to_dict(self) -> None:
        record = CostRecord(
            id="cost-004",
            timestamp=1707581100.0,
            session_id="sess-jkl012",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=2000,
            output_tokens=1000,
            estimated_cost_usd=0.105,
            tool_name="Edit",
            hook_event_id=99,
        )
        d = record.to_dict()
        assert d == {
            "id": "cost-004",
            "timestamp": 1707581100.0,
            "session_id": "sess-jkl012",
            "agent_id": "pm",
            "model": "claude-opus-4-6",
            "input_tokens": 2000,
            "output_tokens": 1000,
            "estimated_cost_usd": 0.105,
            "tool_name": "Edit",
            "hook_event_id": 99,
        }

    def test_cost_record_to_dict_none_optionals(self) -> None:
        record = CostRecord(
            id="cost-005",
            timestamp=1707581200.0,
            session_id="sess-mno345",
            agent_id="backend",
            model="claude-sonnet-4-5",
            input_tokens=300,
            output_tokens=100,
            estimated_cost_usd=0.0024,
        )
        d = record.to_dict()
        assert d["tool_name"] is None
        assert d["hook_event_id"] is None

    def test_cost_record_from_dict(self) -> None:
        data = {
            "id": "cost-006",
            "timestamp": 1707581300.0,
            "session_id": "sess-pqr678",
            "agent_id": "pm",
            "model": "claude-opus-4-6",
            "input_tokens": 1200,
            "output_tokens": 600,
            "estimated_cost_usd": 0.063,
            "tool_name": "Bash",
            "hook_event_id": 55,
        }
        record = CostRecord.from_dict(data)
        assert record.id == "cost-006"
        assert record.timestamp == 1707581300.0
        assert record.session_id == "sess-pqr678"
        assert record.agent_id == "pm"
        assert record.model == "claude-opus-4-6"
        assert record.input_tokens == 1200
        assert record.output_tokens == 600
        assert record.estimated_cost_usd == 0.063
        assert record.tool_name == "Bash"
        assert record.hook_event_id == 55

    def test_cost_record_from_dict_without_optionals(self) -> None:
        data = {
            "id": "cost-007",
            "timestamp": 1707581400.0,
            "session_id": "sess-stu901",
            "agent_id": "frontend",
            "model": "claude-haiku-4-5",
            "input_tokens": 50,
            "output_tokens": 25,
            "estimated_cost_usd": 0.00014,
        }
        record = CostRecord.from_dict(data)
        assert record.tool_name is None
        assert record.hook_event_id is None

    def test_cost_record_roundtrip(self) -> None:
        original = CostRecord(
            id="cost-008",
            timestamp=1707581500.0,
            session_id="sess-vwx234",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=3000,
            output_tokens=1500,
            estimated_cost_usd=0.1575,
            tool_name="Write",
            hook_event_id=77,
        )
        roundtripped = CostRecord.from_dict(original.to_dict())
        assert roundtripped == original


class TestCostFilter:
    """Tests for the CostFilter frozen dataclass."""

    def test_create_cost_filter_all_none(self) -> None:
        f = CostFilter()
        assert f.agent_id is None
        assert f.session_id is None
        assert f.model is None
        assert f.date_from is None
        assert f.date_to is None

    def test_create_cost_filter_with_values(self) -> None:
        f = CostFilter(
            agent_id="backend",
            session_id="sess-abc",
            model="claude-opus-4-6",
            date_from=1707500000.0,
            date_to=1707600000.0,
        )
        assert f.agent_id == "backend"
        assert f.session_id == "sess-abc"
        assert f.model == "claude-opus-4-6"
        assert f.date_from == 1707500000.0
        assert f.date_to == 1707600000.0

    def test_cost_filter_is_frozen(self) -> None:
        f = CostFilter(agent_id="pm")
        with pytest.raises(AttributeError):
            f.agent_id = "backend"  # type: ignore[misc]

    def test_cost_filter_to_dict(self) -> None:
        f = CostFilter(
            agent_id="pm",
            session_id="sess-xyz",
            model="claude-sonnet-4-5",
            date_from=1707500000.0,
            date_to=1707600000.0,
        )
        d = f.to_dict()
        assert d == {
            "agent_id": "pm",
            "session_id": "sess-xyz",
            "model": "claude-sonnet-4-5",
            "date_from": 1707500000.0,
            "date_to": 1707600000.0,
        }

    def test_cost_filter_to_dict_excludes_none(self) -> None:
        f = CostFilter(agent_id="pm")
        d = f.to_dict()
        assert d == {"agent_id": "pm"}
        assert "session_id" not in d
        assert "model" not in d
        assert "date_from" not in d
        assert "date_to" not in d

    def test_cost_filter_from_dict(self) -> None:
        data = {
            "agent_id": "frontend",
            "session_id": "sess-123",
            "model": "claude-haiku-4-5",
            "date_from": 1707500000.0,
            "date_to": 1707600000.0,
        }
        f = CostFilter.from_dict(data)
        assert f.agent_id == "frontend"
        assert f.session_id == "sess-123"
        assert f.model == "claude-haiku-4-5"
        assert f.date_from == 1707500000.0
        assert f.date_to == 1707600000.0

    def test_cost_filter_from_dict_empty(self) -> None:
        f = CostFilter.from_dict({})
        assert f.agent_id is None
        assert f.session_id is None
        assert f.model is None
        assert f.date_from is None
        assert f.date_to is None

    def test_cost_filter_roundtrip(self) -> None:
        original = CostFilter(
            agent_id="backend",
            model="claude-opus-4-6",
            date_from=1707500000.0,
        )
        roundtripped = CostFilter.from_dict(original.to_dict())
        assert roundtripped == original
