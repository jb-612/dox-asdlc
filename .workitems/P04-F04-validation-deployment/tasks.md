# P04-F04: Validation & Deployment Agents - Task Breakdown

## Overview

| Metric | Value |
|--------|-------|
| Total Tasks | 16 |
| Estimated Hours | ~24h |
| Dependencies | P03-F01, P03-F03, P02-F03, P04-F03 |
| Target Files | `src/workers/agents/validation/`, `src/workers/agents/deployment/` |

---

## Tasks

### T01: Validation Configuration
**File:** `src/workers/agents/validation/config.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create configuration for validation agents:
- E2E test timeout settings
- Security scan levels
- RLM integration toggle

**Acceptance Criteria:**
- [x] `ValidationConfig` dataclass
- [x] Environment overrides
- [x] Unit tests for config

**Test:** `tests/unit/workers/agents/validation/test_config.py`

---

### T02: Validation Models
**File:** `src/workers/agents/validation/models.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Define validation domain models:
- `ValidationCheck`, `ValidationReport`
- `SecurityFinding`, `SecurityReport`

**Acceptance Criteria:**
- [x] All models with validation
- [x] Severity levels defined
- [x] Unit tests for models

**Test:** `tests/unit/workers/agents/validation/test_models.py`

---

### T03: Validation Agent Implementation
**File:** `src/workers/agents/validation/validation_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01, P03-F03

**Description:**
Implement RLM-enabled validation agent:
- Run E2E test suite
- Check integration points
- Generate validation report
- Use RLM for complex scenarios

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] E2E test execution
- [x] RLM integration
- [x] Unit tests with mocked runner

**Test:** `tests/unit/workers/agents/validation/test_validation_agent.py`

---

### T04: Validation Prompt Engineering
**File:** `src/workers/agents/validation/prompts/validation_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompts for validation analysis:
- Test result interpretation
- Integration verification
- Performance analysis

**Acceptance Criteria:**
- [x] Structured output format
- [x] Issue categorization
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/validation/prompts/test_validation_prompts.py`

---

### T05: Security Agent Implementation
**File:** `src/workers/agents/validation/security_agent.py`
**Estimate:** 2h
**Dependencies:** T01, T02, P03-F01

**Description:**
Implement security scanning agent:
- Scan for vulnerabilities
- Check secrets exposure
- Verify compliance requirements
- Generate security report

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] OWASP patterns checked
- [x] Compliance verification
- [x] Unit tests with mock code

**Test:** `tests/unit/workers/agents/validation/test_security_agent.py`

---

### T06: Security Prompt Engineering
**File:** `src/workers/agents/validation/prompts/security_prompts.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create prompts for security analysis:
- Vulnerability detection
- Secrets scanning
- Compliance checking

**Acceptance Criteria:**
- [x] Security patterns defined
- [x] Severity classification
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/validation/prompts/test_security_prompts.py`

---

### T07: Deployment Configuration
**File:** `src/workers/agents/deployment/config.py`
**Estimate:** 1h
**Dependencies:** None

**Description:**
Create configuration for deployment agents:
- Deployment strategy options
- Canary percentages
- Health check intervals
- Rollback settings

**Acceptance Criteria:**
- [x] `DeploymentConfig` dataclass
- [x] Strategy options defined
- [x] Unit tests for config

**Test:** `tests/unit/workers/agents/deployment/test_config.py`

---

### T08: Deployment Models
**File:** `src/workers/agents/deployment/models.py`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Define deployment domain models:
- `ReleaseManifest`, `ArtifactReference`
- `DeploymentPlan`, `DeploymentStep`
- `HealthCheck`, `MonitoringConfig`

**Acceptance Criteria:**
- [x] All models with validation
- [x] Strategy enum defined
- [x] Unit tests for models

**Test:** `tests/unit/workers/agents/deployment/test_models.py`

---

### T09: Release Agent Implementation
**File:** `src/workers/agents/deployment/release_agent.py`
**Estimate:** 1.5h
**Dependencies:** T07, T08, P03-F01

**Description:**
Implement release management agent:
- Generate release manifest
- Create changelog
- Document rollback plan

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] Manifest generation
- [x] Changelog from commits
- [x] Unit tests

**Test:** `tests/unit/workers/agents/deployment/test_release_agent.py`

---

### T10: Deployment Agent Implementation
**File:** `src/workers/agents/deployment/deployment_agent.py`
**Estimate:** 2h
**Dependencies:** T07, T08, P03-F01

**Description:**
Implement deployment planning agent:
- Generate deployment plan
- Configure health checks
- Define rollback triggers
- Support multiple strategies

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] Strategy selection
- [x] Health check config
- [x] Unit tests

**Test:** `tests/unit/workers/agents/deployment/test_deployment_agent.py`

---

### T11: Monitor Agent Implementation
**File:** `src/workers/agents/deployment/monitor_agent.py`
**Estimate:** 1.5h
**Dependencies:** T07, T08, P03-F01

**Description:**
Implement monitoring configuration agent:
- Define metrics to collect
- Configure alerts
- Generate dashboard config

**Acceptance Criteria:**
- [x] Implements DomainAgent protocol
- [x] Metric definitions
- [x] Alert rules
- [x] Unit tests

**Test:** `tests/unit/workers/agents/deployment/test_monitor_agent.py`

---

### T12: Deployment Prompts
**File:** `src/workers/agents/deployment/prompts/`
**Estimate:** 1.5h
**Dependencies:** None

**Description:**
Create prompts for deployment agents:
- Release manifest generation
- Deployment plan creation
- Monitoring configuration

**Acceptance Criteria:**
- [x] Release prompts complete
- [x] Deployment prompts complete
- [x] Monitor prompts complete
- [x] Unit tests for formatting

**Test:** `tests/unit/workers/agents/deployment/prompts/`

---

### T13: Validation-Deployment Coordinator
**File:** `src/workers/agents/deployment/coordinator.py`
**Estimate:** 2h
**Dependencies:** T03, T05, T09, T10, T11

**Description:**
Implement workflow coordination:
- Validation → Security → HITL-5
- Release → Deployment → HITL-6 → Monitor
- Handle approvals and rejections

**Acceptance Criteria:**
- [x] Complete workflow
- [x] HITL-5 and HITL-6 handling
- [x] Rejection handling
- [x] Unit tests

**Test:** `tests/unit/workers/agents/deployment/test_coordinator.py`

---

### T14: Agent Registration
**File:** `src/workers/agents/validation/__init__.py`, `src/workers/agents/deployment/__init__.py`
**Estimate:** 30min
**Dependencies:** T03, T05, T09, T10, T11

**Description:**
Register all validation and deployment agents:
- Export agents from packages
- Register with dispatcher
- Include capability metadata

**Acceptance Criteria:**
- [x] All agents importable
- [x] Types registered
- [x] Unit tests for registration

**Test:** `tests/unit/workers/agents/validation/test_init.py`, `tests/unit/workers/agents/deployment/test_init.py`

---

### T15: Integration Tests
**File:** `tests/integration/workers/agents/validation/`, `tests/integration/workers/agents/deployment/`
**Estimate:** 2.5h
**Dependencies:** T01-T14

**Description:**
Create integration tests:
- Validation → Security flow
- Release → Deployment → Monitor flow
- HITL interaction (mocked)

**Acceptance Criteria:**
- [x] Validation flow tested
- [x] Deployment flow tested
- [x] Fixtures for setup

**Test:** `tests/integration/workers/agents/`

---

### T16: E2E Validation
**File:** `tests/e2e/test_validation_deployment_workflow.py`
**Estimate:** 2h
**Dependencies:** T15

**Description:**
Create E2E test for full workflow:
- Start with approved code (HITL-4)
- Verify validation and security
- Test HITL-5 approval flow
- Verify release and deployment
- Test HITL-6 approval flow
- Validate monitoring setup

**Acceptance Criteria:**
- [x] E2E test passes
- [x] All artifacts verified
- [x] HITL gates validated
- [x] Idempotent and repeatable

**Test:** `tests/e2e/test_validation_deployment_workflow.py`

---

## Progress

- Started: 2026-01-29
- Tasks Complete: 16/16
- Percentage: 100%
- Status: COMPLETE
- Blockers: None

---

## Task Dependencies Graph

```
T01 (Val Config) ────┬──► T03 (Validation) ─────────┐
                     │                               │
T02 (Val Models) ────┼──► T05 (Security) ───────────┼──┐
                     │                               │  │
T04 (Val Prompts) ───┘                              │  │
T06 (Sec Prompts) ──────────────────────────────────┘  │
                                                        │
T07 (Dep Config) ────┬──► T09 (Release) ────────────┐  │
                     │                               │  │
T08 (Dep Models) ────┼──► T10 (Deployment) ─────────┼──┼──► T13 (Coordinator)
                     │                               │  │         │
                     └──► T11 (Monitor) ────────────┘  │         │
                                                        │         │
T12 (Dep Prompts) ──────────────────────────────────────┘         │
                                                                   │
                                                        T14 (Registration)
                                                                   │
                                                        T15 (Integration)
                                                                   │
                                                        T16 (E2E)
```
