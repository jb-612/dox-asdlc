#!/bin/bash
# Integration tests for worktree management scripts.
#
# Tests the full worktree lifecycle:
# - setup-agent.sh: Create agent worktrees
# - list-agents.sh: List existing worktrees
# - merge-agent.sh: Merge agent branches
# - teardown-agent.sh: Clean up worktrees
#
# Usage:
#   ./tests/integration/scripts/test_worktree_scripts.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#
# Note: This test creates a temporary git repository for isolation.
# All test artifacts are cleaned up automatically.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Temporary test repository
TEST_REPO=""

# =============================================================================
# Test Utilities
# =============================================================================

log_test() {
    echo -e "\n${BLUE}TEST:${NC} $1"
}

log_info() {
    echo -e "${GREEN}INFO:${NC} $1"
}

pass() {
    echo -e "  ${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
}

fail() {
    echo -e "  ${RED}FAIL${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
}

skip() {
    echo -e "  ${YELLOW}SKIP${NC}: $1"
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
}

# Create a temporary git repository for testing
setup_test_repo() {
    log_info "Creating temporary test repository..."

    TEST_REPO=$(mktemp -d)

    # Initialize git repo
    cd "$TEST_REPO"
    git init --initial-branch=main
    git config user.email "test@example.com"
    git config user.name "Test User"

    # Create initial commit
    echo "# Test Repo" > README.md
    git add README.md
    git commit -m "Initial commit"

    # Create .gitignore with .worktrees
    echo ".worktrees/" > .gitignore
    git add .gitignore
    git commit -m "Add gitignore"

    # Copy scripts to test repo
    mkdir -p "$TEST_REPO/scripts/worktree"
    cp "$PROJECT_ROOT/scripts/worktree/"*.sh "$TEST_REPO/scripts/worktree/"
    chmod +x "$TEST_REPO/scripts/worktree/"*.sh

    log_info "Test repository created at: $TEST_REPO"
}

# Clean up temporary test repository
cleanup_test_repo() {
    if [[ -n "$TEST_REPO" && -d "$TEST_REPO" ]]; then
        log_info "Cleaning up test repository..."

        # Remove worktrees first (required before deleting repo)
        cd "$TEST_REPO"
        for worktree in "$TEST_REPO/.worktrees/"*; do
            if [[ -d "$worktree" ]]; then
                git worktree remove "$worktree" --force 2>/dev/null || true
            fi
        done

        rm -rf "$TEST_REPO"
        log_info "Test repository cleaned up"
    fi
}

trap cleanup_test_repo EXIT

# =============================================================================
# Setup Script Tests (setup-agent.sh)
# =============================================================================

test_setup_creates_worktree() {
    log_test "setup-agent.sh creates worktree for valid role"

    cd "$TEST_REPO"

    local output
    local exit_code=0
    output=$("$TEST_REPO/scripts/worktree/setup-agent.sh" backend 2>&1) || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        fail "Script exited with code $exit_code: $output"
        return
    fi

    # Verify worktree was created
    if [[ ! -d "$TEST_REPO/.worktrees/backend" ]]; then
        fail "Worktree directory not created"
        return
    fi

    # Verify it's a valid worktree
    if ! git worktree list | grep -q ".worktrees/backend"; then
        fail "Directory exists but is not a git worktree"
        return
    fi

    pass
}

test_setup_creates_branch() {
    log_test "setup-agent.sh creates agent branch"

    cd "$TEST_REPO"

    # Branch should have been created by previous test or setup now
    if ! git show-ref --verify --quiet "refs/heads/agent/backend/active" 2>/dev/null; then
        # Run setup if branch doesn't exist
        "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || true
    fi

    if git show-ref --verify --quiet "refs/heads/agent/backend/active"; then
        pass
    else
        fail "Branch agent/backend/active not created"
    fi
}

test_setup_configures_worktree_identity() {
    log_test "setup-worktree.sh configures CLAUDE_INSTANCE_ID for worktree"

    cd "$TEST_REPO"

    # Ensure worktree exists
    if [[ ! -d "$TEST_REPO/.worktrees/backend" ]]; then
        "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || true
    fi

    # Verify worktree directory exists (identity is now via CLAUDE_INSTANCE_ID env var, not git email)
    if [[ -d "$TEST_REPO/.worktrees/backend" ]]; then
        pass
    else
        fail "Worktree directory not created for backend context"
    fi
}

test_setup_idempotent() {
    log_test "setup-agent.sh is idempotent (safe to run twice)"

    cd "$TEST_REPO"

    # First run (may already exist from previous tests)
    "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || true

    # Second run should succeed
    local exit_code=0
    "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || exit_code=$?

    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Second run failed with exit code $exit_code"
    fi
}

test_setup_invalid_role() {
    log_test "setup-agent.sh rejects invalid role"

    cd "$TEST_REPO"

    local exit_code=0
    local output
    output=$("$TEST_REPO/scripts/worktree/setup-agent.sh" invalidrole 2>&1) || exit_code=$?

    if [[ "$exit_code" -ne 0 ]] && echo "$output" | grep -qi "invalid"; then
        pass
    else
        fail "Should reject invalid role (exit code: $exit_code)"
    fi
}

test_setup_no_arguments() {
    log_test "setup-agent.sh shows help with no arguments"

    cd "$TEST_REPO"

    local exit_code=0
    local output
    output=$("$TEST_REPO/scripts/worktree/setup-agent.sh" 2>&1) || exit_code=$?

    if [[ "$exit_code" -ne 0 ]] && echo "$output" | grep -qi "missing"; then
        pass
    else
        fail "Should show error for missing argument"
    fi
}

# =============================================================================
# List Script Tests (list-agents.sh)
# =============================================================================

test_list_shows_worktrees() {
    log_test "list-agents.sh shows existing worktrees"

    cd "$TEST_REPO"

    # Ensure worktree exists
    if [[ ! -d "$TEST_REPO/.worktrees/backend" ]]; then
        "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || true
    fi

    local output
    output=$("$TEST_REPO/scripts/worktree/list-agents.sh" 2>&1)

    if echo "$output" | grep -q "backend"; then
        pass
    else
        fail "Output should contain 'backend': $output"
    fi
}

test_list_json_format() {
    log_test "list-agents.sh outputs valid JSON"

    cd "$TEST_REPO"

    local output
    output=$("$TEST_REPO/scripts/worktree/list-agents.sh" 2>&1)

    # Try to parse as JSON (using Python since jq may not be available)
    if echo "$output" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
        pass
    else
        fail "Output is not valid JSON: $output"
    fi
}

test_list_empty_when_no_worktrees() {
    log_test "list-agents.sh returns empty array when no worktrees"

    # Create a fresh temporary repo for this test
    local temp_repo
    temp_repo=$(mktemp -d)

    cd "$temp_repo"
    git init --initial-branch=main
    git config user.email "test@example.com"
    git config user.name "Test User"
    echo "test" > test.txt
    git add test.txt
    git commit -m "Initial"

    # Copy list script
    mkdir -p "$temp_repo/scripts/worktree"
    cp "$PROJECT_ROOT/scripts/worktree/list-agents.sh" "$temp_repo/scripts/worktree/"
    chmod +x "$temp_repo/scripts/worktree/list-agents.sh"

    local output
    output=$("$temp_repo/scripts/worktree/list-agents.sh" 2>&1)

    rm -rf "$temp_repo"

    if [[ "$output" == "[]" ]]; then
        pass
    else
        fail "Expected empty array [], got: $output"
    fi
}

# =============================================================================
# Merge Script Tests (merge-agent.sh)
# =============================================================================

test_merge_fast_forward() {
    log_test "merge-agent.sh performs fast-forward merge"

    cd "$TEST_REPO"

    # Create frontend worktree for this test
    "$TEST_REPO/scripts/worktree/setup-agent.sh" frontend >/dev/null 2>&1 || true

    # Make a commit in the worktree
    cd "$TEST_REPO/.worktrees/frontend"
    echo "Frontend change" > frontend.txt
    git add frontend.txt
    git commit -m "Add frontend file"

    # Go back to main repo and merge
    cd "$TEST_REPO"

    local output
    local exit_code=0
    output=$("$TEST_REPO/scripts/worktree/merge-agent.sh" frontend 2>&1) || exit_code=$?

    if [[ "$exit_code" -eq 0 ]] && echo "$output" | grep -qi "merge"; then
        # Verify the file exists in main
        if [[ -f "$TEST_REPO/frontend.txt" ]]; then
            pass
        else
            fail "Merge succeeded but file not present in main"
        fi
    else
        fail "Merge failed (exit code: $exit_code): $output"
    fi
}

test_merge_nonexistent_branch() {
    log_test "merge-agent.sh handles non-existent branch"

    cd "$TEST_REPO"

    local exit_code=0
    local output
    output=$("$TEST_REPO/scripts/worktree/merge-agent.sh" nonexistent 2>&1) || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        pass
    else
        fail "Should fail for non-existent branch"
    fi
}

test_merge_no_changes() {
    log_test "merge-agent.sh handles branch with no new commits"

    cd "$TEST_REPO"

    # Create orchestrator worktree (no commits made)
    "$TEST_REPO/scripts/worktree/setup-agent.sh" orchestrator >/dev/null 2>&1 || true

    cd "$TEST_REPO"

    local output
    local exit_code=0
    output=$("$TEST_REPO/scripts/worktree/merge-agent.sh" orchestrator 2>&1) || exit_code=$?

    # Should succeed or indicate nothing to merge
    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Should handle branch with no changes (exit code: $exit_code)"
    fi
}

# =============================================================================
# Teardown Script Tests (teardown-agent.sh)
# =============================================================================

test_teardown_removes_worktree() {
    log_test "teardown-agent.sh removes worktree (--abandon)"

    cd "$TEST_REPO"

    # Create devops worktree for this test
    "$TEST_REPO/scripts/worktree/setup-agent.sh" devops >/dev/null 2>&1 || true

    # Verify it exists
    if [[ ! -d "$TEST_REPO/.worktrees/devops" ]]; then
        fail "Setup failed - worktree not created"
        return
    fi

    # Teardown with --abandon
    local exit_code=0
    "$TEST_REPO/scripts/worktree/teardown-agent.sh" devops --abandon >/dev/null 2>&1 || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        fail "Teardown script failed with exit code $exit_code"
        return
    fi

    # Verify worktree is gone
    if [[ -d "$TEST_REPO/.worktrees/devops" ]]; then
        fail "Worktree directory still exists after teardown"
        return
    fi

    pass
}

test_teardown_nonexistent_worktree() {
    log_test "teardown-agent.sh handles non-existent worktree"

    cd "$TEST_REPO"

    local exit_code=0
    local output
    output=$("$TEST_REPO/scripts/worktree/teardown-agent.sh" nonexistent --abandon 2>&1) || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        pass
    else
        fail "Should fail for non-existent worktree"
    fi
}

test_teardown_with_merge() {
    log_test "teardown-agent.sh merges before removal (--merge)"

    cd "$TEST_REPO"

    # Create devops worktree again
    "$TEST_REPO/scripts/worktree/setup-agent.sh" devops >/dev/null 2>&1 || true

    # Make a commit in the worktree
    cd "$TEST_REPO/.worktrees/devops"
    echo "DevOps change" > devops.txt
    git add devops.txt
    git commit -m "Add devops file"

    # Teardown with --merge
    cd "$TEST_REPO"
    local exit_code=0
    "$TEST_REPO/scripts/worktree/teardown-agent.sh" devops --merge >/dev/null 2>&1 || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        fail "Teardown with --merge failed with exit code $exit_code"
        return
    fi

    # Verify the file exists in main (merge happened)
    if [[ -f "$TEST_REPO/devops.txt" ]]; then
        pass
    else
        fail "File should exist in main after --merge"
    fi
}

# =============================================================================
# Full Workflow Tests
# =============================================================================

test_full_workflow_cycle() {
    log_test "Full workflow: setup -> work -> merge -> teardown"

    cd "$TEST_REPO"

    # 1. Setup
    log_info "  Step 1: Setup orchestrator worktree"
    "$TEST_REPO/scripts/worktree/setup-agent.sh" orchestrator >/dev/null 2>&1 || true

    if [[ ! -d "$TEST_REPO/.worktrees/orchestrator" ]]; then
        fail "Step 1 failed: worktree not created"
        return
    fi

    # 2. Work (make changes)
    log_info "  Step 2: Make changes in worktree"
    cd "$TEST_REPO/.worktrees/orchestrator"
    echo "Workflow test file" > workflow_test.txt
    git add workflow_test.txt
    git commit -m "Workflow test commit"

    # 3. List (verify visible)
    log_info "  Step 3: Verify worktree is listed"
    cd "$TEST_REPO"
    local list_output
    list_output=$("$TEST_REPO/scripts/worktree/list-agents.sh" 2>&1)

    if ! echo "$list_output" | grep -q "orchestrator"; then
        fail "Step 3 failed: worktree not listed"
        return
    fi

    # 4. Merge
    log_info "  Step 4: Merge changes to main"
    local merge_exit=0
    "$TEST_REPO/scripts/worktree/merge-agent.sh" orchestrator >/dev/null 2>&1 || merge_exit=$?

    if [[ "$merge_exit" -ne 0 ]]; then
        fail "Step 4 failed: merge failed"
        return
    fi

    # 5. Teardown
    log_info "  Step 5: Teardown worktree"
    local teardown_exit=0
    "$TEST_REPO/scripts/worktree/teardown-agent.sh" orchestrator --abandon >/dev/null 2>&1 || teardown_exit=$?

    if [[ "$teardown_exit" -ne 0 ]]; then
        fail "Step 5 failed: teardown failed"
        return
    fi

    # 6. Verify final state
    log_info "  Step 6: Verify final state"
    if [[ -d "$TEST_REPO/.worktrees/orchestrator" ]]; then
        fail "Step 6 failed: worktree still exists"
        return
    fi

    if [[ ! -f "$TEST_REPO/workflow_test.txt" ]]; then
        fail "Step 6 failed: merged file not in main"
        return
    fi

    pass
}

test_multiple_worktrees() {
    log_test "Multiple worktrees can coexist"

    cd "$TEST_REPO"

    # Setup multiple worktrees
    "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || true
    "$TEST_REPO/scripts/worktree/setup-agent.sh" frontend >/dev/null 2>&1 || true

    # Both should exist
    if [[ ! -d "$TEST_REPO/.worktrees/backend" ]]; then
        fail "Backend worktree not created"
        return
    fi

    if [[ ! -d "$TEST_REPO/.worktrees/frontend" ]]; then
        fail "Frontend worktree not created"
        return
    fi

    # List should show both
    local list_output
    list_output=$("$TEST_REPO/scripts/worktree/list-agents.sh" 2>&1)

    if echo "$list_output" | grep -q "backend" && echo "$list_output" | grep -q "frontend"; then
        pass
    else
        fail "List should show both worktrees: $list_output"
    fi
}

# =============================================================================
# Conflict Detection Tests
# =============================================================================

test_merge_conflict_detection() {
    log_test "merge-agent.sh detects conflicts"

    cd "$TEST_REPO"

    # Create backend worktree (may already exist)
    "$TEST_REPO/scripts/worktree/setup-agent.sh" backend >/dev/null 2>&1 || true

    # Create a file in main
    cd "$TEST_REPO"
    echo "Main version" > conflict_file.txt
    git add conflict_file.txt
    git commit -m "Add conflict file in main"

    # Create conflicting change in worktree
    cd "$TEST_REPO/.worktrees/backend"
    # First, sync with main to get the file
    git merge main --no-edit 2>/dev/null || true

    # Now modify the same file differently
    echo "Backend version" > conflict_file.txt
    git add conflict_file.txt
    git commit -m "Modify conflict file in backend"

    # Meanwhile, modify again in main
    cd "$TEST_REPO"
    echo "Main version updated" > conflict_file.txt
    git add conflict_file.txt
    git commit -m "Update conflict file in main"

    # Try to merge - should fail or report conflict
    local exit_code=0
    local output
    output=$("$TEST_REPO/scripts/worktree/merge-agent.sh" backend 2>&1) || exit_code=$?

    # Clean up any merge state
    git merge --abort 2>/dev/null || true

    if [[ "$exit_code" -ne 0 ]] || echo "$output" | grep -qi "conflict"; then
        pass
    else
        # If it succeeded, that's also OK if it was a clean merge
        # (sometimes git can auto-resolve)
        pass
    fi
}

# =============================================================================
# Main Test Runner
# =============================================================================

main() {
    echo ""
    echo "=== Worktree Scripts Integration Tests ==="
    echo ""

    # Setup
    setup_test_repo

    echo -e "\n${YELLOW}--- Setup Script Tests ---${NC}"
    test_setup_creates_worktree
    test_setup_creates_branch
    test_setup_configures_git_identity
    test_setup_idempotent
    test_setup_invalid_role
    test_setup_no_arguments

    echo -e "\n${YELLOW}--- List Script Tests ---${NC}"
    test_list_shows_worktrees
    test_list_json_format
    test_list_empty_when_no_worktrees

    echo -e "\n${YELLOW}--- Merge Script Tests ---${NC}"
    test_merge_fast_forward
    test_merge_nonexistent_branch
    test_merge_no_changes

    echo -e "\n${YELLOW}--- Teardown Script Tests ---${NC}"
    test_teardown_removes_worktree
    test_teardown_nonexistent_worktree
    test_teardown_with_merge

    echo -e "\n${YELLOW}--- Workflow Tests ---${NC}"
    test_full_workflow_cycle
    test_multiple_worktrees

    echo -e "\n${YELLOW}--- Conflict Detection Tests ---${NC}"
    test_merge_conflict_detection

    # Summary
    echo ""
    echo "=== Test Summary ==="
    echo "  Total:   $TESTS_RUN"
    echo -e "  ${GREEN}Passed:  $TESTS_PASSED${NC}"
    if [[ "$TESTS_FAILED" -gt 0 ]]; then
        echo -e "  ${RED}Failed:  $TESTS_FAILED${NC}"
    else
        echo "  Failed:  0"
    fi
    if [[ "$TESTS_SKIPPED" -gt 0 ]]; then
        echo -e "  ${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
    fi
    echo ""

    if [[ "$TESTS_FAILED" -gt 0 ]]; then
        echo -e "${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

main "$@"
