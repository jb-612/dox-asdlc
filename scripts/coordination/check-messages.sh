#!/bin/bash
# Check for coordination messages via Redis backend.
#
# Usage: ./scripts/coordination/check-messages.sh [--all] [--pending] [--from <instance>]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load common helper functions
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

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
    echo "  -h, --help      Show this help"
    echo ""
    echo "Without options, shows unacknowledged messages for the current instance."
}

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

check_via_redis() {
    local to_instance="$1"
    local from_instance="$2"
    local msg_type="$3"
    local pending_only="$4"
    local limit="$5"

    local py_pending="False"
    [[ "$pending_only" == "true" ]] && py_pending="True"

    local result
    result=$(call_python_check "$to_instance" "$from_instance" "$msg_type" "$py_pending" "$limit")

    local success
    success=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success',False))")

    if [[ "$success" != "True" ]]; then
        local error
        error=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))")
        echo "Error: $error" >&2
        return 1
    fi

    local count
    count=$(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('count',0))")

    if [[ "$count" -eq 0 ]]; then
        [[ "$pending_only" == "true" ]] && echo "  No pending messages." || echo "No messages match the filter."
        return 0
    fi

    local i=0
    while [[ $i -lt $count ]]; do
        local msg_json
        msg_json=$(echo "$result" | python3 -c "import json,sys; msgs=json.load(sys.stdin).get('messages',[]); print(json.dumps(msgs[$i]) if $i < len(msgs) else '{}')")
        format_message_from_json "$msg_json"
        ((i++)) || true
    done

    echo "---"
    echo "Displayed $count message(s)"
    echo ""
    echo "To acknowledge: ./scripts/coordination/ack-message.sh <message-id>"
}

main() {
    local show_all=false
    local pending_only=false
    local filter_from=""
    local filter_type=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --all) show_all=true; shift ;;
            --pending) pending_only=true; shift ;;
            --from) filter_from="$2"; shift 2 ;;
            --type) filter_type="$2"; shift 2 ;;
            -h|--help) usage; exit 0 ;;
            *) echo "Unknown option: $1"; usage; exit 1 ;;
        esac
    done

    # Deprecation warning for native teams mode
    if [[ "${COORDINATION_BACKEND:-}" == "native_teams" ]]; then
        echo "WARNING: Redis coordination messaging is deprecated when COORDINATION_BACKEND=native_teams." >&2
        echo "         Messages are delivered automatically in native teams mode. See .claude/rules/native-teams.md" >&2
    fi

    # Get instance from identity file (via common.sh)
    local current_instance="${COORD_INSTANCE_ID:-}"

    echo ""
    echo "=== Coordination Messages ==="
    [[ -n "$current_instance" ]] && echo "Instance: $current_instance" || echo "Note: Identity file not found"
    echo ""

    # Check Redis availability
    if ! check_redis_available; then
        echo "Error: Redis not available. Ensure Redis is running." >&2
        exit 1
    fi

    local to_filter=""
    [[ "$show_all" != "true" && -n "$current_instance" ]] && to_filter="$current_instance"

    [[ "$pending_only" == "true" ]] && echo -e "${YELLOW}Messages Pending Acknowledgment:${NC}" && echo ""

    check_via_redis "$to_filter" "$filter_from" "$filter_type" "$pending_only" "100"
}

main "$@"
