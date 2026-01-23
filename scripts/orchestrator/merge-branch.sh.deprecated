#!/bin/bash
# Safe merge script for orchestrator CLI.
#
# Usage: ./scripts/orchestrator/merge-branch.sh <branch-name> [--no-push]
#
# This script:
# 1. Verifies orchestrator identity
# 2. Verifies review passed (checks for recent review report)
# 3. Ensures we're on main branch
# 4. Performs the merge (no fast-forward)
# 5. Runs post-merge verification
# 6. Optionally pushes to remote
#
# Exit codes:
#   0 - Merge successful
#   1 - Merge failed or verification failed
#   2 - Usage error or precondition not met

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REVIEWS_DIR="$PROJECT_ROOT/.claude/coordination/reviews"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <branch-name> [--no-push]"
    echo ""
    echo "Arguments:"
    echo "  branch-name    The feature branch to merge (any branch name)"
    echo ""
    echo "Options:"
    echo "  --no-push      Skip pushing to remote after merge"
    echo "  --force        Skip review check (use with caution)"
    echo "  -h, --help     Show this help"
    echo ""
    echo "This script must be run by the orchestrator CLI instance."
    echo "A passing review (./scripts/orchestrator/review-branch.sh) is required."
}

log_step() {
    echo -e "\n${CYAN}==>${NC} $1"
}

log_pass() {
    echo -e "  ${GREEN}[OK]${NC} $1"
}

log_fail() {
    echo -e "  ${RED}[FAIL]${NC} $1"
}

# Check orchestrator identity
check_identity() {
    local identity_file="$PROJECT_ROOT/.claude/instance-identity.json"

    if [[ ! -f "$identity_file" ]]; then
        echo -e "${RED}Error: Identity file not found. Use ./start-orchestrator.sh${NC}"
        return 1
    fi

    local instance_id
    instance_id=$(python3 -c "import json; print(json.load(open('$identity_file')).get('instance_id', ''))" 2>/dev/null || echo "")

    if [[ "$instance_id" != "orchestrator" ]]; then
        echo -e "${RED}Error: This script must be run by the orchestrator CLI.${NC}"
        echo "Current identity: $instance_id"
        echo "Use: ./start-orchestrator.sh"
        return 1
    fi

    local can_merge
    can_merge=$(python3 -c "import json; print(json.load(open('$identity_file')).get('can_merge', False))" 2>/dev/null || echo "false")

    if [[ "$can_merge" != "True" ]]; then
        echo -e "${RED}Error: Orchestrator identity does not have merge permission.${NC}"
        return 1
    fi

    return 0
}

# Find most recent passing review for a branch
find_review() {
    local branch="$1"
    local branch_basename
    branch_basename=$(basename "$branch")

    # Look for review files matching this branch
    local review_file
    review_file=$(ls -t "$REVIEWS_DIR"/review-*-"$branch_basename".md 2>/dev/null | head -1 || echo "")

    if [[ -z "$review_file" ]]; then
        return 1
    fi

    # Check if review passed
    if grep -q "Status.*PASSED" "$review_file" 2>/dev/null; then
        echo "$review_file"
        return 0
    fi

    return 1
}

main() {
    local branch=""
    local push_after=true
    local force_merge=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-push)
                push_after=false
                shift
                ;;
            --force)
                force_merge=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                if [[ -z "$branch" ]]; then
                    branch="$1"
                else
                    echo "Error: Unexpected argument '$1'"
                    usage
                    exit 2
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$branch" ]]; then
        echo "Error: Branch name required"
        usage
        exit 2
    fi

    echo "=============================================="
    echo "  ORCHESTRATOR MERGE: $branch"
    echo "=============================================="
    echo ""

    # Step 1: Verify orchestrator identity
    log_step "Verifying orchestrator identity"

    if ! check_identity; then
        exit 2
    fi
    log_pass "Orchestrator identity verified"

    # Step 2: Check for passing review
    log_step "Checking for passing review"

    local review_file=""
    if [[ "$force_merge" == "true" ]]; then
        echo -e "  ${YELLOW}[WARN]${NC} Skipping review check (--force used)"
    else
        if review_file=$(find_review "$branch"); then
            log_pass "Found passing review: $(basename "$review_file")"
        else
            log_fail "No passing review found for branch: $branch"
            echo ""
            echo "Run the review first:"
            echo "  ./scripts/orchestrator/review-branch.sh $branch"
            exit 2
        fi
    fi

    # Step 3: Ensure we're on main branch
    log_step "Checking current branch"

    local current_branch
    current_branch=$(git branch --show-current)

    if [[ "$current_branch" != "main" ]]; then
        echo "  Switching to main branch..."
        git checkout main
        git pull origin main 2>/dev/null || true
    fi
    log_pass "On main branch"

    # Step 4: Verify branch exists and is up to date
    log_step "Verifying feature branch"

    if ! git rev-parse --verify "$branch" >/dev/null 2>&1; then
        log_fail "Branch does not exist: $branch"
        exit 1
    fi

    git fetch origin "$branch" 2>/dev/null || true
    log_pass "Branch verified: $branch"

    # Step 5: Check for merge conflicts
    log_step "Checking for merge conflicts"

    if git merge --no-commit --no-ff "$branch" 2>/dev/null; then
        git merge --abort 2>/dev/null || true
        log_pass "No merge conflicts"
    else
        git merge --abort 2>/dev/null || true
        log_fail "Merge conflicts detected"
        echo ""
        echo "The feature branch has conflicts with main."
        echo "Notify the feature CLI to rebase and resolve conflicts."
        exit 1
    fi

    # Step 6: Perform the merge
    log_step "Performing merge"

    local merge_msg="Merge branch '$branch' into main

Reviewed by: Orchestrator CLI
Review: $(basename "${review_file:-manual-merge}")"

    if git merge --no-ff -m "$merge_msg" "$branch"; then
        log_pass "Merge completed"
    else
        log_fail "Merge failed"
        exit 1
    fi

    local merge_commit
    merge_commit=$(git rev-parse HEAD)

    # Step 7: Post-merge verification
    log_step "Running post-merge verification"

    local verification_failed=false

    # Run tests
    if [[ -x "$PROJECT_ROOT/tools/test.sh" ]]; then
        if "$PROJECT_ROOT/tools/test.sh" >/dev/null 2>&1; then
            log_pass "Post-merge tests passed"
        else
            log_fail "Post-merge tests failed"
            verification_failed=true
        fi
    else
        echo -e "  ${YELLOW}[SKIP]${NC} No test.sh found"
    fi

    # Run E2E tests
    if [[ -x "$PROJECT_ROOT/tools/e2e.sh" ]]; then
        if "$PROJECT_ROOT/tools/e2e.sh" >/dev/null 2>&1; then
            log_pass "Post-merge E2E tests passed"
        else
            log_fail "Post-merge E2E tests failed"
            verification_failed=true
        fi
    else
        echo -e "  ${YELLOW}[SKIP]${NC} No e2e.sh found"
    fi

    if [[ "$verification_failed" == "true" ]]; then
        echo ""
        echo -e "${RED}Post-merge verification failed!${NC}"
        echo ""
        echo "Options:"
        echo "  1. Fix the issues and amend the merge commit"
        echo "  2. Revert the merge: git revert -m 1 $merge_commit"
        echo ""
        echo "The merge has been completed locally but NOT pushed."
        exit 1
    fi

    # Step 8: Push to remote (if enabled)
    if [[ "$push_after" == "true" ]]; then
        log_step "Pushing to remote"

        if git push origin main; then
            log_pass "Pushed to origin/main"
        else
            log_fail "Push failed"
            echo ""
            echo "The merge is complete locally. Push manually:"
            echo "  git push origin main"
            exit 1
        fi
    else
        echo ""
        echo -e "${YELLOW}Skipping push (--no-push specified)${NC}"
        echo "Push manually when ready: git push origin main"
    fi

    # Step 9: Send success notification
    echo ""
    echo -e "${GREEN}=============================================="
    echo "  MERGE SUCCESSFUL"
    echo -e "==============================================${NC}"
    echo ""
    echo "Branch: $branch"
    echo "Merged to: main"
    echo "Commit: $merge_commit"
    echo ""
    echo "Notify the feature CLI:"
    echo "  ./scripts/coordination/publish-message.sh REVIEW_COMPLETE \"$branch\" \"Merged as ${merge_commit:0:7}\""

    exit 0
}

main "$@"
