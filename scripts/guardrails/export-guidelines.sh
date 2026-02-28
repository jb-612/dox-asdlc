#!/bin/bash
# Export guidelines from Elasticsearch to static JSON file.
#
# This script queries the guardrails-config index in Elasticsearch
# and writes all guidelines as a JSON array to src/core/guardrails/static-guidelines.json.
#
# Usage:
#   ./scripts/guardrails/export-guidelines.sh [--es-url URL] [--output PATH]
#
# Options:
#   --es-url URL     Elasticsearch URL (default: http://localhost:9200)
#   --output PATH    Output file path (default: src/core/guardrails/static-guidelines.json)

set -euo pipefail

# Defaults
ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
OUTPUT_FILE=""

# Project root detection
if git rev-parse --show-toplevel &>/dev/null; then
    PROJECT_ROOT="$(git rev-parse --show-toplevel)"
else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

OUTPUT_FILE="${PROJECT_ROOT}/src/core/guardrails/static-guidelines.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --es-url)
            ES_URL="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--es-url URL] [--output PATH]"
            echo ""
            echo "Export guidelines from Elasticsearch to static JSON file."
            echo ""
            echo "Options:"
            echo "  --es-url URL     Elasticsearch URL (default: http://localhost:9200)"
            echo "  --output PATH    Output file path (default: src/core/guardrails/static-guidelines.json)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

echo "Exporting guidelines from ${ES_URL} to ${OUTPUT_FILE}..."

# Check Elasticsearch connectivity
if ! curl -s --fail "${ES_URL}/_cluster/health" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to Elasticsearch at ${ES_URL}" >&2
    exit 1
fi

# Query all guidelines from the guardrails-config index
RESPONSE=$(curl -s "${ES_URL}/guardrails-config/_search" \
    -H 'Content-Type: application/json' \
    -d '{
        "query": {"match_all": {}},
        "size": 10000,
        "sort": [{"priority": "desc"}, {"name.keyword": "asc"}]
    }')

# Check for errors
if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'hits' in d else 1)" 2>/dev/null; then
    # Extract _source from each hit and format as JSON array
    echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
guidelines = [hit['_source'] for hit in data['hits']['hits']]
print(json.dumps(guidelines, indent=2))
" > "$OUTPUT_FILE"

    COUNT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['hits']['total']['value'])")
    echo "Exported ${COUNT} guidelines to ${OUTPUT_FILE}"
else
    echo "ERROR: Failed to query guidelines from Elasticsearch" >&2
    echo "Response: $RESPONSE" >&2
    exit 1
fi
