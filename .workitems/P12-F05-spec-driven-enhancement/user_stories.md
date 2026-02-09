# User Stories: P12-F05 Spec-Driven Development Enhancement

## Epic Reference

This feature implements Guardrail G10 (Spec-Driven Architecture / SDD & GitOps for Agents) by adding machine-readable YAML front-matter to spec files, a PRD layer for business intent capture, automated spec validation, and distributed logical alignment verification across workflow transitions.

## Epic Summary

As a project maintainer, I want work item spec files to carry machine-readable metadata and undergo automated validation at workflow transitions, so that agents operate on structured data instead of parsing prose, and spec drift between layers is detected early.

## User Stories

### US-F05-01: Define Spec Front-Matter Schema and Models

**As a** system architect
**I want** a well-defined YAML front-matter schema for work item files
**So that** agents can extract metadata programmatically instead of parsing prose

**Acceptance Criteria:**
- [ ] `SpecFrontMatter` frozen dataclass defined with all required fields (id, parent_id, type, version, status, constraints_hash, created_by, created_at, updated_at, dependencies, tags)
- [ ] `SpecType` enum covers `prd`, `design`, `user_stories`, `tasks`
- [ ] `SpecStatus` enum covers `draft`, `reviewed`, `approved`
- [ ] `ValidationResult` dataclass captures `valid`, `errors`, `warnings`
- [ ] All models support `to_dict()` and `from_dict()` for YAML serialization
- [ ] Unit tests verify schema constraints and serialization round-trip

**Test Scenarios:**

**Scenario 1: Valid front-matter round-trip**
Given a SpecFrontMatter with all required fields, when serialized to dict and deserialized back, then the result equals the original.

**Scenario 2: Invalid type rejected**
Given a front-matter dict with `type: "invalid"`, when parsed, then a ValidationResult with `valid=False` and an error message is returned.

**Scenario 3: Missing required field**
Given a front-matter dict missing `parent_id`, when validated, then an error listing the missing field is returned.

**Priority:** High

---

### US-F05-02: Parse and Extract YAML Front-Matter from Markdown

**As a** developer
**I want** a parser that extracts YAML front-matter from markdown files
**So that** validation and alignment tools can operate on structured metadata

**Acceptance Criteria:**
- [ ] Parser correctly extracts YAML block between `---` delimiters at file start
- [ ] Parser returns both the front-matter dict and the remaining markdown body
- [ ] Parser handles files without front-matter gracefully (returns None, full body)
- [ ] Parser handles malformed YAML with clear error messages including line numbers
- [ ] Section extraction function retrieves content under a specified heading
- [ ] Unit tests cover valid files, missing front-matter, malformed YAML, and empty files

**Test Scenarios:**

**Scenario 1: Valid front-matter extraction**
Given a markdown file starting with `---\nid: P01-F01\n---\n# Title`, when parsed, then front-matter contains `{id: "P01-F01"}` and body starts with `# Title`.

**Scenario 2: File without front-matter**
Given a markdown file starting with `# Title` (no `---`), when parsed, then front-matter is None and body is the full file content.

**Scenario 3: Malformed YAML**
Given a markdown file with `---\nid: [unclosed\n---`, when parsed, then an error with the YAML parse error message and line number is returned.

**Scenario 4: Section extraction**
Given a markdown file with `## Dependencies\nFoo\n## Interfaces\nBar`, when extracting section `Dependencies`, then the result is `Foo`.

**Priority:** High

---

### US-F05-03: Validate Spec File Structural Integrity

**As a** planner agent
**I want** automated validation that spec files have correct structure
**So that** malformed specs are caught before implementation begins

**Acceptance Criteria:**
- [ ] Validator checks YAML front-matter exists and conforms to schema
- [ ] Validator checks required sections exist per spec type (prd, design, user_stories, tasks)
- [ ] Validator checks `parent_id` references a valid work item directory
- [ ] Validator checks `id` in front-matter matches the directory name
- [ ] Validator provides aggregate validation for an entire work item directory
- [ ] Validation results include file path, error description, and severity (error vs warning)
- [ ] Unit tests cover all validation rules with passing and failing inputs

**Test Scenarios:**

**Scenario 1: Fully valid design.md**
Given a design.md with valid front-matter and all required sections (Overview, Dependencies, Interfaces, Technical Approach, File Structure), when validated, then result is `valid=True` with no errors.

**Scenario 2: Missing required section**
Given a design.md missing the `Interfaces` section, when validated, then result contains error "Missing required section: Interfaces".

**Scenario 3: Front-matter id mismatch**
Given a design.md in directory `P01-F01-foo/` with front-matter `id: P01-F02`, when validated, then result contains error "Front-matter id 'P01-F02' does not match directory 'P01-F01'".

**Scenario 4: Valid prd.md**
Given a prd.md with all required sections (Business Intent, Success Metrics, User Impact, Scope, Constraints, Acceptance Criteria), when validated, then result is `valid=True`.

**Scenario 5: Full work item validation**
Given a work item directory with all four files valid, when `validate_all()` is called, then result includes individual file results and an overall `valid=True`.

**Priority:** High

---

### US-F05-04: Compute and Verify Constraints Hash

**As a** system architect
**I want** a constraints hash that detects when upstream dependencies change
**So that** stale specs are identified before they cause implementation drift

**Acceptance Criteria:**
- [ ] Hash computed from Dependencies section of design.md, Constraints section of prd.md, and dependency list from front-matter
- [ ] Hash uses SHA-256, truncated to 16 hex characters for readability
- [ ] Validation compares stored hash against recomputed hash
- [ ] Hash mismatch produces a warning (not an error) to allow intentional changes
- [ ] Hash can be recomputed and updated via CLI command
- [ ] Unit tests verify hash stability (same input produces same hash) and change detection

**Test Scenarios:**

**Scenario 1: Stable hash**
Given a work item with fixed Dependencies and Constraints sections, when hash is computed twice, then both results are identical.

**Scenario 2: Hash changes on dependency change**
Given a work item with Dependencies containing "P01-F01", when Dependencies is changed to "P01-F01, P01-F02", then the recomputed hash differs from the original.

**Scenario 3: Hash mismatch warning**
Given a design.md with `constraints_hash: sha256:abc123...` and a recomputed hash of `sha256:def456...`, when validated, then result contains warning "Constraints hash mismatch -- upstream dependencies may have changed".

**Priority:** Medium

---

### US-F05-05: Verify Alignment Between PRD and Design

**As a** reviewer agent
**I want** automated verification that design.md addresses all PRD requirements
**So that** design drift from business intent is detected at the Planning-to-Design transition

**Acceptance Criteria:**
- [ ] Alignment checker extracts acceptance criteria from prd.md
- [ ] Alignment checker extracts sections and key terms from design.md
- [ ] Each PRD criterion is checked for coverage in design.md using keyword overlap
- [ ] Coverage percentage is computed (addressed criteria / total criteria)
- [ ] Result includes list of unaddressed criteria
- [ ] Configurable coverage threshold (default 80%) determines pass/fail
- [ ] Items below threshold produce warnings, not hard failures
- [ ] Unit tests verify alignment detection with known good and bad pairs

**Test Scenarios:**

**Scenario 1: Full alignment**
Given a prd.md with 5 acceptance criteria all addressed in design.md, when alignment is checked, then coverage is 100% and result is passing.

**Scenario 2: Partial alignment**
Given a prd.md with 5 criteria and design.md addressing only 3, when alignment is checked, then coverage is 60% and result includes the 2 unaddressed criteria.

**Scenario 3: No PRD file**
Given a work item without prd.md, when PRD-to-design alignment is checked, then the check is skipped with an informational message.

**Priority:** Medium

---

### US-F05-06: Verify Alignment Between Design and Tasks

**As a** reviewer agent
**I want** automated verification that tasks.md covers all design components
**So that** no design decision is left unimplemented

**Acceptance Criteria:**
- [ ] Alignment checker extracts component names and interface definitions from design.md
- [ ] Alignment checker extracts task descriptions from tasks.md
- [ ] Each design component is checked for coverage in at least one task
- [ ] Coverage percentage is computed
- [ ] Result includes list of uncovered components
- [ ] Unit tests verify coverage detection with known inputs

**Test Scenarios:**

**Scenario 1: Complete coverage**
Given a design.md defining components A, B, C and tasks.md having tasks covering A, B, C, when alignment is checked, then coverage is 100%.

**Scenario 2: Missing task for component**
Given a design.md defining SpecValidator and AlignmentChecker, and tasks.md only having tasks for SpecValidator, when alignment is checked, then result flags AlignmentChecker as uncovered.

**Priority:** Medium

---

### US-F05-07: Verify Task-to-Story Mapping

**As a** planner agent
**I want** verification that every task maps to a user story and every story has tasks
**So that** there are no orphaned tasks or unimplemented stories

**Acceptance Criteria:**
- [ ] Alignment checker extracts task entries and their `User Story:` references from tasks.md
- [ ] Alignment checker extracts story IDs from user_stories.md
- [ ] Each task with a story reference is checked against valid story IDs
- [ ] Each story is checked for having at least one referencing task
- [ ] Orphaned tasks (no story reference) produce warnings
- [ ] Stories with no tasks produce warnings
- [ ] Unit tests verify mapping detection

**Test Scenarios:**

**Scenario 1: Perfect mapping**
Given tasks T01 (US-01), T02 (US-01), T03 (US-02) and stories US-01, US-02, when checked, then all tasks map to valid stories and all stories have tasks.

**Scenario 2: Orphaned task**
Given task T04 referencing US-99 which does not exist, when checked, then result warns "Task T04 references non-existent story US-99".

**Scenario 3: Story without tasks**
Given story US-03 with no tasks referencing it, when checked, then result warns "Story US-03 has no implementing tasks".

**Priority:** Low

---

### US-F05-08: Add PRD Layer to Work Item Template

**As a** project maintainer
**I want** a `prd.md` template added to the work item structure
**So that** business intent is formally captured as the first spec layer

**Acceptance Criteria:**
- [ ] `new-feature.sh` generates `prd.md` with YAML front-matter and all required sections
- [ ] PRD template includes Business Intent, Success Metrics, User Impact, Scope, Constraints, and Acceptance Criteria sections
- [ ] Front-matter is pre-populated with id, parent_id, type, version, timestamps
- [ ] `prd.md` creation is optional via `--with-prd` flag (default: include)
- [ ] `check-planning.sh` validates prd.md when present
- [ ] `feature-planning` skill updated to include PRD creation step

**Test Scenarios:**

**Scenario 1: New feature with PRD**
Given running `new-feature.sh P12 F05 spec-driven-enhancement`, when the script completes, then `prd.md` exists with valid front-matter and all template sections.

**Scenario 2: New feature without PRD**
Given running `new-feature.sh P12 F05 spec-driven-enhancement --no-prd`, when the script completes, then `prd.md` does not exist and check-planning.sh passes.

**Scenario 3: Existing work item without PRD**
Given an existing work item without prd.md, when `check-planning.sh` is run without `--strict`, then validation passes (PRD checks skipped).

**Priority:** High

---

### US-F05-09: Update check-planning.sh with Front-Matter Validation

**As a** developer
**I want** `check-planning.sh` to validate YAML front-matter on spec files
**So that** malformed metadata is caught during planning validation

**Acceptance Criteria:**
- [ ] `check-planning.sh` calls Python validator for front-matter checks
- [ ] In default (lenient) mode, missing front-matter produces warnings, not failures
- [ ] With `--strict` flag, missing or invalid front-matter causes failure
- [ ] Validation covers all four file types (prd, design, user_stories, tasks)
- [ ] Error output includes file name and specific validation failure
- [ ] Existing check-planning.sh checks continue to work unchanged
- [ ] Integration test verifies the updated script

**Test Scenarios:**

**Scenario 1: Lenient mode with no front-matter**
Given a work item without front-matter (pre-migration), when `check-planning.sh` is run without `--strict`, then it passes with warnings about missing front-matter.

**Scenario 2: Strict mode with no front-matter**
Given a work item without front-matter, when `check-planning.sh --strict` is run, then it fails with errors about missing front-matter.

**Scenario 3: Valid front-matter passes**
Given a work item with valid front-matter on all files, when `check-planning.sh --strict` is run, then all front-matter checks pass.

**Priority:** High

---

### US-F05-10: Update new-feature.sh with Front-Matter Generation

**As a** developer
**I want** `new-feature.sh` to generate files with YAML front-matter
**So that** new work items are created with proper metadata from the start

**Acceptance Criteria:**
- [ ] All generated files (prd.md, design.md, user_stories.md, tasks.md) include YAML front-matter
- [ ] Front-matter `id` is derived from the feature ID argument
- [ ] Front-matter `parent_id` is derived from the phase argument
- [ ] Front-matter `type` is set correctly per file
- [ ] Front-matter timestamps use current UTC time in ISO-8601 format
- [ ] Existing template content is preserved below the front-matter block
- [ ] Integration test verifies generated files pass `check-planning.sh --strict`

**Test Scenarios:**

**Scenario 1: Generated design.md has front-matter**
Given running `new-feature.sh P01 F99 test-feature`, when design.md is created, then it starts with `---\nid: P01-F99\nparent_id: P01\ntype: design\n...`.

**Scenario 2: Generated timestamps are valid**
Given running `new-feature.sh` at a known time, when the files are created, then `created_at` and `updated_at` are valid ISO-8601 strings within 1 minute of the current time.

**Priority:** High

---

### US-F05-11: Create CLI Entry Point for Spec Validation

**As a** developer or CI pipeline
**I want** a CLI tool for running spec validation
**So that** validation can be triggered from scripts, hooks, and CI

**Acceptance Criteria:**
- [ ] CLI available as `python3 -m src.core.spec_validation.cli`
- [ ] Subcommands: `validate-frontmatter`, `validate-sections`, `validate-all`, `check-alignment`, `compute-hash`
- [ ] `validate-frontmatter <file>` validates a single file's front-matter
- [ ] `validate-sections <file> <type>` validates required sections
- [ ] `validate-all <workitem_dir>` runs all validations on a work item
- [ ] `check-alignment <workitem_dir>` runs alignment checks
- [ ] `compute-hash <workitem_dir>` computes and optionally updates constraints_hash
- [ ] Exit code 0 for pass, 1 for fail, with JSON or human-readable output
- [ ] Unit tests verify CLI argument parsing and exit codes

**Test Scenarios:**

**Scenario 1: CLI validate-all on valid work item**
Given a work item with all files valid, when `python3 -m src.core.spec_validation.cli validate-all <dir>` is run, then exit code is 0 and output shows all checks passing.

**Scenario 2: CLI validate-frontmatter on invalid file**
Given a file with missing `id` in front-matter, when `validate-frontmatter` is run, then exit code is 1 and output includes the error.

**Priority:** High

---

### US-F05-12: Create Migration Script for Existing Work Items

**As a** project maintainer
**I want** a script to add front-matter to existing work items
**So that** the 65+ existing work items can be gradually migrated

**Acceptance Criteria:**
- [ ] Script reads work item directory name to extract `id` and `parent_id`
- [ ] Script sets `type` based on filename (design.md -> design, etc.)
- [ ] Script sets `created_at` from git log first commit date for the file
- [ ] Script sets `created_by` from git log
- [ ] Script creates `.bak` backup before modifying any file
- [ ] Dry-run mode shows what would be changed without writing
- [ ] Script handles files that already have front-matter (skip or update)
- [ ] Integration test verifies migration on a sample work item

**Test Scenarios:**

**Scenario 1: Migrate a work item without front-matter**
Given `.workitems/P01-F01-infra-setup/design.md` without front-matter, when migration script is run, then the file gains valid YAML front-matter with `id: P01-F01`, `type: design`, and a `.bak` backup exists.

**Scenario 2: Skip already-migrated file**
Given a file that already has YAML front-matter, when migration script is run, then the file is unchanged and output says "Skipped (already has front-matter)".

**Scenario 3: Dry-run mode**
Given a work item without front-matter, when migration script is run with `--dry-run`, then output shows proposed changes but no files are modified.

**Priority:** Low

---

### US-F05-13: Update feature-planning Skill

**As a** planner agent
**I want** the feature-planning skill to generate front-matter automatically
**So that** new features created by agents have proper metadata from the start

**Acceptance Criteria:**
- [ ] SKILL.md updated to include YAML front-matter generation as an explicit step
- [ ] PRD creation added as a step before design.md
- [ ] Front-matter fields are populated from the feature arguments
- [ ] Skill validation checklist includes front-matter completeness
- [ ] Existing skill functionality preserved

**Test Scenarios:**

**Scenario 1: Planner invocation produces front-matter**
Given the planner agent is invoked with `P12-F05-spec-driven-enhancement`, when planning is complete, then all generated files have valid YAML front-matter.

**Priority:** Medium

---

### US-F05-14: Create Alignment Verification Guardrail

**As a** project maintainer
**I want** a guardrails guideline that enforces spec validation at workflow transitions
**So that** misaligned specs are caught before implementation begins

**Acceptance Criteria:**
- [ ] New guardrail guideline `spec-validation-on-transition` created
- [ ] Guideline triggers on `plan`, `design`, `implement`, `review` actions
- [ ] Guideline instruction tells agents to run spec validation before proceeding
- [ ] Guideline uses `context_constraint` category with priority 850
- [ ] Bootstrap script updated to include the new guideline
- [ ] Unit test verifies the guideline evaluates correctly for target contexts

**Test Scenarios:**

**Scenario 1: Guideline matches planning action**
Given a task context with `action=plan, agent=planner`, when guardrails are evaluated, then the spec-validation-on-transition guideline matches.

**Scenario 2: Guideline does not match unrelated action**
Given a task context with `action=deploy, agent=devops`, when guardrails are evaluated, then the spec-validation-on-transition guideline does not match.

**Priority:** Low

---

## Non-Functional Requirements

### Performance

- Front-matter parsing completes in < 10ms per file
- Full work item validation (4 files) completes in < 100ms
- Alignment checking completes in < 500ms per work item
- `check-planning.sh` total runtime increase < 2 seconds

### Reliability

- Malformed YAML in front-matter does not crash the validator (graceful error handling)
- Missing prd.md does not cause validation failure in lenient mode
- Migration script never overwrites without creating a backup

### Maintainability

- Validation rules are codified in a single `REQUIRED_SECTIONS` dict, not scattered across scripts
- All public functions have docstrings
- Test coverage > 90% for the spec_validation module

### Backward Compatibility

- Existing work items without front-matter continue to pass `check-planning.sh` in default mode
- Existing `new-feature.sh` usage pattern unchanged (only additions, no breaking changes)
- Existing `check-planning.sh` checks unchanged (only additions)

## Story Dependencies

```
US-F05-01 (Models)
    |
    +---> US-F05-02 (Parser)
    |         |
    |         +---> US-F05-03 (Validator)
    |         |         |
    |         |         +---> US-F05-04 (Constraints Hash)
    |         |         |
    |         |         +---> US-F05-09 (check-planning.sh Update)
    |         |         |
    |         |         +---> US-F05-11 (CLI Entry Point)
    |         |
    |         +---> US-F05-05 (PRD-Design Alignment)
    |         |
    |         +---> US-F05-06 (Design-Tasks Alignment)
    |         |
    |         +---> US-F05-07 (Task-Story Mapping)
    |
    +---> US-F05-08 (PRD Template)
    |         |
    |         +---> US-F05-10 (new-feature.sh Update)
    |
    +---> US-F05-13 (Skill Update)

US-F05-12 (Migration Script) depends on US-F05-02, US-F05-03
US-F05-14 (Guardrail) depends on US-F05-03
```

## Priority Summary

| Priority | Stories |
|----------|---------|
| High | US-F05-01, 02, 03, 08, 09, 10, 11 |
| Medium | US-F05-04, 05, 06, 13 |
| Low | US-F05-07, 12, 14 |
