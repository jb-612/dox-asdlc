#!/usr/bin/env bash
# Forwarded — see .claude/skills/deploy/scripts/build-images.sh
exec "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)/.claude/skills/deploy/scripts/build-images.sh" "$@"
