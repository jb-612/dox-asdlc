#!/bin/bash
set -euo pipefail

# Start Claude Code as Frontend-CLI
#
# Usage: ./start-frontend.sh [feature-branch]
#
# This script:
# 1. Sets frontend identity environment variables
# 2. Ensures we're on a ui/* branch
# 3. Runs compliance check
# 4. Launches Claude Code

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FEATURE_BRANCH="${1:-}"

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Starting as FRONTEND-CLI           ║${NC}"
echo -e "${CYAN}║     (ui/* branches)                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Set identity
export CLAUDE_INSTANCE_ID="frontend"
export CLAUDE_BRANCH_PREFIX="ui/"
export CLAUDE_CAN_MERGE="false"
export CLAUDE_CAN_MODIFY_META="false"

echo -e "${GREEN}✓${NC} Identity: $CLAUDE_INSTANCE_ID"
echo -e "${GREEN}✓${NC} Branch prefix: $CLAUDE_BRANCH_PREFIX"
echo -e "${GREEN}✓${NC} Can merge to main: $CLAUDE_CAN_MERGE"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

if [[ -n "$FEATURE_BRANCH" ]]; then
    # User specified a branch
    if [[ "$FEATURE_BRANCH" != ui/* ]]; then
        FEATURE_BRANCH="ui/$FEATURE_BRANCH"
    fi
    echo "Switching to branch: $FEATURE_BRANCH"
    if git show-ref --verify --quiet "refs/heads/$FEATURE_BRANCH"; then
        git checkout "$FEATURE_BRANCH"
    else
        echo -e "${YELLOW}Branch doesn't exist. Create it?${NC}"
        read -p "Create $FEATURE_BRANCH from main? [Y/n] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            git checkout -b "$FEATURE_BRANCH" main
            echo -e "${GREEN}✓${NC} Created and switched to $FEATURE_BRANCH"
        fi
    fi
elif [[ "$CURRENT_BRANCH" != ui/* ]]; then
    echo -e "${RED}✗${NC} Current branch '$CURRENT_BRANCH' doesn't match ui/* prefix"
    echo ""
    echo "Available ui branches:"
    git branch --list 'ui/*' 2>/dev/null | head -10 || echo "  (none)"
    echo ""
    echo "Options:"
    echo "  1. Specify branch: ./start-frontend.sh ui/P05-F01-feature"
    echo "  2. Create new:     ./start-frontend.sh P05-F01-new-feature"
    echo ""
    exit 1
else
    echo -e "${GREEN}✓${NC} On branch: $CURRENT_BRANCH"
fi
echo ""

# Run compliance check
echo "Running compliance check..."
if ./scripts/check-compliance.sh --session-start 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Compliance check passed"
else
    echo -e "${YELLOW}⚠${NC}  Compliance check had warnings (non-blocking)"
fi
echo ""

# Check for pending messages
echo "Checking coordination messages..."
if ./scripts/coordination/check-messages.sh --pending --to frontend 2>/dev/null | head -15; then
    :
else
    echo -e "${YELLOW}⚠${NC}  Could not check messages (Redis may be down)"
fi
echo ""

echo -e "${GREEN}Ready to start Claude Code as Frontend-CLI${NC}"
echo ""
echo "Scope: src/hitl_ui/, docker/hitl-ui/"
echo "       .workitems/P05-*"
echo ""
echo "Launch with:  claude"
echo ""

# Launch Claude if available
if command -v claude &> /dev/null; then
    exec claude
else
    echo -e "${YELLOW}Claude CLI not found in PATH. Set up your environment and run 'claude' manually.${NC}"
fi
