#!/bin/bash
# Watch for real-time notifications via Redis pub/sub
#
# Usage: ./scripts/coordination/watch-notifications.sh
#
# This script subscribes to the notification channel for the current
# instance and displays notifications as they arrive. Use Ctrl+C to exit.
#
# Requires:
#   - Identity file at .claude/instance-identity.json (created by launcher scripts)
#   - Redis available on REDIS_HOST:REDIS_PORT

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

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
KEY_PREFIX="${COORD_KEY_PREFIX:-coord}"

# Colors for output (if terminal supports it)
if [[ -t 1 ]]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    NC='\033[0m' # No Color
else
    GREEN=''
    YELLOW=''
    CYAN=''
    NC=''
fi

usage() {
    echo "Usage: ./scripts/coordination/watch-notifications.sh"
    echo ""
    echo "Watches for real-time notifications on the current instance's channel."
    echo ""
    echo "Prerequisites:"
    echo "  Start a Claude Code session with a launcher script:"
    echo "    ./start-backend.sh      # For backend development"
    echo "    ./start-frontend.sh     # For frontend development"
    echo "    ./start-orchestrator.sh # For review/merge operations"
    echo ""
    echo "Environment variables (optional):"
    echo "  REDIS_HOST          - Redis host (default: localhost)"
    echo "  REDIS_PORT          - Redis port (default: 6379)"
    echo ""
    echo "Press Ctrl+C to stop watching."
}

# Check if Redis is available
check_redis() {
    if ! command -v redis-cli &>/dev/null; then
        echo "Error: redis-cli not found. Please install Redis CLI tools." >&2
        exit 1
    fi

    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
        echo "Error: Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT" >&2
        exit 1
    fi
}

# Parse and display a notification message
display_notification() {
    local json_str="$1"

    # Use Python to parse the JSON
    python3 << PYEOF
import json
import sys

try:
    data = json.loads('''$json_str''')
    msg_type = data.get('type', 'UNKNOWN')
    from_inst = data.get('from', '?')
    to_inst = data.get('to', '?')
    msg_id = data.get('message_id', '?')
    requires_ack = data.get('requires_ack', False)
    timestamp = data.get('timestamp', '?')

    print()
    print("$GREEN=== NEW NOTIFICATION ===$NC")
    print(f"  Type: $CYAN{msg_type}$NC")
    print(f"  From: {from_inst}")
    print(f"  To: {to_inst}")
    print(f"  Message ID: {msg_id}")
    print(f"  Requires Ack: {requires_ack}")
    print(f"  Timestamp: {timestamp}")
    print()
except json.JSONDecodeError:
    print(f"  (unparseable notification: {'''$json_str'''[:50]}...)")
PYEOF
}

main() {
    # Parse arguments
    case "${1:-}" in
        -h|--help)
            usage
            exit 0
            ;;
    esac

    # Get instance ID from identity file
    local instance_id
    instance_id=$(get_instance_id)

    if [[ -z "$instance_id" ]]; then
        echo "Error: Identity file not found or invalid." >&2
        echo "Start Claude Code using a launcher script first:" >&2
        echo "  ./start-backend.sh      # For backend development" >&2
        echo "  ./start-frontend.sh     # For frontend development" >&2
        echo "  ./start-orchestrator.sh # For review/merge operations" >&2
        exit 1
    fi

    # Check Redis availability
    check_redis

    local channel="${KEY_PREFIX}:notify:${instance_id}"

    echo -e "${YELLOW}Watching for notifications on channel: $channel${NC}"
    echo "Press Ctrl+C to stop..."
    echo ""

    # Subscribe to the channel
    # redis-cli SUBSCRIBE outputs:
    # 1) "subscribe"
    # 2) "channel_name"
    # 3) (integer) 1
    # Then for each message:
    # 1) "message"
    # 2) "channel_name"
    # 3) "the actual message"

    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SUBSCRIBE "$channel" 2>/dev/null | while read -r line; do
        # Skip the initial "subscribe" response and channel name lines
        if [[ "$line" == "message" ]]; then
            # Read channel name (skip it)
            read -r channel_line
            # Read the actual message
            read -r message
            display_notification "$message"
        fi
    done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Stopped watching notifications.${NC}"; exit 0' INT

main "$@"
