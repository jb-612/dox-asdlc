"""Surveyor Agent for technology analysis and recommendations.

Analyzes PRD documents to identify technology needs, performs research
using RLM exploration when needed, and generates technology surveys
with recommendations.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext, AgentResult, BaseAgent
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Risk,
    RiskLevel,
    TechnologyChoice,
    TechSurvey,
)
from src.workers.agents.design.prompts.surveyor_prompts import (
    SURVEYOR_SYSTEM_PROMPT,
    format_technology_analysis_prompt,
    format_research_synthesis_prompt,
    format_recommendation_prompt,
    format_rlm_trigger_prompt,
)

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.rlm.integration import RLMIntegration
    from src.workers.repo_mapper import RepoMapper, ContextPack

logger = logging.getLogger(__name__)


class SurveyorAgentError(Exception):
    """Raised when Surveyor agent operations fail."""

    pass


class SurveyorAgent:
    """Agent that analyzes requirements and recommends technology choices.

    Implements the BaseAgent protocol for worker pool dispatch. Uses LLM
    to analyze PRD documents, optionally triggers RLM for deep research,
    and generates comprehensive technology surveys.

    Example:
        agent = SurveyorAgent(
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
        rlm_integration: RLMIntegration | None = None,
        repo_mapper: RepoMapper | None = None,
    ) -> None:
        """Initialize the Surveyor agent.

        Args:
            llm_client: LLM client for text generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
            rlm_integration: Optional RLM integration for deep research.
            repo_mapper: Optional repo mapper for context pack generation.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config
        self._rlm_integration = rlm_integration
        self._repo_mapper = repo_mapper

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
        logger.info(f"Surveyor Agent starting for task {context.task_id}")

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

            prd_reference = event_metadata.get("prd_reference", f"PRD-{context.task_id}")
            additional_context = event_metadata.get("additional_context", "")

            # Step 1: Get context pack if available
            context_pack_summary = ""
            existing_patterns = ""
            if context.context_pack:
                context_pack_summary = self._summarize_context_pack(context.context_pack)
                existing_patterns = self._extract_existing_patterns(context.context_pack)
            elif self._repo_mapper and self._config.context_pack_required:
                # Generate context pack if repo mapper available
                try:
                    pack = await self._generate_context_pack(context)
                    if pack:
                        context_pack_summary = self._summarize_context_pack(pack)
                        existing_patterns = self._extract_existing_patterns(pack)
                except Exception as e:
                    logger.warning(f"Failed to generate context pack: {e}")

            # Step 2: Analyze technology needs from PRD
            tech_needs = await self._analyze_technology_needs(
                prd_content, context_pack_summary, existing_patterns
            )

            if not tech_needs:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to analyze technology needs from PRD",
                    should_retry=True,
                )

            # Step 3: Check if RLM exploration is needed
            rlm_findings = ""
            if self._config.enable_rlm and self._rlm_integration:
                rlm_findings = await self._explore_with_rlm(
                    tech_needs, context, additional_context
                )

            # Step 4: Synthesize research and generate evaluations
            evaluations = await self._synthesize_research(
                tech_needs, rlm_findings, additional_context
            )

            if not evaluations:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to synthesize technology research",
                    should_retry=True,
                )

            # Step 5: Generate final recommendations
            tech_survey = await self._generate_recommendations(
                evaluations, prd_reference, tech_needs
            )

            # Step 6: Write artifact
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
                    "used_rlm": bool(rlm_findings),
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

    async def _analyze_technology_needs(
        self,
        prd_content: str,
        context_pack_summary: str,
        existing_patterns: str,
    ) -> dict[str, Any] | None:
        """Analyze PRD to identify technology needs.

        Args:
            prd_content: PRD document content.
            context_pack_summary: Summary from context pack.
            existing_patterns: Description of existing patterns.

        Returns:
            dict: Technology needs analysis or None on failure.
        """
        prompt = format_technology_analysis_prompt(
            prd_content, context_pack_summary, existing_patterns
        )

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=SURVEYOR_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                analysis = self._parse_json_from_response(response.content)

                if analysis and "technology_needs" in analysis:
                    return analysis

                logger.warning(f"Invalid analysis response on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Technology analysis attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    async def _explore_with_rlm(
        self,
        tech_needs: dict[str, Any],
        context: AgentContext,
        additional_context: str,
    ) -> str:
        """Use RLM to explore technology needs requiring deep research.

        Args:
            tech_needs: Technology needs analysis.
            context: Agent context.
            additional_context: Additional context.

        Returns:
            str: RLM findings or empty string.
        """
        if not self._rlm_integration:
            return ""

        try:
            # Check if research is needed
            research_topics = tech_needs.get("research_topics", [])
            if not research_topics:
                return ""

            # Format trigger check prompt
            trigger_prompt = format_rlm_trigger_prompt(
                json.dumps(tech_needs), research_topics
            )

            trigger_response = await self._llm_client.generate(
                prompt=trigger_prompt,
                system=SURVEYOR_SYSTEM_PROMPT,
                max_tokens=1000,
                temperature=0.2,
            )

            trigger_data = self._parse_json_from_response(trigger_response.content)

            if not trigger_data or not trigger_data.get("needs_research", False):
                return ""

            # Execute RLM exploration
            research_queries = trigger_data.get("research_queries", research_topics)
            combined_query = (
                f"Research the following technology topics for design decisions:\n"
                + "\n".join(f"- {q}" for q in research_queries)
            )

            logger.info(f"Surveyor Agent triggering RLM exploration for task {context.task_id}")

            rlm_result = await self._rlm_integration.explore(
                query=combined_query,
                context_hints=["docs/", "requirements.txt", "pyproject.toml", "package.json"],
                task_id=context.task_id,
            )

            if rlm_result.error:
                logger.warning(f"RLM exploration failed: {rlm_result.error}")
                return ""

            return rlm_result.formatted_output

        except Exception as e:
            logger.warning(f"RLM exploration failed: {e}")
            return ""

    async def _synthesize_research(
        self,
        tech_needs: dict[str, Any],
        rlm_findings: str,
        additional_context: str,
    ) -> dict[str, Any] | None:
        """Synthesize research into technology evaluations.

        Args:
            tech_needs: Technology needs analysis.
            rlm_findings: Findings from RLM exploration.
            additional_context: Additional context.

        Returns:
            dict: Technology evaluations or None on failure.
        """
        prompt = format_research_synthesis_prompt(
            json.dumps(tech_needs), rlm_findings, additional_context
        )

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=SURVEYOR_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                evaluations = self._parse_json_from_response(response.content)

                if evaluations and "evaluations" in evaluations:
                    return evaluations

                logger.warning(f"Invalid evaluations response on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Research synthesis attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    async def _generate_recommendations(
        self,
        evaluations: dict[str, Any],
        prd_reference: str,
        tech_needs: dict[str, Any],
    ) -> TechSurvey:
        """Generate final technology recommendations.

        Args:
            evaluations: Technology evaluations.
            prd_reference: Reference to source PRD.
            tech_needs: Original technology needs.

        Returns:
            TechSurvey: Generated technology survey.
        """
        # Extract constraints summary
        constraints = []
        for need in tech_needs.get("technology_needs", []):
            constraints.extend(need.get("constraints", []))
        constraints_summary = "\n".join(f"- {c}" for c in set(constraints))

        prompt = format_recommendation_prompt(
            json.dumps(evaluations), prd_reference, constraints_summary
        )

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=SURVEYOR_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                rec_data = self._parse_json_from_response(response.content)

                if rec_data and "technologies" in rec_data:
                    return self._build_tech_survey(rec_data, prd_reference)

                logger.warning(f"Invalid recommendations response on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Recommendation generation attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        # Fallback: create minimal survey from evaluations
        return self._create_fallback_survey(evaluations, prd_reference)

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

    def _create_fallback_survey(
        self,
        evaluations: dict[str, Any],
        prd_reference: str,
    ) -> TechSurvey:
        """Create minimal survey as fallback when generation fails.

        Args:
            evaluations: Technology evaluations.
            prd_reference: Reference to source PRD.

        Returns:
            TechSurvey: Minimal survey document.
        """
        technologies = []
        for eval_data in evaluations.get("evaluations", []):
            recommendation = eval_data.get("recommendation", "")
            if recommendation:
                # Get the recommended option's details
                options = eval_data.get("options", [])
                option_names = [opt.get("name", "") for opt in options]
                alternatives = [n for n in option_names if n != recommendation]

                technologies.append(TechnologyChoice(
                    category=eval_data.get("category", ""),
                    selected=recommendation,
                    alternatives=alternatives[:3],  # Limit to 3 alternatives
                    rationale=f"Recommended based on evaluation (confidence: {eval_data.get('confidence', 'medium')})",
                    constraints=eval_data.get("constraints_met", []),
                ))

        return TechSurvey.create(
            prd_reference=prd_reference,
            technologies=technologies,
            risk_assessment=[],
            recommendations=["Review and validate technology choices"],
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

    async def _generate_context_pack(
        self,
        context: AgentContext,
    ) -> dict[str, Any] | None:
        """Generate context pack using repo mapper.

        Args:
            context: Agent context.

        Returns:
            dict: Context pack or None.
        """
        if not self._repo_mapper:
            return None

        try:
            pack = await self._repo_mapper.generate(
                workspace_path=context.workspace_path,
                focus_paths=["src/", "requirements.txt", "pyproject.toml", "package.json"],
                include_structure=True,
            )
            return pack.to_dict() if pack else None
        except Exception as e:
            logger.warning(f"Context pack generation failed: {e}")
            return None

    def _summarize_context_pack(self, context_pack: dict[str, Any]) -> str:
        """Summarize context pack for prompt inclusion.

        Args:
            context_pack: Context pack dictionary.

        Returns:
            str: Summary of context pack.
        """
        lines = []

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
        patterns = []

        # Check for language indicators
        if "files" in context_pack:
            files = context_pack["files"]
            extensions = {}
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
