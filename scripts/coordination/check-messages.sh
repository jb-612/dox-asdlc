#!/bin/bash
# Check for coordination messages requiring attention.
#
# Usage: ./scripts/coordination/check-messages.sh [--all] [--pending] [--from <instance>]
#
# By default, shows only unacknowledged messages addressed to the current instance.

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

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --all           Show all messages, not just for current instance"
    echo "  --pending       Show only messages pending acknowledgment"
    echo "  --from <id>     Filter by sender instance (backend, frontend, orchestrator)"
    echo "  --type <type>   Filter by message type (e.g., READY_FOR_REVIEW)"
    echo "  --reviews       Show only review-related messages"
    echo "  --contracts     Show only contract-related messages"
    echo "  --recent        Show only messages from last 24 hours (default)"
    echo "  --week          Show messages from last 7 days"
    echo "  -h, --help      Show this help"
    echo ""
    echo "Without options, shows unacknowledged messages for the current instance."
}

# Format a message from JSON data for display
format_message_from_json() {
    local json="$1"

    local id type from to timestamp requires_ack acknowledged subject description
    id=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
    type=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('type',''))")
    from=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('from',''))")
    to=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('to',''))")
    timestamp=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('timestamp',''))")
    requires_ack=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('requires_ack',False))")
    acknowledged=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('acknowledged',False))")
    subject=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('payload',{}).get('subject',''))")
    description=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('payload',{}).get('description',''))")

    # Color code by type
    local type_color="$BLUE"
    case "$type" in
        CONTRACT_CHANGE_PROPOSED|CONTRACT_REVIEW_NEEDED|INTERFACE_UPDATE)
            type_color="$YELLOW"
            ;;
        BLOCKING_ISSUE|REVIEW_FAILED|CONTRACT_REJECTED)
            type_color="$RED"
            ;;
        READY_FOR_MERGE|CONTRACT_PUBLISHED|REVIEW_COMPLETE|CONTRACT_APPROVED)
            type_color="$GREEN"
            ;;
        READY_FOR_REVIEW|CONTRACT_FEEDBACK)
            type_color="$CYAN"
            ;;
    esac

    # Status indicator
    local status_icon
    if [[ "$acknowledged" == "True" || "$acknowledged" == "true" ]]; then
        status_icon="${GREEN}[ACK]${NC}"
    elif [[ "$requires_ack" == "True" || "$requires_ack" == "true" ]]; then
        status_icon="${YELLOW}[PENDING]${NC}"
    else
        status_icon="${CYAN}[INFO]${NC}"
    fi

    echo -e "$status_icon ${type_color}$type${NC}"
    echo -e "  ID: ${CYAN}$id${NC}"
    echo -e "  From: $from -> To: $to"
    echo -e "  Time: $timestamp"
    echo -e "  Subject: $subject"
    echo -e "  Description: $description"
    echo ""
}

# Check messages via Redis backend
check_via_redis() {
    local to_instance="$1"
    local from_instance="$2"
    local msg_type="$3"
    local pending_only="$4"
    local limit="$5"

    # Convert pending_only to Python boolean
    local py_pending="False"
    if [[ "$pending_only" == "true" ]]; then
        py_pending="True"
    fi

    local result
    result=$(call_python_check "$to_instance" "$from_instance" "$msg_type" "$py_pending" "$limit")

    local success
    success=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))")

    if [[ "$success" != "True" ]]; then
        local error
        error=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))")
        echo "Error checking messages via Redis: $error" >&2
        return 1
    fi

    local count
    count=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('count',0))")

    if [[ "$count" -eq 0 ]]; then
        if [[ "$pending_only" == "true" ]]; then
            echo "  No pending messages."
        else
            echo "No messages match the filter criteria."
        fi
        return 0
    fi

    # Iterate over messages and format them
    local i=0
    while [[ $i -lt $count ]]; do
        local msg_json
        msg_json=$(echo "$result" | python3 -c "import json,sys; msgs=json.load(sys.stdin).get('messages',[]); print(json.dumps(msgs[$i]) if $i < len(msgs) else '{}')")
        format_message_from_json "$msg_json"
        ((i++)) || true
    done

    echo "---"
    echo "Displayed $count message(s) (backend: Redis)"
    echo ""
    echo "To acknowledge a message:"
    echo "  ./scripts/coordination/ack-message.sh <message-id>"
}

format_message() {
    local file="$1"
    local json
    json=$(cat "$file")

    local id type from to timestamp requires_ack acknowledged subject description
    id=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))")
    type=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('type',''))")
    from=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('from',''))")
    to=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('to',''))")
    timestamp=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('timestamp',''))")
    requires_ack=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('requires_ack',False))")
    acknowledged=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('acknowledged',False))")
    subject=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('payload',{}).get('subject',''))")
    description=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('payload',{}).get('description',''))")

    # Color code by type
    local type_color="$BLUE"
    case "$type" in
        CONTRACT_CHANGE_PROPOSED|CONTRACT_REVIEW_NEEDED|INTERFACE_UPDATE)
            type_color="$YELLOW"
            ;;
        BLOCKING_ISSUE|REVIEW_FAILED|CONTRACT_REJECTED)
            type_color="$RED"
            ;;
        READY_FOR_MERGE|CONTRACT_PUBLISHED|REVIEW_COMPLETE|CONTRACT_APPROVED)
            type_color="$GREEN"
            ;;
        READY_FOR_REVIEW|CONTRACT_FEEDBACK)
            type_color="$CYAN"
            ;;
    esac

    # Status indicator
    local status_icon
    if [[ "$acknowledged" == "True" ]]; then
        status_icon="${GREEN}[ACK]${NC}"
    elif [[ "$requires_ack" == "True" ]]; then
        status_icon="${YELLOW}[PENDING]${NC}"
    else
        status_icon="${CYAN}[INFO]${NC}"
    fi

    echo -e "$status_icon ${type_color}$type${NC}"
    echo -e "  ID: ${CYAN}$id${NC}"
    echo -e "  From: $from -> To: $to"
    echo -e "  Time: $timestamp"
    echo -e "  Subject: $subject"
    echo -e "  Description: $description"
    echo ""
}

main() {
    local show_all=false
    local pending_only=false
    local filter_from=""
    local filter_type=""
    local filter_reviews=false
    local filter_contracts=false
    local time_filter="-mtime -1"  # Default: last 24 hours

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --all)
                show_all=true
                shift
                ;;
            --pending)
                pending_only=true
                shift
                ;;
            --from)
                filter_from="$2"
                shift 2
                ;;
            --type)
                filter_type="$2"
                shift 2
                ;;
            --reviews)
                filter_reviews=true
                shift
                ;;
            --contracts)
                filter_contracts=true
                shift
                ;;
            --recent)
                time_filter="-mtime -1"
                shift
                ;;
            --week)
                time_filter="-mtime -7"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    local current_instance="${CLAUDE_INSTANCE_ID:-}"

    echo ""
    echo "=== Coordination Messages ==="
    if [[ -n "$current_instance" ]]; then
        echo "Current instance: $current_instance"
    else
        echo "Note: CLAUDE_INSTANCE_ID not set"
    fi
    echo ""

    # Detect coordination backend
    local backend="filesystem"
    if type check_coordination_backend &>/dev/null; then
        backend=$(check_coordination_backend)
    fi

    # Use Redis backend if available
    if [[ "$backend" == "redis" ]]; then
        local to_filter=""
        local from_filter=""
        local type_filter=""
        local limit_value="100"

        # Set to_filter if not showing all
        if [[ "$show_all" != "true" && -n "$current_instance" ]]; then
            to_filter="$current_instance"
        fi

        # Apply from filter
        if [[ -n "$filter_from" ]]; then
            from_filter="$filter_from"
        fi

        # Apply type filter
        if [[ -n "$filter_type" ]]; then
            type_filter="$filter_type"
        elif [[ "$filter_reviews" == "true" ]]; then
            # For reviews, we'll filter client-side (Redis doesn't support OR queries)
            type_filter=""
        elif [[ "$filter_contracts" == "true" ]]; then
            # For contracts, we'll filter client-side
            type_filter=""
        fi

        if [[ "$pending_only" == "true" ]]; then
            echo -e "${YELLOW}Messages Pending Acknowledgment:${NC}"
            echo ""
        fi

        check_via_redis "$to_filter" "$from_filter" "$type_filter" "$pending_only" "$limit_value"
        exit 0
    fi

    # Fallback to filesystem backend
    # Check pending acks first
    if [[ "$pending_only" == "true" ]]; then
        echo -e "${YELLOW}Messages Pending Acknowledgment:${NC}"
        echo ""

        local pending_count=0
        while IFS= read -r -d '' file; do
            ((pending_count++)) || true
            format_message "$file"
        done < <(find "$PENDING_DIR" -name "*.json" -print0 2>/dev/null)

        if [[ "$pending_count" -eq 0 ]]; then
            echo "  No pending messages."
        fi
        exit 0
    fi

    # Find messages
    local message_files
    message_files=$(find "$MESSAGES_DIR" -name "*.json" $time_filter 2>/dev/null | sort -r)

    if [[ -z "$message_files" ]]; then
        echo "No recent messages found."
        exit 0
    fi

    local displayed=0
    while IFS= read -r file; do
        [[ -z "$file" ]] && continue

        local json
        json=$(cat "$file")

        local to from acknowledged msg_type
        to=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('to',''))")
        from=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('from',''))")
        acknowledged=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('acknowledged',False))")
        msg_type=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('type',''))")

        # Apply filters
        if [[ "$show_all" != "true" ]]; then
            # Skip if not addressed to current instance
            if [[ -n "$current_instance" && "$to" != "$current_instance" && "$to" != "all" ]]; then
                continue
            fi
            # Skip acknowledged messages by default
            if [[ "$acknowledged" == "True" ]]; then
                continue
            fi
        fi

        # Filter by sender if specified
        if [[ -n "$filter_from" && "$from" != "$filter_from" ]]; then
            continue
        fi

        # Filter by message type if specified
        if [[ -n "$filter_type" && "$msg_type" != "$filter_type" ]]; then
            continue
        fi

        # Filter for review-related messages
        if [[ "$filter_reviews" == "true" ]]; then
            case "$msg_type" in
                READY_FOR_REVIEW|REVIEW_COMPLETE|REVIEW_FAILED)
                    ;;
                *)
                    continue
                    ;;
            esac
        fi

        # Filter for contract-related messages
        if [[ "$filter_contracts" == "true" ]]; then
            case "$msg_type" in
                CONTRACT_CHANGE_PROPOSED|CONTRACT_CHANGE_ACK|CONTRACT_PUBLISHED|CONTRACT_REVIEW_NEEDED|CONTRACT_FEEDBACK|CONTRACT_APPROVED|CONTRACT_REJECTED)
                    ;;
                *)
                    continue
                    ;;
            esac
        fi

        format_message "$file"
        ((displayed++)) || true
    done <<< "$message_files"

    if [[ "$displayed" -eq 0 ]]; then
        echo "No messages match the filter criteria."
    else
        echo "---"
        echo "Displayed $displayed message(s)"
        echo ""
        echo "To acknowledge a message:"
        echo "  ./scripts/coordination/ack-message.sh <message-id>"
    fi
}

main "$@"
