"""ReleaseAgent for release manifest generation and rollback planning.

Release management agent that generates release manifests from validation
and security reports, creates changelogs from commit messages, and documents
rollback plans.

Delegates work to a pluggable AgentBackend (Claude Code CLI,
Codex CLI, or direct LLM API calls).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.deployment.config import DeploymentConfig
from src.workers.agents.deployment.models import (
    ArtifactReference,
    ArtifactType,
    ReleaseManifest,
)
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.models import SecurityReport, ValidationReport

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
RELEASE_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "version": {"type": "string"},
        "features": {"type": "array", "items": {"type": "string"}},
        "changelog": {"type": "string"},
        "artifacts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "artifact_type": {"type": "string"},
                    "location": {"type": "string"},
                    "checksum": {"type": ["string", "null"]},
                },
                "required": ["name", "artifact_type", "location"],
            },
        },
        "rollback_plan": {"type": "string"},
    },
    "required": ["version", "features", "changelog", "artifacts", "rollback_plan"],
}

# System prompt for the release backend
RELEASE_SYSTEM_PROMPT = (
    "You are a release management agent. Generate release manifests with "
    "changelogs, artifact references, and rollback plans. "
    "Always respond with valid JSON matching the requested schema."
)


class ReleaseAgentError(Exception):
    """Raised when ReleaseAgent operations fail."""

    pass


class ReleaseAgent:
    """Agent that generates release manifests and rollback plans.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Takes validation and security reports as input and produces a release
    manifest with changelog and rollback documentation.

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = ReleaseAgent(
            backend=backend,
            artifact_writer=writer,
            config=DeploymentConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        config: DeploymentConfig,
    ) -> None:
        """Initialize the ReleaseAgent.

        Args:
            backend: Agent backend for release manifest generation.
            artifact_writer: Writer for persisting artifacts.
            config: Deployment configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "release_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute release manifest generation.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - validation_report: Validation report dict (required)
                - security_report: Security report dict (required)
                - commits: List of commit message dicts (optional)
                - version: Release version string (optional, auto-generated if missing)

        Returns:
            AgentResult: Result with release manifest artifacts on success.
        """
        logger.info(
            f"ReleaseAgent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Validate required inputs
            validation_report_dict = event_metadata.get("validation_report")
            if not validation_report_dict:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No validation_report provided in event_metadata",
                    should_retry=False,
                )

            security_report_dict = event_metadata.get("security_report")
            if not security_report_dict:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No security_report provided in event_metadata",
                    should_retry=False,
                )

            # Parse reports
            validation_report = ValidationReport.from_dict(validation_report_dict)
            security_report = SecurityReport.from_dict(security_report_dict)

            # Extract optional metadata
            commits = event_metadata.get("commits", [])
            version = event_metadata.get("version")

            # Generate release manifest using backend
            release_manifest = await self._generate_release_manifest(
                validation_report=validation_report,
                security_report=security_report,
                commits=commits,
                version=version,
            )

            if not release_manifest:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate release manifest",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, release_manifest)

            logger.info(
                f"ReleaseAgent completed for task {context.task_id}, "
                f"version: {release_manifest.version}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata={
                    "release_manifest": release_manifest.to_dict(),
                    "next_agent": "deployment_agent",
                    "backend": self._backend.backend_name,
                },
            )

        except Exception as e:
            logger.error(f"ReleaseAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _generate_release_manifest(
        self,
        validation_report: ValidationReport,
        security_report: SecurityReport,
        commits: list[dict[str, Any]],
        version: str | None,
    ) -> ReleaseManifest | None:
        """Generate release manifest using backend.

        Args:
            validation_report: Validation report from validation agent.
            security_report: Security report from security agent.
            commits: List of commit message dictionaries.
            version: Optional version string.

        Returns:
            ReleaseManifest | None: Generated manifest or None if failed.
        """
        # Build prompt for release manifest generation
        prompt = self._format_release_prompt(
            validation_report=validation_report,
            security_report=security_report,
            commits=commits,
            version=version,
        )

        try:
            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.deployment_model,
                output_schema=RELEASE_OUTPUT_SCHEMA,
                system_prompt=RELEASE_SYSTEM_PROMPT,
                timeout_seconds=300,
            )

            # Execute via backend
            result = await self._backend.execute(
                prompt=prompt,
                workspace_path="",
                config=backend_config,
            )

            if not result.success:
                logger.warning(
                    "Release manifest generation failed: %s", result.error
                )
                return None

            # Parse response - try structured output first, then text
            manifest_data = None
            if result.structured_output:
                manifest_data = result.structured_output
            else:
                manifest_data = parse_json_from_response(result.output)

            if not manifest_data:
                logger.warning("Invalid release manifest response - no valid JSON")
                return None

            # Build artifact references
            artifacts = []
            for artifact_data in manifest_data.get("artifacts", []):
                try:
                    artifact = ArtifactReference(
                        name=artifact_data.get("name", ""),
                        artifact_type=ArtifactType(
                            artifact_data.get("artifact_type", "docker_image")
                        ),
                        location=artifact_data.get("location", ""),
                        checksum=artifact_data.get("checksum"),
                    )
                    artifacts.append(artifact)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid artifact reference: {e}")
                    continue

            return ReleaseManifest(
                version=manifest_data.get("version", version or "0.1.0"),
                features=manifest_data.get("features", []),
                changelog=manifest_data.get("changelog", ""),
                artifacts=artifacts,
                rollback_plan=manifest_data.get("rollback_plan", ""),
            )

        except Exception as e:
            logger.error(f"Release manifest generation failed: {e}")
            raise

    def _format_release_prompt(
        self,
        validation_report: ValidationReport,
        security_report: SecurityReport,
        commits: list[dict[str, Any]],
        version: str | None,
    ) -> str:
        """Format prompt for release manifest generation.

        Args:
            validation_report: Validation report.
            security_report: Security report.
            commits: List of commit messages.
            version: Optional version string.

        Returns:
            str: Formatted prompt.
        """
        # Format validation summary
        validation_summary = f"""
Validation Status: {"PASSED" if validation_report.passed else "FAILED"}
Feature: {validation_report.feature_id}
E2E Tests: {validation_report.e2e_results.passed} passed, {validation_report.e2e_results.failed} failed
Coverage: {validation_report.e2e_results.coverage}%
"""

        # Format security summary
        security_summary = f"""
Security Status: {"PASSED" if security_report.passed else "FAILED"}
Findings: {len(security_report.findings)} total
Scan Coverage: {security_report.scan_coverage}%
"""
        if security_report.findings:
            for finding in security_report.findings[:5]:  # Limit to first 5
                security_summary += f"- {finding.severity.value.upper()}: {finding.description}\n"

        # Format commits
        commits_text = ""
        if commits:
            commits_text = "Recent Commits:\n"
            for commit in commits[:20]:  # Limit to 20 commits
                message = commit.get("message", "")
                sha = commit.get("sha", "")[:7] if commit.get("sha") else ""
                commits_text += f"- [{sha}] {message}\n"
        else:
            commits_text = "No commit information provided."

        # Version instruction
        version_instruction = (
            f"Use version: {version}" if version else "Generate an appropriate semantic version (e.g., 0.1.0)"
        )

        # Rollback instruction based on config
        rollback_instruction = ""
        if self._config.rollback_enabled:
            rollback_instruction = """
Include a comprehensive rollback plan with:
1. Steps to identify affected services
2. Commands to rollback (e.g., kubectl rollout undo)
3. Database migration considerations (if applicable)
4. Health verification steps
5. Stakeholder notification process
"""
        else:
            rollback_instruction = "Note: Rollback is disabled in configuration. Include minimal rollback information."

        prompt = f"""Generate a release manifest based on the following validation and security reports.

## Validation Report
{validation_summary}

## Security Report
{security_summary}

## Commits
{commits_text}

## Instructions
{version_instruction}

Create a changelog from the commits, categorizing them into:
- Features (feat)
- Bug Fixes (fix)
- Documentation (docs)
- Tests (test)
- Other

{rollback_instruction}

## Output Format

Respond with a JSON object containing:
```json
{{
    "version": "semantic version string",
    "features": ["list of feature IDs included"],
    "changelog": "markdown formatted changelog",
    "artifacts": [
        {{
            "name": "artifact name",
            "artifact_type": "docker_image|helm_chart|binary|config|documentation",
            "location": "URI or path to artifact",
            "checksum": "sha256 checksum or null"
        }}
    ],
    "rollback_plan": "detailed rollback procedure in markdown"
}}
```

Include appropriate artifacts for a typical deployment (Docker images, Helm charts).
"""

        return prompt

    async def _write_artifacts(
        self,
        context: AgentContext,
        release_manifest: ReleaseManifest,
    ) -> list[str]:
        """Write release manifest artifacts.

        Args:
            context: Agent context.
            release_manifest: Generated release manifest.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType as WriterArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = release_manifest.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=WriterArtifactType.REPORT,
            filename=f"{context.task_id}_release_manifest.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = release_manifest.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=WriterArtifactType.REPORT,
            filename=f"{context.task_id}_release_manifest.md",
        )
        paths.append(markdown_path)

        return paths

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
