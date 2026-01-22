#!/bin/bash
# Publish a coordination message for parallel Claude CLI instances.
#
# Usage: ./scripts/coordination/publish-message.sh <type> <subject> <description> [--to <instance>]
#
# Message Types:
#   CONTRACT_CHANGE_PROPOSED  - Proposing a contract change
#   CONTRACT_CHANGE_ACK       - Acknowledging a contract change
#   CONTRACT_PUBLISHED        - Contract change has been published
#   CONTRACT_REVIEW_NEEDED    - Orchestrator requests contract feedback
#   CONTRACT_FEEDBACK         - CLI provides feedback on contract
#   CONTRACT_APPROVED         - Orchestrator approves contract change
#   CONTRACT_REJECTED         - Orchestrator rejects contract change
#   INTERFACE_UPDATE          - Shared interface change notification
#   BLOCKING_ISSUE            - Work blocked, needs coordination
#   READY_FOR_REVIEW          - Feature branch ready for orchestrator review
#   REVIEW_COMPLETE           - Orchestrator: review passed, merged to main
#   REVIEW_FAILED             - Orchestrator: review failed, needs fixes
#   META_CHANGE_REQUEST       - Feature CLI requests meta file change
#   META_CHANGE_COMPLETE      - Orchestrator: meta file change completed
#   READY_FOR_MERGE           - (Deprecated) Branch ready for human merge
#   GENERAL                   - General coordination message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COORDINATION_DIR="$PROJECT_ROOT/.claude/coordination"
MESSAGES_DIR="$COORDINATION_DIR/messages"
PENDING_DIR="$COORDINATION_DIR/pending-acks"

# Load common helper functions for Redis coordination
# shellcheck source=lib/common.sh
if [[ -f "$SCRIPT_DIR/lib/common.sh" ]]; then
    source "$SCRIPT_DIR/lib/common.sh"
fi

# Valid message types
VALID_TYPES=(
    "CONTRACT_CHANGE_PROPOSED"
    "CONTRACT_CHANGE_ACK"
    "CONTRACT_PUBLISHED"
    "CONTRACT_REVIEW_NEEDED"
    "CONTRACT_FEEDBACK"
    "CONTRACT_APPROVED"
    "CONTRACT_REJECTED"
    "INTERFACE_UPDATE"
    "BLOCKING_ISSUE"
    "READY_FOR_REVIEW"
    "REVIEW_COMPLETE"
    "REVIEW_FAILED"
    "META_CHANGE_REQUEST"
    "META_CHANGE_COMPLETE"
    "READY_FOR_MERGE"
    "GENERAL"
)

usage() {
    echo "Usage: $0 <type> <subject> <description> [--to <instance>] [--no-ack]"
    echo ""
    echo "Arguments:"
    echo "  type         Message type (see below)"
    echo "  subject      Subject of the message (e.g., contract name)"
    echo "  description  Brief description of the message"
    echo ""
    echo "Options:"
    echo "  --to <instance>  Target instance (ui or agent). Default: other instance"
    echo "  --no-ack         Message does not require acknowledgment"
    echo ""
    echo "Message Types:"
    for t in "${VALID_TYPES[@]}"; do
        echo "  $t"
    done
    echo ""
    echo "Examples:"
    echo "  $0 CONTRACT_CHANGE_PROPOSED hitl_api 'Add metrics endpoint'"
    echo "  $0 BLOCKING_ISSUE dependencies 'Missing redis dependency' --to backend"
    echo "  $0 READY_FOR_REVIEW agent/P03-F01 'Feature complete, ready for review' --to orchestrator"
    echo "  $0 REVIEW_COMPLETE agent/P03-F01 'Merged as abc123' --to backend"
    echo "  $0 REVIEW_FAILED ui/P05-F01 'E2E tests failed' --to frontend"
}

generate_uuid() {
    # Generate a simple UUID-like string
    python3 -c "import uuid; print(str(uuid.uuid4())[:8])"
}

validate_type() {
    local type="$1"
    for valid in "${VALID_TYPES[@]}"; do
        if [[ "$type" == "$valid" ]]; then
            return 0
        fi
    done
    return 1
}

# Publish message via Redis backend
publish_via_redis() {
    local type="$1"
    local subject="$2"
    local description="$3"
    local target="$4"
    local requires_ack="$5"
    local sender="${CLAUDE_INSTANCE_ID:-unknown}"

    # Convert requires_ack to Python boolean
    local py_requires_ack="True"
    if [[ "$requires_ack" == "false" ]]; then
        py_requires_ack="False"
    fi

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
        echo "  Backend: Redis"

        if [[ "$requires_ack" == "true" ]]; then
            echo "  Requires acknowledgment: Yes"
        fi
        return 0
    else
        local error
        error=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))")
        echo "Error publishing via Redis: $error" >&2
        return 1
    fi
}

# Publish message via filesystem backend
publish_via_filesystem() {
    local type="$1"
    local subject="$2"
    local description="$3"
    local target="$4"
    local requires_ack="$5"
    local sender="${CLAUDE_INSTANCE_ID:-unknown}"

    # Generate message ID and timestamp
    local msg_id
    local timestamp
    msg_id="msg-$(generate_uuid)"
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local filename_timestamp
    filename_timestamp=$(date -u +"%Y-%m-%dT%H-%M-%S")

    # Create message filename (lowercase type for compatibility)
    local type_lower
    type_lower=$(echo "$type" | tr '[:upper:]' '[:lower:]')
    local filename="${filename_timestamp}-${sender}-${type_lower}.json"
    local filepath="$MESSAGES_DIR/$filename"

    # Create message JSON
    cat > "$filepath" << EOF
{
  "id": "$msg_id",
  "type": "$type",
  "from": "$sender",
  "to": "$target",
  "timestamp": "$timestamp",
  "requires_ack": $requires_ack,
  "acknowledged": false,
  "payload": {
    "subject": "$subject",
    "description": "$description"
  }
}
EOF

    # If requires ack, also create in pending-acks
    if [[ "$requires_ack" == "true" ]]; then
        cp "$filepath" "$PENDING_DIR/$filename"
    fi

    echo "Message published:"
    echo "  ID: $msg_id"
    echo "  Type: $type"
    echo "  From: $sender -> To: $target"
    echo "  Subject: $subject"
    echo "  File: $filename"

    if [[ "$requires_ack" == "true" ]]; then
        echo "  Requires acknowledgment: Yes"
    fi
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
            --to)
                target="$2"
                shift 2
                ;;
            --no-ack)
                requires_ack="false"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                if [[ -z "$type" ]]; then
                    type="$1"
                elif [[ -z "$subject" ]]; then
                    subject="$1"
                elif [[ -z "$description" ]]; then
                    description="$1"
                else
                    echo "Error: Too many arguments"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$type" || -z "$subject" || -z "$description" ]]; then
        echo "Error: Missing required arguments"
        usage
        exit 1
    fi

    # Validate message type
    if ! validate_type "$type"; then
        echo "Error: Invalid message type '$type'"
        echo "Valid types: ${VALID_TYPES[*]}"
        exit 1
    fi

    # Get sender instance
    local sender="${CLAUDE_INSTANCE_ID:-unknown}"
    if [[ "$sender" == "unknown" ]]; then
        echo "Warning: CLAUDE_INSTANCE_ID not set. Run 'source scripts/cli-identity.sh <ui|agent>' first."
    fi

    # Determine target if not specified
    if [[ -z "$target" ]]; then
        case "$type" in
            READY_FOR_REVIEW|CONTRACT_CHANGE_PROPOSED|META_CHANGE_REQUEST)
                # Review requests, contract proposals, and meta change requests go to orchestrator
                target="orchestrator"
                ;;
            REVIEW_COMPLETE|REVIEW_FAILED|META_CHANGE_COMPLETE)
                # Review and meta change responses should have explicit target
                echo "Warning: Response messages should specify --to <instance>"
                target="all"
                ;;
            CONTRACT_REVIEW_NEEDED|CONTRACT_APPROVED|CONTRACT_REJECTED)
                # Contract orchestration messages should have explicit target
                echo "Warning: Contract orchestration messages should specify --to <instance>"
                target="all"
                ;;
            *)
                # Default: send to the other feature CLI (legacy behavior)
                if [[ "$sender" == "frontend" ]]; then
                    target="backend"
                elif [[ "$sender" == "backend" ]]; then
                    target="frontend"
                elif [[ "$sender" == "orchestrator" ]]; then
                    target="all"
                else
                    target="all"
                fi
                ;;
        esac
    fi

    # Detect coordination backend and publish
    local backend="filesystem"
    if type check_coordination_backend &>/dev/null; then
        backend=$(check_coordination_backend)
    fi

    if [[ "$backend" == "redis" ]]; then
        publish_via_redis "$type" "$subject" "$description" "$target" "$requires_ack"
    else
        publish_via_filesystem "$type" "$subject" "$description" "$target" "$requires_ack"
    fi
}

main "$@"
