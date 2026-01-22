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
    echo "  --all        Show all messages, not just for current instance"
    echo "  --pending    Show only messages pending acknowledgment"
    echo "  --from <id>  Filter by sender instance (ui or agent)"
    echo "  --recent     Show only messages from last 24 hours (default)"
    echo "  --week       Show messages from last 7 days"
    echo "  -h, --help   Show this help"
    echo ""
    echo "Without options, shows unacknowledged messages for the current instance."
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
        CONTRACT_CHANGE_PROPOSED|INTERFACE_UPDATE)
            type_color="$YELLOW"
            ;;
        BLOCKING_ISSUE)
            type_color="$RED"
            ;;
        READY_FOR_MERGE|CONTRACT_PUBLISHED)
            type_color="$GREEN"
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

        local to from acknowledged
        to=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('to',''))")
        from=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('from',''))")
        acknowledged=$(echo "$json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('acknowledged',False))")

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
