#!/bin/bash
# Auto-run linter after file edits (.py files only; .ts/.tsx left to IDE).
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.input.file_path // empty')

[[ -z "$FILE_PATH" ]] && exit 0
[[ ! -f "$FILE_PATH" ]] && exit 0

case "$FILE_PATH" in
  *.py)
    if command -v ruff >/dev/null 2>&1; then
      ruff check --fix "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

exit 0
