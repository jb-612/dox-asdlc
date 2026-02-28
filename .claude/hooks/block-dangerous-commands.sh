#!/bin/bash
# Block dangerous bash commands (recursive rm, sudo, force push, etc.).
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.input.command // empty')

[[ -z "$COMMAND" ]] && exit 0

# Lowercase for case-insensitive matching
CMD_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

check_pattern() {
  local pattern="$1"
  local reason="$2"
  if echo "$CMD_LOWER" | grep -qE "$pattern"; then
    echo "BLOCKED: $reason — command: $COMMAND" >&2
    exit 2
  fi
}

check_pattern 'rm\s+-(r|rf|fr)(\s|$)' "Recursive deletion (rm -r/rm -rf)"
check_pattern '(^|\s|;|&&|\|)sudo(\s|$)' "Privilege escalation (sudo)"
check_pattern '>\s*/dev/' "Writing to device files"
check_pattern 'chmod\s+777' "World-writable permissions (chmod 777)"
check_pattern 'kill\s+-9' "Force-killing process (kill -9)"
check_pattern '(^|\s|;|&&|\|)(pkill|killall)(\s|$)' "Force-killing processes (pkill/killall)"
check_pattern 'git\s+push\s+--force' "Force push (git push --force)"
check_pattern 'git\s+push\s+-f' "Force push (git push -f)"
check_pattern 'git\s+reset\s+--hard' "Hard reset (git reset --hard)"

exit 0
