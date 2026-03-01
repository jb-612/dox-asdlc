---
id: P15-F11
parent_id: P15
type: user_stories
version: 1
status: draft
created_by: planner
created_at: "2026-02-26T00:00:00Z"
updated_at: "2026-02-26T00:00:00Z"
---

# User Stories: New Block Types (P15-F11)

## US-01: Dev Block in Studio

**As a** workflow author,
**I want to** add Dev blocks to my workflow in the Studio,
**So that** I can define TDD implementation steps with guided system prompts.

### Acceptance Criteria

- [ ] Dev block appears in BlockPalette with "Dev" label and code bracket icon
- [ ] Dragging Dev block onto canvas creates node with TDD-oriented system prompt prefix
- [ ] Output checklist pre-populated with TDD deliverables (tests, implementation, lint)
- [ ] User can customize system prompt prefix and checklist in BlockConfigPanel

## US-02: Test Block in Studio

**As a** workflow author,
**I want to** add Test blocks to my workflow,
**So that** I can define dedicated testing steps with QA-focused guidance.

### Acceptance Criteria

- [ ] Test block appears in BlockPalette with "Test" label and beaker icon
- [ ] Default system prompt guides agent as QA engineer
- [ ] Output checklist includes coverage targets and test categories
- [ ] Test block deliverables show pass/fail/skip counters in execution view

## US-03: Review Block in Studio

**As a** workflow author,
**I want to** add Review blocks to my workflow,
**So that** I can include code review steps with structured findings output.

### Acceptance Criteria

- [ ] Review block appears in BlockPalette with "Review" label and eye icon
- [ ] Default system prompt guides agent as senior code reviewer
- [ ] Output checklist includes security, quality, performance, coverage categories
- [ ] Review block deliverables show approved/rejected badge and expandable findings list

## US-04: DevOps Block in Studio

**As a** workflow author,
**I want to** add DevOps blocks to my workflow,
**So that** I can include infrastructure generation steps.

### Acceptance Criteria

- [ ] DevOps block appears in BlockPalette with "DevOps" label and rocket icon
- [ ] Default system prompt guides agent as DevOps engineer
- [ ] Output checklist includes Docker, K8s, CI/CD, monitoring deliverables
- [ ] DevOps block deliverables show status badge and operations list
