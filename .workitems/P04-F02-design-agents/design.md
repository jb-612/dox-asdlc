# P04-F02: Design Agents - Technical Design

## Overview

Design Agents transform approved PRDs into technical architecture, detailed designs, and implementation plans. This phase includes three specialized agents that prepare evidence for HITL-2 (Architecture Approval) and HITL-3 (Design Approval) gates.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Design Phase Flow                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRD (approved) ──► Arch Surveyor ──► Solution Architect ──► Planner    │
│        │                  │                   │                  │       │
│        ▼                  ▼                   ▼                  ▼       │
│    HITL-1 OK      tech_survey.md       architecture.md     tasks.md     │
│                          │                   │                  │       │
│                          └────────┬──────────┘                  │       │
│                                   ▼                             ▼       │
│                              HITL-2                          HITL-3     │
│                        (Architecture)                      (Design)     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Design Configuration (`config.py`)

```python
@dataclass
class DesignConfig:
    surveyor_model: str = "claude-sonnet-4-20250514"
    architect_model: str = "claude-sonnet-4-20250514"
    planner_model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 16384  # Larger for detailed designs
    temperature: float = 0.2  # Lower for technical precision
    artifact_base_path: Path = Path("artifacts/design")
    enable_rlm: bool = True
    context_pack_required: bool = True  # Requires RepoMapper output
```

### 2. Design Models (`models.py`)

```python
@dataclass
class TechnologyChoice:
    category: str  # "language", "framework", "database", etc.
    selected: str
    alternatives: list[str]
    rationale: str

@dataclass
class TechSurvey:
    prd_reference: str
    technologies: list[TechnologyChoice]
    constraints_analysis: dict[str, str]
    risk_assessment: list[Risk]
    recommendations: list[str]

@dataclass
class Component:
    name: str
    responsibility: str
    interfaces: list[Interface]
    dependencies: list[str]

@dataclass
class Architecture:
    style: str  # "microservices", "monolith", "event-driven"
    components: list[Component]
    data_flow: list[DataFlow]
    deployment_model: str
    diagrams: list[DiagramReference]

@dataclass
class ImplementationTask:
    id: str
    title: str
    description: str
    component: str
    dependencies: list[str]
    acceptance_criteria: list[str]
    estimated_complexity: str  # "S", "M", "L", "XL"

@dataclass
class ImplementationPlan:
    architecture_reference: str
    phases: list[Phase]
    tasks: list[ImplementationTask]
    critical_path: list[str]
```

### 3. Architecture Surveyor Agent (`surveyor_agent.py`)

**RLM-Enabled**: Explores codebase and external resources for technology decisions.

**Responsibilities:**
- Analyze PRD requirements for technology implications
- Survey existing codebase for patterns and constraints
- Research technology options when needed (RLM)
- Produce technology survey with recommendations

```python
class SurveyorAgent(DomainAgent):
    agent_type = "surveyor_agent"

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DesignConfig,
        rlm_integration: RLMIntegration,  # Required for surveyor
        repo_mapper: RepoMapper | None = None,
    ): ...

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        # Always uses RLM for technology research
        ...
```

**RLM Trigger Conditions:**
- New technology mentioned in PRD
- Integration with external systems
- Performance requirements need benchmarks
- Security requirements need compliance research

### 4. Solution Architect Agent (`architect_agent.py`)

**Responsibilities:**
- Consume tech survey and PRD
- Design component architecture
- Define interfaces and data flows
- Create architecture diagrams (mermaid)
- Validate against non-functional requirements

```python
class ArchitectAgent(DomainAgent):
    agent_type = "architect_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        tech_survey = context.get_artifact("tech_survey")
        prd = context.get_artifact("prd")
        context_pack = context.get_artifact("context_pack")

        architecture = await self._design_architecture(
            prd, tech_survey, context_pack
        )
        return AgentResult(
            success=True,
            artifacts={"architecture": architecture},
            hitl_gate="HITL-2",
        )
```

### 5. Planner Agent (`planner_agent.py`)

**Responsibilities:**
- Break architecture into implementation tasks
- Identify task dependencies
- Estimate complexity
- Create implementation phases
- Define critical path

```python
class PlannerAgent(DomainAgent):
    agent_type = "planner_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        architecture = context.get_artifact("architecture")
        acceptance = context.get_artifact("acceptance_criteria")

        plan = await self._create_implementation_plan(
            architecture, acceptance
        )
        return AgentResult(
            success=True,
            artifacts={"implementation_plan": plan},
            hitl_gate="HITL-3",
        )
```

### 6. Design Coordinator (`coordinator.py`)

Orchestrates the design workflow:

```python
class DesignCoordinator:
    async def run_design(
        self,
        prd: PRDDocument,
        acceptance: AcceptanceCriteria,
        project_context: ProjectContext,
    ) -> DesignResult:
        # 1. Surveyor analyzes and researches
        survey = await self.surveyor.execute(...)

        # 2. Architect creates architecture (waits for HITL-2 if needed)
        architecture = await self.architect.execute(...)
        await self._submit_hitl2(architecture, survey)

        # 3. Planner creates tasks (after HITL-2 approval)
        plan = await self.planner.execute(...)
        await self._submit_hitl3(plan)

        return DesignResult(survey, architecture, plan)
```

## Data Flow

```
1. PRD + Acceptance (from Discovery)
   │
   ▼
2. Surveyor Agent (RLM-enabled)
   ├─► RepoMapper context pack
   ├─► RLM exploration for tech research
   └─► Write tech_survey.md
   │
   ▼
3. Architect Agent
   ├─► Consume tech survey + PRD
   ├─► Generate architecture.md with diagrams
   └─► Submit to HITL-2
   │
   ▼
4. [HITL-2 Approval Required]
   │
   ▼
5. Planner Agent
   ├─► Break architecture into tasks
   ├─► Generate implementation_plan.md
   └─► Submit to HITL-3
   │
   ▼
6. [HITL-3 Approval Required]
```

## Dependencies

| Dependency | Source | Purpose |
|------------|--------|---------|
| `DomainAgent` | P03-F01 | Base agent protocol |
| `LLMClient` | P03-F01 | LLM interactions |
| `ArtifactWriter` | P03-F01 | Artifact persistence |
| `RLMIntegration` | P03-F03 | Technology research |
| `RepoMapper` | P03-F02 | Codebase context |
| `HITLDispatcher` | P02-F03 | HITL-2, HITL-3 submission |
| `PRDDocument` | P04-F01 | Discovery output |

## File Structure

```
src/workers/agents/design/
├── __init__.py              # Agent registration
├── config.py                # Configuration
├── models.py                # Domain models
├── surveyor_agent.py        # Technology surveyor (RLM)
├── architect_agent.py       # Architecture design
├── planner_agent.py         # Implementation planning
├── coordinator.py           # Workflow coordination
└── prompts/
    ├── __init__.py
    ├── surveyor_prompts.py  # Tech research prompts
    ├── architect_prompts.py # Architecture prompts
    └── planner_prompts.py   # Planning prompts
```

## HITL Gates

### HITL-2: Architecture Approval

**Evidence Bundle:**
- Tech survey with rationale
- Architecture document
- Component diagrams
- Interface definitions
- Risk assessment

**Approval Criteria:**
- Technology choices justified
- Architecture meets NFRs
- Security considerations addressed
- Scalability path clear

### HITL-3: Design Approval

**Evidence Bundle:**
- Implementation plan
- Task breakdown
- Dependency graph
- Critical path analysis
- Resource estimates

**Approval Criteria:**
- Tasks are atomic and testable
- Dependencies correctly identified
- Plan covers all requirements
- Risk mitigation addressed

## Error Handling

| Error Type | Handling |
|------------|----------|
| RLM exploration timeout | Use cached/default recommendations |
| Architecture validation fail | Return to surveyor for revision |
| Missing context pack | Generate minimal context, warn |
| HITL rejection | Capture feedback, trigger re-design |

## Testing Strategy

- **Unit tests**: Model validation, prompt formatting
- **Integration tests**: Agent chains with mocked LLM
- **E2E tests**: Full design workflow with HITL simulation
