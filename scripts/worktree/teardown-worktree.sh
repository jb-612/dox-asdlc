#!/bin/bash
# Remove a worktree cleanly.
#
# Usage: ./scripts/worktree/teardown-worktree.sh <context> [--merge|--abandon]
#
# This script:
# - Checks for uncommitted changes in the worktree
# - Optionally merges changes to main before removal (--merge)
# - Optionally abandons changes without merge (--abandon)
# - Prompts user if uncommitted changes and no flag specified
# - Removes the worktree with git worktree remove
# - Deletes the branch if fully merged
#
# Examples:
#   ./scripts/worktree/teardown-worktree.sh p11-guardrails --merge
#   ./scripts/worktree/teardown-worktree.sh p04-review-swarm --abandon

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

usage() {
    echo "Usage: $0 <context> [--merge|--abandon]"
    echo ""
    echo "Remove a worktree cleanly."
    echo ""
    echo "Arguments:"
    echo "  context    Bounded context name (required)"
    echo ""
    echo "Options:"
    echo "  --merge    Merge changes to main before removing worktree"
    echo "  --abandon  Remove worktree without merging (lose uncommitted changes)"
    echo "  -h, --help Show this help message"
    echo ""
    echo "If uncommitted changes exist and no flag is specified, the script"
    echo "will prompt for action (requires interactive terminal)."
    echo ""
    echo "Examples:"
    echo "  $0 p11-guardrails --merge     # Merge changes, then remove"
    echo "  $0 p04-review-swarm --abandon # Remove worktree, discard changes"
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

# =============================================================================
# Redis Coordination Functions
# =============================================================================

check_redis_available() {
    if command -v redis-cli &>/dev/null; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"
        return $?
    fi
    return 1
}

deregister_presence() {
    local context="$1"

    # Check if Redis is available
    if ! check_redis_available; then
        log_warn "Redis not available at $REDIS_HOST:$REDIS_PORT"
        log_warn "Presence deregistration skipped"
        return 0  # Don't block teardown
    fi

    # Deregister presence by marking inactive
    local presence_key="asdlc:coord:presence"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update presence fields to mark inactive
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HSET "$presence_key" \
        "${context}.active" "0" \
        "${context}.last_heartbeat" "$now" \
        > /dev/null 2>&1; then
        log_info "Presence deregistered for context: $context"
    else
        log_warn "Failed to deregister presence - may show as stale"
    fi

    return 0  # Don't block teardown on deregistration failure
}

publish_session_end() {
    local context="$1"
    local reason="${2:-user_exit}"

    # Check if Redis is available
    if ! check_redis_available; then
        log_warn "Redis not available - SESSION_END message not published"
        return 0  # Don't block teardown
    fi

    # Generate message ID
    local msg_id="msg-$(date +%s)-$$"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Build JSON payload
    local json_payload
    json_payload=$(cat <<EOF
{
    "id": "$msg_id",
    "type": "SESSION_END",
    "from": "$context",
    "to": "all",
    "timestamp": "$now",
    "requires_ack": false,
    "acknowledged": false,
    "payload": {
        "subject": "Session ended: $context",
        "description": "Session ended. Reason: $reason"
    }
}
EOF
)

    # Store message in Redis
    local messages_key="asdlc:coord:messages"
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HSET "$messages_key" "$msg_id" "$json_payload" > /dev/null 2>&1; then
        log_info "SESSION_END message published (id: $msg_id)"
    else
        log_warn "Failed to publish SESSION_END message"
    fi

    # Notify via pub/sub channel
    local channel="asdlc:coord:notifications"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "$channel" "$json_payload" > /dev/null 2>&1 || true

    return 0  # Don't block teardown on message failure
}

has_uncommitted_changes() {
    local worktree_path="$1"
    pushd "$worktree_path" > /dev/null

    local has_changes=false

    # Check for staged or unstaged changes
    if ! git diff --quiet HEAD 2>/dev/null; then
        has_changes=true
    fi

    if ! git diff --cached --quiet HEAD 2>/dev/null; then
        has_changes=true
    fi

    # Check for untracked files
    if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
        has_changes=true
    fi

    popd > /dev/null

    [[ "$has_changes" == "true" ]]
}

merge_to_main() {
    local context="$1"
    local branch_name="feature/$context"

    log_info "Merging $branch_name to main..."

    cd "$PROJECT_ROOT"

    # Determine main branch name
    local main_branch="main"
    if ! git show-ref --verify --quiet "refs/heads/$main_branch"; then
        main_branch="master"
    fi

    # Get current branch to restore later
    local original_branch
    original_branch=$(git rev-parse --abbrev-ref HEAD)

    # Checkout main
    git checkout "$main_branch"

    # Attempt merge
    if git merge --ff-only "$branch_name" 2>/dev/null; then
        log_info "Fast-forward merge successful"
    elif git merge "$branch_name" -m "Merge $branch_name into $main_branch"; then
        log_info "Merge commit created"
    else
        log_error "Merge failed - conflicts detected"
        log_error "Resolve conflicts manually, then run teardown again"
        # Return to original branch
        git checkout "$original_branch" 2>/dev/null || true
        return 1
    fi

    return 0
}

main() {
    local context=""
    local action=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            --merge)
                action="merge"
                shift
                ;;
            --abandon)
                action="abandon"
                shift
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

    # Define paths
    local worktree_dir="$PROJECT_ROOT/.worktrees/$context"
    local branch_name="feature/$context"

    # Check if worktree exists
    if [[ ! -d "$worktree_dir" ]]; then
        log_error "Worktree does not exist: $worktree_dir"
        exit 1
    fi

    # Verify it's a valid worktree
    cd "$PROJECT_ROOT"
    if ! git worktree list | grep -q "$worktree_dir"; then
        log_error "Directory exists but is not a valid worktree: $worktree_dir"
        exit 1
    fi

    # Check for uncommitted changes
    if has_uncommitted_changes "$worktree_dir"; then
        log_warn "Worktree has uncommitted changes"

        if [[ -z "$action" ]]; then
            # Interactive prompt
            if [[ -t 0 ]]; then
                echo ""
                echo "Options:"
                echo "  m) Merge changes to main, then remove"
                echo "  a) Abandon changes and remove"
                echo "  c) Cancel"
                echo ""
                read -r -p "Choose action [m/a/c]: " choice
                case "$choice" in
                    m|M) action="merge" ;;
                    a|A) action="abandon" ;;
                    *) echo "Cancelled"; exit 0 ;;
                esac
            else
                log_error "Uncommitted changes detected. Use --merge or --abandon flag."
                exit 1
            fi
        fi

        if [[ "$action" == "merge" ]]; then
            # First commit any uncommitted changes in the worktree
            log_info "Committing uncommitted changes in worktree..."
            pushd "$worktree_dir" > /dev/null
            git add -A
            git commit -m "WIP: Auto-commit before worktree teardown" || true
            popd > /dev/null
        fi
    fi

    # Merge if requested
    if [[ "$action" == "merge" ]]; then
        if ! merge_to_main "$context"; then
            exit 1
        fi
    fi

    # Deregister presence from Redis before removing worktree
    log_info "Deregistering session presence..."
    deregister_presence "$context"

    # Publish SESSION_END message
    log_info "Publishing SESSION_END message..."
    local teardown_reason="user_exit"
    if [[ "$action" == "merge" ]]; then
        teardown_reason="task_complete"
    elif [[ "$action" == "abandon" ]]; then
        teardown_reason="user_exit"
    fi
    publish_session_end "$context" "$teardown_reason"

    # Remove worktree
    log_info "Removing worktree: $worktree_dir"
    cd "$PROJECT_ROOT"
    git worktree remove "$worktree_dir" --force

    # Delete branch if fully merged (only if we merged)
    if [[ "$action" == "merge" ]]; then
        # Determine main branch
        local main_branch="main"
        if ! git show-ref --verify --quiet "refs/heads/$main_branch"; then
            main_branch="master"
        fi

        # Check if branch is merged
        if git branch --merged "$main_branch" | grep -q "$branch_name"; then
            log_info "Deleting merged branch: $branch_name"
            git branch -d "$branch_name"
        else
            log_warn "Branch not fully merged, keeping: $branch_name"
        fi
    elif [[ "$action" == "abandon" ]]; then
        # Force delete the branch
        log_info "Deleting abandoned branch: $branch_name"
        git branch -D "$branch_name" 2>/dev/null || log_warn "Branch already deleted or does not exist"
    fi

    echo ""
    echo -e "${GREEN}Worktree teardown complete!${NC}"
    echo ""
    echo "Removed: $worktree_dir"
    if [[ "$action" == "merge" ]]; then
        echo "Changes merged to main"
    elif [[ "$action" == "abandon" ]]; then
        echo "Changes abandoned (not merged)"
    fi
}

main "$@"
