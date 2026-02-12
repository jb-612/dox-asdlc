"""Tests for SQLite cost record storage functions."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

import pytest

from src.core.costs.models import CostFilter, CostRecord

# Import the module under test -- these functions will be added to sqlite_store
from scripts.telemetry.sqlite_store import (
    get_cost_summary,
    get_costs,
    get_session_costs,
    init_db,
    record_cost,
)


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    """Create a temporary database for testing."""
    path = tmp_path / "test_telemetry.db"
    init_db(path)
    return path


@pytest.fixture()
def populated_db(db_path: Path) -> Path:
    """Populate the database with sample cost records."""
    now = time.time()
    records = [
        CostRecord(
            id="cost-001",
            timestamp=now - 3600,
            session_id="sess-aaa",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=1500,
            output_tokens=800,
            estimated_cost_usd=0.0825,
            tool_name="Read",
        ),
        CostRecord(
            id="cost-002",
            timestamp=now - 3000,
            session_id="sess-aaa",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=2000,
            output_tokens=1000,
            estimated_cost_usd=0.105,
            tool_name="Edit",
        ),
        CostRecord(
            id="cost-003",
            timestamp=now - 2400,
            session_id="sess-bbb",
            agent_id="backend",
            model="claude-sonnet-4-5",
            input_tokens=5000,
            output_tokens=2500,
            estimated_cost_usd=0.0525,
            tool_name="Write",
        ),
        CostRecord(
            id="cost-004",
            timestamp=now - 1800,
            session_id="sess-bbb",
            agent_id="backend",
            model="claude-sonnet-4-5",
            input_tokens=3000,
            output_tokens=1500,
            estimated_cost_usd=0.0315,
            tool_name="Bash",
        ),
        CostRecord(
            id="cost-005",
            timestamp=now - 1200,
            session_id="sess-ccc",
            agent_id="frontend",
            model="claude-haiku-4-5",
            input_tokens=10000,
            output_tokens=5000,
            estimated_cost_usd=0.028,
            tool_name="Read",
        ),
    ]
    for rec in records:
        record_cost(rec, db_path=db_path)
    return db_path


class TestCostRecordsTable:
    """Tests for cost_records table creation."""

    def test_table_exists_after_init(self, db_path: Path) -> None:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='cost_records'"
        )
        assert cursor.fetchone() is not None
        conn.close()

    def test_table_has_expected_columns(self, db_path: Path) -> None:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("PRAGMA table_info(cost_records)")
        columns = {row[1] for row in cursor.fetchall()}
        expected = {
            "id",
            "timestamp",
            "session_id",
            "agent_id",
            "model",
            "input_tokens",
            "output_tokens",
            "estimated_cost_usd",
            "tool_name",
            "hook_event_id",
            "payload_json",
        }
        assert expected.issubset(columns)
        conn.close()

    def test_indexes_exist(self, db_path: Path) -> None:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_cost_records_%'"
        )
        index_names = {row[0] for row in cursor.fetchall()}
        assert "idx_cost_records_timestamp" in index_names
        assert "idx_cost_records_session_id" in index_names
        assert "idx_cost_records_agent_id" in index_names
        assert "idx_cost_records_model" in index_names
        conn.close()


class TestRecordCost:
    """Tests for record_cost()."""

    def test_insert_cost_record(self, db_path: Path) -> None:
        record = CostRecord(
            id="cost-test-001",
            timestamp=time.time(),
            session_id="sess-test",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=1000,
            output_tokens=500,
            estimated_cost_usd=0.0525,
            tool_name="Read",
        )
        record_cost(record, db_path=db_path)

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM cost_records WHERE session_id = 'sess-test'"
        ).fetchone()
        assert row is not None
        assert row["session_id"] == "sess-test"
        assert row["agent_id"] == "pm"
        assert row["model"] == "claude-opus-4-6"
        assert row["input_tokens"] == 1000
        assert row["output_tokens"] == 500
        assert row["estimated_cost_usd"] == pytest.approx(0.0525)
        assert row["tool_name"] == "Read"
        conn.close()

    def test_insert_with_none_optional_fields(self, db_path: Path) -> None:
        record = CostRecord(
            id="cost-test-002",
            timestamp=time.time(),
            session_id="sess-test2",
            agent_id="backend",
            model="claude-sonnet-4-5",
            input_tokens=500,
            output_tokens=200,
            estimated_cost_usd=0.0045,
        )
        record_cost(record, db_path=db_path)

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM cost_records WHERE session_id = 'sess-test2'"
        ).fetchone()
        assert row is not None
        assert row["tool_name"] is None
        assert row["hook_event_id"] is None
        conn.close()

    def test_insert_fails_silently_on_bad_db(self, tmp_path: Path) -> None:
        bad_path = tmp_path / "nonexistent" / "subdir" / "db.sqlite"
        record = CostRecord(
            id="cost-bad",
            timestamp=time.time(),
            session_id="sess-bad",
            agent_id="pm",
            model="claude-opus-4-6",
            input_tokens=100,
            output_tokens=50,
            estimated_cost_usd=0.005,
        )
        # Should not raise
        record_cost(record, db_path=bad_path)


class TestGetCosts:
    """Tests for get_costs()."""

    def test_get_all_costs(self, populated_db: Path) -> None:
        records, total = get_costs(db_path=populated_db)
        assert total == 5
        assert len(records) == 5

    def test_filter_by_agent_id(self, populated_db: Path) -> None:
        filters = CostFilter(agent_id="pm")
        records, total = get_costs(filters=filters, db_path=populated_db)
        assert total == 2
        assert all(r["agent_id"] == "pm" for r in records)

    def test_filter_by_session_id(self, populated_db: Path) -> None:
        filters = CostFilter(session_id="sess-bbb")
        records, total = get_costs(filters=filters, db_path=populated_db)
        assert total == 2
        assert all(r["session_id"] == "sess-bbb" for r in records)

    def test_filter_by_model(self, populated_db: Path) -> None:
        filters = CostFilter(model="claude-haiku-4-5")
        records, total = get_costs(filters=filters, db_path=populated_db)
        assert total == 1
        assert records[0]["model"] == "claude-haiku-4-5"

    def test_filter_by_date_range(self, populated_db: Path) -> None:
        now = time.time()
        filters = CostFilter(date_from=now - 2000, date_to=now)
        records, total = get_costs(filters=filters, db_path=populated_db)
        assert total == 2  # cost-004 and cost-005

    def test_pagination_page_1(self, populated_db: Path) -> None:
        records, total = get_costs(page=1, page_size=2, db_path=populated_db)
        assert total == 5
        assert len(records) == 2

    def test_pagination_page_2(self, populated_db: Path) -> None:
        records, total = get_costs(page=2, page_size=2, db_path=populated_db)
        assert total == 5
        assert len(records) == 2

    def test_pagination_last_page(self, populated_db: Path) -> None:
        records, total = get_costs(page=3, page_size=2, db_path=populated_db)
        assert total == 5
        assert len(records) == 1

    def test_empty_result(self, db_path: Path) -> None:
        records, total = get_costs(db_path=db_path)
        assert total == 0
        assert len(records) == 0

    def test_combined_filters(self, populated_db: Path) -> None:
        filters = CostFilter(agent_id="pm", model="claude-opus-4-6")
        records, total = get_costs(filters=filters, db_path=populated_db)
        assert total == 2
        assert all(r["agent_id"] == "pm" and r["model"] == "claude-opus-4-6" for r in records)

    def test_returns_dicts(self, populated_db: Path) -> None:
        records, total = get_costs(page_size=1, db_path=populated_db)
        assert len(records) == 1
        rec = records[0]
        assert isinstance(rec, dict)
        assert "session_id" in rec
        assert "agent_id" in rec
        assert "model" in rec
        assert "input_tokens" in rec
        assert "output_tokens" in rec
        assert "estimated_cost_usd" in rec


class TestGetCostSummary:
    """Tests for get_cost_summary()."""

    def test_group_by_agent(self, populated_db: Path) -> None:
        groups = get_cost_summary(group_by="agent", db_path=populated_db)
        assert len(groups) == 3
        keys = {g["group_key"] for g in groups}
        assert keys == {"pm", "backend", "frontend"}

    def test_group_by_model(self, populated_db: Path) -> None:
        groups = get_cost_summary(group_by="model", db_path=populated_db)
        assert len(groups) == 3
        keys = {g["group_key"] for g in groups}
        assert keys == {"claude-opus-4-6", "claude-sonnet-4-5", "claude-haiku-4-5"}

    def test_group_by_day(self, populated_db: Path) -> None:
        groups = get_cost_summary(group_by="day", db_path=populated_db)
        assert len(groups) >= 1
        for g in groups:
            assert "group_key" in g
            assert "total_cost_usd" in g
            assert "total_input_tokens" in g
            assert "total_output_tokens" in g
            assert "record_count" in g

    def test_summary_aggregation_values(self, populated_db: Path) -> None:
        groups = get_cost_summary(group_by="agent", db_path=populated_db)
        pm_group = next(g for g in groups if g["group_key"] == "pm")
        assert pm_group["record_count"] == 2
        assert pm_group["total_input_tokens"] == 3500  # 1500 + 2000
        assert pm_group["total_output_tokens"] == 1800  # 800 + 1000
        assert pm_group["total_cost_usd"] == pytest.approx(0.0825 + 0.105)

    def test_summary_with_filter(self, populated_db: Path) -> None:
        filters = CostFilter(agent_id="pm")
        groups = get_cost_summary(
            group_by="model", filters=filters, db_path=populated_db
        )
        assert len(groups) == 1
        assert groups[0]["group_key"] == "claude-opus-4-6"

    def test_empty_result(self, db_path: Path) -> None:
        groups = get_cost_summary(group_by="agent", db_path=db_path)
        assert groups == []


class TestGetSessionCosts:
    """Tests for get_session_costs()."""

    def test_session_breakdown(self, populated_db: Path) -> None:
        result = get_session_costs("sess-aaa", db_path=populated_db)
        assert result is not None
        assert "model_breakdown" in result
        assert "tool_breakdown" in result
        assert "total_cost_usd" in result

    def test_model_breakdown_values(self, populated_db: Path) -> None:
        result = get_session_costs("sess-aaa", db_path=populated_db)
        assert len(result["model_breakdown"]) == 1
        model_entry = result["model_breakdown"][0]
        assert model_entry["model"] == "claude-opus-4-6"
        assert model_entry["input_tokens"] == 3500
        assert model_entry["output_tokens"] == 1800
        assert model_entry["cost_usd"] == pytest.approx(0.0825 + 0.105)

    def test_tool_breakdown_values(self, populated_db: Path) -> None:
        result = get_session_costs("sess-aaa", db_path=populated_db)
        tools = {t["tool_name"]: t for t in result["tool_breakdown"]}
        assert "Read" in tools
        assert "Edit" in tools
        assert tools["Read"]["call_count"] == 1
        assert tools["Edit"]["call_count"] == 1

    def test_total_cost(self, populated_db: Path) -> None:
        result = get_session_costs("sess-aaa", db_path=populated_db)
        assert result["total_cost_usd"] == pytest.approx(0.0825 + 0.105)

    def test_nonexistent_session(self, populated_db: Path) -> None:
        result = get_session_costs("sess-nonexistent", db_path=populated_db)
        assert result["total_cost_usd"] == 0
        assert result["model_breakdown"] == []
        assert result["tool_breakdown"] == []

    def test_session_with_multiple_models(self, populated_db: Path) -> None:
        # Add a record with different model to sess-bbb
        record = CostRecord(
            id="cost-extra",
            timestamp=time.time(),
            session_id="sess-bbb",
            agent_id="backend",
            model="claude-opus-4-6",
            input_tokens=1000,
            output_tokens=500,
            estimated_cost_usd=0.0525,
            tool_name="Read",
        )
        record_cost(record, db_path=populated_db)
        result = get_session_costs("sess-bbb", db_path=populated_db)
        assert len(result["model_breakdown"]) == 2
