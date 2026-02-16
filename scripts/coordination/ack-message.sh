#!/bin/bash
# Acknowledge a coordination message via Redis backend.
#
# Usage: ./scripts/coordination/ack-message.sh <message-id> [--comment <comment>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load common helper functions
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

usage() {
    echo "Usage: $0 <message-id> [--comment <comment>]"
    echo ""
    echo "Arguments:"
    echo "  message-id   The ID of the message to acknowledge (e.g., msg-abc12345)"
    echo ""
    echo "Options:"
    echo "  --comment <comment>  Add a comment to the acknowledgment"
    echo "  -h, --help           Show this help"
    echo ""
    echo "Example:"
    echo "  $0 msg-abc12345"
    echo "  $0 msg-abc12345 --comment 'Looks good, proceed'"
}

main() {
    local msg_id=""
    local comment=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --comment) comment="$2"; shift 2 ;;
            -h|--help) usage; exit 0 ;;
            *)
                if [[ -z "$msg_id" ]]; then
                    msg_id="$1"
                else
                    echo "Error: Unexpected argument '$1'"; usage; exit 1
                fi
                shift
                ;;
        esac
    done

    # Deprecation warning for native teams mode
    if [[ "${COORDINATION_BACKEND:-}" == "native_teams" ]]; then
        echo "WARNING: Redis coordination messaging is deprecated when COORDINATION_BACKEND=native_teams." >&2
        echo "         Message acknowledgment is not needed in native teams mode. See .claude/rules/native-teams.md" >&2
    fi

    if [[ -z "$msg_id" ]]; then
        echo "Error: Message ID required"; usage; exit 1
    fi

    # Check Redis availability
    if ! check_redis_available; then
        echo "Error: Redis not available. Ensure Redis is running." >&2
        exit 1
    fi

    # Acknowledge via Redis
    local result
    result=$(call_python_ack "$msg_id" "$comment")

    local success
    success=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))")

    if [[ "$success" == "True" ]]; then
        local acknowledged_by
        acknowledged_by=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('acknowledged_by',''))")
        local ack_timestamp
        ack_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

        echo "Message acknowledged:"
        echo "  ID: $msg_id"
        echo "  Acknowledged by: $acknowledged_by"
        echo "  Time: $ack_timestamp"
        [[ -n "$comment" ]] && echo "  Comment: $comment"
    else
        local error
        error=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))")

        if echo "$error" | grep -qi "not found"; then
            echo "Error: Message '$msg_id' not found"
            echo ""
            echo "Use './scripts/coordination/check-messages.sh --pending' to see pending messages"
            exit 1
        fi

        echo "Error: $error" >&2
        exit 1
    fi
}

main "$@"
