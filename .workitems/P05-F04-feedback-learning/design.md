# P05-F04: Adaptive Feedback Learning System

## Overview

Implement the Evaluator Agent and feedback learning loop that captures HITL feedback, classifies it as generalizable or edge case, and proposes system improvements (rules, prompt refinements) that require meta-HITL approval before deployment.

## Dependencies

### Internal Dependencies
- **P05-F01**: HITL Web UI (feedback capture interface)
- **P02-F03**: HITL Dispatcher (feedback events)
- **P02-F01**: Redis event streams (feedback stream)
- **P01-F03**: KnowledgeStore (feedback pattern search)

### External Dependencies
- None (uses existing infrastructure)

## Interfaces

### Consumes

**HITL Decision Events** (from `asdlc:events:hitl_decisions`)
```python
@dataclass
class HITLDecisionEvent:
    decision_id: str
    gate_id: str                    # HITL-1, HITL-2, etc.
    epic_id: str
    task_id: str | None
    decision: Literal["APPROVED", "REJECTED", "APPROVED_WITH_CHANGES"]
    reviewer_id: str
    timestamp: datetime
    review_duration_seconds: int
    agent_output_sha: str
    approved_output_sha: str | None  # None if rejected
    correction_diff_path: str | None
    reviewer_comment: str | None
    tags: list[str]
```

### Provides

**Feedback Service Interface**
```python
class FeedbackService(Protocol):
    async def record_feedback(self, feedback: HITLFeedback) -> str:
        """Store feedback and return feedback_id."""
        ...
    
    async def get_feedback(self, feedback_id: str) -> HITLFeedback | None:
        """Retrieve feedback by ID."""
        ...
    
    async def find_similar(self, feedback: HITLFeedback, threshold: float = 0.8) -> list[HITLFeedback]:
        """Find semantically similar feedback records."""
        ...
    
    async def get_feedback_for_agent(self, agent_name: str, limit: int = 100) -> list[HITLFeedback]:
        """Get recent feedback affecting a specific agent."""
        ...
```

**Evaluator Agent Interface**
```python
class EvaluatorAgent(Protocol):
    async def evaluate(self, feedback: HITLFeedback) -> EvaluatorDecision:
        """Classify feedback and propose action."""
        ...
    
    async def generate_rule_proposal(self, feedback_cluster: list[HITLFeedback]) -> RuleProposal:
        """Generate rule proposal from clustered feedback."""
        ...
    
    async def check_rule_conflicts(self, proposed_rule: RuleProposal) -> list[ConflictReport]:
        """Check if proposed rule conflicts with existing rules."""
        ...

@dataclass
class EvaluatorDecision:
    feedback_id: str
    classification: FeedbackClassification
    confidence: float
    rationale: str
    similar_feedback_ids: list[str]
    proposed_action: ProposedAction | None

class FeedbackClassification(Enum):
    GENERALIZABLE_HIGH = "generalizable_high"
    GENERALIZABLE_LOW = "generalizable_low"
    EDGE_CASE = "edge_case"
    AMBIGUOUS = "ambiguous"
    POSITIVE = "positive"

@dataclass
class ProposedAction:
    action_type: Literal["CREATE_RULE", "REFINE_PROMPT", "UPDATE_SKILL", "DOCUMENT_ONLY"]
    target_agent: str | None
    proposal_id: str
```

**Rule Management Interface**
```python
class RuleManager(Protocol):
    async def propose_rule(self, proposal: RuleProposal) -> str:
        """Submit rule for meta-HITL review. Returns proposal_id."""
        ...
    
    async def get_pending_rules(self) -> list[RuleProposal]:
        """Get rules awaiting meta-HITL approval."""
        ...
    
    async def approve_rule(self, proposal_id: str, approver_id: str) -> None:
        """Approve and deploy rule."""
        ...
    
    async def reject_rule(self, proposal_id: str, rejector_id: str, reason: str) -> None:
        """Reject rule with documented reason."""
        ...
    
    async def get_active_rules(self, agent_name: str | None = None) -> list[ActiveRule]:
        """Get active rules, optionally filtered by agent."""
        ...

@dataclass
class RuleProposal:
    proposal_id: str
    created_from_feedback_ids: list[str]
    classification_confidence: float
    affected_agents: list[str]
    rule_type: Literal["NEGATIVE_EXAMPLE", "POSITIVE_EXAMPLE", "GUIDELINE", "CONSTRAINT"]
    rule_content: str
    insertion_point: str  # Where in agent prompt/skill to insert
    evidence_summary: str
    status: Literal["PENDING", "APPROVED", "REJECTED"]
    created_at: datetime
```

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Container 1: Governance                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Manager    │    │  Evaluator   │    │   Rule Manager       │  │
│  │   Agent      │───▶│  Agent       │───▶│   Service            │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                   │                      │                │
│         ▼                   ▼                      ▼                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Feedback Store (Git)                       │  │
│  │  /feedback/decisions/  /feedback/rules/  /feedback/edge_cases │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
         ▲                                              │
         │ HITL Decision Events                         │ Active Rules
         │                                              ▼
┌────────┴─────────┐                         ┌─────────────────────┐
│  HITL UI         │                         │  Agent Prompts      │
│  (P05-F01)       │                         │  (All Agents)       │
└──────────────────┘                         └─────────────────────┘
```

### Feedback Processing Pipeline

1. **Capture**: HITL UI records decision + corrections + comments
2. **Store**: Feedback Service persists to Git + indexes in KnowledgeStore
3. **Evaluate**: Evaluator Agent classifies and clusters
4. **Propose**: For generalizable patterns, generate rule proposal
5. **Review**: Meta-HITL gate for human approval
6. **Deploy**: Approved rules injected into agent prompts

### Similarity Detection

Use KnowledgeStore (ChromaDB) for semantic similarity:
- Embed feedback text (correction summary + reviewer comment)
- Query for similar embeddings above threshold (0.8)
- Cluster similar feedback for pattern detection

### Rule Injection

Approved rules are injected into agent prompts at startup:

```python
async def build_agent_prompt(agent_name: str, base_prompt: str) -> str:
    active_rules = await rule_manager.get_active_rules(agent_name)
    
    rules_section = format_rules_for_prompt(active_rules)
    
    return f"""{base_prompt}

## Learned Rules (from feedback)
{rules_section}
"""
```

## File Structure

```
src/
├── feedback/
│   ├── __init__.py
│   ├── models.py              # Feedback, EvaluatorDecision, RuleProposal
│   ├── service.py             # FeedbackService implementation
│   ├── evaluator_agent.py     # Evaluator Agent implementation
│   ├── rule_manager.py        # RuleManager implementation
│   └── similarity.py          # Similarity detection using KnowledgeStore
tests/
├── unit/
│   ├── test_feedback_service.py
│   ├── test_evaluator_agent.py
│   └── test_rule_manager.py
├── integration/
│   └── test_feedback_pipeline.py
└── e2e/
    └── test_feedback_learning_loop.py
```

## Open Questions

1. **Feedback granularity**: Should we capture line-level corrections or just overall diffs?
   - Recommendation: Overall diffs initially, line-level in future iteration

2. **Rule expiration**: Should rules have TTL or require periodic reconfirmation?
   - Recommendation: No TTL, but track effectiveness metrics; sunset if ineffective

3. **Batch vs real-time**: Should Evaluator run after each decision or in batches?
   - Recommendation: Hybrid — immediate classification, batched rule proposals

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rule proliferation | Agent prompts become unwieldy | Consolidate similar rules; max 20 rules per agent |
| Conflicting rules | Agent receives contradictory guidance | Conflict detection before proposal |
| Slow meta-HITL | Improvements delayed | Batch reviews; expedite high-confidence |
| Gaming/bias | Malicious rules injected | Require 2+ reviewer agreement |
