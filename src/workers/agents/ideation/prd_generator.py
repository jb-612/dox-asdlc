"""PRD Generator for converting ideation output to formal PRD.

Integrates with PRDAgent to generate structured PRD documents
from ideation session output.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext
from src.workers.agents.ideation.utils import parse_json_from_response
from src.workers.agents.discovery.models import (
    PRDDocument,
    PRDSection,
    Requirement,
    RequirementPriority,
    RequirementType,
)

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# Default configuration values
_DEFAULT_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MAX_TOKENS = 8192
_DEFAULT_TEMPERATURE = 0.3
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_RETRY_DELAY_SECONDS = 1.0


@dataclass
class PRDGeneratorConfig:
    """Configuration for PRDGenerator.

    Attributes:
        model: LLM model to use.
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation.
        max_retries: Maximum retry attempts on failure.
        retry_delay_seconds: Delay between retries.
    """

    model: str = _DEFAULT_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    max_retries: int = _DEFAULT_MAX_RETRIES
    retry_delay_seconds: float = _DEFAULT_RETRY_DELAY_SECONDS


@dataclass
class IdeationToPRDInput:
    """Input data from ideation session for PRD generation.

    Attributes:
        session_id: Ideation session ID.
        project_title: Title for the PRD.
        conversation_summary: Summary of the ideation conversation.
        extracted_requirements: Requirements extracted during ideation.
        maturity_scores: Final maturity scores by category.
    """

    session_id: str
    project_title: str
    conversation_summary: str
    extracted_requirements: list[dict[str, Any]]
    maturity_scores: dict[str, float] = field(default_factory=dict)


@dataclass
class PRDGeneratorResult:
    """Result from PRD generation.

    Attributes:
        success: Whether generation succeeded.
        prd_document: Generated PRD document (if successful).
        artifact_path: Path to written artifact (if any).
        error_message: Error description (if failed).
    """

    success: bool
    prd_document: PRDDocument | None = None
    artifact_path: str | None = None
    error_message: str | None = None


# System prompt for PRD generation
PRD_GENERATION_PROMPT = """You are an expert technical writer generating a Product Requirements Document (PRD).

Given the extracted requirements and conversation summary from an ideation session, create a comprehensive PRD in the following JSON format:

{
  "title": "Project title",
  "version": "1.0.0",
  "executive_summary": "Brief overview of the project",
  "objectives": {
    "title": "Objectives",
    "content": "Project objectives description",
    "requirements": []
  },
  "scope": {
    "title": "Scope",
    "content": "What is in and out of scope",
    "requirements": []
  },
  "sections": [
    {
      "title": "Section title",
      "content": "Section content",
      "requirements": [...],
      "subsections": []
    }
  ]
}

Group requirements logically:
- Functional Requirements
- Non-Functional Requirements
- Technical Constraints
- Assumptions

Each requirement should have:
- id: Unique identifier (e.g., REQ-001)
- description: Clear requirement statement
- priority: must_have, should_have, or could_have
- type: functional, non_functional, constraint, or assumption

Respond with valid JSON only."""


class PRDGenerator:
    """Generates PRD documents from ideation session output.

    Takes extracted requirements and conversation context from the
    ideation process and produces a formal PRD document.

    Example:
        generator = PRDGenerator(
            llm_client=client,
            artifact_writer=writer,
            config=PRDGeneratorConfig(),
        )
        result = await generator.generate(context, ideation_input)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter | None = None,
        config: PRDGeneratorConfig | None = None,
    ) -> None:
        """Initialize the PRD generator.

        Args:
            llm_client: LLM client for text generation.
            artifact_writer: Writer for persisting artifacts.
            config: Generator configuration.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config or PRDGeneratorConfig()

    @property
    def generator_type(self) -> str:
        """Return the generator type identifier."""
        return "prd_generator"

    async def generate(
        self,
        context: AgentContext,
        ideation_input: IdeationToPRDInput,
    ) -> PRDGeneratorResult:
        """Generate PRD from ideation output.

        Args:
            context: Execution context with session/task info.
            ideation_input: Input data from ideation session.

        Returns:
            PRDGeneratorResult: Result with PRD document or error.
        """
        logger.info(f"PRDGenerator starting for session {ideation_input.session_id}")

        # Validate input
        if not ideation_input.extracted_requirements:
            return PRDGeneratorResult(
                success=False,
                error_message="No requirements provided for PRD generation",
            )

        if not ideation_input.project_title:
            return PRDGeneratorResult(
                success=False,
                error_message="No project title provided for PRD generation",
            )

        try:
            # Build prompt with ideation context
            prompt = self._build_generation_prompt(ideation_input)

            # Get PRD structure from LLM
            prd_data = await self._get_prd_structure(prompt)

            if prd_data is None:
                # Create fallback PRD from requirements
                logger.warning("Using fallback PRD generation")
                prd = self._create_fallback_prd(ideation_input)
            else:
                # Build PRD from LLM response
                requirements = self._convert_requirements(
                    ideation_input.extracted_requirements
                )
                prd = self._build_prd_from_response(
                    prd_data,
                    requirements,
                    ideation_input.project_title,
                )

            # Write artifact if writer is available
            artifact_path = None
            if self._artifact_writer:
                artifact_path = await self._write_artifact(context, prd)

            logger.info(
                f"PRDGenerator completed for session {ideation_input.session_id}, "
                f"requirements: {len(prd.all_requirements)}"
            )

            return PRDGeneratorResult(
                success=True,
                prd_document=prd,
                artifact_path=artifact_path,
            )

        except Exception as e:
            logger.error(f"PRDGenerator failed: {e}", exc_info=True)
            return PRDGeneratorResult(
                success=False,
                error_message=str(e),
            )

    def _build_generation_prompt(self, ideation_input: IdeationToPRDInput) -> str:
        """Build the prompt for PRD generation.

        Args:
            ideation_input: Input data from ideation.

        Returns:
            str: The formatted prompt.
        """
        requirements_json = json.dumps(
            ideation_input.extracted_requirements,
            indent=2,
        )

        maturity_summary = ""
        if ideation_input.maturity_scores:
            maturity_summary = "Maturity scores:\n"
            for cat_id, score in ideation_input.maturity_scores.items():
                maturity_summary += f"- {cat_id}: {score}%\n"

        return f"""
Project Title: {ideation_input.project_title}

Conversation Summary:
{ideation_input.conversation_summary}

{maturity_summary}

Extracted Requirements:
{requirements_json}

Generate a comprehensive PRD based on the above information.
"""

    async def _get_prd_structure(self, prompt: str) -> dict[str, Any] | None:
        """Get PRD structure from LLM.

        Args:
            prompt: The generation prompt.

        Returns:
            dict | None: Parsed PRD structure or None on failure.
        """
        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=PRD_GENERATION_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                parsed = parse_json_from_response(response.content)
                if parsed:
                    return parsed

                logger.warning(f"Invalid PRD JSON on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"PRD generation attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    def _convert_requirements(
        self,
        raw_requirements: list[dict[str, Any]],
    ) -> list[Requirement]:
        """Convert raw requirement dicts to Requirement objects.

        Args:
            raw_requirements: Raw requirement dictionaries.

        Returns:
            list[Requirement]: Converted requirements.
        """
        requirements = []
        for i, raw in enumerate(raw_requirements):
            try:
                req = Requirement(
                    id=raw.get("id", f"REQ-{i + 1:03d}"),
                    description=raw.get("description", ""),
                    priority=RequirementPriority(
                        raw.get("priority", "should_have")
                    ),
                    type=RequirementType(raw.get("type", "functional")),
                    rationale=raw.get("rationale", ""),
                    source=raw.get("source", "ideation"),
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
        fallback_title: str,
    ) -> PRDDocument:
        """Build PRDDocument from LLM response.

        Args:
            prd_data: Parsed JSON from LLM.
            requirements: Original requirements list.
            fallback_title: Fallback title if not in response.

        Returns:
            PRDDocument: Constructed PRD document.
        """
        sections = []
        for section_data in prd_data.get("sections", []):
            section_reqs = []
            for req_data in section_data.get("requirements", []):
                req_id = req_data.get("id", "")
                matching = next(
                    (r for r in requirements if r.id == req_id), None
                )
                if matching:
                    section_reqs.append(matching)
                else:
                    try:
                        section_reqs.append(Requirement.from_dict(req_data))
                    except (ValueError, KeyError):
                        continue

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
            title=prd_data.get("title", fallback_title),
            executive_summary=prd_data.get("executive_summary", ""),
            objectives=objectives,
            scope=scope,
            sections=sections,
            version=prd_data.get("version", "1.0.0"),
        )

    def _create_fallback_prd(
        self,
        ideation_input: IdeationToPRDInput,
    ) -> PRDDocument:
        """Create minimal PRD as fallback.

        Args:
            ideation_input: Input from ideation session.

        Returns:
            PRDDocument: Minimal PRD document.
        """
        requirements = self._convert_requirements(
            ideation_input.extracted_requirements
        )

        # Group by type
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
            title=ideation_input.project_title,
            executive_summary=ideation_input.conversation_summary[:500] if ideation_input.conversation_summary else "PRD generated from ideation session.",
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

        json_content = prd.to_json()
        md_content = prd.to_markdown()

        # Write JSON artifact (primary)
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_ideation_prd.json",
        )

        # Write markdown artifact (human-readable)
        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=md_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_ideation_prd.md",
        )

        return json_path
