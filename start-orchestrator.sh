#!/bin/bash
set -euo pipefail

# Start Claude Code as Orchestrator (Master Agent)
#
# Usage: ./start-orchestrator.sh
#
# This script:
# 1. Creates orchestrator identity file (full access)
# 2. Sets git author for commit attribution
# 3. Suggests working on main branch
# 4. Runs compliance check
# 5. Launches Claude Code

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
echo -e "${CYAN}║     (Master Agent)                     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Set git author for commit attribution
git config user.name "Claude Orchestrator"
git config user.email "claude-orchestrator@asdlc.local"
echo -e "${GREEN}✓${NC} Git author: Claude Orchestrator <claude-orchestrator@asdlc.local>"

# Create identity file for hooks
mkdir -p .claude
cat > .claude/instance-identity.json << 'EOF'
{
  "instance_id": "orchestrator",
  "allowed_paths": [],
  "forbidden_paths": [],
  "can_merge": true,
  "can_modify_meta": true,
  "launcher": "start-orchestrator.sh"
}
EOF
echo -e "${GREEN}✓${NC} Identity file created: .claude/instance-identity.json"
echo -e "${GREEN}✓${NC} Can merge to main: true"
echo -e "${GREEN}✓${NC} Can modify meta files: true"
echo ""

# Check current branch - suggest main but don't require it
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "(detached HEAD)")
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${YELLOW}⚠${NC}  Current branch: $CURRENT_BRANCH"
    echo -e "${YELLOW}   Orchestrator typically works on main branch${NC}"
    read -p "Switch to main? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git checkout main
        CURRENT_BRANCH="main"
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
echo "Exclusive ownership:"
echo "  - CLAUDE.md, docs/, contracts/, .claude/rules/"
echo ""
echo "Responsibilities:"
echo "  - Review and merge feature work"
echo "  - Maintain project documentation"
echo "  - Coordinate contract changes"
echo ""
echo "Launch with:  claude"
echo ""

# Launch Claude if available
if command -v claude &> /dev/null; then
    exec claude
else
    echo -e "${YELLOW}Claude CLI not found in PATH. Set up your environment and run 'claude' manually.${NC}"
fi
