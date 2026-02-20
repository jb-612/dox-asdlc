#!/bin/bash
set -euo pipefail

# new-feature.sh - Create a new feature work item with planning templates
#
# Usage: ./scripts/new-feature.sh <phase> <feature> <description>
# Example: ./scripts/new-feature.sh P01 F02 "bash-tools"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

usage() {
    echo "Usage: $0 <phase> <feature> <description>"
    echo "Example: $0 P01 F02 \"bash-tools\""
    echo ""
    echo "Arguments:"
    echo "  phase       Phase/Epic number (e.g., P01, P02)"
    echo "  feature     Feature number (e.g., F01, F02)"
    echo "  description Kebab-case feature name (e.g., bash-tools)"
    exit 1
}

if [[ $# -lt 3 ]]; then
    usage
fi

PHASE="$1"
FEATURE="$2"
DESCRIPTION="$3"
FEATURE_ID="${PHASE}-${FEATURE}-${DESCRIPTION}"
WORKITEM_DIR="${PROJECT_ROOT}/.workitems/${FEATURE_ID}"

if [[ -d "$WORKITEM_DIR" ]]; then
    echo "Error: Work item already exists: $WORKITEM_DIR"
    exit 1
fi

echo "Creating work item: $FEATURE_ID"
mkdir -p "$WORKITEM_DIR"

# Create design.md template
cat > "${WORKITEM_DIR}/design.md" << 'EOF'
# Feature Design: ${FEATURE_ID} ${FEATURE_NAME}

## Overview

[Brief description of what this feature implements and why.]

## Dependencies

[List features this depends on, e.g., P01-F01 must be complete]
[List external dependencies: libraries, services]

## Interfaces

### Provided Interfaces

[Interfaces this feature exposes to other components]

### Required Interfaces

[Interfaces this feature consumes from other components]

## Technical Approach

[How the feature will be implemented. Include key classes/modules, data flow, and error handling strategy.]

## File Structure

```
src/path/to/feature/
├── __init__.py
├── core.py
├── interfaces.py
└── tests/
    └── test_core.py
```

## Open Questions

[Questions that need resolution before or during implementation]

## Risks

[Technical risks and mitigation strategies]
EOF

# Replace placeholders
sed -i "s/\${FEATURE_ID}/${FEATURE_ID}/g" "${WORKITEM_DIR}/design.md"
sed -i "s/\${FEATURE_NAME}/${DESCRIPTION}/g" "${WORKITEM_DIR}/design.md"

# Create user_stories.md template
cat > "${WORKITEM_DIR}/user_stories.md" << 'EOF'
# User Stories: ${FEATURE_ID} ${FEATURE_NAME}

## US-01: [Story Title]

**As a** [role]  
**I want** [capability]  
**So that** [benefit]

### Acceptance Criteria

[Specific, measurable outcomes]

### Test Scenarios

**Scenario 1: [Description]**
Given [precondition], when [action], then [expected result].

---

## US-02: [Next Story Title]

**As a** [role]  
**I want** [capability]  
**So that** [benefit]

### Acceptance Criteria

[Specific, measurable outcomes]

### Test Scenarios

**Scenario 1: [Description]**
Given [precondition], when [action], then [expected result].
EOF

sed -i "s/\${FEATURE_ID}/${FEATURE_ID}/g" "${WORKITEM_DIR}/user_stories.md"
sed -i "s/\${FEATURE_NAME}/${DESCRIPTION}/g" "${WORKITEM_DIR}/user_stories.md"

# Create tasks.md template
cat > "${WORKITEM_DIR}/tasks.md" << 'EOF'
# Tasks: ${FEATURE_ID} ${FEATURE_NAME}

## Progress

- Started: Not started
- Completed: -
- Tasks Complete: 0/0
- Percentage: 0%
- Status: NOT_STARTED
- Blockers: None

## Task List

### T01: [Task description]
- [ ] Estimate: [30min | 1hr | 2hr]
- [ ] Tests: [test file path]
- [ ] Dependencies: [T00 or "None"]
- [ ] Notes: [implementation hints]

### T02: [Task description]
- [ ] Estimate: [30min | 1hr | 2hr]
- [ ] Tests: [test file path]
- [ ] Dependencies: [T01 or "None"]
- [ ] Notes: [implementation hints]

## Completion Checklist

- [ ] All tasks marked complete
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Linter passes
- [ ] Documentation updated
- [ ] Interfaces verified
- [ ] Progress: 100%

## Notes

[Additional context or implementation notes]
EOF

sed -i "s/\${FEATURE_ID}/${FEATURE_ID}/g" "${WORKITEM_DIR}/tasks.md"
sed -i "s/\${FEATURE_NAME}/${DESCRIPTION}/g" "${WORKITEM_DIR}/tasks.md"

echo "Created work item at: $WORKITEM_DIR"
echo ""
echo "Next steps:"
echo "1. Complete design.md with technical approach"
echo "2. Complete user_stories.md with success criteria"
echo "3. Complete tasks.md with atomic task breakdown"
echo "4. Run: ./scripts/check-planning.sh $FEATURE_ID"
