#!/bin/bash
# Common helper functions for coordination scripts (Redis backend)
#
# Usage:
#   source scripts/coordination/lib/common.sh

# Project root detection
if git rev-parse --show-toplevel &>/dev/null; then
    PROJECT_ROOT="$(git rev-parse --show-toplevel)"
else
    COMMON_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
    PROJECT_ROOT="$(cd "$COMMON_SCRIPT_DIR/../../.." && pwd)"
fi

# Python executable - prefer venv
if [[ -x "$PROJECT_ROOT/.venv/bin/python" ]]; then
    PYTHON_CMD="$PROJECT_ROOT/.venv/bin/python"
elif [[ -x "$PROJECT_ROOT/venv/bin/python" ]]; then
    PYTHON_CMD="$PROJECT_ROOT/venv/bin/python"
else
    PYTHON_CMD="python3"
fi

# =============================================================================
# Instance Identity (from CLAUDE_INSTANCE_ID env var)
# =============================================================================

# Get instance ID from the CLAUDE_INSTANCE_ID environment variable
get_instance_id() {
    echo "${CLAUDE_INSTANCE_ID:-pm}"
}

# Cache the instance ID for the session
COORD_INSTANCE_ID="${COORD_INSTANCE_ID:-$(get_instance_id)}"

# =============================================================================
# Redis Connectivity
# =============================================================================

check_redis_available() {
    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    if command -v redis-cli &>/dev/null; then
        redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"
        return $?
    fi
    return 1
}

# =============================================================================
# Python Coordination Calls
# =============================================================================

call_python_publish() {
    local msg_type="$1"
    local subject="$2"
    local description="$3"
    local to_instance="${4:-orchestrator}"
    local requires_ack="${5:-True}"

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
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        client = CoordinationClient(redis_client=r, config=config, instance_id="${COORD_INSTANCE_ID:-unknown}")
        msg = await client.publish_message(
            msg_type=MessageType("$msg_type"),
            subject="$subject",
            description="""$description""",
            from_instance="${COORD_INSTANCE_ID:-unknown}",
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
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

call_python_check() {
    local to_instance="${1:-}"
    local from_instance="${2:-}"
    local msg_type="${3:-}"
    local pending_only="${4:-False}"
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
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        query_type = MessageType("$msg_type") if "$msg_type" else None
        query = MessageQuery(
            to_instance="$to_instance" if "$to_instance" else None,
            from_instance="$from_instance" if "$from_instance" else None,
            msg_type=query_type,
            pending_only=$pending_only,
            limit=$limit,
        )

        client = CoordinationClient(redis_client=r, config=config, instance_id="${COORD_INSTANCE_ID:-unknown}")
        messages = await client.get_messages(query)

        print(json.dumps({
            "success": True,
            "count": len(messages),
            "messages": [msg.to_dict() for msg in messages],
        }))
        await r.aclose()
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

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
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        client = CoordinationClient(redis_client=r, config=config, instance_id="${COORD_INSTANCE_ID:-unknown}")
        comment = """$comment""" if """$comment""" else None
        result = await client.acknowledge_message(
            message_id="$message_id",
            ack_by="${COORD_INSTANCE_ID:-unknown}",
            comment=comment,
        )

        if result:
            print(json.dumps({
                "success": True,
                "message_id": "$message_id",
                "acknowledged_by": "${COORD_INSTANCE_ID:-unknown}",
            }))
        else:
            print(json.dumps({"success": False, "error": "Message not found: $message_id"}))
            sys.exit(1)
        await r.aclose()
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

call_python_pop_notifications() {
    local limit="${1:-100}"

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
        config = CoordinationConfig.from_env()
        r = redis.from_url(f"redis://{config.redis_host}:{config.redis_port}", decode_responses=True)

        client = CoordinationClient(redis_client=r, config=config, instance_id="${COORD_INSTANCE_ID:-unknown}")
        notifications = await client.pop_notifications(
            instance_id="${COORD_INSTANCE_ID:-unknown}",
            limit=$limit,
        )

        print(json.dumps({
            "success": True,
            "count": len(notifications),
            "notifications": [n.to_dict() for n in notifications],
        }))
        await r.aclose()
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

asyncio.run(main())
PYEOF
}

# =============================================================================
# Redis Lock Management
# =============================================================================

acquire_lock() {
    local lock_name="$1"
    local expire="${2:-300}"
    local lock_key="asdlc:coord:lock:${lock_name}"
    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    local result
    result=$(redis-cli -h "$host" -p "$port" SET "$lock_key" "${COORD_INSTANCE_ID:-unknown}" NX EX "$expire" 2>/dev/null)

    if [[ "$result" == "OK" ]]; then
        redis-cli -h "$host" -p "$port" SADD "asdlc:coord:locks" "$lock_name" > /dev/null 2>&1
        return 0
    fi
    return 1
}

release_lock() {
    local lock_name="$1"
    local lock_key="asdlc:coord:lock:${lock_name}"
    local host="${REDIS_HOST:-localhost}"
    local port="${REDIS_PORT:-6379}"

    redis-cli -h "$host" -p "$port" DEL "$lock_key" > /dev/null 2>&1
    redis-cli -h "$host" -p "$port" SREM "asdlc:coord:locks" "$lock_name" > /dev/null 2>&1
}

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
# Logging
# =============================================================================

log_debug() { [[ "${DEBUG:-}" == "true" ]] && echo "[DEBUG] $*" >&2; }
log_info() { echo "[INFO] $*" >&2; }
log_warn() { echo "[WARN] $*" >&2; }
log_error() { echo "[ERROR] $*" >&2; }
