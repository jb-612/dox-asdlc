# Feature Design: P12-F07 HITL Enhancement - Confidence Thresholds, Intent Gate, Steer Option

## Overview

This feature closes three Human-In-The-Loop gaps identified in the Guardrails Constitution audit:

1. **HIGH (H7)**: No confidence threshold mechanism -- agents lack self-scoring with auto-escalation at <90%
2. **MEDIUM (M4)**: No Intent/Requirements approval gate -- Steps 1-2 lack mandatory HITL before coding begins
3. **MEDIUM (M5)**: No "Steer" option -- HITL gates offer only Approve/Reject, missing "update spec and retry"

Additionally, this feature adds a Constraint Exception gate for cases where agents cannot complete tasks within spec/budget.

## Goals

- Add agent confidence self-assessment with configurable auto-escalation thresholds
- Add Intent Approval as Gate 0 (mandatory) before coding begins
- Extend all HITL gates to support Approve / Reject & Rollback / Steer as response options
- Add Constraint Exception as a new advisory gate
- Update HITL API contract to support new gate types and response options
- Extend guardrails bootstrap with new guidelines
- Provide HITL UI enhancements for confidence display and steer input

## Dependencies

### Internal Dependencies

- **P11-F01**: Guardrails Configuration System -- COMPLETE
  - `src/core/guardrails/models.py` -- Guideline, GateDecision, EvaluatedContext models
  - `src/core/guardrails/evaluator.py` -- GuardrailsEvaluator condition matching and conflict resolution
  - `src/infrastructure/guardrails/guardrails_store.py` -- Elasticsearch CRUD + audit
  - `src/orchestrator/routes/guardrails_api.py` -- REST API for guardrails
  - `src/orchestrator/api/models/guardrails.py` -- Pydantic API models
  - `scripts/bootstrap_guardrails.py` -- Default guideline loader
  - `.claude/hooks/guardrails-*.py` -- Hook scripts for runtime enforcement

- **P02-F03**: HITL Dispatcher -- Existing gate dispatch infrastructure
- **P05-F01**: HITL UI -- Existing web UI for gate review
- **P01-F04**: CLI Coordination Redis -- Coordination message system

### External Dependencies

- Elasticsearch 8.x (already deployed)
- FastAPI (already in use for orchestrator)
- React + TypeScript (already in use for HITL UI)

### Cross-Feature Dependencies (Future)

- **P12-F05** (Spec-Driven Architecture): Steer option will eventually update spec files when that feature is available. For now, Steer captures corrected instructions and re-triggers the workflow step.
- **P12-F08** (State Snapshotting): Reject & Rollback will eventually integrate with state snapshots. For now, Reject triggers a workflow step reset without snapshot recovery.

## Technical Approach

### 1. Confidence Scoring System

#### Data Model

Add a `ConfidenceReport` frozen dataclass to `src/core/guardrails/models.py`:

```python
@dataclass(frozen=True)
class ConfidenceReport:
    """Agent self-assessment after a task completion."""
    task_id: str
    agent: str
    score: int                    # 0-100
    reasons: tuple[str, ...]      # Why confidence is lower
    timestamp: datetime
    session_id: str | None = None
    metadata: dict[str, Any] | None = None
```

#### Threshold Configuration

Add to `src/core/guardrails/config.py`:

```python
@dataclass
class ConfidenceConfig:
    threshold: int = 90           # Default: auto-escalate below 90%
    enabled: bool = True          # Master toggle
    auto_escalate: bool = True    # Auto-trigger HITL below threshold
```

Load from environment:
- `CONFIDENCE_THRESHOLD` (default: 90)
- `CONFIDENCE_ENABLED` (default: true)
- `CONFIDENCE_AUTO_ESCALATE` (default: true)

#### Evaluation Flow

1. Agent completes a major task step
2. Agent outputs structured confidence report: `{"confidence": 85, "reasons": ["unclear spec"]}`
3. The `confidence_threshold` guardrail evaluates the score
4. If score < threshold and auto_escalate is true, trigger `confidence_threshold` HITL gate
5. Gate presents Summary of Action briefing to human
6. Human decides: Approve (continue) / Reject & Rollback / Steer (provide clarification)
7. Decision logged to audit trail

#### Guardrail Integration

New guideline type with `ActionType.HITL_GATE` and `gate_type="confidence_threshold"`:

```python
Guideline(
    id="confidence-threshold",
    name="Confidence Threshold Auto-Escalation",
    description="Auto-escalates to HITL when agent confidence < threshold",
    enabled=True,
    category=GuidelineCategory.HITL_GATE,
    priority=850,
    condition=GuidelineCondition(
        events=["task_completion"],
        gate_types=["confidence_threshold"],
    ),
    action=GuidelineAction(
        type=ActionType.HITL_GATE,
        gate_type="confidence_threshold",
        gate_threshold="conditional",  # Only triggers when score < threshold
        instruction="Agent confidence below threshold. Review the task output and decide whether to continue, rollback, or steer.",
        parameters={"default_threshold": 90},
    ),
    ...
)
```

### 2. Intent Approval Gate (Gate 0)

A new mandatory HITL gate that triggers at Steps 1-2 of the workflow, after the planner creates artifacts but before any coding begins.

#### Gate Definition

Add to `.claude/rules/hitl-gates.md` as Gate 0:

```
### Gate 0: Intent & Requirements Approval

**Trigger:** Planner has completed work item artifacts (design.md, user_stories.md, tasks.md)

**Question Format:**
Summary of Action:
  Epic: [epic description]
  Design: [design.md summary]
  Stories: [N user stories with acceptance criteria]
  Tasks: [N atomic tasks, estimated total hours]

Artifacts for review:
  - .workitems/Pnn-Fnn-name/design.md
  - .workitems/Pnn-Fnn-name/user_stories.md
  - .workitems/Pnn-Fnn-name/tasks.md

Options:
 A) Approve - proceed to implementation
 B) Reject & Rollback - discard planning artifacts
 C) Steer - provide corrections to requirements/design

**Behavior:**
- Cannot proceed to Step 6 (Parallel Build) without approval
- Steer option allows human to provide updated requirements
- Rejection discards artifacts and returns to Step 1
```

#### Guardrail Guideline

```python
Guideline(
    id="hitl-gate-intent-approval",
    name="HITL Gate: Intent & Requirements Approval",
    description="Mandatory HITL gate before coding begins. Human approves PRD + design.",
    enabled=True,
    category=GuidelineCategory.HITL_GATE,
    priority=960,
    condition=GuidelineCondition(
        events=["planning_complete"],
        gate_types=["intent_approval"],
    ),
    action=GuidelineAction(
        type=ActionType.HITL_GATE,
        gate_type="intent_approval",
        gate_threshold="mandatory",
        instruction="Before implementation, present Summary of Action briefing. "
                    "Human must approve design.md, user_stories.md, and tasks.md. "
                    "Options: Approve / Reject & Rollback / Steer.",
    ),
    ...
)
```

### 3. Steer Option

Extends HITL gate decisions from binary (approve/reject) to ternary (approve/reject/steer).

#### GateDecision Model Extension

Update `GateDecision` in `src/core/guardrails/models.py`:

```python
@dataclass(frozen=True)
class GateDecision:
    guideline_id: str
    gate_type: str
    result: str                   # "approved", "rejected", "steered"  <-- add "steered"
    reason: str = ""
    user_response: str = ""
    steer_instructions: str = ""  # NEW: corrected instructions when result="steered"
    affected_artifacts: tuple[str, ...] = ()  # NEW: which spec files to update
    context: TaskContext | None = None
```

#### API Contract Changes

Update `hitl_api.json` contract:

```json
{
  "GateStatus": {
    "enum": ["pending", "approved", "rejected", "steered", "expired"]
  },
  "GateType": {
    "enum": [
      "prd_review", "design_review", "code_review", "test_review",
      "deployment_approval",
      "intent_approval",           // NEW
      "confidence_threshold",      // NEW
      "constraint_exception"       // NEW
    ]
  },
  "GateDecision": {
    "properties": {
      "decision": {
        "enum": ["approve", "reject", "steer"]  // "steer" is NEW
      },
      "steer_instructions": {"type": ["string", "null"]},
      "affected_artifacts": {
        "type": "array",
        "items": {"type": "string"}
      }
    }
  }
}
```

#### Steer Workflow

When a human chooses "Steer":

1. Human provides corrected instructions via `steer_instructions` field
2. Human optionally specifies which artifacts to update via `affected_artifacts`
3. Decision logged to audit trail with `result: "steered"`
4. PM CLI receives the steer decision
5. PM CLI applies corrections:
   - If `affected_artifacts` specified, passes instructions to the planner agent to update those files
   - Otherwise, re-triggers the current workflow step with the corrected instructions as additional context
6. Workflow resumes from the corrected point

### 4. Constraint Exception Gate

A new advisory HITL gate for when agents identify tasks that cannot be completed within spec/budget constraints.

#### Gate Definition

```
### Gate 8: Constraint Exception

**Trigger:** Agent identifies task cannot be completed within spec or budget constraints

**Question Format:**
Constraint violation detected:
  Task: [task description]
  Constraint: [what constraint is violated]
  Required change: [what would need to change]

Options:
 A) Expand constraint (allow more time/resources/scope)
 B) Reduce scope (simplify to fit constraint)
 C) Abort task

**Behavior:**
- Agent pauses and reports the constraint violation
- Human decides how to proceed
- Decision logged to audit trail
```

#### Guardrail Guideline

```python
Guideline(
    id="hitl-gate-constraint-exception",
    name="HITL Gate: Constraint Exception",
    description="Advisory HITL gate when a task cannot be completed within constraints.",
    enabled=True,
    category=GuidelineCategory.HITL_GATE,
    priority=800,
    condition=GuidelineCondition(
        events=["constraint_violation"],
        gate_types=["constraint_exception"],
    ),
    action=GuidelineAction(
        type=ActionType.HITL_GATE,
        gate_type="constraint_exception",
        gate_threshold="advisory",
        instruction="Agent has identified a constraint violation. "
                    "Present the violation details and options to the human: "
                    "Expand constraint / Reduce scope / Abort.",
    ),
    ...
)
```

### 5. Summary of Action Briefing

All HITL gates gain a contextual briefing that provides a "Summary of Action" when the human enters the loop, as required by G11. This is implemented as a helper function that generates structured summaries.

#### Briefing Generator

New module `src/core/guardrails/briefing.py`:

```python
@dataclass(frozen=True)
class ActionBriefing:
    """Summary presented to human when entering HITL loop."""
    gate_type: str
    summary: str                    # One-line summary
    details: str                    # Multi-line details
    artifacts: tuple[str, ...]      # Relevant file paths
    agent: str                      # Which agent triggered
    confidence: int | None = None   # Agent confidence score if applicable
    constraint_info: str | None = None  # Constraint violation details if applicable
```

The briefing generator examines the gate context and produces structured output:

- For `intent_approval`: summarizes design.md, user_stories.md, tasks.md
- For `confidence_threshold`: includes confidence score, reasons, and task output
- For `constraint_exception`: includes constraint details and proposed changes
- For existing gates: backwards-compatible summary generation

## Interfaces

### Provided Interfaces

#### ConfidenceReport API (New)

```python
# POST /api/confidence
class ConfidenceReportRequest(BaseModel):
    task_id: str
    agent: str
    score: int = Field(ge=0, le=100)
    reasons: list[str] = []
    session_id: str | None = None

class ConfidenceReportResponse(BaseModel):
    id: str
    escalated: bool               # Whether HITL gate was triggered
    gate_id: str | None = None    # Gate request ID if escalated
```

#### Extended Gate Decision API (Updated)

```python
# POST /api/gates/{gate_id}/decide (updated)
class GateDecisionRequest(BaseModel):
    gate_id: str
    decision: str                 # "approve" | "reject" | "steer"
    decided_by: str
    reason: str | None = None
    feedback: str | None = None
    steer_instructions: str | None = None      # NEW
    affected_artifacts: list[str] | None = None # NEW
```

#### Extended Guardrails MCP (Updated)

```python
# guardrails_get_context - unchanged signature, but returns new gate types
# guardrails_log_decision - updated to accept "steered" as result and steer_instructions
# guardrails_report_confidence - NEW tool
```

### Required Interfaces

- `GuardrailsStore` -- Elasticsearch CRUD + audit (existing)
- `GuardrailsEvaluator` -- Condition matching (existing)
- `CoordinationClient` -- Redis messages for PM CLI notifications (existing)
- `GuardrailsConfig` -- Environment configuration (existing, extended)

## Architecture Decisions

### AD-1: Confidence Scoring is Agent-Side, Not Infrastructure-Side

Agents self-report confidence rather than having infrastructure measure it. This is because:
- Agents have context about task complexity and uncertainty
- No reliable external metric for "how confident an agent is"
- Self-reporting is lightweight and non-intrusive
- Aligns with G11 which specifies "agent reports confidence"

### AD-2: Steer Uses Text Instructions, Not Direct File Edits

When a human steers, they provide text instructions rather than directly editing spec files. This is because:
- Direct editing requires a full IDE in the HITL UI (too complex for this feature)
- Text instructions can be interpreted by the planner agent
- Future P12-F05 (Spec-Driven Architecture) will add richer editing
- Keeps the Steer option lightweight and usable in CLI mode too

### AD-3: Backward Compatibility with Existing Gates

All existing 7 HITL gates continue to work unchanged. The new response options (steer) are additive:
- Existing gates that only use approve/reject continue to work
- The `steer` option is available on all gates but optional
- Old API consumers that send only approve/reject are not broken
- New gate types (intent_approval, confidence_threshold, constraint_exception) are additions

### AD-4: Confidence Reports Stored in Guardrails Audit Index

Confidence reports are stored as audit entries in the `guardrails-audit` Elasticsearch index rather than a separate index. This keeps the audit trail unified and avoids index proliferation.

### AD-5: Briefing Generation is Server-Side

The Summary of Action briefing is generated server-side (in the orchestrator) rather than client-side. This ensures:
- Consistent briefing format across CLI and HITL UI
- Server has access to all artifacts and context
- Briefings can be audited and replayed

## File Structure

### New Files

```
src/
  core/
    guardrails/
      confidence.py               # ConfidenceReport model, ConfidenceConfig, scoring logic
      briefing.py                 # ActionBriefing model, BriefingGenerator
  orchestrator/
    routes/
      confidence_api.py           # POST /api/confidence endpoint
    api/
      models/
        confidence.py             # Pydantic request/response models for confidence API
        hitl_decisions.py         # Extended GateDecision models (steer support)

docker/
  hitl-ui/
    src/
      components/
        hitl/
          ConfidenceIndicator.tsx  # Confidence score badge/indicator
          SteerInput.tsx           # Steer instructions input field
          ActionBriefing.tsx       # Summary of Action display component
```

### Modified Files

```
src/
  core/
    guardrails/
      models.py                   # Add ConfidenceReport, extend GateDecision with steer fields
      evaluator.py                # Add confidence threshold evaluation logic
      config.py                   # Add ConfidenceConfig
  infrastructure/
    guardrails/
      guardrails_mcp.py           # Add guardrails_report_confidence tool
      guardrails_store.py         # Add confidence report storage method
      guardrails_mappings.py      # Update audit index mapping for confidence fields
  orchestrator/
    api/
      models/
        guardrails.py             # Add new gate types to enums, steer fields to models

contracts/
  versions/
    v1.1.0/
      hitl_api.json               # Updated contract with new gate types and steer option

scripts/
  bootstrap_guardrails.py         # Add 3 new default guidelines

.claude/
  rules/
    hitl-gates.md                 # Add Gate 0, Gate 8, steer option, confidence threshold
  hooks/
    guardrails-inject.py          # Update context detection for new events
    guardrails-enforce.py         # Handle steer decision forwarding

docker/
  hitl-ui/
    src/
      components/
        guardrails/
          GuidelineCard.tsx        # Show confidence-related guidelines differently
        hitl/
          GateReview.tsx           # Add Steer button + instructions input
```

## Error Handling

### Confidence Scoring Errors

| Error | Impact | Recovery |
|-------|--------|----------|
| Score out of range (0-100) | Validation error | Return 400 with field error |
| Agent not recognized | Audit warning | Log warning, still store report |
| ES unavailable for storage | Report lost | Log error, do not block agent |
| Threshold config missing | Default to 90 | Use default, log warning |

### Steer Decision Errors

| Error | Impact | Recovery |
|-------|--------|----------|
| Empty steer_instructions | Cannot steer | Return 400, require non-empty |
| Invalid affected_artifacts paths | Cannot update specs | Return 400 with path validation |
| Steer on non-steerable gate | Unsupported | Treat as approve with feedback |
| Planner fails to apply steer | Instructions lost | Re-present gate with original + steer context |

## Performance Considerations

- Confidence scoring adds minimal overhead: one ES write per task completion (~2-5ms)
- Briefing generation is on-demand, not precomputed: triggered only when HITL gate fires
- New guidelines add to the evaluator cache but are filtered by condition matching
- No new polling or background processes introduced

## Security Considerations

- Confidence scores are agent-reported and should not be trusted as security controls
- Steer instructions are user-provided and must be sanitized before use in prompts
- All decisions (including steered) are logged to the audit trail
- New gate types follow existing RBAC patterns

## Rollback Plan

All changes are additive. If issues arise:
1. Disable new guidelines via HITL UI or API toggle
2. Existing 7 gates continue to function unchanged
3. New API endpoints can be removed without affecting existing endpoints
4. Contract v1.1.0 is a new version; v1.0.0 remains available

## Success Criteria

1. Agent confidence reports are stored and queryable via audit log
2. Confidence below threshold auto-triggers HITL gate with briefing
3. Intent Approval gate blocks Step 6 until human approves planning artifacts
4. All HITL gates accept "steer" as a decision option
5. Steer instructions are passed back to PM CLI for workflow adjustment
6. Constraint Exception gate fires when agent reports constraint violation
7. Summary of Action briefing presented at every HITL gate entry
8. All new gates registered as guardrails guidelines via bootstrap
9. HITL UI displays confidence scores and steer input
10. Backward compatibility: all existing 7 gates work unchanged
11. All decisions logged to audit trail with full context
