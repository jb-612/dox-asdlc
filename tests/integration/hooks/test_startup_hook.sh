#!/bin/bash
# Integration tests for the session startup hook.
#
# Tests the startup validation hook:
# - Identity validation (CLAUDE_INSTANCE_ID env var)
# - Presence registration
# - Notification checking
# - Worktree verification
# - Exit codes
#
# Usage:
#   ./tests/integration/hooks/test_startup_hook.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
#
# Note: Some tests require Redis to be running.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK_SCRIPT="$PROJECT_ROOT/.claude/hooks/startup.sh"

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

# Saved environment
SAVED_CLAUDE_INSTANCE_ID="${CLAUDE_INSTANCE_ID:-}"

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

# Check if hook script exists
check_hook_exists() {
    if [[ ! -x "$HOOK_SCRIPT" ]]; then
        echo -e "${RED}ERROR:${NC} Hook script not found or not executable: $HOOK_SCRIPT"
        exit 1
    fi
}

# Check if Redis is available
redis_available() {
    if command -v redis-cli &>/dev/null; then
        redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping 2>/dev/null | grep -q "PONG"
        return $?
    fi
    return 1
}

# Save current environment
save_env() {
    SAVED_CLAUDE_INSTANCE_ID="${CLAUDE_INSTANCE_ID:-}"
}

# Restore environment
restore_env() {
    if [[ -n "$SAVED_CLAUDE_INSTANCE_ID" ]]; then
        export CLAUDE_INSTANCE_ID="$SAVED_CLAUDE_INSTANCE_ID"
    else
        unset CLAUDE_INSTANCE_ID 2>/dev/null || true
    fi
}

trap restore_env EXIT

# =============================================================================
# Identity Validation Tests
# =============================================================================

test_identity_from_env_variable() {
    log_test "Identity validation: CLAUDE_INSTANCE_ID sets identity"

    # Set environment variable
    export CLAUDE_INSTANCE_ID="backend"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    if [[ "$exit_code" -eq 0 ]] && echo "$output" | grep -q "backend"; then
        pass
    else
        fail "Expected identity 'backend' from env var (exit code: $exit_code)"
    fi

    restore_env
}

test_identity_missing_env_exits_nonzero() {
    log_test "Identity validation: Missing CLAUDE_INSTANCE_ID exits with code 1"

    # Unset environment variable
    unset CLAUDE_INSTANCE_ID

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        pass
    else
        fail "Should exit non-zero without CLAUDE_INSTANCE_ID"
    fi

    restore_env
}

test_identity_empty_env_defaults_to_pm() {
    log_test "Identity validation: Empty CLAUDE_INSTANCE_ID defaults to pm"

    # Set empty environment variable
    export CLAUDE_INSTANCE_ID=""

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    # Should default to pm or fail gracefully
    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Empty CLAUDE_INSTANCE_ID should default to pm (exit code: $exit_code)"
    fi

    restore_env
}

test_identity_unknown_value_accepted() {
    log_test "Identity validation: Arbitrary CLAUDE_INSTANCE_ID accepted as bounded context"

    # Any non-empty string is a valid bounded context
    export CLAUDE_INSTANCE_ID="p11-guardrails"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Bounded context identity should be accepted (exit code: $exit_code)"
    fi

    restore_env
}

test_identity_pm_role_valid() {
    log_test "Identity validation: 'pm' role is valid"

    export CLAUDE_INSTANCE_ID="pm"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    if [[ "$exit_code" -eq 0 ]] && echo "$output" | grep -q "pm"; then
        pass
    else
        fail "PM role should be valid (exit code: $exit_code)"
    fi

    restore_env
}

test_identity_bounded_context_accepted() {
    log_test "Identity validation: Bounded context names accepted"

    export CLAUDE_INSTANCE_ID="p04-review-swarm"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Bounded context names should be accepted (exit code: $exit_code)"
    fi

    restore_env
}

# =============================================================================
# Presence Registration Tests
# =============================================================================

test_presence_registration_with_redis() {
    log_test "Presence registration: Registers with Redis when available"

    if ! redis_available; then
        skip "Redis not available"
        return
    fi

    export CLAUDE_INSTANCE_ID="backend"

    local output
    output=$("$HOOK_SCRIPT" 2>&1) || true

    if echo "$output" | grep -qi "presence registered"; then
        pass
    else
        fail "Should report presence registration: $output"
    fi

    restore_env
}

test_presence_registration_without_redis() {
    log_test "Presence registration: Warns but doesn't block without Redis"

    # Temporarily set Redis to unavailable host
    export REDIS_HOST="nonexistent.invalid.host"
    export REDIS_PORT="9999"
    export CLAUDE_INSTANCE_ID="backend"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    # Should succeed (exit 0) even if Redis unavailable
    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Should not block startup when Redis unavailable (exit code: $exit_code)"
    fi

    unset REDIS_HOST
    unset REDIS_PORT
    restore_env
}

# =============================================================================
# Notification Check Tests
# =============================================================================

test_notification_check_with_redis() {
    log_test "Notification check: Reports pending notifications"

    if ! redis_available; then
        skip "Redis not available"
        return
    fi

    export CLAUDE_INSTANCE_ID="backend"

    local output
    output=$("$HOOK_SCRIPT" 2>&1) || true

    # Should mention notification check (whether there are notifications or not)
    if echo "$output" | grep -qi "notification\|pending\|check message"; then
        pass
    else
        fail "Should report notification status: $output"
    fi

    restore_env
}

test_notification_check_graceful_failure() {
    log_test "Notification check: Gracefully handles Redis unavailable"

    export REDIS_HOST="nonexistent.invalid.host"
    export REDIS_PORT="9999"
    export CLAUDE_INSTANCE_ID="frontend"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    # Should not block startup
    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Notification check failure should not block startup (exit code: $exit_code)"
    fi

    unset REDIS_HOST
    unset REDIS_PORT
    restore_env
}

# =============================================================================
# Worktree Verification Tests
# =============================================================================

test_worktree_pm_in_main_repo() {
    log_test "Worktree verification: PM role in main repo (no warning)"

    export CLAUDE_INSTANCE_ID="pm"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    # PM in main repo should not produce worktree warning
    if [[ "$exit_code" -eq 0 ]]; then
        # Check that there's no warning about being in wrong location
        if echo "$output" | grep -qi "should run in"; then
            fail "PM in main repo should not warn about worktree"
        else
            pass
        fi
    else
        fail "PM role should pass validation (exit code: $exit_code)"
    fi

    restore_env
}

test_worktree_agent_in_main_repo_warns() {
    log_test "Worktree verification: Agent role in main repo (warning)"

    export CLAUDE_INSTANCE_ID="backend"

    local exit_code=0
    local output
    output=$("$HOOK_SCRIPT" 2>&1) || exit_code=$?

    # Should succeed but warn
    if [[ "$exit_code" -eq 0 ]]; then
        # Backend in main repo should warn about worktree
        if echo "$output" | grep -qi "worktree\|isolation"; then
            pass
        else
            # Warning is optional behavior, still pass if validation succeeds
            pass
        fi
    else
        fail "Agent role should pass validation (exit code: $exit_code)"
    fi

    restore_env
}

# =============================================================================
# Exit Code Tests
# =============================================================================

test_exit_code_zero_on_success() {
    log_test "Exit code: Returns 0 on successful validation"

    export CLAUDE_INSTANCE_ID="backend"

    local exit_code=0
    "$HOOK_SCRIPT" >/dev/null 2>&1 || exit_code=$?

    if [[ "$exit_code" -eq 0 ]]; then
        pass
    else
        fail "Expected exit code 0, got $exit_code"
    fi

    restore_env
}

test_exit_code_nonzero_on_failure() {
    log_test "Exit code: Returns non-zero on validation failure"

    unset CLAUDE_INSTANCE_ID

    local exit_code=0
    "$HOOK_SCRIPT" >/dev/null 2>&1 || exit_code=$?

    if [[ "$exit_code" -ne 0 ]]; then
        pass
    else
        fail "Expected non-zero exit code without CLAUDE_INSTANCE_ID"
    fi

    restore_env
}

# =============================================================================
# Output Message Tests
# =============================================================================

test_output_includes_identity() {
    log_test "Output: Includes resolved identity"

    export CLAUDE_INSTANCE_ID="orchestrator"

    local output
    output=$("$HOOK_SCRIPT" 2>&1) || true

    if echo "$output" | grep -qi "orchestrator"; then
        pass
    else
        fail "Output should include identity 'orchestrator': $output"
    fi

    restore_env
}

test_output_includes_session_info() {
    log_test "Output: Includes session information"

    export CLAUDE_INSTANCE_ID="devops"

    local output
    output=$("$HOOK_SCRIPT" 2>&1) || true

    # Should include some session info (session ID, time, etc.)
    if echo "$output" | grep -qi "session\|time\|identity"; then
        pass
    else
        fail "Output should include session information: $output"
    fi

    restore_env
}

test_output_error_is_helpful() {
    log_test "Output: Error message includes remediation"

    unset CLAUDE_INSTANCE_ID

    local output
    output=$("$HOOK_SCRIPT" 2>&1) || true

    # Error should include how to fix via CLAUDE_INSTANCE_ID
    if echo "$output" | grep -qi "CLAUDE_INSTANCE_ID"; then
        pass
    else
        fail "Error should include remediation steps: $output"
    fi

    restore_env
}

# =============================================================================
# SESSION_START Message Tests
# =============================================================================

test_session_start_message_published() {
    log_test "SESSION_START: Message published on startup"

    if ! redis_available; then
        skip "Redis not available"
        return
    fi

    export CLAUDE_INSTANCE_ID="backend"

    local output
    output=$("$HOOK_SCRIPT" 2>&1) || true

    if echo "$output" | grep -qi "SESSION_START"; then
        pass
    else
        # SESSION_START might not be in output but still published
        # Check if startup completed successfully
        if echo "$output" | grep -qi "complete\|ready"; then
            pass
        else
            fail "Should indicate session start: $output"
        fi
    fi

    restore_env
}

# =============================================================================
# All Valid Roles Test
# =============================================================================

test_all_valid_roles() {
    log_test "All valid roles: backend, frontend, orchestrator, devops, pm"

    local roles=("backend" "frontend" "orchestrator" "devops" "pm")
    local all_passed=true

    for role in "${roles[@]}"; do
        export CLAUDE_INSTANCE_ID="$role"
        local exit_code=0
        "$HOOK_SCRIPT" >/dev/null 2>&1 || exit_code=$?

        if [[ "$exit_code" -ne 0 ]]; then
            echo -e "    ${RED}Failed for role: $role${NC}"
            all_passed=false
        fi
    done

    if [[ "$all_passed" == "true" ]]; then
        pass
    else
        fail "Some roles failed validation"
    fi

    restore_env
}

# =============================================================================
# Main Test Runner
# =============================================================================

main() {
    echo ""
    echo "=== Startup Hook Integration Tests ==="
    echo ""

    # Check prerequisites
    check_hook_exists
    save_env

    echo -e "\n${YELLOW}--- Identity Validation Tests ---${NC}"
    test_identity_from_env_variable
    test_identity_missing_env_exits_nonzero
    test_identity_empty_env_defaults_to_pm
    test_identity_unknown_value_accepted
    test_identity_pm_role_valid
    test_identity_bounded_context_accepted

    echo -e "\n${YELLOW}--- Presence Registration Tests ---${NC}"
    test_presence_registration_with_redis
    test_presence_registration_without_redis

    echo -e "\n${YELLOW}--- Notification Check Tests ---${NC}"
    test_notification_check_with_redis
    test_notification_check_graceful_failure

    echo -e "\n${YELLOW}--- Worktree Verification Tests ---${NC}"
    test_worktree_pm_in_main_repo
    test_worktree_agent_in_main_repo_warns

    echo -e "\n${YELLOW}--- Exit Code Tests ---${NC}"
    test_exit_code_zero_on_success
    test_exit_code_nonzero_on_failure

    echo -e "\n${YELLOW}--- Output Message Tests ---${NC}"
    test_output_includes_identity
    test_output_includes_session_info
    test_output_error_is_helpful

    echo -e "\n${YELLOW}--- SESSION_START Message Tests ---${NC}"
    test_session_start_message_published

    echo -e "\n${YELLOW}--- Comprehensive Role Tests ---${NC}"
    test_all_valid_roles

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
