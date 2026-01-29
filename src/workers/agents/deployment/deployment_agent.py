"""DeploymentAgent for deployment plan generation and configuration.

Deployment planning agent that generates deployment plans based on release
manifests, configures health checks, defines rollback triggers, and supports
multiple deployment strategies (rolling, blue-green, canary).
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from src.workers.agents.deployment.config import DeploymentConfig, DeploymentStrategy
from src.workers.agents.deployment.models import (
    DeploymentPlan,
    DeploymentStep,
    HealthCheck,
    HealthCheckType,
    ReleaseManifest,
    StepType,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


class DeploymentAgentError(Exception):
    """Raised when DeploymentAgent operations fail."""

    pass


class DeploymentAgent:
    """Agent that generates deployment plans with health checks and rollback triggers.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Takes a release manifest as input and produces a deployment plan with
    strategy-specific steps, health checks, and rollback triggers.

    Supports multiple deployment strategies:
    - rolling: Gradual replacement of instances
    - blue-green: Switch traffic between environments
    - canary: Gradual traffic shift to new version

    Example:
        agent = DeploymentAgent(
            llm_client=client,
            artifact_writer=writer,
            config=DeploymentConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DeploymentConfig,
    ) -> None:
        """Initialize the DeploymentAgent.

        Args:
            llm_client: LLM client for deployment plan generation.
            artifact_writer: Writer for persisting artifacts.
            config: Deployment configuration.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "deployment_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute deployment plan generation.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - release_manifest: Release manifest dict (required)
                - target_environment: Target environment string (optional, default: staging)
                - deployment_strategy: Strategy override (optional)

        Returns:
            AgentResult: Result with deployment plan artifacts and hitl_gate="HITL-6".
        """
        logger.info(f"DeploymentAgent starting for task {context.task_id}")

        try:
            # Validate required inputs
            release_manifest_dict = event_metadata.get("release_manifest")
            if not release_manifest_dict:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No release_manifest provided in event_metadata",
                    should_retry=False,
                )

            # Parse release manifest
            release_manifest = ReleaseManifest.from_dict(release_manifest_dict)

            # Extract optional metadata
            target_environment = event_metadata.get("target_environment", "staging")
            strategy_override = event_metadata.get("deployment_strategy")

            # Determine deployment strategy
            if strategy_override:
                try:
                    strategy = DeploymentStrategy(strategy_override)
                except ValueError:
                    strategy = self._config.deployment_strategy
            else:
                strategy = self._config.deployment_strategy

            # Generate deployment plan using LLM
            deployment_plan = await self._generate_deployment_plan(
                release_manifest=release_manifest,
                target_environment=target_environment,
                strategy=strategy,
            )

            if not deployment_plan:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate deployment plan",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, deployment_plan)

            logger.info(
                f"DeploymentAgent completed for task {context.task_id}, "
                f"strategy: {deployment_plan.strategy.value}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata={
                    "deployment_plan": deployment_plan.to_dict(),
                    "hitl_gate": "HITL-6",
                },
            )

        except Exception as e:
            logger.error(f"DeploymentAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _generate_deployment_plan(
        self,
        release_manifest: ReleaseManifest,
        target_environment: str,
        strategy: DeploymentStrategy,
    ) -> DeploymentPlan | None:
        """Generate deployment plan using LLM.

        Args:
            release_manifest: Release manifest from release agent.
            target_environment: Target environment (staging, production, etc.).
            strategy: Deployment strategy to use.

        Returns:
            DeploymentPlan | None: Generated plan or None if failed.
        """
        # Build prompt for deployment plan generation
        prompt = self._format_deployment_prompt(
            release_manifest=release_manifest,
            target_environment=target_environment,
            strategy=strategy,
        )

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse response
            plan_data = self._parse_json_from_response(response.content)

            if not plan_data:
                logger.warning("Invalid deployment plan response - no valid JSON")
                return None

            # Build deployment steps
            steps = []
            for step_data in plan_data.get("steps", []):
                try:
                    step = DeploymentStep(
                        order=step_data.get("order", 0),
                        name=step_data.get("name", ""),
                        step_type=StepType(step_data.get("step_type", "deploy")),
                        command=step_data.get("command", ""),
                        timeout_seconds=step_data.get("timeout_seconds", 300),
                        rollback_command=step_data.get("rollback_command"),
                    )
                    steps.append(step)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid deployment step: {e}")
                    continue

            # Build health checks
            health_checks = []
            for check_data in plan_data.get("health_checks", []):
                try:
                    check = HealthCheck(
                        name=check_data.get("name", ""),
                        check_type=HealthCheckType(check_data.get("check_type", "http")),
                        target=check_data.get("target", ""),
                        interval_seconds=check_data.get("interval_seconds", self._config.health_check_interval),
                        timeout_seconds=check_data.get("timeout_seconds", 5),
                        success_threshold=check_data.get("success_threshold", 1),
                        failure_threshold=check_data.get("failure_threshold", 3),
                    )
                    health_checks.append(check)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid health check: {e}")
                    continue

            # Build rollback triggers
            rollback_triggers = plan_data.get("rollback_triggers", [])

            return DeploymentPlan(
                release_version=plan_data.get("release_version", release_manifest.version),
                target_environment=plan_data.get("target_environment", target_environment),
                strategy=DeploymentStrategy(plan_data.get("strategy", strategy.value)),
                steps=steps,
                rollback_triggers=rollback_triggers,
                health_checks=health_checks,
            )

        except Exception as e:
            logger.error(f"Deployment plan generation failed: {e}")
            raise

    def _format_deployment_prompt(
        self,
        release_manifest: ReleaseManifest,
        target_environment: str,
        strategy: DeploymentStrategy,
    ) -> str:
        """Format prompt for deployment plan generation.

        Args:
            release_manifest: Release manifest.
            target_environment: Target environment.
            strategy: Deployment strategy.

        Returns:
            str: Formatted prompt.
        """
        # Format release summary
        release_summary = f"""
Release Version: {release_manifest.version}
Features: {', '.join(release_manifest.features) if release_manifest.features else 'None'}
Artifacts: {len(release_manifest.artifacts)} artifacts
"""

        # Format artifact details
        if release_manifest.artifacts:
            release_summary += "\nArtifact Details:\n"
            for artifact in release_manifest.artifacts:
                release_summary += f"- {artifact.name} ({artifact.artifact_type.value}): {artifact.location}\n"

        # Strategy-specific instructions
        strategy_instructions = self._get_strategy_instructions(strategy)

        # Health check interval from config
        health_check_instruction = f"""
Configure health checks with:
- Default interval: {self._config.health_check_interval} seconds
- Include HTTP health check for /health endpoint
- Include readiness and liveness probes as appropriate
"""

        # Rollback instruction based on config
        if self._config.rollback_enabled:
            rollback_instruction = """
Define rollback triggers for automatic rollback:
- Error rate thresholds
- Latency thresholds (P99)
- Health check failure counts
- Memory/CPU utilization thresholds

Include rollback commands for each deployment step where applicable.
"""
        else:
            rollback_instruction = """
Note: Rollback is disabled in configuration.
Include minimal rollback triggers for manual intervention only.
Do not include rollback commands in steps.
"""

        # Canary percentage if applicable
        canary_instruction = ""
        if strategy == DeploymentStrategy.CANARY:
            canary_instruction = f"""
Canary deployment configuration:
- Initial canary percentage: {self._config.canary_percentage}%
- Include monitoring step before promoting to full deployment
"""

        prompt = f"""Generate a deployment plan for the following release.

## Release Information
{release_summary}

## Target Environment
{target_environment}

## Deployment Strategy
{strategy.value}

{strategy_instructions}

## Health Checks
{health_check_instruction}

## Rollback Configuration
{rollback_instruction}
{canary_instruction}

## Output Format

Respond with a JSON object containing:
```json
{{
    "release_version": "version string from release manifest",
    "target_environment": "target environment name",
    "strategy": "{strategy.value}",
    "steps": [
        {{
            "order": 1,
            "name": "step name",
            "step_type": "prepare|deploy|verify|promote|cleanup",
            "command": "command to execute",
            "timeout_seconds": 300,
            "rollback_command": "command to rollback (or null)"
        }}
    ],
    "rollback_triggers": [
        "condition that triggers automatic rollback"
    ],
    "health_checks": [
        {{
            "name": "check name",
            "check_type": "http|tcp|command|grpc",
            "target": "endpoint or target",
            "interval_seconds": {self._config.health_check_interval},
            "timeout_seconds": 5,
            "success_threshold": 1,
            "failure_threshold": 3
        }}
    ]
}}
```

Generate appropriate steps for the {strategy.value} deployment strategy with proper ordering.
Include health checks and rollback triggers suitable for {target_environment} environment.
"""

        return prompt

    def _get_strategy_instructions(self, strategy: DeploymentStrategy) -> str:
        """Get strategy-specific deployment instructions.

        Args:
            strategy: Deployment strategy.

        Returns:
            str: Strategy-specific instructions.
        """
        if strategy == DeploymentStrategy.ROLLING:
            return """
Rolling Update Strategy:
- Gradually replace instances one by one
- Maintain availability during deployment
- Steps should include: prepare, deploy, verify
- Use kubectl set image or helm upgrade for deployment
- Verify rollout status before completion
"""
        elif strategy == DeploymentStrategy.BLUE_GREEN:
            return """
Blue-Green Deployment Strategy:
- Deploy to inactive environment (green)
- Verify green environment is healthy
- Switch traffic from blue to green
- Keep blue environment for quick rollback
- Steps should include: prepare, deploy green, verify green, switch traffic, cleanup blue (optional)
"""
        elif strategy == DeploymentStrategy.CANARY:
            return """
Canary Deployment Strategy:
- Deploy new version to small percentage of traffic
- Monitor canary metrics against baseline
- Gradually increase traffic if metrics are acceptable
- Steps should include: deploy canary, monitor, promote (or rollback)
- Include comparison of canary vs baseline in rollback triggers
"""
        else:
            return "Use default rolling update strategy."

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

    async def _write_artifacts(
        self,
        context: AgentContext,
        deployment_plan: DeploymentPlan,
    ) -> list[str]:
        """Write deployment plan artifacts.

        Args:
            context: Agent context.
            deployment_plan: Generated deployment plan.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType as WriterArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = deployment_plan.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=WriterArtifactType.REPORT,
            filename=f"{context.task_id}_deployment_plan.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = deployment_plan.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=WriterArtifactType.REPORT,
            filename=f"{context.task_id}_deployment_plan.md",
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
