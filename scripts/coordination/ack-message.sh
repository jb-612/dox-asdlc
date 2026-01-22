#!/bin/bash
# Acknowledge a coordination message.
#
# Usage: ./scripts/coordination/ack-message.sh <message-id> [--comment <comment>]
#
# Marks a message as acknowledged and optionally adds a comment.

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

# Acknowledge message via Redis backend
ack_via_redis() {
    local msg_id="$1"
    local comment="$2"
    local acker="${CLAUDE_INSTANCE_ID:-unknown}"

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
        echo "  Backend: Redis"
        if [[ -n "$comment" ]]; then
            echo "  Comment: $comment"
        fi
        return 0
    else
        local error
        error=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))")

        # Check if it's a not found error
        if echo "$error" | grep -qi "not found"; then
            echo "Error: Message '$msg_id' not found"
            echo ""
            echo "Use './scripts/coordination/check-messages.sh --pending' to see pending messages"
            return 1
        fi

        echo "Error acknowledging via Redis: $error" >&2
        return 1
    fi
}

find_message_file() {
    local msg_id="$1"

    # Search in messages directory
    local found
    found=$(grep -l "\"id\": \"$msg_id\"" "$MESSAGES_DIR"/*.json 2>/dev/null | head -1)

    if [[ -n "$found" ]]; then
        echo "$found"
        return 0
    fi

    # Try partial match
    found=$(grep -l "\"$msg_id\"" "$MESSAGES_DIR"/*.json 2>/dev/null | head -1)

    if [[ -n "$found" ]]; then
        echo "$found"
        return 0
    fi

    return 1
}

# Acknowledge message via filesystem backend
ack_via_filesystem() {
    local msg_id="$1"
    local comment="$2"

    # Find the message file
    local message_file
    if ! message_file=$(find_message_file "$msg_id"); then
        echo "Error: Message '$msg_id' not found"
        echo ""
        echo "Use './scripts/coordination/check-messages.sh --pending' to see pending messages"
        return 1
    fi

    # Get current instance
    local acker="${CLAUDE_INSTANCE_ID:-unknown}"

    # Read current message
    local json
    json=$(cat "$message_file")

    local original_id type from requires_ack
    original_id=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
    type=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('type',''))")
    from=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('from',''))")
    requires_ack=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('requires_ack',False))")

    if [[ "$requires_ack" != "True" ]]; then
        echo "Note: This message does not require acknowledgment"
    fi

    # Update the message to mark as acknowledged
    local ack_timestamp
    ack_timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    python3 << EOF
import json

with open('$message_file', 'r') as f:
    msg = json.load(f)

msg['acknowledged'] = True
msg['ack_by'] = '$acker'
msg['ack_timestamp'] = '$ack_timestamp'
if '$comment':
    msg['ack_comment'] = '$comment'

with open('$message_file', 'w') as f:
    json.dump(msg, f, indent=2)
EOF

    # Remove from pending-acks if exists
    local basename
    basename=$(basename "$message_file")
    if [[ -f "$PENDING_DIR/$basename" ]]; then
        rm "$PENDING_DIR/$basename"
    fi

    echo "Message acknowledged:"
    echo "  ID: $original_id"
    echo "  Type: $type"
    echo "  From: $from"
    echo "  Acknowledged by: $acker"
    echo "  Time: $ack_timestamp"
    if [[ -n "$comment" ]]; then
        echo "  Comment: $comment"
    fi

    # Optionally publish an ACK message back
    if [[ "$type" == "CONTRACT_CHANGE_PROPOSED" ]]; then
        echo ""
        echo "Publishing acknowledgment message..."
        local subject
        subject=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('payload',{}).get('subject',''))")
        "$SCRIPT_DIR/publish-message.sh" CONTRACT_CHANGE_ACK "$subject" "Acknowledged: $comment" --to "$from" --no-ack
    fi
}

main() {
    local msg_id=""
    local comment=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --comment)
                comment="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                if [[ -z "$msg_id" ]]; then
                    msg_id="$1"
                else
                    echo "Error: Unexpected argument '$1'"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$msg_id" ]]; then
        echo "Error: Message ID required"
        usage
        exit 1
    fi

    # Detect coordination backend and acknowledge
    local backend="filesystem"
    if type check_coordination_backend &>/dev/null; then
        backend=$(check_coordination_backend)
    fi

    if [[ "$backend" == "redis" ]]; then
        ack_via_redis "$msg_id" "$comment"
    else
        ack_via_filesystem "$msg_id" "$comment"
    fi
}

main "$@"
