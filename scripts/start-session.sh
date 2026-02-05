#!/bin/bash
# Unified session launcher for bounded context worktrees.
#
# Usage: ./scripts/start-session.sh <context>
#
# This script:
# - Calls setup-worktree.sh to create/verify worktree
# - Sets CLAUDE_INSTANCE_ID for the context
# - Outputs next steps instructions for user
#
# The script is idempotent (safe to run multiple times).
#
# Examples:
#   ./scripts/start-session.sh p11-guardrails
#   ./scripts/start-session.sh p04-review-swarm
#   ./scripts/start-session.sh sp01-smart-saver

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <context>"
    echo ""
    echo "Unified session launcher for bounded context worktrees."
    echo ""
    echo "This script performs the complete setup for a session:"
    echo "  1. Creates/verifies git worktree for the context"
    echo "  2. Creates feature branch (feature/<context>)"
    echo "  3. Sets CLAUDE_INSTANCE_ID environment variable"
    echo "  4. Outputs next steps instructions"
    echo ""
    echo "Arguments:"
    echo "  context    Bounded context name (required)"
    echo "             Use work item format: p11-guardrails, p04-review-swarm"
    echo ""
    echo "Options:"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 p11-guardrails       # Start session for P11 guardrails feature"
    echo "  $0 p04-review-swarm     # Start session for P04 review swarm feature"
    echo "  $0 sp01-smart-saver     # Start session for side project"
    echo ""
    echo "After running this script, follow the printed instructions to:"
    echo "  - Change to the worktree directory"
    echo "  - Set CLAUDE_INSTANCE_ID"
    echo "  - Start Claude CLI"
    echo ""
    echo "The script is idempotent - safe to run multiple times."
}

log_info() {
    echo -e "${GREEN}INFO:${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}WARN:${NC} $1"
}

log_error() {
    echo -e "${RED}ERROR:${NC} $1" >&2
}

log_step() {
    echo -e "${BLUE}==>${NC} $1"
}

validate_context() {
    local context="$1"

    # Context must be non-empty
    if [[ -z "$context" ]]; then
        return 1
    fi

    # Context should not contain spaces or special characters
    if [[ "$context" =~ [[:space:]] ]]; then
        log_error "Context name cannot contain spaces"
        return 1
    fi

    # Context should follow naming convention (lowercase with hyphens)
    if [[ ! "$context" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$ ]]; then
        log_warn "Context '$context' doesn't follow naming convention (lowercase, hyphens)"
        log_warn "Recommended format: p11-guardrails, p04-review-swarm"
    fi

    return 0
}

main() {
    local context=""

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
                if [[ -z "$context" ]]; then
                    context="$1"
                else
                    log_error "Too many arguments: only one context expected"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate context is provided
    if [[ -z "$context" ]]; then
        log_error "Missing required argument: context"
        echo ""
        echo "Example: $0 p11-guardrails"
        echo ""
        echo "Run '$0 --help' for usage information."
        exit 1
    fi

    # Validate context format
    if ! validate_context "$context"; then
        exit 1
    fi

    # Define paths
    local worktree_dir="$PROJECT_ROOT/.worktrees/$context"
    local branch_name="feature/$context"

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Session Launcher: $context${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Step 1: Create/verify worktree via setup-worktree.sh
    log_step "Step 1: Setting up worktree..."

    local setup_script="$SCRIPT_DIR/worktree/setup-worktree.sh"
    if [[ ! -x "$setup_script" ]]; then
        log_error "setup-worktree.sh not found or not executable at: $setup_script"
        exit 1
    fi

    # Run setup-worktree.sh (it is idempotent)
    if ! "$setup_script" "$context"; then
        log_error "Failed to set up worktree for context: $context"
        exit 1
    fi

    # Step 2: Verify worktree exists
    log_step "Step 2: Verifying worktree..."

    if [[ ! -d "$worktree_dir" ]]; then
        log_error "Worktree directory not found after setup: $worktree_dir"
        exit 1
    fi

    log_info "Worktree verified at: $worktree_dir"

    # Step 3: Set CLAUDE_INSTANCE_ID (for this shell, but child processes will inherit)
    log_step "Step 3: CLAUDE_INSTANCE_ID will be set to: $context"

    # Output next steps
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Session Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Worktree: $worktree_dir"
    echo "Branch: $branch_name"
    echo "Instance ID: $context"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo ""
    echo "  1. Change to worktree directory:"
    echo "     cd $worktree_dir"
    echo ""
    echo "  2. Set environment variable in your shell:"
    echo "     export CLAUDE_INSTANCE_ID=$context"
    echo ""
    echo "  3. Start Claude CLI:"
    echo "     claude"
    echo ""
    echo -e "${BLUE}Quick command (copy/paste):${NC}"
    echo "  cd $worktree_dir && export CLAUDE_INSTANCE_ID=$context && claude"
    echo ""
}

main "$@"
