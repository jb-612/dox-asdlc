#!/bin/bash
# Publish a coordination message via Redis backend.
#
# Usage: ./scripts/coordination/publish-message.sh <type> <subject> <description> [--to <instance>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load common helper functions
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# Valid message types
# Note: BUILD_BROKEN/BUILD_FIXED added for TBD workflow
# READY_FOR_REVIEW, REVIEW_COMPLETE, REVIEW_FAILED are deprecated (TBD)
VALID_TYPES=(
    "BUILD_BROKEN"
    "BUILD_FIXED"
    "CONTRACT_CHANGE_PROPOSED"
    "CONTRACT_REVIEW_NEEDED"
    "CONTRACT_FEEDBACK"
    "CONTRACT_APPROVED"
    "CONTRACT_REJECTED"
    "INTERFACE_UPDATE"
    "BLOCKING_ISSUE"
    "READY_FOR_REVIEW"      # Deprecated: TBD removes review workflow
    "REVIEW_COMPLETE"       # Deprecated: TBD removes review workflow
    "REVIEW_FAILED"         # Deprecated: TBD removes review workflow
    "META_CHANGE_REQUEST"
    "META_CHANGE_COMPLETE"
    "GENERAL"
    "STATUS_UPDATE"
    "HEARTBEAT"
    "NOTIFICATION"
)

usage() {
    echo "Usage: $0 <type> <subject> <description> [--to <instance>] [--no-ack]"
    echo ""
    echo "Arguments:"
    echo "  type         Message type (see below)"
    echo "  subject      Subject of the message"
    echo "  description  Message description"
    echo ""
    echo "Options:"
    echo "  --to <instance>  Target instance (default: orchestrator for reviews)"
    echo "  --no-ack         Message does not require acknowledgment"
    echo ""
    echo "Message Types:"
    for t in "${VALID_TYPES[@]}"; do
        echo "  $t"
    done
}

validate_type() {
    local type="$1"
    for valid in "${VALID_TYPES[@]}"; do
        [[ "$type" == "$valid" ]] && return 0
    done
    return 1
}

main() {
    local type=""
    local subject=""
    local description=""
    local target=""
    local requires_ack="true"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --to) target="$2"; shift 2 ;;
            --no-ack) requires_ack="false"; shift ;;
            -h|--help) usage; exit 0 ;;
            *)
                if [[ -z "$type" ]]; then
                    type="$1"
                elif [[ -z "$subject" ]]; then
                    subject="$1"
                elif [[ -z "$description" ]]; then
                    description="$1"
                else
                    echo "Error: Too many arguments"; usage; exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$type" || -z "$subject" || -z "$description" ]]; then
        echo "Error: Missing required arguments"; usage; exit 1
    fi

    # Validate message type
    if ! validate_type "$type"; then
        echo "Error: Invalid message type '$type'"
        echo "Valid types: ${VALID_TYPES[*]}"
        exit 1
    fi

    # Get sender instance from identity file (via common.sh)
    local sender="${COORD_INSTANCE_ID:-unknown}"
    [[ "$sender" == "unknown" ]] && echo "Warning: Identity file not found at .claude/instance-identity.json"

    # Determine target if not specified
    if [[ -z "$target" ]]; then
        case "$type" in
            READY_FOR_REVIEW|CONTRACT_CHANGE_PROPOSED|META_CHANGE_REQUEST)
                target="orchestrator"
                ;;
            *)
                if [[ "$sender" == "frontend" ]]; then target="backend"
                elif [[ "$sender" == "backend" ]]; then target="frontend"
                else target="all"
                fi
                ;;
        esac
    fi

    # Check Redis availability
    if ! check_redis_available; then
        echo "Error: Redis not available. Ensure Redis is running." >&2
        exit 1
    fi

    # Publish via Redis
    local py_requires_ack="True"
    [[ "$requires_ack" == "false" ]] && py_requires_ack="False"

    local result
    result=$(call_python_publish "$type" "$subject" "$description" "$target" "$py_requires_ack")

    local success
    success=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))")

    if [[ "$success" == "True" ]]; then
        local msg_id msg_type from_instance to_instance
        msg_id=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('message_id',''))")
        msg_type=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('type',''))")
        from_instance=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('from',''))")
        to_instance=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('to',''))")

        echo "Message published:"
        echo "  ID: $msg_id"
        echo "  Type: $msg_type"
        echo "  From: $from_instance -> To: $to_instance"
        echo "  Subject: $subject"
        [[ "$requires_ack" == "true" ]] && echo "  Requires acknowledgment: Yes"
    else
        local error
        error=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))")
        echo "Error: $error" >&2
        exit 1
    fi
}

main "$@"
