#!/bin/bash
set -euo pipefail

# complexity.sh - Run cyclomatic complexity analysis on Python files
#
# Usage: ./tools/complexity.sh [--threshold N] [--verify-comments] [--json] <path>
# Output: JSON with complexity findings

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    local threshold=5
    local verify_comments=false
    local json_output=false
    local target_path=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --threshold)
                threshold="$2"
                shift 2
                ;;
            --verify-comments)
                verify_comments=true
                shift
                ;;
            --json)
                json_output=true
                shift
                ;;
            *)
                target_path="$1"
                shift
                ;;
        esac
    done

    target_path="${target_path:-src/}"

    log_info "Running complexity analysis on: $target_path (threshold: $threshold)"

    # Validate target path exists
    if [[ ! -e "$target_path" ]]; then
        emit_error "Path not found: $target_path"
        return 1
    fi

    # Build python args
    local py_args=("$TOOLS_LIB/cc_analyzer.py" "--threshold" "$threshold" "--json" "$target_path")
    if [[ "$verify_comments" == "true" ]]; then
        py_args=("$TOOLS_LIB/cc_analyzer.py" "--verify-comments" "--json" "$target_path")
    fi

    # Run analyzer
    local analyzer_output
    analyzer_output=$(python3 "${py_args[@]}" 2>&1) || {
        emit_error "Analyzer failed: $analyzer_output"
        return 1
    }

    # Emit standardized result
    emit_result "$analyzer_output"
}

main "$@"
