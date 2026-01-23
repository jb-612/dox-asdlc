#!/bin/bash
set -euo pipefail

# Start Claude Code as Frontend-CLI
#
# Usage: ./start-frontend.sh
#
# This script:
# 1. Creates frontend identity file with path restrictions
# 2. Sets git author for commit attribution
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
echo -e "${CYAN}║     Starting as FRONTEND-CLI           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Set git author for commit attribution
git config user.name "Claude Frontend"
git config user.email "claude-frontend@asdlc.local"
echo -e "${GREEN}✓${NC} Git author: Claude Frontend <claude-frontend@asdlc.local>"

# Create identity file for hooks
mkdir -p .claude
cat > .claude/instance-identity.json << 'EOF'
{
  "instance_id": "frontend",
  "allowed_paths": [
    "src/hitl_ui/",
    "docker/hitl-ui/",
    "tests/unit/hitl_ui/",
    "tests/e2e/",
    ".workitems/P05-"
  ],
  "forbidden_paths": [
    "src/workers/",
    "src/orchestrator/",
    "src/infrastructure/",
    "docker/workers/",
    "docker/orchestrator/",
    "docker/infrastructure/",
    "CLAUDE.md",
    "README.md",
    "docs/",
    "contracts/",
    ".claude/rules/",
    ".claude/skills/",
    ".workitems/P01-",
    ".workitems/P02-",
    ".workitems/P03-",
    ".workitems/P06-"
  ],
  "can_merge": false,
  "can_modify_meta": false,
  "launcher": "start-frontend.sh"
}
EOF
echo -e "${GREEN}✓${NC} Identity file created: .claude/instance-identity.json"
echo ""

# Show current branch info (informational only)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "(detached HEAD)")
echo -e "Current branch: ${CYAN}$CURRENT_BRANCH${NC}"
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
echo "Allowed paths:"
echo "  - src/hitl_ui/, docker/hitl-ui/"
echo "  - .workitems/P05-*"
echo ""
echo "Forbidden paths:"
echo "  - src/workers/, src/orchestrator/, src/infrastructure/"
echo "  - CLAUDE.md, docs/, contracts/"
echo ""
echo "Launch with:  claude"
echo ""

# Launch Claude if available
if command -v claude &> /dev/null; then
    exec claude
else
    echo -e "${YELLOW}Claude CLI not found in PATH. Set up your environment and run 'claude' manually.${NC}"
fi
