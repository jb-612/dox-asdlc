"""Planner Agent for creating implementation plans.

Breaks down a PRD into features and atomic testable tasks.
Delegates work to a pluggable AgentBackend (Claude Code CLI,
Codex CLI, or direct LLM API calls).
"""

from __future__ import annotations

import json
import logging
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    ComplexityLevel,
    ImplementationPlan,
    ImplementationTask,
    Phase,
)
from src.workers.agents.design.prompts.planner_prompts import (
    PLANNER_SYSTEM_PROMPT,
)

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
PLANNER_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "features": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "component": {"type": "string"},
                                "dependencies": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "acceptance_criteria": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "estimated_complexity": {
                                    "type": "string",
                                    "enum": ["S", "M", "L", "XL"],
                                },
                            },
                            "required": ["id", "title", "description"],
                        },
                    },
                },
                "required": ["id", "name", "tasks"],
            },
        },
        "critical_path": {
            "type": "array",
            "items": {"type": "string"},
        },
        "phases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "task_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "order": {"type": "integer"},
                },
                "required": ["name", "task_ids", "order"],
            },
        },
    },
    "required": ["features"],
}


def _build_planner_prompt(
    prd_content: str,
    architecture: str = "",
    tech_survey: str = "",
    acceptance_criteria: str = "",
) -> str:
    """Build the prompt for the planner backend."""
    sections = [
        "Break down the following PRD into features and atomic testable tasks.",
        "",
        "## PRD Document",
        prd_content,
    ]

    if architecture:
        sections.extend(["", "## Architecture", architecture])

    if tech_survey:
        sections.extend(["", "## Technology Survey", tech_survey])

    if acceptance_criteria:
        sections.extend(["", "## Acceptance Criteria", acceptance_criteria])

    sections.extend([
        "",
        "## Instructions",
        "",
        "1. Identify distinct features in the PRD",
        "2. For each feature, create atomic tasks (completable in 2-8 hours)",
        "3. Each task must have clear acceptance criteria",
        "4. Identify dependencies between tasks",
        "5. Group tasks into sequential phases",
        "6. Calculate the critical path",
        "",
        "## Output Format",
        "",
        "Respond with valid JSON:",
        "```json",
        '{',
        '  "features": [',
        '    {',
        '      "id": "F01", "name": "Feature Name",',
        '      "description": "What this feature does",',
        '      "tasks": [',
        '        {',
        '          "id": "T001", "title": "Task title",',
        '          "description": "Detailed description",',
        '          "component": "target component",',
        '          "dependencies": [],',
        '          "acceptance_criteria": ["criterion 1"],',
        '          "estimated_complexity": "S|M|L|XL"',
        '        }',
        '      ]',
        '    }',
        '  ],',
        '  "phases": [{"name": "Phase 1", "task_ids": ["T001"], "order": 1}],',
        '  "critical_path": ["T001", "T002"]',
        '}',
        "```",
        "",
        "## Complexity Guide",
        "- S (Small): 2-4 hours, straightforward",
        "- M (Medium): 4-8 hours, moderate complexity",
        "- L (Large): 8-16 hours, complex (consider splitting)",
        "- XL (Extra Large): 16+ hours (must split)",
    ])

    return "\n".join(sections)


def _parse_plan_from_result(result: BackendResult) -> dict[str, Any] | None:
    """Parse implementation plan data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.
    """
    if result.structured_output and "features" in result.structured_output:
        return result.structured_output

    content = result.output
    if not content:
        return None

    # Direct JSON parse
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            if "features" in data:
                return data
            if "tasks" in data:
                return _convert_legacy_format(data)
    except json.JSONDecodeError:
        pass

    # Extract from code blocks
    import re

    for pattern in [r'```json\s*\n?(.*?)\n?```', r'```\s*\n?(.*?)\n?```']:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1).strip())
                if isinstance(data, dict):
                    if "features" in data:
                        return data
                    if "tasks" in data:
                        return _convert_legacy_format(data)
            except json.JSONDecodeError:
                continue

    # Last resort: find JSON object
    json_start = content.find('{')
    json_end = content.rfind('}')
    if json_start != -1 and json_end > json_start:
        try:
            data = json.loads(content[json_start:json_end + 1])
            if isinstance(data, dict):
                if "features" in data:
                    return data
                if "tasks" in data:
                    return _convert_legacy_format(data)
        except json.JSONDecodeError:
            pass

    return None


def _convert_legacy_format(data: dict[str, Any]) -> dict[str, Any]:
    """Convert legacy flat-tasks format to features format."""
    return {
        "features": [
            {
                "id": "F01",
                "name": "Implementation",
                "description": "All implementation tasks",
                "tasks": data.get("tasks", []),
            }
        ],
        "phases": data.get("phases", []),
        "critical_path": data.get("critical_path", []),
    }


def _build_implementation_plan(
    plan_data: dict[str, Any],
    architecture_reference: str,
) -> ImplementationPlan:
    """Build ImplementationPlan domain model from parsed data."""
    tasks: list[ImplementationTask] = []
    for feature in plan_data.get("features", []):
        for task_data in feature.get("tasks", []):
            complexity_str = task_data.get("estimated_complexity", "M")
            try:
                complexity = ComplexityLevel(complexity_str)
            except ValueError:
                complexity = ComplexityLevel.MEDIUM

            tasks.append(ImplementationTask(
                id=task_data.get("id", ""),
                title=task_data.get("title", ""),
                description=task_data.get("description", ""),
                component=task_data.get("component", feature.get("name", "")),
                dependencies=task_data.get("dependencies", []),
                acceptance_criteria=task_data.get("acceptance_criteria", []),
                estimated_complexity=complexity,
                metadata={"feature_id": feature.get("id", "")},
            ))

    phases: list[Phase] = []
    if "phases" in plan_data and plan_data["phases"]:
        for phase_data in plan_data["phases"]:
            phases.append(Phase(
                name=phase_data.get("name", ""),
                description=phase_data.get("description", ""),
                task_ids=phase_data.get("task_ids", []),
                order=phase_data.get("order", 0),
            ))
    else:
        for i, feature in enumerate(plan_data.get("features", []), 1):
            task_ids = [t.get("id", "") for t in feature.get("tasks", [])]
            phases.append(Phase(
                name=f"Phase {i}: {feature.get('name', 'Implementation')}",
                description=feature.get("description", ""),
                task_ids=task_ids,
                order=i,
            ))

    critical_path = plan_data.get("critical_path", [])

    return ImplementationPlan.create(
        architecture_reference=architecture_reference,
        phases=phases,
        tasks=tasks,
        critical_path=critical_path,
    )


class PlannerAgent:
    """Agent that breaks PRDs into features and atomic tasks.

    Delegates the actual planning work to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = PlannerAgent(backend=backend, artifact_writer=writer, config=config)
        result = await agent.execute(context, {"prd_content": "..."})
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        config: DesignConfig,
    ) -> None:
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        return "planner_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute planning from a PRD.

        Args:
            context: Execution context with session/task info.
            event_metadata: Must contain 'prd_content'. Optional:
                'architecture', 'tech_survey', 'acceptance_criteria'.

        Returns:
            AgentResult with artifact paths and feature/task counts.
        """
        logger.info(
            f"Planner Agent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        prd_content = event_metadata.get("prd_content", "")
        if not prd_content:
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message="No prd_content provided in event_metadata",
                should_retry=False,
            )

        prompt = _build_planner_prompt(
            prd_content=prd_content,
            architecture=event_metadata.get("architecture", ""),
            tech_survey=event_metadata.get("tech_survey", ""),
            acceptance_criteria=event_metadata.get("acceptance_criteria", ""),
        )

        backend_config = BackendConfig(
            max_turns=self._config.max_retries * 10,
            model=self._config.planner_model,
            output_schema=PLANNER_OUTPUT_SCHEMA,
            system_prompt=PLANNER_SYSTEM_PROMPT,
            timeout_seconds=300,
            allowed_tools=["Read", "Glob", "Grep"],
        )

        try:
            result = await self._backend.execute(
                prompt=prompt,
                workspace_path=context.workspace_path,
                config=backend_config,
            )
        except Exception as e:
            logger.error(f"Backend execution failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=f"Backend error: {e}",
                should_retry=True,
            )

        if not result.success:
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=result.error or "Backend execution failed",
                should_retry=True,
            )

        plan_data = _parse_plan_from_result(result)
        if not plan_data:
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message="Failed to parse plan from backend output",
                should_retry=True,
            )

        architecture_reference = event_metadata.get(
            "architecture_reference", f"ARCH-{context.task_id}"
        )
        plan = _build_implementation_plan(plan_data, architecture_reference)
        feature_count = len(plan_data.get("features", []))

        artifact_path = await self._write_artifact(context, plan)

        logger.info(
            f"Planner completed: {feature_count} features, "
            f"{len(plan.tasks)} tasks, {len(plan.phases)} phases"
        )

        return AgentResult(
            success=True,
            agent_type=self.agent_type,
            task_id=context.task_id,
            artifact_paths=[artifact_path],
            metadata={
                "feature_count": feature_count,
                "task_count": len(plan.tasks),
                "phase_count": len(plan.phases),
                "critical_path_length": len(plan.critical_path),
                "total_effort": plan.total_estimated_effort,
                "architecture_reference": architecture_reference,
                "backend": self._backend.backend_name,
                "cost_usd": result.cost_usd,
                "turns": result.turns,
                "session_id": result.session_id,
            },
        )

    async def _write_artifact(
        self,
        context: AgentContext,
        plan: ImplementationPlan,
    ) -> str:
        from src.workers.artifacts.writer import ArtifactType

        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=plan.to_json(),
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_implementation_plan.json",
        )

        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=plan.to_markdown(),
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_implementation_plan.md",
        )

        return json_path

    def validate_context(self, context: AgentContext) -> bool:
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
