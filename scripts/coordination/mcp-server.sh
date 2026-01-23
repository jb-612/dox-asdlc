#!/bin/bash
# MCP server launcher for CLI coordination
#
# Launches the Python MCP server for coordination tools.
# This script reads identity from .claude/instance-identity.json
# which is created by the launcher scripts (start-backend.sh, etc.)
#
# Environment variables:
#   REDIS_HOST - Redis server hostname (default: localhost)
#   REDIS_PORT - Redis server port (default: 6379)
#
# Usage:
#   ./scripts/coordination/mcp-server.sh
#   ./scripts/coordination/mcp-server.sh --check  # Check if server can start
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read instance ID from identity file
get_instance_id() {
    local identity_file="$PROJECT_ROOT/.claude/instance-identity.json"
    if [[ ! -f "$identity_file" ]]; then
        echo ""
        return
    fi
    python3 -c "import json; print(json.load(open('$identity_file')).get('instance_id', ''))" 2>/dev/null || echo ""
}

# Load common functions
source "$SCRIPT_DIR/lib/common.sh" 2>/dev/null || true

# Check mode
check_only=false
if [[ "${1:-}" == "--check" ]]; then
    check_only=true
fi

# Get instance ID from identity file
CLAUDE_INSTANCE_ID=$(get_instance_id)

if [[ -z "$CLAUDE_INSTANCE_ID" ]]; then
    echo "ERROR: Identity file not found or invalid" >&2
    echo "Start Claude Code using a launcher script first:" >&2
    echo "  ./start-backend.sh" >&2
    exit 1
fi

# Export for Python module
export CLAUDE_INSTANCE_ID

# Check Python module availability
if ! python3 -c "from src.infrastructure.coordination.mcp_server import main" 2>/dev/null; then
    echo "ERROR: Coordination MCP server module not available" >&2
    exit 1
fi

# Check Redis availability
if ! check_redis_available 2>/dev/null; then
    echo "WARNING: Redis not available, MCP server will fail to connect" >&2
    if [[ "$check_only" == "true" ]]; then
        exit 1
    fi
fi

if [[ "$check_only" == "true" ]]; then
    echo "MCP server prerequisites met"
    exit 0
fi

# Set PYTHONPATH for module imports
export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

# Log startup
echo "Starting coordination MCP server (instance: $CLAUDE_INSTANCE_ID)" >&2

# Execute the MCP server
exec python3 -m src.infrastructure.coordination.mcp_server
