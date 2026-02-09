#!/bin/bash
set -euo pipefail

# new-feature.sh - Create a new feature work item with planning templates
#
# Usage: ./scripts/new-feature.sh <phase> <feature> <description>
# Example: ./scripts/new-feature.sh P01 F02 "bash-tools"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Generate timestamp for front-matter
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create design.md template with front-matter
cat > "${WORKITEM_DIR}/design.md" << EOF
---
id: ${FEATURE_ID}
parent_id: ${PHASE}
type: design
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "${TIMESTAMP}"
updated_at: "${TIMESTAMP}"
dependencies: []
tags: []
---

# Feature Design: ${FEATURE_ID} ${DESCRIPTION}

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

\`\`\`
src/path/to/feature/
├── __init__.py
├── core.py
├── interfaces.py
└── tests/
    └── test_core.py
\`\`\`

## Open Questions

[Questions that need resolution before or during implementation]

## Risks

[Technical risks and mitigation strategies]
EOF

# Create prd.md template with front-matter
cat > "${WORKITEM_DIR}/prd.md" << EOF
---
id: ${FEATURE_ID}
parent_id: ${PHASE}
type: prd
version: 1
status: draft
constraints_hash: null
created_by: planner
created_at: "${TIMESTAMP}"
updated_at: "${TIMESTAMP}"
dependencies: []
tags: []
---

# PRD: ${FEATURE_ID} ${DESCRIPTION}

## Business Intent

[What business problem does this solve?]

## Success Metrics

[How do we measure success?]

## User Impact

[Who is affected and how?]

## Scope

### In Scope

[What is included in this feature?]

### Out of Scope

[What is explicitly excluded?]

## Constraints

[Business, regulatory, or technical constraints]

## Acceptance Criteria

[High-level criteria for feature completion]
EOF

# Create user_stories.md template with front-matter
cat > "${WORKITEM_DIR}/user_stories.md" << EOF
---
id: ${FEATURE_ID}
parent_id: ${PHASE}
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "${TIMESTAMP}"
updated_at: "${TIMESTAMP}"
dependencies: []
tags: []
---

# User Stories: ${FEATURE_ID} ${DESCRIPTION}

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

# Create tasks.md template with front-matter
cat > "${WORKITEM_DIR}/tasks.md" << EOF
---
id: ${FEATURE_ID}
parent_id: ${PHASE}
type: tasks
version: 1
status: draft
created_by: planner
created_at: "${TIMESTAMP}"
updated_at: "${TIMESTAMP}"
dependencies: []
tags: []
---

# Tasks: ${FEATURE_ID} ${DESCRIPTION}

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

echo "Created work item at: $WORKITEM_DIR"
echo ""
echo "Next steps:"
echo "1. Complete prd.md with business intent and scope"
echo "2. Complete design.md with technical approach"
echo "3. Complete user_stories.md with success criteria"
echo "4. Complete tasks.md with atomic task breakdown"
echo "5. Run: ./scripts/check-planning.sh $FEATURE_ID"
