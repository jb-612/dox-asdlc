#!/bin/bash
# Merge feature branch changes back to main.
#
# Usage: ./scripts/worktree/merge-worktree.sh <context>
#
# This script:
# - Verifies the feature branch exists
# - Attempts fast-forward merge first
# - Falls back to merge commit if needed
# - Detects and reports conflicts (exit code 1)
# - Does NOT auto-resolve conflicts
#
# Examples:
#   ./scripts/worktree/merge-worktree.sh p11-guardrails
#   ./scripts/worktree/merge-worktree.sh p04-review-swarm

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
    echo "Merge feature branch changes back to main."
    echo ""
    echo "Arguments:"
    echo "  context    Bounded context name (required)"
    echo ""
    echo "Options:"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Behavior:"
    echo "  - Attempts fast-forward merge first"
    echo "  - Falls back to merge commit if needed"
    echo "  - Reports conflicts without auto-resolving"
    echo "  - Exit code 0 on success, 1 on failure/conflict"
    echo ""
    echo "Examples:"
    echo "  $0 p11-guardrails     # Merge feature/p11-guardrails to main"
    echo "  $0 p04-review-swarm   # Merge feature/p04-review-swarm to main"
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

    # Define branch name
    local branch_name="feature/$context"

    # Change to project root
    cd "$PROJECT_ROOT"

    # Verify feature branch exists
    if ! git show-ref --verify --quiet "refs/heads/$branch_name"; then
        log_error "Feature branch does not exist: $branch_name"
        echo ""
        echo "Has the worktree been set up?"
        echo "Run: ./scripts/start-session.sh $context"
        exit 1
    fi

    # Determine main branch name
    local main_branch="main"
    if ! git show-ref --verify --quiet "refs/heads/$main_branch"; then
        main_branch="master"
        if ! git show-ref --verify --quiet "refs/heads/$main_branch"; then
            log_error "Neither 'main' nor 'master' branch exists"
            exit 1
        fi
    fi

    # Get current branch to restore later if needed
    local original_branch
    original_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    # Check if we're in a worktree or the main working directory
    local is_main_worktree=true
    if [[ -f "$PROJECT_ROOT/.git" ]]; then
        # .git is a file, meaning we're in a worktree
        is_main_worktree=false
        log_warn "Running from a worktree. Merge will be performed in the main repository."
    fi

    # Get number of commits to merge
    local commits_ahead
    commits_ahead=$(git rev-list --count "$main_branch".."$branch_name" 2>/dev/null || echo "0")

    if [[ "$commits_ahead" == "0" ]]; then
        log_info "Branch $branch_name has no new commits to merge"
        echo "Branch is up to date with $main_branch"
        exit 0
    fi

    log_info "Found $commits_ahead commit(s) to merge from $branch_name"

    # Ensure main branch is checked out
    if [[ "$original_branch" != "$main_branch" ]]; then
        log_info "Checking out $main_branch..."
        if ! git checkout "$main_branch"; then
            log_error "Failed to checkout $main_branch"
            exit 1
        fi
    fi

    # Try fast-forward merge first
    log_info "Attempting fast-forward merge..."
    if git merge --ff-only "$branch_name" 2>/dev/null; then
        echo ""
        echo -e "${GREEN}Fast-forward merge successful!${NC}"
        echo ""
        echo "Merged $commits_ahead commit(s) from $branch_name"
        echo "Branch $main_branch is now at: $(git rev-parse --short HEAD)"
        exit 0
    fi

    # Fast-forward failed, try regular merge
    log_info "Fast-forward not possible, creating merge commit..."

    # Attempt regular merge
    if git merge "$branch_name" -m "Merge $branch_name into $main_branch"; then
        echo ""
        echo -e "${GREEN}Merge commit created successfully!${NC}"
        echo ""
        echo "Merged $commits_ahead commit(s) from $branch_name"
        echo "Branch $main_branch is now at: $(git rev-parse --short HEAD)"
        exit 0
    fi

    # Merge failed - conflicts detected
    echo ""
    echo -e "${RED}Merge conflict detected!${NC}"
    echo ""
    echo "Conflicting files:"
    git diff --name-only --diff-filter=U 2>/dev/null || true
    echo ""
    echo "To resolve:"
    echo "  1. Manually edit conflicting files"
    echo "  2. git add <resolved-files>"
    echo "  3. git commit"
    echo ""
    echo "To abort the merge:"
    echo "  git merge --abort"

    exit 1
}

main "$@"
