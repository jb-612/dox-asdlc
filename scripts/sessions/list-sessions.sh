#!/bin/bash
# Cross-source session status viewer for aSDLC.
#
# Checks three sources for active sessions:
#   1. tmux windows (if "asdlc" session exists)
#   2. SQLite telemetry (if ~/.asdlc/telemetry.db exists)
#   3. Git worktrees
#
# Usage: ./scripts/sessions/list-sessions.sh
#
# Output: Table with [Source, Context/Name, Status, Details]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SESSION_NAME="asdlc"
TELEMETRY_DB="$HOME/.asdlc/telemetry.db"

# Status badges
status_active() { echo -e "${GREEN}active${NC}"; }
status_stale()  { echo -e "${YELLOW}stale${NC}"; }
status_ended()  { echo -e "${RED}ended${NC}"; }
status_unknown(){ echo -e "${DIM}unknown${NC}"; }

usage() {
    echo "Usage: $0"
    echo ""
    echo "Show active aSDLC sessions from all available sources."
    echo ""
    echo "Sources checked:"
    echo "  1. tmux windows in '$SESSION_NAME' session"
    echo "  2. SQLite telemetry at $TELEMETRY_DB"
    echo "  3. Git worktrees under $PROJECT_ROOT"
    echo ""
    echo "Options:"
    echo "  -h, --help   Show this help message"
}

# Print a separator line
separator() {
    echo -e "${DIM}$(printf '%-12s' '---')$(printf '%-28s' '---')$(printf '%-12s' '---')%-s${NC}" "---"
}

# Print table header
print_header() {
    echo ""
    echo -e "${BOLD}$(printf '%-12s' 'SOURCE')$(printf '%-28s' 'CONTEXT')$(printf '%-12s' 'STATUS')DETAILS${NC}"
    separator
}

# --- Source 1: tmux windows ---
check_tmux() {
    if ! command -v tmux &>/dev/null; then
        echo -e "$(printf '%-12s' 'tmux')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")tmux not installed"
        return
    fi

    if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "$(printf '%-12s' 'tmux')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")session '$SESSION_NAME' not running"
        return
    fi

    # List windows in the session
    local windows
    windows=$(tmux list-windows -t "$SESSION_NAME" -F '#{window_name} #{window_active} #{pane_current_command}' 2>/dev/null) || {
        echo -e "$(printf '%-12s' 'tmux')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${YELLOW}error${NC}")")failed to list windows"
        return
    }

    local found=0
    while IFS=' ' read -r win_name win_active pane_cmd; do
        local status_str
        if [[ "$win_active" == "1" ]]; then
            status_str="$(status_active) *"
        else
            status_str="$(status_active)"
        fi

        local detail="pane: $pane_cmd"
        echo -e "$(printf '%-12s' 'tmux')$(printf '%-28s' "$win_name")$(printf '%-12s' "$status_str")$detail"
        found=1
    done <<< "$windows"

    if [[ "$found" -eq 0 ]]; then
        echo -e "$(printf '%-12s' 'tmux')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")no windows found"
    fi
}

# --- Source 2: SQLite telemetry ---
check_sqlite() {
    if ! command -v sqlite3 &>/dev/null; then
        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")sqlite3 not installed"
        return
    fi

    if [[ ! -f "$TELEMETRY_DB" ]]; then
        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")$TELEMETRY_DB not found"
        return
    fi

    # Check if sessions table exists
    local has_table
    has_table=$(sqlite3 "$TELEMETRY_DB" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='sessions';" 2>/dev/null) || {
        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${YELLOW}error${NC}")")failed to query database"
        return
    }

    if [[ "$has_table" -eq 0 ]]; then
        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")no sessions table"
        return
    fi

    # Query sessions from last 24 hours
    # Schema: sessions(session_id, started_at, ended_at, agent_type, instance_id, model)
    local rows
    rows=$(sqlite3 -separator '|' "$TELEMETRY_DB" \
        "SELECT COALESCE(instance_id, session_id),
                CASE WHEN ended_at IS NULL THEN 'active' ELSE 'ended' END,
                datetime(started_at, 'unixepoch', 'localtime'),
                CASE WHEN ended_at IS NOT NULL THEN datetime(ended_at, 'unixepoch', 'localtime') ELSE '' END,
                COALESCE(agent_type, '')
         FROM sessions
         WHERE started_at >= strftime('%s', 'now', '-24 hours')
         ORDER BY started_at DESC
         LIMIT 20;" 2>/dev/null) || {
        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${YELLOW}error${NC}")")query failed"
        return
    }

    if [[ -z "$rows" ]]; then
        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")no sessions in last 24h"
        return
    fi

    while IFS='|' read -r ctx status started ended agent_type; do
        local status_str
        case "$status" in
            active)  status_str="$(status_active)" ;;
            stale)   status_str="$(status_stale)" ;;
            ended)   status_str="$(status_ended)" ;;
            *)       status_str="$(status_unknown)" ;;
        esac

        local detail="started: $started"
        if [[ -n "$ended" && "$ended" != "" ]]; then
            detail="$detail, ended: $ended"
        fi
        if [[ -n "$agent_type" ]]; then
            detail="$detail, type: $agent_type"
        fi

        echo -e "$(printf '%-12s' 'sqlite')$(printf '%-28s' "$ctx")$(printf '%-12s' "$status_str")$detail"
    done <<< "$rows"
}

# --- Source 3: Git worktrees ---
check_worktrees() {
    if ! command -v git &>/dev/null; then
        echo -e "$(printf '%-12s' 'worktree')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")git not installed"
        return
    fi

    local worktrees
    worktrees=$(git -C "$PROJECT_ROOT" worktree list --porcelain 2>/dev/null) || {
        echo -e "$(printf '%-12s' 'worktree')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${YELLOW}error${NC}")")failed to list worktrees"
        return
    }

    local found=0
    local wt_path=""
    local wt_branch=""

    while IFS= read -r line; do
        if [[ "$line" =~ ^worktree\ (.+)$ ]]; then
            wt_path="${BASH_REMATCH[1]}"
            wt_branch=""
        elif [[ "$line" =~ ^branch\ refs/heads/(.+)$ ]]; then
            wt_branch="${BASH_REMATCH[1]}"
        elif [[ -z "$line" && -n "$wt_path" ]]; then
            # Skip the main worktree (it's not a feature worktree)
            if [[ "$wt_path" == "$PROJECT_ROOT" ]]; then
                wt_path=""
                wt_branch=""
                continue
            fi

            # Extract context name from worktree path
            local ctx
            ctx=$(basename "$wt_path")
            local detail="branch: ${wt_branch:-detached}, path: $wt_path"

            # Check if worktree directory exists and is accessible
            local status_str
            if [[ -d "$wt_path" ]]; then
                status_str="$(status_active)"
            else
                status_str="$(status_ended)"
            fi

            echo -e "$(printf '%-12s' 'worktree')$(printf '%-28s' "$ctx")$(printf '%-12s' "$status_str")$detail"
            found=1

            wt_path=""
            wt_branch=""
        fi
    done <<< "$worktrees"

    # Handle last entry (porcelain output may not end with blank line)
    if [[ -n "$wt_path" && "$wt_path" != "$PROJECT_ROOT" ]]; then
        local ctx
        ctx=$(basename "$wt_path")
        local detail="branch: ${wt_branch:-detached}, path: $wt_path"
        local status_str
        if [[ -d "$wt_path" ]]; then
            status_str="$(status_active)"
        else
            status_str="$(status_ended)"
        fi
        echo -e "$(printf '%-12s' 'worktree')$(printf '%-28s' "$ctx")$(printf '%-12s' "$status_str")$detail"
    fi

    if [[ "$found" -eq 0 && -z "$wt_path" ]]; then
        echo -e "$(printf '%-12s' 'worktree')$(printf '%-28s' '-')$(printf '%-12s' "$(echo -e "${DIM}n/a${NC}")")no feature worktrees"
    fi
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown argument: $1"
                usage
                exit 1
                ;;
        esac
    done

    echo ""
    echo -e "${CYAN}${BOLD}aSDLC Session Status${NC}"
    echo -e "${DIM}Checked at: $(date '+%Y-%m-%d %H:%M:%S')${NC}"

    print_header

    check_tmux
    separator
    check_sqlite
    separator
    check_worktrees

    echo ""
}

log_error() {
    echo -e "${RED}[-]${NC} $1" >&2
}

main "$@"
