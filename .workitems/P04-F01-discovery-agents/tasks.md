# P04-F01: Discovery Agents - Task Breakdown

## Overview

| Metric | Value |
|--------|-------|
| Total Tasks | 12 |
| Estimated Hours | ~16h |
| Dependencies | P03-F01, P03-F03, P02-F03 |
| Target Files | `src/workers/agents/discovery/` |

---

## Tasks

### T01: Discovery Configuration
**File:** `src/workers/agents/discovery/config.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create configuration dataclass for discovery agents with:
- LLM model selection (default: claude-sonnet-4-20250514)
- Token limits and temperature settings
- Artifact output path configuration
- RLM integration toggle
- Retry policy settings

**Acceptance Criteria:**
- [ ] `DiscoveryConfig` dataclass with sensible defaults
- [ ] Environment variable overrides supported
- [ ] Configuration validation on instantiation
- [ ] Unit tests for config loading

**Test:** `tests/unit/workers/agents/discovery/test_config.py`

---

### T02: Discovery Models
**File:** `src/workers/agents/discovery/models.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Define domain models for discovery artifacts:
- `Requirement` with id, description, priority, type
- `PRDSection` with title, content, requirements list
- `PRDDocument` with full PRD structure
- `AcceptanceCriterion` with Given-When-Then format
- `AcceptanceCriteria` with coverage matrix

**Acceptance Criteria:**
- [ ] All models are Pydantic BaseModel or dataclass
- [ ] JSON serialization/deserialization works
- [ ] Validation rules enforce required fields
- [ ] Unit tests for model validation

**Test:** `tests/unit/workers/agents/discovery/test_models.py`

---

### T03: PRD Agent Implementation
**File:** `src/workers/agents/discovery/prd_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement PRD Agent following DomainAgent protocol:
- Implement `execute()` method
- Parse user input and extract requirements
- Generate structured PRD sections
- Write PRD artifact via ArtifactWriter
- Handle LLM errors with retries

**Acceptance Criteria:**
- [ ] Inherits from/implements DomainAgent protocol
- [ ] `agent_type` property returns "prd_agent"
- [ ] Produces valid PRDDocument from raw input
- [ ] Writes artifact to configured path
- [ ] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/discovery/test_prd_agent.py`

---

### T04: PRD Prompt Engineering
**File:** `src/workers/agents/discovery/prompts/prd_prompts.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Create prompt templates for PRD generation:
- System prompt establishing PRD expert role
- Requirements extraction prompt
- PRD generation prompt with section structure
- Ambiguity detection prompt for RLM triggers

**Acceptance Criteria:**
- [ ] Prompts use structured output format hints
- [ ] Examples included for few-shot learning
- [ ] Prompts are parameterized (not hardcoded values)
- [ ] Unit tests verify prompt formatting

**Test:** `tests/unit/workers/agents/discovery/prompts/test_prd_prompts.py`

---

### T05: Acceptance Agent Implementation
**File:** `src/workers/agents/discovery/acceptance_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement Acceptance Agent:
- Parse PRD document from context
- Generate Given-When-Then criteria for each requirement
- Build coverage matrix
- Write acceptance criteria artifact

**Acceptance Criteria:**
- [ ] Implements DomainAgent protocol
- [ ] `agent_type` property returns "acceptance_agent"
- [ ] Produces valid AcceptanceCriteria from PRD
- [ ] Coverage matrix maps requirements to criteria
- [ ] Unit tests with mocked LLM

**Test:** `tests/unit/workers/agents/discovery/test_acceptance_agent.py`

---

### T06: Acceptance Prompt Engineering
**File:** `src/workers/agents/discovery/prompts/acceptance_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompt templates for acceptance criteria generation:
- System prompt for QA/testing perspective
- Criteria generation prompt with GWT format
- Coverage analysis prompt

**Acceptance Criteria:**
- [ ] Prompts enforce Given-When-Then structure
- [ ] Examples demonstrate expected output
- [ ] Prompts are parameterized
- [ ] Unit tests verify prompt formatting

**Test:** `tests/unit/workers/agents/discovery/prompts/test_acceptance_prompts.py`

---

### T07: Discovery Coordinator
**File:** `src/workers/agents/discovery/coordinator.py`
**Estimate:** 1.5h
**Dependencies:** T03, T05

**Description:**
Implement workflow coordination:
- Sequence PRD Agent → Acceptance Agent
- Handle partial failures and retries
- Aggregate results from both agents
- Report overall discovery status

**Acceptance Criteria:**
- [ ] Correct agent execution sequence
- [ ] Failure in PRD Agent prevents Acceptance Agent
- [ ] Retry logic for transient failures
- [ ] Returns DiscoveryResult with status
- [ ] Unit tests for coordination logic

**Test:** `tests/unit/workers/agents/discovery/test_coordinator.py`

---

### T08: Evidence Bundle Preparation
**File:** `src/workers/agents/discovery/coordinator.py`
**Estimate:** 1h
**Dependencies:** T07, P02-F03

**Description:**
Add evidence bundle creation to coordinator:
- Package PRD and acceptance criteria
- Include coverage matrix
- Attach source requirements
- Submit to HITL-1 gate via HITLDispatcher

**Acceptance Criteria:**
- [ ] EvidenceBundle contains all required artifacts
- [ ] Bundle submitted to correct HITL gate
- [ ] Rejection feedback captured and returned
- [ ] Unit tests for bundle creation

**Test:** `tests/unit/workers/agents/discovery/test_coordinator.py`

---

### T09: RLM Trigger for Discovery
**File:** `src/workers/agents/discovery/prd_agent.py`
**Estimate:** 1h
**Dependencies:** T03, P03-F03

**Description:**
Integrate RLM exploration into PRD Agent:
- Define trigger conditions (ambiguous requirements, unknown tech)
- Call RLMIntegration when triggered
- Incorporate exploration results into PRD
- Record RLM usage in audit trail

**Acceptance Criteria:**
- [ ] RLM triggered for defined conditions
- [ ] Exploration results enhance PRD content
- [ ] Graceful fallback if RLM unavailable
- [ ] Unit tests for RLM integration

**Test:** `tests/unit/workers/agents/discovery/test_prd_agent.py`

---

### T10: Agent Registration
**File:** `src/workers/agents/discovery/__init__.py`
**Estimate:** 30min
**Dependencies:** T03, T05

**Description:**
Register discovery agents with the dispatcher:
- Export PRDAgent and AcceptanceAgent
- Register agent types with metadata
- Ensure discoverability via registry

**Acceptance Criteria:**
- [ ] Agents importable from package
- [ ] Agent types registered correctly
- [ ] Metadata includes capabilities
- [ ] Unit test for registration

**Test:** `tests/unit/workers/agents/discovery/test_init.py`

---

### T11: Integration Tests
**File:** `tests/integration/workers/agents/discovery/`
**Estimate:** 2h
**Dependencies:** T01-T10

**Description:**
Create integration tests for discovery agents:
- Test PRD Agent with real LLM (mocked responses)
- Test Acceptance Agent with real LLM (mocked responses)
- Test coordinator flow end-to-end
- Test HITL submission (mocked dispatcher)

**Acceptance Criteria:**
- [ ] PRD generation integration test passes
- [ ] Acceptance criteria integration test passes
- [ ] Full discovery flow integration test passes
- [ ] Tests use pytest fixtures for setup

**Test:** `tests/integration/workers/agents/discovery/`

---

### T12: E2E Validation
**File:** `tests/e2e/test_discovery_workflow.py`
**Estimate:** 1h
**Dependencies:** T11

**Description:**
Create E2E test for complete discovery workflow:
- Start with raw user requirements
- Verify PRD artifact created
- Verify acceptance criteria artifact created
- Verify HITL-1 gate triggered
- Validate artifact content structure

**Acceptance Criteria:**
- [ ] E2E test runs in containerized environment
- [ ] All artifacts verified
- [ ] HITL gate interaction validated
- [ ] Test is idempotent and repeatable

**Test:** `tests/e2e/test_discovery_workflow.py`

---

## Progress

- Started: TBD
- Tasks Complete: 0/12
- Percentage: 0%
- Status: PENDING
- Blockers: None

---

## Task Dependencies Graph

```
T01 (Config) ─────┬──► T03 (PRD Agent) ──► T09 (RLM Trigger)
                  │         │
T02 (Models) ─────┼─────────┤
                  │         │
T04 (PRD Prompts) ┘         ▼
                       T07 (Coordinator) ──► T08 (Evidence)
T06 (Accept Prompts) ──► T05 (Accept Agent) ──┘
                              │
                              ▼
                       T10 (Registration)
                              │
                              ▼
                       T11 (Integration) ──► T12 (E2E)
```
