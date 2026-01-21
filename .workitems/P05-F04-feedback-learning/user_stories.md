# P05-F04: User Stories

## US-01: Capture Structured Feedback at HITL Gate

**As a** human reviewer at a HITL gate
**I want to** provide structured feedback when approving or rejecting agent output
**So that** my corrections can be used to improve the system

### Acceptance Criteria
- [ ] Reviewer can select decision: Approve, Reject, Approve with Changes
- [ ] Reviewer can add freeform comment explaining their decision
- [ ] For "Approve with Changes", system captures diff between agent output and approved version
- [ ] Reviewer can tag feedback with categories (quality, completeness, scope, style)
- [ ] System records review duration automatically
- [ ] Feedback is persisted to Git in `/feedback/decisions/`

### Test Scenarios
- Given a HITL gate review, when reviewer approves with changes, then diff is captured
- Given a rejection, when reviewer provides comment, then comment is stored with feedback
- Given a review session, when reviewer submits decision, then duration is recorded

---

## US-02: Classify Feedback as Generalizable or Edge Case

**As a** system administrator
**I want** the Evaluator Agent to classify feedback automatically
**So that** only valuable patterns trigger system improvements

### Acceptance Criteria
- [ ] Evaluator processes each new feedback record asynchronously
- [ ] Classification returns one of: GENERALIZABLE_HIGH, GENERALIZABLE_LOW, EDGE_CASE, AMBIGUOUS, POSITIVE
- [ ] Classification includes confidence score (0.0 - 1.0)
- [ ] Similar feedback (>0.8 similarity) is clustered together
- [ ] 3+ similar corrections → GENERALIZABLE_HIGH
- [ ] Contradicting prior approvals → AMBIGUOUS (flagged for human review)
- [ ] Single occurrence with no pattern → EDGE_CASE

### Test Scenarios
- Given 3 similar corrections from different reviewers, when evaluated, then classified as GENERALIZABLE_HIGH
- Given 1 correction with no similar history, when evaluated, then classified as EDGE_CASE
- Given correction that contradicts prior approval, when evaluated, then classified as AMBIGUOUS

---

## US-03: Generate Rule Proposals from Patterns

**As a** system administrator
**I want** the Evaluator to propose new rules when patterns are detected
**So that** agents can learn from repeated corrections

### Acceptance Criteria
- [ ] For GENERALIZABLE_HIGH feedback, Evaluator generates RuleProposal
- [ ] Proposal includes: rule content, affected agents, evidence (feedback IDs)
- [ ] Proposal specifies insertion point in agent prompt
- [ ] Evaluator checks for conflicts with existing rules before proposing
- [ ] Proposals are stored in `/feedback/rules/proposed/`
- [ ] Conflicting proposals are flagged with conflict report

### Test Scenarios
- Given a GENERALIZABLE_HIGH classification, when evaluated, then rule proposal is generated
- Given a proposed rule that conflicts with existing rule, when checked, then conflict is reported
- Given a rule proposal, then evidence summary includes all source feedback IDs

---

## US-04: Review and Approve Rule Proposals (Meta-HITL)

**As a** system administrator
**I want to** review proposed rules before they affect agent behavior
**So that** I maintain control over system evolution

### Acceptance Criteria
- [ ] Meta-HITL gate presents pending rule proposals
- [ ] Proposal view shows: rule content, evidence, affected agents, confidence
- [ ] Administrator can Approve, Reject, or Modify proposal
- [ ] Approved rules are moved to `/feedback/rules/active/`
- [ ] Rejected rules are moved to `/feedback/rules/rejected/` with reason
- [ ] Modified rules create new proposal version

### Test Scenarios
- Given a pending proposal, when admin approves, then rule moves to active
- Given a pending proposal, when admin rejects with reason, then stored in rejected with reason
- Given a pending proposal, when admin modifies, then new version is created

---

## US-05: Inject Active Rules into Agent Prompts

**As an** agentic system
**I want** approved rules automatically injected into my prompts
**So that** I benefit from learned improvements

### Acceptance Criteria
- [ ] Agent prompt builder retrieves active rules for agent
- [ ] Rules are formatted as "Learned Rules" section in prompt
- [ ] Rules are inserted after base prompt, before task context
- [ ] Maximum 20 rules per agent (oldest/lowest-impact rules aged out)
- [ ] Rule injection is logged for observability

### Test Scenarios
- Given 5 active rules for PRD Agent, when prompt is built, then all 5 rules included
- Given 25 active rules for an agent, when prompt is built, then only top 20 included
- Given no active rules for agent, when prompt is built, then no "Learned Rules" section

---

## US-06: Track Rule Effectiveness

**As a** system administrator
**I want to** see whether rules are actually reducing corrections
**So that** I can retire ineffective rules

### Acceptance Criteria
- [ ] For each active rule, track: correction rate before and after deployment
- [ ] Dashboard shows rule effectiveness metrics
- [ ] Rules with no improvement after 30 days are flagged for review
- [ ] Effectiveness calculation excludes first 7 days (stabilization period)

### Test Scenarios
- Given a rule deployed 30 days ago, when metrics are calculated, then before/after rates shown
- Given a rule with 0% improvement, when flagged, then appears in "ineffective rules" list
- Given a rule deployed 5 days ago, when metrics requested, then marked as "stabilizing"

---

## US-07: Document Edge Cases

**As a** system administrator
**I want** edge cases documented even if no rule is created
**So that** I have a record of unusual situations

### Acceptance Criteria
- [ ] EDGE_CASE feedback is stored in `/feedback/edge_cases/`
- [ ] Edge case record includes: description, why it's an edge case, resolution
- [ ] Edge cases are searchable for future reference
- [ ] Edge cases can be promoted to GENERALIZABLE if patterns emerge later

### Test Scenarios
- Given an EDGE_CASE classification, when stored, then saved to edge_cases directory
- Given an edge case, when similar feedback arrives later, then pattern is re-evaluated
- Given a stored edge case, when searched by keyword, then edge case is found

---

## US-08: Handle Ambiguous Feedback

**As a** system administrator
**I want** ambiguous feedback flagged for my review
**So that** I can provide the tiebreaker decision

### Acceptance Criteria
- [ ] AMBIGUOUS classification triggers notification to admin
- [ ] Admin can resolve as: GENERALIZABLE, EDGE_CASE, or IGNORE
- [ ] Resolution is logged with admin's rationale
- [ ] If resolved as GENERALIZABLE, rule proposal is generated

### Test Scenarios
- Given contradicting feedback, when classified as AMBIGUOUS, then admin is notified
- Given AMBIGUOUS feedback, when admin resolves as GENERALIZABLE, then rule is proposed
- Given AMBIGUOUS feedback, when admin resolves as IGNORE, then feedback is archived
