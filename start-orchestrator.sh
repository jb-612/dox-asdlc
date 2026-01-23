#!/bin/bash
set -euo pipefail

# Start Claude Code as Orchestrator (Master Agent)
#
# Usage: ./start-orchestrator.sh
#
# This script:
# 1. Sets orchestrator identity environment variables
# 2. Ensures we're on main branch
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

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Starting as ORCHESTRATOR           ║${NC}"
echo -e "${CYAN}║     (Master Agent - main branch)       ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Set identity
export CLAUDE_INSTANCE_ID="orchestrator"
export CLAUDE_BRANCH_PREFIX=""
export CLAUDE_CAN_MERGE="true"
export CLAUDE_CAN_MODIFY_META="true"

echo -e "${GREEN}✓${NC} Identity: $CLAUDE_INSTANCE_ID"
echo -e "${GREEN}✓${NC} Can merge to main: $CLAUDE_CAN_MERGE"
echo -e "${GREEN}✓${NC} Can modify meta files: $CLAUDE_CAN_MODIFY_META"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${YELLOW}⚠${NC}  Current branch: $CURRENT_BRANCH"
    echo -e "${YELLOW}   Orchestrator should work on main branch${NC}"
    read -p "Switch to main? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git checkout main
        echo -e "${GREEN}✓${NC} Switched to main"
    fi
else
    echo -e "${GREEN}✓${NC} On main branch"
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
if ./scripts/coordination/check-messages.sh --pending 2>/dev/null | head -20; then
    :
else
    echo -e "${YELLOW}⚠${NC}  Could not check messages (Redis may be down)"
fi
echo ""

echo -e "${GREEN}Ready to start Claude Code as Orchestrator${NC}"
echo ""
echo "Launch with:  claude"
echo ""

# Launch Claude if available
if command -v claude &> /dev/null; then
    exec claude
else
    echo -e "${YELLOW}Claude CLI not found in PATH. Set up your environment and run 'claude' manually.${NC}"
fi
