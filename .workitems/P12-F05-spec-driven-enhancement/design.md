# P12-F05: Spec-Driven Development Enhancement - Technical Design

**Version:** 1.0
**Date:** 2026-02-09
**Status:** Draft

## Overview

This feature enhances the aSDLC work item system to support Guardrail G10 (Spec-Driven Architecture / SDD & GitOps for Agents). It addresses three gaps identified in the guardrails constitution audit:

1. **H5 (HIGH):** Work item markdown files lack machine-readable YAML front-matter metadata. Agents parse prose instead of structured data, leading to brittle context extraction.
2. **H9 (HIGH):** No distributed logical alignment verification at workflow transitions. Outputs may drift from parent spec ("broken phone" effect).
3. **M8 (MEDIUM):** Work items use a 3-layer structure (design, stories, tasks) without a formal PRD layer capturing immutable business intent.

The solution introduces YAML front-matter on all spec files, a new PRD layer (`prd.md`), a spec validation framework integrated into `check-planning.sh`, and alignment verification rules enforced at workflow transitions.

### Goals

1. Define a YAML front-matter schema for machine-readable metadata on all work item files
2. Add a PRD layer (`prd.md`) to the work item template for business intent capture
3. Build a spec validation library that checks structural and referential integrity
4. Implement alignment verification rules at workflow transition points
5. Update `new-feature.sh`, `check-planning.sh`, and the `feature-planning` skill
6. Provide a migration path for the 65+ existing work items

### Non-Goals

- Replacing the existing 3-layer file content structure (design.md sections remain unchanged)
- Enforcing YAML front-matter on non-work-item files (e.g., `docs/`, `contracts/`)
- Implementing full Git-Gated Promotion with automated branch promotion (future feature)
- Building a UI for spec management (existing HITL UI is sufficient)
- Requiring all 65 existing work items to be migrated immediately (gradual migration)

## Dependencies

### Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P11-F01 | Complete | Guardrails configuration system (evaluator, hooks, MCP) |
| P01-F03 | Complete | KnowledgeStore interface for context search |
| Existing scripts | Complete | `new-feature.sh`, `check-planning.sh` |
| Feature-planning skill | Complete | `.claude/skills/feature-planning/SKILL.md` |

### External Dependencies

- `pyyaml>=6.0` -- Standard YAML parser for front-matter extraction. Already available in the Python environment.
- `python-frontmatter>=1.0` -- Optional: purpose-built library for YAML front-matter in markdown. Lightweight, no transitive dependencies.
- No new npm packages required.

## Interfaces

### Provided Interfaces

#### 1. SpecFrontMatter (Python dataclass)

```python
@dataclass(frozen=True)
class SpecFrontMatter:
    """Machine-readable metadata for a work item spec file."""

    id: str                          # e.g., "P12-F05"
    parent_id: str                   # e.g., "P12"
    type: SpecType                   # design | user_stories | tasks | prd
    version: int                     # Monotonically increasing
    status: SpecStatus               # draft | reviewed | approved
    constraints_hash: str | None     # SHA-256 of constraints section
    created_by: str                  # Agent or user identifier
    created_at: str                  # ISO-8601 timestamp
    updated_at: str                  # ISO-8601 timestamp
    dependencies: list[str]          # e.g., ["P12-F03", "P12-F04"]
    tags: list[str]                  # Freeform tags for search
```

#### 2. SpecValidator (Python class)

```python
class SpecValidator:
    """Validates spec files for structural and referential integrity."""

    def validate_frontmatter(self, file_path: str) -> ValidationResult:
        """Check YAML front-matter exists and conforms to schema."""

    def validate_sections(self, file_path: str, spec_type: SpecType) -> ValidationResult:
        """Check required sections exist for the given spec type."""

    def validate_parent_reference(self, file_path: str) -> ValidationResult:
        """Check parent_id references a valid artifact."""

    def validate_constraints_hash(self, file_path: str) -> ValidationResult:
        """Check constraints_hash matches current constraints."""

    def validate_all(self, workitem_dir: str) -> WorkItemValidationResult:
        """Run all validations on a complete work item directory."""
```

#### 3. AlignmentChecker (Python class)

```python
class AlignmentChecker:
    """Verifies logical alignment between spec layers."""

    def check_prd_to_design(self, workitem_dir: str) -> AlignmentResult:
        """Verify design.md covers all PRD requirements."""

    def check_design_to_tasks(self, workitem_dir: str) -> AlignmentResult:
        """Verify tasks.md covers all design decisions."""

    def check_tasks_to_stories(self, workitem_dir: str) -> AlignmentResult:
        """Verify each task maps to at least one user story."""

    def check_full_alignment(self, workitem_dir: str) -> FullAlignmentResult:
        """Run all alignment checks across all layers."""
```

#### 4. Updated CLI Scripts

- `check-planning.sh` -- Extended with front-matter and section validation
- `new-feature.sh` -- Generates files with YAML front-matter pre-populated
- `check-alignment.sh` -- New script for alignment verification

### Required Interfaces

| Interface | Provider | Usage |
|-----------|----------|-------|
| KnowledgeStore (ks_search) | P01-F03 | Search for related specs during alignment checks |
| GuardrailsEvaluator | P11-F01 | New `spec_validation` guardrail category for enforcement |
| check-planning.sh | Existing | Extended, not replaced |
| new-feature.sh | Existing | Extended, not replaced |

## Technical Approach

### 1. YAML Front-Matter Schema

Every work item file (`prd.md`, `design.md`, `user_stories.md`, `tasks.md`) will begin with a YAML front-matter block delimited by `---`:

```yaml
---
id: P12-F05
parent_id: P12
type: design
version: 1
status: draft
constraints_hash: sha256:a1b2c3d4e5f6...
created_by: planner
created_at: "2026-02-09T00:00:00Z"
updated_at: "2026-02-09T00:00:00Z"
dependencies:
  - P12-F03
  - P12-F04
tags:
  - spec-driven
  - yaml-frontmatter
---
```

**Schema Rules:**
- `id`: Required. Format `Pnn-Fnn` matching the work item directory.
- `parent_id`: Required. The parent epic or project (`Pnn`).
- `type`: Required. One of `prd`, `design`, `user_stories`, `tasks`.
- `version`: Required. Integer >= 1, incremented on each material change.
- `status`: Required. One of `draft`, `reviewed`, `approved`.
- `constraints_hash`: Optional. SHA-256 hash of the constraints/dependencies section. Enables drift detection.
- `created_by`: Required. Who created the file (`planner`, `pm`, user name).
- `created_at`: Required. ISO-8601 timestamp.
- `updated_at`: Required. ISO-8601 timestamp.
- `dependencies`: Optional. List of feature IDs this spec depends on.
- `tags`: Optional. Freeform tags for search and categorization.

### 2. PRD Layer (`prd.md`)

A new file added to the work item template:

```markdown
---
id: P12-F05
parent_id: P12
type: prd
version: 1
status: draft
...
---

# PRD: P12-F05 Spec-Driven Enhancement

## Business Intent

[What business problem does this solve? Why does it matter?]

## Success Metrics

[How do we know this feature is successful?]

## User Impact

[Who is affected and how does their experience change?]

## Scope

### In Scope
[What is included]

### Out of Scope
[What is explicitly excluded]

## Constraints

[Business, regulatory, or technical constraints]

## Acceptance Criteria

[High-level criteria that must be met for the feature to be considered complete]
```

**PRD Lifecycle:**
- Created during Step 1 (Workplan) or Step 2 (Planning)
- Status transitions: `draft` -> `reviewed` (after design review) -> `approved` (after HITL gate)
- Once `approved`, the PRD is immutable. Changes require a new version with incremented `version` field.
- The original `approved` version is preserved; only `updated_at` and `version` change in the new copy.

### 3. Required Sections Per Spec Type

Each spec type has mandatory sections. Missing sections cause validation failure:

| Spec Type | Required Sections |
|-----------|-------------------|
| `prd` | `Business Intent`, `Success Metrics`, `User Impact`, `Scope`, `Constraints`, `Acceptance Criteria` |
| `design` | `Overview`, `Dependencies`, `Interfaces`, `Technical Approach`, `File Structure` |
| `user_stories` | At least one `## US-` section with `Acceptance Criteria` and `Test Scenarios` |
| `tasks` | `Progress`, `Task List` (with at least one `### T` entry), `Completion Checklist` |

These match the existing `check-planning.sh` checks but are now codified in Python and extended to cover the PRD layer.

### 4. Spec Validation Library

Located at `src/core/spec_validation/`:

```python
# src/core/spec_validation/validator.py

class SpecValidator:
    """Validates work item spec files."""

    REQUIRED_SECTIONS: dict[SpecType, list[str]] = {
        SpecType.PRD: [
            "Business Intent",
            "Success Metrics",
            "User Impact",
            "Scope",
            "Constraints",
            "Acceptance Criteria",
        ],
        SpecType.DESIGN: [
            "Overview",
            "Dependencies",
            "Interfaces",
            "Technical Approach",
            "File Structure",
        ],
        SpecType.USER_STORIES: [],  # Dynamic: at least one US- section
        SpecType.TASKS: [
            "Progress",
            "Task List",
            "Completion Checklist",
        ],
    }

    def validate_frontmatter(self, file_path: str) -> ValidationResult:
        """Parse and validate YAML front-matter."""
        content = Path(file_path).read_text()

        # Extract front-matter between --- delimiters
        if not content.startswith("---"):
            return ValidationResult(
                valid=False,
                errors=["Missing YAML front-matter block"],
            )

        # Parse YAML
        fm = yaml.safe_load(frontmatter_text)

        # Validate required fields
        errors = []
        for field in ["id", "parent_id", "type", "version", "status",
                       "created_by", "created_at", "updated_at"]:
            if field not in fm:
                errors.append(f"Missing required field: {field}")

        # Validate field values
        if fm.get("type") not in SpecType.__members__.values():
            errors.append(f"Invalid type: {fm.get('type')}")

        if fm.get("status") not in SpecStatus.__members__.values():
            errors.append(f"Invalid status: {fm.get('status')}")

        if not isinstance(fm.get("version"), int) or fm["version"] < 1:
            errors.append("Version must be integer >= 1")

        return ValidationResult(valid=len(errors) == 0, errors=errors)
```

### 5. Alignment Verification

The `AlignmentChecker` performs cross-layer verification using text analysis:

```python
class AlignmentChecker:
    """Cross-layer spec alignment verification."""

    def check_prd_to_design(self, workitem_dir: str) -> AlignmentResult:
        """Verify design.md addresses PRD requirements.

        Strategy:
        1. Extract acceptance criteria from prd.md
        2. Extract sections from design.md
        3. For each PRD criterion, verify at least one design section
           addresses it (keyword overlap + section reference check)
        """

    def check_design_to_tasks(self, workitem_dir: str) -> AlignmentResult:
        """Verify tasks.md covers design decisions.

        Strategy:
        1. Extract interface definitions and component names from design.md
        2. Extract task descriptions from tasks.md
        3. Verify each design component has at least one task
        """

    def check_tasks_to_stories(self, workitem_dir: str) -> AlignmentResult:
        """Verify task-to-story mapping.

        Strategy:
        1. Extract task entries and their User Story references
        2. Extract story IDs from user_stories.md
        3. Verify each task references a valid story
        4. Verify each story has at least one task
        """
```

**Alignment is heuristic-based, not LLM-based.** It uses:
- Keyword extraction from headings and bullet points
- Reference matching (task -> story ID, design -> dependency ID)
- Section coverage analysis (percentage of PRD items addressed)

A `coverage_threshold` (default 80%) determines pass/fail. Items below threshold are flagged as warnings, not hard failures, to allow for legitimate exceptions.

### 6. Constraints Hash

The `constraints_hash` field provides drift detection:

```python
def compute_constraints_hash(workitem_dir: str) -> str:
    """Compute SHA-256 hash of constraints that affect this work item.

    Hashes the concatenation of:
    1. The Dependencies section of design.md
    2. The Constraints section of prd.md (if exists)
    3. The dependency list from front-matter

    This enables detection of upstream changes that may
    invalidate the current spec.
    """
    content_parts = []

    # Extract Dependencies section from design.md
    design_deps = extract_section(design_path, "Dependencies")
    if design_deps:
        content_parts.append(design_deps)

    # Extract Constraints section from prd.md
    prd_constraints = extract_section(prd_path, "Constraints")
    if prd_constraints:
        content_parts.append(prd_constraints)

    # Include dependency list from front-matter
    fm = parse_frontmatter(design_path)
    if fm and fm.get("dependencies"):
        content_parts.append(",".join(sorted(fm["dependencies"])))

    combined = "\n".join(content_parts)
    return f"sha256:{hashlib.sha256(combined.encode()).hexdigest()[:16]}"
```

### 7. Integration Points

#### check-planning.sh Updates

The existing `check-planning.sh` is extended (not replaced) with new checks:

```bash
# New checks added to check-planning.sh

# YAML front-matter validation (calls Python validator)
check "YAML front-matter valid (design.md)" \
    python3 -m src.core.spec_validation.cli validate-frontmatter "$DESIGN_FILE"

check "YAML front-matter valid (user_stories.md)" \
    python3 -m src.core.spec_validation.cli validate-frontmatter "$STORIES_FILE"

check "YAML front-matter valid (tasks.md)" \
    python3 -m src.core.spec_validation.cli validate-frontmatter "$TASKS_FILE"

# PRD validation (optional -- only if prd.md exists)
if [[ -f "${WORKITEM_DIR}/prd.md" ]]; then
    check "prd.md has valid front-matter" \
        python3 -m src.core.spec_validation.cli validate-frontmatter "${WORKITEM_DIR}/prd.md"
    check "prd.md has required sections" \
        python3 -m src.core.spec_validation.cli validate-sections "${WORKITEM_DIR}/prd.md" prd
fi
```

**Backward Compatibility:** Front-matter validation is run as a separate check group. If `--strict` flag is passed, front-matter is required. Without `--strict`, missing front-matter produces a warning, not a failure. This allows gradual migration.

#### new-feature.sh Updates

The script generates files with pre-populated YAML front-matter:

```bash
# Generate front-matter with current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

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
...
EOF
```

#### feature-planning Skill Updates

The `SKILL.md` is updated to include front-matter generation as Step 1.5 (after folder creation, before content writing).

#### Guardrails Integration

A new guardrail guideline `spec-validation-on-transition` is created:

```json
{
  "id": "spec-validation-on-transition",
  "name": "Spec Validation at Workflow Transitions",
  "category": "context_constraint",
  "priority": 850,
  "condition": {
    "actions": ["plan", "design", "implement", "review"],
    "events": ["workflow_transition"]
  },
  "action": {
    "type": "constraint",
    "instruction": "Before proceeding to the next workflow step, validate all spec files in the current work item using: python3 -m src.core.spec_validation.cli validate-all <workitem_dir>. Address any validation errors before proceeding.",
    "require_review": true
  }
}
```

### 8. Migration Strategy

For the 65+ existing work items:

1. **No forced migration.** Existing work items continue to work without front-matter.
2. **`check-planning.sh` runs in lenient mode by default.** Front-matter checks produce warnings, not failures.
3. **A migration script** (`scripts/migrate-frontmatter.sh`) is provided to add front-matter to existing files:
   - Reads the work item directory name to extract `id` and `parent_id`
   - Sets `type` based on filename
   - Sets `version: 1`, `status: draft`
   - Sets `created_at` and `updated_at` from git log (first commit date)
   - Sets `constraints_hash: null` (can be recomputed later)
   - Sets `created_by` from git log
4. **Gradual adoption.** Teams can migrate work items when they are next modified.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Front-matter format | YAML between `---` delimiters | Standard markdown front-matter convention (Jekyll, Hugo, Docusaurus). Parseable by standard YAML libraries. |
| Validation implementation | Python library + CLI | Reusable from both bash scripts and Python hooks. Consistent with project's Python backend. |
| Alignment verification | Heuristic keyword matching | Deterministic, fast, no LLM dependency. Good enough for coverage detection. |
| PRD immutability | Version-based | Once approved, content is frozen. New version required for changes. Matches Git-first truth principle. |
| Backward compatibility | Lenient mode by default | Prevents breaking 65+ existing work items. Gradual migration path. |
| constraints_hash | SHA-256 truncated to 16 hex chars | Short enough for front-matter readability, long enough to detect changes. |
| Section requirements | Codified in Python dict | Single source of truth, testable, extensible for new spec types. |

## File Structure

```
src/
  core/
    spec_validation/
      __init__.py
      models.py             # SpecFrontMatter, SpecType, SpecStatus, ValidationResult
      parser.py             # Front-matter parsing and section extraction
      validator.py          # SpecValidator class
      alignment.py          # AlignmentChecker class
      hasher.py             # Constraints hash computation
      cli.py                # CLI entry point for bash script integration
      exceptions.py         # SpecValidationError hierarchy

scripts/
  check-planning.sh         # Updated with front-matter and PRD checks
  new-feature.sh            # Updated to generate front-matter and prd.md
  check-alignment.sh        # New: alignment verification wrapper
  migrate-frontmatter.sh    # New: migration script for existing work items

.claude/skills/
  feature-planning/
    SKILL.md                # Updated with front-matter generation step

tests/
  unit/
    core/
      spec_validation/
        test_models.py
        test_parser.py
        test_validator.py
        test_alignment.py
        test_hasher.py
        test_cli.py
  integration/
    test_spec_validation_e2e.py
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing work items break with strict validation | High | Lenient mode by default; `--strict` flag opt-in |
| YAML parsing errors in malformed front-matter | Medium | Graceful error messages with line numbers; fallback to warning |
| Alignment checker false positives | Medium | Configurable coverage threshold; warnings not hard failures |
| PRD layer adds overhead to small features | Low | PRD is optional for existing work items; required only for new features via `--with-prd` flag |
| constraints_hash becomes stale | Low | Hash is advisory; stale hash produces warning, not failure |
| Migration script corrupts files | Medium | Script creates `.bak` backups; dry-run mode available |

## Open Questions

1. Should `constraints_hash` be auto-recomputed on every validation, or only when explicitly requested?
2. Should alignment verification be integrated into the guardrails PreToolUse hook, or only run via explicit CLI?
3. Should the PRD layer be mandatory for all new features, or only for features above a certain complexity threshold?
