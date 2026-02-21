"""Acceptance Agent for generating acceptance criteria.

Transforms PRD documents into testable acceptance criteria
using Given-When-Then format. Delegates work to a pluggable
AgentBackend (Claude Code CLI, Codex CLI, or direct LLM API calls).
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
    AcceptanceCriteria,
    AcceptanceCriterion,
    PRDDocument,
)
from src.workers.agents.discovery.prompts.acceptance_prompts import (
    ACCEPTANCE_SYSTEM_PROMPT as _ACCEPTANCE_SYSTEM_PROMPT,
    format_criteria_generation_prompt,
)

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
ACCEPTANCE_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "criteria": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "requirement_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "given": {"type": "string"},
                    "when": {"type": "string"},
                    "then": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["id", "given", "when", "then"],
            },
        },
    },
    "required": ["criteria"],
}

# System prompt for the acceptance backend
ACCEPTANCE_SYSTEM_PROMPT = _ACCEPTANCE_SYSTEM_PROMPT


def _build_acceptance_prompt(prd: PRDDocument) -> str:
    """Build the complete prompt for the acceptance backend.

    Combines PRD content and requirements list into a single prompt.

    Args:
        prd: PRD document to generate criteria from.

    Returns:
        str: Complete prompt for the backend.
    """
    prd_content = prd.to_markdown()
    requirements_list = json.dumps(
        [r.to_dict() for r in prd.all_requirements], indent=2
    )
    return format_criteria_generation_prompt(prd_content, requirements_list)


def _parse_criteria_from_result(
    result: BackendResult,
) -> list[dict[str, Any]]:
    """Parse criteria data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.

    Args:
        result: Backend execution result.

    Returns:
        List of criteria dicts, or empty list if parsing fails.
    """
    data = None

    # Prefer structured output from --json-schema backends
    if result.structured_output and "criteria" in result.structured_output:
        data = result.structured_output
    else:
        content = result.output
        if content:
            data = parse_json_from_response(content)

    if not data or "criteria" not in data:
        return []

    return data["criteria"]


class AcceptanceAgentError(Exception):
    """Raised when Acceptance agent operations fail."""

    pass


class AcceptanceAgent:
    """Agent that generates acceptance criteria from PRD documents.

    Delegates the actual criteria generation to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = AcceptanceAgent(
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
        """Initialize the Acceptance agent.

        Args:
            backend: Agent backend for criteria generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "acceptance_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute acceptance criteria generation from PRD.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - prd_document: PRDDocument instance or dict (required)
                - prd_path: Path to PRD artifact (alternative to prd_document)

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(
            f"Acceptance Agent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Get PRD document from metadata
            prd = await self._get_prd_document(context, event_metadata)

            if not prd:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No PRD document available in event_metadata",
                    should_retry=False,
                )

            if not prd.all_requirements:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="PRD document has no requirements to generate criteria for",
                    should_retry=False,
                )

            # Build prompt
            prompt = _build_acceptance_prompt(prd)

            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.acceptance_model,
                output_schema=ACCEPTANCE_OUTPUT_SCHEMA,
                system_prompt=ACCEPTANCE_SYSTEM_PROMPT,
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

            # Parse criteria from result
            criteria_data = _parse_criteria_from_result(result)

            # Build AcceptanceCriterion objects
            if criteria_data:
                criteria = self._build_criteria(criteria_data)
            else:
                criteria = []

            # Fall back to generated criteria if needed
            if not criteria:
                criteria = self._create_fallback_criteria(prd)

            # Build acceptance criteria document with coverage matrix
            requirement_ids = [r.id for r in prd.all_requirements]
            acceptance_doc = AcceptanceCriteria.create(
                prd_version=prd.version,
                criteria=criteria,
                requirement_ids=requirement_ids,
            )

            # Write artifact
            artifact_path = await self._write_artifact(context, acceptance_doc)

            # Calculate coverage stats
            coverage_pct = acceptance_doc.get_coverage_percentage()
            uncovered = acceptance_doc.get_uncovered_requirements()

            logger.info(
                f"Acceptance Agent completed for task {context.task_id}, "
                f"criteria: {len(criteria)}, coverage: {coverage_pct:.1f}%"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=[artifact_path],
                metadata={
                    "criteria_count": len(criteria),
                    "requirement_count": len(requirement_ids),
                    "coverage_percentage": coverage_pct,
                    "uncovered_requirements": uncovered,
                    "prd_version": prd.version,
                    "backend": self._backend.backend_name,
                    "cost_usd": result.cost_usd,
                    "turns": result.turns,
                    "session_id": result.session_id,
                },
            )

        except Exception as e:
            logger.error(f"Acceptance Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _get_prd_document(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> PRDDocument | None:
        """Get PRD document from metadata or file.

        Args:
            context: Agent context.
            event_metadata: Event metadata.

        Returns:
            PRDDocument | None: PRD document if available.
        """
        # Try to get PRD from metadata directly
        prd_data = event_metadata.get("prd_document")

        if prd_data:
            if isinstance(prd_data, PRDDocument):
                return prd_data
            elif isinstance(prd_data, dict):
                return PRDDocument.from_dict(prd_data)

        # Try to load from artifact path
        prd_path = event_metadata.get("prd_path")
        if prd_path:
            try:
                from pathlib import Path
                path = Path(prd_path)
                if path.exists():
                    content = path.read_text()
                    return PRDDocument.from_json(content)
            except Exception as e:
                logger.warning(f"Failed to load PRD from path {prd_path}: {e}")

        # Try to find PRD in context pack
        if context.context_pack:
            prd_data = context.context_pack.get("prd_document")
            if prd_data:
                return PRDDocument.from_dict(prd_data)

        return None

    def _build_criteria(
        self,
        criteria_data: list[dict[str, Any]],
    ) -> list[AcceptanceCriterion]:
        """Build AcceptanceCriterion objects from parsed data.

        Args:
            criteria_data: List of criteria dicts.

        Returns:
            list[AcceptanceCriterion]: Built criterion objects.
        """
        criteria = []
        for idx, crit_data in enumerate(criteria_data):
            try:
                criterion = AcceptanceCriterion(
                    id=crit_data.get("id", f"AC-{idx + 1:03d}"),
                    requirement_ids=crit_data.get("requirement_ids", []),
                    given=crit_data.get("given", ""),
                    when=crit_data.get("when", ""),
                    then=crit_data.get("then", ""),
                    notes=crit_data.get("notes", ""),
                )

                # Validate criterion has meaningful content
                if criterion.given and criterion.when and criterion.then:
                    criteria.append(criterion)
                else:
                    logger.warning(
                        f"Skipping incomplete criterion: {criterion.id}"
                    )

            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid criterion: {e}")
                continue

        return criteria

    def _create_fallback_criteria(
        self,
        prd: PRDDocument,
    ) -> list[AcceptanceCriterion]:
        """Create minimal acceptance criteria as fallback.

        Args:
            prd: PRD document.

        Returns:
            list[AcceptanceCriterion]: Minimal criteria.
        """
        criteria = []

        for idx, req in enumerate(prd.all_requirements):
            criterion = AcceptanceCriterion(
                id=f"AC-{idx + 1:03d}",
                requirement_ids=[req.id],
                given=f"the system is operational",
                when=f"the user performs the action described in {req.id}",
                then=f"the expected outcome as defined in {req.id} occurs",
                notes=f"Generated as fallback. Original requirement: {req.description[:100]}",
            )
            criteria.append(criterion)

        return criteria

    async def _write_artifact(
        self,
        context: AgentContext,
        acceptance_doc: AcceptanceCriteria,
    ) -> str:
        """Write acceptance criteria artifact to filesystem.

        Args:
            context: Agent context with session info.
            acceptance_doc: Acceptance criteria document to write.

        Returns:
            str: Path to written artifact.
        """
        from src.workers.artifacts.writer import ArtifactType

        # Write both JSON and markdown versions
        json_content = acceptance_doc.to_json()
        md_content = acceptance_doc.to_markdown()

        # Write JSON artifact (primary)
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_acceptance_criteria.json",
        )

        # Write markdown artifact (human-readable)
        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=md_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_acceptance_criteria.md",
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
