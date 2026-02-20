#!/usr/bin/env bash
# Forwarded — see .claude/skills/code-review/scripts/ast.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/code-review/scripts/ast.sh" "$@"
