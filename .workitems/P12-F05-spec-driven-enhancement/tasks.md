# P12-F05: Spec-Driven Development Enhancement - Tasks

## Overview

This task breakdown covers implementing the Spec-Driven Development Enhancement. Tasks are organized into 5 phases following the feature's layered architecture: models and parsing first, then validation, then alignment, then script integration, and finally migration and guardrails.

## Dependencies

### External Dependencies

- P11-F01: Guardrails configuration system -- COMPLETE
- P01-F03: KnowledgeStore interface -- COMPLETE
- Existing scripts: `check-planning.sh`, `new-feature.sh` -- COMPLETE

### Phase Dependencies

```
Phase 1 (Models & Parser) ──────────┐
                                     ├──> Phase 3 (Alignment)
Phase 2 (Validation & Hash) ────────┤
                                     ├──> Phase 4 (Script & Skill Updates)
                                     │
                                     └──> Phase 5 (Migration & Guardrails)
```

## Task Summary

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1: Models & Parser | T01-T03 | 3.5 hours |
| Phase 2: Validation & CLI | T04-T07 | 5.5 hours |
| Phase 3: Alignment Checks | T08-T11 | 5 hours |
| Phase 4: Script & Skill Updates | T12-T16 | 6 hours |
| Phase 5: Migration & Guardrails | T17-T19 | 3.5 hours |
| **Total** | **19 tasks** | **23.5 hours** |

---

## Phase 1: Models & Parser (Foundation)

### T01: Create Spec Validation Data Models

**Estimate:** 1hr
**Dependencies:** None
**User Story:** US-F05-01

Create core data models for the spec validation system.

**Files:**
- Create `src/core/spec_validation/__init__.py`
- Create `src/core/spec_validation/models.py`

**Subtasks:**
- [ ] Define `SpecType` enum (`prd`, `design`, `user_stories`, `tasks`)
- [ ] Define `SpecStatus` enum (`draft`, `reviewed`, `approved`)
- [ ] Define `SpecFrontMatter` frozen dataclass with all required fields
- [ ] Define `ValidationResult` dataclass (`valid`, `errors`, `warnings`, `file_path`)
- [ ] Define `AlignmentResult` dataclass (`aligned`, `coverage_pct`, `unaddressed`, `warnings`)
- [ ] Define `WorkItemValidationResult` aggregating per-file results
- [ ] Implement `to_dict()` and `from_dict()` on SpecFrontMatter
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_models.py`

**Acceptance Criteria:**
- [ ] All dataclasses are frozen (immutable)
- [ ] Enum values match the YAML front-matter schema
- [ ] JSON serialization round-trips correctly
- [ ] Unit tests verify field validation and edge cases

**TDD:**
```python
def test_spec_frontmatter_round_trip():
    fm = SpecFrontMatter(
        id="P12-F05", parent_id="P12", type=SpecType.DESIGN,
        version=1, status=SpecStatus.DRAFT, ...
    )
    data = fm.to_dict()
    restored = SpecFrontMatter.from_dict(data)
    assert fm == restored

def test_spec_type_values():
    assert SpecType.PRD.value == "prd"
    assert SpecType.DESIGN.value == "design"
```

---

### T02: Create Spec Validation Exceptions

**Estimate:** 30min
**Dependencies:** None
**User Story:** US-F05-01

Add spec-validation-specific exceptions.

**Files:**
- Create `src/core/spec_validation/exceptions.py`

**Subtasks:**
- [ ] Define `SpecValidationError` base exception (inherits from `ASDLCError` or `Exception`)
- [ ] Define `FrontMatterParseError` for YAML parsing failures
- [ ] Define `FrontMatterMissingError` for files without front-matter
- [ ] Define `SectionMissingError` for missing required sections
- [ ] Define `AlignmentError` for alignment check failures
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_exceptions.py`

**Acceptance Criteria:**
- [ ] Exceptions include descriptive messages
- [ ] FrontMatterParseError includes line number when available
- [ ] SectionMissingError includes section name and spec type

**TDD:**
```python
def test_frontmatter_parse_error_includes_line():
    err = FrontMatterParseError("Invalid YAML", line=3)
    assert "line 3" in str(err)
```

---

### T03: Implement Front-Matter Parser

**Estimate:** 2hr
**Dependencies:** T01, T02
**User Story:** US-F05-02

Create the parser that extracts YAML front-matter from markdown files.

**Files:**
- Create `src/core/spec_validation/parser.py`

**Subtasks:**
- [ ] Implement `parse_frontmatter(file_path: str) -> tuple[dict | None, str]`
  - Returns (front-matter dict, remaining body)
  - Returns (None, full_body) if no front-matter
  - Raises FrontMatterParseError on malformed YAML
- [ ] Implement `extract_section(file_path: str, heading: str) -> str | None`
  - Extracts content under a given `## Heading` until the next heading of same or higher level
  - Returns None if heading not found
- [ ] Implement `list_sections(file_path: str) -> list[str]`
  - Returns list of all `##` level headings in the file
- [ ] Implement `extract_list_items(text: str) -> list[str]`
  - Extracts bullet point items from a text block
  - Used by alignment checker for criteria extraction
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_parser.py`

**Acceptance Criteria:**
- [ ] Parser handles `---` delimited front-matter correctly
- [ ] Parser handles files without front-matter (returns None)
- [ ] Parser handles malformed YAML with clear error including line number
- [ ] Section extraction handles nested headings correctly
- [ ] Empty files handled gracefully

**TDD:**
```python
def test_parse_valid_frontmatter():
    content = "---\nid: P01-F01\ntype: design\n---\n# Title\nBody"
    # Write to temp file
    fm, body = parse_frontmatter(tmp_path)
    assert fm == {"id": "P01-F01", "type": "design"}
    assert body.startswith("# Title")

def test_parse_no_frontmatter():
    content = "# Title\nBody"
    fm, body = parse_frontmatter(tmp_path)
    assert fm is None
    assert body == content
```

---

## Phase 2: Validation & CLI

### T04: Implement Front-Matter Validator

**Estimate:** 1.5hr
**Dependencies:** T01, T02, T03
**User Story:** US-F05-03

Create the validator for YAML front-matter schema compliance.

**Files:**
- Create `src/core/spec_validation/validator.py`

**Subtasks:**
- [ ] Implement `SpecValidator` class
- [ ] Implement `validate_frontmatter(file_path: str) -> ValidationResult`
  - Check front-matter block exists
  - Check all required fields present (id, parent_id, type, version, status, created_by, created_at, updated_at)
  - Check `type` is valid SpecType value
  - Check `status` is valid SpecStatus value
  - Check `version` is integer >= 1
  - Check `created_at` and `updated_at` are valid ISO-8601 strings
  - Check `dependencies` is list of strings (if present)
- [ ] Implement `validate_id_matches_directory(file_path: str) -> ValidationResult`
  - Extract feature ID from directory name
  - Compare with front-matter `id`
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_validator.py`

**Acceptance Criteria:**
- [ ] All required field checks produce specific error messages
- [ ] Invalid field values produce type-specific errors
- [ ] Valid front-matter passes with no errors
- [ ] ID-directory mismatch detected

**TDD:**
```python
def test_validate_missing_field():
    fm_content = "---\ntype: design\n---\n# Title"
    result = validator.validate_frontmatter(path)
    assert not result.valid
    assert "Missing required field: id" in result.errors

def test_validate_invalid_type():
    fm_content = "---\nid: P01-F01\ntype: invalid\n---"
    result = validator.validate_frontmatter(path)
    assert "Invalid type: invalid" in result.errors
```

---

### T05: Implement Section Validator

**Estimate:** 1hr
**Dependencies:** T03, T04
**User Story:** US-F05-03

Add required-sections validation per spec type.

**Files:**
- Extend `src/core/spec_validation/validator.py`

**Subtasks:**
- [ ] Define `REQUIRED_SECTIONS` dict mapping SpecType to list of required heading strings
- [ ] Implement `validate_sections(file_path: str, spec_type: SpecType) -> ValidationResult`
  - Extract all `##` headings from file
  - Check each required heading exists (case-insensitive partial match)
  - For `user_stories`: check at least one `## US-` section exists
  - For `tasks`: check at least one `### T` entry exists
- [ ] Implement `validate_all(workitem_dir: str) -> WorkItemValidationResult`
  - Validate each file in the directory
  - Determine file type from filename
  - Aggregate results
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] Required sections per type match the design specification
- [ ] Missing sections listed in error messages
- [ ] User stories validated for at least one US- section
- [ ] Tasks validated for at least one T entry
- [ ] validate_all aggregates correctly

**TDD:**
```python
def test_validate_design_missing_interfaces():
    content = "---\n...\n---\n## Overview\nFoo\n## Dependencies\nBar"
    result = validator.validate_sections(path, SpecType.DESIGN)
    assert "Interfaces" in str(result.errors)

def test_validate_user_stories_needs_us_section():
    content = "---\n...\n---\n# Stories\nNo actual US sections"
    result = validator.validate_sections(path, SpecType.USER_STORIES)
    assert not result.valid
```

---

### T06: Implement Constraints Hash

**Estimate:** 1hr
**Dependencies:** T03
**User Story:** US-F05-04

Create the constraints hash computation and verification.

**Files:**
- Create `src/core/spec_validation/hasher.py`

**Subtasks:**
- [ ] Implement `compute_constraints_hash(workitem_dir: str) -> str`
  - Extract Dependencies section from design.md
  - Extract Constraints section from prd.md (if exists)
  - Extract dependency list from front-matter
  - Concatenate, compute SHA-256, return `sha256:` + first 16 hex chars
- [ ] Implement `verify_constraints_hash(workitem_dir: str) -> ValidationResult`
  - Read stored hash from design.md front-matter
  - Recompute hash
  - Compare; mismatch produces warning, not error
- [ ] Implement `update_constraints_hash(workitem_dir: str) -> str`
  - Recompute hash and update the front-matter in design.md
  - Return the new hash
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_hasher.py`

**Acceptance Criteria:**
- [ ] Same input produces same hash (deterministic)
- [ ] Changed dependencies produce different hash
- [ ] Missing prd.md does not cause failure (uses only available sections)
- [ ] Hash format is `sha256:` followed by 16 hex characters

**TDD:**
```python
def test_hash_stability():
    h1 = compute_constraints_hash(workitem_dir)
    h2 = compute_constraints_hash(workitem_dir)
    assert h1 == h2

def test_hash_changes_on_dependency_change():
    h1 = compute_constraints_hash(workitem_dir)
    # Modify Dependencies section
    h2 = compute_constraints_hash(workitem_dir)
    assert h1 != h2
```

---

### T07: Implement CLI Entry Point

**Estimate:** 2hr
**Dependencies:** T04, T05, T06
**User Story:** US-F05-11

Create the CLI tool for spec validation.

**Files:**
- Create `src/core/spec_validation/cli.py`

**Subtasks:**
- [ ] Implement CLI using argparse with subcommands:
  - `validate-frontmatter <file>` -- validate a single file's front-matter
  - `validate-sections <file> <type>` -- validate required sections
  - `validate-all <workitem_dir>` -- run all validations
  - `check-alignment <workitem_dir>` -- run alignment checks
  - `compute-hash <workitem_dir> [--update]` -- compute or update constraints hash
- [ ] Implement `--format` flag: `human` (default) or `json`
- [ ] Implement `--strict` flag for strict validation mode
- [ ] Exit code 0 for pass, 1 for fail, 2 for error
- [ ] Human-readable output with pass/fail indicators
- [ ] JSON output for programmatic consumption
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_cli.py`

**Acceptance Criteria:**
- [ ] All subcommands work correctly
- [ ] Exit codes are correct for pass, fail, and error
- [ ] JSON output is valid and parseable
- [ ] Human output uses pass/fail indicators
- [ ] `--strict` flag affects validation behavior
- [ ] Help text is clear and complete

**TDD:**
```python
def test_cli_validate_all_pass(tmp_workitem):
    result = subprocess.run(
        ["python3", "-m", "src.core.spec_validation.cli",
         "validate-all", str(tmp_workitem)],
        capture_output=True
    )
    assert result.returncode == 0

def test_cli_validate_frontmatter_fail(tmp_file_no_fm):
    result = subprocess.run(
        ["python3", "-m", "src.core.spec_validation.cli",
         "validate-frontmatter", str(tmp_file_no_fm), "--strict"],
        capture_output=True
    )
    assert result.returncode == 1
```

---

## Phase 3: Alignment Checks

### T08: Implement PRD-to-Design Alignment Check

**Estimate:** 1.5hr
**Dependencies:** T03
**User Story:** US-F05-05

Create the PRD-to-design alignment verifier.

**Files:**
- Create `src/core/spec_validation/alignment.py`

**Subtasks:**
- [ ] Implement `AlignmentChecker` class
- [ ] Implement `check_prd_to_design(workitem_dir: str) -> AlignmentResult`
  - Extract acceptance criteria from prd.md (bullet items under `Acceptance Criteria` section)
  - Extract all section headings and content from design.md
  - For each PRD criterion, compute keyword overlap with design sections
  - A criterion is "covered" if keyword overlap exceeds a threshold (default: 2 shared keywords)
  - Compute coverage percentage: covered / total criteria
  - Return AlignmentResult with coverage_pct and unaddressed items
- [ ] Implement configurable `coverage_threshold` (default 80%)
- [ ] Handle missing prd.md (skip with informational message)
- [ ] Write unit tests at `tests/unit/core/spec_validation/test_alignment.py`

**Acceptance Criteria:**
- [ ] Full alignment detected when all criteria covered
- [ ] Partial alignment computed correctly
- [ ] Unaddressed criteria listed in result
- [ ] Missing prd.md handled gracefully
- [ ] Coverage threshold configurable

**TDD:**
```python
def test_full_alignment(tmp_workitem_aligned):
    result = checker.check_prd_to_design(tmp_workitem_aligned)
    assert result.aligned
    assert result.coverage_pct == 100.0

def test_partial_alignment(tmp_workitem_partial):
    result = checker.check_prd_to_design(tmp_workitem_partial)
    assert not result.aligned
    assert len(result.unaddressed) > 0
```

---

### T09: Implement Design-to-Tasks Alignment Check

**Estimate:** 1.5hr
**Dependencies:** T03, T08
**User Story:** US-F05-06

Create the design-to-tasks alignment verifier.

**Files:**
- Extend `src/core/spec_validation/alignment.py`

**Subtasks:**
- [ ] Implement `check_design_to_tasks(workitem_dir: str) -> AlignmentResult`
  - Extract component names from design.md:
    - Class/module names from `### Component` headings
    - Interface names from `### Interface` or code blocks
    - File paths from `File Structure` section
  - Extract task descriptions from tasks.md (all `### T` entries)
  - For each design component, check if at least one task mentions it
  - Compute coverage percentage
  - Return AlignmentResult with uncovered components
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] Design components extracted from headings and code blocks
- [ ] Tasks matched to components by keyword
- [ ] Coverage percentage computed correctly
- [ ] Uncovered components listed

**TDD:**
```python
def test_design_tasks_full_coverage(tmp_workitem):
    result = checker.check_design_to_tasks(tmp_workitem)
    assert result.coverage_pct == 100.0

def test_design_tasks_missing_component(tmp_workitem):
    result = checker.check_design_to_tasks(tmp_workitem)
    assert "AlignmentChecker" in result.unaddressed
```

---

### T10: Implement Task-to-Story Mapping Check

**Estimate:** 1hr
**Dependencies:** T03, T08
**User Story:** US-F05-07

Create the task-to-story bidirectional mapping verifier.

**Files:**
- Extend `src/core/spec_validation/alignment.py`

**Subtasks:**
- [ ] Implement `check_tasks_to_stories(workitem_dir: str) -> AlignmentResult`
  - Extract story IDs from user_stories.md (`## US-F05-01`, `## US-F05-02`, etc.)
  - Extract task entries from tasks.md with their `User Story:` references
  - Check each task's story reference is a valid story ID
  - Check each story has at least one referencing task
  - Report orphaned tasks and stories without tasks
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] Task-to-story references validated
- [ ] Orphaned tasks produce warnings
- [ ] Stories without tasks produce warnings
- [ ] Perfect mapping produces clean result

**TDD:**
```python
def test_perfect_mapping(tmp_workitem):
    result = checker.check_tasks_to_stories(tmp_workitem)
    assert result.aligned
    assert len(result.warnings) == 0

def test_orphaned_task(tmp_workitem):
    result = checker.check_tasks_to_stories(tmp_workitem)
    assert "T04 references non-existent story" in str(result.warnings)
```

---

### T11: Implement Full Alignment Check

**Estimate:** 1hr
**Dependencies:** T08, T09, T10
**User Story:** US-F05-05, US-F05-06, US-F05-07

Create the aggregate alignment verification.

**Files:**
- Extend `src/core/spec_validation/alignment.py`

**Subtasks:**
- [ ] Implement `check_full_alignment(workitem_dir: str) -> FullAlignmentResult`
  - Run all three alignment checks
  - Aggregate results into FullAlignmentResult
  - Overall pass/fail based on configurable thresholds
  - Include summary with per-check coverage percentages
- [ ] Define `FullAlignmentResult` dataclass
- [ ] Wire into CLI `check-alignment` subcommand
- [ ] Write integration test at `tests/integration/test_spec_validation_e2e.py`

**Acceptance Criteria:**
- [ ] All three checks run and results aggregated
- [ ] Overall pass/fail computed correctly
- [ ] Summary includes per-check details
- [ ] CLI check-alignment uses this method
- [ ] Integration test covers full work item validation

**TDD:**
```python
def test_full_alignment_all_pass(tmp_workitem):
    result = checker.check_full_alignment(tmp_workitem)
    assert result.overall_aligned
    assert result.prd_to_design.aligned
    assert result.design_to_tasks.aligned
```

---

## Phase 4: Script & Skill Updates

### T12: Update new-feature.sh with Front-Matter

**Estimate:** 1.5hr
**Dependencies:** T01
**User Story:** US-F05-10, US-F05-08

Update the feature creation script to generate files with YAML front-matter and the new PRD layer.

**Files:**
- Modify `scripts/new-feature.sh`

**Subtasks:**
- [ ] Add `--no-prd` flag to skip PRD generation
- [ ] Generate YAML front-matter block for each file:
  - `prd.md`: type=prd
  - `design.md`: type=design
  - `user_stories.md`: type=user_stories
  - `tasks.md`: type=tasks
- [ ] Populate `id` from `${PHASE}-${FEATURE}`
- [ ] Populate `parent_id` from `${PHASE}`
- [ ] Populate `created_at` and `updated_at` with current UTC timestamp
- [ ] Set `version: 1`, `status: draft`, `created_by: planner`
- [ ] Set `constraints_hash: null`, `dependencies: []`, `tags: []`
- [ ] Create `prd.md` template with all required sections
- [ ] Preserve existing template content for design.md, user_stories.md, tasks.md
- [ ] Write integration test (create temp feature, validate with check-planning.sh)

**Acceptance Criteria:**
- [ ] All four files generated with valid front-matter
- [ ] `--no-prd` flag suppresses prd.md creation
- [ ] Timestamps are valid ISO-8601 UTC
- [ ] Existing template content preserved
- [ ] Generated files pass `check-planning.sh --strict` (once T13 is complete)

---

### T13: Update check-planning.sh with Front-Matter Checks

**Estimate:** 1.5hr
**Dependencies:** T04, T05, T07
**User Story:** US-F05-09

Extend the planning validation script with front-matter and PRD checks.

**Files:**
- Modify `scripts/check-planning.sh`

**Subtasks:**
- [ ] Add `--strict` flag to enable strict validation
- [ ] Add front-matter validation calls for each file:
  - `python3 -m src.core.spec_validation.cli validate-frontmatter <file>`
  - In lenient mode (default): warnings only for missing front-matter
  - In strict mode: errors for missing front-matter
- [ ] Add section validation calls:
  - `python3 -m src.core.spec_validation.cli validate-sections <file> <type>`
- [ ] Add PRD validation (only when prd.md exists):
  - Check front-matter valid
  - Check required sections present
- [ ] Add constraints hash verification (warning only):
  - `python3 -m src.core.spec_validation.cli compute-hash <dir> --verify`
- [ ] Preserve all existing checks (no removals)
- [ ] Update output formatting to distinguish warnings from errors
- [ ] Write integration test

**Acceptance Criteria:**
- [ ] Existing checks unchanged (backward compatible)
- [ ] Front-matter checks added as new check group
- [ ] PRD checks added when prd.md exists
- [ ] `--strict` flag controls error vs warning behavior
- [ ] Exit code reflects only errors, not warnings
- [ ] All existing work items still pass in lenient mode

---

### T14: Create check-alignment.sh Wrapper

**Estimate:** 30min
**Dependencies:** T11
**User Story:** US-F05-05, US-F05-06

Create a bash wrapper for alignment verification.

**Files:**
- Create `scripts/check-alignment.sh`

**Subtasks:**
- [ ] Accept work item directory or feature ID as argument
- [ ] Call `python3 -m src.core.spec_validation.cli check-alignment <dir>`
- [ ] Pass through `--threshold` argument (default 80%)
- [ ] Display results in human-readable format
- [ ] Exit code 0 for aligned, 1 for not aligned
- [ ] Validate FEATURE_ID format (same security check as check-planning.sh)

**Acceptance Criteria:**
- [ ] Script accepts feature ID or directory path
- [ ] Threshold configurable via argument
- [ ] Clear output showing alignment status per check

---

### T15: Update feature-planning Skill

**Estimate:** 1hr
**Dependencies:** T01, T12
**User Story:** US-F05-13

Update the feature-planning skill to generate front-matter and PRD.

**Files:**
- Modify `.claude/skills/feature-planning/SKILL.md`

**Subtasks:**
- [ ] Add "Step 1.5: Generate YAML Front-Matter" between folder creation and content writing
- [ ] Add "Step 1.75: Create PRD" before design.md
- [ ] Document front-matter field population rules
- [ ] Update validation checklist to include front-matter checks
- [ ] Add front-matter example to each step
- [ ] Ensure skill instructions match new-feature.sh behavior

**Acceptance Criteria:**
- [ ] Skill includes explicit front-matter generation step
- [ ] PRD creation included as a step
- [ ] Validation checklist updated
- [ ] Instructions match updated templates

---

### T16: Write Phase 4 Integration Tests

**Estimate:** 1.5hr
**Dependencies:** T12, T13, T14
**User Story:** US-F05-09, US-F05-10

Create integration tests for the updated scripts.

**Files:**
- Create `tests/integration/test_spec_scripts.py`

**Subtasks:**
- [ ] Test `new-feature.sh` generates files with valid front-matter
- [ ] Test `new-feature.sh --no-prd` skips prd.md
- [ ] Test `check-planning.sh` in lenient mode with old-style work item (no front-matter)
- [ ] Test `check-planning.sh --strict` with front-matter work item
- [ ] Test `check-planning.sh --strict` fails on missing front-matter
- [ ] Test `check-alignment.sh` on a well-formed work item
- [ ] Test round-trip: new-feature.sh creates, check-planning.sh validates

**Acceptance Criteria:**
- [ ] All scripts work together correctly
- [ ] Old work items still pass lenient validation
- [ ] New work items pass strict validation
- [ ] Alignment check works on realistic work item

---

## Phase 5: Migration & Guardrails

### T17: Create Migration Script

**Estimate:** 1.5hr
**Dependencies:** T03, T04
**User Story:** US-F05-12

Create a script to add front-matter to existing work items.

**Files:**
- Create `scripts/migrate-frontmatter.sh`

**Subtasks:**
- [ ] Accept work item directory or `--all` flag for batch processing
- [ ] For each file in the work item:
  - Skip if front-matter already exists
  - Extract `id` and `parent_id` from directory name
  - Determine `type` from filename
  - Extract `created_at` from `git log --follow --diff-filter=A --format=%aI -- <file>` (first commit)
  - Extract `created_by` from `git log --follow --diff-filter=A --format=%an -- <file>`
  - Set `version: 1`, `status: draft`
  - Set `constraints_hash: null`, `dependencies: []`, `tags: []`
- [ ] Create `.bak` backup of each file before modification
- [ ] Implement `--dry-run` flag that shows changes without writing
- [ ] Implement `--no-backup` flag to skip backup creation
- [ ] Display summary of files processed/skipped
- [ ] Write unit tests

**Acceptance Criteria:**
- [ ] Migrated files have valid front-matter
- [ ] Files with existing front-matter are skipped
- [ ] `.bak` backups created by default
- [ ] Dry-run shows proposed changes without modifying files
- [ ] Git timestamps extracted correctly
- [ ] Script handles missing git history gracefully (uses current timestamp)

---

### T18: Create Spec Validation Guardrail

**Estimate:** 1hr
**Dependencies:** T04 (validator must exist)
**User Story:** US-F05-14

Create a guardrails guideline for spec validation enforcement.

**Files:**
- Modify `scripts/bootstrap_guardrails.py` (add new default guideline)

**Subtasks:**
- [ ] Define `spec-validation-on-transition` guideline:
  - Category: `context_constraint`
  - Priority: 850
  - Condition: actions=["plan", "design", "implement", "review"]
  - Action: type=constraint, instruction=run spec validation, require_review=true
- [ ] Add guideline to bootstrap script defaults list
- [ ] Write unit test verifying guideline evaluates correctly for target contexts
- [ ] Write unit test verifying guideline does NOT match deploy/devops actions

**Acceptance Criteria:**
- [ ] Guideline created by bootstrap script
- [ ] Matches planning, design, implementation, and review actions
- [ ] Does not match deploy or devops actions
- [ ] Instruction text references the CLI validation command

---

### T19: Write End-to-End Tests and Documentation

**Estimate:** 1hr
**Dependencies:** All previous tasks
**User Story:** US-F05-01 through US-F05-14

Create E2E tests and update documentation.

**Files:**
- Extend `tests/integration/test_spec_validation_e2e.py`
- This design.md serves as documentation

**Subtasks:**
- [ ] E2E test: Create work item with new-feature.sh, validate with check-planning.sh --strict, run alignment check
- [ ] E2E test: Migrate an old work item, validate front-matter was added correctly
- [ ] E2E test: Full spec validation pipeline on this feature's own work item (P12-F05)
- [ ] Verify all acceptance criteria from design.md are met
- [ ] Update CLAUDE.md commands section to include new scripts (if needed)

**Acceptance Criteria:**
- [ ] E2E tests pass end-to-end
- [ ] This feature's own work item validates successfully
- [ ] Documentation reflects actual behavior

---

## Progress

- **Started:** Not started
- **Completed:** -
- **Tasks Complete:** 0/19
- **Percentage:** 0%
- **Status:** NOT_STARTED
- **Blockers:** None

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `./tools/test.sh tests/unit/core/spec_validation/`
- [ ] All integration tests pass: `./tools/test.sh tests/integration/test_spec_validation*`
- [ ] E2E tests pass
- [ ] Linter passes: `./tools/lint.sh src/core/spec_validation/`
- [ ] Documentation updated
- [ ] Interface contracts verified against design.md
- [ ] Progress marked as 100% in tasks.md
- [ ] Existing work items still pass check-planning.sh (backward compatibility)

## Notes

### Task Dependencies

```
T01 ────┐
        ├──> T03 ──> T04 ──> T05 ──> T07
T02 ────┘       │       │              │
                │       └──> T06       │
                │                      │
                ├──> T08 ──> T09       │
                │       │              │
                │       ├──> T10       │
                │       │              │
                │       └──> T11 ──> T14
                │                      │
                └──> T12 ──────────> T13 ──> T16
                     │
                     └──> T15

T03 + T04 ──> T17
T04 ──> T18
All ──> T19
```

### Implementation Order (Recommended Build Sequence)

**Days 1-2: Foundation (Phase 1 + Phase 2 start)**
1. T01, T02 (Models, Exceptions) -- parallel, 1.5hr
2. T03 (Parser) -- 2hr
3. T04 (Front-Matter Validator) -- 1.5hr

**Days 3-4: Validation Complete + Alignment Start (Phase 2 finish + Phase 3)**
4. T05 (Section Validator) -- 1hr
5. T06 (Constraints Hash) -- 1hr
6. T07 (CLI Entry Point) -- 2hr
7. T08 (PRD-Design Alignment) -- 1.5hr

**Days 5-6: Alignment Complete + Scripts (Phase 3 finish + Phase 4)**
8. T09 (Design-Tasks Alignment) -- 1.5hr
9. T10 (Task-Story Mapping) -- 1hr
10. T11 (Full Alignment) -- 1hr
11. T12 (new-feature.sh Update) -- 1.5hr

**Days 7-8: Scripts + Migration (Phase 4 finish + Phase 5)**
12. T13 (check-planning.sh Update) -- 1.5hr
13. T14 (check-alignment.sh) -- 30min
14. T15 (Skill Update) -- 1hr
15. T16 (Script Integration Tests) -- 1.5hr
16. T17 (Migration Script) -- 1.5hr
17. T18 (Guardrail) -- 1hr
18. T19 (E2E + Docs) -- 1hr

### Testing Strategy

- Unit tests mock file system for fast execution
- Integration tests use temporary directories with realistic work item structures
- E2E tests operate on actual work item directories
- Test fixtures provide sample valid and invalid spec files
- Backward compatibility tests ensure existing work items unaffected

### Risk Mitigation

1. **Backward Compatibility:** Lenient mode by default; strict mode opt-in
2. **Migration Safety:** `.bak` backups, dry-run mode
3. **False Positives in Alignment:** Configurable thresholds, warnings not errors
4. **Script Portability:** Python CLI for validation logic, bash wrappers for integration
5. **Existing Tests:** No modification of existing test files; only additions
