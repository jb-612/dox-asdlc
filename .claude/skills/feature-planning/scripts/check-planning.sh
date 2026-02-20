#!/bin/bash
set -euo pipefail

# check-planning.sh - Validate planning completeness for a feature work item
#
# Usage: ./scripts/check-planning.sh <feature_id>
# Example: ./scripts/check-planning.sh P01-F02-bash-tools

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

usage() {
    echo "Usage: $0 <feature_id>"
    echo "Example: $0 P01-F02-bash-tools"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

FEATURE_ID="$1"

# SECURITY: Validate FEATURE_ID format to prevent command injection
# Must match pattern: Pnn-Fnn-name (e.g., P01-F02-bash-tools)
if [[ ! "$FEATURE_ID" =~ ^P[0-9]{2}-F[0-9]{2}-[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid FEATURE_ID format: $FEATURE_ID"
    echo "Expected format: Pnn-Fnn-name (e.g., P01-F02-bash-tools)"
    exit 1
fi

WORKITEM_DIR="${PROJECT_ROOT}/.workitems/${FEATURE_ID}"

PASS=0
FAIL=0

check() {
    local description="$1"
    shift

    # SECURITY: Execute condition directly instead of using eval
    if "$@"; then
        echo "✓ $description"
        ((PASS++))
    else
        echo "✗ $description"
        ((FAIL++))
    fi
}

echo "Validating planning for: $FEATURE_ID"
echo "=========================================="
echo ""

# Check work item directory exists
check "Work item directory exists" test -d "$WORKITEM_DIR"

if [[ ! -d "$WORKITEM_DIR" ]]; then
    echo ""
    echo "FAILED: Work item directory not found."
    echo "Run: ./scripts/new-feature.sh <phase> <feature> <description>"
    exit 1
fi

echo ""
echo "Checking design.md..."
echo "---------------------"

DESIGN_FILE="${WORKITEM_DIR}/design.md"
check "design.md exists" test -f "$DESIGN_FILE"

if [[ -f "$DESIGN_FILE" ]]; then
    check "Overview section present" grep -q '## Overview' "$DESIGN_FILE"
    check "Overview has content" bash -c "grep -A5 '## Overview' '$DESIGN_FILE' | grep -qv '^\['"
    check "Dependencies section present" grep -q '## Dependencies' "$DESIGN_FILE"
    check "Interfaces section present" grep -q '## Interfaces' "$DESIGN_FILE"
    check "Technical Approach section present" grep -q '## Technical Approach' "$DESIGN_FILE"
    check "File Structure section present" grep -q '## File Structure' "$DESIGN_FILE"
fi

echo ""
echo "Checking user_stories.md..."
echo "---------------------------"

STORIES_FILE="${WORKITEM_DIR}/user_stories.md"
check "user_stories.md exists" test -f "$STORIES_FILE"

if [[ -f "$STORIES_FILE" ]]; then
    check "At least one user story defined" grep -q '## US-' "$STORIES_FILE"
    check "Acceptance criteria present" grep -q 'Acceptance Criteria' "$STORIES_FILE"
    check "Test scenarios present" grep -q 'Test Scenarios' "$STORIES_FILE"
    # Check for placeholder text (inverted check)
    if ! grep -q '\[Story Title\]' "$STORIES_FILE"; then
        echo "✓ No placeholder text in stories"
        ((PASS++))
    else
        echo "✗ No placeholder text in stories"
        ((FAIL++))
    fi
fi

echo ""
echo "Checking tasks.md..."
echo "--------------------"

TASKS_FILE="${WORKITEM_DIR}/tasks.md"
check "tasks.md exists" test -f "$TASKS_FILE"

if [[ -f "$TASKS_FILE" ]]; then
    check "Progress section present" grep -q '## Progress' "$TASKS_FILE"
    check "Task list section present" grep -q '## Task List' "$TASKS_FILE"
    check "At least one task defined" grep -q '### T[0-9]' "$TASKS_FILE"
    check "Completion checklist present" grep -q '## Completion Checklist' "$TASKS_FILE"
    # Check for placeholder text (inverted check)
    if ! grep -q '\[Task description\]' "$TASKS_FILE"; then
        echo "✓ No placeholder task descriptions"
        ((PASS++))
    else
        echo "✗ No placeholder task descriptions"
        ((FAIL++))
    fi
    # Check estimates are provided
    check "Estimates provided for tasks" grep -q 'Estimate:.*\(30min\|1hr\|2hr\)' "$TASKS_FILE"
fi

echo ""
echo "=========================================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [[ $FAIL -eq 0 ]]; then
    echo "✓ Planning is COMPLETE. Ready for implementation."
    exit 0
else
    echo "✗ Planning is INCOMPLETE. Please address the failed checks."
    exit 1
fi
