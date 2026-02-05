#!/bin/bash
# Create and configure a worktree for isolated parallel development.
#
# Usage: ./scripts/worktree/setup-worktree.sh <context>
#
# This script:
# - Creates a git worktree at .worktrees/<context>/
# - Creates branch feature/<context> from main
# - Is idempotent (safe to run multiple times)
#
# Examples:
#   ./scripts/worktree/setup-worktree.sh p11-guardrails
#   ./scripts/worktree/setup-worktree.sh p04-review-swarm

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <context>"
    echo ""
    echo "Create and configure a worktree for isolated parallel development."
    echo ""
    echo "Arguments:"
    echo "  context    Bounded context name (required)"
    echo "             Use work item format: p11-guardrails, p04-review-swarm"
    echo ""
    echo "Options:"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 p11-guardrails       # Create worktree for P11 guardrails"
    echo "  $0 p04-review-swarm     # Create worktree for P04 review swarm"
    echo ""
    echo "Worktree location: .worktrees/<context>/"
    echo "Branch: feature/<context>"
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

validate_context() {
    local context="$1"

    # Context must be non-empty
    if [[ -z "$context" ]]; then
        return 1
    fi

    # Context should not contain spaces
    if [[ "$context" =~ [[:space:]] ]]; then
        log_error "Context name cannot contain spaces"
        return 1
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
                    log_error "Too many arguments"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate context
    if [[ -z "$context" ]]; then
        log_error "Missing required argument: context"
        usage
        exit 1
    fi

    if ! validate_context "$context"; then
        exit 1
    fi

    # Define paths
    local worktree_dir="$PROJECT_ROOT/.worktrees/$context"
    local branch_name="feature/$context"

    # Change to project root
    cd "$PROJECT_ROOT"

    # Check if worktree already exists
    if [[ -d "$worktree_dir" ]]; then
        log_info "Worktree already exists at: $worktree_dir"

        # Verify it's a valid worktree
        if git worktree list | grep -q "$worktree_dir"; then
            log_info "Worktree is valid and ready for use"
            echo ""
            echo "To use this worktree:"
            echo "  cd $worktree_dir"
            echo "  export CLAUDE_INSTANCE_ID=$context"
            echo "  claude"
            exit 0
        else
            log_error "Directory exists but is not a valid worktree"
            log_error "Please remove manually and retry: rm -rf $worktree_dir"
            exit 1
        fi
    fi

    # Check if branch already exists
    local branch_exists=false
    if git show-ref --verify --quiet "refs/heads/$branch_name" 2>/dev/null; then
        branch_exists=true
        log_info "Branch $branch_name already exists"
    fi

    # Create worktree directory parent if needed
    mkdir -p "$(dirname "$worktree_dir")"

    # Create worktree
    log_info "Creating worktree at: $worktree_dir"
    if [[ "$branch_exists" == "true" ]]; then
        # Use existing branch
        git worktree add "$worktree_dir" "$branch_name"
    else
        # Create new branch from main
        # First ensure we have the latest main
        local main_branch="main"
        if ! git show-ref --verify --quiet "refs/heads/$main_branch"; then
            main_branch="master"
        fi

        git worktree add -b "$branch_name" "$worktree_dir" "$main_branch"
    fi

    log_info "Worktree created successfully"

    # Ensure .worktrees is in .gitignore
    local gitignore="$PROJECT_ROOT/.gitignore"
    if [[ -f "$gitignore" ]]; then
        if ! grep -q "^\.worktrees/$" "$gitignore" && ! grep -q "^\.worktrees$" "$gitignore"; then
            log_info "Adding .worktrees/ to .gitignore"
            echo "" >> "$gitignore"
            echo "# Session worktrees (parallel session isolation)" >> "$gitignore"
            echo ".worktrees/" >> "$gitignore"
        fi
    fi

    echo ""
    echo -e "${GREEN}Worktree setup complete!${NC}"
    echo ""
    echo "Location: $worktree_dir"
    echo "Branch: $branch_name"
    echo ""
    echo "To use this worktree:"
    echo "  cd $worktree_dir"
    echo "  export CLAUDE_INSTANCE_ID=$context"
    echo "  claude"
}

main "$@"
