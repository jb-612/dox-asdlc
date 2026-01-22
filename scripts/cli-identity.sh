#!/bin/bash
# Set git identity and environment for parallel Claude CLI instances.
#
# Usage: source scripts/cli-identity.sh <ui|agent>
#
# This script configures a unique git identity for each CLI instance,
# enabling clear audit trails when multiple Claude instances work
# simultaneously on the same project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COORDINATION_DIR="$PROJECT_ROOT/.claude/coordination"
STATUS_FILE="$COORDINATION_DIR/status.json"

usage() {
    echo "Usage: source scripts/cli-identity.sh <ui|agent>"
    echo ""
    echo "Instances:"
    echo "  ui     - HITL Web UI development (P05-F01)"
    echo "  agent  - Agent Workers development (P03)"
    echo ""
    echo "This script must be sourced, not executed directly."
}

update_status() {
    local instance="$1"
    local active="$2"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    if [[ ! -f "$STATUS_FILE" ]]; then
        echo '{"ui":{"active":false},"agent":{"active":false}}' > "$STATUS_FILE"
    fi

    # Update status using Python for reliable JSON manipulation
    python3 -c "
import json
import sys

with open('$STATUS_FILE', 'r') as f:
    status = json.load(f)

status['$instance']['active'] = $active
status['$instance']['last_update'] = '$timestamp'

with open('$STATUS_FILE', 'w') as f:
    json.dump(status, f, indent=2)
"
}

main() {
    local instance="${1:-}"

    if [[ -z "$instance" ]]; then
        usage
        return 1
    fi

    case "$instance" in
        ui)
            git config user.name "Claude UI-Agent"
            git config user.email "claude-ui@asdlc.local"
            export CLAUDE_INSTANCE_ID="ui"
            export CLAUDE_ALLOWED_PATHS="src/hitl_ui,docker/hitl-ui,contracts"
            export CLAUDE_BRANCH_PREFIX="ui/"
            echo "Git identity set: Claude UI-Agent <claude-ui@asdlc.local>"
            echo "Instance ID: ui"
            echo "Allowed paths: src/hitl_ui, docker/hitl-ui, contracts"
            echo "Branch prefix: ui/"
            update_status "ui" "true"
            ;;
        agent)
            git config user.name "Claude Agent-Worker"
            git config user.email "claude-agent@asdlc.local"
            export CLAUDE_INSTANCE_ID="agent"
            export CLAUDE_ALLOWED_PATHS="src/workers,src/orchestrator,contracts"
            export CLAUDE_BRANCH_PREFIX="agent/"
            echo "Git identity set: Claude Agent-Worker <claude-agent@asdlc.local>"
            echo "Instance ID: agent"
            echo "Allowed paths: src/workers, src/orchestrator, contracts"
            echo "Branch prefix: agent/"
            update_status "agent" "true"
            ;;
        deactivate)
            # Deactivate the current instance
            local current_id="${CLAUDE_INSTANCE_ID:-}"
            if [[ -n "$current_id" ]]; then
                update_status "$current_id" "false"
                unset CLAUDE_INSTANCE_ID
                unset CLAUDE_ALLOWED_PATHS
                unset CLAUDE_BRANCH_PREFIX
                echo "Deactivated instance: $current_id"
            else
                echo "No active instance to deactivate"
            fi
            ;;
        status)
            cat "$STATUS_FILE"
            ;;
        *)
            echo "Error: Unknown instance '$instance'"
            usage
            return 1
            ;;
    esac
}

# Check if script is being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Warning: This script should be sourced, not executed."
    echo "Use: source scripts/cli-identity.sh <ui|agent>"
    exit 1
fi

main "$@"
