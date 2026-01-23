#!/bin/bash
# Set git identity and environment for parallel Claude CLI instances.
#
# Usage: source scripts/cli-identity.sh <ui|agent>
#
# This script configures a unique git identity for each CLI instance,
# enabling clear audit trails when multiple Claude instances work
# simultaneously on the same project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_STATUS_KEY="asdlc:coord:status"

# Check if Redis is available
redis_available() {
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"
}

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Check if Redis is available
redis_available() {
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"
}

usage() {
    echo "Usage: source scripts/cli-identity.sh <backend|frontend|orchestrator>"
    echo ""
    echo "Instances:"
    echo "  backend      - Backend development (workers, orchestrator, infrastructure)"
    echo "  frontend     - Frontend development (HITL Web UI)"
    echo "  orchestrator - Master agent: review, merge, meta files, docs"
    echo ""
    echo "Legacy aliases (deprecated):"
    echo "  agent  -> backend"
    echo "  ui     -> frontend"
    echo ""
    echo "The orchestrator (master agent) has exclusive control over:"
    echo "  - CLAUDE.md, README.md, .claude/rules/, .claude/skills/"
    echo "  - docs/, .workitems/, contracts/"
    echo ""
    echo "This script must be sourced, not executed directly."
}

update_status() {
    local instance="$1"
    local active="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    if redis_available; then
        # Use Redis for status tracking
        local active_val="0"
        [[ "$active" == "true" ]] && active_val="1"

        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
            HSET "$REDIS_STATUS_KEY" \
            "${instance}.active" "$active_val" \
            "${instance}.last_update" "$timestamp" \
            > /dev/null
    else
        echo "Warning: Redis not available, status not persisted" >&2
    fi
}

# Check and display pending notifications for an instance
check_pending_notifications() {
    local instance="$1"

    # Skip if Redis not available
    if ! redis_available; then
        return 0
    fi

    # Source common.sh for the Python helper
    source "$SCRIPT_DIR/coordination/lib/common.sh" 2>/dev/null || return 0

    # Check if Python coordination is available
    if ! check_python_coordination_available 2>/dev/null; then
        return 0
    fi

    # Set CLAUDE_INSTANCE_ID temporarily if not already set
    local orig_instance="${CLAUDE_INSTANCE_ID:-}"
    export CLAUDE_INSTANCE_ID="$instance"

    # Call the Python function and parse result
    local result
    result=$(call_python_pop_notifications 2>/dev/null) || {
        export CLAUDE_INSTANCE_ID="$orig_instance"
        return 0
    }

    # Restore original instance ID
    [[ -n "$orig_instance" ]] && export CLAUDE_INSTANCE_ID="$orig_instance"

    # Parse the JSON result
    local count
    count=$(echo "$result" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('count', 0))" 2>/dev/null) || count=0

    if [[ "$count" -gt 0 ]]; then
        echo ""
        echo "=== NOTIFICATIONS ($count pending) ==="
        # Display each notification summary
        echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for n in d.get('notifications', []):
    msg_type = n.get('type', 'UNKNOWN')
    from_inst = n.get('from', '?')
    to_inst = n.get('to', '?')
    msg_id = n.get('message_id', '?')
    print(f'  [{msg_type}] {from_inst} -> {to_inst}: {msg_id}')
" 2>/dev/null
        echo ""
        echo "Run './scripts/coordination/check-messages.sh --pending' for details."
        echo ""
    fi
}

main() {
    local instance="${1:-}"

    if [[ -z "$instance" ]]; then
        usage
        return 1
    fi

    case "$instance" in
        frontend|ui)
            git config user.name "Claude Frontend"
            git config user.email "claude-frontend@asdlc.local"
            export CLAUDE_INSTANCE_ID="frontend"
            export CLAUDE_ALLOWED_PATHS="src/hitl_ui,docker/hitl-ui,.workitems/P05-*"
            export CLAUDE_BRANCH_PREFIX="ui/"
            export CLAUDE_CAN_MERGE="false"
            echo "Git identity set: Claude Frontend <claude-frontend@asdlc.local>"
            echo "Instance ID: frontend"
            echo "Allowed paths: src/hitl_ui, docker/hitl-ui, .workitems/P05-*"
            echo "Branch prefix: ui/"
            echo "Can merge to main: No"
            update_status "frontend" "true"
            check_pending_notifications "frontend"
            ;;
        backend|agent)
            git config user.name "Claude Backend"
            git config user.email "claude-backend@asdlc.local"
            export CLAUDE_INSTANCE_ID="backend"
            export CLAUDE_ALLOWED_PATHS="src/workers,src/orchestrator,src/infrastructure,docker/workers,docker/orchestrator,.workitems/P01-*,.workitems/P02-*,.workitems/P03-*,.workitems/P06-*"
            export CLAUDE_BRANCH_PREFIX="agent/"
            export CLAUDE_CAN_MERGE="false"
            echo "Git identity set: Claude Backend <claude-backend@asdlc.local>"
            echo "Instance ID: backend"
            echo "Allowed paths: src/workers, src/orchestrator, src/infrastructure, .workitems/P01-P03,P06-*"
            echo "Branch prefix: agent/"
            echo "Can merge to main: No"
            update_status "backend" "true"
            check_pending_notifications "backend"
            ;;
        orchestrator)
            # Master agent uses Claude's default git identity
            # Unset any project-specific git config to use global/default
            git config --unset user.name 2>/dev/null || true
            git config --unset user.email 2>/dev/null || true
            export CLAUDE_INSTANCE_ID="orchestrator"
            export CLAUDE_ALLOWED_PATHS="*"
            export CLAUDE_BRANCH_PREFIX=""
            export CLAUDE_CAN_MERGE="true"
            export CLAUDE_CAN_MODIFY_META="true"
            echo "Git identity: (using Claude default)"
            echo "Instance ID: orchestrator (master agent)"
            echo "Exclusive ownership:"
            echo "  - CLAUDE.md, README.md"
            echo "  - .claude/rules/, .claude/skills/"
            echo "  - docs/ (SDD, TDD documentation)"
            echo "  - contracts/"
            echo "Shared with feature CLIs:"
            echo "  - .workitems/ (feature CLIs manage their own planning)"
            echo "Branch: main (exclusive write access)"
            echo "Can merge to main: Yes"
            echo "Can modify project meta: Yes"
            update_status "orchestrator" "true"
            check_pending_notifications "orchestrator"
            ;;
        deactivate)
            # Deactivate the current instance
            local current_id="${CLAUDE_INSTANCE_ID:-}"
            if [[ -n "$current_id" ]]; then
                update_status "$current_id" "false"
                unset CLAUDE_INSTANCE_ID
                unset CLAUDE_ALLOWED_PATHS
                unset CLAUDE_BRANCH_PREFIX
                unset CLAUDE_CAN_MERGE
                unset CLAUDE_CAN_MODIFY_META
                echo "Deactivated instance: $current_id"
            else
                echo "No active instance to deactivate"
            fi
            ;;
        status)
            if redis_available; then
                echo "Instance Status (from Redis):"
                redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HGETALL "$REDIS_STATUS_KEY" | \
                    paste - - | while read key value; do
                        echo "  $key: $value"
                    done
            else
                echo "Redis not available"
            fi
            ;;
        *)
            echo "Error: Unknown instance '$instance'"
            usage
            return 1
            ;;
    esac
}

# Check if script is being sourced
if [[ -n "${BASH_SOURCE[0]:-}" ]] && [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Warning: This script should be sourced, not executed."
    echo "Use: source scripts/cli-identity.sh <backend|frontend|orchestrator>"
    exit 1
fi

main "$@"
