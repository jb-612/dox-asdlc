#!/bin/bash
set -euo pipefail

# sast.sh - Run bandit static security analysis
#
# Usage: ./tools/sast.sh <path>
# Output: JSON with security findings

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    local target_path="${1:-src/}"

    log_info "Running SAST analysis on: $target_path"

    # Check if bandit is installed
    if ! command -v bandit &> /dev/null; then
        emit_error "Required tool 'bandit' is not installed. Install with: pip install bandit"
        return 1
    fi

    # Validate target path exists
    if [[ ! -e "$target_path" ]]; then
        emit_error "Path not found: $target_path"
        return 1
    fi

    # Run bandit and capture output
    local bandit_output
    bandit_output=$(bandit -r -f json "$target_path" 2>&1 || true)

    # Parse bandit JSON output using parser
    local parsed_results
    parsed_results=$("$TOOLS_LIB/parsers/bandit.sh" "$bandit_output")

    # Emit standardized result
    emit_result "$parsed_results"
}

main "$@"
