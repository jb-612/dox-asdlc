#!/bin/bash
set -euo pipefail

# sca.sh - Run pip-audit dependency vulnerability scan
#
# Usage: ./tools/sca.sh <requirements_file>
# Output: JSON with dependency vulnerabilities

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    local target_file="${1:-requirements.txt}"

    log_info "Running SCA on: $target_file"

    # Check if pip-audit is installed
    if ! command -v pip-audit &> /dev/null; then
        emit_error "Required tool 'pip-audit' is not installed. Install with: pip install pip-audit"
        return 1
    fi

    # Validate target file exists
    if [[ ! -f "$target_file" ]]; then
        emit_error "File not found: $target_file"
        return 1
    fi

    # Run pip-audit and capture output
    local pip_audit_output
    pip_audit_output=$(pip-audit -r "$target_file" --format=json 2>&1 || true)

    # Parse pip-audit JSON output using parser
    local parsed_results
    parsed_results=$("$TOOLS_LIB/parsers/pip_audit.sh" "$pip_audit_output")

    # Emit standardized result
    emit_result "$parsed_results"
}

main "$@"
