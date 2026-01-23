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
