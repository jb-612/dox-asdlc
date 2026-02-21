"""PRD Agent for generating Product Requirements Documents.

Transforms raw user requirements into structured PRD documents.
Delegates work to a pluggable AgentBackend (Claude Code CLI,
Codex CLI, or direct LLM API calls).
"""

from __future__ import annotations

import json
import logging
from typing import Any, TYPE_CHECKING

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.protocols import AgentContext, AgentResult, BaseAgent
from src.workers.agents.discovery.config import DiscoveryConfig
from src.workers.agents.discovery.models import (
    PRDDocument,
    PRDSection,
    Requirement,
    RequirementPriority,
    RequirementType,
)
from src.workers.agents.discovery.prompts.prd_prompts import (
    PRD_SYSTEM_PROMPT as _PRD_SYSTEM_PROMPT,
    format_requirements_extraction_prompt,
    format_prd_prompt,
)

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
PRD_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "requirements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {
                        "type": "string",
                        "enum": [
                            "must_have",
                            "should_have",
                            "could_have",
                            "wont_have",
                        ],
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "functional",
                            "non_functional",
                            "constraint",
                            "assumption",
                        ],
                    },
                    "rationale": {"type": "string"},
                    "source": {"type": "string"},
                },
                "required": ["id", "description"],
            },
        },
        "prd": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "version": {"type": "string"},
                "executive_summary": {"type": "string"},
                "objectives": {"type": "object"},
                "scope": {"type": "object"},
                "sections": {"type": "array"},
            },
            "required": ["title"],
        },
    },
    "required": ["requirements", "prd"],
}

# System prompt for the PRD backend
PRD_SYSTEM_PROMPT = _PRD_SYSTEM_PROMPT


def _build_prd_prompt(
    raw_requirements: str,
    project_title: str,
    project_context: str,
) -> str:
    """Build the complete prompt for the PRD backend.

    Combines requirements extraction and PRD generation into a single
    prompt so the backend can handle both in one call.

    Args:
        raw_requirements: Raw user input text.
        project_title: Title for the PRD.
        project_context: Additional project context.

    Returns:
        str: Complete prompt for the backend.
    """
    extraction_prompt = format_requirements_extraction_prompt(
        raw_requirements, project_context
    )
    prd_instructions = format_prd_prompt(
        requirements_json="(use the requirements you extracted above)",
        project_title=project_title,
        additional_context=project_context,
    )

    return "\n\n".join([
        "## Task",
        "",
        "Perform the following two steps and return the results as a single "
        "JSON object with `requirements` and `prd` keys.",
        "",
        "### Step 1: Extract Requirements",
        "",
        extraction_prompt,
        "",
        "### Step 2: Generate PRD",
        "",
        prd_instructions,
        "",
        "### Required JSON Output",
        "",
        "Return a single JSON object with two top-level keys:",
        "- `requirements`: array of requirement objects from Step 1",
        "- `prd`: the full PRD object from Step 2",
    ])


def _parse_prd_from_result(
    result: BackendResult,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Parse requirements and PRD data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.

    Args:
        result: Backend execution result.

    Returns:
        Tuple of (requirements_data_list, prd_data_dict_or_None).
    """
    data = None

    # Prefer structured output from --json-schema backends
    if result.structured_output:
        data = result.structured_output
    else:
        content = result.output
        if content:
            data = parse_json_from_response(content)

    if not data:
        return [], None

    requirements_data = data.get("requirements", [])
    prd_data = data.get("prd")

    return requirements_data, prd_data


class PRDAgentError(Exception):
    """Raised when PRD agent operations fail."""

    pass


class PRDAgent:
    """Agent that generates structured PRD documents from raw requirements.

    Delegates the actual generation to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = PRDAgent(
            backend=backend,
            artifact_writer=writer,
            config=DiscoveryConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        config: DiscoveryConfig,
    ) -> None:
        """Initialize the PRD agent.

        Args:
            backend: Agent backend for PRD generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "prd_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute PRD generation from raw requirements.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - raw_requirements: Raw user input (required)
                - project_title: Title for the PRD (optional)
                - project_context: Additional context (optional)

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(
            f"PRD Agent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Extract raw requirements from metadata
            raw_requirements = event_metadata.get("raw_requirements", "")
            if not raw_requirements:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No raw_requirements provided in event_metadata",
                    should_retry=False,
                )

            project_title = event_metadata.get("project_title", "Untitled Project")
            project_context = event_metadata.get("project_context", "")

            # Build the combined prompt
            prompt = _build_prd_prompt(
                raw_requirements=raw_requirements,
                project_title=project_title,
                project_context=project_context,
            )

            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.prd_model,
                output_schema=PRD_OUTPUT_SCHEMA,
                system_prompt=PRD_SYSTEM_PROMPT,
                timeout_seconds=300,
                allowed_tools=["Read", "Glob", "Grep"],
            )

            # Execute via backend
            result = await self._backend.execute(
                prompt=prompt,
                workspace_path=context.workspace_path,
                config=backend_config,
            )

            if not result.success:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message=result.error or "Backend execution failed",
                    should_retry=True,
                )

            # Parse requirements and PRD from result
            requirements_data, prd_data = _parse_prd_from_result(result)

            if not requirements_data:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to extract requirements from backend output",
                    should_retry=True,
                )

            # Convert to Requirement objects
            requirements = self._build_requirements(requirements_data)

            if not requirements:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to extract requirements from input",
                    should_retry=True,
                )

            # Build PRD document
            if prd_data:
                prd = self._build_prd_from_response(prd_data, requirements)
            else:
                prd = self._create_fallback_prd(requirements, project_title)

            # Write artifact
            artifact_path = await self._write_artifact(context, prd)

            logger.info(
                f"PRD Agent completed for task {context.task_id}, "
                f"requirements: {len(prd.all_requirements)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=[artifact_path],
                metadata={
                    "requirement_count": len(prd.all_requirements),
                    "prd_version": prd.version,
                    "prd_title": prd.title,
                    "backend": self._backend.backend_name,
                    "cost_usd": result.cost_usd,
                    "turns": result.turns,
                    "session_id": result.session_id,
                },
            )

        except Exception as e:
            logger.error(f"PRD Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _build_requirements(
        self,
        requirements_data: list[dict[str, Any]],
    ) -> list[Requirement]:
        """Build Requirement objects from parsed data.

        Args:
            requirements_data: List of requirement dicts.

        Returns:
            list[Requirement]: Built requirement objects.
        """
        requirements = []
        for req_data in requirements_data:
            try:
                req = Requirement(
                    id=req_data.get("id", f"REQ-{len(requirements) + 1:03d}"),
                    description=req_data.get("description", ""),
                    priority=RequirementPriority(
                        req_data.get("priority", "should_have")
                    ),
                    type=RequirementType(req_data.get("type", "functional")),
                    rationale=req_data.get("rationale", ""),
                    source=req_data.get("source", ""),
                )
                requirements.append(req)
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid requirement: {e}")
                continue
        return requirements

    def _build_prd_from_response(
        self,
        prd_data: dict[str, Any],
        requirements: list[Requirement],
    ) -> PRDDocument:
        """Build PRDDocument from LLM response data.

        Args:
            prd_data: Parsed JSON from LLM response.
            requirements: Original requirements list.

        Returns:
            PRDDocument: Constructed PRD document.
        """
        # Build sections
        sections = []
        for section_data in prd_data.get("sections", []):
            section_reqs = []
            for req_data in section_data.get("requirements", []):
                # Try to find matching requirement or create new one
                req_id = req_data.get("id", "")
                matching = next(
                    (r for r in requirements if r.id == req_id), None
                )
                if matching:
                    section_reqs.append(matching)
                else:
                    section_reqs.append(Requirement.from_dict(req_data))

            sections.append(PRDSection(
                title=section_data.get("title", ""),
                content=section_data.get("content", ""),
                requirements=section_reqs,
                subsections=[
                    PRDSection.from_dict(sub)
                    for sub in section_data.get("subsections", [])
                ],
            ))

        objectives = PRDSection.from_dict(prd_data.get("objectives", {}))
        scope = PRDSection.from_dict(prd_data.get("scope", {}))

        return PRDDocument.create(
            title=prd_data.get("title", "Untitled Project"),
            executive_summary=prd_data.get("executive_summary", ""),
            objectives=objectives,
            scope=scope,
            sections=sections,
            version=prd_data.get("version", "1.0.0"),
        )

    def _create_fallback_prd(
        self,
        requirements: list[Requirement],
        project_title: str,
    ) -> PRDDocument:
        """Create minimal PRD as fallback when generation fails.

        Args:
            requirements: List of requirements.
            project_title: Project title.

        Returns:
            PRDDocument: Minimal PRD document.
        """
        # Group requirements by type
        functional = [r for r in requirements if r.type == RequirementType.FUNCTIONAL]
        non_functional = [r for r in requirements if r.type == RequirementType.NON_FUNCTIONAL]
        constraints = [r for r in requirements if r.type == RequirementType.CONSTRAINT]
        assumptions = [r for r in requirements if r.type == RequirementType.ASSUMPTION]

        sections = []

        if functional:
            sections.append(PRDSection(
                title="Functional Requirements",
                content="Core functionality requirements.",
                requirements=functional,
            ))

        if non_functional:
            sections.append(PRDSection(
                title="Non-Functional Requirements",
                content="Quality and performance requirements.",
                requirements=non_functional,
            ))

        if constraints:
            sections.append(PRDSection(
                title="Technical Constraints",
                content="Technical limitations and constraints.",
                requirements=constraints,
            ))

        if assumptions:
            sections.append(PRDSection(
                title="Assumptions",
                content="Project assumptions.",
                requirements=assumptions,
            ))

        return PRDDocument.create(
            title=project_title,
            executive_summary="This PRD was generated from extracted requirements.",
            objectives=PRDSection(title="Objectives", content="Define project objectives."),
            scope=PRDSection(title="Scope", content="Define project scope."),
            sections=sections,
        )

    async def _write_artifact(
        self,
        context: AgentContext,
        prd: PRDDocument,
    ) -> str:
        """Write PRD artifact to filesystem.

        Args:
            context: Agent context with session info.
            prd: PRD document to write.

        Returns:
            str: Path to written artifact.
        """
        from src.workers.artifacts.writer import ArtifactType

        # Write both JSON and markdown versions
        json_content = prd.to_json()
        md_content = prd.to_markdown()

        # Write JSON artifact (primary)
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_prd.json",
        )

        # Write markdown artifact (human-readable)
        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=md_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_prd.md",
        )

        return json_path

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
