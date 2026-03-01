#!/bin/bash
# Check that .workitems/ markdown files don't exceed 100 lines after edit.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE_PATH" ]] && exit 0

# Only check workitems markdown files
[[ "$FILE_PATH" != */.workitems/* ]] && exit 0
[[ "$FILE_PATH" != *.md ]] && exit 0

# File must exist to check length
[[ ! -f "$FILE_PATH" ]] && exit 0

LINE_COUNT=$(wc -l < "$FILE_PATH" | tr -d ' ')

if [[ "$LINE_COUNT" -gt 100 ]]; then
  echo "File exceeds 100-line limit for workitems: $FILE_PATH ($LINE_COUNT lines). Split into smaller files." >&2
  exit 2
fi

exit 0
