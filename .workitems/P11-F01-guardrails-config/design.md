# P11-F01 Guardrails Configuration System - Technical Design

**Version:** 1.0
**Date:** 2026-02-05
**Status:** Draft

## 1. Overview

Implement a **Contextually-Conditional Guardrails System** following Parlant's alignment modeling pattern. This replaces static 2000+ word system prompts with modular guidelines that are evaluated and filtered at runtime, providing focused, relevant context to agents based on their current task.

### 1.1 Goals

1. Define a guideline schema supporting condition-based activation
2. Store guidelines in Elasticsearch with versioning and audit trail
3. Implement a GuardrailsEvaluator that filters guidelines by task context
4. Extend the knowledge-store MCP with guardrails tools
5. Add REST API endpoints in the orchestrator for UI configuration
6. Build HITL UI components for guideline management

### 1.2 Non-Goals

- Replacing existing `.claude/rules/` files (they become default guidelines)
- Real-time LLM-based guideline evaluation (deterministic rules only)
- Multi-tenant guideline isolation (uses existing tenant context)
- Automatic guideline learning from agent behavior

## 2. Dependencies

### 2.1 Internal Dependencies

| Dependency | Status | Description |
|------------|--------|-------------|
| P01-F03 | Complete | KnowledgeStore interface and models |
| P02-F04 | Complete | Elasticsearch backend with kNN search |
| P02-F05 | Complete | MCP server patterns |
| P05-F01 | Complete | HITL UI infrastructure |
| P06-F05 | Complete | Multi-tenancy support |

### 2.2 External Dependencies

- `elasticsearch[async]>=8.10.0` - Already in requirements
- No new Python dependencies required
- No new npm packages required

## 3. Guideline Schema

### 3.1 Core Guideline Structure

```python
@dataclass
class Guideline:
    """A contextually-conditional guideline for agent behavior.

    Guidelines are modular rules that activate based on conditions,
    following Parlant's alignment modeling pattern.
    """
    id: str                           # Unique identifier (e.g., "cognitive-planner")
    name: str                         # Human-readable name
    description: str                  # Detailed description
    enabled: bool                     # Master enable/disable toggle
    category: GuidelineCategory       # Category for grouping
    priority: int                     # Higher priority wins conflicts (0-1000)
    condition: GuidelineCondition     # When the guideline applies
    action: GuidelineAction           # What to do when condition matches
    metadata: dict[str, Any]          # Additional metadata
    version: int                      # Version for optimistic locking
    created_at: datetime              # Creation timestamp
    updated_at: datetime              # Last update timestamp
    created_by: str                   # Creator identifier
```

### 3.2 Guideline Categories

```python
class GuidelineCategory(str, Enum):
    """Categories for organizing guidelines."""
    COGNITIVE_ISOLATION = "cognitive_isolation"   # Agent role restrictions
    HITL_GATE = "hitl_gate"                       # Human-in-the-loop gates
    TDD_PROTOCOL = "tdd_protocol"                 # Test-driven development
    CONTEXT_CONSTRAINT = "context_constraint"     # Domain-specific patterns
    AUDIT_TELEMETRY = "audit_telemetry"           # Logging and observability
    SECURITY = "security"                         # Security policies
    CUSTOM = "custom"                             # User-defined
```

### 3.3 Condition Schema

```python
@dataclass
class GuidelineCondition:
    """Conditions that determine when a guideline applies.

    All specified fields must match (AND logic).
    Lists within fields use OR logic (any match).
    """
    agents: list[str] | None = None       # Agent roles (planner, backend, etc.)
    domains: list[str] | None = None      # Domain identifiers (P01, P05, etc.)
    actions: list[str] | None = None      # Action types (design, implement, review)
    paths: list[str] | None = None        # File path patterns (glob syntax)
    events: list[str] | None = None       # Event types (commit, deploy, etc.)
    gate_types: list[str] | None = None   # HITL gate types
    custom: dict[str, Any] | None = None  # Custom condition fields

    def matches(self, context: TaskContext) -> bool:
        """Check if this condition matches the given context."""
        ...
```

### 3.4 Action Schema

```python
@dataclass
class GuidelineAction:
    """Actions to take when a guideline's condition matches."""
    type: ActionType                      # Action type
    instruction: str | None = None        # Text instruction to include
    tools_allowed: list[str] | None = None    # Allowed tool patterns
    tools_denied: list[str] | None = None     # Denied tool patterns
    gate_type: str | None = None          # HITL gate to require
    gate_threshold: str | None = None     # Gate threshold (mandatory/advisory)
    max_files: int | None = None          # Maximum files to modify
    require_tests: bool | None = None     # Require test coverage
    require_review: bool | None = None    # Require code review
    parameters: dict[str, Any] | None = None  # Additional parameters

class ActionType(str, Enum):
    """Types of actions a guideline can specify."""
    INSTRUCTION = "instruction"         # Add text to context
    TOOL_RESTRICTION = "tool_restriction"  # Allow/deny tools
    HITL_GATE = "hitl_gate"             # Require human approval
    CONSTRAINT = "constraint"           # Apply constraints
    TELEMETRY = "telemetry"             # Configure logging
```

### 3.5 Task Context

```python
@dataclass
class TaskContext:
    """Context for a task being evaluated against guidelines.

    This is the input to the GuardrailsEvaluator.
    """
    agent: str                        # Current agent role
    domain: str | None = None         # Domain identifier (P01, P05)
    action: str | None = None         # Action type (design, implement)
    paths: list[str] | None = None    # Files being accessed
    event: str | None = None          # Triggering event
    gate_type: str | None = None      # Current HITL gate
    tenant_id: str | None = None      # Tenant identifier
    session_id: str | None = None     # Session identifier
    metadata: dict[str, Any] | None = None  # Additional context
```

## 4. Elasticsearch Indices

### 4.1 guardrails-config Index

Stores guideline definitions with versioning.

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
      "description": { "type": "text" },
      "enabled": { "type": "boolean" },
      "category": { "type": "keyword" },
      "priority": { "type": "integer" },
      "condition": {
        "type": "object",
        "properties": {
          "agents": { "type": "keyword" },
          "domains": { "type": "keyword" },
          "actions": { "type": "keyword" },
          "paths": { "type": "keyword" },
          "events": { "type": "keyword" },
          "gate_types": { "type": "keyword" },
          "custom": { "type": "object", "enabled": false }
        }
      },
      "action": {
        "type": "object",
        "properties": {
          "type": { "type": "keyword" },
          "instruction": { "type": "text" },
          "tools_allowed": { "type": "keyword" },
          "tools_denied": { "type": "keyword" },
          "gate_type": { "type": "keyword" },
          "gate_threshold": { "type": "keyword" },
          "max_files": { "type": "integer" },
          "require_tests": { "type": "boolean" },
          "require_review": { "type": "boolean" },
          "parameters": { "type": "object", "enabled": false }
        }
      },
      "metadata": { "type": "object", "enabled": false },
      "version": { "type": "integer" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "created_by": { "type": "keyword" },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

### 4.2 guardrails-audit Index

Stores gate decisions and configuration changes.

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "event_type": { "type": "keyword" },
      "timestamp": { "type": "date" },
      "guideline_id": { "type": "keyword" },
      "guideline_name": { "type": "text" },
      "context": {
        "type": "object",
        "properties": {
          "agent": { "type": "keyword" },
          "domain": { "type": "keyword" },
          "action": { "type": "keyword" },
          "session_id": { "type": "keyword" }
        }
      },
      "decision": {
        "type": "object",
        "properties": {
          "result": { "type": "keyword" },
          "reason": { "type": "text" },
          "user_response": { "type": "keyword" }
        }
      },
      "changes": {
        "type": "object",
        "properties": {
          "field": { "type": "keyword" },
          "old_value": { "type": "text" },
          "new_value": { "type": "text" }
        }
      },
      "actor": { "type": "keyword" },
      "tenant_id": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}
```

## 5. GuardrailsEvaluator

### 5.1 Class Design

```python
class GuardrailsEvaluator:
    """Evaluates guidelines against task context.

    Follows Parlant's alignment modeling pattern:
    1. Task context arrives (agent, domain, action, paths)
    2. Fetch all enabled guidelines from Elasticsearch
    3. Evaluate conditions against context
    4. Return only matching guidelines (focused context)

    Example:
        ```python
        evaluator = GuardrailsEvaluator(es_client, config)

        context = TaskContext(
            agent="backend",
            domain="P01",
            action="implement",
            paths=["src/workers/agent.py"]
        )

        guidelines = await evaluator.get_context(context)
        # Returns only guidelines that match this context
        ```
    """

    def __init__(
        self,
        es_client: AsyncElasticsearch,
        config: GuardrailsConfig,
    ) -> None:
        """Initialize the evaluator."""

    async def get_context(
        self,
        context: TaskContext,
    ) -> list[EvaluatedGuideline]:
        """Get all guidelines matching the task context.

        Args:
            context: The task context to evaluate against.

        Returns:
            List of matching guidelines, sorted by priority (highest first).
        """

    async def log_decision(
        self,
        guideline: Guideline,
        context: TaskContext,
        decision: GateDecision,
    ) -> str:
        """Log a gate decision for audit purposes.

        Args:
            guideline: The guideline that triggered the gate.
            context: The task context.
            decision: The decision made (approve/reject/defer).

        Returns:
            The audit log entry ID.
        """
```

### 5.2 Evaluation Logic

```python
async def get_context(
    self,
    context: TaskContext,
) -> list[EvaluatedGuideline]:
    """Evaluate guidelines against context."""

    # Step 1: Fetch all enabled guidelines
    guidelines = await self._fetch_enabled_guidelines()

    # Step 2: Evaluate each guideline's condition
    matching = []
    for guideline in guidelines:
        if self._condition_matches(guideline.condition, context):
            matching.append(EvaluatedGuideline(
                guideline=guideline,
                matched_conditions=self._get_matched_conditions(
                    guideline.condition, context
                ),
            ))

    # Step 3: Sort by priority (highest first)
    matching.sort(key=lambda g: g.guideline.priority, reverse=True)

    # Step 4: Resolve conflicts (higher priority wins)
    resolved = self._resolve_conflicts(matching)

    return resolved

def _condition_matches(
    self,
    condition: GuidelineCondition,
    context: TaskContext,
) -> bool:
    """Check if condition matches context.

    All specified fields must match (AND logic).
    Lists within fields use OR logic (any match).
    None/empty fields are wildcards (always match).
    """
    # Agent match
    if condition.agents and context.agent not in condition.agents:
        return False

    # Domain match
    if condition.domains and context.domain not in condition.domains:
        return False

    # Action match
    if condition.actions and context.action not in condition.actions:
        return False

    # Path match (glob patterns)
    if condition.paths and context.paths:
        if not any(
            fnmatch.fnmatch(path, pattern)
            for path in context.paths
            for pattern in condition.paths
        ):
            return False

    # Event match
    if condition.events and context.event not in condition.events:
        return False

    # Gate type match
    if condition.gate_types and context.gate_type not in condition.gate_types:
        return False

    return True
```

## 6. MCP Extension

### 6.1 New Tools

Extend the existing `KnowledgeStoreMCPServer` with guardrails tools:

```python
# Additional tools for guardrails

async def guardrails_get_context(
    self,
    agent: str,
    domain: str | None = None,
    action: str | None = None,
    paths: list[str] | None = None,
    event: str | None = None,
) -> dict[str, Any]:
    """Get applicable guidelines for the current task context.

    Args:
        agent: Current agent role (planner, backend, frontend, etc.)
        domain: Domain identifier (P01, P05, etc.)
        action: Action type (design, implement, review, deploy)
        paths: File paths being accessed
        event: Triggering event (commit, deploy, gate, etc.)

    Returns:
        Dict with matching guidelines and instructions:
        {
            "success": true,
            "count": 3,
            "guidelines": [
                {
                    "id": "cognitive-backend",
                    "name": "Backend Cognitive Isolation",
                    "instruction": "You are the backend agent...",
                    "tools_allowed": ["Bash(python*)", ...],
                    "tools_denied": [...],
                    "priority": 100
                }
            ],
            "combined_instruction": "...",  # Merged instructions
            "tools_allowed": [...],          # Aggregated allowed
            "tools_denied": [...]            # Aggregated denied
        }
    """

async def guardrails_log_decision(
    self,
    guideline_id: str,
    context: dict[str, Any],
    result: str,
    reason: str,
    user_response: str | None = None,
) -> dict[str, Any]:
    """Log a gate decision for audit.

    Args:
        guideline_id: ID of the guideline that triggered the gate
        context: Task context when decision was made
        result: Decision result (approved, rejected, deferred)
        reason: Reason for the decision
        user_response: User's response if HITL gate

    Returns:
        Dict with audit log entry ID:
        {
            "success": true,
            "audit_id": "audit-123"
        }
    """
```

### 6.2 Tool Schemas

```python
def get_tool_schemas(self) -> list[dict[str, Any]]:
    """Get MCP tool schema definitions."""
    return [
        # ... existing ks_* tools ...

        {
            "name": "guardrails_get_context",
            "description": "Get applicable guidelines for the current task context",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent": {
                        "type": "string",
                        "description": "Current agent role",
                        "enum": ["planner", "backend", "frontend", "reviewer", "orchestrator", "devops"]
                    },
                    "domain": {
                        "type": "string",
                        "description": "Domain identifier (P01, P05, etc.)"
                    },
                    "action": {
                        "type": "string",
                        "description": "Action type",
                        "enum": ["design", "implement", "review", "test", "deploy", "document"]
                    },
                    "paths": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "File paths being accessed"
                    },
                    "event": {
                        "type": "string",
                        "description": "Triggering event"
                    }
                },
                "required": ["agent"]
            }
        },
        {
            "name": "guardrails_log_decision",
            "description": "Log a gate decision for audit purposes",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "guideline_id": {
                        "type": "string",
                        "description": "Guideline ID that triggered the gate"
                    },
                    "context": {
                        "type": "object",
                        "description": "Task context when decision was made"
                    },
                    "result": {
                        "type": "string",
                        "enum": ["approved", "rejected", "deferred"],
                        "description": "Decision result"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for the decision"
                    },
                    "user_response": {
                        "type": "string",
                        "description": "User's response if HITL gate"
                    }
                },
                "required": ["guideline_id", "context", "result", "reason"]
            }
        }
    ]
```

## 7. REST API

### 7.1 Endpoints

Add to `src/orchestrator/routes/`:

```python
# src/orchestrator/routes/guardrails_api.py

@router.get("/guardrails")
async def list_guidelines(
    category: GuidelineCategory | None = None,
    enabled: bool | None = None,
    page: int = 1,
    page_size: int = 20,
) -> GuidelinesListResponse:
    """List all guidelines with optional filtering."""

@router.get("/guardrails/{guideline_id}")
async def get_guideline(guideline_id: str) -> GuidelineResponse:
    """Get a specific guideline by ID."""

@router.post("/guardrails")
async def create_guideline(guideline: GuidelineCreate) -> GuidelineResponse:
    """Create a new guideline."""

@router.put("/guardrails/{guideline_id}")
async def update_guideline(
    guideline_id: str,
    guideline: GuidelineUpdate,
) -> GuidelineResponse:
    """Update an existing guideline."""

@router.delete("/guardrails/{guideline_id}")
async def delete_guideline(guideline_id: str) -> DeleteResponse:
    """Delete a guideline."""

@router.post("/guardrails/{guideline_id}/toggle")
async def toggle_guideline(guideline_id: str) -> GuidelineResponse:
    """Toggle a guideline's enabled status."""

@router.get("/guardrails/audit")
async def list_audit_logs(
    guideline_id: str | None = None,
    event_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> AuditLogsResponse:
    """List audit log entries."""

@router.post("/guardrails/evaluate")
async def evaluate_context(context: TaskContextRequest) -> EvaluatedContextResponse:
    """Evaluate guidelines for a given context (for testing)."""

@router.post("/guardrails/import")
async def import_guidelines(guidelines: list[GuidelineCreate]) -> ImportResponse:
    """Bulk import guidelines."""

@router.get("/guardrails/export")
async def export_guidelines(
    category: GuidelineCategory | None = None,
) -> list[GuidelineExport]:
    """Export guidelines for backup or sharing."""
```

### 7.2 Request/Response Models

```python
# src/orchestrator/models/guardrails.py

class GuidelineCreate(BaseModel):
    """Request model for creating a guideline."""
    id: str
    name: str
    description: str
    enabled: bool = True
    category: GuidelineCategory
    priority: int = Field(ge=0, le=1000, default=500)
    condition: GuidelineConditionModel
    action: GuidelineActionModel
    metadata: dict[str, Any] = Field(default_factory=dict)

class GuidelineUpdate(BaseModel):
    """Request model for updating a guideline."""
    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    priority: int | None = Field(ge=0, le=1000, default=None)
    condition: GuidelineConditionModel | None = None
    action: GuidelineActionModel | None = None
    metadata: dict[str, Any] | None = None
    version: int  # For optimistic locking

class GuidelineResponse(BaseModel):
    """Response model for a guideline."""
    id: str
    name: str
    description: str
    enabled: bool
    category: GuidelineCategory
    priority: int
    condition: GuidelineConditionModel
    action: GuidelineActionModel
    metadata: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: str

class GuidelinesListResponse(BaseModel):
    """Response model for listing guidelines."""
    guidelines: list[GuidelineResponse]
    total: int
    page: int
    page_size: int

class EvaluatedContextResponse(BaseModel):
    """Response from evaluating a context."""
    matching_guidelines: list[GuidelineResponse]
    combined_instruction: str
    tools_allowed: list[str]
    tools_denied: list[str]
    gates_required: list[dict[str, Any]]
```

## 8. HITL UI Components

### 8.1 Component Architecture

```
docker/hitl-ui/src/
  components/
    guardrails/
      GuardrailsPage.tsx           # Main configuration page
      GuardrailsPage.test.tsx
      GuidelinesList.tsx           # List of guidelines with filters
      GuidelinesList.test.tsx
      GuidelineCard.tsx            # Card showing guideline summary
      GuidelineCard.test.tsx
      GuidelineEditor.tsx          # Create/edit form
      GuidelineEditor.test.tsx
      ConditionBuilder.tsx         # Visual condition builder
      ConditionBuilder.test.tsx
      ActionBuilder.tsx            # Visual action builder
      ActionBuilder.test.tsx
      GuidelinePreview.tsx         # Preview evaluated context
      GuidelinePreview.test.tsx
      AuditLogViewer.tsx           # Audit log display
      AuditLogViewer.test.tsx
      ImportExportPanel.tsx        # Import/export controls
      ImportExportPanel.test.tsx
      index.ts                     # Barrel export
  api/
    guardrails.ts                  # API client functions
    guardrails.test.ts
    mocks/
      guardrails.ts                # Mock data for development
  stores/
    guardrailsStore.ts             # Zustand store
    guardrailsStore.test.ts
  pages/
    GuardrailsPage.tsx             # Route page
```

### 8.2 Page Layout

```
+----------------------------------------------------------+
| Header: "Guardrails Configuration"      [Import] [Export] |
+----------------------------------------------------------+
| Filters: [Category v] [Enabled v] [Search...        ]    |
+----------------------------------------------------------+
| Guidelines List                    | Editor Panel        |
| +--------------------------------+ | +------------------+ |
| | [x] Backend Isolation     100  | | | Name: [        ] | |
| |     backend, P01-P03           | | | Category: [   v] | |
| | +--------------------------------+ | | Priority: [   ] | |
| | [ ] Frontend Isolation     100 | | |                  | |
| |     frontend, P05              | | | Condition:       | |
| | +--------------------------------+ | |   Agents: [   ] | |
| | [x] HITL DevOps Gate       900 | | |   Domains: [  ] | |
| |     devops, deploy             | | |   ...            | |
| +--------------------------------+ | |                  | |
|                                    | | Action:          | |
| [+ New Guideline]                  | |   Type: [     v] | |
|                                    | |   Instruction:   | |
|                                    | |   [            ] | |
|                                    | |                  | |
|                                    | | [Cancel] [Save]  | |
+----------------------------------------------------------+
| Audit Log (collapsible)                                  |
| +------------------------------------------------------+ |
| | 2026-02-05 10:30 | devops-gate | approved | user: Y  | |
| | 2026-02-05 10:25 | backend-iso | applied  | auto     | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

### 8.3 Component Specifications

#### GuidelinesList

```typescript
interface GuidelinesListProps {
  guidelines: Guideline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  isLoading: boolean;
  filters: GuidelineFilters;
  onFiltersChange: (filters: GuidelineFilters) => void;
}
```

**Features:**
- Sortable by priority, name, category
- Category badges with colors
- Enable/disable toggle per guideline
- Search by name/description
- Filter by category and enabled status

#### GuidelineEditor

```typescript
interface GuidelineEditorProps {
  guideline: Guideline | null;  // null for new
  onSave: (guideline: GuidelineCreate | GuidelineUpdate) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}
```

**Features:**
- Form validation with error messages
- Priority slider (0-1000)
- Condition builder with visual feedback
- Action builder with type-specific fields
- Preview mode showing evaluated result
- Version conflict detection

#### ConditionBuilder

```typescript
interface ConditionBuilderProps {
  condition: GuidelineCondition;
  onChange: (condition: GuidelineCondition) => void;
}
```

**Features:**
- Multi-select for agents, domains, actions
- Path pattern input with glob preview
- Event type selection
- Custom condition JSON editor (advanced)

#### AuditLogViewer

```typescript
interface AuditLogViewerProps {
  guidelineId?: string;  // Filter to specific guideline
  dateRange?: { from: string; to: string };
}
```

**Features:**
- Time-based filtering
- Event type filtering
- Expandable details per entry
- Export to CSV

### 8.4 TypeScript Types

```typescript
// src/api/types.ts additions

export interface Guideline {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: GuidelineCategory;
  priority: number;
  condition: GuidelineCondition;
  action: GuidelineAction;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type GuidelineCategory =
  | 'cognitive_isolation'
  | 'hitl_gate'
  | 'tdd_protocol'
  | 'context_constraint'
  | 'audit_telemetry'
  | 'security'
  | 'custom';

export interface GuidelineCondition {
  agents?: string[];
  domains?: string[];
  actions?: string[];
  paths?: string[];
  events?: string[];
  gateTypes?: string[];
  custom?: Record<string, unknown>;
}

export interface GuidelineAction {
  type: ActionType;
  instruction?: string;
  toolsAllowed?: string[];
  toolsDenied?: string[];
  gateType?: string;
  gateThreshold?: 'mandatory' | 'advisory';
  maxFiles?: number;
  requireTests?: boolean;
  requireReview?: boolean;
  parameters?: Record<string, unknown>;
}

export type ActionType =
  | 'instruction'
  | 'tool_restriction'
  | 'hitl_gate'
  | 'constraint'
  | 'telemetry';

export interface AuditLogEntry {
  id: string;
  eventType: 'decision' | 'config_change';
  timestamp: string;
  guidelineId: string;
  guidelineName: string;
  context: {
    agent: string;
    domain?: string;
    action?: string;
    sessionId?: string;
  };
  decision?: {
    result: 'approved' | 'rejected' | 'deferred';
    reason: string;
    userResponse?: string;
  };
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
  actor: string;
}
```


### 8.4.1 JSON Casing Convention

Because the frontend TypeScript types (Section 8.4) use camelCase  
(e.g., `createdAt`, `toolsAllowed`, `gateThreshold`), the public REST API  
MUST also use camelCase in all JSON payloads.

Python models should remain snake_case internally.  
Conversion to camelCase MUST be handled automatically via Pydantic using
`alias_generator=to_camel`.

Recommended base model:

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class BaseAPIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )
```
All API-facing models SHOULD inherit from `BaseAPIModel` to ensure consistent
camelCase JSON output.



### 8.5 Store Design

```typescript
// src/stores/guardrailsStore.ts

interface GuardrailsState {
  // Guidelines
  guidelines: Guideline[];
  selectedGuidelineId: string | null;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: {
    category: GuidelineCategory | null;
    enabled: boolean | null;
    search: string;
  };

  // Editor
  isEditorOpen: boolean;
  editingGuideline: Guideline | null;
  isSaving: boolean;

  // Audit
  auditLogs: AuditLogEntry[];
  isAuditExpanded: boolean;

  // Actions
  setGuidelines: (guidelines: Guideline[]) => void;
  selectGuideline: (id: string | null) => void;
  setFilters: (filters: Partial<GuardrailsState['filters']>) => void;
  openEditor: (guideline: Guideline | null) => void;
  closeEditor: () => void;
  setAuditLogs: (logs: AuditLogEntry[]) => void;
  toggleAudit: () => void;
}
```

## 9. Default Guidelines

### 9.1 Migration from Rules

Convert existing `.claude/rules/*.md` to default guidelines:

| Rule File | Guideline ID | Category |
|-----------|--------------|----------|
| `pm-cli.md` | `cognitive-pm-cli` | cognitive_isolation |
| `workflow.md` | `workflow-11-step` | context_constraint |
| `hitl-gates.md` | `hitl-devops`, `hitl-protected-path`, etc. | hitl_gate |
| `permissions.md` | `permission-workstation`, `permission-container` | security |
| `trunk-based-development.md` | `tdd-commit-protocol` | tdd_protocol |

### 9.2 Bootstrap Script

```python
async def bootstrap_default_guidelines(evaluator: GuardrailsEvaluator) -> None:
    """Load default guidelines from rules files.

    This converts the static .claude/rules/*.md files into
    dynamic guidelines stored in Elasticsearch.
    """
    defaults = [
        Guideline(
            id="cognitive-planner",
            name="Planner Cognitive Isolation",
            description="Restricts planner agent to planning artifacts only",
            enabled=True,
            category=GuidelineCategory.COGNITIVE_ISOLATION,
            priority=100,
            condition=GuidelineCondition(agents=["planner"]),
            action=GuidelineAction(
                type=ActionType.INSTRUCTION,
                instruction="You are the Planner. Create work items only. Do not write implementation code.",
                tools_denied=["Write(src/*)", "Write(tests/*)"],
            ),
            ...
        ),
        # ... more default guidelines
    ]

    for guideline in defaults:
        await evaluator.upsert_guideline(guideline)
```

## 10. File Structure

```
src/
  core/
    guardrails/
      __init__.py
      models.py              # Guideline, Condition, Action dataclasses
      evaluator.py           # GuardrailsEvaluator class
      config.py              # GuardrailsConfig
      exceptions.py          # Guardrails-specific exceptions
  infrastructure/
    knowledge_store/
      mcp_server.py          # Add guardrails_* tools
      guardrails_store.py    # Elasticsearch operations for guardrails
  orchestrator/
    routes/
      guardrails_api.py      # REST API endpoints
    models/
      guardrails.py          # Pydantic request/response models
    services/
      guardrails_service.py  # Business logic layer

docker/hitl-ui/src/
  api/
    guardrails.ts            # API client
    guardrails.test.ts
    mocks/
      guardrails.ts          # Mock data
  components/
    guardrails/              # All guardrails components
  stores/
    guardrailsStore.ts       # Zustand store
    guardrailsStore.test.ts
  pages/
    GuardrailsPage.tsx       # Route page

tests/
  unit/
    core/
      guardrails/
        test_models.py
        test_evaluator.py
    orchestrator/
      routes/
        test_guardrails_api.py
  integration/
    test_guardrails_store.py
    test_guardrails_mcp.py
```

## 11. Security Considerations

1. **Guideline Validation**: Validate all guideline inputs to prevent injection
2. **Path Pattern Safety**: Sanitize glob patterns to prevent directory traversal
3. **Tool Restriction**: Deny patterns take precedence over allow patterns
4. **Audit Trail**: All changes logged for compliance
5. **Version Control**: Optimistic locking prevents concurrent modification

## 12. Performance Considerations

1. **Caching**: Cache enabled guidelines with TTL (5 minutes)
2. **Batch Evaluation**: Evaluate all guidelines in single ES query
3. **Index Optimization**: Use keyword fields for condition matching
4. **Lazy Loading**: Load audit logs on demand

## 13. Testing Strategy

### 13.1 Unit Tests

- Guideline model validation
- Condition matching logic
- Action merging logic
- Priority conflict resolution

### 13.2 Integration Tests

- Elasticsearch CRUD operations
- MCP tool invocation
- REST API endpoints
- Full evaluation flow

### 13.3 UI Tests

- Component rendering
- Form validation
- Store actions
- API integration with mocks

## 14. Migration Path

1. **Phase 1**: Deploy ES indices and models (no impact)
2. **Phase 2**: Add MCP tools (backward compatible)
3. **Phase 3**: Add REST API (new endpoints)
4. **Phase 4**: Deploy UI (feature flag)
5. **Phase 5**: Bootstrap default guidelines
6. **Phase 6**: Agents start using guardrails_get_context

## 15. Open Questions

1. Should guidelines support inheritance (base + override)?
2. Should we support guideline templates for common patterns?
3. How should we handle guideline version history?
4. Should there be a "dry run" mode for testing guidelines?

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Misconfigured guideline blocks agents | High | Validation, preview, audit trail |
| Performance degradation from ES queries | Medium | Caching, index optimization |
| UI complexity overwhelms users | Medium | Progressive disclosure, defaults |
| Migration from rules breaks workflows | High | Gradual rollout, feature flag |
