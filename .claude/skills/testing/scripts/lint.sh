#!/bin/bash
set -euo pipefail

# lint.sh - Run ruff linter on specified paths
#
# Usage: ./tools/lint.sh <path>
# Output: JSON with lint results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    local target_path="${1:-.}"

    log_info "Running linter on: $target_path"

    # Check if ruff is installed
    if ! command -v ruff &> /dev/null; then
        emit_error "Required tool 'ruff' is not installed. Install with: pip install ruff"
        return 1
    fi

    # Validate target path exists
    if [[ ! -e "$target_path" ]]; then
        emit_error "Path not found: $target_path"
        return 1
    fi

    # Run ruff and capture output
    local ruff_output
    ruff_output=$(ruff check --output-format=json "$target_path" 2>&1 || true)

    # Parse ruff JSON output using parser
    local parsed_results
    parsed_results=$("$TOOLS_LIB/parsers/ruff.sh" "$ruff_output")

    # Emit standardized result
    emit_result "$parsed_results"
}

main "$@"
