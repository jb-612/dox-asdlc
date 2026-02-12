#!/usr/bin/env python3
"""HTTP dashboard server for aSDLC hook telemetry.

Zero external dependencies -- uses only Python stdlib (http.server, sqlite3, json).

Endpoints:
    GET /             -> Serves dashboard.html
    GET /api/events   -> Paginated hook events (query params: since, session, type, limit)
    GET /api/sessions -> Active and recent sessions
    GET /api/stats    -> Aggregate statistics
    GET /stream       -> SSE endpoint, polls SQLite every 2s for new events

Usage:
    python3 scripts/telemetry/dashboard_server.py [--port 9191] [--db ~/.asdlc/telemetry.db]
"""

import argparse
import json
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from threading import Event
from urllib.parse import urlparse, parse_qs

# Ensure the scripts directory is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sqlite_store


class DashboardHandler(BaseHTTPRequestHandler):
    """Routes requests to the appropriate handler."""

    # Assigned at server startup
    db_path: Path = sqlite_store.DEFAULT_DB_PATH

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)

        routes = {
            "/": self._serve_dashboard,
            "/api/events": self._api_events,
            "/api/sessions": self._api_sessions,
            "/api/stats": self._api_stats,
            "/stream": self._sse_stream,
            "/health": self._health,
        }

        handler = routes.get(path)
        if handler:
            handler(params)
        else:
            self._send_json({"error": "not found"}, status=404)

    # -- HTML ------------------------------------------------------------------

    def _serve_dashboard(self, _params: dict) -> None:
        html_path = Path(__file__).resolve().parent / "dashboard.html"
        if not html_path.exists():
            self._send_text("dashboard.html not found", status=404)
            return
        body = html_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # -- JSON API --------------------------------------------------------------

    def _api_events(self, params: dict) -> None:
        since = _first_float(params, "since")
        session = _first_str(params, "session")
        etype = _first_str(params, "type")
        limit = _first_int(params, "limit", default=100)
        events = sqlite_store.get_events(
            since=since, session_id=session, event_type=etype,
            limit=min(limit, 500), db_path=self.db_path,
        )
        self._send_json({"events": events, "count": len(events)})

    def _api_sessions(self, _params: dict) -> None:
        sessions = sqlite_store.get_sessions(db_path=self.db_path)
        self._send_json({"sessions": sessions, "count": len(sessions)})

    def _api_stats(self, _params: dict) -> None:
        stats = sqlite_store.get_stats(db_path=self.db_path)
        self._send_json(stats)

    def _health(self, _params: dict) -> None:
        self._send_json({"status": "ok", "db": str(self.db_path)})

    # -- SSE -------------------------------------------------------------------

    def _sse_stream(self, _params: dict) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        last_ts = time.time()
        try:
            while True:
                events = sqlite_store.get_events(
                    since=last_ts, limit=50, db_path=self.db_path,
                )
                if events:
                    # Events come back newest-first; update watermark to newest
                    last_ts = max(e["timestamp"] for e in events)
                    payload = json.dumps({"events": events})
                    self.wfile.write(f"data: {payload}\n\n".encode())
                    self.wfile.flush()
                else:
                    # Send heartbeat to keep connection alive
                    self.wfile.write(": heartbeat\n\n".encode())
                    self.wfile.flush()
                time.sleep(2)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    # -- Helpers ---------------------------------------------------------------

    def _send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, text: str, status: int = 200) -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:
        """Suppress default request logging to keep terminal clean."""
        pass


# -- Parameter helpers ---------------------------------------------------------

def _first_str(params: dict, key: str) -> str | None:
    vals = params.get(key, [])
    return vals[0] if vals else None


def _first_float(params: dict, key: str) -> float | None:
    val = _first_str(params, key)
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _first_int(params: dict, key: str, default: int = 100) -> int:
    val = _first_str(params, key)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        return default


# -- Main ----------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="aSDLC Telemetry Dashboard")
    parser.add_argument("--port", type=int, default=9191, help="HTTP port (default: 9191)")
    parser.add_argument(
        "--db", type=str, default=str(sqlite_store.DEFAULT_DB_PATH),
        help="Path to SQLite database (default: ~/.asdlc/telemetry.db)",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    DashboardHandler.db_path = db_path

    # Ensure DB and tables exist
    sqlite_store.init_db(db_path)

    server = HTTPServer(("127.0.0.1", args.port), DashboardHandler)
    print(f"aSDLC Telemetry Dashboard: http://localhost:{args.port}")
    print(f"Database: {db_path}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down dashboard server.")
        server.shutdown()


if __name__ == "__main__":
    main()
