#!/bin/bash
# Enforce TDD role separation via marker files (test-writer, code-writer, refactorer, lead).
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE_PATH" ]] && exit 0

MARKER_DIR="/tmp/asdlc-tdd-markers"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
MARKER_HASH=$(echo -n "$REPO_ROOT" | md5)
MARKER_FILE="$MARKER_DIR/$MARKER_HASH"

# No marker = not in TDD mode, allow everything
[[ ! -f "$MARKER_FILE" ]] && exit 0

ROLE=$(cat "$MARKER_FILE" 2>/dev/null || echo "")
[[ -z "$ROLE" ]] && exit 0

# Determine if file is a test file
BASE=$(basename "$FILE_PATH")
IS_TEST=false
case "$BASE" in
  test_*.py|*.test.ts|*.test.tsx|*.spec.ts|*_test.go) IS_TEST=true ;;
esac

case "$ROLE" in
  test-writer)
    if [[ "$IS_TEST" == "false" ]]; then
      echo "TDD: test-writer role can only write test files, not: $BASE" >&2
      exit 2
    fi
    ;;
  code-writer)
    if [[ "$IS_TEST" == "true" ]]; then
      echo "TDD: code-writer role cannot write test files: $BASE" >&2
      exit 2
    fi
    ;;
  refactorer)
    # Can write both test and source files
    ;;
  lead)
    if [[ "$FILE_PATH" == */src/* || "$FILE_PATH" == */tests/* ]]; then
      echo "TDD: lead role cannot write source or test files: $FILE_PATH" >&2
      exit 2
    fi
    ;;
esac

exit 0
