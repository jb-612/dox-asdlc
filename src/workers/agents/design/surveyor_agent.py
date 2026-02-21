"""Surveyor Agent for technology analysis and recommendations.

Analyzes PRD documents to identify technology needs and generates
technology surveys with recommendations. Delegates work to a
pluggable AgentBackend (Claude Code CLI, Codex CLI, or direct
LLM API calls).
"""

from __future__ import annotations

import json
import logging
from typing import Any, TYPE_CHECKING

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.protocols import AgentContext, AgentResult, BaseAgent
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Risk,
    RiskLevel,
    TechnologyChoice,
    TechSurvey,
)
from src.workers.agents.design.prompts.surveyor_prompts import (
    SURVEYOR_SYSTEM_PROMPT as _SURVEYOR_SYSTEM_PROMPT,
)

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
SURVEYOR_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "technologies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "selected": {"type": "string"},
                    "alternatives": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "rationale": {"type": "string"},
                    "constraints": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["category", "selected"],
            },
        },
        "constraints_analysis": {"type": "object"},
        "risk_assessment": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "description": {"type": "string"},
                    "level": {"type": "string"},
                    "mitigation": {"type": "string"},
                    "impact": {"type": "string"},
                },
            },
        },
        "recommendations": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["technologies"],
}

# System prompt for the surveyor backend
SURVEYOR_SYSTEM_PROMPT = _SURVEYOR_SYSTEM_PROMPT


def _build_surveyor_prompt(
    prd_content: str,
    prd_reference: str,
    context_pack_summary: str = "",
    existing_patterns: str = "",
    additional_context: str = "",
) -> str:
    """Build the complete prompt for the surveyor backend.

    Combines PRD content, context pack summary, existing patterns,
    and additional context into a single prompt requesting a
    complete technology survey.

    Args:
        prd_content: PRD document content (JSON or markdown).
        prd_reference: Reference identifier for the source PRD.
        context_pack_summary: Summary from repo mapper context pack.
        existing_patterns: Description of existing technology patterns.
        additional_context: Extra context information.

    Returns:
        str: Complete prompt for the backend.
    """
    context_section = ""
    if context_pack_summary:
        context_section = f"""
## Existing Codebase Context
{context_pack_summary}
"""

    patterns_section = ""
    if existing_patterns:
        patterns_section = f"""
## Existing Technology Patterns
{existing_patterns}
"""

    additional_section = ""
    if additional_context:
        additional_section = f"""
## Additional Context
{additional_context}
"""

    return f"""Analyze the following PRD and produce a complete technology survey with recommendations.

## PRD Reference
{prd_reference}

## PRD Document
{prd_content}
{context_section}{patterns_section}{additional_section}
## Task
Perform a comprehensive technology analysis:
1. Identify all technology requirements from the PRD (language, framework, database, infrastructure, etc.)
2. Evaluate options for each category considering compatibility, maturity, performance, and learning curve
3. Make clear recommendations with rationale
4. Assess technical risks and propose mitigations

Consider:
- Compatibility with any existing decisions or constraints from the PRD
- Maturity and community support of each option
- Performance characteristics relevant to the requirements
- Long-term maintenance burden

Respond with a single JSON object containing:
- "technologies": array of technology choices, each with "category", "selected" (chosen technology), "alternatives" (array of other options considered), "rationale" (explanation), "constraints" (array of constraints affecting this choice)
- "constraints_analysis": object mapping constraint names to analysis of how each is addressed
- "risk_assessment": array of risk objects, each with "id" (e.g. RISK-001), "description", "level" (low|medium|high|critical), "mitigation", "impact"
- "recommendations": array of final recommendation strings and next steps
"""


def _parse_survey_from_result(
    result: BackendResult,
) -> dict[str, Any] | None:
    """Parse technology survey data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.

    Args:
        result: Backend execution result.

    Returns:
        dict | None: Parsed survey data, or None if parsing fails.
    """
    data = None

    # Prefer structured output from --json-schema backends
    if result.structured_output and "technologies" in result.structured_output:
        data = result.structured_output
    else:
        content = result.output
        if content:
            data = parse_json_from_response(content)

    if not data or "technologies" not in data:
        return None

    return data


class SurveyorAgentError(Exception):
    """Raised when Surveyor agent operations fail."""

    pass


class SurveyorAgent:
    """Agent that analyzes requirements and recommends technology choices.

    Delegates the actual technology analysis to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = SurveyorAgent(
            backend=backend,
            artifact_writer=writer,
            config=DesignConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        config: DesignConfig,
    ) -> None:
        """Initialize the Surveyor agent.

        Args:
            backend: Agent backend for technology analysis.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "surveyor_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute technology survey from PRD analysis.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - prd_content: PRD document content (required, JSON or markdown)
                - prd_reference: Reference ID for the PRD (optional)
                - additional_context: Extra context information (optional)

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(
            f"Surveyor Agent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Extract PRD content from metadata
            prd_content = event_metadata.get("prd_content", "")
            if not prd_content:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No prd_content provided in event_metadata",
                    should_retry=False,
                )

            prd_reference = event_metadata.get(
                "prd_reference", f"PRD-{context.task_id}"
            )
            additional_context = event_metadata.get("additional_context", "")

            # Get context pack summary if available
            context_pack_summary = ""
            existing_patterns = ""
            if context.context_pack:
                context_pack_summary = self._summarize_context_pack(
                    context.context_pack
                )
                existing_patterns = self._extract_existing_patterns(
                    context.context_pack
                )

            # Build combined prompt
            prompt = _build_surveyor_prompt(
                prd_content=prd_content,
                prd_reference=prd_reference,
                context_pack_summary=context_pack_summary,
                existing_patterns=existing_patterns,
                additional_context=additional_context,
            )

            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.surveyor_model,
                output_schema=SURVEYOR_OUTPUT_SCHEMA,
                system_prompt=SURVEYOR_SYSTEM_PROMPT,
                timeout_seconds=300,
                allowed_tools=["Read", "Glob", "Grep"],
            )

            # Execute via backend (single call for entire survey)
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

            # Parse survey from result
            survey_data = _parse_survey_from_result(result)

            if not survey_data:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message=(
                        "Failed to analyze technology needs from PRD"
                    ),
                    should_retry=True,
                )

            # Build TechSurvey model from parsed data
            tech_survey = self._build_tech_survey(survey_data, prd_reference)

            # Write artifact
            artifact_path = await self._write_artifact(context, tech_survey)

            logger.info(
                f"Surveyor Agent completed for task {context.task_id}, "
                f"technologies: {len(tech_survey.technologies)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=[artifact_path],
                metadata={
                    "technology_count": len(tech_survey.technologies),
                    "risk_count": len(tech_survey.risk_assessment),
                    "prd_reference": prd_reference,
                    "backend": self._backend.backend_name,
                    "cost_usd": result.cost_usd,
                    "turns": result.turns,
                    "session_id": result.session_id,
                },
            )

        except Exception as e:
            logger.error(f"Surveyor Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _build_tech_survey(
        self,
        rec_data: dict[str, Any],
        prd_reference: str,
    ) -> TechSurvey:
        """Build TechSurvey from recommendation data.

        Args:
            rec_data: Parsed recommendation JSON.
            prd_reference: Reference to source PRD.

        Returns:
            TechSurvey: Constructed survey document.
        """
        # Build technology choices
        technologies = []
        for tech_data in rec_data.get("technologies", []):
            technologies.append(TechnologyChoice(
                category=tech_data.get("category", ""),
                selected=tech_data.get("selected", ""),
                alternatives=tech_data.get("alternatives", []),
                rationale=tech_data.get("rationale", ""),
                constraints=tech_data.get("constraints", []),
            ))

        # Build risk assessment
        risks = []
        for risk_data in rec_data.get("risk_assessment", []):
            try:
                risks.append(Risk(
                    id=risk_data.get("id", f"RISK-{len(risks) + 1:03d}"),
                    description=risk_data.get("description", ""),
                    level=RiskLevel(risk_data.get("level", "medium")),
                    mitigation=risk_data.get("mitigation", ""),
                    impact=risk_data.get("impact", ""),
                ))
            except ValueError as e:
                logger.warning(f"Skipping invalid risk: {e}")

        return TechSurvey.create(
            prd_reference=prd_reference,
            technologies=technologies,
            constraints_analysis=rec_data.get("constraints_analysis", {}),
            risk_assessment=risks,
            recommendations=rec_data.get("recommendations", []),
        )

    async def _write_artifact(
        self,
        context: AgentContext,
        tech_survey: TechSurvey,
    ) -> str:
        """Write tech survey artifact to filesystem.

        Args:
            context: Agent context with session info.
            tech_survey: Tech survey to write.

        Returns:
            str: Path to written artifact.
        """
        from src.workers.artifacts.writer import ArtifactType

        # Write both JSON and markdown versions
        json_content = tech_survey.to_json()
        md_content = tech_survey.to_markdown()

        # Write JSON artifact (primary)
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_tech_survey.json",
        )

        # Write markdown artifact (human-readable)
        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=md_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_tech_survey.md",
        )

        return json_path

    def _summarize_context_pack(self, context_pack: dict[str, Any]) -> str:
        """Summarize context pack for prompt inclusion.

        Args:
            context_pack: Context pack dictionary.

        Returns:
            str: Summary of context pack.
        """
        lines: list[str] = []

        # Project structure
        if "structure" in context_pack:
            lines.append("### Project Structure")
            structure = context_pack["structure"]
            if isinstance(structure, dict):
                for key, value in list(structure.items())[:10]:
                    lines.append(f"- {key}")
            lines.append("")

        # Dependencies
        if "dependencies" in context_pack:
            lines.append("### Dependencies")
            deps = context_pack["dependencies"]
            if isinstance(deps, list):
                for dep in deps[:20]:
                    lines.append(f"- {dep}")
            lines.append("")

        # Key files
        if "key_files" in context_pack:
            lines.append("### Key Files")
            for f in context_pack["key_files"][:10]:
                lines.append(f"- {f}")
            lines.append("")

        return "\n".join(lines) if lines else ""

    def _extract_existing_patterns(self, context_pack: dict[str, Any]) -> str:
        """Extract existing technology patterns from context pack.

        Args:
            context_pack: Context pack dictionary.

        Returns:
            str: Description of existing patterns.
        """
        patterns: list[str] = []

        # Check for language indicators
        if "files" in context_pack:
            files = context_pack["files"]
            extensions: dict[str, int] = {}
            for f in files:
                ext = f.rsplit(".", 1)[-1] if "." in f else ""
                extensions[ext] = extensions.get(ext, 0) + 1

            if extensions:
                patterns.append("### Languages/Frameworks Detected")
                if extensions.get("py", 0) > 0:
                    patterns.append("- Python")
                if extensions.get("ts", 0) > 0 or extensions.get("tsx", 0) > 0:
                    patterns.append("- TypeScript")
                if extensions.get("js", 0) > 0 or extensions.get("jsx", 0) > 0:
                    patterns.append("- JavaScript")
                if extensions.get("go", 0) > 0:
                    patterns.append("- Go")
                if extensions.get("rs", 0) > 0:
                    patterns.append("- Rust")

        # Check for infrastructure patterns
        if "infrastructure" in context_pack:
            patterns.append("\n### Infrastructure")
            for item in context_pack["infrastructure"][:5]:
                patterns.append(f"- {item}")

        return "\n".join(patterns) if patterns else ""

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
