#!/usr/bin/env python3
"""SQLite telemetry store for aSDLC hook events.

Provides a WAL-mode SQLite database at ~/.asdlc/telemetry.db for storing
hook execution events and session metadata. Designed to be imported by
hook-wrapper.py and queried by dashboard_server.py.

All write operations fail silently to avoid breaking hooks.
"""

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from src.core.costs.models import CostFilter, CostRecord

DEFAULT_DB_PATH = Path.home() / ".asdlc" / "telemetry.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS hook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    session_id TEXT,
    source_app TEXT DEFAULT 'claude-code',
    hook_event_type TEXT,
    hook_name TEXT,
    exit_code INTEGER DEFAULT 0,
    duration_seconds REAL DEFAULT 0.0,
    tool_name TEXT,
    agent_id TEXT,
    blocked INTEGER DEFAULT 0,
    error TEXT,
    payload_json TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    started_at REAL NOT NULL,
    ended_at REAL,
    agent_type TEXT,
    instance_id TEXT,
    model TEXT
);

CREATE TABLE IF NOT EXISTS cost_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    session_id TEXT,
    agent_id TEXT,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_usd REAL DEFAULT 0.0,
    tool_name TEXT,
    hook_event_id INTEGER,
    payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_hook_events_timestamp ON hook_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_hook_events_session_id ON hook_events(session_id);
CREATE INDEX IF NOT EXISTS idx_hook_events_type ON hook_events(hook_event_type);
CREATE INDEX IF NOT EXISTS idx_cost_records_timestamp ON cost_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_records_session_id ON cost_records(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_agent_id ON cost_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_model ON cost_records(model);
"""


_thread_local = threading.local()


def _get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Get a thread-local WAL-mode SQLite connection.

    Reuses an existing connection for the current thread if the db_path
    matches, avoiding the overhead of creating a new connection per call.
    """
    path = db_path or DEFAULT_DB_PATH
    path_str = str(path)
    cached: Optional[sqlite3.Connection] = getattr(_thread_local, "conn", None)
    cached_path: Optional[str] = getattr(_thread_local, "conn_path", None)
    if cached is not None and cached_path == path_str:
        try:
            cached.execute("SELECT 1")
            return cached
        except sqlite3.ProgrammingError:
            pass
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path_str, timeout=5.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=3000")
    conn.row_factory = sqlite3.Row
    _thread_local.conn = conn
    _thread_local.conn_path = path_str
    return conn


def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize the database schema. Safe to call repeatedly."""
    try:
        conn = _get_connection(db_path)
        conn.executescript(_SCHEMA_SQL)
    except Exception:
        pass


def record_event(
    hook_name: str,
    hook_event_type: str,
    exit_code: int = 0,
    duration_seconds: float = 0.0,
    timestamp: Optional[float] = None,
    session_id: Optional[str] = None,
    tool_name: Optional[str] = None,
    agent_id: Optional[str] = None,
    blocked: bool = False,
    error: Optional[str] = None,
    payload: Optional[dict] = None,
    db_path: Optional[Path] = None,
) -> None:
    """Record a hook execution event. Fails silently on any error."""
    try:
        conn = _get_connection(db_path)
        conn.execute(
            """INSERT INTO hook_events
               (timestamp, session_id, hook_event_type, hook_name,
                exit_code, duration_seconds, tool_name, agent_id,
                blocked, error, payload_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                timestamp or time.time(),
                session_id,
                hook_event_type,
                hook_name,
                exit_code,
                round(duration_seconds, 4),
                tool_name,
                agent_id,
                1 if blocked else 0,
                error,
                json.dumps(payload) if payload else None,
            ),
        )
        conn.commit()
    except Exception:
        pass


def record_session_start(
    session_id: str,
    agent_type: Optional[str] = None,
    instance_id: Optional[str] = None,
    model: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> None:
    """Record a session start. Upserts by session_id. Fails silently."""
    try:
        conn = _get_connection(db_path)
        conn.execute(
            """INSERT INTO sessions (session_id, started_at, agent_type, instance_id, model)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(session_id) DO UPDATE SET
                   started_at = excluded.started_at,
                   agent_type = COALESCE(excluded.agent_type, sessions.agent_type),
                   instance_id = COALESCE(excluded.instance_id, sessions.instance_id),
                   model = COALESCE(excluded.model, sessions.model)""",
            (session_id, time.time(), agent_type, instance_id, model),
        )
        conn.commit()
    except Exception:
        pass


def record_session_end(
    session_id: str,
    db_path: Optional[Path] = None,
) -> None:
    """Mark a session as ended. Fails silently."""
    try:
        conn = _get_connection(db_path)
        conn.execute(
            "UPDATE sessions SET ended_at = ? WHERE session_id = ?",
            (time.time(), session_id),
        )
        conn.commit()
    except Exception:
        pass


def get_events(
    since: Optional[float] = None,
    session_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100,
    db_path: Optional[Path] = None,
) -> list[dict[str, Any]]:
    """Query hook events with optional filters. Returns list of dicts."""
    try:
        conn = _get_connection(db_path)
        clauses = []
        params: list[Any] = []
        if since is not None:
            clauses.append("timestamp > ?")
            params.append(since)
        if session_id is not None:
            clauses.append("session_id = ?")
            params.append(session_id)
        if event_type is not None:
            clauses.append("hook_event_type = ?")
            params.append(event_type)

        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        query = f"SELECT * FROM hook_events{where} ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    except Exception:
        return []


def get_sessions(
    active_only: bool = False,
    db_path: Optional[Path] = None,
) -> list[dict[str, Any]]:
    """Query sessions. If active_only, return only sessions without ended_at."""
    try:
        conn = _get_connection(db_path)
        if active_only:
            rows = conn.execute(
                "SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM sessions ORDER BY started_at DESC LIMIT 50"
            ).fetchall()
        return [dict(row) for row in rows]
    except Exception:
        return []


def get_stats(db_path: Optional[Path] = None) -> dict[str, Any]:
    """Compute aggregate statistics from the event store."""
    try:
        conn = _get_connection(db_path)

        total = conn.execute("SELECT COUNT(*) as c FROM hook_events").fetchone()["c"]
        errors = conn.execute(
            "SELECT COUNT(*) as c FROM hook_events WHERE exit_code != 0"
        ).fetchone()["c"]
        blocked = conn.execute(
            "SELECT COUNT(*) as c FROM hook_events WHERE blocked = 1"
        ).fetchone()["c"]

        avg_dur = conn.execute(
            "SELECT AVG(duration_seconds) as a FROM hook_events"
        ).fetchone()["a"]

        by_type = conn.execute(
            "SELECT hook_event_type, COUNT(*) as c FROM hook_events GROUP BY hook_event_type"
        ).fetchall()

        # Events in the last 60 seconds for events/minute rate
        one_min_ago = time.time() - 60
        recent = conn.execute(
            "SELECT COUNT(*) as c FROM hook_events WHERE timestamp > ?",
            (one_min_ago,),
        ).fetchone()["c"]

        active_sessions = conn.execute(
            "SELECT COUNT(*) as c FROM sessions WHERE ended_at IS NULL"
        ).fetchone()["c"]

        return {
            "total_events": total,
            "total_errors": errors,
            "total_blocked": blocked,
            "error_rate": round(errors / total, 4) if total > 0 else 0,
            "avg_duration_seconds": round(avg_dur or 0, 4),
            "events_per_minute": recent,
            "active_sessions": active_sessions,
            "by_type": {row["hook_event_type"]: row["c"] for row in by_type},
        }
    except Exception:
        return {
            "total_events": 0,
            "total_errors": 0,
            "total_blocked": 0,
            "error_rate": 0,
            "avg_duration_seconds": 0,
            "events_per_minute": 0,
            "active_sessions": 0,
            "by_type": {},
        }


# ---------------------------------------------------------------------------
# Cost record functions
# ---------------------------------------------------------------------------


def record_cost(
    cost_record: "CostRecord",
    db_path: Optional[Path] = None,
) -> None:
    """Insert a cost record into the cost_records table. Fails silently."""
    try:
        conn = _get_connection(db_path)
        conn.execute(
            """INSERT INTO cost_records
               (timestamp, session_id, agent_id, model,
                input_tokens, output_tokens, estimated_cost_usd,
                tool_name, hook_event_id, payload_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                cost_record.timestamp,
                cost_record.session_id,
                cost_record.agent_id,
                cost_record.model,
                cost_record.input_tokens,
                cost_record.output_tokens,
                cost_record.estimated_cost_usd,
                cost_record.tool_name,
                cost_record.hook_event_id,
                None,
            ),
        )
        conn.commit()
    except Exception:
        pass


def get_costs(
    filters: Optional["CostFilter"] = None,
    page: int = 1,
    page_size: int = 50,
    db_path: Optional[Path] = None,
) -> tuple[list[dict[str, Any]], int]:
    """Query cost records with optional filters and pagination.

    Returns:
        Tuple of (list of cost record dicts, total count).
    """
    try:
        conn = _get_connection(db_path)
        clauses: list[str] = []
        params: list[Any] = []

        if filters is not None:
            if filters.agent_id is not None:
                clauses.append("agent_id = ?")
                params.append(filters.agent_id)
            if filters.session_id is not None:
                clauses.append("session_id = ?")
                params.append(filters.session_id)
            if filters.model is not None:
                clauses.append("model = ?")
                params.append(filters.model)
            if filters.date_from is not None:
                clauses.append("timestamp >= ?")
                params.append(filters.date_from)
            if filters.date_to is not None:
                clauses.append("timestamp <= ?")
                params.append(filters.date_to)

        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""

        total = conn.execute(
            f"SELECT COUNT(*) as c FROM cost_records{where}", params
        ).fetchone()["c"]

        offset = (page - 1) * page_size
        query = (
            f"SELECT * FROM cost_records{where}"
            f" ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        )
        rows = conn.execute(query, params + [page_size, offset]).fetchall()
        return [dict(row) for row in rows], total
    except Exception:
        return [], 0


def get_cost_summary(
    group_by: str = "agent",
    filters: Optional["CostFilter"] = None,
    db_path: Optional[Path] = None,
) -> list[dict[str, Any]]:
    """Aggregate costs grouped by a dimension.

    Args:
        group_by: Grouping dimension -- "agent", "model", or "day".
        filters: Optional CostFilter for pre-filtering.
        db_path: Database path override.

    Returns:
        List of dicts with keys: group_key, total_cost_usd,
        total_input_tokens, total_output_tokens, record_count.
    """
    try:
        conn = _get_connection(db_path)
        clauses: list[str] = []
        params: list[Any] = []

        if filters is not None:
            if filters.agent_id is not None:
                clauses.append("agent_id = ?")
                params.append(filters.agent_id)
            if filters.session_id is not None:
                clauses.append("session_id = ?")
                params.append(filters.session_id)
            if filters.model is not None:
                clauses.append("model = ?")
                params.append(filters.model)
            if filters.date_from is not None:
                clauses.append("timestamp >= ?")
                params.append(filters.date_from)
            if filters.date_to is not None:
                clauses.append("timestamp <= ?")
                params.append(filters.date_to)

        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""

        if group_by == "model":
            group_col = "model"
        elif group_by == "day":
            group_col = "date(timestamp, 'unixepoch')"
        else:
            group_col = "agent_id"

        query = (
            f"SELECT {group_col} as group_key,"
            f" SUM(estimated_cost_usd) as total_cost_usd,"
            f" SUM(input_tokens) as total_input_tokens,"
            f" SUM(output_tokens) as total_output_tokens,"
            f" COUNT(*) as record_count"
            f" FROM cost_records{where}"
            f" GROUP BY {group_col}"
            f" ORDER BY total_cost_usd DESC"
        )
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    except Exception:
        return []


def get_session_costs(
    session_id: str,
    db_path: Optional[Path] = None,
) -> dict[str, Any]:
    """Get per-session cost breakdown by model and tool.

    Returns:
        Dict with model_breakdown, tool_breakdown, and total_cost_usd.
    """
    empty: dict[str, Any] = {
        "model_breakdown": [],
        "tool_breakdown": [],
        "total_cost_usd": 0,
    }
    try:
        conn = _get_connection(db_path)

        model_rows = conn.execute(
            """SELECT model,
                      SUM(input_tokens) as input_tokens,
                      SUM(output_tokens) as output_tokens,
                      SUM(estimated_cost_usd) as cost_usd
               FROM cost_records
               WHERE session_id = ?
               GROUP BY model
               ORDER BY cost_usd DESC""",
            (session_id,),
        ).fetchall()

        tool_rows = conn.execute(
            """SELECT tool_name,
                      COUNT(*) as call_count,
                      SUM(estimated_cost_usd) as total_cost_usd
               FROM cost_records
               WHERE session_id = ?
               GROUP BY tool_name
               ORDER BY total_cost_usd DESC""",
            (session_id,),
        ).fetchall()

        total_row = conn.execute(
            "SELECT SUM(estimated_cost_usd) as total FROM cost_records WHERE session_id = ?",
            (session_id,),
        ).fetchone()

        return {
            "model_breakdown": [dict(r) for r in model_rows],
            "tool_breakdown": [dict(r) for r in tool_rows],
            "total_cost_usd": total_row["total"] or 0,
        }
    except Exception:
        return empty
