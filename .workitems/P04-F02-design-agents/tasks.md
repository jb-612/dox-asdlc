# P04-F02: Design Agents - Task Breakdown

## Overview

| Metric | Value |
|--------|-------|
| Total Tasks | 14 |
| Estimated Hours | ~20h |
| Dependencies | P03-F01, P03-F02, P03-F03, P02-F03, P04-F01 |
| Target Files | `src/workers/agents/design/` |

---

## Tasks

### T01: Design Configuration
**File:** `src/workers/agents/design/config.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create configuration dataclass for design agents:
- LLM model selection for each agent
- Extended token limits (16K for detailed designs)
- Lower temperature for technical precision
- RLM and context pack integration settings

**Acceptance Criteria:**
- [x] `DesignConfig` dataclass with defaults
- [x] Per-agent model configuration
- [x] Environment variable overrides
- [x] Unit tests for config

**Test:** `tests/unit/workers/agents/design/test_config.py`

---

### T02: Design Models
**File:** `src/workers/agents/design/models.py`
**Estimate:** 2h
**Dependencies:** None

**Description:**
Define domain models:
- `TechnologyChoice` with rationale
- `TechSurvey` with recommendations
- `Component` and `Interface` for architecture
- `Architecture` with diagrams
- `ImplementationTask` and `ImplementationPlan`

**Acceptance Criteria:**
- [x] All models with validation
- [x] JSON serialization works
- [x] Diagram references supported
- [x] Unit tests for models

**Test:** `tests/unit/workers/agents/design/test_models.py`

---

### T03: Surveyor Agent Implementation
**File:** `src/workers/agents/design/surveyor_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01, P03-F03

**Description:**
Implement RLM-enabled Surveyor Agent:
- Analyze PRD for technology needs
- Use RepoMapper context for existing patterns
- Trigger RLM for technology research
- Generate tech survey document

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] RLM integration for research
- [x] Context pack consumption
- [x] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/design/test_surveyor_agent.py`

---

### T04: Surveyor Prompt Engineering
**File:** `src/workers/agents/design/prompts/surveyor_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompts for technology survey:
- Technology analysis prompt
- Research synthesis prompt
- Recommendation generation prompt

**Acceptance Criteria:**
- [x] Prompts produce structured output
- [x] Examples for few-shot learning
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/design/prompts/test_surveyor_prompts.py`

---

### T05: Architect Agent Implementation
**File:** `src/workers/agents/design/architect_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement Solution Architect Agent:
- Consume tech survey and PRD
- Design component architecture
- Generate Mermaid diagrams
- Validate against NFRs

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] Generates Architecture model
- [x] Mermaid diagram generation
- [x] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/design/test_architect_agent.py`

---

### T06: Architect Prompt Engineering
**File:** `src/workers/agents/design/prompts/architect_prompts.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Create prompts for architecture design:
- Component design prompt
- Interface definition prompt
- Diagram generation prompt
- NFR validation prompt

**Acceptance Criteria:**
- [x] Prompts enforce architecture patterns
- [x] Mermaid syntax in output
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/design/prompts/test_architect_prompts.py`

---

### T07: Planner Agent Implementation
**File:** `src/workers/agents/design/planner_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement Planner Agent:
- Break architecture into tasks
- Identify dependencies
- Estimate complexity
- Calculate critical path

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] Task dependency graph
- [x] Complexity estimation
- [x] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/design/test_planner_agent.py`

---

### T08: Planner Prompt Engineering
**File:** `src/workers/agents/design/prompts/planner_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompts for implementation planning:
- Task breakdown prompt
- Dependency analysis prompt
- Complexity estimation prompt

**Acceptance Criteria:**
- [x] Tasks are atomic
- [x] Dependencies explicit
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/design/prompts/test_planner_prompts.py`

---

### T09: Design Coordinator
**File:** `src/workers/agents/design/coordinator.py`
**Estimate:** 1.5h
**Dependencies:** T03, T05, T07

**Description:**
Implement design workflow coordination:
- Sequence Surveyor → Architect → Planner
- Handle HITL gate interactions
- Aggregate results

**Acceptance Criteria:**
- [x] Correct agent sequence
- [x] HITL-2 after architect
- [x] HITL-3 after planner
- [x] Unit tests for coordination

**Test:** `tests/unit/workers/agents/design/test_coordinator.py`

---

### T10: HITL-2 Evidence Bundle
**File:** `src/workers/agents/design/coordinator.py`
**Estimate:** 1h
**Dependencies:** T09, P02-F03

**Description:**
Create HITL-2 evidence bundle:
- Package tech survey and architecture
- Include diagrams
- Submit to HITLDispatcher

**Acceptance Criteria:**
- [x] Complete evidence bundle
- [x] Submitted to HITL-2 gate
- [x] Rejection feedback captured
- [x] Unit tests for bundle

**Test:** `tests/unit/workers/agents/design/test_coordinator.py`

---

### T11: HITL-3 Evidence Bundle
**File:** `src/workers/agents/design/coordinator.py`
**Estimate:** 1h
**Dependencies:** T09, P02-F03

**Description:**
Create HITL-3 evidence bundle:
- Package implementation plan
- Include dependency graph
- Submit to HITLDispatcher

**Acceptance Criteria:**
- [x] Complete evidence bundle
- [x] Submitted to HITL-3 gate
- [x] Rejection feedback captured
- [x] Unit tests for bundle

**Test:** `tests/unit/workers/agents/design/test_coordinator.py`

---

### T12: Agent Registration
**File:** `src/workers/agents/design/__init__.py`
**Estimate:** 30min
**Dependencies:** T03, T05, T07

**Description:**
Register design agents:
- Export all three agents
- Register with dispatcher
- Include capability metadata

**Acceptance Criteria:**
- [x] Agents importable
- [x] Types registered
- [x] Unit test for registration

**Test:** `tests/unit/workers/agents/design/test_init.py`

---

### T13: Integration Tests
**File:** `tests/integration/workers/agents/design/`
**Estimate:** 2h
**Dependencies:** T01-T12

**Description:**
Create integration tests:
- Surveyor with RLM integration
- Architect with context pack
- Full design flow
- HITL interaction (mocked)

**Acceptance Criteria:**
- [x] All agents tested
- [x] Flow integration tested
- [x] Fixtures for setup

**Test:** `tests/integration/workers/agents/design/`

---

### T14: E2E Validation
**File:** `tests/e2e/test_design_workflow.py`
**Estimate:** 1.5h
**Dependencies:** T13

**Description:**
Create E2E test for design workflow:
- Start with PRD (from P04-F01)
- Verify all artifacts created
- Validate HITL-2 and HITL-3 triggered
- Test approval and rejection flows

**Acceptance Criteria:**
- [x] E2E test passes
- [x] All artifacts verified
- [x] HITL gates validated
- [x] Idempotent and repeatable

**Test:** `tests/e2e/test_design_workflow.py`

---

## Progress

- Started: 2026-01-23
- Tasks Complete: 14/14
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## Task Dependencies Graph

```
T01 (Config) ────┬──► T03 (Surveyor) ──┐
                 │                      │
T02 (Models) ────┼──► T05 (Architect) ─┼──► T09 (Coordinator) ──┬─► T10 (HITL-2)
                 │                      │          │             │
                 └──► T07 (Planner) ───┘          │             └─► T11 (HITL-3)
                                                   │
T04 (Surveyor Prompts) ────────────────────────────┤
T06 (Architect Prompts) ───────────────────────────┤
T08 (Planner Prompts) ─────────────────────────────┘
                                                   │
                                        T12 (Registration)
                                                   │
                                        T13 (Integration) ──► T14 (E2E)
```
