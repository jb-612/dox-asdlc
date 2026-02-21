"""Discovery Coordinator for orchestrating the discovery workflow.

Coordinates PRD Agent and Acceptance Agent execution, prepares
evidence bundles, and submits to HITL-1 gate.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.discovery.config import DiscoveryConfig
from src.workers.agents.discovery.models import (
    AcceptanceCriteria,
    DiscoveryResult,
    PRDDocument,
)
from src.workers.agents.discovery.prd_agent import PRDAgent
from src.workers.agents.discovery.acceptance_agent import AcceptanceAgent

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter
    from src.orchestrator.hitl_dispatcher import HITLDispatcher
    from src.orchestrator.evidence_bundle import EvidenceBundle, EvidenceItem

logger = logging.getLogger(__name__)


class DiscoveryCoordinatorError(Exception):
    """Raised when discovery coordination fails."""

    pass


@dataclass
class ProjectContext:
    """Context information about the project for discovery.

    Attributes:
        name: Project name.
        description: Project description.
        existing_docs_path: Path to existing documentation.
        git_sha: Current git SHA for versioning.
        metadata: Additional project metadata.
    """

    name: str
    description: str = ""
    existing_docs_path: str = ""
    git_sha: str = ""
    metadata: dict[str, Any] | None = None


class DiscoveryCoordinator:
    """Orchestrates the discovery workflow.

    Coordinates the execution of PRD Agent and Acceptance Agent,
    manages the workflow sequence, prepares evidence bundles,
    and submits to the HITL-1 (PRD Approval) gate.

    Example:
        coordinator = DiscoveryCoordinator(
            backend=backend,
            artifact_writer=writer,
            hitl_dispatcher=dispatcher,
            config=DiscoveryConfig(),
        )

        result = await coordinator.run_discovery(
            user_input="Build a user authentication system...",
            project_context=ProjectContext(name="Auth System"),
            context=agent_context,
        )
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        hitl_dispatcher: HITLDispatcher | None = None,
        config: DiscoveryConfig | None = None,
    ) -> None:
        """Initialize the Discovery Coordinator.

        Args:
            backend: Agent backend for text generation.
            artifact_writer: Writer for persisting artifacts.
            hitl_dispatcher: Dispatcher for HITL gate requests.
            config: Configuration for discovery agents.
        """
        self._config = config or DiscoveryConfig()
        self._artifact_writer = artifact_writer
        self._hitl_dispatcher = hitl_dispatcher

        # Initialize agents
        self._prd_agent = PRDAgent(
            backend=backend,
            artifact_writer=artifact_writer,
            config=self._config,
        )

        self._acceptance_agent = AcceptanceAgent(
            backend=backend,
            artifact_writer=artifact_writer,
            config=self._config,
        )

    async def run_discovery(
        self,
        user_input: str,
        project_context: ProjectContext,
        context: AgentContext,
        submit_to_hitl: bool = True,
    ) -> DiscoveryResult:
        """Run the complete discovery workflow.

        Executes PRD generation followed by acceptance criteria generation,
        then optionally submits to HITL-1 gate for approval.

        Args:
            user_input: Raw user requirements input.
            project_context: Project context information.
            context: Agent execution context.
            submit_to_hitl: Whether to submit to HITL-1 gate.

        Returns:
            DiscoveryResult: Result of the discovery workflow.
        """
        logger.info(f"Starting discovery workflow for task {context.task_id}")

        # Step 1: Run PRD Agent
        prd_result = await self._run_prd_agent(user_input, project_context, context)

        if not prd_result.success:
            logger.error(f"PRD generation failed: {prd_result.error_message}")
            return DiscoveryResult.failed(
                f"PRD generation failed: {prd_result.error_message}"
            )

        # Load the generated PRD
        prd = await self._load_prd_artifact(prd_result.artifact_paths[0])
        if not prd:
            return DiscoveryResult.failed("Failed to load generated PRD artifact")

        # Step 2: Run Acceptance Agent
        acceptance_result = await self._run_acceptance_agent(prd, context)

        if not acceptance_result.success:
            logger.error(
                f"Acceptance criteria generation failed: {acceptance_result.error_message}"
            )
            return DiscoveryResult.failed(
                f"Acceptance criteria generation failed: {acceptance_result.error_message}"
            )

        # Load the generated acceptance criteria
        acceptance = await self._load_acceptance_artifact(
            acceptance_result.artifact_paths[0]
        )
        if not acceptance:
            return DiscoveryResult.failed(
                "Failed to load generated acceptance criteria artifact"
            )

        # Step 3: Optionally submit to HITL-1 gate
        gate_request_id = None
        if submit_to_hitl and self._hitl_dispatcher:
            try:
                bundle = await self._prepare_evidence_bundle(
                    prd_result=prd_result,
                    acceptance_result=acceptance_result,
                    prd=prd,
                    acceptance=acceptance,
                    context=context,
                    project_context=project_context,
                )

                gate_request = await self._submit_to_hitl(
                    bundle=bundle,
                    context=context,
                )

                gate_request_id = gate_request.request_id
                logger.info(
                    f"Submitted to HITL-1 gate: {gate_request_id}"
                )

            except Exception as e:
                logger.error(f"HITL submission failed: {e}", exc_info=True)
                # Continue with success since artifacts were generated
                # HITL failure is not a workflow failure

        logger.info(
            f"Discovery workflow completed for task {context.task_id}, "
            f"requirements: {len(prd.all_requirements)}, "
            f"criteria: {len(acceptance.criteria)}"
        )

        result = DiscoveryResult.succeeded(
            prd=prd,
            acceptance_criteria=acceptance,
            gate_request_id=gate_request_id,
        )

        result.metadata = {
            "prd_artifact_path": prd_result.artifact_paths[0],
            "acceptance_artifact_path": acceptance_result.artifact_paths[0],
            "requirement_count": len(prd.all_requirements),
            "criteria_count": len(acceptance.criteria),
            "coverage_percentage": acceptance.get_coverage_percentage(),
        }

        return result

    async def _run_prd_agent(
        self,
        user_input: str,
        project_context: ProjectContext,
        context: AgentContext,
    ) -> AgentResult:
        """Run the PRD agent.

        Args:
            user_input: Raw user requirements.
            project_context: Project context.
            context: Agent execution context.

        Returns:
            AgentResult: PRD agent result.
        """
        event_metadata = {
            "raw_requirements": user_input,
            "project_title": project_context.name,
            "project_context": project_context.description,
        }

        return await self._prd_agent.execute(context, event_metadata)

    async def _run_acceptance_agent(
        self,
        prd: PRDDocument,
        context: AgentContext,
    ) -> AgentResult:
        """Run the Acceptance agent.

        Args:
            prd: Generated PRD document.
            context: Agent execution context.

        Returns:
            AgentResult: Acceptance agent result.
        """
        event_metadata = {
            "prd_document": prd,
        }

        return await self._acceptance_agent.execute(context, event_metadata)

    async def _load_prd_artifact(self, artifact_path: str) -> PRDDocument | None:
        """Load PRD document from artifact file.

        Args:
            artifact_path: Path to PRD artifact.

        Returns:
            PRDDocument | None: Loaded PRD or None.
        """
        try:
            path = Path(artifact_path)
            if not path.exists():
                logger.error(f"PRD artifact not found: {artifact_path}")
                return None

            content = path.read_text()
            return PRDDocument.from_json(content)

        except Exception as e:
            logger.error(f"Failed to load PRD artifact: {e}")
            return None

    async def _load_acceptance_artifact(
        self,
        artifact_path: str,
    ) -> AcceptanceCriteria | None:
        """Load acceptance criteria from artifact file.

        Args:
            artifact_path: Path to acceptance criteria artifact.

        Returns:
            AcceptanceCriteria | None: Loaded criteria or None.
        """
        try:
            path = Path(artifact_path)
            if not path.exists():
                logger.error(f"Acceptance artifact not found: {artifact_path}")
                return None

            content = path.read_text()
            return AcceptanceCriteria.from_json(content)

        except Exception as e:
            logger.error(f"Failed to load acceptance artifact: {e}")
            return None

    async def _prepare_evidence_bundle(
        self,
        prd_result: AgentResult,
        acceptance_result: AgentResult,
        prd: PRDDocument,
        acceptance: AcceptanceCriteria,
        context: AgentContext,
        project_context: ProjectContext,
    ) -> EvidenceBundle:
        """Prepare evidence bundle for HITL-1 gate.

        Args:
            prd_result: Result from PRD agent.
            acceptance_result: Result from Acceptance agent.
            prd: Generated PRD document.
            acceptance: Generated acceptance criteria.
            context: Agent execution context.
            project_context: Project context.

        Returns:
            EvidenceBundle: Prepared evidence bundle.
        """
        from src.orchestrator.evidence_bundle import (
            EvidenceBundle,
            EvidenceItem,
            GateType,
        )

        # Compute content hashes for integrity
        prd_path = Path(prd_result.artifact_paths[0])
        prd_hash = self._compute_file_hash(prd_path)

        acceptance_path = Path(acceptance_result.artifact_paths[0])
        acceptance_hash = self._compute_file_hash(acceptance_path)

        # Create evidence items
        items = [
            EvidenceItem(
                item_type="prd",
                path=str(prd_path),
                description="Product Requirements Document",
                content_hash=prd_hash,
                metadata={
                    "version": prd.version,
                    "title": prd.title,
                    "requirement_count": len(prd.all_requirements),
                },
            ),
            EvidenceItem(
                item_type="acceptance_criteria",
                path=str(acceptance_path),
                description="Acceptance Criteria with Coverage Matrix",
                content_hash=acceptance_hash,
                metadata={
                    "prd_version": acceptance.prd_version,
                    "criteria_count": len(acceptance.criteria),
                    "coverage_percentage": acceptance.get_coverage_percentage(),
                    "uncovered_requirements": acceptance.get_uncovered_requirements(),
                },
            ),
        ]

        # Build summary
        coverage = acceptance.get_coverage_percentage()
        uncovered = acceptance.get_uncovered_requirements()

        summary_parts = [
            f"Discovery phase complete for '{project_context.name}'.",
            f"Generated PRD with {len(prd.all_requirements)} requirements.",
            f"Created {len(acceptance.criteria)} acceptance criteria.",
            f"Coverage: {coverage:.1f}%.",
        ]

        if uncovered:
            summary_parts.append(
                f"Warning: {len(uncovered)} requirements have no coverage."
            )

        summary = " ".join(summary_parts)

        # Create bundle
        git_sha = project_context.git_sha or context.metadata.get("git_sha", "")

        return EvidenceBundle.create(
            task_id=context.task_id,
            gate_type=GateType.HITL_1_BACKLOG,
            git_sha=git_sha,
            items=items,
            summary=summary,
        )

    async def _submit_to_hitl(
        self,
        bundle: EvidenceBundle,
        context: AgentContext,
    ) -> Any:
        """Submit evidence bundle to HITL-1 gate.

        Args:
            bundle: Evidence bundle to submit.
            context: Agent execution context.

        Returns:
            GateRequest: The created gate request.
        """
        if not self._hitl_dispatcher:
            raise DiscoveryCoordinatorError("HITL dispatcher not configured")

        from src.orchestrator.evidence_bundle import GateType

        return await self._hitl_dispatcher.request_gate(
            task_id=context.task_id,
            session_id=context.session_id,
            gate_type=GateType.HITL_1_BACKLOG,
            evidence_bundle=bundle,
            requested_by="discovery_coordinator",
        )

    def _compute_file_hash(self, path: Path) -> str:
        """Compute SHA256 hash of file content.

        Args:
            path: Path to file.

        Returns:
            str: Hex-encoded SHA256 hash.
        """
        if not path.exists():
            return ""

        content = path.read_bytes()
        return hashlib.sha256(content).hexdigest()

    @property
    def prd_agent(self) -> PRDAgent:
        """Get the PRD agent instance."""
        return self._prd_agent

    @property
    def acceptance_agent(self) -> AcceptanceAgent:
        """Get the Acceptance agent instance."""
        return self._acceptance_agent

    @property
    def config(self) -> DiscoveryConfig:
        """Get the configuration."""
        return self._config


async def run_discovery_workflow(
    user_input: str,
    project_name: str,
    session_id: str,
    task_id: str,
    workspace_path: str,
    backend: AgentBackend,
    artifact_writer: ArtifactWriter,
    hitl_dispatcher: HITLDispatcher | None = None,
    config: DiscoveryConfig | None = None,
    project_description: str = "",
    git_sha: str = "",
    submit_to_hitl: bool = True,
) -> DiscoveryResult:
    """Convenience function to run discovery workflow.

    Args:
        user_input: Raw user requirements.
        project_name: Name of the project.
        session_id: Session identifier.
        task_id: Task identifier.
        workspace_path: Path to workspace directory.
        backend: Agent backend for generation.
        artifact_writer: Writer for artifacts.
        hitl_dispatcher: Optional HITL dispatcher.
        config: Optional configuration.
        project_description: Optional project description.
        git_sha: Optional git SHA.
        submit_to_hitl: Whether to submit to HITL gate.

    Returns:
        DiscoveryResult: Result of the discovery workflow.
    """
    coordinator = DiscoveryCoordinator(
        backend=backend,
        artifact_writer=artifact_writer,
        hitl_dispatcher=hitl_dispatcher,
        config=config,
    )

    context = AgentContext(
        session_id=session_id,
        task_id=task_id,
        tenant_id="default",
        workspace_path=workspace_path,
        metadata={"git_sha": git_sha},
    )

    project_context = ProjectContext(
        name=project_name,
        description=project_description,
        git_sha=git_sha,
    )

    return await coordinator.run_discovery(
        user_input=user_input,
        project_context=project_context,
        context=context,
        submit_to_hitl=submit_to_hitl,
    )
