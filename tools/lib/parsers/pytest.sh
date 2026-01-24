#!/bin/bash
# parsers/pytest.sh - Parse pytest JSON report output to standard tool format
#
# Input: Raw JSON from pytest-json-report
# Output: Standard tool results JSON array
#
# Converts pytest output format to:
# [{
#   "file": "tests/file.py",
#   "line": 10,
#   "severity": "error|warning|info",
#   "message": "description",
#   "rule": "test_name"
# }]

set -euo pipefail

parse_pytest_json() {
    local pytest_json="$1"

    # Use Python to parse and transform pytest JSON to standard format
    python3 -c "
import json

try:
    pytest_json = '''$pytest_json'''

    if not pytest_json.strip():
        print('[]')
    else:
        # Parse pytest JSON report
        report = json.loads(pytest_json)

        results = []

        # Process test outcomes from the report
        tests = report.get('tests', [])
        for test in tests:
            test_name = test.get('nodeid', 'unknown')
            outcome = test.get('outcome', 'unknown')
            lineno = test.get('lineno', 0)
            filename = test.get('filename', 'unknown')

            # Map pytest outcomes to severity
            if outcome == 'passed':
                severity = 'info'
                message = 'PASSED'
            elif outcome == 'failed':
                severity = 'error'
                message = test.get('call', {}).get('longrepr', 'Test failed')
            elif outcome == 'skipped':
                severity = 'warning'
                message = test.get('call', {}).get('longrepr', 'Test skipped')
            else:
                severity = 'info'
                message = outcome

            result = {
                'file': filename,
                'line': lineno,
                'severity': severity,
                'message': message,
                'rule': test_name
            }
            results.append(result)

        print(json.dumps(results, indent=2))

except json.JSONDecodeError as e:
    print('[]')
except Exception as e:
    print('[]')
"
}

# Main entry point
main() {
    local pytest_json="${1:-}"

    if [[ -z "$pytest_json" ]]; then
        echo "[]"
        return 0
    fi

    parse_pytest_json "$pytest_json"
}

main "$@"
