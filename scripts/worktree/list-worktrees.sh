#!/bin/bash
# List all worktrees and their status.
#
# Usage: ./scripts/worktree/list-worktrees.sh [-h|--help]
#
# Outputs JSON array with worktree information:
# - context: Bounded context name
# - branch: Current branch name
# - path: Absolute path to worktree
# - status: clean, modified, or unknown

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output (used in non-JSON mode)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

usage() {
    echo "Usage: $0 [-h|--help]"
    echo ""
    echo "List all worktrees in .worktrees/ and their status."
    echo ""
    echo "Options:"
    echo "  -h, --help   Show this help message"
    echo ""
    echo "Output:"
    echo "  JSON array with objects containing:"
    echo "  - context: Bounded context name (p11-guardrails, p04-review-swarm, etc.)"
    echo "  - branch: Current branch name"
    echo "  - path: Absolute path to worktree"
    echo "  - status: clean, modified, or unknown"
    echo ""
    echo "Example output:"
    echo '  [{"context":"p11-guardrails","branch":"feature/p11-guardrails","path":"/path/.worktrees/p11-guardrails","status":"clean"}]'
}

get_worktree_status() {
    local worktree_path="$1"
    if [[ ! -d "$worktree_path" ]]; then
        echo "unknown"
        return
    fi

    pushd "$worktree_path" > /dev/null 2>&1 || { echo "unknown"; return; }

    # Check if there are uncommitted changes
    if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then
        # Check for untracked files
        if [[ -z "$(git ls-files --others --exclude-standard)" ]]; then
            echo "clean"
        else
            echo "modified"
        fi
    else
        echo "modified"
    fi

    popd > /dev/null 2>&1 || true
}

get_worktree_branch() {
    local worktree_path="$1"
    if [[ ! -d "$worktree_path" ]]; then
        echo "unknown"
        return
    fi

    pushd "$worktree_path" > /dev/null 2>&1 || { echo "unknown"; return; }

    local branch
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    echo "$branch"

    popd > /dev/null 2>&1 || true
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
                echo "Unknown argument: $1" >&2
                usage
                exit 1
                ;;
        esac
    done

    local worktrees_dir="$PROJECT_ROOT/.worktrees"

    # If no worktrees directory, output empty array
    if [[ ! -d "$worktrees_dir" ]]; then
        echo "[]"
        exit 0
    fi

    # Get list of worktrees from git
    local git_worktrees
    git_worktrees=$(cd "$PROJECT_ROOT" && git worktree list --porcelain 2>/dev/null || true)

    # Build JSON array
    local json_array="["
    local first=true

    # Iterate over directories in .worktrees/
    for entry in "$worktrees_dir"/*; do
        if [[ -d "$entry" ]]; then
            local context
            context=$(basename "$entry")
            local worktree_path
            worktree_path=$(cd "$entry" && pwd)

            # Verify it's a git worktree
            if ! echo "$git_worktrees" | grep -q "$worktree_path"; then
                continue
            fi

            local branch
            branch=$(get_worktree_branch "$worktree_path")

            local status
            status=$(get_worktree_status "$worktree_path")

            # Add comma if not first element
            if [[ "$first" == "true" ]]; then
                first=false
            else
                json_array+=","
            fi

            # Escape any special characters in paths for JSON
            local escaped_path
            escaped_path=$(echo "$worktree_path" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g')

            json_array+="{\"context\":\"$context\",\"branch\":\"$branch\",\"path\":\"$escaped_path\",\"status\":\"$status\"}"
        fi
    done

    json_array+="]"

    echo "$json_array"
}

main "$@"
