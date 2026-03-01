#!/bin/bash
# Block writes to src/ unless an approved workitem (design.md + tasks.md) exists.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE_PATH" ]] && exit 0

# Only check writes to src/
[[ "$FILE_PATH" != */src/* ]] && exit 0

# Skip test files
BASE=$(basename "$FILE_PATH")
case "$BASE" in
  test_*.py|*.test.ts|*.test.tsx|*.spec.ts|__init__.py) exit 0 ;;
esac

# Skip non-src directories that might contain "src" in their path
for skip in .claude/ docs/ scripts/ tools/ docker/ tests/ .workitems/; do
  [[ "$FILE_PATH" == *"$skip"* ]] && exit 0
done

# Find git repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

# Check for at least one workitem with both design.md and tasks.md
FOUND=false
for dir in "$REPO_ROOT"/.workitems/P*-F*-*/; do
  [[ -d "$dir" ]] || continue
  if [[ -f "$dir/design.md" && -f "$dir/tasks.md" ]]; then
    FOUND=true
    break
  fi
done

if [[ "$FOUND" == "false" ]]; then
  echo "WARNING: No approved workitems found. Create one with /design-pipeline first." >&2
  exit 2
fi

exit 0
