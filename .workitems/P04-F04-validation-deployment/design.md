# P04-F04: Validation & Deployment Agents - Technical Design

## Overview

Validation and Deployment Agents implement the final phases of the aSDLC workflow. These agents ensure code quality through comprehensive validation, manage releases, and orchestrate deployments. This phase prepares evidence for HITL-5 (Release Approval) and HITL-6 (Deployment Approval) gates.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Validation & Deployment Phase Flow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Code (approved) ──► Validation Agent ──► Security Agent ──► HITL-5         │
│        │                    │                   │              │             │
│        ▼                    ▼                   ▼              ▼             │
│    HITL-4 OK        validation.md        security.md    Release OK          │
│                                                              │               │
│                                                              ▼               │
│                                          Release Agent ──► Deployment Agent │
│                                                │                   │         │
│                                                ▼                   ▼         │
│                                          release.md           HITL-6        │
│                                                                   │         │
│                                                                   ▼         │
│                                                           Monitor Agent     │
│                                                                   │         │
│                                                                   ▼         │
│                                                           monitoring.md     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Validation Configuration (`config.py`)

```python
@dataclass
class ValidationConfig:
    validation_model: str = "claude-sonnet-4-20250514"
    security_model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 8192
    temperature: float = 0.1  # Low for precise validation
    artifact_base_path: Path = Path("artifacts/validation")
    enable_rlm: bool = True
    e2e_test_timeout: int = 600
    security_scan_level: str = "standard"  # "minimal", "standard", "thorough"

@dataclass
class DeploymentConfig:
    release_model: str = "claude-sonnet-4-20250514"
    deployment_model: str = "claude-sonnet-4-20250514"
    monitor_model: str = "claude-sonnet-4-20250514"
    artifact_base_path: Path = Path("artifacts/deployment")
    rollback_enabled: bool = True
    canary_percentage: int = 10
    health_check_interval: int = 30
```

### 2. Validation Models (`models.py`)

```python
@dataclass
class ValidationCheck:
    name: str
    category: str  # "functional", "performance", "compatibility"
    passed: bool
    details: str
    evidence: str | None

@dataclass
class ValidationReport:
    feature_id: str
    checks: list[ValidationCheck]
    e2e_results: TestRunResult
    passed: bool
    recommendations: list[str]

@dataclass
class SecurityFinding:
    id: str
    severity: str  # "critical", "high", "medium", "low", "info"
    category: str  # "injection", "xss", "secrets", "auth", etc.
    location: str
    description: str
    remediation: str

@dataclass
class SecurityReport:
    feature_id: str
    findings: list[SecurityFinding]
    passed: bool  # No critical/high findings
    scan_coverage: float
    compliance_status: dict[str, bool]

@dataclass
class ReleaseManifest:
    version: str
    features: list[str]
    changelog: str
    artifacts: list[ArtifactReference]
    rollback_plan: str

@dataclass
class DeploymentPlan:
    release_version: str
    target_environment: str
    strategy: str  # "rolling", "blue-green", "canary"
    steps: list[DeploymentStep]
    rollback_triggers: list[str]
    health_checks: list[HealthCheck]

@dataclass
class MonitoringConfig:
    deployment_id: str
    metrics: list[MetricDefinition]
    alerts: list[AlertRule]
    dashboards: list[DashboardConfig]
```

### 3. Validation Agent (`validation_agent.py`)

**RLM-Enabled**: Runs comprehensive validation suite.

**Responsibilities:**
- Execute E2E test suite
- Verify integration points
- Check performance baselines
- Validate compatibility requirements

```python
class ValidationAgent(DomainAgent):
    agent_type = "validation_agent"

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: ValidationConfig,
        rlm_integration: RLMIntegration | None = None,
    ): ...

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        implementation = context.get_artifact("implementation")
        acceptance = context.get_artifact("acceptance_criteria")

        # Run E2E tests
        e2e_results = await self._run_e2e_tests(implementation)

        # RLM for complex validation scenarios
        if self._needs_rlm_validation(e2e_results):
            rlm_insights = await self._rlm_integration.explore(...)

        report = await self._generate_validation_report(
            implementation, e2e_results, acceptance
        )

        return AgentResult(
            success=report.passed,
            artifacts={"validation_report": report},
            next_agent="security_agent" if report.passed else None,
        )
```

**RLM Trigger Conditions:**
- E2E tests have intermittent failures
- Performance regression detected
- Integration issues with external systems

### 4. Security Agent (`security_agent.py`)

**Responsibilities:**
- Run security scans (SAST-like analysis)
- Check for common vulnerabilities
- Verify secrets management
- Assess compliance requirements

```python
class SecurityAgent(DomainAgent):
    agent_type = "security_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        implementation = context.get_artifact("implementation")

        findings = await self._scan_for_vulnerabilities(implementation)
        compliance = await self._check_compliance(implementation)

        report = SecurityReport(
            findings=findings,
            passed=not any(f.severity in ["critical", "high"] for f in findings),
            compliance_status=compliance,
        )

        return AgentResult(
            success=report.passed,
            artifacts={"security_report": report},
            hitl_gate="HITL-5" if report.passed else None,
        )
```

### 5. Release Agent (`release_agent.py`)

**Responsibilities:**
- Generate release manifest
- Create changelog from commits
- Tag release in version control
- Prepare rollback plan

```python
class ReleaseAgent(DomainAgent):
    agent_type = "release_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        validation = context.get_artifact("validation_report")
        security = context.get_artifact("security_report")

        manifest = await self._generate_release_manifest(
            validation, security
        )
        changelog = await self._generate_changelog()

        return AgentResult(
            success=True,
            artifacts={
                "release_manifest": manifest,
                "changelog": changelog,
            },
            next_agent="deployment_agent",
        )
```

### 6. Deployment Agent (`deployment_agent.py`)

**Responsibilities:**
- Generate deployment plan
- Define deployment strategy
- Configure health checks
- Prepare rollback procedures

```python
class DeploymentAgent(DomainAgent):
    agent_type = "deployment_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        manifest = context.get_artifact("release_manifest")
        target_env = event_metadata.get("target_environment", "staging")

        plan = await self._generate_deployment_plan(manifest, target_env)

        return AgentResult(
            success=True,
            artifacts={"deployment_plan": plan},
            hitl_gate="HITL-6",
        )
```

### 7. Monitor Agent (`monitor_agent.py`)

**Responsibilities:**
- Configure monitoring for deployment
- Define metrics and alerts
- Set up dashboards
- Report deployment health

```python
class MonitorAgent(DomainAgent):
    agent_type = "monitor_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        deployment = context.get_artifact("deployment_plan")

        monitoring = await self._configure_monitoring(deployment)

        return AgentResult(
            success=True,
            artifacts={"monitoring_config": monitoring},
        )
```

### 8. Validation Coordinator (`coordinator.py`)

Orchestrates validation and deployment workflow:

```python
class ValidationDeploymentCoordinator:
    async def run_validation(
        self,
        implementation: Implementation,
        acceptance: AcceptanceCriteria,
    ) -> ValidationResult:
        # 1. Validation Agent
        validation = await self.validation_agent.execute(...)

        if not validation.passed:
            return ValidationResult.failed(validation.issues)

        # 2. Security Agent
        security = await self.security_agent.execute(...)

        if not security.passed:
            return ValidationResult.failed(security.findings)

        # 3. Submit to HITL-5
        await self._submit_hitl5(validation, security)

        return ValidationResult.pending_approval()

    async def run_deployment(
        self,
        hitl5_approval: Approval,
        target_environment: str,
    ) -> DeploymentResult:
        # 4. Release Agent
        release = await self.release_agent.execute(...)

        # 5. Deployment Agent
        deployment = await self.deployment_agent.execute(...)

        # 6. Submit to HITL-6
        await self._submit_hitl6(release, deployment)

        # 7. After HITL-6 approval, Monitor Agent
        monitoring = await self.monitor_agent.execute(...)

        return DeploymentResult.success(monitoring)
```

## Data Flow

```
1. Implementation (from Development, HITL-4 approved)
   │
   ▼
2. Validation Agent (RLM-enabled)
   ├─► Run E2E tests
   ├─► Check integration points
   └─► Write validation_report.md
   │
   ▼
3. Security Agent
   ├─► Scan for vulnerabilities
   ├─► Check compliance
   └─► Write security_report.md
   │
   ▼
4. [HITL-5: Release Approval]
   │
   ▼
5. Release Agent
   ├─► Generate release manifest
   ├─► Create changelog
   └─► Write release.md
   │
   ▼
6. Deployment Agent
   ├─► Generate deployment plan
   ├─► Configure health checks
   └─► Write deployment_plan.md
   │
   ▼
7. [HITL-6: Deployment Approval]
   │
   ▼
8. Monitor Agent
   ├─► Configure monitoring
   └─► Write monitoring_config.md
```

## Dependencies

| Dependency | Source | Purpose |
|------------|--------|---------|
| `DomainAgent` | P03-F01 | Base agent protocol |
| `LLMClient` | P03-F01 | LLM interactions |
| `ArtifactWriter` | P03-F01 | Artifact persistence |
| `RLMIntegration` | P03-F03 | Validation exploration |
| `HITLDispatcher` | P02-F03 | HITL-5, HITL-6 submission |
| `Implementation` | P04-F03 | Development output |

## File Structure

```
src/workers/agents/validation/
├── __init__.py              # Agent registration
├── config.py                # Configuration
├── models.py                # Domain models
├── validation_agent.py      # Validation (RLM)
├── security_agent.py        # Security scanning
└── prompts/
    ├── validation_prompts.py
    └── security_prompts.py

src/workers/agents/deployment/
├── __init__.py              # Agent registration
├── config.py                # Configuration
├── models.py                # Domain models
├── release_agent.py         # Release management
├── deployment_agent.py      # Deployment planning
├── monitor_agent.py         # Monitoring setup
├── coordinator.py           # Workflow coordination
└── prompts/
    ├── release_prompts.py
    ├── deployment_prompts.py
    └── monitor_prompts.py
```

## HITL Gates

### HITL-5: Release Approval

**Evidence Bundle:**
- Validation report with E2E results
- Security report with findings
- Compliance status
- Release manifest

**Approval Criteria:**
- All E2E tests pass
- No critical/high security findings
- Compliance requirements met
- Rollback plan documented

### HITL-6: Deployment Approval

**Evidence Bundle:**
- Deployment plan
- Health check configuration
- Rollback procedures
- Monitoring configuration

**Approval Criteria:**
- Deployment strategy appropriate
- Health checks comprehensive
- Rollback tested
- Monitoring in place

## Error Handling

| Error Type | Handling |
|------------|----------|
| E2E test timeout | Mark as failed, capture partial results |
| Security scan error | Retry, escalate if persistent |
| Release tagging failure | Fail gracefully, manual intervention |
| Deployment plan generation error | Retry with different strategy |

## Testing Strategy

- **Unit tests**: Each agent in isolation
- **Integration tests**: Validation → Security → Release flow
- **E2E tests**: Full deployment workflow simulation
