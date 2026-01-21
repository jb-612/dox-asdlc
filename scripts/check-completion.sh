#!/bin/bash
set -euo pipefail

# check-completion.sh - Validate feature completion before commit
#
# Usage: ./scripts/check-completion.sh <feature_id>
# Example: ./scripts/check-completion.sh P01-F02-bash-tools

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

usage() {
    echo "Usage: $0 <feature_id>"
    echo "Example: $0 P01-F02-bash-tools"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

FEATURE_ID="$1"
WORKITEM_DIR="${PROJECT_ROOT}/.workitems/${FEATURE_ID}"
TASKS_FILE="${WORKITEM_DIR}/tasks.md"

PASS=0
FAIL=0

check() {
    local description="$1"
    local condition="$2"
    
    if eval "$condition"; then
        echo "✓ $description"
        ((PASS++))
    else
        echo "✗ $description"
        ((FAIL++))
    fi
}

run_check() {
    local description="$1"
    local command="$2"
    
    echo "  Running: $command"
    if eval "$command" > /dev/null 2>&1; then
        echo "✓ $description"
        ((PASS++))
    else
        echo "✗ $description"
        ((FAIL++))
    fi
}

echo "Validating completion for: $FEATURE_ID"
echo "=========================================="
echo ""

# Check work item exists
if [[ ! -d "$WORKITEM_DIR" ]]; then
    echo "FAILED: Work item directory not found: $WORKITEM_DIR"
    exit 1
fi

echo "Checking task completion..."
echo "---------------------------"

if [[ -f "$TASKS_FILE" ]]; then
    # Count total tasks and completed tasks
    TOTAL_TASKS=$(grep -c '### T[0-9]' "$TASKS_FILE" || echo "0")
    # Count tasks where the checkbox line has [x]
    COMPLETED_TASKS=$(grep -c '\- \[x\] Estimate:' "$TASKS_FILE" || echo "0")
    
    echo "Tasks: $COMPLETED_TASKS / $TOTAL_TASKS complete"
    check "All tasks marked complete" "[[ $COMPLETED_TASKS -eq $TOTAL_TASKS ]]"
    
    # Check status is COMPLETE
    check "Status is COMPLETE" "grep -q 'Status: COMPLETE' '$TASKS_FILE'"
    
    # Check percentage is 100%
    check "Progress is 100%" "grep -q 'Percentage: 100%' '$TASKS_FILE'"
fi

echo ""
echo "Running verification commands..."
echo "--------------------------------"

# Run unit tests
if [[ -d "${PROJECT_ROOT}/tests/unit" ]]; then
    run_check "Unit tests pass" "cd '$PROJECT_ROOT' && pytest tests/unit/ -q"
else
    echo "⚠ No unit tests directory found"
fi

# Run integration tests
if [[ -d "${PROJECT_ROOT}/tests/integration" ]]; then
    run_check "Integration tests pass" "cd '$PROJECT_ROOT' && pytest tests/integration/ -q"
else
    echo "⚠ No integration tests directory found"
fi

# Run E2E tests
if [[ -x "${PROJECT_ROOT}/tools/e2e.sh" ]]; then
    run_check "E2E tests pass" "'${PROJECT_ROOT}/tools/e2e.sh'"
else
    echo "⚠ E2E test script not found or not executable"
fi

# Run linter
if [[ -x "${PROJECT_ROOT}/tools/lint.sh" ]]; then
    run_check "Linter passes" "'${PROJECT_ROOT}/tools/lint.sh' '${PROJECT_ROOT}/src/'"
else
    echo "⚠ Lint script not found or not executable"
fi

echo ""
echo "Checking completion checklist..."
echo "--------------------------------"

if [[ -f "$TASKS_FILE" ]]; then
    # Check all completion checklist items
    check "All checklist items marked" "! grep -q '\- \[ \]' '$TASKS_FILE' || grep -A20 '## Completion Checklist' '$TASKS_FILE' | grep -c '\- \[ \]' | grep -q '^0$'"
fi

echo ""
echo "=========================================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [[ $FAIL -eq 0 ]]; then
    echo "✓ Feature is COMPLETE. Ready for commit."
    echo ""
    echo "Suggested commit command:"
    echo "  git add -A && git commit -m \"feat($FEATURE_ID): [description]\""
    exit 0
else
    echo "✗ Feature is NOT complete. Please address the failed checks."
    exit 1
fi
