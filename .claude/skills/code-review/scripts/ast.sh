#!/bin/bash
set -euo pipefail

# ast.sh - Parse Python code structure using AST module
#
# Usage: ./tools/ast.sh <python_file>
# Output: JSON with code structure information

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    local target_file="${1:-}"

    if [[ -z "$target_file" ]]; then
        emit_error "Python file path is required. Usage: ast.sh <python_file>"
        return 1
    fi

    log_info "Parsing AST for: $target_file"

    # Validate target file exists
    if [[ ! -f "$target_file" ]]; then
        emit_error "File not found: $target_file"
        return 1
    fi

    # Validate it's a Python file
    if [[ ! "$target_file" =~ \.py$ ]]; then
        emit_error "File must be a Python file (.py)"
        return 1
    fi

    # Run AST parser
    local ast_output
    ast_output=$(python3 "$TOOLS_LIB/ast_parser.py" "$target_file" 2>&1)

    # Transform AST output to standard format
    local parsed_results
    parsed_results=$(python3 << PYEOF
import json
import sys

try:
    ast_output = '''$ast_output'''

    if not ast_output.strip():
        print('[]')
    else:
        ast_data = json.loads(ast_output)
        results = []

        for item in ast_data:
            item_type = item.get('type', '')
            lineno = item.get('line', 0)

            if item_type == 'error':
                result = {
                    'file': '$target_file',
                    'line': lineno,
                    'severity': 'error',
                    'message': item.get('message', 'Unknown error'),
                    'rule': 'syntax_error'
                }
            elif item_type == 'function':
                result = {
                    'file': '$target_file',
                    'line': lineno,
                    'severity': 'info',
                    'message': 'function: ' + item.get('signature', ''),
                    'rule': 'function'
                }
            elif item_type == 'class':
                methods = ', '.join(item.get('methods', []))
                result = {
                    'file': '$target_file',
                    'line': lineno,
                    'severity': 'info',
                    'message': f'class: {item.get(\"name\")} (methods: {methods})',
                    'rule': 'class'
                }
            elif item_type == 'import':
                modules = ', '.join(item.get('modules', []))
                result = {
                    'file': '$target_file',
                    'line': lineno,
                    'severity': 'info',
                    'message': f'import: {modules}',
                    'rule': 'import'
                }
            elif item_type == 'from_import':
                module = item.get('module', '')
                names = ', '.join(item.get('names', []))
                result = {
                    'file': '$target_file',
                    'line': lineno,
                    'severity': 'info',
                    'message': f'from {module} import {names}',
                    'rule': 'from_import'
                }
            elif item_type == 'variable':
                names = ', '.join(item.get('names', []))
                result = {
                    'file': '$target_file',
                    'line': lineno,
                    'severity': 'info',
                    'message': f'variable: {names}',
                    'rule': 'assignment'
                }
            else:
                continue

            results.append(result)

        print(json.dumps(results, indent=2))

except json.JSONDecodeError as e:
    print('[]')
except Exception as e:
    print('[]')
PYEOF
)

    # Emit standardized result
    emit_result "$parsed_results"
}

main "$@"
