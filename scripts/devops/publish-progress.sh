#!/bin/bash
# Publish DevOps progress updates via coordination MCP.
#
# This script wraps the coordination infrastructure to provide easy
# progress publishing for DevOps operations.
#
# Usage:
#   publish-progress.sh start "Operation name" "step1,step2,step3"
#   publish-progress.sh step "Step name" "running|completed|failed" ["error message"]
#   publish-progress.sh complete
#   publish-progress.sh failed "Error message"
#
# Environment:
#   DEVOPS_OPERATION - Set by 'start' action, used by subsequent actions
#   DEVOPS_START_TIME - Set by 'start' action for duration calculation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load common helper functions from coordination lib
# shellcheck source=../coordination/lib/common.sh
source "$SCRIPT_DIR/../coordination/lib/common.sh"

# State file for tracking current operation (per-session)
STATE_FILE="${TMPDIR:-/tmp}/devops-progress-$$"

usage() {
    cat << 'EOF'
Usage: publish-progress.sh <action> [args...]

Actions:
  start <operation> <steps>   Start a new operation with comma-separated steps
  step <name> <status> [err]  Update step status (running|completed|failed)
  complete                    Mark operation as successfully completed
  failed <error>              Mark operation as failed with error message

Examples:
  # Start an operation with 3 steps
  publish-progress.sh start "Deploy workers v2.1.0" "pull-images,create-pods,wait-rollout"

  # Update step status
  publish-progress.sh step "pull-images" "running"
  publish-progress.sh step "pull-images" "completed"
  publish-progress.sh step "create-pods" "running"
  publish-progress.sh step "create-pods" "failed" "ImagePullBackOff"

  # Complete or fail the operation
  publish-progress.sh complete
  publish-progress.sh failed "Rollout timeout after 300s"

Environment Variables:
  REDIS_HOST       Redis host (default: localhost)
  REDIS_PORT       Redis port (default: 6379)

EOF
}

# Get current timestamp in ISO format
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Get Unix timestamp for duration calculation
get_unix_time() {
    date +%s
}

# Save operation state to temp file
save_state() {
    local operation="$1"
    local start_time="$2"
    echo "OPERATION=$operation" > "$STATE_FILE"
    echo "START_TIME=$start_time" >> "$STATE_FILE"
}

# Load operation state from temp file
load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        # shellcheck source=/dev/null
        source "$STATE_FILE"
        echo "${OPERATION:-}"
    else
        echo ""
    fi
}

# Load start time from state file
load_start_time() {
    if [[ -f "$STATE_FILE" ]]; then
        # shellcheck source=/dev/null
        source "$STATE_FILE"
        echo "${START_TIME:-0}"
    else
        echo "0"
    fi
}

# Clear operation state
clear_state() {
    rm -f "$STATE_FILE"
}

# Publish a coordination message with extended payload data
# Uses the call_python_publish function from common.sh but adds payload_data
publish_devops_message() {
    local msg_type="$1"
    local subject="$2"
    local description="$3"
    local payload_data="$4"

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

        client = CoordinationClient(redis_client=r, config=config, instance_id="${COORD_INSTANCE_ID:-devops}")

        # Build description with payload data embedded
        payload_data = json.loads('''$payload_data''')
        full_description = """$description

Payload: """ + json.dumps(payload_data)

        msg = await client.publish_message(
            msg_type=MessageType("$msg_type"),
            subject="$subject",
            description=full_description,
            from_instance="${COORD_INSTANCE_ID:-devops}",
            to_instance="all",
            requires_ack=False,
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

# Action: start - Begin a new DevOps operation
action_start() {
    local operation="${1:-}"
    local steps="${2:-}"

    if [[ -z "$operation" ]]; then
        echo "Error: Operation name required" >&2
        echo "Usage: publish-progress.sh start \"Operation name\" \"step1,step2,step3\"" >&2
        exit 1
    fi

    if [[ -z "$steps" ]]; then
        echo "Error: Steps list required" >&2
        echo "Usage: publish-progress.sh start \"Operation name\" \"step1,step2,step3\"" >&2
        exit 1
    fi

    # Check Redis availability
    if ! check_redis_available; then
        echo "Warning: Redis not available. Progress will not be published." >&2
        # Still save state for local tracking
        save_state "$operation" "$(get_unix_time)"
        return 0
    fi

    # Convert comma-separated steps to JSON array
    local steps_json
    steps_json=$(echo "$steps" | tr ',' '\n' | jq -R . | jq -s .)

    local timestamp
    timestamp=$(get_timestamp)

    local payload_data
    payload_data=$(jq -n \
        --arg op "$operation" \
        --argjson steps "$steps_json" \
        --arg ts "$timestamp" \
        '{operation: $op, steps: $steps, timestamp: $ts}')

    local result
    result=$(publish_devops_message \
        "DEVOPS_STARTED" \
        "$operation" \
        "Starting: $operation" \
        "$payload_data")

    local success
    success=$(echo "$result" | jq -r '.success // false')

    if [[ "$success" == "true" ]]; then
        local msg_id
        msg_id=$(echo "$result" | jq -r '.message_id')
        echo "DevOps operation started:"
        echo "  Operation: $operation"
        echo "  Steps: $steps"
        echo "  Message ID: $msg_id"

        # Save state for subsequent actions
        save_state "$operation" "$(get_unix_time)"
    else
        local error
        error=$(echo "$result" | jq -r '.error // "Unknown error"')
        echo "Error publishing start message: $error" >&2
        exit 1
    fi
}

# Action: step - Update step status
action_step() {
    local step_name="${1:-}"
    local status="${2:-}"
    local error_msg="${3:-}"

    if [[ -z "$step_name" ]]; then
        echo "Error: Step name required" >&2
        echo "Usage: publish-progress.sh step \"step-name\" \"running|completed|failed\" [\"error\"]" >&2
        exit 1
    fi

    if [[ -z "$status" ]]; then
        echo "Error: Status required" >&2
        echo "Usage: publish-progress.sh step \"step-name\" \"running|completed|failed\" [\"error\"]" >&2
        exit 1
    fi

    # Validate status
    case "$status" in
        running|completed|failed)
            ;;
        *)
            echo "Error: Invalid status '$status'. Must be: running, completed, or failed" >&2
            exit 1
            ;;
    esac

    # Check Redis availability
    if ! check_redis_available; then
        echo "Warning: Redis not available. Step update not published." >&2
        echo "  Step: $step_name -> $status"
        return 0
    fi

    local timestamp
    timestamp=$(get_timestamp)

    local payload_data
    if [[ -n "$error_msg" ]]; then
        payload_data=$(jq -n \
            --arg step "$step_name" \
            --arg status "$status" \
            --arg error "$error_msg" \
            --arg ts "$timestamp" \
            '{step: $step, status: $status, error: $error, timestamp: $ts}')
    else
        payload_data=$(jq -n \
            --arg step "$step_name" \
            --arg status "$status" \
            --arg ts "$timestamp" \
            '{step: $step, status: $status, error: null, timestamp: $ts}')
    fi

    local subject="Step: $step_name"
    local description="Step '$step_name' is now $status"
    if [[ -n "$error_msg" ]]; then
        description="Step '$step_name' failed: $error_msg"
    fi

    local result
    result=$(publish_devops_message \
        "DEVOPS_STEP_UPDATE" \
        "$subject" \
        "$description" \
        "$payload_data")

    local success
    success=$(echo "$result" | jq -r '.success // false')

    if [[ "$success" == "true" ]]; then
        echo "Step update:"
        echo "  Step: $step_name"
        echo "  Status: $status"
        [[ -n "$error_msg" ]] && echo "  Error: $error_msg"
    else
        local error
        error=$(echo "$result" | jq -r '.error // "Unknown error"')
        echo "Error publishing step update: $error" >&2
        exit 1
    fi
}

# Action: complete - Mark operation as successfully completed
action_complete() {
    local operation
    operation=$(load_state)

    if [[ -z "$operation" ]]; then
        operation="Unknown operation"
    fi

    # Check Redis availability
    if ! check_redis_available; then
        echo "Warning: Redis not available. Completion not published." >&2
        echo "  Operation: $operation completed"
        clear_state
        return 0
    fi

    local timestamp
    timestamp=$(get_timestamp)

    # Calculate duration
    local start_time
    start_time=$(load_start_time)
    local end_time
    end_time=$(get_unix_time)
    local duration=$((end_time - start_time))

    local payload_data
    payload_data=$(jq -n \
        --arg op "$operation" \
        --argjson dur "$duration" \
        --arg ts "$timestamp" \
        '{operation: $op, duration_seconds: $dur, timestamp: $ts}')

    local result
    result=$(publish_devops_message \
        "DEVOPS_COMPLETE" \
        "Operation completed" \
        "Completed: $operation" \
        "$payload_data")

    local success
    success=$(echo "$result" | jq -r '.success // false')

    if [[ "$success" == "true" ]]; then
        local msg_id
        msg_id=$(echo "$result" | jq -r '.message_id')
        echo "DevOps operation completed:"
        echo "  Operation: $operation"
        echo "  Duration: ${duration}s"
        echo "  Message ID: $msg_id"

        # Clear state
        clear_state
    else
        local error
        error=$(echo "$result" | jq -r '.error // "Unknown error"')
        echo "Error publishing completion: $error" >&2
        exit 1
    fi
}

# Action: failed - Mark operation as failed
action_failed() {
    local error_msg="${1:-Unknown error}"

    local operation
    operation=$(load_state)

    if [[ -z "$operation" ]]; then
        operation="Unknown operation"
    fi

    # Check Redis availability
    if ! check_redis_available; then
        echo "Warning: Redis not available. Failure not published." >&2
        echo "  Operation: $operation failed"
        echo "  Error: $error_msg"
        clear_state
        return 0
    fi

    local timestamp
    timestamp=$(get_timestamp)

    local payload_data
    payload_data=$(jq -n \
        --arg op "$operation" \
        --arg error "$error_msg" \
        --arg ts "$timestamp" \
        '{operation: $op, error: $error, timestamp: $ts}')

    local result
    result=$(publish_devops_message \
        "DEVOPS_FAILED" \
        "Operation failed" \
        "Failed: $operation - $error_msg" \
        "$payload_data")

    local success
    success=$(echo "$result" | jq -r '.success // false')

    if [[ "$success" == "true" ]]; then
        local msg_id
        msg_id=$(echo "$result" | jq -r '.message_id')
        echo "DevOps operation failed:"
        echo "  Operation: $operation"
        echo "  Error: $error_msg"
        echo "  Message ID: $msg_id"

        # Clear state
        clear_state
    else
        local error
        error=$(echo "$result" | jq -r '.error // "Unknown error"')
        echo "Error publishing failure: $error" >&2
        exit 1
    fi
}

# Main entry point
main() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        echo "Error: Action required" >&2
        usage
        exit 1
    fi

    shift

    case "$action" in
        start)
            action_start "$@"
            ;;
        step)
            action_step "$@"
            ;;
        complete)
            action_complete "$@"
            ;;
        failed)
            action_failed "$@"
            ;;
        -h|--help|help)
            usage
            exit 0
            ;;
        *)
            echo "Error: Unknown action '$action'" >&2
            usage
            exit 1
            ;;
    esac
}

main "$@"
