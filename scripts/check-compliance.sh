#!/bin/bash
set -euo pipefail

# check-compliance.sh - SDD Compliance verification for parallel CLI work
#
# Usage:
#   ./scripts/check-compliance.sh [--session-start|--pre-commit] [FEATURE_ID]
#
# Modes:
#   --session-start          Check parallel CLI session requirements
#   --pre-commit FEATURE_ID  Full pre-commit verification
#   FEATURE_ID               Check feature planning compliance (default)
#
# Exit codes:
#   0 = compliant
#   1 = non-compliant (BLOCKING)
#
# Examples:
#   ./scripts/check-compliance.sh P03-F01-agent-worker-pool
#   ./scripts/check-compliance.sh --session-start
#   ./scripts/check-compliance.sh --pre-commit P03-F01-agent-worker-pool

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check() {
    local description="$1"
    local condition="$2"

    if eval "$condition"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASS++)) || true
    else
        echo -e "${RED}✗${NC} $description"
        ((FAIL++)) || true
    fi
}

warn() {
    local description="$1"
    echo -e "${YELLOW}⚠${NC} $description"
    ((WARN++)) || true
}

run_check() {
    local description="$1"
    local command="$2"

    echo "  Running: $command"
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASS++)) || true
    else
        echo -e "${RED}✗${NC} $description"
        ((FAIL++)) || true
    fi
}

usage() {
    echo "Usage: $0 [--session-start|--pre-commit] [FEATURE_ID]"
    echo ""
    echo "Modes:"
    echo "  --session-start          Check parallel CLI session requirements"
    echo "  --pre-commit FEATURE_ID  Full pre-commit verification"
    echo "  FEATURE_ID               Check feature planning compliance"
    echo ""
    echo "Examples:"
    echo "  $0 P03-F01-agent-worker-pool"
    echo "  $0 --session-start"
    echo "  $0 --pre-commit P03-F01-agent-worker-pool"
    exit 1
}

# Session start checks for parallel CLI instances
check_session_start() {
    echo "=========================================="
    echo "SESSION START COMPLIANCE CHECK"
    echo "=========================================="
    echo ""

    echo "Checking instance identity..."
    echo "-----------------------------"

    # Check CLAUDE_INSTANCE_ID environment variable
    if [[ -n "${CLAUDE_INSTANCE_ID:-}" ]]; then
        check "CLAUDE_INSTANCE_ID set" "true"
        echo "  Instance: $CLAUDE_INSTANCE_ID"
    else
        warn "CLAUDE_INSTANCE_ID not set (defaults to 'pm' in main repo)"
    fi

    echo ""
    echo "Checking git author..."
    echo "----------------------"

    # Get current git author
    local git_author_name
    local git_author_email
    git_author_name=$(git config user.name 2>/dev/null || echo "")
    git_author_email=$(git config user.email 2>/dev/null || echo "")

    if [[ -n "$git_author_name" && -n "$git_author_email" ]]; then
        check "Git author configured" "true"
        echo "  Author: $git_author_name <$git_author_email>"
    else
        warn "Git author not fully configured"
    fi

    # Get current branch (informational only)
    local current_branch
    current_branch=$(git branch --show-current 2>/dev/null || echo "")
    if [[ -n "$current_branch" ]]; then
        echo ""
        echo "Current branch: $current_branch"
    fi

    echo ""
    echo "Checking coordination messages..."
    echo "---------------------------------"

    REDIS_HOST="${REDIS_HOST:-localhost}"
    REDIS_PORT="${REDIS_PORT:-6379}"

    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
        # Use Redis for coordination checks
        MESSAGE_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZCARD "asdlc:coord:timeline" 2>/dev/null || echo "0")
        echo "  Total messages (Redis): $MESSAGE_COUNT"

        PENDING_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SCARD "asdlc:coord:pending" 2>/dev/null || echo "0")
        if [[ "$PENDING_COUNT" -gt 0 ]]; then
            check "No pending acknowledgments required" "false"
            echo "  Pending ACKs: $PENDING_COUNT"
            echo "  Run: ./scripts/coordination/check-messages.sh --pending"
        else
            check "No pending acknowledgments required" "true"
        fi
    else
        warn "Redis not available - cannot check coordination messages"
    fi

    echo ""
    echo "Checking file locks..."
    echo "----------------------"

    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
        # Use Redis for lock checks
        LOCK_COUNT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SCARD "asdlc:coord:locks" 2>/dev/null || echo "0")
        if [[ "$LOCK_COUNT" -gt 0 ]]; then
            warn "Active file locks found: $LOCK_COUNT"
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SMEMBERS "asdlc:coord:locks" 2>/dev/null | head -5
        else
            check "No conflicting file locks" "true"
        fi
    else
        check "No conflicting file locks" "true"
    fi
}

# Feature planning compliance check
check_feature_compliance() {
    local feature_id="$1"
    local workitem_dir="${PROJECT_ROOT}/.workitems/${feature_id}"

    echo "=========================================="
    echo "FEATURE COMPLIANCE CHECK: $feature_id"
    echo "=========================================="
    echo ""

    echo "Checking work item directory..."
    echo "-------------------------------"

    # Check directory exists on disk
    check "Work item directory exists on disk" "[[ -d '$workitem_dir' ]]"

    if [[ ! -d "$workitem_dir" ]]; then
        echo ""
        echo -e "${RED}BLOCKING:${NC} Work item directory not found."
        echo "Run: ./scripts/new-feature.sh <phase> <feature> <description>"
        return 1
    fi

    # Check directory is tracked in git
    echo ""
    echo "Checking git tracking..."
    echo "------------------------"

    if git ls-files --error-unmatch ".workitems/${feature_id}" > /dev/null 2>&1; then
        check "Work item is committed to git" "true"
    else
        check "Work item is committed to git" "false"
        echo "  Planning exists on disk but is NOT committed"
        echo "  Run: git add .workitems/${feature_id}/ && git commit -m 'chore(${feature_id}): Add planning artifacts'"
    fi

    echo ""
    echo "Checking planning files..."
    echo "--------------------------"

    local design_file="${workitem_dir}/design.md"
    local stories_file="${workitem_dir}/user_stories.md"
    local tasks_file="${workitem_dir}/tasks.md"

    # Check design.md
    check "design.md exists" "[[ -f '$design_file' ]]"
    if [[ -f "$design_file" ]]; then
        local design_lines=$(wc -l < "$design_file" | tr -d ' ')
        if [[ "$design_lines" -gt 10 ]]; then
            check "design.md has content (${design_lines} lines)" "true"
        else
            check "design.md has content (${design_lines} lines)" "false"
        fi

        # Check if design.md is committed
        if git ls-files --error-unmatch ".workitems/${feature_id}/design.md" > /dev/null 2>&1; then
            check "design.md is committed to git" "true"
        else
            check "design.md is committed to git" "false"
        fi
    fi

    # Check user_stories.md
    check "user_stories.md exists" "[[ -f '$stories_file' ]]"
    if [[ -f "$stories_file" ]]; then
        local stories_lines=$(wc -l < "$stories_file" | tr -d ' ')
        if [[ "$stories_lines" -gt 10 ]]; then
            check "user_stories.md has content (${stories_lines} lines)" "true"
        else
            check "user_stories.md has content (${stories_lines} lines)" "false"
        fi

        # Check if user_stories.md is committed
        if git ls-files --error-unmatch ".workitems/${feature_id}/user_stories.md" > /dev/null 2>&1; then
            check "user_stories.md is committed to git" "true"
        else
            check "user_stories.md is committed to git" "false"
        fi
    fi

    # Check tasks.md
    check "tasks.md exists" "[[ -f '$tasks_file' ]]"
    if [[ -f "$tasks_file" ]]; then
        local tasks_lines=$(wc -l < "$tasks_file" | tr -d ' ')
        if [[ "$tasks_lines" -gt 10 ]]; then
            check "tasks.md has content (${tasks_lines} lines)" "true"
        else
            check "tasks.md has content (${tasks_lines} lines)" "false"
        fi

        # Check if tasks.md is committed
        if git ls-files --error-unmatch ".workitems/${feature_id}/tasks.md" > /dev/null 2>&1; then
            check "tasks.md is committed to git" "true"
        else
            check "tasks.md is committed to git" "false"
        fi
    fi
}

# Pre-commit comprehensive check
check_pre_commit() {
    local feature_id="$1"
    local workitem_dir="${PROJECT_ROOT}/.workitems/${feature_id}"
    local tasks_file="${workitem_dir}/tasks.md"

    echo "=========================================="
    echo "PRE-COMMIT COMPLIANCE CHECK: $feature_id"
    echo "=========================================="
    echo ""

    # Run feature compliance check first
    check_feature_compliance "$feature_id"

    echo ""
    echo "Checking task completion..."
    echo "---------------------------"

    if [[ -f "$tasks_file" ]]; then
        # Check progress is 100%
        if grep -q 'Percentage: 100%' "$tasks_file"; then
            check "Progress is 100%" "true"
        else
            check "Progress is 100%" "false"
            local current_progress=$(grep 'Percentage:' "$tasks_file" | head -1 || echo "unknown")
            echo "  Current: $current_progress"
        fi

        # Check status is COMPLETE
        check "Status is COMPLETE" "grep -q 'Status: COMPLETE' '$tasks_file'"
    fi

    echo ""
    echo "Running tests..."
    echo "----------------"

    # Run tests
    if [[ -x "${PROJECT_ROOT}/tools/test.sh" ]]; then
        run_check "Tests pass" "'${PROJECT_ROOT}/tools/test.sh'"
    elif [[ -d "${PROJECT_ROOT}/tests" ]]; then
        run_check "Tests pass" "cd '$PROJECT_ROOT' && pytest tests/ -q"
    else
        warn "No test infrastructure found"
    fi

    echo ""
    echo "Running linter..."
    echo "-----------------"

    # Run linter
    if [[ -x "${PROJECT_ROOT}/tools/lint.sh" ]]; then
        run_check "Linter passes" "'${PROJECT_ROOT}/tools/lint.sh' '${PROJECT_ROOT}/src/'"
    else
        # Try ruff directly
        if command -v ruff &> /dev/null; then
            run_check "Linter passes" "cd '$PROJECT_ROOT' && ruff check src/"
        else
            warn "No linter found (tools/lint.sh or ruff)"
        fi
    fi
}

# Print summary and exit
print_summary() {
    echo ""
    echo "=========================================="
    echo "SUMMARY"
    echo "=========================================="
    echo ""
    echo -e "Passed:   ${GREEN}$PASS${NC}"
    echo -e "Failed:   ${RED}$FAIL${NC}"
    echo -e "Warnings: ${YELLOW}$WARN${NC}"
    echo ""

    if [[ $FAIL -eq 0 ]]; then
        echo -e "${GREEN}✓ COMPLIANT${NC} - Ready to proceed."
        exit 0
    else
        echo -e "${RED}✗ NON-COMPLIANT${NC} - BLOCKING. Fix issues before proceeding."
        echo ""
        echo "This is a BLOCKING failure. Per SDD rules:"
        echo "  - Do NOT write implementation code until compliant"
        echo "  - Commit planning artifacts before coding"
        echo "  - Ensure all checks pass before committing features"
        exit 1
    fi
}

# Main
main() {
    if [[ $# -lt 1 ]]; then
        usage
    fi

    case "$1" in
        --session-start)
            check_session_start
            ;;
        --pre-commit)
            if [[ $# -lt 2 ]]; then
                echo "Error: --pre-commit requires FEATURE_ID"
                usage
            fi
            check_pre_commit "$2"
            ;;
        --help|-h)
            usage
            ;;
        *)
            # Assume it's a feature ID
            check_feature_compliance "$1"
            ;;
    esac

    print_summary
}

main "$@"
