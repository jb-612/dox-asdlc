#!/usr/bin/env bash
# Forwarded — see .claude/skills/deploy/scripts/deploy-cloud-run.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/deploy/scripts/deploy-cloud-run.sh" "$@"
