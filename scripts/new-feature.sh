#!/usr/bin/env bash
# Forwarded — see .claude/skills/feature-planning/scripts/new-feature.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/feature-planning/scripts/new-feature.sh" "$@"
