#!/bin/bash
set -euo pipefail

# Start Claude Code as Backend-CLI
#
# Usage: ./start-backend.sh
#
# This script:
# 1. Creates backend identity file with path restrictions
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
echo -e "${CYAN}║     Starting as BACKEND-CLI            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Set git author for commit attribution
git config user.name "Claude Backend"
git config user.email "claude-backend@asdlc.local"
echo -e "${GREEN}✓${NC} Git author: Claude Backend <claude-backend@asdlc.local>"

# Create identity file for hooks
mkdir -p .claude
cat > .claude/instance-identity.json << 'EOF'
{
  "instance_id": "backend",
  "allowed_paths": [
    "src/workers/",
    "src/orchestrator/",
    "src/infrastructure/",
    "src/core/",
    "docker/workers/",
    "docker/orchestrator/",
    "docker/infrastructure/",
    "tests/unit/workers/",
    "tests/unit/orchestrator/",
    "tests/unit/infrastructure/",
    "tests/integration/",
    "tools/",
    "scripts/",
    ".workitems/P01-",
    ".workitems/P02-",
    ".workitems/P03-",
    ".workitems/P06-"
  ],
  "forbidden_paths": [
    "src/hitl_ui/",
    "docker/hitl-ui/",
    "tests/unit/hitl_ui/",
    "CLAUDE.md",
    "README.md",
    "docs/",
    "contracts/",
    ".claude/rules/",
    ".claude/skills/",
    ".workitems/P05-"
  ],
  "can_merge": false,
  "can_modify_meta": false,
  "launcher": "start-backend.sh"
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
if ./scripts/coordination/check-messages.sh --pending --to backend 2>/dev/null | head -15; then
    :
else
    echo -e "${YELLOW}⚠${NC}  Could not check messages (Redis may be down)"
fi
echo ""

echo -e "${GREEN}Ready to start Claude Code as Backend-CLI${NC}"
echo ""
echo "Allowed paths:"
echo "  - src/workers/, src/orchestrator/, src/infrastructure/"
echo "  - .workitems/P01-*, P02-*, P03-*, P06-*"
echo ""
echo "Forbidden paths:"
echo "  - src/hitl_ui/, CLAUDE.md, docs/, contracts/"
echo ""
echo "Launch with:  claude"
echo ""

# Launch Claude if available
if command -v claude &> /dev/null; then
    exec claude
else
    echo -e "${YELLOW}Claude CLI not found in PATH. Set up your environment and run 'claude' manually.${NC}"
fi
