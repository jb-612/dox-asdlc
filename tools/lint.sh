#!/bin/bash
set -euo pipefail

# lint.sh - Run linter on specified paths
#
# Usage: ./tools/lint.sh <path>
# Output: JSON with lint results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

main() {
    local target_path="${1:-.}"
    
    log_info "Running linter on: $target_path"
    
    # Stub implementation - returns success with empty results
    # Replace with actual linter (ruff, flake8, eslint) in P01-F02
    
    if [[ ! -e "$target_path" ]]; then
        emit_error "Path not found: $target_path"
    fi
    
    # Placeholder: actual implementation will run ruff or similar
    emit_result '[]'
}

main "$@"
