"""Prompt templates for the Architect Agent.

Provides prompts for component design, interface definition,
diagram generation, and NFR validation.
"""

from __future__ import annotations


ARCHITECT_SYSTEM_PROMPT = """You are a Solution Architect Agent specializing in designing software architectures.

Your role is to:
1. Design component-based architectures from technology surveys and PRDs
2. Define clear interfaces between components
3. Generate Mermaid diagrams for visualization
4. Validate designs against non-functional requirements (NFRs)

You always respond with valid JSON matching the requested schema.
Use established architectural patterns and justify design decisions.
Generate valid Mermaid diagram syntax for all diagrams.
"""


def format_component_design_prompt(
    tech_survey: str,
    prd_content: str,
    context_pack_summary: str = "",
) -> str:
    """Format the component design prompt.

    Args:
        tech_survey: Technology survey JSON content.
        prd_content: PRD document content.
        context_pack_summary: Summary from repo mapper context pack.

    Returns:
        str: Formatted prompt for component design.
    """
    context_section = ""
    if context_pack_summary:
        context_section = f"""
## Existing Codebase Context
{context_pack_summary}
"""

    return f"""Design a component-based architecture for the system described in the PRD.

## Technology Survey
{tech_survey}

## PRD Document
{prd_content}
{context_section}

## Task
Design the system architecture by:
1. Identifying major components and their responsibilities
2. Defining boundaries and interfaces
3. Specifying technology choices per component
4. Identifying dependencies between components

Consider:
- Single Responsibility Principle for components
- Loose coupling between components
- Clear API contracts at boundaries
- Scalability and maintainability

Respond with JSON matching this schema:
```json
{{
  "architecture_style": "monolith | microservices | event_driven | serverless | layered | modular_monolith",
  "style_rationale": "string explaining the style choice",
  "components": [
    {{
      "name": "string (PascalCase, e.g., 'UserService')",
      "responsibility": "string (single sentence)",
      "technology": "string (from tech survey)",
      "interfaces": [
        {{
          "name": "string (e.g., 'IUserRepository')",
          "description": "string",
          "methods": ["method signatures"],
          "data_types": ["types used"]
        }}
      ],
      "dependencies": ["list of component names this depends on"],
      "notes": "optional implementation notes"
    }}
  ],
  "data_flows": [
    {{
      "source": "component name",
      "target": "component name",
      "data_type": "string",
      "description": "string",
      "protocol": "REST | gRPC | async | event | direct"
    }}
  ],
  "deployment_model": "string describing deployment strategy"
}}
```
"""


def format_interface_definition_prompt(
    components: str,
    tech_survey: str,
) -> str:
    """Format the interface definition prompt.

    Args:
        components: JSON string of component definitions.
        tech_survey: Technology survey JSON content.

    Returns:
        str: Formatted prompt for interface definition.
    """
    return f"""Define detailed interfaces for the architecture components.

## Components
{components}

## Technology Survey
{tech_survey}

## Task
For each component interface, define:
1. Complete method signatures with types
2. Request/response data structures
3. Error handling patterns
4. Versioning strategy

Respond with JSON matching this schema:
```json
{{
  "interfaces": [
    {{
      "component": "string (component name)",
      "interface_name": "string",
      "version": "string (e.g., 'v1')",
      "methods": [
        {{
          "name": "string",
          "description": "string",
          "parameters": [
            {{"name": "string", "type": "string", "required": true}}
          ],
          "returns": {{"type": "string", "description": "string"}},
          "errors": ["list of possible errors"]
        }}
      ],
      "data_types": [
        {{
          "name": "string",
          "fields": [
            {{"name": "string", "type": "string", "description": "string"}}
          ]
        }}
      ]
    }}
  ],
  "shared_types": [
    {{
      "name": "string",
      "description": "string",
      "fields": []
    }}
  ]
}}
```
"""


def format_diagram_generation_prompt(
    architecture: str,
    diagram_types: list[str] | None = None,
) -> str:
    """Format the diagram generation prompt.

    Args:
        architecture: JSON string of architecture definition.
        diagram_types: Optional list of diagram types to generate.

    Returns:
        str: Formatted prompt for diagram generation.
    """
    if diagram_types is None:
        diagram_types = ["component", "sequence", "deployment"]

    types_list = ", ".join(diagram_types)

    return f"""Generate Mermaid diagrams for the architecture.

## Architecture
{architecture}

## Required Diagrams
Generate the following diagram types: {types_list}

## Task
Create valid Mermaid diagrams that visualize:
1. Component diagram - showing all components and their relationships
2. Sequence diagram - showing a key workflow
3. Deployment diagram - showing infrastructure layout (if applicable)

Use proper Mermaid syntax. Ensure diagrams are clear and readable.

Respond with JSON matching this schema:
```json
{{
  "diagrams": [
    {{
      "diagram_type": "component | sequence | flow | erd | deployment | class",
      "title": "string",
      "description": "string explaining what the diagram shows",
      "mermaid_code": "string (valid Mermaid syntax)"
    }}
  ]
}}
```

## Mermaid Syntax Examples

Component diagram:
```mermaid
graph TB
    subgraph Frontend
        UI[Web UI]
    end
    subgraph Backend
        API[API Gateway]
        SVC[Service Layer]
    end
    UI --> API
    API --> SVC
```

Sequence diagram:
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: Request
    API->>DB: Query
    DB-->>API: Result
    API-->>Client: Response
```
"""


def format_nfr_validation_prompt(
    architecture: str,
    nfr_requirements: str,
) -> str:
    """Format the NFR validation prompt.

    Args:
        architecture: JSON string of architecture definition.
        nfr_requirements: Non-functional requirements from PRD.

    Returns:
        str: Formatted prompt for NFR validation.
    """
    return f"""Validate the architecture against non-functional requirements.

## Architecture
{architecture}

## Non-Functional Requirements
{nfr_requirements}

## Task
For each NFR, evaluate:
1. How the architecture addresses the requirement
2. Any gaps or concerns
3. Recommendations for improvement

Consider these NFR categories:
- Performance (latency, throughput)
- Scalability (horizontal, vertical)
- Reliability (fault tolerance, recovery)
- Security (authentication, authorization, data protection)
- Maintainability (modularity, testability)
- Observability (logging, monitoring, tracing)

Respond with JSON matching this schema:
```json
{{
  "nfr_evaluation": [
    {{
      "requirement": "string (the NFR)",
      "category": "performance | scalability | reliability | security | maintainability | observability",
      "status": "satisfied | partially_satisfied | not_addressed",
      "how_addressed": "string explaining how architecture meets the requirement",
      "gaps": ["list of gaps or concerns"],
      "recommendations": ["list of recommendations"]
    }}
  ],
  "security_considerations": [
    "list of security-specific notes"
  ],
  "overall_assessment": {{
    "score": 1-5,
    "summary": "string",
    "critical_gaps": ["any critical gaps that must be addressed"]
  }}
}}
```
"""


def format_architecture_refinement_prompt(
    architecture: str,
    nfr_evaluation: str,
    feedback: str = "",
) -> str:
    """Format the architecture refinement prompt.

    Args:
        architecture: Current architecture JSON.
        nfr_evaluation: NFR evaluation results.
        feedback: Optional feedback from review.

    Returns:
        str: Formatted prompt for architecture refinement.
    """
    feedback_section = ""
    if feedback:
        feedback_section = f"""
## Review Feedback
{feedback}
"""

    return f"""Refine the architecture based on NFR evaluation and feedback.

## Current Architecture
{architecture}

## NFR Evaluation
{nfr_evaluation}
{feedback_section}

## Task
Refine the architecture to address:
1. Critical gaps from NFR evaluation
2. Security considerations
3. Any feedback provided

Maintain backward compatibility where possible.
Document changes and their rationale.

Respond with the same architecture schema, plus a changes section:
```json
{{
  "architecture_style": "...",
  "components": [...],
  "data_flows": [...],
  "deployment_model": "...",
  "changes_made": [
    {{
      "component": "string (or 'global')",
      "change": "string describing change",
      "rationale": "string explaining why"
    }}
  ]
}}
```
"""


# Example outputs for few-shot learning
COMPONENT_DESIGN_EXAMPLE = """
Example output:
{
  "architecture_style": "modular_monolith",
  "style_rationale": "Allows rapid development while maintaining clear boundaries for future extraction",
  "components": [
    {
      "name": "APIGateway",
      "responsibility": "Handle HTTP requests and route to appropriate modules",
      "technology": "FastAPI",
      "interfaces": [
        {
          "name": "IRequestHandler",
          "description": "HTTP request processing",
          "methods": ["handle_request(request: Request) -> Response"],
          "data_types": ["Request", "Response"]
        }
      ],
      "dependencies": ["AuthModule", "UserModule"],
      "notes": "Implements rate limiting and request validation"
    }
  ],
  "data_flows": [
    {
      "source": "APIGateway",
      "target": "UserModule",
      "data_type": "UserRequest",
      "description": "User-related API calls",
      "protocol": "direct"
    }
  ],
  "deployment_model": "Container-based deployment with horizontal scaling"
}
"""


DIAGRAM_EXAMPLE = """
Example component diagram:
{
  "diagrams": [
    {
      "diagram_type": "component",
      "title": "System Architecture",
      "description": "High-level component view of the system",
      "mermaid_code": "graph TB\\n    subgraph Presentation\\n        UI[Web UI]\\n        Mobile[Mobile App]\\n    end\\n    subgraph Application\\n        API[API Gateway]\\n        Auth[Auth Service]\\n        Core[Core Service]\\n    end\\n    subgraph Data\\n        DB[(PostgreSQL)]\\n        Cache[(Redis)]\\n    end\\n    UI --> API\\n    Mobile --> API\\n    API --> Auth\\n    API --> Core\\n    Core --> DB\\n    Core --> Cache"
    }
  ]
}
"""
