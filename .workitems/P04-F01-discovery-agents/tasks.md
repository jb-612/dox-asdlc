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
- [x] `DiscoveryConfig` dataclass with sensible defaults
- [x] Environment variable overrides supported
- [x] Configuration validation on instantiation
- [x] Unit tests for config loading

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
- [x] All models are Pydantic BaseModel or dataclass
- [x] JSON serialization/deserialization works
- [x] Validation rules enforce required fields
- [x] Unit tests for model validation

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
- [x] Inherits from/implements DomainAgent protocol
- [x] `agent_type` property returns "prd_agent"
- [x] Produces valid PRDDocument from raw input
- [x] Writes artifact to configured path
- [x] Unit tests with mocked LLM

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
- [x] Prompts use structured output format hints
- [x] Examples included for few-shot learning
- [x] Prompts are parameterized (not hardcoded values)
- [x] Unit tests verify prompt formatting

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
- [x] Implements DomainAgent protocol
- [x] `agent_type` property returns "acceptance_agent"
- [x] Produces valid AcceptanceCriteria from PRD
- [x] Coverage matrix maps requirements to criteria
- [x] Unit tests with mocked LLM

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
- [x] Prompts enforce Given-When-Then structure
- [x] Examples demonstrate expected output
- [x] Prompts are parameterized
- [x] Unit tests verify prompt formatting

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
- [x] Correct agent execution sequence
- [x] Failure in PRD Agent prevents Acceptance Agent
- [x] Retry logic for transient failures
- [x] Returns DiscoveryResult with status
- [x] Unit tests for coordination logic

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
- [x] EvidenceBundle contains all required artifacts
- [x] Bundle submitted to correct HITL gate
- [x] Rejection feedback captured and returned
- [x] Unit tests for bundle creation

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
- [x] RLM triggered for defined conditions
- [x] Exploration results enhance PRD content
- [x] Graceful fallback if RLM unavailable
- [x] Unit tests for RLM integration

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
- [x] Agents importable from package
- [x] Agent types registered correctly
- [x] Metadata includes capabilities
- [x] Unit test for registration

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
- [x] PRD generation integration test passes
- [x] Acceptance criteria integration test passes
- [x] Full discovery flow integration test passes
- [x] Tests use pytest fixtures for setup

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
- [x] E2E test runs in containerized environment
- [x] All artifacts verified
- [x] HITL gate interaction validated
- [x] Test is idempotent and repeatable

**Test:** `tests/e2e/test_discovery_workflow.py`

---

## Progress

- Started: 2026-01-23
- Tasks Complete: 12/12
- Percentage: 100%
- Status: COMPLETE
- Blockers: None
- Tests: 110 unit tests + 6 integration tests + 10 E2E tests = 126 tests passing

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
