#!/bin/bash
# common.sh - Common utilities for bash tool wrappers
#
# Source this file in tool wrappers:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
#
# Provides:
#   emit_result - Output success JSON with results
#   emit_error  - Output failure JSON with errors
#   json_escape - Escape string for JSON inclusion

set -euo pipefail

# Colors for terminal output (disabled if not a terminal)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

# json_escape - Escape a string for safe JSON inclusion
# Usage: escaped=$(json_escape "$string")
json_escape() {
    local string="$1"
    # Escape backslashes, quotes, and control characters
    printf '%s' "$string" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])'
}

# emit_result - Output success JSON to stdout
# Usage: emit_result "$results_json_array"
# Example: emit_result '[{"file": "test.py", "status": "pass"}]'
emit_result() {
    local results="${1:-[]}"
    cat << EOF
{"success": true, "results": $results, "errors": []}
EOF
}

# emit_error - Output failure JSON to stdout
# Usage: emit_error "Error message" [exit_code]
# Example: emit_error "File not found: test.py"
emit_error() {
    local message="$1"
    local exit_code="${2:-1}"
    local escaped_message
    escaped_message=$(json_escape "$message")
    cat << EOF
{"success": false, "results": [], "errors": ["$escaped_message"]}
EOF
    if [[ "$exit_code" -ne 0 ]]; then
        exit "$exit_code"
    fi
}

# emit_partial - Output JSON with both results and errors
# Usage: emit_partial "$results_json_array" "$errors_json_array"
emit_partial() {
    local results="${1:-[]}"
    local errors="${2:-[]}"
    cat << EOF
{"success": false, "results": $results, "errors": $errors}
EOF
}

# log_info - Print info message to stderr (not captured in JSON output)
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*" >&2
}

# log_warn - Print warning message to stderr
log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

# log_error - Print error message to stderr
log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# require_command - Check if a command exists, emit error if not
# Usage: require_command "python3"
require_command() {
    local cmd="$1"
    if ! command -v "$cmd" &> /dev/null; then
        emit_error "Required command not found: $cmd"
    fi
}

# require_file - Check if a file exists, emit error if not
# Usage: require_file "/path/to/file"
require_file() {
    local filepath="$1"
    if [[ ! -f "$filepath" ]]; then
        emit_error "Required file not found: $filepath"
    fi
}

# require_directory - Check if a directory exists, emit error if not
# Usage: require_directory "/path/to/dir"
require_directory() {
    local dirpath="$1"
    if [[ ! -d "$dirpath" ]]; then
        emit_error "Required directory not found: $dirpath"
    fi
}

# get_project_root - Return the project root directory
# Usage: PROJECT_ROOT=$(get_project_root)
get_project_root() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
    # Navigate up from tools/ to project root
    echo "$(dirname "$script_dir")"
}
