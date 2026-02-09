# User Stories: P12-F07 HITL Enhancement - Confidence Thresholds, Intent Gate, Steer Option

## Epic Reference

This feature closes HIGH and MEDIUM gaps in HITL governance (H7, M4, M5) by adding confidence thresholds with auto-escalation, an Intent Approval gate for pre-coding sign-off, and a Steer option for guided correction.

## User Stories

### US-F07-01: Define Confidence Report Data Model

**As a** developer
**I want** a structured data model for agent confidence self-assessment
**So that** confidence scores are type-safe and serializable across the system

**Acceptance Criteria:**
- [ ] `ConfidenceReport` frozen dataclass with `task_id`, `agent`, `score` (0-100), `reasons`, `timestamp`, `session_id`, `metadata`
- [ ] `ConfidenceConfig` dataclass with `threshold` (default 90), `enabled`, `auto_escalate`
- [ ] `ConfidenceConfig.from_env()` reads `CONFIDENCE_THRESHOLD`, `CONFIDENCE_ENABLED`, `CONFIDENCE_AUTO_ESCALATE`
- [ ] Models support `to_dict()` and `from_dict()` serialization
- [ ] Score validation enforces 0-100 range

**Priority:** High

---

### US-F07-02: Store and Query Confidence Reports

**As a** system operator
**I want** confidence reports persisted in the audit trail
**So that** I can review historical agent confidence patterns and escalation decisions

**Acceptance Criteria:**
- [ ] Confidence reports stored as audit entries with `event_type="confidence_report"`
- [ ] Reports include full context: task_id, agent, score, reasons, session_id
- [ ] Reports queryable via existing audit log API with `event_type` filter
- [ ] Elasticsearch mapping updated for confidence-specific fields
- [ ] Storage is non-blocking: failures logged but do not block agent execution

**Priority:** High

---

### US-F07-03: Confidence Threshold Auto-Escalation

**As a** PM CLI
**I want** automatic HITL gate triggering when agent confidence falls below the threshold
**So that** low-confidence task outputs are reviewed by a human before proceeding

**Acceptance Criteria:**
- [ ] When `score < threshold` and `auto_escalate=true`, a `confidence_threshold` HITL gate is triggered
- [ ] Gate includes Summary of Action briefing with confidence score and reasons
- [ ] Human receives three options: Approve / Reject & Rollback / Steer
- [ ] When `score >= threshold`, no gate is triggered and agent continues
- [ ] Threshold is configurable via environment variable (default 90)
- [ ] When `confidence_enabled=false`, no scoring or escalation occurs
- [ ] Decision logged to audit trail

**Priority:** High

---

### US-F07-04: Confidence Report REST API Endpoint

**As a** HITL UI developer
**I want** a REST API endpoint to submit and query confidence reports
**So that** the UI can display confidence data and the API is accessible programmatically

**Acceptance Criteria:**
- [ ] `POST /api/confidence` accepts `ConfidenceReportRequest` and returns `ConfidenceReportResponse`
- [ ] Response includes `escalated: bool` and `gate_id: str | null`
- [ ] `GET /api/confidence?task_id=X&agent=Y` returns historical reports
- [ ] Input validation: score 0-100, task_id required, agent required
- [ ] Returns 400 for invalid input, 503 for service unavailable

**Priority:** Medium

---

### US-F07-05: Confidence Report MCP Tool

**As a** Claude Code agent
**I want** an MCP tool to report confidence scores
**So that** agents can self-assess after task completion without HTTP calls

**Acceptance Criteria:**
- [ ] `guardrails_report_confidence` MCP tool accepts `task_id`, `agent`, `score`, `reasons`, `session_id`
- [ ] Returns `{"success": true, "escalated": bool, "gate_id": str | null}`
- [ ] When `GUARDRAILS_ENABLED=false`, returns `{"success": true, "escalated": false}`
- [ ] Errors return `{"success": false, "error": "description"}`

**Priority:** Medium

---

### US-F07-06: Intent Approval Gate (Gate 0)

**As a** project stakeholder
**I want** mandatory human approval of planning artifacts before any coding begins
**So that** I can verify the design direction is correct before resources are spent on implementation

**Acceptance Criteria:**
- [ ] Gate 0 triggers after planner creates design.md, user_stories.md, tasks.md
- [ ] Gate is mandatory: cannot proceed to Step 6 (Parallel Build) without approval
- [ ] Presents Summary of Action briefing including: epic description, design summary, story count, task count, estimated hours
- [ ] Lists artifact paths for review
- [ ] Offers three options: Approve / Reject & Rollback / Steer
- [ ] Approval allows workflow to proceed to implementation
- [ ] Rejection discards artifacts and returns to Step 1
- [ ] Steer allows human to provide corrected requirements
- [ ] Decision logged to audit trail with full artifact references

**Priority:** High

---

### US-F07-07: Intent Approval Guardrail Guideline

**As a** system administrator
**I want** the Intent Approval gate registered as a guardrails guideline
**So that** it is evaluated by the guardrails system and can be toggled/configured via the UI

**Acceptance Criteria:**
- [ ] Guideline `hitl-gate-intent-approval` added to bootstrap script
- [ ] Category: `hitl_gate`, priority: 960
- [ ] Condition: `events=["planning_complete"], gate_types=["intent_approval"]`
- [ ] Action: `type=hitl_gate, gate_type="intent_approval", gate_threshold="mandatory"`
- [ ] Guideline appears in HITL UI guardrails list
- [ ] Can be toggled enabled/disabled via API

**Priority:** High

---

### US-F07-08: Extend Gate Decision with Steer Option

**As a** human reviewer
**I want** a "Steer" option alongside Approve and Reject on all HITL gates
**So that** I can provide corrected instructions instead of simply rejecting and starting over

**Acceptance Criteria:**
- [ ] `GateDecision.result` accepts "approved", "rejected", or "steered"
- [ ] `GateDecision` gains `steer_instructions: str` field for corrected instructions
- [ ] `GateDecision` gains `affected_artifacts: tuple[str, ...]` field for files to update
- [ ] When `result="steered"`, `steer_instructions` must be non-empty
- [ ] Steer decision logged to audit trail with instructions and affected artifacts
- [ ] Existing approve/reject decisions continue to work unchanged

**Priority:** High

---

### US-F07-09: Steer Decision Workflow Integration

**As a** PM CLI
**I want** to receive steer decisions and re-trigger the appropriate workflow step
**So that** human corrections are applied without restarting the entire workflow

**Acceptance Criteria:**
- [ ] When PM CLI receives a steer decision, it identifies the current workflow step
- [ ] Steer instructions are passed as additional context to the re-triggered step
- [ ] If affected_artifacts are specified, planner agent is invoked to update those files
- [ ] Workflow resumes from the corrected point, not from the beginning
- [ ] Steer decision and subsequent re-trigger logged to audit trail
- [ ] If steer instructions cannot be applied, gate is re-presented with error context

**Priority:** Medium

---

### US-F07-10: Constraint Exception Gate (Gate 8)

**As a** PM CLI
**I want** agents to pause and escalate when they identify that a task cannot be completed within constraints
**So that** humans can decide whether to expand constraints, reduce scope, or abort

**Acceptance Criteria:**
- [ ] Gate triggers when agent reports a constraint violation (time, scope, budget, spec)
- [ ] Presents: task description, which constraint is violated, what would need to change
- [ ] Offers three options: Expand constraint / Reduce scope / Abort task
- [ ] Gate is advisory (can be skipped with acknowledgment)
- [ ] Decision logged to audit trail with constraint details
- [ ] Registered as guardrails guideline via bootstrap

**Priority:** Medium

---

### US-F07-11: Summary of Action Briefing Generator

**As a** human reviewer
**I want** a structured "Summary of Action" briefing when I enter the HITL loop
**So that** I have full context about what I am reviewing without needing to read raw files

**Acceptance Criteria:**
- [ ] `ActionBriefing` dataclass with `gate_type`, `summary`, `details`, `artifacts`, `agent`, `confidence`, `constraint_info`
- [ ] `BriefingGenerator` produces briefings for each gate type
- [ ] For `intent_approval`: summarizes design.md content, story/task counts, estimated hours
- [ ] For `confidence_threshold`: includes score, reasons, and task output summary
- [ ] For `constraint_exception`: includes constraint details and proposed changes
- [ ] For existing gates: generates backwards-compatible summaries
- [ ] Briefings are server-side generated for consistency

**Priority:** Medium

---

### US-F07-12: Update HITL API Contract

**As a** API consumer
**I want** the HITL API contract updated to include new gate types and steer option
**So that** the contract is the single source of truth for HITL interactions

**Acceptance Criteria:**
- [ ] New contract version v1.1.0 created at `contracts/versions/v1.1.0/hitl_api.json`
- [ ] `GateType` enum includes: `intent_approval`, `confidence_threshold`, `constraint_exception`
- [ ] `GateStatus` enum includes: `steered`
- [ ] `GateDecision.decision` enum includes: `steer`
- [ ] `GateDecision` schema includes `steer_instructions` and `affected_artifacts` fields
- [ ] New `ConfidenceReport` schema added
- [ ] Changelog updated at `contracts/CHANGELOG.md`
- [ ] Backward compatible: v1.0.0 contract remains valid

**Priority:** High

---

### US-F07-13: Update hitl-gates.md Rules

**As a** agent developer
**I want** the HITL gates rules document updated with new gates and options
**So that** all agents follow the updated gate protocol

**Acceptance Criteria:**
- [ ] Gate 0 (Intent & Requirements Approval) documented as mandatory
- [ ] Gate 8 (Constraint Exception) documented as advisory
- [ ] Confidence threshold auto-escalation documented
- [ ] All gates show three options: Approve / Reject & Rollback / Steer
- [ ] Summary table updated with new gates
- [ ] Gate implementation pattern updated to include briefing generation

**Priority:** Medium

---

### US-F07-14: Update Bootstrap with New Guidelines

**As a** system operator
**I want** the bootstrap script to include new HITL guidelines
**So that** fresh installations have confidence threshold, intent approval, and constraint exception gates

**Acceptance Criteria:**
- [ ] `hitl-gate-intent-approval` guideline added (priority 960, mandatory)
- [ ] `confidence-threshold` guideline added (priority 850, conditional)
- [ ] `hitl-gate-constraint-exception` guideline added (priority 800, advisory)
- [ ] Bootstrap is idempotent: existing guidelines not modified
- [ ] `--dry-run` shows new guidelines without creating them
- [ ] Total default guidelines increases from 11 to 14

**Priority:** Medium

---

### US-F07-15: HITL UI Confidence Indicator

**As a** human reviewer using the HITL UI
**I want** to see agent confidence scores displayed on task cards
**So that** I can quickly identify which tasks need extra attention

**Acceptance Criteria:**
- [ ] `ConfidenceIndicator` React component displays score as badge/meter
- [ ] Color coding: green (90-100), yellow (70-89), red (0-69)
- [ ] Tooltip shows reasons when hovering over indicator
- [ ] Displays on gate review cards when confidence data is available
- [ ] Graceful fallback when no confidence data exists (no indicator shown)

**Priority:** Low

---

### US-F07-16: HITL UI Steer Input

**As a** human reviewer using the HITL UI
**I want** a text input field for providing steer instructions
**So that** I can provide corrected requirements without leaving the review interface

**Acceptance Criteria:**
- [ ] `SteerInput` React component with text area for instructions
- [ ] Optional multi-select for affected artifacts
- [ ] Steer button enabled only when instructions are non-empty
- [ ] Appears alongside Approve/Reject buttons on gate review
- [ ] Submits decision with `decision: "steer"`, `steer_instructions`, and `affected_artifacts`
- [ ] Confirmation dialog before submitting steer

**Priority:** Low

---

### US-F07-17: HITL UI Action Briefing Display

**As a** human reviewer using the HITL UI
**I want** the Summary of Action briefing displayed prominently on gate review pages
**So that** I understand what I am reviewing before making a decision

**Acceptance Criteria:**
- [ ] `ActionBriefing` React component renders structured briefing
- [ ] Shows summary, details, artifact list, and agent info
- [ ] For confidence gates: shows score and reasons prominently
- [ ] For intent approval: shows design summary and task count
- [ ] Artifacts are clickable links that open file preview
- [ ] Responsive layout works on different screen sizes

**Priority:** Low

---

## Non-Functional Requirements

### Performance

- Confidence report submission: < 10ms (non-blocking ES write)
- Briefing generation: < 100ms for any gate type
- No additional polling or background processes
- Evaluator cache handles new guidelines without degradation

### Reliability

- Confidence scoring failures must not block agent execution
- Steer decision failures must re-present the gate (not lose the decision)
- All new features degrade gracefully when Elasticsearch is unavailable
- Existing gates continue to function unchanged

### Compatibility

- HITL API v1.0.0 continues to work (approve/reject only)
- All existing 7 HITL gates unchanged
- Bootstrap idempotent: safe to re-run
- CLI and HITL UI both support new features

### Auditability

- Every HITL decision (including steer) logged to audit trail
- Confidence reports logged as audit entries
- Briefing content captured in decision context
- All new gate types produce auditable artifacts

## Dependencies

| Story | Depends On |
|-------|-----------|
| US-F07-02 | US-F07-01 |
| US-F07-03 | US-F07-01, US-F07-02 |
| US-F07-04 | US-F07-01, US-F07-02 |
| US-F07-05 | US-F07-01, US-F07-02 |
| US-F07-06 | US-F07-08, US-F07-11 |
| US-F07-07 | US-F07-06 |
| US-F07-08 | US-F07-01 |
| US-F07-09 | US-F07-08 |
| US-F07-10 | US-F07-08, US-F07-11 |
| US-F07-11 | US-F07-01 |
| US-F07-12 | US-F07-06, US-F07-08, US-F07-10 |
| US-F07-13 | US-F07-06, US-F07-08, US-F07-10 |
| US-F07-14 | US-F07-07, US-F07-10 |
| US-F07-15 | US-F07-04 |
| US-F07-16 | US-F07-08, US-F07-12 |
| US-F07-17 | US-F07-11 |
