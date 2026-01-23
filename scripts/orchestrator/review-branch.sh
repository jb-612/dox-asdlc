#!/bin/bash
# Automated branch review for orchestrator CLI.
#
# Usage: ./scripts/orchestrator/review-branch.sh <branch-name> [--dry-run]
#
# This script runs the full review checklist:
# 1. Checkout and update the branch
# 2. Run compliance checks
# 3. Run unit tests
# 4. Run linter
# 5. Run E2E tests
# 6. Generate review report
#
# Exit codes:
#   0 - All checks passed
#   1 - Review failed (see report)
#   2 - Usage error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <branch-name> [--dry-run]"
    echo ""
    echo "Arguments:"
    echo "  branch-name    The feature branch to review (any branch name)"
    echo ""
    echo "Options:"
    echo "  --dry-run      Run checks without modifying anything"
    echo "  -h, --help     Show this help"
    echo ""
    echo "This script must be run by the orchestrator CLI instance."
}

log_step() {
    echo -e "\n${CYAN}==>${NC} $1"
}

log_pass() {
    echo -e "  ${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "  ${RED}[FAIL]${NC} $1"
}

log_warn() {
    echo -e "  ${YELLOW}[WARN]${NC} $1"
}

# Check orchestrator identity
check_identity() {
    local identity_file="$PROJECT_ROOT/.claude/instance-identity.json"

    if [[ ! -f "$identity_file" ]]; then
        echo -e "${RED}Error: Identity file not found. Use ./start-orchestrator.sh${NC}"
        exit 2
    fi

    local instance_id
    instance_id=$(python3 -c "import json; print(json.load(open('$identity_file')).get('instance_id', ''))" 2>/dev/null || echo "")

    if [[ "$instance_id" != "orchestrator" ]]; then
        echo -e "${RED}Error: This script must be run by the orchestrator CLI.${NC}"
        echo "Current identity: $instance_id"
        echo "Use: ./start-orchestrator.sh"
        exit 2
    fi

    local can_merge
    can_merge=$(python3 -c "import json; print(json.load(open('$identity_file')).get('can_merge', False))" 2>/dev/null || echo "false")

    if [[ "$can_merge" != "True" ]]; then
        echo -e "${RED}Error: Orchestrator identity does not have merge permission.${NC}"
        exit 2
    fi
}

# Extract feature ID from branch name
extract_feature_id() {
    local branch="$1"
    # Pattern: P03-F01 or similar at start of branch name (with optional prefix)
    # Remove any prefix (agent/, ui/, feature/, etc)
    local cleaned
    cleaned=$(echo "$branch" | sed -E 's#^[a-z]+/##')
    # Extract P##-F## pattern
    echo "$cleaned" | grep -oE 'P[0-9]+-F[0-9]+' | head -1 | tr '[:lower:]' '[:upper:]'
}

main() {
    local branch=""
    local dry_run=false
    local report_file=""
    local failures=()
    local warnings=()

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                dry_run=true
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

    # Verify orchestrator identity
    check_identity

    # Setup report file
    local timestamp
    timestamp=$(date +"%Y%m%d-%H%M%S")
    report_file="$PROJECT_ROOT/.claude/coordination/reviews/review-${timestamp}-$(basename "$branch").md"
    mkdir -p "$(dirname "$report_file")"

    echo "=============================================="
    echo "  ORCHESTRATOR REVIEW: $branch"
    echo "=============================================="
    echo ""
    echo "Dry run: $dry_run"
    echo "Report: $report_file"
    echo ""

    # Start report
    cat > "$report_file" << EOF
# Branch Review Report

- **Branch:** $branch
- **Reviewed:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- **Reviewer:** Orchestrator CLI

## Checklist

EOF

    # Step 1: Checkout branch
    log_step "Checking out branch: $branch"

    if git rev-parse --verify "$branch" >/dev/null 2>&1; then
        if [[ "$dry_run" == "false" ]]; then
            git fetch origin "$branch" 2>/dev/null || true
            git checkout "$branch"
            git pull origin "$branch" 2>/dev/null || true
        fi
        log_pass "Branch exists and checked out"
        echo "- [x] Branch exists and accessible" >> "$report_file"
    else
        log_fail "Branch does not exist: $branch"
        echo "- [ ] Branch exists and accessible - **FAILED**" >> "$report_file"
        failures+=("Branch does not exist")
    fi

    # Step 2: Extract feature ID and check compliance
    log_step "Running compliance checks"

    local feature_id
    feature_id=$(extract_feature_id "$branch")
    echo "  Feature ID: $feature_id"

    if [[ -n "$feature_id" && -d "$PROJECT_ROOT/.workitems/$feature_id"* ]]; then
        log_pass "Work item folder exists"
        echo "- [x] Work item folder exists" >> "$report_file"

        # Check planning files
        local workitem_dir
        workitem_dir=$(ls -d "$PROJECT_ROOT/.workitems/$feature_id"* 2>/dev/null | head -1)

        for file in design.md user_stories.md tasks.md; do
            if [[ -f "$workitem_dir/$file" && -s "$workitem_dir/$file" ]]; then
                log_pass "Planning file: $file"
                echo "- [x] Planning file: $file" >> "$report_file"
            else
                log_fail "Missing or empty: $file"
                echo "- [ ] Planning file: $file - **MISSING**" >> "$report_file"
                failures+=("Missing planning file: $file")
            fi
        done

        # Check progress in tasks.md
        if [[ -f "$workitem_dir/tasks.md" ]]; then
            local progress
            progress=$(grep -i "percentage:" "$workitem_dir/tasks.md" 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "0")
            if [[ "$progress" == "100" ]]; then
                log_pass "Progress: 100%"
                echo "- [x] Progress: 100%" >> "$report_file"
            else
                log_warn "Progress: ${progress}% (expected 100%)"
                echo "- [ ] Progress: ${progress}% - **INCOMPLETE**" >> "$report_file"
                warnings+=("Progress not at 100%: ${progress}%")
            fi
        fi
    elif [[ -z "$feature_id" ]]; then
        log_warn "Could not extract feature ID from branch name"
        echo "- [ ] Work item folder - **COULD NOT DETERMINE**" >> "$report_file"
        warnings+=("Could not extract feature ID from branch name")
    else
        log_fail "Work item folder not found for: $feature_id"
        echo "- [ ] Work item folder exists - **NOT FOUND**" >> "$report_file"
        failures+=("Work item folder not found")
    fi

    # Step 3: Run unit tests
    log_step "Running unit tests"
    echo "" >> "$report_file"
    echo "## Test Results" >> "$report_file"
    echo "" >> "$report_file"

    if [[ -x "$PROJECT_ROOT/tools/test.sh" ]]; then
        if "$PROJECT_ROOT/tools/test.sh" 2>&1 | tee -a "$report_file.tests.log"; then
            log_pass "Unit tests passed"
            echo "- [x] Unit tests passed" >> "$report_file"
        else
            log_fail "Unit tests failed"
            echo "- [ ] Unit tests - **FAILED**" >> "$report_file"
            failures+=("Unit tests failed")
        fi
    else
        log_warn "test.sh not found or not executable"
        echo "- [ ] Unit tests - **SKIPPED** (no test script)" >> "$report_file"
        warnings+=("Unit tests skipped - no test.sh")
    fi

    # Step 4: Run linter
    log_step "Running linter"

    if [[ -x "$PROJECT_ROOT/tools/lint.sh" ]]; then
        if "$PROJECT_ROOT/tools/lint.sh" 2>&1 | tee -a "$report_file.lint.log"; then
            log_pass "Linter passed"
            echo "- [x] Linter passed" >> "$report_file"
        else
            log_fail "Linter failed"
            echo "- [ ] Linter - **FAILED**" >> "$report_file"
            failures+=("Linter failed")
        fi
    else
        log_warn "lint.sh not found or not executable"
        echo "- [ ] Linter - **SKIPPED** (no lint script)" >> "$report_file"
        warnings+=("Linter skipped - no lint.sh")
    fi

    # Step 5: Run E2E tests
    log_step "Running E2E tests"

    if [[ -x "$PROJECT_ROOT/tools/e2e.sh" ]]; then
        if "$PROJECT_ROOT/tools/e2e.sh" 2>&1 | tee -a "$report_file.e2e.log"; then
            log_pass "E2E tests passed"
            echo "- [x] E2E tests passed" >> "$report_file"
        else
            log_fail "E2E tests failed"
            echo "- [ ] E2E tests - **FAILED**" >> "$report_file"
            failures+=("E2E tests failed")
        fi
    else
        log_warn "e2e.sh not found or not executable"
        echo "- [ ] E2E tests - **SKIPPED** (no e2e script)" >> "$report_file"
        warnings+=("E2E tests skipped - no e2e.sh")
    fi

    # Step 6: Check for contract changes
    log_step "Checking contract compatibility"

    local contract_changes
    contract_changes=$(git diff main..."$branch" -- contracts/ 2>/dev/null || echo "")

    if [[ -n "$contract_changes" ]]; then
        log_warn "Contract changes detected - verify approval"
        echo "" >> "$report_file"
        echo "## Contract Changes" >> "$report_file"
        echo "" >> "$report_file"
        echo "Contract changes detected. Verify:" >> "$report_file"
        echo "- Version bumped in contracts/versions/" >> "$report_file"
        echo "- CHANGELOG.md updated" >> "$report_file"
        echo "- Consumer CLI acknowledged changes" >> "$report_file"
        warnings+=("Contract changes require verification")
    else
        log_pass "No contract changes"
        echo "- [x] No contract changes" >> "$report_file"
    fi

    # Generate summary
    echo "" >> "$report_file"
    echo "## Summary" >> "$report_file"
    echo "" >> "$report_file"

    if [[ ${#failures[@]} -eq 0 ]]; then
        echo -e "\n${GREEN}=============================================="
        echo "  REVIEW PASSED"
        echo -e "==============================================${NC}"

        echo "**Status:** PASSED" >> "$report_file"
        echo "" >> "$report_file"
        echo "Branch is ready for merge to main." >> "$report_file"

        if [[ ${#warnings[@]} -gt 0 ]]; then
            echo "" >> "$report_file"
            echo "### Warnings" >> "$report_file"
            for w in "${warnings[@]}"; do
                echo "- $w" >> "$report_file"
            done
        fi

        echo ""
        echo "Report saved: $report_file"
        echo ""
        echo "Next step: ./scripts/orchestrator/merge-branch.sh $branch"

        exit 0
    else
        echo -e "\n${RED}=============================================="
        echo "  REVIEW FAILED"
        echo -e "==============================================${NC}"

        echo "**Status:** FAILED" >> "$report_file"
        echo "" >> "$report_file"
        echo "### Failures" >> "$report_file"
        for f in "${failures[@]}"; do
            echo "- $f" >> "$report_file"
            echo -e "  ${RED}*${NC} $f"
        done

        if [[ ${#warnings[@]} -gt 0 ]]; then
            echo "" >> "$report_file"
            echo "### Warnings" >> "$report_file"
            for w in "${warnings[@]}"; do
                echo "- $w" >> "$report_file"
            done
        fi

        echo ""
        echo "Report saved: $report_file"
        echo ""
        echo "Send REVIEW_FAILED message to requesting CLI:"
        echo "  ./scripts/coordination/publish-message.sh REVIEW_FAILED \"$branch\" \"Failures: ${failures[*]}\""

        exit 1
    fi
}

main "$@"
