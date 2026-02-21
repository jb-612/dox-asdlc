#!/usr/bin/env bash
# Forwarded — see .claude/skills/feature-completion/scripts/check-completion.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/feature-completion/scripts/check-completion.sh" "$@"
