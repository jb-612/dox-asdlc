#!/bin/bash
# Display a clean session startup banner with instance, branch, and active workitems.
set -euo pipefail

INSTANCE="${CLAUDE_INSTANCE_ID:-pm}"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
CWD=$(pwd)

echo "=================================================="
echo "  aSDLC Development Session"
echo "=================================================="
echo ""
echo "Instance: $INSTANCE"
echo "Branch:   $BRANCH"
echo "CWD:      $CWD"
echo ""

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
WORKITEMS_DIR="$REPO_ROOT/.workitems"

if [[ -d "$WORKITEMS_DIR" ]]; then
  ITEMS=$(ls "$WORKITEMS_DIR" 2>/dev/null | grep '^P[0-9]' | head -10)
  if [[ -n "$ITEMS" ]]; then
    echo "Active workitems:"
    echo "$ITEMS" | while read -r item; do
      echo "  $item"
    done
  else
    echo "Active workitems: (none)"
  fi
else
  echo "Active workitems: (none)"
fi

echo "=================================================="

exit 0
