#!/bin/bash
# tmux session launcher for aSDLC multi-context development.
#
# Usage: ./scripts/sessions/tmux-launcher.sh [context1] [context2] ...
#
# Creates a tmux session named "asdlc" with:
#   - Window 0 "pm": runs claude in the main repo
#   - Window 1-N: one per feature context, each in its worktree
#   - Final window "dashboard": runs the dashboard server
#
# If the session already exists, attaches to it.
# If individual windows already exist, they are skipped.
#
# Examples:
#   ./scripts/sessions/tmux-launcher.sh p11-guardrails p04-review-swarm
#   ./scripts/sessions/tmux-launcher.sh  # pm + dashboard only

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
NC='\033[0m'

SESSION_NAME="asdlc"

log_info() {
    echo -e "${GREEN}[+]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[-]${NC} $1" >&2
}

log_step() {
    echo -e "${BLUE}==> ${BOLD}$1${NC}"
}

usage() {
    echo "Usage: $0 [context1] [context2] ..."
    echo ""
    echo "Launch an aSDLC tmux session with multiple feature contexts."
    echo ""
    echo "Creates tmux session '$SESSION_NAME' with:"
    echo "  Window 0 'pm'        - Claude CLI in main repo"
    echo "  Window 1-N           - One per context argument (in worktree)"
    echo "  Final window 'dashboard' - Dashboard server"
    echo ""
    echo "If the session already exists, attaches to it."
    echo "If a window already exists, it is skipped."
    echo ""
    echo "Options:"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 p11-guardrails p04-review-swarm"
    echo "  $0  # pm + dashboard only"
}

# Check if tmux is installed
check_tmux() {
    if ! command -v tmux &>/dev/null; then
        log_error "tmux is not installed. Install with: brew install tmux"
        exit 1
    fi
}

# Check if a tmux window with the given name exists in the session
window_exists() {
    local win_name="$1"
    tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -qx "$win_name"
}

# Ensure worktree exists for a context by calling start-session.sh
ensure_worktree() {
    local ctx="$1"
    local start_script="$PROJECT_ROOT/scripts/start-session.sh"
    if [[ ! -x "$start_script" ]]; then
        log_error "start-session.sh not found or not executable at: $start_script"
        return 1
    fi
    log_info "Ensuring worktree for context: $ctx"
    "$start_script" "$ctx" >/dev/null 2>&1 || {
        log_error "Failed to set up worktree for: $ctx"
        return 1
    }
}

main() {
    local contexts=()

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                contexts+=("$1")
                shift
                ;;
        esac
    done

    check_tmux

    echo ""
    echo -e "${CYAN}${BOLD}========================================${NC}"
    echo -e "${CYAN}${BOLD}  aSDLC tmux Session Launcher${NC}"
    echo -e "${CYAN}${BOLD}========================================${NC}"
    echo ""

    # If session already exists, attach to it
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_warn "Session '$SESSION_NAME' already exists."

        # Still add any new context windows that don't exist yet
        for ctx in "${contexts[@]+"${contexts[@]}"}"; do
            if ! window_exists "$ctx"; then
                ensure_worktree "$ctx"
                local wt_dir="$PROJECT_ROOT/.worktrees/$ctx"
                log_info "Adding window: $ctx"
                tmux new-window -t "$SESSION_NAME" -n "$ctx"
                tmux send-keys -t "$SESSION_NAME:$ctx" "cd '$wt_dir' && export CLAUDE_INSTANCE_ID='$ctx' && claude" Enter
            else
                log_info "Window '$ctx' already exists, skipping."
            fi
        done

        # Ensure dashboard window exists
        if ! window_exists "dashboard"; then
            log_step "Adding dashboard window..."
            tmux new-window -t "$SESSION_NAME" -n "dashboard"
            local dashboard_script="$PROJECT_ROOT/scripts/telemetry/dashboard_server.py"
            if [[ -f "$dashboard_script" ]]; then
                tmux send-keys -t "$SESSION_NAME:dashboard" "cd '$PROJECT_ROOT' && python3 '$dashboard_script'" Enter
            else
                tmux send-keys -t "$SESSION_NAME:dashboard" "cd '$PROJECT_ROOT' && echo 'Dashboard server not found at scripts/telemetry/dashboard_server.py'" Enter
            fi
        fi

        log_info "Attaching to existing session..."
        echo ""
        tmux attach-session -t "$SESSION_NAME"
        exit 0
    fi

    # --- Create new session ---

    # Window 0: pm (main repo with claude)
    log_step "Creating session with pm window..."
    tmux new-session -d -s "$SESSION_NAME" -n "pm" -c "$PROJECT_ROOT"
    tmux send-keys -t "$SESSION_NAME:pm" "export CLAUDE_INSTANCE_ID=pm && claude" Enter
    log_info "Window 'pm' created (main repo)"

    # Windows 1-N: one per context
    for ctx in "${contexts[@]+"${contexts[@]}"}"; do
        ensure_worktree "$ctx"
        local wt_dir="$PROJECT_ROOT/.worktrees/$ctx"

        if [[ ! -d "$wt_dir" ]]; then
            log_error "Worktree directory missing after setup: $wt_dir (skipping)"
            continue
        fi

        log_step "Creating window: $ctx"
        tmux new-window -t "$SESSION_NAME" -n "$ctx"
        tmux send-keys -t "$SESSION_NAME:$ctx" "cd '$wt_dir' && export CLAUDE_INSTANCE_ID='$ctx' && claude" Enter
        log_info "Window '$ctx' created"
    done

    # Final window: dashboard
    log_step "Creating dashboard window..."
    tmux new-window -t "$SESSION_NAME" -n "dashboard"
    local dashboard_script="$PROJECT_ROOT/scripts/telemetry/dashboard_server.py"
    if [[ -f "$dashboard_script" ]]; then
        tmux send-keys -t "$SESSION_NAME:dashboard" "cd '$PROJECT_ROOT' && python3 '$dashboard_script'" Enter
        log_info "Dashboard window created (server starting)"
    else
        tmux send-keys -t "$SESSION_NAME:dashboard" "cd '$PROJECT_ROOT' && echo 'Dashboard server not yet available at scripts/telemetry/dashboard_server.py'" Enter
        log_warn "Dashboard server script not found; window created with placeholder"
    fi

    # Select the pm window before attaching
    tmux select-window -t "$SESSION_NAME:pm"

    echo ""
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo -e "${GREEN}${BOLD}  Session '$SESSION_NAME' ready!${NC}"
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo ""
    echo -e "  Windows:"
    echo -e "    ${BOLD}pm${NC}        - Main repo (PM CLI)"
    for ctx in "${contexts[@]+"${contexts[@]}"}"; do
        echo -e "    ${BOLD}$ctx${NC} - Worktree context"
    done
    echo -e "    ${BOLD}dashboard${NC} - Dashboard server"
    echo ""
    echo -e "  Shortcuts:"
    echo -e "    ${CYAN}Ctrl-b n${NC}  Next window"
    echo -e "    ${CYAN}Ctrl-b p${NC}  Previous window"
    echo -e "    ${CYAN}Ctrl-b w${NC}  Window list"
    echo ""

    # Attach
    tmux attach-session -t "$SESSION_NAME"
}

main "$@"
