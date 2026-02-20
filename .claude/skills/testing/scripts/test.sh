#!/bin/bash
set -euo pipefail

# test.sh - Run pytest test suite
#
# Usage: ./tools/test.sh <path>
# Output: JSON with test results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    local target_path="${1:-tests/}"

    log_info "Running tests on: $target_path"

    # Check if pytest is installed
    if ! command -v pytest &> /dev/null; then
        emit_error "Required tool 'pytest' is not installed. Install with: pip install pytest"
        return 1
    fi

    # Validate target path exists
    if [[ ! -e "$target_path" ]]; then
        emit_error "Path not found: $target_path"
        return 1
    fi

    # Create temporary report file
    local report_file
    report_file=$(mktemp)
    trap "rm -f '$report_file'" EXIT

    # Run pytest with json-report plugin if available, fallback to simple output
    local pytest_output
    if pytest --version 2>&1 | grep -q pytest; then
        # Try with json-report plugin
        pytest "$target_path" --tb=short -v --json-report --json-report-file="$report_file" 2>&1 || true

        # Check if report was created
        if [[ -f "$report_file" ]]; then
            pytest_output=$(cat "$report_file")
        else
            # Fallback: run pytest again without json-report
            pytest_output=$(pytest "$target_path" --tb=short -v 2>&1 || true)
        fi
    else
        emit_error "pytest command not found"
        return 1
    fi

    # Parse pytest output using parser
    local parsed_results
    parsed_results=$("$TOOLS_LIB/parsers/pytest.sh" "$pytest_output")

    # Emit standardized result
    emit_result "$parsed_results"
}

main "$@"
