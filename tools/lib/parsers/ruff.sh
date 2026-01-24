#!/bin/bash
# parsers/ruff.sh - Parse ruff JSON output to standard tool format
#
# Input: Raw JSON from ruff --format=json
# Output: Standard tool results JSON array
#
# Converts ruff output format to:
# [{
#   "file": "src/file.py",
#   "line": 42,
#   "severity": "error|warning|info",
#   "message": "description",
#   "rule": "rule-id"
# }]

set -euo pipefail

parse_ruff_json() {
    local ruff_json="$1"

    # Use Python to parse and transform ruff JSON to standard format
    python3 -c "
import json
import sys

try:
    ruff_output = '''$ruff_json'''

    if not ruff_output.strip():
        # No issues found - ruff outputs nothing for clean code
        print('[]')
        sys.exit(0)

    # Parse ruff output (array of issues)
    ruff_issues = json.loads(ruff_output)

    # Transform to standard format
    results = []
    for issue in ruff_issues:
        # Determine severity based on fix availability
        # auto-fixable = warning, otherwise error
        severity = 'warning' if issue.get('fix', {}).get('applicability') else 'error'

        result = {
            'file': issue.get('filename', 'unknown'),
            'line': issue.get('location', {}).get('row', 0),
            'severity': severity,
            'message': issue.get('message', ''),
            'rule': issue.get('code', '')
        }
        results.append(result)

    print(json.dumps(results, indent=2))

except json.JSONDecodeError as e:
    print('[]')
    sys.exit(0)
except Exception as e:
    print('[]')
    sys.exit(0)
"
}

# Main entry point
main() {
    local ruff_json="${1:-}"

    if [[ -z "$ruff_json" ]]; then
        echo "[]"
        return 0
    fi

    parse_ruff_json "$ruff_json"
}

main "$@"
