#!/bin/bash
set -euo pipefail

# check-alignment.sh - Run cross-layer alignment checks on a work item
#
# Usage: ./scripts/check-alignment.sh <feature_id> [--threshold 0.8]
# Example: ./scripts/check-alignment.sh P12-F01-tdd-separation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

usage() {
    echo "Usage: $0 <feature_id> [--threshold N]"
    echo "Example: $0 P12-F01-tdd-separation"
    echo ""
    echo "Options:"
    echo "  --threshold N  Coverage threshold (0.0-1.0, default: 0.8)"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

FEATURE_ID="$1"
shift
THRESHOLD="0.8"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --threshold)
            THRESHOLD="$2"
            shift 2
            ;;
        *)
            usage
            ;;
    esac
done

# Validate THRESHOLD is a valid number (prevent injection)
if [[ ! "$THRESHOLD" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    echo "ERROR: Invalid threshold value: $THRESHOLD"
    echo "Expected a decimal number between 0.0 and 1.0"
    exit 1
fi

# Validate feature ID format
if [[ ! "$FEATURE_ID" =~ ^P[0-9]{2}-F[0-9]{2}-[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid FEATURE_ID format: $FEATURE_ID"
    echo "Expected format: Pnn-Fnn-name (e.g., P01-F02-bash-tools)"
    exit 1
fi

WORKITEM_DIR="${PROJECT_ROOT}/.workitems/${FEATURE_ID}"

if [[ ! -d "$WORKITEM_DIR" ]]; then
    echo "ERROR: Work item directory not found: $WORKITEM_DIR"
    exit 1
fi

echo "Alignment check for: $FEATURE_ID"
echo "Threshold: $THRESHOLD"
echo "=========================================="
echo ""

cd "$PROJECT_ROOT"

.venv/bin/python3 -c "
from src.core.spec_validation.alignment import check_full_alignment

results = check_full_alignment('$WORKITEM_DIR', threshold=$THRESHOLD)
exit_code = 0
for r in results:
    status = 'PASS' if r.passed else 'WARN'
    if not r.passed:
        exit_code = 1
    print(f'{status} {r.source_layer} -> {r.target_layer}: {r.coverage:.0%} coverage')
    if r.unmatched_items:
        for item in r.unmatched_items:
            print(f'  - Unmatched: {item}')
    if r.matched_items:
        for item in r.matched_items:
            print(f'  + Matched: {item}')
    print()

if exit_code == 0:
    print('All alignment checks passed.')
else:
    print('Some alignment checks below threshold. Review unmatched items.')
exit(exit_code)
"
