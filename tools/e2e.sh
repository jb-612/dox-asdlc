#!/usr/bin/env bash
# Forwarded — see .claude/skills/testing/scripts/e2e.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/testing/scripts/e2e.sh" "$@"
