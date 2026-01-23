"""Prompt templates for the Planner Agent.

Provides prompts for task breakdown, dependency analysis,
and complexity estimation.
"""

from __future__ import annotations


PLANNER_SYSTEM_PROMPT = """You are an Implementation Planner Agent specializing in breaking down software architectures into actionable tasks.

Your role is to:
1. Analyze architecture documents and break them into implementation tasks
2. Identify task dependencies and create a dependency graph
3. Estimate complexity for each task
4. Calculate the critical path for the project

You always respond with valid JSON matching the requested schema.
Tasks should be atomic (completable in 2-8 hours), well-defined, and testable.
"""


def format_task_breakdown_prompt(
    architecture: str,
    prd_content: str,
    acceptance_criteria: str = "",
) -> str:
    """Format the task breakdown prompt.

    Args:
        architecture: Architecture document JSON.
        prd_content: PRD document content.
        acceptance_criteria: Optional acceptance criteria.

    Returns:
        str: Formatted prompt for task breakdown.
    """
    ac_section = ""
    if acceptance_criteria:
        ac_section = f"""
## Acceptance Criteria
{acceptance_criteria}
"""

    return f"""Break down the architecture into implementation tasks.

## Architecture Document
{architecture}

## PRD Document
{prd_content}
{ac_section}

## Task
Create atomic implementation tasks for each component:
1. One task per significant piece of functionality
2. Tasks should be completable in 2-8 hours
3. Each task should have clear acceptance criteria
4. Group tasks by component

Consider:
- Infrastructure setup tasks first
- Core functionality before features
- Integration tasks after individual components
- Testing tasks alongside implementation

Respond with JSON matching this schema:
```json
{{
  "tasks": [
    {{
      "id": "string (e.g., 'T001')",
      "title": "string (concise, actionable)",
      "description": "string (detailed explanation)",
      "component": "string (target component name)",
      "dependencies": ["list of task IDs this depends on"],
      "acceptance_criteria": [
        "list of specific, testable criteria"
      ],
      "estimated_complexity": "S | M | L | XL"
    }}
  ],
  "total_task_count": 0,
  "components_covered": ["list of component names"]
}}
```

## Complexity Guide
- S (Small): 2-4 hours, straightforward implementation
- M (Medium): 4-8 hours, moderate complexity
- L (Large): 8-16 hours, complex implementation
- XL (Extra Large): 16+ hours, should consider splitting
"""


def format_dependency_analysis_prompt(
    tasks: str,
    architecture: str,
) -> str:
    """Format the dependency analysis prompt.

    Args:
        tasks: JSON string of task definitions.
        architecture: Architecture document JSON.

    Returns:
        str: Formatted prompt for dependency analysis.
    """
    return f"""Analyze and refine task dependencies.

## Tasks
{tasks}

## Architecture
{architecture}

## Task
Review and refine the task dependencies:
1. Identify missing dependencies
2. Remove unnecessary dependencies (reduce coupling)
3. Detect circular dependencies and resolve them
4. Identify parallelizable tasks

Respond with JSON matching this schema:
```json
{{
  "refined_dependencies": [
    {{
      "task_id": "string",
      "dependencies": ["refined list of task IDs"],
      "reason": "string explaining changes if any"
    }}
  ],
  "circular_dependencies": [
    {{
      "cycle": ["list of task IDs in cycle"],
      "resolution": "string explaining how to break the cycle"
    }}
  ],
  "parallelizable_groups": [
    {{
      "group_name": "string",
      "task_ids": ["tasks that can run in parallel"],
      "prerequisite": "task ID that must complete first"
    }}
  ],
  "dependency_graph": {{
    "task_id": ["list of tasks that depend on this task"]
  }}
}}
```
"""


def format_complexity_estimation_prompt(
    tasks: str,
    tech_survey: str,
) -> str:
    """Format the complexity estimation prompt.

    Args:
        tasks: JSON string of task definitions.
        tech_survey: Technology survey JSON.

    Returns:
        str: Formatted prompt for complexity estimation.
    """
    return f"""Estimate complexity for each task.

## Tasks
{tasks}

## Technology Survey
{tech_survey}

## Task
For each task, estimate complexity considering:
1. Technical difficulty (algorithms, integrations)
2. Risk and uncertainty
3. Testing requirements
4. Team familiarity with technology (from tech survey)

Respond with JSON matching this schema:
```json
{{
  "estimations": [
    {{
      "task_id": "string",
      "complexity": "S | M | L | XL",
      "hours_estimate": 0,
      "risk_level": "low | medium | high",
      "factors": [
        "list of factors affecting complexity"
      ],
      "recommendations": [
        "any recommendations to reduce complexity"
      ]
    }}
  ],
  "total_hours": 0,
  "high_risk_tasks": ["list of task IDs with high risk"],
  "complexity_distribution": {{
    "S": 0,
    "M": 0,
    "L": 0,
    "XL": 0
  }}
}}
```

## Hours Guide
- S: 2-4 hours
- M: 4-8 hours
- L: 8-16 hours
- XL: 16+ hours (consider splitting)
"""


def format_critical_path_prompt(
    tasks: str,
    dependency_graph: str,
) -> str:
    """Format the critical path calculation prompt.

    Args:
        tasks: JSON string of task definitions with estimations.
        dependency_graph: JSON string of dependency graph.

    Returns:
        str: Formatted prompt for critical path calculation.
    """
    return f"""Calculate the critical path for the project.

## Tasks with Estimations
{tasks}

## Dependency Graph
{dependency_graph}

## Task
Calculate the critical path:
1. Find the longest path through the dependency graph
2. Identify tasks on the critical path
3. Calculate total project duration
4. Identify slack time for non-critical tasks

Respond with JSON matching this schema:
```json
{{
  "critical_path": ["ordered list of task IDs on critical path"],
  "critical_path_duration_hours": 0,
  "phases": [
    {{
      "name": "string (e.g., 'Phase 1: Infrastructure')",
      "description": "string",
      "task_ids": ["tasks in this phase"],
      "order": 1,
      "estimated_hours": 0
    }}
  ],
  "slack_analysis": [
    {{
      "task_id": "string",
      "slack_hours": 0,
      "can_delay": true
    }}
  ],
  "milestones": [
    {{
      "name": "string",
      "after_task": "task_id",
      "description": "string"
    }}
  ],
  "total_estimated_hours": 0,
  "parallel_efficiency": 0.0
}}
```
"""


def format_implementation_plan_prompt(
    tasks: str,
    critical_path: str,
    phases: str,
    architecture_reference: str,
) -> str:
    """Format the final implementation plan prompt.

    Args:
        tasks: JSON string of all tasks.
        critical_path: JSON string of critical path analysis.
        phases: JSON string of phase definitions.
        architecture_reference: Reference to architecture document.

    Returns:
        str: Formatted prompt for final plan generation.
    """
    return f"""Generate the final implementation plan.

## Tasks
{tasks}

## Critical Path Analysis
{critical_path}

## Phases
{phases}

## Architecture Reference
{architecture_reference}

## Task
Create a comprehensive implementation plan that:
1. Organizes tasks into logical phases
2. Highlights the critical path
3. Identifies key milestones
4. Provides clear execution order

Respond with JSON matching this schema:
```json
{{
  "architecture_reference": "string",
  "phases": [
    {{
      "name": "string",
      "description": "string",
      "task_ids": ["ordered task IDs for this phase"],
      "order": 1
    }}
  ],
  "tasks": [
    {{
      "id": "string",
      "title": "string",
      "description": "string",
      "component": "string",
      "dependencies": ["task IDs"],
      "acceptance_criteria": ["criteria"],
      "estimated_complexity": "S | M | L | XL"
    }}
  ],
  "critical_path": ["ordered task IDs"],
  "milestones": [
    {{
      "name": "string",
      "after_phase": 1,
      "deliverables": ["list of deliverables"]
    }}
  ],
  "total_estimated_effort": "string (e.g., '120 hours')"
}}
```
"""


# Example outputs for few-shot learning
TASK_BREAKDOWN_EXAMPLE = """
Example output:
{
  "tasks": [
    {
      "id": "T001",
      "title": "Setup project infrastructure",
      "description": "Initialize project structure, configure build tools, and set up development environment",
      "component": "Infrastructure",
      "dependencies": [],
      "acceptance_criteria": [
        "Project builds successfully",
        "CI pipeline configured",
        "Development environment documented"
      ],
      "estimated_complexity": "M"
    },
    {
      "id": "T002",
      "title": "Implement User model",
      "description": "Create User entity with validation, persistence layer, and basic CRUD operations",
      "component": "UserService",
      "dependencies": ["T001"],
      "acceptance_criteria": [
        "User model with required fields",
        "Database migrations created",
        "Unit tests for model validation"
      ],
      "estimated_complexity": "M"
    }
  ],
  "total_task_count": 2,
  "components_covered": ["Infrastructure", "UserService"]
}
"""


CRITICAL_PATH_EXAMPLE = """
Example output:
{
  "critical_path": ["T001", "T002", "T005", "T008", "T012"],
  "critical_path_duration_hours": 48,
  "phases": [
    {
      "name": "Phase 1: Foundation",
      "description": "Infrastructure and core setup",
      "task_ids": ["T001", "T002"],
      "order": 1,
      "estimated_hours": 12
    }
  ],
  "slack_analysis": [
    {
      "task_id": "T003",
      "slack_hours": 8,
      "can_delay": true
    }
  ],
  "milestones": [
    {
      "name": "Core Services Complete",
      "after_task": "T005",
      "description": "All core services implemented and tested"
    }
  ],
  "total_estimated_hours": 64,
  "parallel_efficiency": 0.75
}
"""
