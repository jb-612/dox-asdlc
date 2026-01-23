#!/bin/bash
# Common helper functions for coordination scripts
#
# This library provides shared functionality for coordination bash scripts
# including backend detection, Python coordination calls, and JSON helpers.
#
# Usage:
#   source scripts/coordination/lib/common.sh
#

# Project root detection
COMMON_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$COMMON_SCRIPT_DIR/../../.." && pwd)"

# Python executable detection - prefer venv if available
if [[ -x "$PROJECT_ROOT/.venv/bin/python" ]]; then
    PYTHON_CMD="$PROJECT_ROOT/.venv/bin/python"
elif [[ -x "$PROJECT_ROOT/venv/bin/python" ]]; then
    PYTHON_CMD="$PROJECT_ROOT/venv/bin/python"
else
    PYTHON_CMD="python3"
fi

# =============================================================================
# Backend Detection
# =============================================================================

# Check if Redis is available
check_redis_available() {
    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    # Try to ping Redis
    if command -v redis-cli &>/dev/null; then
        if redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; then
            return 0
        fi
    fi

    return 1
}

# Check if Python coordination module is available
check_python_coordination_available() {
    $PYTHON_CMD -c "from src.infrastructure.coordination import get_coordination_client" 2>/dev/null
}

# Determine which coordination backend to use
# Returns: "redis" or "filesystem"
check_coordination_backend() {
    # Check environment override
    if [[ "${DISABLE_REDIS_COORDINATION:-}" == "true" ]]; then
        echo "filesystem"
        return
    fi

    # Check prerequisites for Redis backend
    if [[ -z "${CLAUDE_INSTANCE_ID:-}" ]]; then
        echo "filesystem"
        return
    fi

    if check_redis_available && check_python_coordination_available; then
        echo "redis"
    else
        echo "filesystem"
    fi
}

# =============================================================================
# Python Coordination Calls
# =============================================================================

# Call Python coordination module for publish
# Args: msg_type subject description [--to instance] [--no-ack]
call_python_publish() {
    local msg_type="$1"
    local subject="$2"
    local description="$3"
    local to_instance="${4:-orchestrator}"
    local requires_ack="${5:-true}"

    export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

    $PYTHON_CMD << PYEOF
import asyncio
import json
import sys

async def main():
    import redis.asyncio as redis
    from src.infrastructure.coordination.client import CoordinationClient
    from src.infrastructure.coordination.config import CoordinationConfig
    from src.infrastructure.coordination.types import MessageType

    try:
        # Create Redis client directly (bypass factory to avoid asyncio.Lock issues)
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        client = CoordinationClient(redis_client=r, config=config, instance_id="$CLAUDE_INSTANCE_ID")
        msg = await client.publish_message(
            msg_type=MessageType("$msg_type"),
            subject="$subject",
            description="""$description""",
            from_instance="$CLAUDE_INSTANCE_ID",
            to_instance="$to_instance",
            requires_ack=$requires_ack,
        )
        print(json.dumps({
            "success": True,
            "message_id": msg.id,
            "type": msg.type.value,
            "from": msg.from_instance,
            "to": msg.to_instance,
        }))
        await r.aclose()
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
        }))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

# Call Python coordination module for check
# Args: [--to instance] [--from instance] [--type type] [--pending]
call_python_check() {
    local to_instance="${1:-}"
    local from_instance="${2:-}"
    local msg_type="${3:-}"
    local pending_only="${4:-false}"
    local limit="${5:-100}"

    export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

    $PYTHON_CMD << PYEOF
import asyncio
import json
import sys

async def main():
    import redis.asyncio as redis
    from src.infrastructure.coordination.client import CoordinationClient
    from src.infrastructure.coordination.config import CoordinationConfig
    from src.infrastructure.coordination.types import MessageQuery, MessageType

    try:
        # Create Redis client directly (bypass factory to avoid asyncio.Lock issues)
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        query_type = None
        if "$msg_type":
            query_type = MessageType("$msg_type")

        query = MessageQuery(
            to_instance="${to_instance}" if "${to_instance}" else None,
            from_instance="${from_instance}" if "${from_instance}" else None,
            msg_type=query_type,
            pending_only=$pending_only,
            limit=$limit,
        )

        client = CoordinationClient(redis_client=r, config=config, instance_id="$CLAUDE_INSTANCE_ID")
        messages = await client.get_messages(query)

        print(json.dumps({
            "success": True,
            "count": len(messages),
            "messages": [msg.to_dict() for msg in messages],
        }))
        await r.aclose()
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
        }))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

# Call Python coordination module for acknowledge
# Args: message_id [comment]
call_python_ack() {
    local message_id="$1"
    local comment="${2:-}"

    export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

    $PYTHON_CMD << PYEOF
import asyncio
import json
import sys

async def main():
    import redis.asyncio as redis
    from src.infrastructure.coordination.client import CoordinationClient
    from src.infrastructure.coordination.config import CoordinationConfig

    try:
        # Create Redis client directly (bypass factory to avoid asyncio.Lock issues)
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        client = CoordinationClient(redis_client=r, config=config, instance_id="$CLAUDE_INSTANCE_ID")
        comment = """$comment""" if """$comment""" else None
        result = await client.acknowledge_message(
            message_id="$message_id",
            ack_by="$CLAUDE_INSTANCE_ID",
            comment=comment,
        )

        if result:
            print(json.dumps({
                "success": True,
                "message_id": "$message_id",
                "acknowledged_by": "$CLAUDE_INSTANCE_ID",
            }))
        else:
            print(json.dumps({
                "success": False,
                "error": "Message not found: $message_id",
            }))
            sys.exit(1)
        await r.aclose()
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
        }))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

# =============================================================================
# JSON Output Helpers
# =============================================================================

# Emit a success JSON response
# Args: key=value pairs
emit_success() {
    local output='{"success": true'
    for arg in "$@"; do
        local key="${arg%%=*}"
        local value="${arg#*=}"
        output+=", \"$key\": \"$value\""
    done
    output+='}'
    echo "$output"
}

# Emit an error JSON response
# Args: error_message
emit_error() {
    local error="$1"
    echo "{\"success\": false, \"error\": \"$error\"}"
}

# Emit JSON result from a variable
# Args: json_string
emit_result() {
    echo "$1"
}

# =============================================================================
# Redis Lock Management
# =============================================================================

# Acquire a lock in Redis
# Args: lock_name [expire_seconds]
acquire_lock() {
    local lock_name="$1"
    local expire="${2:-300}"  # Default 5 min expiry
    local lock_key="asdlc:coord:lock:${lock_name}"

    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    # Try to set lock with NX (only if not exists) and EX (expiry)
    local result
    result=$(redis-cli -h "$host" -p "$port" SET "$lock_key" "${CLAUDE_INSTANCE_ID:-unknown}" NX EX "$expire" 2>/dev/null)

    if [[ "$result" == "OK" ]]; then
        # Also add to locks set for tracking
        redis-cli -h "$host" -p "$port" SADD "asdlc:coord:locks" "$lock_name" > /dev/null 2>&1
        return 0
    fi
    return 1
}

# Release a lock in Redis
# Args: lock_name
release_lock() {
    local lock_name="$1"
    local lock_key="asdlc:coord:lock:${lock_name}"

    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    redis-cli -h "$host" -p "$port" DEL "$lock_key" > /dev/null 2>&1
    redis-cli -h "$host" -p "$port" SREM "asdlc:coord:locks" "$lock_name" > /dev/null 2>&1
}

# Check if a lock is held
# Args: lock_name
check_lock() {
    local lock_name="$1"
    local lock_key="asdlc:coord:lock:${lock_name}"

    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    local holder
    holder=$(redis-cli -h "$host" -p "$port" GET "$lock_key" 2>/dev/null)

    if [[ -n "$holder" ]]; then
        echo "$holder"
        return 0
    fi
    return 1
}

# =============================================================================
# Logging Helpers
# =============================================================================

# Log a debug message to stderr
log_debug() {
    if [[ "${DEBUG:-}" == "true" ]]; then
        echo "[DEBUG] $*" >&2
    fi
}

# Log an info message to stderr
log_info() {
    echo "[INFO] $*" >&2
}

# Log a warning message to stderr
log_warn() {
    echo "[WARN] $*" >&2
}

# Log an error message to stderr
log_error() {
    echo "[ERROR] $*" >&2
}
