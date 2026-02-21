"""Design Coordinator for orchestrating design workflow.

Sequences the Surveyor, Architect, and Planner agents, handles
HITL gate interactions, and aggregates results.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING

from src.workers.agents.design.config import DesignConfig
from src.workers.agents.design.models import (
    Architecture,
    DesignResult,
    ImplementationPlan,
    TechSurvey,
)
from src.workers.agents.design.surveyor_agent import SurveyorAgent
from src.workers.agents.design.architect_agent import ArchitectAgent
from src.workers.agents.design.planner_agent import PlannerAgent
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter
    from src.orchestrator.hitl_dispatcher import HITLDispatcher

logger = logging.getLogger(__name__)


class DesignCoordinatorError(Exception):
    """Raised when design coordination fails."""

    pass


@dataclass
class EvidenceBundle:
    """Evidence bundle for HITL gate submission.

    Attributes:
        gate_type: HITL gate type (hitl-2 or hitl-3).
        artifacts: List of artifact paths.
        summary: Summary of evidence.
        metadata: Additional metadata.
    """

    gate_type: str
    artifacts: list[str]
    summary: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "gate_type": self.gate_type,
            "artifacts": self.artifacts,
            "summary": self.summary,
            "metadata": self.metadata,
        }


@dataclass
class DesignCoordinator:
    """Coordinates the design workflow across multiple agents.

    Orchestrates the sequence: Surveyor -> Architect -> Planner,
    handling HITL gates after Architect (HITL-2) and Planner (HITL-3).

    Example:
        coordinator = DesignCoordinator(
            backend=backend,
            artifact_writer=writer,
            config=DesignConfig(),
        )
        result = await coordinator.run(context, prd_content)
    """

    backend: AgentBackend
    artifact_writer: ArtifactWriter
    config: DesignConfig
    hitl_dispatcher: HITLDispatcher | None = None

    def __post_init__(self) -> None:
        """Initialize agents."""
        self._surveyor = SurveyorAgent(
            backend=self.backend,
            artifact_writer=self.artifact_writer,
            config=self.config,
        )
        self._architect = ArchitectAgent(
            backend=self.backend,
            artifact_writer=self.artifact_writer,
            config=self.config,
        )
        self._planner = PlannerAgent(
            backend=self.backend,
            artifact_writer=self.artifact_writer,
            config=self.config,
        )

    async def run(
        self,
        context: AgentContext,
        prd_content: str,
        prd_reference: str = "",
        nfr_requirements: str = "",
        acceptance_criteria: str = "",
        skip_hitl: bool = False,
    ) -> DesignResult:
        """Run the complete design workflow.

        Args:
            context: Execution context.
            prd_content: PRD document content.
            prd_reference: Reference ID for PRD.
            nfr_requirements: Non-functional requirements.
            acceptance_criteria: Acceptance criteria.
            skip_hitl: Skip HITL gate submissions (for testing).

        Returns:
            DesignResult: Complete design result.
        """
        logger.info(f"Design Coordinator starting for task {context.task_id}")

        prd_reference = prd_reference or f"PRD-{context.task_id}"

        try:
            # Step 1: Run Surveyor Agent
            tech_survey, survey_artifact = await self._run_surveyor(
                context, prd_content, prd_reference
            )

            if not tech_survey:
                return DesignResult.failed("Surveyor Agent failed to produce tech survey")

            # Step 2: Run Architect Agent
            architecture, arch_artifact = await self._run_architect(
                context, tech_survey, prd_content, nfr_requirements
            )

            if not architecture:
                return DesignResult.failed("Architect Agent failed to produce architecture")

            # Step 3: Submit to HITL-2 (Architecture Review)
            hitl2_request_id = None
            if not skip_hitl and self.hitl_dispatcher:
                hitl2_request_id = await self._submit_hitl2(
                    context, tech_survey, architecture, [survey_artifact, arch_artifact]
                )

                if hitl2_request_id:
                    # Return pending result - caller should wait for HITL approval
                    return DesignResult.pending_hitl2(hitl2_request_id)

            # Step 4: Run Planner Agent
            implementation_plan, plan_artifact = await self._run_planner(
                context, architecture, prd_content, tech_survey, acceptance_criteria
            )

            if not implementation_plan:
                return DesignResult.failed("Planner Agent failed to produce implementation plan")

            # Step 5: Submit to HITL-3 (Implementation Plan Review)
            hitl3_request_id = None
            if not skip_hitl and self.hitl_dispatcher:
                hitl3_request_id = await self._submit_hitl3(
                    context, implementation_plan, [plan_artifact]
                )

                if hitl3_request_id:
                    # Return pending result
                    return DesignResult.pending_hitl3(
                        tech_survey, architecture, hitl3_request_id
                    )

            # All steps complete
            logger.info(f"Design Coordinator completed for task {context.task_id}")

            return DesignResult.succeeded(
                tech_survey=tech_survey,
                architecture=architecture,
                implementation_plan=implementation_plan,
                hitl2_request_id=hitl2_request_id,
                hitl3_request_id=hitl3_request_id,
            )

        except Exception as e:
            logger.error(f"Design Coordinator failed: {e}", exc_info=True)
            return DesignResult.failed(str(e))

    async def run_from_hitl2_approval(
        self,
        context: AgentContext,
        tech_survey: TechSurvey,
        architecture: Architecture,
        prd_content: str,
        acceptance_criteria: str = "",
        skip_hitl: bool = False,
    ) -> DesignResult:
        """Continue workflow after HITL-2 approval.

        Args:
            context: Execution context.
            tech_survey: Approved tech survey.
            architecture: Approved architecture.
            prd_content: PRD document content.
            acceptance_criteria: Acceptance criteria.
            skip_hitl: Skip HITL-3 submission.

        Returns:
            DesignResult: Complete design result.
        """
        logger.info(f"Resuming from HITL-2 approval for task {context.task_id}")

        try:
            # Run Planner Agent
            implementation_plan, plan_artifact = await self._run_planner(
                context, architecture, prd_content, tech_survey, acceptance_criteria
            )

            if not implementation_plan:
                return DesignResult.failed("Planner Agent failed to produce implementation plan")

            # Submit to HITL-3
            hitl3_request_id = None
            if not skip_hitl and self.hitl_dispatcher:
                hitl3_request_id = await self._submit_hitl3(
                    context, implementation_plan, [plan_artifact]
                )

                if hitl3_request_id:
                    return DesignResult.pending_hitl3(
                        tech_survey, architecture, hitl3_request_id
                    )

            return DesignResult.succeeded(
                tech_survey=tech_survey,
                architecture=architecture,
                implementation_plan=implementation_plan,
                hitl3_request_id=hitl3_request_id,
            )

        except Exception as e:
            logger.error(f"Design Coordinator (from HITL-2) failed: {e}", exc_info=True)
            return DesignResult.failed(str(e))

    async def _run_surveyor(
        self,
        context: AgentContext,
        prd_content: str,
        prd_reference: str,
    ) -> tuple[TechSurvey | None, str]:
        """Run Surveyor Agent.

        Args:
            context: Execution context.
            prd_content: PRD document content.
            prd_reference: PRD reference ID.

        Returns:
            tuple: (TechSurvey or None, artifact path)
        """
        logger.info("Running Surveyor Agent")

        result = await self._surveyor.execute(
            context=context,
            event_metadata={
                "prd_content": prd_content,
                "prd_reference": prd_reference,
            },
        )

        if not result.success:
            logger.error(f"Surveyor Agent failed: {result.error_message}")
            return None, ""

        # Load tech survey from artifact
        artifact_path = result.artifact_paths[0] if result.artifact_paths else ""

        if artifact_path:
            try:
                tech_survey = await self._load_tech_survey(artifact_path)
                return tech_survey, artifact_path
            except Exception as e:
                logger.error(f"Failed to load tech survey: {e}")

        return None, artifact_path

    async def _run_architect(
        self,
        context: AgentContext,
        tech_survey: TechSurvey,
        prd_content: str,
        nfr_requirements: str,
    ) -> tuple[Architecture | None, str]:
        """Run Architect Agent.

        Args:
            context: Execution context.
            tech_survey: Technology survey.
            prd_content: PRD document content.
            nfr_requirements: Non-functional requirements.

        Returns:
            tuple: (Architecture or None, artifact path)
        """
        logger.info("Running Architect Agent")

        result = await self._architect.execute(
            context=context,
            event_metadata={
                "tech_survey": tech_survey.to_json(),
                "prd_content": prd_content,
                "tech_survey_reference": tech_survey.prd_reference,
                "nfr_requirements": nfr_requirements,
            },
        )

        if not result.success:
            logger.error(f"Architect Agent failed: {result.error_message}")
            return None, ""

        artifact_path = result.artifact_paths[0] if result.artifact_paths else ""

        if artifact_path:
            try:
                architecture = await self._load_architecture(artifact_path)
                return architecture, artifact_path
            except Exception as e:
                logger.error(f"Failed to load architecture: {e}")

        return None, artifact_path

    async def _run_planner(
        self,
        context: AgentContext,
        architecture: Architecture,
        prd_content: str,
        tech_survey: TechSurvey,
        acceptance_criteria: str,
    ) -> tuple[ImplementationPlan | None, str]:
        """Run Planner Agent.

        Args:
            context: Execution context.
            architecture: Architecture document.
            prd_content: PRD document content.
            tech_survey: Technology survey.
            acceptance_criteria: Acceptance criteria.

        Returns:
            tuple: (ImplementationPlan or None, artifact path)
        """
        logger.info("Running Planner Agent")

        result = await self._planner.execute(
            context=context,
            event_metadata={
                "architecture": architecture.to_json(),
                "prd_content": prd_content,
                "architecture_reference": architecture.tech_survey_reference,
                "tech_survey": tech_survey.to_json(),
                "acceptance_criteria": acceptance_criteria,
            },
        )

        if not result.success:
            logger.error(f"Planner Agent failed: {result.error_message}")
            return None, ""

        artifact_path = result.artifact_paths[0] if result.artifact_paths else ""

        if artifact_path:
            try:
                plan = await self._load_implementation_plan(artifact_path)
                return plan, artifact_path
            except Exception as e:
                logger.error(f"Failed to load implementation plan: {e}")

        return None, artifact_path

    async def _submit_hitl2(
        self,
        context: AgentContext,
        tech_survey: TechSurvey,
        architecture: Architecture,
        artifact_paths: list[str],
    ) -> str | None:
        """Submit to HITL-2 gate.

        Args:
            context: Execution context.
            tech_survey: Technology survey.
            architecture: Architecture document.
            artifact_paths: Paths to artifacts.

        Returns:
            str | None: HITL request ID or None.
        """
        if not self.hitl_dispatcher:
            return None

        try:
            bundle = self._create_hitl2_bundle(
                tech_survey, architecture, artifact_paths
            )

            request_id = await self.hitl_dispatcher.submit(
                gate_type="hitl-2",
                session_id=context.session_id,
                task_id=context.task_id,
                tenant_id=context.tenant_id,
                evidence=bundle.to_dict(),
            )

            logger.info(f"Submitted HITL-2 request: {request_id}")
            return request_id

        except Exception as e:
            logger.error(f"Failed to submit HITL-2: {e}")
            return None

    async def _submit_hitl3(
        self,
        context: AgentContext,
        implementation_plan: ImplementationPlan,
        artifact_paths: list[str],
    ) -> str | None:
        """Submit to HITL-3 gate.

        Args:
            context: Execution context.
            implementation_plan: Implementation plan.
            artifact_paths: Paths to artifacts.

        Returns:
            str | None: HITL request ID or None.
        """
        if not self.hitl_dispatcher:
            return None

        try:
            bundle = self._create_hitl3_bundle(
                implementation_plan, artifact_paths
            )

            request_id = await self.hitl_dispatcher.submit(
                gate_type="hitl-3",
                session_id=context.session_id,
                task_id=context.task_id,
                tenant_id=context.tenant_id,
                evidence=bundle.to_dict(),
            )

            logger.info(f"Submitted HITL-3 request: {request_id}")
            return request_id

        except Exception as e:
            logger.error(f"Failed to submit HITL-3: {e}")
            return None

    def _create_hitl2_bundle(
        self,
        tech_survey: TechSurvey,
        architecture: Architecture,
        artifact_paths: list[str],
    ) -> EvidenceBundle:
        """Create HITL-2 evidence bundle.

        Args:
            tech_survey: Technology survey.
            architecture: Architecture document.
            artifact_paths: Artifact paths.

        Returns:
            EvidenceBundle: Evidence bundle for HITL-2.
        """
        summary_lines = [
            "## Architecture Design Review",
            "",
            f"**Architecture Style:** {architecture.style.value}",
            f"**Components:** {len(architecture.components)}",
            f"**Data Flows:** {len(architecture.data_flows)}",
            f"**Diagrams:** {len(architecture.diagrams)}",
            "",
            "### Technology Choices",
        ]

        for tech in tech_survey.technologies[:5]:
            summary_lines.append(f"- **{tech.category}:** {tech.selected}")

        if architecture.security_considerations:
            summary_lines.extend(["", "### Security Considerations"])
            for consideration in architecture.security_considerations[:3]:
                summary_lines.append(f"- {consideration}")

        return EvidenceBundle(
            gate_type="hitl-2",
            artifacts=artifact_paths,
            summary="\n".join(summary_lines),
            metadata={
                "component_count": len(architecture.components),
                "technology_count": len(tech_survey.technologies),
                "risk_count": len(tech_survey.risk_assessment),
            },
        )

    def _create_hitl3_bundle(
        self,
        implementation_plan: ImplementationPlan,
        artifact_paths: list[str],
    ) -> EvidenceBundle:
        """Create HITL-3 evidence bundle.

        Args:
            implementation_plan: Implementation plan.
            artifact_paths: Artifact paths.

        Returns:
            EvidenceBundle: Evidence bundle for HITL-3.
        """
        summary_lines = [
            "## Implementation Plan Review",
            "",
            f"**Total Tasks:** {len(implementation_plan.tasks)}",
            f"**Phases:** {len(implementation_plan.phases)}",
            f"**Estimated Effort:** {implementation_plan.total_estimated_effort}",
            "",
            "### Critical Path",
            " -> ".join(implementation_plan.critical_path[:5]),
        ]

        if implementation_plan.critical_path:
            summary_lines.append(f"... ({len(implementation_plan.critical_path)} tasks)")

        summary_lines.extend(["", "### Phases"])
        for phase in implementation_plan.phases:
            summary_lines.append(f"- **{phase.name}:** {len(phase.task_ids)} tasks")

        return EvidenceBundle(
            gate_type="hitl-3",
            artifacts=artifact_paths,
            summary="\n".join(summary_lines),
            metadata={
                "task_count": len(implementation_plan.tasks),
                "phase_count": len(implementation_plan.phases),
                "critical_path_length": len(implementation_plan.critical_path),
                "total_effort": implementation_plan.total_estimated_effort,
            },
        )

    async def _load_tech_survey(self, artifact_path: str) -> TechSurvey:
        """Load TechSurvey from artifact file.

        Args:
            artifact_path: Path to artifact.

        Returns:
            TechSurvey: Loaded tech survey.
        """
        import aiofiles

        async with aiofiles.open(artifact_path, 'r') as f:
            content = await f.read()

        return TechSurvey.from_json(content)

    async def _load_architecture(self, artifact_path: str) -> Architecture:
        """Load Architecture from artifact file.

        Args:
            artifact_path: Path to artifact.

        Returns:
            Architecture: Loaded architecture.
        """
        import aiofiles

        async with aiofiles.open(artifact_path, 'r') as f:
            content = await f.read()

        return Architecture.from_json(content)

    async def _load_implementation_plan(self, artifact_path: str) -> ImplementationPlan:
        """Load ImplementationPlan from artifact file.

        Args:
            artifact_path: Path to artifact.

        Returns:
            ImplementationPlan: Loaded implementation plan.
        """
        import aiofiles

        async with aiofiles.open(artifact_path, 'r') as f:
            content = await f.read()

        return ImplementationPlan.from_json(content)

    async def handle_rejection(
        self,
        context: AgentContext,
        gate_type: str,
        feedback: str,
    ) -> DesignResult:
        """Handle HITL rejection and provide feedback.

        Args:
            context: Execution context.
            gate_type: HITL gate type that rejected.
            feedback: Rejection feedback.

        Returns:
            DesignResult: Failed result with feedback.
        """
        logger.warning(
            f"Design rejected at {gate_type} for task {context.task_id}: {feedback}"
        )

        return DesignResult.failed(
            f"Rejected at {gate_type}: {feedback}"
        )

    def get_agent_statuses(self) -> dict[str, str]:
        """Get status of all agents.

        Returns:
            dict: Agent type to status mapping.
        """
        return {
            "surveyor_agent": "ready",
            "architect_agent": "ready",
            "planner_agent": "ready",
        }
