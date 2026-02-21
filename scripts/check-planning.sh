#!/usr/bin/env bash
# Forwarded — see .claude/skills/feature-planning/scripts/check-planning.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/feature-planning/scripts/check-planning.sh" "$@"
