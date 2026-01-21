# P05-F04: Tasks

## Progress
- **Status**: NOT_STARTED
- **Completed**: 0/14
- **Progress**: 0%

---

## Task List

### T01: Define feedback data models
- **Story**: US-01
- **Estimate**: 1 hour
- **Dependencies**: None
- **Status**: [ ] Not Started

Create data models in `src/feedback/models.py`:
- `HITLFeedback`: Captures decision, corrections, comments, tags, duration
- `FeedbackClassification`: Enum of classification types
- `EvaluatorDecision`: Classification result with confidence and rationale
- `RuleProposal`: Proposed rule with evidence and insertion point
- `ActiveRule`: Deployed rule with effectiveness metrics

---

### T02: Implement FeedbackService core
- **Story**: US-01
- **Estimate**: 2 hours
- **Dependencies**: T01
- **Status**: [ ] Not Started

Implement `src/feedback/service.py`:
- `record_feedback()`: Persist feedback to Git
- `get_feedback()`: Retrieve by ID
- `list_feedback()`: List with filters (date range, agent, gate)
- File storage: `/feedback/decisions/<gate_id>/<decision_id>.yaml`

---

### T03: Implement feedback similarity detection
- **Story**: US-02
- **Estimate**: 2 hours
- **Dependencies**: T02, P01-F03 (KnowledgeStore)
- **Status**: [ ] Not Started

Implement `src/feedback/similarity.py`:
- Embed feedback text using KnowledgeStore
- `find_similar()`: Query for embeddings above threshold
- `cluster_feedback()`: Group similar feedback for pattern detection
- Index feedback on record for future queries

---

### T04: Implement Evaluator Agent classification logic
- **Story**: US-02
- **Estimate**: 3 hours
- **Dependencies**: T03
- **Status**: [ ] Not Started

Implement `src/feedback/evaluator_agent.py`:
- `evaluate()`: Main classification method
- Classification rules:
  - 3+ similar → GENERALIZABLE_HIGH
  - 2 reviewers agree → GENERALIZABLE_HIGH
  - 1-2 similar → GENERALIZABLE_LOW
  - Contradicts prior → AMBIGUOUS
  - Single occurrence → EDGE_CASE
  - Approval no changes → POSITIVE
- Return confidence score based on pattern strength

---

### T05: Implement rule proposal generation
- **Story**: US-03
- **Estimate**: 2 hours
- **Dependencies**: T04
- **Status**: [ ] Not Started

Extend `src/feedback/evaluator_agent.py`:
- `generate_rule_proposal()`: Create proposal from feedback cluster
- Extract common pattern from corrections
- Determine affected agents from feedback metadata
- Generate rule content as markdown
- Specify insertion point in agent prompt

---

### T06: Implement rule conflict detection
- **Story**: US-03
- **Estimate**: 1.5 hours
- **Dependencies**: T05
- **Status**: [ ] Not Started

Extend `src/feedback/evaluator_agent.py`:
- `check_rule_conflicts()`: Compare proposed rule against active rules
- Semantic similarity check for conflicting guidance
- Return ConflictReport with conflicting rule IDs and explanation

---

### T07: Implement RuleManager service
- **Story**: US-04
- **Estimate**: 2 hours
- **Dependencies**: T01
- **Status**: [ ] Not Started

Implement `src/feedback/rule_manager.py`:
- `propose_rule()`: Store in `/feedback/rules/proposed/`
- `get_pending_rules()`: List proposals awaiting approval
- `approve_rule()`: Move to `/feedback/rules/active/`
- `reject_rule()`: Move to `/feedback/rules/rejected/` with reason
- `get_active_rules()`: List active rules, optionally by agent

---

### T08: Implement rule injection into agent prompts
- **Story**: US-05
- **Estimate**: 1.5 hours
- **Dependencies**: T07
- **Status**: [ ] Not Started

Extend agent prompt building:
- Create `build_agent_prompt()` utility
- Retrieve active rules for agent
- Format as "Learned Rules" section
- Inject after base prompt, before task context
- Enforce 20-rule maximum per agent

---

### T09: Implement edge case documentation
- **Story**: US-07
- **Estimate**: 1 hour
- **Dependencies**: T04
- **Status**: [ ] Not Started

Extend `src/feedback/service.py`:
- `document_edge_case()`: Store in `/feedback/edge_cases/`
- Include: description, classification rationale, resolution
- Index in KnowledgeStore for searchability

---

### T10: Implement ambiguous feedback handling
- **Story**: US-08
- **Estimate**: 1.5 hours
- **Dependencies**: T04, T09
- **Status**: [ ] Not Started

Extend `src/feedback/service.py`:
- `flag_ambiguous()`: Create admin notification
- `resolve_ambiguous()`: Admin resolution with rationale
- If resolved as GENERALIZABLE, trigger rule proposal

---

### T11: Implement rule effectiveness tracking
- **Story**: US-06
- **Estimate**: 2 hours
- **Dependencies**: T07, T02
- **Status**: [ ] Not Started

Extend `src/feedback/rule_manager.py`:
- Track correction rate before/after rule deployment
- Calculate effectiveness after 7-day stabilization period
- Flag rules with no improvement after 30 days
- Store metrics in rule record

---

### T12: Add feedback capture to HITL UI
- **Story**: US-01
- **Estimate**: 2 hours
- **Dependencies**: T02, P05-F01 (HITL UI)
- **Status**: [ ] Not Started

Extend HITL UI (from P05-F01):
- Add feedback form to decision modal
- Capture: decision type, comment, tags
- For "Approve with Changes", capture diff
- Record review duration automatically
- Submit to FeedbackService

---

### T13: Add meta-HITL UI for rule review
- **Story**: US-04
- **Estimate**: 2 hours
- **Dependencies**: T07, P05-F01 (HITL UI)
- **Status**: [ ] Not Started

Extend HITL UI:
- New "Rule Proposals" section for admins
- Display: rule content, evidence, affected agents, confidence
- Actions: Approve, Reject (with reason), Modify
- Show conflict warnings if present

---

### T14: Integration and E2E tests
- **Story**: All
- **Estimate**: 3 hours
- **Dependencies**: T01-T13
- **Status**: [ ] Not Started

Create test suites:
- `tests/unit/test_feedback_service.py`
- `tests/unit/test_evaluator_agent.py`
- `tests/unit/test_rule_manager.py`
- `tests/integration/test_feedback_pipeline.py`
- `tests/e2e/test_feedback_learning_loop.py`

E2E scenario: 
1. Submit 3 similar corrections at HITL gate
2. Verify Evaluator classifies as GENERALIZABLE_HIGH
3. Verify rule proposal is generated
4. Approve rule via meta-HITL
5. Verify rule appears in agent prompt

---

## Completion Checklist
- [ ] All tasks completed
- [ ] Unit tests passing with ≥80% coverage
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Linter passing
- [ ] Interfaces match design.md
- [ ] Documentation updated
