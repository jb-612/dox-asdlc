#!/usr/bin/env python3
"""Prometheus exporter for hook execution telemetry.

DEPRECATED: This exporter targets Docker-hosted VictoriaMetrics. For workstation
use, see scripts/telemetry/ (SQLite + dashboard).

Reads JSONL telemetry records written by hook-wrapper.py and exposes
Prometheus metrics on port 9191.

Metrics:
    asdlc_hook_executions_total{hook_name, event_type, exit_code} - Counter
    asdlc_hook_duration_seconds{hook_name, event_type} - Histogram
    asdlc_hook_errors_total{hook_name, error_type} - Counter

Usage:
    python3 -m src.infrastructure.hook_telemetry.prometheus_exporter
"""

import json
import os
import time
from collections import defaultdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from threading import Lock

TELEMETRY_FILE = Path("/tmp/hook-telemetry.jsonl")
PORT = int(os.environ.get("HOOK_TELEMETRY_PORT", "9191"))

# Histogram bucket boundaries (seconds)
DURATION_BUCKETS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]


class MetricsCollector:
    """Collects and aggregates hook telemetry metrics."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._last_position: int = 0
        self._executions: dict[tuple[str, str, int], int] = defaultdict(int)
        self._errors: dict[tuple[str, str], int] = defaultdict(int)
        self._duration_sum: dict[tuple[str, str], float] = defaultdict(float)
        self._duration_count: dict[tuple[str, str], int] = defaultdict(int)
        self._duration_buckets: dict[tuple[str, str, float], int] = defaultdict(int)

    def _read_new_records(self) -> list[dict]:
        """Read new JSONL records since last position."""
        records = []
        try:
            if not TELEMETRY_FILE.exists():
                return records
            with open(TELEMETRY_FILE, "r") as f:
                f.seek(self._last_position)
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            records.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                self._last_position = f.tell()
        except OSError:
            pass
        return records

    def collect(self) -> None:
        """Read new telemetry records and update metrics."""
        records = self._read_new_records()
        with self._lock:
            for record in records:
                hook_name = record.get("hook_name", "unknown")
                event_type = record.get("event_type", "unknown")
                exit_code = record.get("exit_code", 0)
                duration = record.get("duration_seconds", 0.0)
                error = record.get("error")

                # Execution counter
                self._executions[(hook_name, event_type, exit_code)] += 1

                # Error counter
                if exit_code != 0 and error:
                    error_type = "timeout" if exit_code == 124 else "command_not_found" if exit_code == 127 else "execution_error"
                    self._errors[(hook_name, error_type)] += 1

                # Duration histogram
                key = (hook_name, event_type)
                self._duration_sum[key] += duration
                self._duration_count[key] += 1
                for bucket in DURATION_BUCKETS:
                    if duration <= bucket:
                        self._duration_buckets[(*key, bucket)] += 1

    def format_metrics(self) -> str:
        """Format metrics in Prometheus exposition format."""
        self.collect()
        lines = []

        with self._lock:
            # Execution counter
            if self._executions:
                lines.append("# HELP asdlc_hook_executions_total Total number of hook executions")
                lines.append("# TYPE asdlc_hook_executions_total counter")
                for (hook_name, event_type, exit_code), count in sorted(self._executions.items()):
                    lines.append(
                        f'asdlc_hook_executions_total{{hook_name="{hook_name}",event_type="{event_type}",exit_code="{exit_code}"}} {count}'
                    )

            # Error counter
            if self._errors:
                lines.append("# HELP asdlc_hook_errors_total Total number of hook errors")
                lines.append("# TYPE asdlc_hook_errors_total counter")
                for (hook_name, error_type), count in sorted(self._errors.items()):
                    lines.append(
                        f'asdlc_hook_errors_total{{hook_name="{hook_name}",error_type="{error_type}"}} {count}'
                    )

            # Duration histogram
            if self._duration_count:
                lines.append("# HELP asdlc_hook_duration_seconds Hook execution duration in seconds")
                lines.append("# TYPE asdlc_hook_duration_seconds histogram")
                for key in sorted(self._duration_count.keys()):
                    hook_name, event_type = key
                    base_labels = f'hook_name="{hook_name}",event_type="{event_type}"'

                    # Buckets
                    cumulative = 0
                    for bucket in DURATION_BUCKETS:
                        cumulative += self._duration_buckets.get((*key, bucket), 0)
                        lines.append(f'asdlc_hook_duration_seconds_bucket{{{base_labels},le="{bucket}"}} {cumulative}')
                    lines.append(f'asdlc_hook_duration_seconds_bucket{{{base_labels},le="+Inf"}} {self._duration_count[key]}')
                    lines.append(f'asdlc_hook_duration_seconds_sum{{{base_labels}}} {self._duration_sum[key]:.4f}')
                    lines.append(f'asdlc_hook_duration_seconds_count{{{base_labels}}} {self._duration_count[key]}')

        lines.append("")
        return "\n".join(lines)


collector = MetricsCollector()


class MetricsHandler(BaseHTTPRequestHandler):
    """HTTP handler for /metrics endpoint."""

    def do_GET(self) -> None:
        if self.path == "/metrics":
            body = collector.format_metrics().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format: str, *args) -> None:
        """Suppress default HTTP logging."""
        pass


def main() -> None:
    server = HTTPServer(("0.0.0.0", PORT), MetricsHandler)
    print(f"Hook telemetry exporter listening on :{PORT}/metrics")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down hook telemetry exporter")
        server.shutdown()


if __name__ == "__main__":
    main()
