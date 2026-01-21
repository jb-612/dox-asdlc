# Feature Design: Adaptive Feedback Learning System

## Overview

When humans interact at HITL gates, their feedback (approvals, rejections, corrections, comments) represents valuable signal for improving the agentic system. This feature captures that feedback, evaluates its generalizability, and either creates new rules/guidelines or classifies it as an edge case not warranting system changes.

This implements **system-level reinforcement learning** — not model fine-tuning, but evolution of prompts, rules, and agent configurations based on observed human corrections.

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEEDBACK LEARNING LOOP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   HITL Gate          Feedback            Evaluator           System         │
│   ─────────          ────────            ─────────           ──────         │
│                                                                              │
│   Human reviews  ──► Capture decision ──► Analyze pattern ──► If general:   │
│   agent output       + corrections        + frequency         Update rules  │
│                      + comments           + severity          Update prompts│
│                      + time spent         + root cause        Update Skills │
│                                                                              │
│                                          If edge case: ──► Document only    │
│                                                            No system change │
│                                                                              │
│   ◄──────────────────────────────────────────────────────────────────────── │
│                     Improved agent behavior on next run                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Feedback Categories

### Category 1: Approval Signals
| Signal | Meaning | Action |
|--------|---------|--------|
| Approved, no changes | Agent output was correct | Positive reinforcement (log success pattern) |
| Approved with minor edits | Output acceptable but improvable | Capture edits for pattern analysis |
| Approved after discussion | Output needed clarification | Capture clarification for prompt improvement |

### Category 2: Rejection Signals
| Signal | Meaning | Action |
|--------|---------|--------|
| Rejected with correction | Clear error identified | High-value learning opportunity |
| Rejected, sent back | Needs rework | Capture rejection reason |
| Rejected, escalated | Beyond agent capability | Document capability gap |

### Category 3: Pattern Indicators
| Pattern | Classification | Investment Decision |
|---------|---------------|---------------------|
| Same correction 3+ times across tasks | **Generalizable** | Create new rule |
| Same correction by 2+ reviewers | **Generalizable** | High confidence rule |
| Correction on edge case input | **Edge case** | Document, no rule |
| Correction contradicts prior approval | **Ambiguous** | Flag for human review |

## Evaluator Agent Design

### Role
The Evaluator Agent operates asynchronously after HITL decisions. It does not block the main workflow but continuously processes feedback to improve system behavior.

### Inputs
- HITL decision records (approval/rejection + metadata)
- Human corrections (diffs between agent output and approved version)
- Reviewer comments and feedback text
- Time-to-decision metrics (long reviews may indicate confusion)
- Historical feedback for pattern matching

### Outputs
- **Rule Proposals**: New rules for agent prompts or Skills
- **Prompt Refinements**: Specific wording improvements
- **Edge Case Documentation**: Catalogued exceptions
- **Capability Gap Reports**: Areas where agents consistently fail

### Decision Logic

```python
class FeedbackClassification(Enum):
    GENERALIZABLE_HIGH = "generalizable_high"    # Create rule immediately
    GENERALIZABLE_LOW = "generalizable_low"      # Queue for batch review
    EDGE_CASE = "edge_case"                      # Document only
    AMBIGUOUS = "ambiguous"                      # Needs human tiebreaker
    POSITIVE = "positive"                        # Reinforcement signal

def classify_feedback(feedback: Feedback, history: FeedbackHistory) -> FeedbackClassification:
    # Check for recurring pattern
    similar_feedback = history.find_similar(feedback, threshold=0.8)
    
    if len(similar_feedback) >= 3:
        return FeedbackClassification.GENERALIZABLE_HIGH
    
    if len(similar_feedback) >= 1:
        # Check if different reviewers
        reviewers = {f.reviewer_id for f in similar_feedback}
        if len(reviewers) >= 2:
            return FeedbackClassification.GENERALIZABLE_HIGH
        return FeedbackClassification.GENERALIZABLE_LOW
    
    # Check for contradiction with prior approvals
    if history.has_contradicting_approval(feedback):
        return FeedbackClassification.AMBIGUOUS
    
    # Single occurrence, likely edge case
    if feedback.is_rejection:
        return FeedbackClassification.EDGE_CASE
    
    return FeedbackClassification.POSITIVE
```

## Rule Generation

When feedback is classified as generalizable, the Evaluator proposes a rule:

### Rule Proposal Structure

```yaml
rule_id: RULE-2026-0142
created_from: 
  - feedback_ids: [FB-101, FB-107, FB-112]
  - pattern: "Agent includes implementation details in PRD"
  
classification: GENERALIZABLE_HIGH
confidence: 0.89

affected_agents:
  - PRD Agent
  
proposed_rule:
  type: negative_example
  content: |
    DO NOT include implementation details (specific technologies, 
    database schemas, API endpoints) in product requirements.
    Keep PRD focused on WHAT and WHY, not HOW.
    
  insertion_point: "PRD Agent system prompt, section: Output Guidelines"

evidence:
  - "Reviewer removed PostgreSQL schema from PRD (FB-101)"
  - "Reviewer deleted API endpoint list from requirements (FB-107)"
  - "Comment: 'PRD should not dictate technical choices' (FB-112)"

status: PENDING_APPROVAL
requires_hitl: true  # Meta-HITL: human approves system changes
```

### Meta-HITL Gate

Rule proposals require human approval before deployment. This is a **meta-HITL gate** — humans review changes to the system itself:

```
┌─────────────────────────────────────────────────────────────┐
│  RULE PROPOSAL REVIEW (Meta-HITL)                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Proposed Rule: RULE-2026-0142                              │
│  Confidence: 89%                                             │
│  Evidence: 3 similar corrections from 2 reviewers           │
│                                                              │
│  Will affect: PRD Agent                                      │
│                                                              │
│  [View Diff]  [View Evidence]  [Simulate Impact]            │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐                │
│  │ Approve │  │ Reject  │  │ Modify First │                │
│  └─────────┘  └─────────┘  └──────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Edge Case Handling

Edge cases are documented but do not trigger system changes:

```yaml
edge_case_id: EDGE-2026-0089
feedback_id: FB-115

description: |
  Reviewer requested agent use imperial units instead of metric.
  This contradicts project standards (metric preferred).
  
classification: EDGE_CASE
reason: "Contradicts established convention; single occurrence"

resolution: |
  Documented as reviewer preference, not system defect.
  No rule change. Project standard remains metric-first.
  
  If user needs imperial, they should specify in epic requirements.

archived: true
```

## Data Model

### Feedback Record (Git artifact)

```
/feedback/
├── decisions/
│   └── <gate_id>/
│       └── <decision_id>.yaml     # Individual HITL decisions
├── corrections/
│   └── <task_id>/
│       └── correction.diff        # Diff between agent output and approved
├── rules/
│   ├── proposed/
│   │   └── RULE-<id>.yaml        # Pending approval
│   ├── active/
│   │   └── RULE-<id>.yaml        # Deployed rules
│   └── rejected/
│       └── RULE-<id>.yaml        # Rejected proposals with rationale
└── edge_cases/
    └── EDGE-<id>.yaml            # Documented exceptions
```

### Feedback Schema

```yaml
feedback_id: FB-101
gate_id: HITL-2
epic_id: EPIC-042
task_id: TASK-042-003
timestamp: 2026-01-21T14:32:00Z

decision: APPROVED_WITH_CHANGES
reviewer_id: reviewer@example.com
review_duration_seconds: 847  # ~14 minutes, longer than average

agent: PRD Agent
agent_output_sha: abc123
approved_output_sha: def456

correction_summary: |
  Removed technical implementation details from PRD.
  Kept business requirements and acceptance criteria.

correction_diff_path: /feedback/corrections/TASK-042-003/correction.diff

reviewer_comment: |
  PRD should focus on what we're building and why, not how.
  Implementation details belong in architecture.md.

tags:
  - scope-creep
  - prd-guidelines
```

## Integration Points

### With HITL UI
- Capture structured feedback at decision time
- Prompt for correction summary on rejections
- Track time-to-decision as quality signal

### With Manager Agent
- Subscribe to feedback events
- Trigger Evaluator after each HITL decision

### With Agent Prompts
- Active rules injected into system prompts
- Skills updated with learned patterns

### With Observability
- Feedback metrics in telemetry
- Rule effectiveness tracking (did correction rate decrease?)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Correction rate decrease | -20% per quarter | Same error type should decline after rule |
| Rule acceptance rate | >70% | Proposed rules approved by meta-HITL |
| Time to rule deployment | <48 hours | From pattern detection to active rule |
| Edge case ratio | <30% | Most feedback should be generalizable |

## Dependencies

- HITL UI must capture structured feedback (P05-F01)
- Feedback storage in Git (extends existing artifact model)
- Evaluator Agent (new agent in Governance cluster)

## Risks

**Risk 1: Rule proliferation**
Too many rules make agent prompts unwieldy.
Mitigation: Consolidate similar rules; sunset rules with low impact.

**Risk 2: Contradictory rules**
New rules may conflict with existing ones.
Mitigation: Evaluator checks for contradictions before proposing.

**Risk 3: Gaming the system**
Reviewers could inject biased feedback.
Mitigation: Require multiple reviewers for high-confidence classification.

**Risk 4: Slow feedback loop**
If meta-HITL is slow, improvements are delayed.
Mitigation: Batch rule reviews; expedite high-confidence proposals.
