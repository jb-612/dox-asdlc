"""ValidationDeploymentCoordinator for workflow coordination.

Orchestrates the validation and deployment workflow across multiple agents,
handling HITL gate interactions, approvals, and rejections.

Workflow:
1. Validation Phase: Validation -> Security -> HITL-5
2. Deployment Phase: Release -> Deployment -> HITL-6 -> Monitor
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from src.workers.agents.deployment.config import DeploymentConfig
from src.workers.agents.deployment.models import (
    DeploymentPlan,
    MonitoringConfig,
    ReleaseManifest,
)
from src.workers.agents.deployment.deployment_agent import DeploymentAgent
from src.workers.agents.deployment.monitor_agent import MonitorAgent
from src.workers.agents.deployment.release_agent import ReleaseAgent
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    SecurityReport,
    ValidationReport,
)
from src.workers.agents.validation.security_agent import SecurityAgent
from src.workers.agents.validation.validation_agent import ValidationAgent

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient
    from src.workers.agents.development.test_runner import TestRunner
    from src.workers.rlm.integration import RLMIntegration
    from src.orchestrator.hitl_dispatcher import HITLDispatcher

logger = logging.getLogger(__name__)


class ValidationDeploymentCoordinatorError(Exception):
    """Raised when validation-deployment coordination fails."""

    pass


@dataclass
class EvidenceBundle:
    """Evidence bundle for HITL gate submission.

    Attributes:
        gate_type: HITL gate type (hitl-5 or hitl-6).
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
class ValidationResult:
    """Result from validation phase.

    Attributes:
        success: Whether validation passed.
        validation_report: Validation report if validation ran.
        security_report: Security report if security ran.
        pending_hitl5: Whether awaiting HITL-5 approval.
        hitl5_request_id: HITL-5 request ID if submitted.
        failed_at: Which step failed (validation/security).
        error: Error message if failed.
    """

    success: bool = False
    validation_report: ValidationReport | None = None
    security_report: SecurityReport | None = None
    pending_hitl5: bool = False
    hitl5_request_id: str | None = None
    failed_at: str | None = None
    error: str | None = None

    @classmethod
    def failed(cls, at: str, error: str = "") -> ValidationResult:
        """Create failed result.

        Args:
            at: Step that failed.
            error: Error message.

        Returns:
            ValidationResult: Failed result.
        """
        return cls(success=False, failed_at=at, error=error)

    @classmethod
    def pending_approval(
        cls,
        validation_report: ValidationReport,
        security_report: SecurityReport,
        request_id: str,
    ) -> ValidationResult:
        """Create pending approval result.

        Args:
            validation_report: Validation report.
            security_report: Security report.
            request_id: HITL-5 request ID.

        Returns:
            ValidationResult: Pending approval result.
        """
        return cls(
            success=True,
            validation_report=validation_report,
            security_report=security_report,
            pending_hitl5=True,
            hitl5_request_id=request_id,
        )

    @classmethod
    def succeeded(
        cls,
        validation_report: ValidationReport,
        security_report: SecurityReport,
    ) -> ValidationResult:
        """Create success result.

        Args:
            validation_report: Validation report.
            security_report: Security report.

        Returns:
            ValidationResult: Success result.
        """
        return cls(
            success=True,
            validation_report=validation_report,
            security_report=security_report,
            pending_hitl5=False,
        )


@dataclass
class DeploymentResult:
    """Result from deployment phase.

    Attributes:
        success: Whether deployment succeeded.
        release_manifest: Release manifest if generated.
        deployment_plan: Deployment plan if generated.
        monitoring_config: Monitoring config if generated.
        pending_hitl6: Whether awaiting HITL-6 approval.
        hitl6_request_id: HITL-6 request ID if submitted.
        failed_at: Which step failed.
        error: Error message if failed.
    """

    success: bool = False
    release_manifest: ReleaseManifest | None = None
    deployment_plan: DeploymentPlan | None = None
    monitoring_config: MonitoringConfig | None = None
    pending_hitl6: bool = False
    hitl6_request_id: str | None = None
    failed_at: str | None = None
    error: str | None = None

    @classmethod
    def failed(cls, at: str, error: str = "") -> DeploymentResult:
        """Create failed result.

        Args:
            at: Step that failed.
            error: Error message.

        Returns:
            DeploymentResult: Failed result.
        """
        return cls(success=False, failed_at=at, error=error)

    @classmethod
    def pending_approval(
        cls,
        release_manifest: ReleaseManifest,
        deployment_plan: DeploymentPlan,
        request_id: str,
    ) -> DeploymentResult:
        """Create pending approval result.

        Args:
            release_manifest: Release manifest.
            deployment_plan: Deployment plan.
            request_id: HITL-6 request ID.

        Returns:
            DeploymentResult: Pending approval result.
        """
        return cls(
            success=True,
            release_manifest=release_manifest,
            deployment_plan=deployment_plan,
            pending_hitl6=True,
            hitl6_request_id=request_id,
        )

    @classmethod
    def succeeded(
        cls,
        release_manifest: ReleaseManifest,
        deployment_plan: DeploymentPlan,
        monitoring_config: MonitoringConfig,
    ) -> DeploymentResult:
        """Create success result.

        Args:
            release_manifest: Release manifest.
            deployment_plan: Deployment plan.
            monitoring_config: Monitoring configuration.

        Returns:
            DeploymentResult: Success result.
        """
        return cls(
            success=True,
            release_manifest=release_manifest,
            deployment_plan=deployment_plan,
            monitoring_config=monitoring_config,
            pending_hitl6=False,
        )


@dataclass
class RejectionResult:
    """Result from handling a rejection.

    Attributes:
        success: Always False for rejections.
        rejection_reason: Reason for rejection.
        feedback: Human feedback from rejection.
    """

    success: bool = False
    rejection_reason: str = ""
    feedback: str = ""


@dataclass
class ValidationDeploymentCoordinator:
    """Coordinates validation and deployment workflow across agents.

    Orchestrates the sequence:
    - Validation Phase: Validation Agent -> Security Agent -> HITL-5
    - Deployment Phase: Release Agent -> Deployment Agent -> HITL-6 -> Monitor Agent

    Example:
        coordinator = ValidationDeploymentCoordinator(
            llm_client=client,
            artifact_writer=writer,
            test_runner=runner,
            validation_config=ValidationConfig(),
            deployment_config=DeploymentConfig(),
        )
        result = await coordinator.run_validation(context, implementation, acceptance)
    """

    llm_client: LLMClient
    artifact_writer: ArtifactWriter
    test_runner: TestRunner
    validation_config: ValidationConfig
    deployment_config: DeploymentConfig
    rlm_integration: RLMIntegration | None = None
    hitl_dispatcher: HITLDispatcher | None = None

    def __post_init__(self) -> None:
        """Initialize agents."""
        self._validation_agent = ValidationAgent(
            llm_client=self.llm_client,
            artifact_writer=self.artifact_writer,
            test_runner=self.test_runner,
            config=self.validation_config,
            rlm_integration=self.rlm_integration,
        )
        self._security_agent = SecurityAgent(
            llm_client=self.llm_client,
            artifact_writer=self.artifact_writer,
            config=self.validation_config,
        )
        self._release_agent = ReleaseAgent(
            llm_client=self.llm_client,
            artifact_writer=self.artifact_writer,
            config=self.deployment_config,
        )
        self._deployment_agent = DeploymentAgent(
            llm_client=self.llm_client,
            artifact_writer=self.artifact_writer,
            config=self.deployment_config,
        )
        self._monitor_agent = MonitorAgent(
            llm_client=self.llm_client,
            artifact_writer=self.artifact_writer,
            config=self.deployment_config,
        )

    async def run_validation(
        self,
        context: AgentContext,
        implementation: dict[str, Any],
        acceptance_criteria: list[str],
        skip_hitl: bool = False,
    ) -> ValidationResult:
        """Run the validation phase workflow.

        Workflow: Validation Agent -> Security Agent -> HITL-5

        Args:
            context: Execution context.
            implementation: Implementation to validate.
            acceptance_criteria: Acceptance criteria list.
            skip_hitl: Skip HITL-5 submission (for testing).

        Returns:
            ValidationResult: Result of validation phase.
        """
        logger.info(f"Starting validation workflow for task {context.task_id}")

        try:
            # Step 1: Run Validation Agent
            validation_result = await self._run_validation_agent(
                context=context,
                implementation=implementation,
                acceptance_criteria=acceptance_criteria,
            )

            if not validation_result.success:
                logger.warning(
                    f"Validation failed for task {context.task_id}: "
                    f"{validation_result.error_message}"
                )
                return ValidationResult.failed(
                    at="validation",
                    error=validation_result.error_message or "Validation failed",
                )

            # Extract validation report
            validation_report = self._extract_validation_report(validation_result)
            if not validation_report or not validation_report.passed:
                return ValidationResult.failed(
                    at="validation",
                    error="Validation checks failed",
                )

            # Step 2: Run Security Agent
            security_result = await self._run_security_agent(
                context=context,
                implementation=implementation,
            )

            if not security_result.success:
                logger.warning(
                    f"Security scan failed for task {context.task_id}: "
                    f"{security_result.error_message}"
                )
                return ValidationResult.failed(
                    at="security",
                    error=security_result.error_message or "Security scan failed",
                )

            # Extract security report
            security_report = self._extract_security_report(security_result)
            if not security_report or not security_report.passed:
                return ValidationResult.failed(
                    at="security",
                    error="Security scan found blocking findings",
                )

            # Step 3: Submit to HITL-5
            if not skip_hitl and self.hitl_dispatcher:
                request_id = await self._submit_hitl5(
                    context=context,
                    validation_report=validation_report,
                    security_report=security_report,
                    artifact_paths=(
                        validation_result.artifact_paths
                        + security_result.artifact_paths
                    ),
                )

                if request_id:
                    logger.info(f"Submitted HITL-5 request: {request_id}")
                    return ValidationResult.pending_approval(
                        validation_report=validation_report,
                        security_report=security_report,
                        request_id=request_id,
                    )

            # No HITL submission - return success
            logger.info(f"Validation workflow completed for task {context.task_id}")
            return ValidationResult.succeeded(
                validation_report=validation_report,
                security_report=security_report,
            )

        except Exception as e:
            logger.error(f"Validation workflow failed: {e}", exc_info=True)
            return ValidationResult.failed(at="validation", error=str(e))

    async def run_deployment(
        self,
        context: AgentContext,
        hitl5_approval: dict[str, Any],
        validation_report: ValidationReport,
        security_report: SecurityReport,
        target_environment: str,
        skip_hitl: bool = False,
    ) -> DeploymentResult:
        """Run the deployment phase workflow.

        Workflow: Release Agent -> Deployment Agent -> HITL-6 -> Monitor Agent

        Args:
            context: Execution context.
            hitl5_approval: HITL-5 approval data.
            validation_report: Validation report from validation phase.
            security_report: Security report from validation phase.
            target_environment: Target deployment environment.
            skip_hitl: Skip HITL-6 submission (for testing).

        Returns:
            DeploymentResult: Result of deployment phase.
        """
        logger.info(f"Starting deployment workflow for task {context.task_id}")

        try:
            # Step 1: Run Release Agent
            release_result = await self._run_release_agent(
                context=context,
                validation_report=validation_report,
                security_report=security_report,
            )

            if not release_result.success:
                logger.warning(
                    f"Release generation failed for task {context.task_id}: "
                    f"{release_result.error_message}"
                )
                return DeploymentResult.failed(
                    at="release",
                    error=release_result.error_message or "Release generation failed",
                )

            # Extract release manifest
            release_manifest = self._extract_release_manifest(release_result)
            if not release_manifest:
                return DeploymentResult.failed(
                    at="release",
                    error="Failed to generate release manifest",
                )

            # Step 2: Run Deployment Agent
            deployment_result = await self._run_deployment_agent(
                context=context,
                release_manifest=release_manifest,
                target_environment=target_environment,
            )

            if not deployment_result.success:
                logger.warning(
                    f"Deployment planning failed for task {context.task_id}: "
                    f"{deployment_result.error_message}"
                )
                return DeploymentResult.failed(
                    at="deployment",
                    error=deployment_result.error_message or "Deployment planning failed",
                )

            # Extract deployment plan
            deployment_plan = self._extract_deployment_plan(deployment_result)
            if not deployment_plan:
                return DeploymentResult.failed(
                    at="deployment",
                    error="Failed to generate deployment plan",
                )

            # Step 3: Submit to HITL-6
            if not skip_hitl and self.hitl_dispatcher:
                request_id = await self._submit_hitl6(
                    context=context,
                    release_manifest=release_manifest,
                    deployment_plan=deployment_plan,
                    artifact_paths=(
                        release_result.artifact_paths
                        + deployment_result.artifact_paths
                    ),
                )

                if request_id:
                    logger.info(f"Submitted HITL-6 request: {request_id}")
                    return DeploymentResult.pending_approval(
                        release_manifest=release_manifest,
                        deployment_plan=deployment_plan,
                        request_id=request_id,
                    )

            # Step 4: Run Monitor Agent (after HITL-6 or if skipped)
            monitor_result = await self._run_monitor_agent(
                context=context,
                deployment_plan=deployment_plan,
            )

            if not monitor_result.success:
                logger.warning(
                    f"Monitoring config generation failed for task {context.task_id}"
                )
                # Continue anyway - monitoring failure shouldn't block deployment
                monitoring_config = None
            else:
                monitoring_config = self._extract_monitoring_config(monitor_result)

            logger.info(f"Deployment workflow completed for task {context.task_id}")
            return DeploymentResult.succeeded(
                release_manifest=release_manifest,
                deployment_plan=deployment_plan,
                monitoring_config=monitoring_config,
            )

        except Exception as e:
            logger.error(f"Deployment workflow failed: {e}", exc_info=True)
            return DeploymentResult.failed(at="deployment", error=str(e))

    async def continue_from_hitl6_approval(
        self,
        context: AgentContext,
        hitl6_approval: dict[str, Any],
        release_manifest: ReleaseManifest,
        deployment_plan: DeploymentPlan,
    ) -> DeploymentResult:
        """Continue workflow after HITL-6 approval.

        Args:
            context: Execution context.
            hitl6_approval: HITL-6 approval data.
            release_manifest: Approved release manifest.
            deployment_plan: Approved deployment plan.

        Returns:
            DeploymentResult: Final deployment result with monitoring config.
        """
        logger.info(
            f"Continuing from HITL-6 approval for task {context.task_id}"
        )

        try:
            # Run Monitor Agent
            monitor_result = await self._run_monitor_agent(
                context=context,
                deployment_plan=deployment_plan,
            )

            if not monitor_result.success:
                logger.warning(
                    f"Monitoring config generation failed for task {context.task_id}"
                )
                monitoring_config = None
            else:
                monitoring_config = self._extract_monitoring_config(monitor_result)

            return DeploymentResult.succeeded(
                release_manifest=release_manifest,
                deployment_plan=deployment_plan,
                monitoring_config=monitoring_config,
            )

        except Exception as e:
            logger.error(f"Continue from HITL-6 failed: {e}", exc_info=True)
            return DeploymentResult.failed(at="monitor", error=str(e))

    async def handle_rejection(
        self,
        context: AgentContext,
        gate_type: str,
        feedback: str,
    ) -> RejectionResult:
        """Handle HITL rejection.

        Args:
            context: Execution context.
            gate_type: HITL gate that rejected (hitl-5 or hitl-6).
            feedback: Human feedback explaining rejection.

        Returns:
            RejectionResult: Result indicating rejection with feedback.
        """
        logger.warning(
            f"Handling {gate_type} rejection for task {context.task_id}: {feedback}"
        )

        return RejectionResult(
            success=False,
            rejection_reason=f"Rejected at {gate_type}",
            feedback=feedback,
        )

    async def _run_validation_agent(
        self,
        context: AgentContext,
        implementation: dict[str, Any],
        acceptance_criteria: list[str],
    ) -> AgentResult:
        """Run the validation agent.

        Args:
            context: Execution context.
            implementation: Implementation to validate.
            acceptance_criteria: List of acceptance criteria.

        Returns:
            AgentResult: Result from validation agent.
        """
        logger.info("Running Validation Agent")

        return await self._validation_agent.execute(
            context=context,
            event_metadata={
                "implementation": implementation,
                "acceptance_criteria": acceptance_criteria,
                "feature_id": implementation.get("feature_id", context.task_id),
            },
        )

    async def _run_security_agent(
        self,
        context: AgentContext,
        implementation: dict[str, Any],
    ) -> AgentResult:
        """Run the security agent.

        Args:
            context: Execution context.
            implementation: Implementation to scan.

        Returns:
            AgentResult: Result from security agent.
        """
        logger.info("Running Security Agent")

        return await self._security_agent.execute(
            context=context,
            event_metadata={
                "implementation": implementation,
                "feature_id": implementation.get("feature_id", context.task_id),
            },
        )

    async def _run_release_agent(
        self,
        context: AgentContext,
        validation_report: ValidationReport,
        security_report: SecurityReport,
    ) -> AgentResult:
        """Run the release agent.

        Args:
            context: Execution context.
            validation_report: Validation report.
            security_report: Security report.

        Returns:
            AgentResult: Result from release agent.
        """
        logger.info("Running Release Agent")

        return await self._release_agent.execute(
            context=context,
            event_metadata={
                "validation_report": validation_report.to_dict(),
                "security_report": security_report.to_dict(),
            },
        )

    async def _run_deployment_agent(
        self,
        context: AgentContext,
        release_manifest: ReleaseManifest,
        target_environment: str,
    ) -> AgentResult:
        """Run the deployment agent.

        Args:
            context: Execution context.
            release_manifest: Release manifest.
            target_environment: Target environment.

        Returns:
            AgentResult: Result from deployment agent.
        """
        logger.info("Running Deployment Agent")

        return await self._deployment_agent.execute(
            context=context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "target_environment": target_environment,
            },
        )

    async def _run_monitor_agent(
        self,
        context: AgentContext,
        deployment_plan: DeploymentPlan,
    ) -> AgentResult:
        """Run the monitor agent.

        Args:
            context: Execution context.
            deployment_plan: Deployment plan.

        Returns:
            AgentResult: Result from monitor agent.
        """
        logger.info("Running Monitor Agent")

        return await self._monitor_agent.execute(
            context=context,
            event_metadata={
                "deployment_plan": deployment_plan.to_dict(),
            },
        )

    async def _submit_hitl5(
        self,
        context: AgentContext,
        validation_report: ValidationReport,
        security_report: SecurityReport,
        artifact_paths: list[str],
    ) -> str | None:
        """Submit to HITL-5 gate.

        Args:
            context: Execution context.
            validation_report: Validation report.
            security_report: Security report.
            artifact_paths: Paths to artifacts.

        Returns:
            str | None: HITL request ID or None.
        """
        if not self.hitl_dispatcher:
            return None

        try:
            from src.orchestrator.evidence_bundle import (
                EvidenceBundle as OrchestratorBundle,
                EvidenceItem,
                GateType,
            )

            # Create evidence items
            items = []
            for path in artifact_paths:
                items.append(
                    EvidenceItem(
                        item_type="integration_tests" if "validation" in path else "security_scan",
                        path=path,
                        description=f"Artifact: {path}",
                        content_hash="",  # Would compute hash in production
                    )
                )

            # Create evidence bundle
            bundle = OrchestratorBundle.create(
                task_id=context.task_id,
                gate_type=GateType.HITL_5_VALIDATION,
                git_sha=context.metadata.get("git_sha", ""),
                items=items,
                summary=self._create_hitl5_summary(validation_report, security_report),
            )

            # Submit gate request
            request = await self.hitl_dispatcher.request_gate(
                task_id=context.task_id,
                session_id=context.session_id,
                gate_type=GateType.HITL_5_VALIDATION,
                evidence_bundle=bundle,
                requested_by="validation_deployment_coordinator",
            )

            return request.request_id

        except Exception as e:
            logger.error(f"Failed to submit HITL-5: {e}")
            return None

    async def _submit_hitl6(
        self,
        context: AgentContext,
        release_manifest: ReleaseManifest,
        deployment_plan: DeploymentPlan,
        artifact_paths: list[str],
    ) -> str | None:
        """Submit to HITL-6 gate.

        Args:
            context: Execution context.
            release_manifest: Release manifest.
            deployment_plan: Deployment plan.
            artifact_paths: Paths to artifacts.

        Returns:
            str | None: HITL request ID or None.
        """
        if not self.hitl_dispatcher:
            return None

        try:
            from src.orchestrator.evidence_bundle import (
                EvidenceBundle as OrchestratorBundle,
                EvidenceItem,
                GateType,
            )

            # Create evidence items
            items = []
            for path in artifact_paths:
                items.append(
                    EvidenceItem(
                        item_type="release_notes" if "release" in path else "deployment_plan",
                        path=path,
                        description=f"Artifact: {path}",
                        content_hash="",
                    )
                )

            # Create evidence bundle
            bundle = OrchestratorBundle.create(
                task_id=context.task_id,
                gate_type=GateType.HITL_6_RELEASE,
                git_sha=context.metadata.get("git_sha", ""),
                items=items,
                summary=self._create_hitl6_summary(release_manifest, deployment_plan),
            )

            # Submit gate request
            request = await self.hitl_dispatcher.request_gate(
                task_id=context.task_id,
                session_id=context.session_id,
                gate_type=GateType.HITL_6_RELEASE,
                evidence_bundle=bundle,
                requested_by="validation_deployment_coordinator",
            )

            return request.request_id

        except Exception as e:
            logger.error(f"Failed to submit HITL-6: {e}")
            return None

    def _create_hitl5_summary(
        self,
        validation_report: ValidationReport,
        security_report: SecurityReport,
    ) -> str:
        """Create HITL-5 evidence summary.

        Args:
            validation_report: Validation report.
            security_report: Security report.

        Returns:
            str: Summary text.
        """
        lines = [
            "## Validation & Security Review",
            "",
            f"**Feature:** {validation_report.feature_id}",
            f"**Validation Status:** {'PASSED' if validation_report.passed else 'FAILED'}",
            f"**Security Status:** {'PASSED' if security_report.passed else 'FAILED'}",
            "",
            "### E2E Test Results",
            f"- Passed: {validation_report.e2e_results.passed}",
            f"- Failed: {validation_report.e2e_results.failed}",
            f"- Coverage: {validation_report.e2e_results.coverage:.1f}%",
            "",
            "### Security Findings",
            f"- Total: {len(security_report.findings)}",
            f"- Blocking: {sum(1 for f in security_report.findings if f.is_blocking())}",
        ]

        return "\n".join(lines)

    def _create_hitl6_summary(
        self,
        release_manifest: ReleaseManifest,
        deployment_plan: DeploymentPlan,
    ) -> str:
        """Create HITL-6 evidence summary.

        Args:
            release_manifest: Release manifest.
            deployment_plan: Deployment plan.

        Returns:
            str: Summary text.
        """
        lines = [
            "## Release & Deployment Review",
            "",
            f"**Version:** {release_manifest.version}",
            f"**Features:** {', '.join(release_manifest.features) if release_manifest.features else 'N/A'}",
            f"**Target Environment:** {deployment_plan.target_environment}",
            f"**Strategy:** {deployment_plan.strategy.value}",
            "",
            "### Deployment Steps",
            f"- Total Steps: {len(deployment_plan.steps)}",
            "",
            "### Health Checks",
            f"- Total Checks: {len(deployment_plan.health_checks)}",
            "",
            "### Rollback Triggers",
        ]

        for trigger in deployment_plan.rollback_triggers[:5]:
            lines.append(f"- {trigger}")

        return "\n".join(lines)

    def _extract_validation_report(
        self,
        result: AgentResult,
    ) -> ValidationReport | None:
        """Extract validation report from agent result.

        Args:
            result: Agent result.

        Returns:
            ValidationReport | None: Extracted report or None.
        """
        report_dict = result.metadata.get("validation_report")
        if not report_dict:
            return None

        try:
            return ValidationReport.from_dict(report_dict)
        except Exception as e:
            logger.error(f"Failed to extract validation report: {e}")
            return None

    def _extract_security_report(
        self,
        result: AgentResult,
    ) -> SecurityReport | None:
        """Extract security report from agent result.

        Args:
            result: Agent result.

        Returns:
            SecurityReport | None: Extracted report or None.
        """
        report_dict = result.metadata.get("security_report")
        if not report_dict:
            return None

        try:
            return SecurityReport.from_dict(report_dict)
        except Exception as e:
            logger.error(f"Failed to extract security report: {e}")
            return None

    def _extract_release_manifest(
        self,
        result: AgentResult,
    ) -> ReleaseManifest | None:
        """Extract release manifest from agent result.

        Args:
            result: Agent result.

        Returns:
            ReleaseManifest | None: Extracted manifest or None.
        """
        manifest_dict = result.metadata.get("release_manifest")
        if not manifest_dict:
            return None

        try:
            return ReleaseManifest.from_dict(manifest_dict)
        except Exception as e:
            logger.error(f"Failed to extract release manifest: {e}")
            return None

    def _extract_deployment_plan(
        self,
        result: AgentResult,
    ) -> DeploymentPlan | None:
        """Extract deployment plan from agent result.

        Args:
            result: Agent result.

        Returns:
            DeploymentPlan | None: Extracted plan or None.
        """
        plan_dict = result.metadata.get("deployment_plan")
        if not plan_dict:
            return None

        try:
            return DeploymentPlan.from_dict(plan_dict)
        except Exception as e:
            logger.error(f"Failed to extract deployment plan: {e}")
            return None

    def _extract_monitoring_config(
        self,
        result: AgentResult,
    ) -> MonitoringConfig | None:
        """Extract monitoring config from agent result.

        Args:
            result: Agent result.

        Returns:
            MonitoringConfig | None: Extracted config or None.
        """
        config_dict = result.metadata.get("monitoring_config")
        if not config_dict:
            return None

        try:
            return MonitoringConfig.from_dict(config_dict)
        except Exception as e:
            logger.error(f"Failed to extract monitoring config: {e}")
            return None

    def get_agent_statuses(self) -> dict[str, str]:
        """Get status of all agents.

        Returns:
            dict: Agent type to status mapping.
        """
        return {
            "validation_agent": "ready",
            "security_agent": "ready",
            "release_agent": "ready",
            "deployment_agent": "ready",
            "monitor_agent": "ready",
        }
