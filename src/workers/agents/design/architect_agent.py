"""Architect Agent for designing system architectures.

Consumes technology surveys and PRDs to design component-based
architectures with clear interfaces and Mermaid diagrams.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext, AgentResult, BaseAgent
from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Architecture,
    ArchitectureStyle,
    Component,
    DataFlow,
    DiagramReference,
    DiagramType,
    Interface,
)
from src.workers.agents.design.prompts.architect_prompts import (
    ARCHITECT_SYSTEM_PROMPT,
    format_component_design_prompt,
    format_interface_definition_prompt,
    format_diagram_generation_prompt,
    format_nfr_validation_prompt,
)

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


class ArchitectAgentError(Exception):
    """Raised when Architect agent operations fail."""

    pass


class ArchitectAgent:
    """Agent that designs system architectures from requirements.

    Implements the BaseAgent protocol for worker pool dispatch. Uses LLM
    to design component architectures, generate Mermaid diagrams, and
    validate against NFRs.

    Example:
        agent = ArchitectAgent(
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
        """Initialize the Architect agent.

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
        return "architect_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute architecture design from tech survey and PRD.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - tech_survey: Technology survey content (required, JSON)
                - prd_content: PRD document content (required)
                - tech_survey_reference: Reference to tech survey (optional)
                - nfr_requirements: Non-functional requirements (optional)

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(f"Architect Agent starting for task {context.task_id}")

        try:
            # Extract required inputs
            tech_survey = event_metadata.get("tech_survey", "")
            prd_content = event_metadata.get("prd_content", "")

            if not tech_survey:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No tech_survey provided in event_metadata",
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

            tech_survey_reference = event_metadata.get(
                "tech_survey_reference", f"TECH-{context.task_id}"
            )
            nfr_requirements = event_metadata.get("nfr_requirements", "")

            # Get context pack summary if available
            context_pack_summary = ""
            if context.context_pack:
                context_pack_summary = self._summarize_context_pack(context.context_pack)

            # Step 1: Design components
            component_design = await self._design_components(
                tech_survey, prd_content, context_pack_summary
            )

            if not component_design:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to design component architecture",
                    should_retry=True,
                )

            # Step 2: Generate diagrams
            diagrams = await self._generate_diagrams(component_design)

            # Step 3: Validate against NFRs if provided
            nfr_considerations = {}
            security_considerations = []
            if nfr_requirements:
                nfr_result = await self._validate_nfrs(
                    json.dumps(component_design), nfr_requirements
                )
                if nfr_result:
                    nfr_considerations = self._extract_nfr_considerations(nfr_result)
                    security_considerations = nfr_result.get(
                        "security_considerations", []
                    )

            # Step 4: Build architecture document
            architecture = self._build_architecture(
                component_design,
                diagrams,
                tech_survey_reference,
                nfr_considerations,
                security_considerations,
            )

            # Step 5: Write artifact
            artifact_path = await self._write_artifact(context, architecture)

            logger.info(
                f"Architect Agent completed for task {context.task_id}, "
                f"components: {len(architecture.components)}, "
                f"diagrams: {len(architecture.diagrams)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=[artifact_path],
                metadata={
                    "component_count": len(architecture.components),
                    "diagram_count": len(architecture.diagrams),
                    "architecture_style": architecture.style.value,
                    "tech_survey_reference": tech_survey_reference,
                },
            )

        except Exception as e:
            logger.error(f"Architect Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _design_components(
        self,
        tech_survey: str,
        prd_content: str,
        context_pack_summary: str,
    ) -> dict[str, Any] | None:
        """Design component architecture.

        Args:
            tech_survey: Technology survey JSON.
            prd_content: PRD document content.
            context_pack_summary: Context pack summary.

        Returns:
            dict: Component design or None on failure.
        """
        prompt = format_component_design_prompt(
            tech_survey, prd_content, context_pack_summary
        )

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=ARCHITECT_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                design = self._parse_json_from_response(response.content)

                if design and "components" in design:
                    return design

                logger.warning(f"Invalid component design on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Component design attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    async def _generate_diagrams(
        self,
        architecture: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Generate Mermaid diagrams for the architecture.

        Args:
            architecture: Architecture design dictionary.

        Returns:
            list: List of diagram definitions.
        """
        prompt = format_diagram_generation_prompt(json.dumps(architecture))

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=ARCHITECT_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                result = self._parse_json_from_response(response.content)

                if result and "diagrams" in result:
                    return result["diagrams"]

                logger.warning(f"Invalid diagram response on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Diagram generation attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        # Return empty list on failure - diagrams are optional
        return []

    async def _validate_nfrs(
        self,
        architecture: str,
        nfr_requirements: str,
    ) -> dict[str, Any] | None:
        """Validate architecture against NFRs.

        Args:
            architecture: Architecture JSON.
            nfr_requirements: NFR requirements text.

        Returns:
            dict: NFR validation result or None.
        """
        prompt = format_nfr_validation_prompt(architecture, nfr_requirements)

        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=ARCHITECT_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                result = self._parse_json_from_response(response.content)

                if result and "nfr_evaluation" in result:
                    return result

                logger.warning(f"Invalid NFR validation on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"NFR validation attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    def _build_architecture(
        self,
        design: dict[str, Any],
        diagrams: list[dict[str, Any]],
        tech_survey_reference: str,
        nfr_considerations: dict[str, str],
        security_considerations: list[str],
    ) -> Architecture:
        """Build Architecture model from design data.

        Args:
            design: Component design dictionary.
            diagrams: List of diagram definitions.
            tech_survey_reference: Reference to tech survey.
            nfr_considerations: NFR considerations.
            security_considerations: Security notes.

        Returns:
            Architecture: Built architecture document.
        """
        # Parse architecture style
        style_str = design.get("architecture_style", "layered")
        try:
            style = ArchitectureStyle(style_str)
        except ValueError:
            style = ArchitectureStyle.LAYERED

        # Build components
        components = []
        for comp_data in design.get("components", []):
            interfaces = []
            for iface_data in comp_data.get("interfaces", []):
                interfaces.append(Interface(
                    name=iface_data.get("name", ""),
                    description=iface_data.get("description", ""),
                    methods=iface_data.get("methods", []),
                    data_types=iface_data.get("data_types", []),
                ))

            components.append(Component(
                name=comp_data.get("name", ""),
                responsibility=comp_data.get("responsibility", ""),
                interfaces=interfaces,
                dependencies=comp_data.get("dependencies", []),
                technology=comp_data.get("technology", ""),
                notes=comp_data.get("notes", ""),
            ))

        # Build data flows
        data_flows = []
        for flow_data in design.get("data_flows", []):
            data_flows.append(DataFlow(
                source=flow_data.get("source", ""),
                target=flow_data.get("target", ""),
                data_type=flow_data.get("data_type", ""),
                description=flow_data.get("description", ""),
                protocol=flow_data.get("protocol", ""),
            ))

        # Build diagram references
        diagram_refs = []
        for diag_data in diagrams:
            try:
                diagram_type = DiagramType(diag_data.get("diagram_type", "component"))
            except ValueError:
                diagram_type = DiagramType.COMPONENT

            diagram_refs.append(DiagramReference(
                diagram_type=diagram_type,
                title=diag_data.get("title", ""),
                mermaid_code=diag_data.get("mermaid_code", ""),
                description=diag_data.get("description", ""),
            ))

        return Architecture.create(
            style=style,
            components=components,
            data_flows=data_flows,
            deployment_model=design.get("deployment_model", ""),
            diagrams=diagram_refs,
            tech_survey_reference=tech_survey_reference,
            nfr_considerations=nfr_considerations,
            security_considerations=security_considerations,
        )

    def _extract_nfr_considerations(
        self,
        nfr_result: dict[str, Any],
    ) -> dict[str, str]:
        """Extract NFR considerations from validation result.

        Args:
            nfr_result: NFR validation result.

        Returns:
            dict: NFR category to consideration mapping.
        """
        considerations = {}
        for evaluation in nfr_result.get("nfr_evaluation", []):
            category = evaluation.get("category", "")
            how_addressed = evaluation.get("how_addressed", "")
            if category and how_addressed:
                considerations[category] = how_addressed
        return considerations

    async def _write_artifact(
        self,
        context: AgentContext,
        architecture: Architecture,
    ) -> str:
        """Write architecture artifact to filesystem.

        Args:
            context: Agent context with session info.
            architecture: Architecture to write.

        Returns:
            str: Path to written artifact.
        """
        from src.workers.artifacts.writer import ArtifactType

        # Write both JSON and markdown versions
        json_content = architecture.to_json()
        md_content = architecture.to_markdown()

        # Write JSON artifact (primary)
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_architecture.json",
        )

        # Write markdown artifact (human-readable)
        await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=md_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_architecture.md",
        )

        return json_path

    def _summarize_context_pack(self, context_pack: dict[str, Any]) -> str:
        """Summarize context pack for prompt inclusion.

        Args:
            context_pack: Context pack dictionary.

        Returns:
            str: Summary of context pack.
        """
        lines = []

        if "structure" in context_pack:
            lines.append("### Existing Structure")
            structure = context_pack["structure"]
            if isinstance(structure, dict):
                for key in list(structure.keys())[:10]:
                    lines.append(f"- {key}")
            lines.append("")

        if "components" in context_pack:
            lines.append("### Existing Components")
            for comp in context_pack["components"][:10]:
                lines.append(f"- {comp}")
            lines.append("")

        if "interfaces" in context_pack:
            lines.append("### Existing Interfaces")
            for iface in context_pack["interfaces"][:10]:
                lines.append(f"- {iface}")
            lines.append("")

        return "\n".join(lines) if lines else ""

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
