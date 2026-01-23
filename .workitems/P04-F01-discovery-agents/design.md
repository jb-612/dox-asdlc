# P04-F01: Discovery Agents - Technical Design

## Overview

Discovery Agents implement the initial phase of the aSDLC workflow, transforming user requirements into structured PRD documents and acceptance criteria. These agents work together to prepare evidence bundles for HITL-1 (PRD Approval) gate.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Discovery Phase Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Input ──► PRD Agent ──► Acceptance Agent ──► HITL-1       │
│       │              │                │                │         │
│       ▼              ▼                ▼                ▼         │
│   Raw Req.     prd.md        acceptance_criteria.md  Evidence   │
│                                                      Bundle      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Discovery Configuration (`config.py`)

Centralized configuration for discovery agents including:
- LLM model selection and parameters
- Token limits and retry policies
- Artifact output paths
- RLM integration settings

```python
@dataclass
class DiscoveryConfig:
    prd_model: str = "claude-sonnet-4-20250514"
    acceptance_model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 8192
    temperature: float = 0.3
    artifact_base_path: Path = Path("artifacts/discovery")
    enable_rlm: bool = True
```

### 2. Discovery Models (`models.py`)

Domain models for discovery artifacts:

```python
@dataclass
class PRDSection:
    title: str
    content: str
    requirements: list[Requirement]

@dataclass
class PRDDocument:
    title: str
    version: str
    sections: list[PRDSection]
    stakeholders: list[str]
    constraints: list[str]
    assumptions: list[str]

@dataclass
class AcceptanceCriterion:
    id: str
    description: str
    given: str
    when: str
    then: str
    priority: Priority

@dataclass
class AcceptanceCriteria:
    prd_reference: str
    criteria: list[AcceptanceCriterion]
    coverage_matrix: dict[str, list[str]]
```

### 3. PRD Agent (`prd_agent.py`)

Transforms raw user requirements into structured PRD documents.

**Responsibilities:**
- Parse and structure user input
- Generate PRD sections (objectives, scope, requirements, constraints)
- Apply domain-specific formatting
- Trigger RLM exploration when requirements are ambiguous

**Interface:**
```python
class PRDAgent(DomainAgent):
    agent_type = "prd_agent"

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DiscoveryConfig,
        rlm_integration: RLMIntegration | None = None,
    ): ...

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult: ...
```

**RLM Trigger Conditions:**
- Requirements reference unfamiliar technologies
- Scope is ambiguous or contradictory
- Dependencies on external systems not in context

### 4. Acceptance Agent (`acceptance_agent.py`)

Generates testable acceptance criteria from PRD documents.

**Responsibilities:**
- Parse PRD document structure
- Generate Given-When-Then criteria for each requirement
- Create coverage matrix (requirement → criteria mapping)
- Ensure criteria are specific and measurable

**Interface:**
```python
class AcceptanceAgent(DomainAgent):
    agent_type = "acceptance_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult: ...
```

### 5. Discovery Coordinator (`coordinator.py`)

Orchestrates the discovery workflow and prepares HITL evidence.

**Responsibilities:**
- Sequence PRD → Acceptance agent execution
- Aggregate artifacts into evidence bundle
- Validate completeness before HITL submission
- Handle partial failures and retries

```python
class DiscoveryCoordinator:
    async def run_discovery(
        self,
        user_input: str,
        project_context: ProjectContext,
    ) -> DiscoveryResult: ...

    async def prepare_evidence_bundle(
        self,
        prd: PRDDocument,
        acceptance: AcceptanceCriteria,
    ) -> EvidenceBundle: ...
```

### 6. Prompt Engineering (`prompts/`)

Structured prompts for consistent LLM interactions.

**PRD Prompts (`prd_prompts.py`):**
- `SYSTEM_PROMPT`: Role and context for PRD generation
- `REQUIREMENTS_EXTRACTION`: Extract structured requirements from input
- `PRD_GENERATION`: Generate full PRD document
- `AMBIGUITY_DETECTION`: Identify unclear requirements

**Acceptance Prompts (`acceptance_prompts.py`):**
- `SYSTEM_PROMPT`: Role for acceptance criteria generation
- `CRITERIA_GENERATION`: Generate Given-When-Then criteria
- `COVERAGE_ANALYSIS`: Map criteria to requirements

## Data Flow

```
1. User Input (raw requirements)
   │
   ▼
2. PRD Agent
   ├─► Check RLM trigger conditions
   │   └─► If triggered: RLM exploration
   ├─► Generate PRD sections
   └─► Write prd.md artifact
   │
   ▼
3. Acceptance Agent
   ├─► Parse PRD document
   ├─► Generate acceptance criteria
   └─► Write acceptance_criteria.md artifact
   │
   ▼
4. Discovery Coordinator
   ├─► Validate artifacts
   ├─► Create evidence bundle
   └─► Submit to HITL-1 gate
```

## Dependencies

| Dependency | Source | Purpose |
|------------|--------|---------|
| `DomainAgent` | P03-F01 | Base agent protocol |
| `LLMClient` | P03-F01 | LLM interactions |
| `ArtifactWriter` | P03-F01 | Artifact persistence |
| `RLMIntegration` | P03-F03 | RLM mode support |
| `HITLDispatcher` | P02-F03 | HITL gate submission |
| `EvidenceBundle` | P02-F03 | Evidence packaging |

## File Structure

```
src/workers/agents/discovery/
├── __init__.py              # Agent registration
├── config.py                # Configuration
├── models.py                # Domain models
├── prd_agent.py             # PRD generation agent
├── acceptance_agent.py      # Acceptance criteria agent
├── coordinator.py           # Workflow coordination
└── prompts/
    ├── __init__.py
    ├── prd_prompts.py       # PRD prompt templates
    └── acceptance_prompts.py # Acceptance prompt templates
```

## Error Handling

| Error Type | Handling |
|------------|----------|
| LLM timeout | Retry with exponential backoff (max 3) |
| Invalid PRD structure | Return validation errors, no HITL submission |
| RLM exploration failure | Fall back to standard generation |
| Artifact write failure | Fail fast, propagate to coordinator |

## Testing Strategy

- **Unit tests**: Individual agent methods, prompt formatting
- **Integration tests**: Agent → LLM → Artifact flow
- **E2E tests**: Full discovery workflow with mock HITL

## Security Considerations

- Sanitize user input before LLM submission
- No PII in artifact file names
- Audit log all HITL submissions
