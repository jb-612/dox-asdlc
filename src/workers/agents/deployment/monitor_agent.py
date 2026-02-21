"""MonitorAgent for monitoring configuration generation.

Monitoring configuration agent that defines metrics to collect, configures
alerts, generates dashboard configurations, and outputs MonitoringConfig
artifacts for deployments.

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
    AlertRule,
    AlertSeverity,
    DashboardConfig,
    DeploymentPlan,
    MetricDefinition,
    MetricType,
    MonitoringConfig,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
MONITOR_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "deployment_id": {"type": "string"},
        "metrics": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "metric_type": {"type": "string"},
                    "description": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "metric_type", "description"],
            },
        },
        "alerts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "condition": {"type": "string"},
                    "severity": {"type": "string"},
                    "description": {"type": "string"},
                    "runbook_url": {"type": ["string", "null"]},
                },
                "required": ["name", "condition", "severity", "description"],
            },
        },
        "dashboards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "title": {"type": "string"},
                    "panels": {"type": "array", "items": {"type": "string"}},
                    "refresh_interval_seconds": {"type": "integer"},
                },
                "required": ["name", "title", "panels"],
            },
        },
    },
    "required": ["deployment_id", "metrics", "alerts", "dashboards"],
}

# System prompt for the monitoring backend
MONITOR_SYSTEM_PROMPT = (
    "You are a monitoring configuration agent. Generate monitoring "
    "configurations with metrics, alerts, and dashboards for deployments. "
    "Always respond with valid JSON matching the requested schema."
)


class MonitorAgentError(Exception):
    """Raised when MonitorAgent operations fail."""

    pass


class MonitorAgent:
    """Agent that generates monitoring configurations for deployments.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Takes a deployment plan as input and produces a monitoring configuration
    with metrics, alerts, and dashboard configurations.

    Key responsibilities:
    - Define metrics to collect (cpu, memory, request rate, latency, errors)
    - Configure alert rules (error rate, latency thresholds)
    - Generate dashboard configuration

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = MonitorAgent(
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
        """Initialize the MonitorAgent.

        Args:
            backend: Agent backend for monitoring config generation.
            artifact_writer: Writer for persisting artifacts.
            config: Deployment configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "monitor_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute monitoring configuration generation.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - deployment_plan: Deployment plan dict (required)

        Returns:
            AgentResult: Result with monitoring config artifacts.
        """
        logger.info(
            f"MonitorAgent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Validate required inputs
            deployment_plan_dict = event_metadata.get("deployment_plan")
            if not deployment_plan_dict:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No deployment_plan provided in event_metadata",
                    should_retry=False,
                )

            # Parse deployment plan
            deployment_plan = DeploymentPlan.from_dict(deployment_plan_dict)

            # Generate monitoring configuration using backend
            monitoring_config = await self._generate_monitoring_config(
                deployment_plan=deployment_plan,
                task_id=context.task_id,
            )

            if not monitoring_config:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate monitoring configuration",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, monitoring_config)

            logger.info(
                f"MonitorAgent completed for task {context.task_id}, "
                f"metrics: {len(monitoring_config.metrics)}, "
                f"alerts: {len(monitoring_config.alerts)}, "
                f"dashboards: {len(monitoring_config.dashboards)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata={
                    "monitoring_config": monitoring_config.to_dict(),
                    "backend": self._backend.backend_name,
                },
            )

        except Exception as e:
            logger.error(f"MonitorAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _generate_monitoring_config(
        self,
        deployment_plan: DeploymentPlan,
        task_id: str,
    ) -> MonitoringConfig | None:
        """Generate monitoring configuration using backend.

        Args:
            deployment_plan: Deployment plan to create monitoring for.
            task_id: Task ID to use as deployment ID.

        Returns:
            MonitoringConfig | None: Generated config or None if failed.
        """
        # Build prompt for monitoring config generation
        prompt = self._format_monitoring_prompt(
            deployment_plan=deployment_plan,
            task_id=task_id,
        )

        try:
            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.deployment_model,
                output_schema=MONITOR_OUTPUT_SCHEMA,
                system_prompt=MONITOR_SYSTEM_PROMPT,
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
                    "Monitoring config generation failed: %s", result.error
                )
                return None

            # Parse response - try structured output first, then text
            config_data = None
            if result.structured_output:
                config_data = result.structured_output
            else:
                config_data = parse_json_from_response(result.output)

            if not config_data:
                logger.warning("Invalid monitoring config response - no valid JSON")
                return None

            # Build metrics
            metrics = []
            for metric_data in config_data.get("metrics", []):
                try:
                    metric = MetricDefinition(
                        name=metric_data.get("name", ""),
                        metric_type=MetricType(metric_data.get("metric_type", "counter")),
                        description=metric_data.get("description", ""),
                        labels=metric_data.get("labels", []),
                    )
                    metrics.append(metric)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid metric definition: {e}")
                    continue

            # Build alerts
            alerts = []
            for alert_data in config_data.get("alerts", []):
                try:
                    alert = AlertRule(
                        name=alert_data.get("name", ""),
                        condition=alert_data.get("condition", ""),
                        severity=AlertSeverity(alert_data.get("severity", "warning")),
                        description=alert_data.get("description", ""),
                        runbook_url=alert_data.get("runbook_url"),
                    )
                    alerts.append(alert)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid alert rule: {e}")
                    continue

            # Build dashboards
            dashboards = []
            for dashboard_data in config_data.get("dashboards", []):
                try:
                    dashboard = DashboardConfig(
                        name=dashboard_data.get("name", ""),
                        title=dashboard_data.get("title", ""),
                        panels=dashboard_data.get("panels", []),
                        refresh_interval_seconds=dashboard_data.get("refresh_interval_seconds", 30),
                    )
                    dashboards.append(dashboard)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid dashboard config: {e}")
                    continue

            return MonitoringConfig(
                deployment_id=config_data.get("deployment_id", task_id),
                metrics=metrics,
                alerts=alerts,
                dashboards=dashboards,
            )

        except Exception as e:
            logger.error(f"Monitoring config generation failed: {e}")
            raise

    def _format_monitoring_prompt(
        self,
        deployment_plan: DeploymentPlan,
        task_id: str,
    ) -> str:
        """Format prompt for monitoring configuration generation.

        Args:
            deployment_plan: Deployment plan.
            task_id: Task ID for deployment identification.

        Returns:
            str: Formatted prompt.
        """
        # Format deployment summary
        deployment_summary = f"""
Release Version: {deployment_plan.release_version}
Target Environment: {deployment_plan.target_environment}
Deployment Strategy: {deployment_plan.strategy.value}
"""

        # Format health checks info
        health_checks_info = ""
        if deployment_plan.health_checks:
            health_checks_info = "\n## Existing Health Checks\n"
            for check in deployment_plan.health_checks:
                health_checks_info += f"- {check.name} ({check.check_type.value}): {check.target}\n"

        # Format rollback triggers info
        rollback_info = ""
        if deployment_plan.rollback_triggers:
            rollback_info = "\n## Rollback Triggers\n"
            for trigger in deployment_plan.rollback_triggers:
                rollback_info += f"- {trigger}\n"

        prompt = f"""Generate a monitoring configuration for the following deployment.

## Deployment Information
{deployment_summary}
{health_checks_info}
{rollback_info}

## Requirements

### Metrics
Define Prometheus-style metrics covering:
1. **CPU Usage**: Process CPU time metrics
2. **Memory Usage**: Resident memory metrics
3. **Request Rate**: HTTP request counters with method, path, status labels
4. **Latency**: Request duration histograms for percentile tracking
5. **Errors**: Track via status label on request metrics (5xx responses)

### Alerts
Define alert rules for:
1. **High Error Rate**: Alert when error rate exceeds 5% (critical severity)
2. **High Latency**: Alert when P99 latency exceeds 500ms (warning severity)

Include PromQL conditions and descriptions for each alert.

### Dashboards
Generate at least one dashboard configuration with panels for:
- Request rate
- Error rate
- Latency percentiles
- CPU usage
- Memory usage

## Output Format

Respond with a JSON object:
```json
{{
    "deployment_id": "{task_id}",
    "metrics": [
        {{
            "name": "metric_name",
            "metric_type": "counter|gauge|histogram|summary",
            "description": "Metric description",
            "labels": ["label1", "label2"]
        }}
    ],
    "alerts": [
        {{
            "name": "AlertName",
            "condition": "PromQL condition",
            "severity": "critical|warning|info",
            "description": "Alert description",
            "runbook_url": "optional URL or null"
        }}
    ],
    "dashboards": [
        {{
            "name": "dashboard-name",
            "title": "Dashboard Title",
            "panels": ["panel_id1", "panel_id2"],
            "refresh_interval_seconds": 30
        }}
    ]
}}
```

Generate appropriate metrics, alerts, and dashboards for monitoring a {deployment_plan.target_environment} deployment.
"""

        return prompt

    async def _write_artifacts(
        self,
        context: AgentContext,
        monitoring_config: MonitoringConfig,
    ) -> list[str]:
        """Write monitoring configuration artifacts.

        Args:
            context: Agent context.
            monitoring_config: Generated monitoring configuration.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType as WriterArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = monitoring_config.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=WriterArtifactType.REPORT,
            filename=f"{context.task_id}_monitoring_config.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = monitoring_config.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=WriterArtifactType.REPORT,
            filename=f"{context.task_id}_monitoring_config.md",
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
