#!/usr/bin/env bash
# Start the aSDLC Telemetry Dashboard server in the background.
#
# Usage:
#   ./scripts/telemetry/start-dashboard.sh [--port 9191] [--stop]
#
# The server PID is stored at ~/.asdlc/dashboard.pid for stop functionality.

set -euo pipefail

PORT=9191
STOP=false
DB_PATH="${HOME}/.asdlc/telemetry.db"
PID_FILE="${HOME}/.asdlc/dashboard.pid"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)  PORT="$2"; shift 2 ;;
    --db)    DB_PATH="$2"; shift 2 ;;
    --stop)  STOP=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--port PORT] [--db DB_PATH] [--stop]"
      echo ""
      echo "  --port   HTTP port (default: 9191)"
      echo "  --db     Path to SQLite DB (default: ~/.asdlc/telemetry.db)"
      echo "  --stop   Stop a running dashboard server"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "${HOME}/.asdlc"

# -- Stop mode ----------------------------------------------------------------
if $STOP; then
  if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID"
      rm -f "$PID_FILE"
      echo "Dashboard server (PID $PID) stopped."
    else
      rm -f "$PID_FILE"
      echo "Dashboard server was not running (stale PID file cleaned up)."
    fi
  else
    echo "No PID file found. Dashboard server is not running."
  fi
  exit 0
fi

# -- Check if already running -------------------------------------------------
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Dashboard server is already running (PID $PID)."
    echo "  http://localhost:${PORT}"
    echo "Use --stop to stop it first."
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# -- Start server in background -----------------------------------------------
python3 "${SCRIPT_DIR}/dashboard_server.py" --port "$PORT" --db "$DB_PATH" &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Wait briefly to check the server started
sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "ERROR: Dashboard server failed to start."
  rm -f "$PID_FILE"
  exit 1
fi

echo "aSDLC Telemetry Dashboard started (PID $SERVER_PID)."
echo "  http://localhost:${PORT}"
echo ""
echo "Stop with: $0 --stop"

# Open in browser on macOS
if command -v open &>/dev/null; then
  open "http://localhost:${PORT}"
fi
