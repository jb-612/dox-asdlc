"""Architect Agent for designing system architectures.

Consumes technology surveys and PRDs to design component-based
architectures with clear interfaces and Mermaid diagrams. Delegates
work to a pluggable AgentBackend (Claude Code CLI, Codex CLI, or
direct LLM API calls).
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
    Architecture,
    ArchitectureStyle,
    Component,
    DataFlow,
    DiagramReference,
    DiagramType,
    Interface,
)
from src.workers.agents.design.prompts.architect_prompts import (
    ARCHITECT_SYSTEM_PROMPT as _ARCHITECT_SYSTEM_PROMPT,
)

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
ARCHITECT_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "architecture_style": {"type": "string"},
        "style_rationale": {"type": "string"},
        "components": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "responsibility": {"type": "string"},
                    "technology": {"type": "string"},
                    "interfaces": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "description": {"type": "string"},
                                "methods": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "data_types": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                        },
                    },
                    "dependencies": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "notes": {"type": "string"},
                },
                "required": ["name", "responsibility"],
            },
        },
        "data_flows": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "target": {"type": "string"},
                    "data_type": {"type": "string"},
                    "description": {"type": "string"},
                    "protocol": {"type": "string"},
                },
            },
        },
        "deployment_model": {"type": "string"},
        "diagrams": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "diagram_type": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "mermaid_code": {"type": "string"},
                },
            },
        },
        "nfr_evaluation": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "requirement": {"type": "string"},
                    "category": {"type": "string"},
                    "status": {"type": "string"},
                    "how_addressed": {"type": "string"},
                    "gaps": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "recommendations": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
        },
        "security_considerations": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["components"],
}

# System prompt for the architect backend
ARCHITECT_SYSTEM_PROMPT = _ARCHITECT_SYSTEM_PROMPT


def _build_architect_prompt(
    tech_survey: str,
    prd_content: str,
    context_pack_summary: str = "",
    nfr_requirements: str = "",
) -> str:
    """Build the complete prompt for the architect backend.

    Combines tech survey, PRD, context pack, and NFR requirements
    into a single prompt requesting a complete architecture design.

    Args:
        tech_survey: Technology survey JSON content.
        prd_content: PRD document content.
        context_pack_summary: Summary from repo mapper context pack.
        nfr_requirements: Non-functional requirements text.

    Returns:
        str: Complete prompt for the backend.
    """
    context_section = ""
    if context_pack_summary:
        context_section = f"""
## Existing Codebase Context
{context_pack_summary}
"""

    nfr_section = ""
    nfr_instructions = ""
    if nfr_requirements:
        nfr_section = f"""
## Non-Functional Requirements
{nfr_requirements}
"""
        nfr_instructions = """
5. Validate the architecture against the NFRs and include:
   - "nfr_evaluation": array of objects with requirement, category, status, how_addressed, gaps, recommendations
   - "security_considerations": array of security-specific notes"""

    return f"""Design a complete component-based architecture for the system described in the PRD.

## Technology Survey
{tech_survey}

## PRD Document
{prd_content}
{context_section}{nfr_section}
## Task
Design the system architecture by:
1. Identifying major components and their responsibilities, defining boundaries and interfaces
2. Specifying technology choices per component and identifying dependencies
3. Defining data flows between components with protocols
4. Generating Mermaid diagrams (component, sequence, and deployment diagrams)
{nfr_instructions}

Consider:
- Single Responsibility Principle for components
- Loose coupling between components
- Clear API contracts at boundaries
- Scalability and maintainability

Respond with a single JSON object containing:
- "architecture_style": one of "monolith", "microservices", "event_driven", "serverless", "layered", "modular_monolith"
- "style_rationale": string explaining the style choice
- "components": array of component objects, each with "name", "responsibility", "technology", "interfaces" (array of {{name, description, methods, data_types}}), "dependencies" (array of component names), "notes"
- "data_flows": array of flow objects, each with "source", "target", "data_type", "description", "protocol" (REST|gRPC|async|event|direct)
- "deployment_model": string describing deployment strategy
- "diagrams": array of diagram objects, each with "diagram_type" (component|sequence|flow|erd|deployment|class), "title", "description", "mermaid_code" (valid Mermaid syntax)
"""


def _parse_design_from_result(
    result: BackendResult,
) -> dict[str, Any] | None:
    """Parse architecture design data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.

    Args:
        result: Backend execution result.

    Returns:
        dict | None: Parsed design data, or None if parsing fails.
    """
    data = None

    # Prefer structured output from --json-schema backends
    if result.structured_output and "components" in result.structured_output:
        data = result.structured_output
    else:
        content = result.output
        if content:
            data = parse_json_from_response(content)

    if not data or "components" not in data:
        return None

    return data


class ArchitectAgentError(Exception):
    """Raised when Architect agent operations fail."""

    pass


class ArchitectAgent:
    """Agent that designs system architectures from requirements.

    Delegates the actual architecture design to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = ArchitectAgent(
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
        """Initialize the Architect agent.

        Args:
            backend: Agent backend for architecture design.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
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
        logger.info(
            f"Architect Agent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

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
                context_pack_summary = self._summarize_context_pack(
                    context.context_pack
                )

            # Build combined prompt
            prompt = _build_architect_prompt(
                tech_survey=tech_survey,
                prd_content=prd_content,
                context_pack_summary=context_pack_summary,
                nfr_requirements=nfr_requirements,
            )

            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.architect_model,
                output_schema=ARCHITECT_OUTPUT_SCHEMA,
                system_prompt=ARCHITECT_SYSTEM_PROMPT,
                timeout_seconds=300,
                allowed_tools=["Read", "Glob", "Grep"],
            )

            # Execute via backend (single call for all design work)
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

            # Parse design from result
            design_data = _parse_design_from_result(result)

            if not design_data:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to design component architecture",
                    should_retry=True,
                )

            # Extract diagrams from combined result
            diagrams = design_data.get("diagrams", [])

            # Extract NFR considerations if present
            nfr_considerations: dict[str, str] = {}
            security_considerations: list[str] = []
            if nfr_requirements:
                nfr_eval = design_data.get("nfr_evaluation", [])
                if nfr_eval:
                    nfr_considerations = self._extract_nfr_considerations(
                        {"nfr_evaluation": nfr_eval}
                    )
                security_considerations = design_data.get(
                    "security_considerations", []
                )

            # Build architecture document
            architecture = self._build_architecture(
                design=design_data,
                diagrams=diagrams,
                tech_survey_reference=tech_survey_reference,
                nfr_considerations=nfr_considerations,
                security_considerations=security_considerations,
            )

            # Write artifact
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
                    "backend": self._backend.backend_name,
                    "cost_usd": result.cost_usd,
                    "turns": result.turns,
                    "session_id": result.session_id,
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
        considerations: dict[str, str] = {}
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
        lines: list[str] = []

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
