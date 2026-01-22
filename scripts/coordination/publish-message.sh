#!/bin/bash
# Publish a coordination message for parallel Claude CLI instances.
#
# Usage: ./scripts/coordination/publish-message.sh <type> <subject> <description> [--to <instance>]
#
# Message Types:
#   CONTRACT_CHANGE_PROPOSED  - Proposing a contract change
#   CONTRACT_CHANGE_ACK       - Acknowledging a contract change
#   CONTRACT_PUBLISHED        - Contract change has been published
#   INTERFACE_UPDATE          - Shared interface change notification
#   BLOCKING_ISSUE            - Work blocked, needs coordination
#   READY_FOR_MERGE           - Branch ready for human merge
#   GENERAL                   - General coordination message

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COORDINATION_DIR="$PROJECT_ROOT/.claude/coordination"
MESSAGES_DIR="$COORDINATION_DIR/messages"
PENDING_DIR="$COORDINATION_DIR/pending-acks"

# Valid message types
VALID_TYPES=("CONTRACT_CHANGE_PROPOSED" "CONTRACT_CHANGE_ACK" "CONTRACT_PUBLISHED" "INTERFACE_UPDATE" "BLOCKING_ISSUE" "READY_FOR_MERGE" "GENERAL")

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
    echo "  $0 BLOCKING_ISSUE dependencies 'Missing redis dependency' --to agent"
    echo "  $0 READY_FOR_MERGE branch 'P05-F01 ready for merge' --no-ack"
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
        if [[ "$sender" == "ui" ]]; then
            target="agent"
        elif [[ "$sender" == "agent" ]]; then
            target="ui"
        else
            target="all"
        fi
    fi

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

main "$@"
