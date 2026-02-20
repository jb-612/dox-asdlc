#!/usr/bin/env bash
# Forwarded — see .claude/skills/deploy/scripts/teardown-k8s.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/deploy/scripts/teardown-k8s.sh" "$@"
