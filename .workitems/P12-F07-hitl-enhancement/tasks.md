# P12-F07: HITL Enhancement - Confidence Thresholds, Intent Gate, Steer Option - Tasks

## Overview

This task breakdown covers adding confidence thresholds with auto-escalation, Intent Approval gate (Gate 0), Steer option for all HITL gates, Constraint Exception gate (Gate 8), and corresponding UI enhancements.

## Dependencies

- **P11-F01**: Guardrails Configuration System -- COMPLETE
- **P02-F03**: HITL Dispatcher -- COMPLETE
- **P05-F01**: HITL UI -- COMPLETE
- **P01-F04**: CLI Coordination Redis -- COMPLETE

## Task List

### Phase 1: Core Data Models and Configuration (Backend)

---

### T01: Add ConfidenceReport and ConfidenceConfig models

**Agent**: backend
**Description**: Create confidence data models and configuration.

**Subtasks**:
- [ ] Create `src/core/guardrails/confidence.py` with `ConfidenceReport` frozen dataclass
- [ ] Add `ConfidenceConfig` dataclass with `threshold`, `enabled`, `auto_escalate`
- [ ] Implement `ConfidenceConfig.from_env()` loading from `CONFIDENCE_THRESHOLD`, `CONFIDENCE_ENABLED`, `CONFIDENCE_AUTO_ESCALATE`
- [ ] Add `to_dict()` and `from_dict()` serialization to `ConfidenceReport`
- [ ] Add score validation (0-100 range)
- [ ] Write unit tests for models and config

**Acceptance Criteria**:
- [ ] ConfidenceReport is a frozen dataclass with all required fields
- [ ] ConfidenceConfig defaults: threshold=90, enabled=true, auto_escalate=true
- [ ] Environment variable loading works with defaults
- [ ] Score validation rejects values outside 0-100
- [ ] Unit tests cover model creation, serialization, config loading

**Test Cases**:
- [ ] Test ConfidenceReport creation with all fields
- [ ] Test ConfidenceReport to_dict/from_dict round-trip
- [ ] Test ConfidenceConfig defaults
- [ ] Test ConfidenceConfig from environment variables
- [ ] Test score validation (boundary: 0, 100, -1, 101)

**Estimate**: 1hr
**Stories**: US-F07-01

---

### T02: Extend GateDecision model with steer fields

**Agent**: backend
**Description**: Add steer_instructions and affected_artifacts to GateDecision, add "steered" as valid result.

**Subtasks**:
- [ ] Add `steer_instructions: str = ""` field to `GateDecision` in `src/core/guardrails/models.py`
- [ ] Add `affected_artifacts: tuple[str, ...] = ()` field to `GateDecision`
- [ ] Update `GateDecision.to_dict()` to include new fields when non-empty
- [ ] Validate that `steer_instructions` is non-empty when `result="steered"`
- [ ] Write unit tests for extended GateDecision

**Acceptance Criteria**:
- [ ] GateDecision accepts "approved", "rejected", "steered" as result
- [ ] steer_instructions included in to_dict() only when non-empty
- [ ] affected_artifacts included in to_dict() only when non-empty
- [ ] Backward compatible: existing GateDecision usage unchanged
- [ ] Unit tests cover steer fields and validation

**Test Cases**:
- [ ] Test GateDecision with result="steered" and steer_instructions
- [ ] Test GateDecision with result="steered" and affected_artifacts
- [ ] Test GateDecision backward compatibility (result="approved" without steer fields)
- [ ] Test to_dict() includes steer fields only when populated
- [ ] Test validation: steered requires non-empty steer_instructions

**Estimate**: 45min
**Stories**: US-F07-08

---

### T03: Create ActionBriefing model and BriefingGenerator

**Agent**: backend
**Description**: Create the Summary of Action briefing system.

**Subtasks**:
- [ ] Create `src/core/guardrails/briefing.py` with `ActionBriefing` frozen dataclass
- [ ] Implement `BriefingGenerator` class with `generate(gate_type, context, artifacts)` method
- [ ] Implement briefing for `intent_approval` gate (summarizes design.md, stories, tasks)
- [ ] Implement briefing for `confidence_threshold` gate (score, reasons, task summary)
- [ ] Implement briefing for `constraint_exception` gate (constraint details)
- [ ] Implement fallback briefing for existing gate types
- [ ] Write unit tests for BriefingGenerator

**Acceptance Criteria**:
- [ ] ActionBriefing has gate_type, summary, details, artifacts, agent, confidence, constraint_info
- [ ] BriefingGenerator produces structured output for each gate type
- [ ] Fallback briefing works for unknown/existing gate types
- [ ] Briefings include artifact paths when available
- [ ] Unit tests cover all gate types including fallback

**Test Cases**:
- [ ] Test briefing generation for intent_approval
- [ ] Test briefing generation for confidence_threshold
- [ ] Test briefing generation for constraint_exception
- [ ] Test briefing generation for existing gate type (fallback)
- [ ] Test ActionBriefing to_dict serialization
- [ ] Test with missing optional fields (confidence=None, constraint_info=None)

**Estimate**: 1.5hr
**Stories**: US-F07-11

---

### Phase 2: Storage and Evaluation (Backend)

---

### T04: Update guardrails audit mapping for confidence fields

**Agent**: backend
**Description**: Extend Elasticsearch audit index mapping to support confidence report fields.

**Subtasks**:
- [ ] Update `src/infrastructure/guardrails/guardrails_mappings.py` audit index mapping
- [ ] Add `confidence_score` (integer) field to audit mapping
- [ ] Add `confidence_reasons` (keyword array) field to audit mapping
- [ ] Add `steer_instructions` (text) field to audit mapping
- [ ] Add `affected_artifacts` (keyword array) field to audit mapping
- [ ] Write unit tests for mapping structure

**Acceptance Criteria**:
- [ ] Audit index accepts confidence_score as integer field
- [ ] Audit index accepts steer_instructions as text field
- [ ] Existing audit entries not affected by mapping change
- [ ] Mapping is backward compatible (new fields are optional)
- [ ] Unit tests verify mapping structure

**Test Cases**:
- [ ] Test audit mapping includes new fields
- [ ] Test storing audit entry with confidence fields
- [ ] Test storing audit entry without confidence fields (backward compat)
- [ ] Test storing audit entry with steer fields

**Estimate**: 45min
**Stories**: US-F07-02

---

### T05: Add confidence report storage to GuardrailsStore

**Agent**: backend
**Description**: Add method to store confidence reports as audit entries.

**Subtasks**:
- [ ] Add `store_confidence_report(report: ConfidenceReport) -> str` to `GuardrailsStore`
- [ ] Store as audit entry with `event_type="confidence_report"`
- [ ] Include all report fields: task_id, agent, score, reasons, session_id
- [ ] Ensure storage is non-blocking (catch and log errors, do not raise)
- [ ] Write unit tests with mocked ES client

**Acceptance Criteria**:
- [ ] Confidence report stored as audit entry
- [ ] Returns audit entry ID on success
- [ ] On ES failure, returns empty string and logs error (does not raise)
- [ ] Stored entry is queryable via existing audit list endpoint with event_type filter
- [ ] Unit tests cover success, failure, and field mapping

**Test Cases**:
- [ ] Test store_confidence_report success
- [ ] Test store_confidence_report with ES failure (non-blocking)
- [ ] Test stored entry has correct event_type and fields
- [ ] Test report with all optional fields populated
- [ ] Test report with minimal fields

**Estimate**: 1hr
**Stories**: US-F07-02

---

### T06: Add confidence threshold evaluation to GuardrailsEvaluator

**Agent**: backend
**Description**: Extend the evaluator to check confidence scores against thresholds and trigger HITL gates.

**Subtasks**:
- [ ] Add `evaluate_confidence(report: ConfidenceReport) -> tuple[bool, str | None]` method to `GuardrailsEvaluator`
- [ ] Method checks score against threshold from `ConfidenceConfig`
- [ ] If below threshold and auto_escalate=True, return (True, gate_id)
- [ ] If above threshold, return (False, None)
- [ ] If confidence disabled, return (False, None)
- [ ] Integrate with `log_decision` for audit trail
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Returns escalated=True when score < threshold
- [ ] Returns escalated=False when score >= threshold
- [ ] Respects ConfidenceConfig.enabled toggle
- [ ] Respects ConfidenceConfig.auto_escalate toggle
- [ ] Logs escalation decision to audit trail
- [ ] Unit tests cover all threshold boundaries and config combinations

**Test Cases**:
- [ ] Test score=89 with threshold=90 (escalate)
- [ ] Test score=90 with threshold=90 (no escalate)
- [ ] Test score=91 with threshold=90 (no escalate)
- [ ] Test with enabled=false (no escalate regardless of score)
- [ ] Test with auto_escalate=false (no escalate regardless of score)
- [ ] Test custom threshold=75 with score=74 (escalate)
- [ ] Test audit entry logged on escalation

**Estimate**: 1.5hr
**Stories**: US-F07-03

---

### T07: Update GateDecision audit logging for steer decisions

**Agent**: backend
**Description**: Extend the evaluator's log_decision to handle steered results.

**Subtasks**:
- [ ] Update `log_decision` in `GuardrailsEvaluator` to include `steer_instructions` in audit entry
- [ ] Include `affected_artifacts` in audit entry when present
- [ ] Ensure `result="steered"` is logged correctly
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Audit entry includes steer_instructions when result="steered"
- [ ] Audit entry includes affected_artifacts when present
- [ ] Existing approve/reject logging unchanged
- [ ] Unit tests cover steered, approved, and rejected decisions

**Test Cases**:
- [ ] Test log_decision with result="steered" includes steer_instructions
- [ ] Test log_decision with result="steered" includes affected_artifacts
- [ ] Test log_decision with result="approved" (backward compat)
- [ ] Test log_decision with result="rejected" (backward compat)

**Estimate**: 45min
**Stories**: US-F07-08

---

### Phase 3: API Layer (Backend)

---

### T08: Create Pydantic models for confidence API

**Agent**: backend
**Description**: Create request/response models for the confidence REST API.

**Subtasks**:
- [ ] Create `src/orchestrator/api/models/confidence.py`
- [ ] Add `ConfidenceReportRequest` Pydantic model with field validation
- [ ] Add `ConfidenceReportResponse` Pydantic model
- [ ] Add `ConfidenceListResponse` Pydantic model for query results
- [ ] Write unit tests for model validation

**Acceptance Criteria**:
- [ ] ConfidenceReportRequest validates score 0-100, task_id required, agent required
- [ ] ConfidenceReportResponse includes id, escalated, gate_id
- [ ] Models match API contract
- [ ] Unit tests cover valid and invalid inputs

**Test Cases**:
- [ ] Test valid ConfidenceReportRequest
- [ ] Test ConfidenceReportRequest with score=-1 (reject)
- [ ] Test ConfidenceReportRequest with score=101 (reject)
- [ ] Test ConfidenceReportRequest without task_id (reject)
- [ ] Test ConfidenceReportResponse serialization

**Estimate**: 45min
**Stories**: US-F07-04

---

### T09: Update guardrails API models with steer fields

**Agent**: backend
**Description**: Extend existing Pydantic API models to support steer decisions and new gate types.

**Subtasks**:
- [ ] Add `steer_instructions` and `affected_artifacts` to `GateDecision` related models in `src/orchestrator/api/models/guardrails.py`
- [ ] Add `"steered"` to GateStatus enum (or create new enum)
- [ ] Add new gate types to `GateType` or related enums: `intent_approval`, `confidence_threshold`, `constraint_exception`
- [ ] Ensure backward compatibility: new fields are optional
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] API models accept "steer" as a decision value
- [ ] steer_instructions and affected_artifacts are optional fields
- [ ] New gate types are valid enum values
- [ ] Existing API consumers not broken
- [ ] Unit tests cover new fields and backward compat

**Test Cases**:
- [ ] Test GateDecision model with decision="steer"
- [ ] Test GateDecision model with decision="approve" (backward compat)
- [ ] Test new gate types validation
- [ ] Test steer_instructions optional (null allowed)

**Estimate**: 45min
**Stories**: US-F07-08, US-F07-12

---

### T10: Create confidence REST API endpoint

**Agent**: backend
**Description**: Implement the POST /api/confidence endpoint.

**Subtasks**:
- [ ] Create `src/orchestrator/routes/confidence_api.py` with FastAPI router
- [ ] Implement `POST /api/confidence` for submitting reports
- [ ] Call `GuardrailsStore.store_confidence_report()` for persistence
- [ ] Call `GuardrailsEvaluator.evaluate_confidence()` for threshold check
- [ ] Return escalation result in response
- [ ] Implement `GET /api/confidence` for querying reports with filters
- [ ] Register router with orchestrator app
- [ ] Write unit tests with mocked dependencies

**Acceptance Criteria**:
- [ ] POST returns 201 with ConfidenceReportResponse on success
- [ ] POST returns 400 on validation error
- [ ] POST returns 503 on service unavailable
- [ ] GET returns paginated list of confidence reports
- [ ] Escalation triggers HITL gate when applicable
- [ ] Unit tests cover success, validation error, service error

**Test Cases**:
- [ ] Test POST with valid report (no escalation)
- [ ] Test POST with low confidence (triggers escalation)
- [ ] Test POST with invalid score
- [ ] Test POST with ES unavailable
- [ ] Test GET with no filters
- [ ] Test GET with task_id filter
- [ ] Test GET with agent filter

**Estimate**: 2hr
**Stories**: US-F07-04

---

### T11: Update HITL API contract to v1.1.0

**Agent**: backend
**Description**: Create the updated HITL API contract with new gate types and steer option.

**Subtasks**:
- [ ] Create `contracts/versions/v1.1.0/hitl_api.json`
- [ ] Add `intent_approval`, `confidence_threshold`, `constraint_exception` to GateType enum
- [ ] Add `steered` to GateStatus enum
- [ ] Add `steer` to GateDecision.decision enum
- [ ] Add `steer_instructions` and `affected_artifacts` to GateDecision schema
- [ ] Add `ConfidenceReport` schema definition
- [ ] Add `POST /confidence` and `GET /confidence` endpoint definitions
- [ ] Update `contracts/CHANGELOG.md`
- [ ] Verify backward compatibility with v1.0.0

**Acceptance Criteria**:
- [ ] Contract is valid JSON Schema
- [ ] All new gate types documented
- [ ] All new fields documented with types
- [ ] Changelog describes additions
- [ ] v1.0.0 contract unchanged

**Test Cases**:
- [ ] Test contract is valid JSON
- [ ] Test contract schema validates sample requests

**Estimate**: 1.5hr
**Stories**: US-F07-12

---

### Phase 4: Guardrails Integration (Backend)

---

### T12: Add MCP tool for confidence reporting

**Agent**: backend
**Description**: Add guardrails_report_confidence tool to the guardrails MCP server.

**Subtasks**:
- [ ] Add `guardrails_report_confidence` tool to `src/infrastructure/guardrails/guardrails_mcp.py`
- [ ] Accept parameters: task_id, agent, score, reasons, session_id
- [ ] Call GuardrailsStore for persistence and GuardrailsEvaluator for threshold check
- [ ] Return success/escalated/gate_id
- [ ] Handle GUARDRAILS_ENABLED=false (return immediately)
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] MCP tool accepts all required parameters
- [ ] Returns escalation result
- [ ] Respects GUARDRAILS_ENABLED toggle
- [ ] Error responses include descriptive messages
- [ ] Unit tests cover success, escalation, disabled, and error cases

**Test Cases**:
- [ ] Test report with high score (no escalation)
- [ ] Test report with low score (escalation)
- [ ] Test with GUARDRAILS_ENABLED=false
- [ ] Test with ES unavailable (graceful failure)

**Estimate**: 1hr
**Stories**: US-F07-05

---

### T13: Update guardrails_log_decision MCP tool for steer

**Agent**: backend
**Description**: Update the existing MCP tool to accept steered result and steer_instructions.

**Subtasks**:
- [ ] Update `guardrails_log_decision` tool to accept `steer_instructions` parameter
- [ ] Update to accept `affected_artifacts` parameter
- [ ] Validate `steer_instructions` non-empty when result="steered"
- [ ] Pass new fields through to evaluator.log_decision
- [ ] Write unit tests

**Acceptance Criteria**:
- [ ] Tool accepts steer_instructions and affected_artifacts parameters
- [ ] Validation enforces non-empty steer_instructions for steered result
- [ ] Existing approve/reject calls unchanged
- [ ] Unit tests cover steered and backward compat cases

**Test Cases**:
- [ ] Test log_decision with result="steered" and steer_instructions
- [ ] Test log_decision with result="steered" without steer_instructions (error)
- [ ] Test log_decision with result="approved" (backward compat)

**Estimate**: 45min
**Stories**: US-F07-08

---

### T14: Add new guidelines to bootstrap script

**Agent**: backend
**Description**: Add intent_approval, confidence_threshold, and constraint_exception guidelines to bootstrap.

**Subtasks**:
- [ ] Add `_hitl_gate_intent_approval()` function to `scripts/bootstrap_guardrails.py`
- [ ] Add `_confidence_threshold()` function
- [ ] Add `_hitl_gate_constraint_exception()` function
- [ ] Add new guidelines to the `GUIDELINES` list
- [ ] Verify idempotency (existing guidelines not modified)
- [ ] Test with `--dry-run` flag

**Acceptance Criteria**:
- [ ] 3 new guidelines added with correct IDs, categories, priorities
- [ ] Intent approval: priority 960, mandatory, condition events=["planning_complete"]
- [ ] Confidence threshold: priority 850, conditional, condition events=["task_completion"]
- [ ] Constraint exception: priority 800, advisory, condition events=["constraint_violation"]
- [ ] Bootstrap idempotent: re-running does not duplicate
- [ ] Dry-run shows all 14 guidelines

**Test Cases**:
- [ ] Test bootstrap creates 14 guidelines (was 11)
- [ ] Test dry-run lists new guidelines
- [ ] Test idempotency on second run
- [ ] Test new guideline field values

**Estimate**: 1hr
**Stories**: US-F07-07, US-F07-14

---

### T15: Update guardrails hooks for new events and steer

**Agent**: backend
**Description**: Update Claude Code hook scripts to handle new event types and steer decisions.

**Subtasks**:
- [ ] Update `.claude/hooks/guardrails-inject.py` ContextDetector to recognize `planning_complete`, `task_completion`, `constraint_violation` events
- [ ] Update `.claude/hooks/guardrails-enforce.py` to handle steer decision forwarding
- [ ] Ensure cross-hook state file includes steer decision data
- [ ] Write unit tests for updated hooks

**Acceptance Criteria**:
- [ ] ContextDetector recognizes new event types from prompt keywords
- [ ] Steer decisions are captured in cross-hook state file
- [ ] Existing hook behavior unchanged for current events
- [ ] Unit tests cover new event detection and steer handling

**Test Cases**:
- [ ] Test ContextDetector detects "planning complete" keywords
- [ ] Test ContextDetector detects "task completion" keywords
- [ ] Test ContextDetector detects "constraint violation" keywords
- [ ] Test steer decision in cross-hook state
- [ ] Test existing events still detected (backward compat)

**Estimate**: 1hr
**Stories**: US-F07-03, US-F07-06

---

### Phase 5: Rules and Documentation (Orchestrator)

---

### T16: Update hitl-gates.md with new gates and steer option

**Agent**: orchestrator
**Description**: Update the HITL gates rules document with Gate 0, Gate 8, and Steer option.

**Subtasks**:
- [ ] Add Gate 0: Intent & Requirements Approval (mandatory) to hitl-gates.md
- [ ] Add Gate 8: Constraint Exception (advisory) to hitl-gates.md
- [ ] Add confidence threshold auto-escalation section
- [ ] Update all gate formats to show three options: Approve / Reject & Rollback / Steer
- [ ] Update summary table with new gates
- [ ] Update Gate Implementation Pattern to include briefing generation
- [ ] Update Integration with PM CLI section

**Acceptance Criteria**:
- [ ] Gate 0 documented with trigger, question format, behavior
- [ ] Gate 8 documented with trigger, question format, behavior
- [ ] Confidence threshold documented with configuration and flow
- [ ] Summary table shows 9 gates (was 7)
- [ ] All gates show three response options
- [ ] Implementation pattern includes Summary of Action briefing

**Test Cases**:
- [ ] Review document for completeness
- [ ] Verify gate numbering is sequential and non-conflicting

**Estimate**: 1hr
**Stories**: US-F07-13

---

### Phase 6: Frontend (HITL UI)

---

### T17: Create ConfidenceIndicator component

**Agent**: frontend
**Description**: Create React component for displaying agent confidence scores.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/hitl/ConfidenceIndicator.tsx`
- [ ] Implement score badge with color coding (green 90-100, yellow 70-89, red 0-69)
- [ ] Add tooltip showing reasons on hover
- [ ] Handle null/undefined score gracefully (hide component)
- [ ] Write component tests

**Acceptance Criteria**:
- [ ] Component renders score as colored badge
- [ ] Color thresholds: green >= 90, yellow 70-89, red < 70
- [ ] Tooltip displays reasons array
- [ ] Component not rendered when score is null/undefined
- [ ] Tests cover all color ranges and null case

**Test Cases**:
- [ ] Test render with score=95 (green)
- [ ] Test render with score=80 (yellow)
- [ ] Test render with score=50 (red)
- [ ] Test render with score=null (hidden)
- [ ] Test tooltip shows reasons

**Estimate**: 1hr
**Stories**: US-F07-15

---

### T18: Create SteerInput component

**Agent**: frontend
**Description**: Create React component for steer instructions input.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/hitl/SteerInput.tsx`
- [ ] Implement text area for steer instructions
- [ ] Implement optional multi-select for affected artifacts
- [ ] Add Steer button (disabled when instructions empty)
- [ ] Add confirmation dialog before submitting steer decision
- [ ] Write component tests

**Acceptance Criteria**:
- [ ] Text area accepts multi-line steer instructions
- [ ] Steer button disabled when text area is empty
- [ ] Confirmation dialog shown before submit
- [ ] Submits decision with decision="steer", steer_instructions, affected_artifacts
- [ ] Tests cover button enable/disable, dialog, and submission

**Test Cases**:
- [ ] Test Steer button disabled with empty input
- [ ] Test Steer button enabled with text
- [ ] Test confirmation dialog appears on click
- [ ] Test submission payload includes steer fields
- [ ] Test affected artifacts multi-select

**Estimate**: 1.5hr
**Stories**: US-F07-16

---

### T19: Create ActionBriefing display component

**Agent**: frontend
**Description**: Create React component for rendering Summary of Action briefings.

**Subtasks**:
- [ ] Create `docker/hitl-ui/src/components/hitl/ActionBriefing.tsx`
- [ ] Render summary, details, artifacts list, agent info
- [ ] Render confidence score using ConfidenceIndicator when available
- [ ] Render constraint info section when available
- [ ] Make artifact paths clickable links
- [ ] Write component tests

**Acceptance Criteria**:
- [ ] Displays structured briefing with all sections
- [ ] Confidence section shows when confidence data present
- [ ] Constraint section shows when constraint data present
- [ ] Artifacts render as clickable links
- [ ] Responsive layout on different screen sizes
- [ ] Tests cover all section visibility combinations

**Test Cases**:
- [ ] Test render with full briefing (all sections)
- [ ] Test render with minimal briefing (no confidence, no constraint)
- [ ] Test artifact links are clickable
- [ ] Test responsive layout at mobile width

**Estimate**: 1.5hr
**Stories**: US-F07-17

---

### T20: Integrate new components into GateReview page

**Agent**: frontend
**Description**: Integrate ConfidenceIndicator, SteerInput, and ActionBriefing into the existing gate review page.

**Subtasks**:
- [ ] Add ActionBriefing component to gate review page header
- [ ] Add ConfidenceIndicator to gate card when confidence data available
- [ ] Add Steer button + SteerInput alongside existing Approve/Reject buttons
- [ ] Wire up steer submission to POST /api/gates/{gate_id}/decide with decision="steer"
- [ ] Handle steer response and display success/error
- [ ] Write integration tests

**Acceptance Criteria**:
- [ ] Gate review page shows ActionBriefing at top
- [ ] Confidence indicator visible when applicable
- [ ] Three buttons visible: Approve / Reject / Steer
- [ ] Steer submission works end-to-end
- [ ] Existing Approve/Reject functionality unchanged
- [ ] Integration tests cover all three decision paths

**Test Cases**:
- [ ] Test gate review with confidence data shows indicator
- [ ] Test gate review without confidence data hides indicator
- [ ] Test Approve button works (backward compat)
- [ ] Test Reject button works (backward compat)
- [ ] Test Steer flow: input -> confirm -> submit
- [ ] Test ActionBriefing displayed at top of page

**Estimate**: 2hr
**Stories**: US-F07-15, US-F07-16, US-F07-17

---

### Phase 7: Integration and Testing

---

### T21: Write integration tests for confidence threshold flow

**Agent**: backend
**Description**: End-to-end integration test for confidence report -> threshold check -> HITL gate.

**Subtasks**:
- [ ] Create `tests/integration/guardrails/test_confidence_flow.py`
- [ ] Test full flow: submit report -> evaluate threshold -> gate triggered
- [ ] Test full flow: submit report -> above threshold -> no gate
- [ ] Test with disabled confidence (no gate regardless)
- [ ] Test audit trail contains confidence report and escalation decision
- [ ] Add pytest fixtures for test data

**Acceptance Criteria**:
- [ ] Tests run against mocked or real ES
- [ ] Full confidence -> escalation flow tested
- [ ] Full confidence -> no escalation flow tested
- [ ] Audit trail verified for both paths
- [ ] Tests clean up after themselves

**Test Cases**:
- [ ] Test low confidence triggers HITL gate
- [ ] Test high confidence does not trigger HITL gate
- [ ] Test disabled confidence bypasses everything
- [ ] Test audit trail for escalation
- [ ] Test audit trail for non-escalation

**Estimate**: 1.5hr
**Stories**: US-F07-03

---

### T22: Write integration tests for steer decision flow

**Agent**: backend
**Description**: End-to-end integration test for steer decision -> audit -> workflow re-trigger.

**Subtasks**:
- [ ] Create `tests/integration/guardrails/test_steer_flow.py`
- [ ] Test steer decision submission via API
- [ ] Test steer decision logged to audit with instructions and artifacts
- [ ] Test backward compatibility: approve and reject still work
- [ ] Test validation: steer without instructions returns 400

**Acceptance Criteria**:
- [ ] Steer decision API call succeeds
- [ ] Audit entry includes steer_instructions and affected_artifacts
- [ ] Approve and reject work unchanged
- [ ] Validation errors return proper HTTP status

**Test Cases**:
- [ ] Test POST steer decision with instructions
- [ ] Test POST steer decision without instructions (400)
- [ ] Test POST approve decision (backward compat)
- [ ] Test POST reject decision (backward compat)
- [ ] Test audit entry for steered decision

**Estimate**: 1.5hr
**Stories**: US-F07-08, US-F07-09

---

### T23: Write integration tests for intent approval gate

**Agent**: backend
**Description**: Integration test for the intent approval workflow.

**Subtasks**:
- [ ] Create `tests/integration/guardrails/test_intent_approval.py`
- [ ] Test intent approval guideline matches planning_complete event
- [ ] Test gate evaluates as mandatory
- [ ] Test briefing includes design/story/task summaries
- [ ] Test approve, reject, steer decisions on intent gate

**Acceptance Criteria**:
- [ ] Intent approval guideline matches correctly
- [ ] Gate is mandatory (blocks without decision)
- [ ] Briefing generator produces correct output for intent_approval
- [ ] All three decision types work

**Test Cases**:
- [ ] Test evaluator matches intent_approval guideline
- [ ] Test briefing for intent_approval gate
- [ ] Test approve on intent gate
- [ ] Test reject on intent gate
- [ ] Test steer on intent gate

**Estimate**: 1hr
**Stories**: US-F07-06, US-F07-07

---

### T24: Verify backward compatibility and run full test suite

**Agent**: backend
**Description**: Ensure all existing HITL gates and guardrails features work unchanged.

**Subtasks**:
- [ ] Run existing guardrails unit tests (all must pass)
- [ ] Run existing guardrails integration tests (all must pass)
- [ ] Run existing HITL hook tests (all must pass)
- [ ] Verify bootstrap with existing + new guidelines
- [ ] Verify MCP tools with existing + new functionality
- [ ] Document any breaking changes (should be none)

**Acceptance Criteria**:
- [ ] All existing unit tests pass
- [ ] All existing integration tests pass
- [ ] All existing hook tests pass
- [ ] Bootstrap creates 14 guidelines without errors
- [ ] MCP tools respond correctly for existing and new operations
- [ ] No breaking changes documented

**Test Cases**:
- [ ] Run `pytest tests/unit/core/guardrails/`
- [ ] Run `pytest tests/unit/infrastructure/guardrails/`
- [ ] Run `pytest tests/integration/guardrails/` (if exists)
- [ ] Run bootstrap with --dry-run
- [ ] Test existing MCP tool calls

**Estimate**: 1hr
**Stories**: All

---

## Progress

- **Started**: Not started
- **Tasks Complete**: 0/24
- **Percentage**: 0%
- **Status**: PLANNED
- **Blockers**: None

## Task Summary

| Task | Description | Agent | Estimate | Status |
|------|-------------|-------|----------|--------|
| T01 | ConfidenceReport and ConfidenceConfig models | backend | 1 hr | [ ] |
| T02 | Extend GateDecision with steer fields | backend | 45 min | [ ] |
| T03 | ActionBriefing model and BriefingGenerator | backend | 1.5 hr | [ ] |
| T04 | Update guardrails audit mapping | backend | 45 min | [ ] |
| T05 | Confidence report storage in GuardrailsStore | backend | 1 hr | [ ] |
| T06 | Confidence threshold evaluation logic | backend | 1.5 hr | [ ] |
| T07 | Steer decision audit logging | backend | 45 min | [ ] |
| T08 | Pydantic models for confidence API | backend | 45 min | [ ] |
| T09 | Update guardrails API models (steer + gate types) | backend | 45 min | [ ] |
| T10 | Confidence REST API endpoint | backend | 2 hr | [ ] |
| T11 | Update HITL API contract to v1.1.0 | backend | 1.5 hr | [ ] |
| T12 | MCP tool for confidence reporting | backend | 1 hr | [ ] |
| T13 | Update MCP log_decision for steer | backend | 45 min | [ ] |
| T14 | Add 3 new guidelines to bootstrap | backend | 1 hr | [ ] |
| T15 | Update guardrails hooks for new events | backend | 1 hr | [ ] |
| T16 | Update hitl-gates.md rules doc | orchestrator | 1 hr | [ ] |
| T17 | ConfidenceIndicator React component | frontend | 1 hr | [ ] |
| T18 | SteerInput React component | frontend | 1.5 hr | [ ] |
| T19 | ActionBriefing display component | frontend | 1.5 hr | [ ] |
| T20 | Integrate components into GateReview page | frontend | 2 hr | [ ] |
| T21 | Integration tests: confidence threshold flow | backend | 1.5 hr | [ ] |
| T22 | Integration tests: steer decision flow | backend | 1.5 hr | [ ] |
| T23 | Integration tests: intent approval gate | backend | 1 hr | [ ] |
| T24 | Backward compatibility verification | backend | 1 hr | [ ] |

**Total Estimated Time**: ~27.5 hours

## Task Dependencies

```
T01 ────┬──► T04 ──► T05 ──► T06
        │                      │
        ├──► T02 ──► T07       ├──► T21
        │    │                 │
        │    ├──► T09 ──► T11  │
        │    │                 │
        │    └──► T13          │
        │                      │
        ├──► T03               │
        │                      │
        ├──► T08 ──► T10 ──────┤
        │                      │
        └──► T15               │
                               │
T02 ──► T09 ──► T22            │
                               │
T06 + T14 ──► T23              │
                               │
T14 (depends on T02, T03)      │
                               │
T16 (independent, orchestrator)│
                               │
T17 ──────┐                    │
T18 ──────┤                    │
T19 ──────┼──► T20             │
          │                    │
All ──────┴──► T24 ◄───────────┘
```

## Implementation Order

1. **Foundation** (T01, T02, T03): Core models -- can run in parallel
2. **Storage** (T04, T05): ES mapping + store methods -- sequential
3. **Evaluation** (T06, T07): Threshold evaluation + steer audit -- parallel after T05/T02
4. **API Models** (T08, T09): Pydantic models -- parallel after T01/T02
5. **API Endpoints** (T10, T11): REST API + contract -- sequential after T08/T09
6. **MCP Tools** (T12, T13): MCP updates -- parallel after T05/T06 and T02
7. **Bootstrap + Hooks** (T14, T15): New guidelines + hook updates -- after T02/T03
8. **Rules Doc** (T16): hitl-gates.md update -- independent, orchestrator domain
9. **Frontend** (T17, T18, T19, T20): React components -- T17-T19 parallel, T20 after all three
10. **Integration Tests** (T21, T22, T23): End-to-end flows -- after relevant backend tasks
11. **Verification** (T24): Full suite backward compat -- last

### Parallelism Opportunities

- **Phase 1** (T01, T02, T03): All three run in parallel
- **Phase 3** (T08, T09): Run in parallel
- **Phase 4** (T12, T13): Run in parallel
- **Phase 6** (T17, T18, T19): All three run in parallel
- **Phase 7** (T21, T22, T23): All three run in parallel
- **T16** (orchestrator) can run in parallel with any backend phase

## Completion Checklist

- [ ] All tasks in Task List are marked complete
- [ ] All unit tests pass: `pytest tests/unit/core/guardrails/`
- [ ] All unit tests pass: `pytest tests/unit/infrastructure/guardrails/`
- [ ] All integration tests pass: `pytest tests/integration/guardrails/`
- [ ] Frontend tests pass: `cd docker/hitl-ui && npm test`
- [ ] Linter passes: `./tools/lint.sh src/`
- [ ] Contract v1.1.0 validated against sample payloads
- [ ] Bootstrap creates 14 guidelines: `python scripts/bootstrap_guardrails.py --dry-run`
- [ ] hitl-gates.md documents 9 gates with steer option
- [ ] Backward compatibility: all existing tests still pass
- [ ] Progress marked as 100% in tasks.md
