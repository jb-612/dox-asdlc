"""Planner Agent for creating implementation plans.

Breaks down architecture into tasks, identifies dependencies,
estimates complexity, and calculates critical path.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext, AgentResult, BaseAgent
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    ComplexityLevel,
    ImplementationPlan,
    ImplementationTask,
    Phase,
)
from src.workers.agents.design.prompts.planner_prompts import (
    PLANNER_SYSTEM_PROMPT,
    format_task_breakdown_prompt,
    format_dependency_analysis_prompt,
    format_complexity_estimation_prompt,
    format_critical_path_prompt,
)

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


class PlannerAgentError(Exception):
    """Raised when Planner agent operations fail."""

    pass


class PlannerAgent:
    """Agent that creates implementation plans from architecture.

    Implements the BaseAgent protocol for worker pool dispatch. Uses LLM
    to break down architecture into tasks, analyze dependencies, and
    calculate critical path.

    Example:
        agent = PlannerAgent(
            llm_client=client,
            artifact_writer=writer,
            config=DesignConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DesignConfig,
    ) -> None:
        """Initialize the Planner agent.

        Args:
            llm_client: LLM client for text generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "planner_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute implementation planning from architecture.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - architecture: Architecture document content (required, JSON)
                - prd_content: PRD document content (required)
                - architecture_reference: Reference to architecture (optional)
                - tech_survey: Technology survey for complexity estimation (optional)
                - acceptance_criteria: Acceptance criteria from PRD (optional)

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(f"Planner Agent starting for task {context.task_id}")

        try:
            # Extract required inputs
            architecture = event_metadata.get("architecture", "")
            prd_content = event_metadata.get("prd_content", "")

            if not architecture:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No architecture provided in event_metadata",
                    should_retry=False,
                )

            if not prd_content:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No prd_content provided in event_metadata",
                    should_retry=False,
                )

            architecture_reference = event_metadata.get(
                "architecture_reference", f"ARCH-{context.task_id}"
            )
            tech_survey = event_metadata.get("tech_survey", "")
            acceptance_criteria = event_metadata.get("acceptance_criteria", "")

            # Step 1: Break down into tasks
            tasks_data = await self._breakdown_tasks(
                architecture, prd_content, acceptance_criteria
            )

            if not tasks_data:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to break down architecture into tasks",
                    should_retry=True,
                )

            # Step 2: Analyze dependencies
            dep_analysis = await self._analyze_dependencies(
                json.dumps(tasks_data), architecture
            )

            # Update task dependencies if analysis succeeded
            if dep_analysis:
                tasks_data = self._apply_dependency_refinements(
                    tasks_data, dep_analysis
                )

            # Step 3: Estimate complexity
            if tech_survey:
                complexity_data = await self._estimate_complexity(
                    json.dumps(tasks_data), tech_survey
                )
                if complexity_data:
                    tasks_data = self._apply_complexity_updates(
                        tasks_data, complexity_data
                    )

            # Step 4: Calculate critical path
            critical_path_data = await self._calculate_critical_path(
                json.dumps(tasks_data),
                json.dumps(dep_analysis.get("dependency_graph", {})) if dep_analysis else "{}",
            )

            # Step 5: Build implementation plan
            implementation_plan = self._build_implementation_plan(
                tasks_data,
                critical_path_data,
                architecture_reference,
            )

            # Step 6: Write artifact
            artifact_path = await self._write_artifact(context, implementation_plan)

            logger.info(
                f"Planner Agent completed for task {context.task_id}, "
                f"tasks: {len(implementation_plan.tasks)}, "
                f"phases: {len(implementation_plan.phases)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=[artifact_path],
                metadata={
                    "task_count": len(implementation_plan.tasks),
                    "phase_count": len(implementation_plan.phases),
                    "critical_path_length": len(implementation_plan.critical_path),
                    "total_effort": implementation_plan.total_estimated_effort,
                    "architecture_reference": architecture_reference,
                },
            )

        except Exception as e:
            logger.error(f"Planner Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _breakdown_tasks(
        self,
        architecture: str,
        prd_content: str,
        acceptance_criteria: str,
    ) -> dict[str, Any] | None:
        """Break down architecture into implementation tasks.

        Args:
            architecture: Architecture document JSON.
            prd_content: PRD document content.
            acceptance_criteria: Acceptance criteria.

        Returns:
            dict: Tasks data or None on failure.
        """
        prompt = format_task_breakdown_prompt(
            architecture, prd_content, acceptance_criteria
        )

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=PLANNER_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                result = self._parse_json_from_response(response.content)

                if result and "tasks" in result:
                    return result

                logger.warning(f"Invalid task breakdown on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Task breakdown attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    async def _analyze_dependencies(
        self,
        tasks: str,
        architecture: str,
    ) -> dict[str, Any] | None:
        """Analyze and refine task dependencies.

        Args:
            tasks: JSON string of task definitions.
            architecture: Architecture document JSON.

        Returns:
            dict: Dependency analysis or None.
        """
        prompt = format_dependency_analysis_prompt(tasks, architecture)

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=PLANNER_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                result = self._parse_json_from_response(response.content)

                if result and "refined_dependencies" in result:
                    return result

                logger.warning(f"Invalid dependency analysis on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Dependency analysis attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    async def _estimate_complexity(
        self,
        tasks: str,
        tech_survey: str,
    ) -> dict[str, Any] | None:
        """Estimate complexity for each task.

        Args:
            tasks: JSON string of task definitions.
            tech_survey: Technology survey JSON.

        Returns:
            dict: Complexity estimations or None.
        """
        prompt = format_complexity_estimation_prompt(tasks, tech_survey)

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=PLANNER_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                result = self._parse_json_from_response(response.content)

                if result and "estimations" in result:
                    return result

                logger.warning(f"Invalid complexity estimation on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Complexity estimation attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    async def _calculate_critical_path(
        self,
        tasks: str,
        dependency_graph: str,
    ) -> dict[str, Any] | None:
        """Calculate the critical path.

        Args:
            tasks: JSON string of tasks with estimations.
            dependency_graph: JSON string of dependency graph.

        Returns:
            dict: Critical path data or None.
        """
        prompt = format_critical_path_prompt(tasks, dependency_graph)

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=PLANNER_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                result = self._parse_json_from_response(response.content)

                if result and "critical_path" in result:
                    return result

                logger.warning(f"Invalid critical path on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Critical path calculation attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    def _apply_dependency_refinements(
        self,
        tasks_data: dict[str, Any],
        dep_analysis: dict[str, Any],
    ) -> dict[str, Any]:
        """Apply refined dependencies to tasks.

        Args:
            tasks_data: Original tasks data.
            dep_analysis: Dependency analysis results.

        Returns:
            dict: Updated tasks data.
        """
        # Create mapping of task ID to refined dependencies
        refinements = {
            item["task_id"]: item["dependencies"]
            for item in dep_analysis.get("refined_dependencies", [])
        }

        # Update tasks with refined dependencies
        for task in tasks_data.get("tasks", []):
            task_id = task.get("id", "")
            if task_id in refinements:
                task["dependencies"] = refinements[task_id]

        return tasks_data

    def _apply_complexity_updates(
        self,
        tasks_data: dict[str, Any],
        complexity_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Apply complexity estimations to tasks.

        Args:
            tasks_data: Original tasks data.
            complexity_data: Complexity estimation results.

        Returns:
            dict: Updated tasks data.
        """
        # Create mapping of task ID to complexity
        estimations = {
            item["task_id"]: item["complexity"]
            for item in complexity_data.get("estimations", [])
        }

        # Update tasks with complexity
        for task in tasks_data.get("tasks", []):
            task_id = task.get("id", "")
            if task_id in estimations:
                task["estimated_complexity"] = estimations[task_id]

        return tasks_data

    def _build_implementation_plan(
        self,
        tasks_data: dict[str, Any],
        critical_path_data: dict[str, Any] | None,
        architecture_reference: str,
    ) -> ImplementationPlan:
        """Build ImplementationPlan from data.

        Args:
            tasks_data: Tasks data dictionary.
            critical_path_data: Critical path analysis (may be None).
            architecture_reference: Reference to architecture.

        Returns:
            ImplementationPlan: Built implementation plan.
        """
        # Build tasks
        tasks = []
        for task_data in tasks_data.get("tasks", []):
            complexity_str = task_data.get("estimated_complexity", "M")
            try:
                complexity = ComplexityLevel(complexity_str)
            except ValueError:
                complexity = ComplexityLevel.MEDIUM

            tasks.append(ImplementationTask(
                id=task_data.get("id", ""),
                title=task_data.get("title", ""),
                description=task_data.get("description", ""),
                component=task_data.get("component", ""),
                dependencies=task_data.get("dependencies", []),
                acceptance_criteria=task_data.get("acceptance_criteria", []),
                estimated_complexity=complexity,
            ))

        # Build phases
        phases = []
        if critical_path_data and "phases" in critical_path_data:
            for phase_data in critical_path_data["phases"]:
                phases.append(Phase(
                    name=phase_data.get("name", ""),
                    description=phase_data.get("description", ""),
                    task_ids=phase_data.get("task_ids", []),
                    order=phase_data.get("order", 0),
                ))
        else:
            # Create default phase if no phases from critical path
            phases.append(Phase(
                name="Implementation",
                description="All implementation tasks",
                task_ids=[t.id for t in tasks],
                order=1,
            ))

        # Get critical path
        critical_path = []
        if critical_path_data:
            critical_path = critical_path_data.get("critical_path", [])

        return ImplementationPlan.create(
            architecture_reference=architecture_reference,
            phases=phases,
            tasks=tasks,
            critical_path=critical_path,
        )

    async def _write_artifact(
        self,
        context: AgentContext,
        plan: ImplementationPlan,
    ) -> str:
        """Write implementation plan artifact to filesystem.

        Args:
            context: Agent context with session info.
            plan: Implementation plan to write.

        Returns:
            str: Path to written artifact.
        """
        from src.workers.artifacts.writer import ArtifactType

        # Write both JSON and markdown versions
        json_content = plan.to_json()
        md_content = plan.to_markdown()

        # Write JSON artifact (primary)
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_implementation_plan.json",
        )

        # Write markdown artifact (human-readable)
        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=md_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_implementation_plan.md",
        )

        return json_path

    def _parse_json_from_response(self, content: str) -> dict[str, Any] | None:
        """Parse JSON from LLM response, handling code blocks.

        Args:
            content: Raw LLM response content.

        Returns:
            dict | None: Parsed JSON or None if parsing fails.
        """
        # Try direct JSON parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from code blocks
        import re

        patterns = [
            r'```json\s*\n?(.*?)\n?```',
            r'```\s*\n?(.*?)\n?```',
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except json.JSONDecodeError:
                    continue

        # Try finding JSON-like content
        json_start = content.find('{')
        json_end = content.rfind('}')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            try:
                return json.loads(content[json_start:json_end + 1])
            except json.JSONDecodeError:
                pass

        return None

    def validate_context(self, context: AgentContext) -> bool:
        """Validate that context is suitable for execution.

        Args:
            context: Agent context to validate.

        Returns:
            bool: True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
