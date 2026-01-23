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
- [ ] `ValidationConfig` dataclass
- [ ] Environment overrides
- [ ] Unit tests for config

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
- [ ] All models with validation
- [ ] Severity levels defined
- [ ] Unit tests for models

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
- [ ] Implements DomainAgent protocol
- [ ] E2E test execution
- [ ] RLM integration
- [ ] Unit tests with mocked runner

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
- [ ] Structured output format
- [ ] Issue categorization
- [ ] Unit tests for formatting

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
- [ ] Implements DomainAgent protocol
- [ ] OWASP patterns checked
- [ ] Compliance verification
- [ ] Unit tests with mock code

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
- [ ] Security patterns defined
- [ ] Severity classification
- [ ] Unit tests for formatting

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
- [ ] `DeploymentConfig` dataclass
- [ ] Strategy options defined
- [ ] Unit tests for config

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
- [ ] All models with validation
- [ ] Strategy enum defined
- [ ] Unit tests for models

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
- [ ] Implements DomainAgent protocol
- [ ] Manifest generation
- [ ] Changelog from commits
- [ ] Unit tests

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
- [ ] Implements DomainAgent protocol
- [ ] Strategy selection
- [ ] Health check config
- [ ] Unit tests

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
- [ ] Implements DomainAgent protocol
- [ ] Metric definitions
- [ ] Alert rules
- [ ] Unit tests

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
- [ ] Release prompts complete
- [ ] Deployment prompts complete
- [ ] Monitor prompts complete
- [ ] Unit tests for formatting

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
- [ ] Complete workflow
- [ ] HITL-5 and HITL-6 handling
- [ ] Rejection handling
- [ ] Unit tests

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
- [ ] All agents importable
- [ ] Types registered
- [ ] Unit tests for registration

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
- [ ] Validation flow tested
- [ ] Deployment flow tested
- [ ] Fixtures for setup

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
- [ ] E2E test passes
- [ ] All artifacts verified
- [ ] HITL gates validated
- [ ] Idempotent and repeatable

**Test:** `tests/e2e/test_validation_deployment_workflow.py`

---

## Progress

- Started: TBD
- Tasks Complete: 0/16
- Percentage: 0%
- Status: PENDING
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
