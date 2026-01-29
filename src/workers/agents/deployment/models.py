"""Domain models for Deployment agents.

Defines data structures for release manifests, deployment plans,
health checks, and monitoring configurations produced by the
Release, Deployment, and Monitor agents.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from typing import Any

# Import DeploymentStrategy from config for composition
from src.workers.agents.deployment.config import DeploymentStrategy


class ArtifactType(str, Enum):
    """Types of artifacts that can be part of a release."""

    DOCKER_IMAGE = "docker_image"
    HELM_CHART = "helm_chart"
    BINARY = "binary"
    CONFIG = "config"
    DOCUMENTATION = "documentation"


@dataclass
class ArtifactReference:
    """Reference to a deployable artifact.

    Attributes:
        name: Name of the artifact.
        artifact_type: Type of artifact (docker_image, helm_chart, etc.).
        location: URI or path to the artifact.
        checksum: Optional checksum for integrity verification.
    """

    name: str
    artifact_type: ArtifactType
    location: str
    checksum: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize artifact reference to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "name": self.name,
            "artifact_type": self.artifact_type.value,
            "location": self.location,
            "checksum": self.checksum,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ArtifactReference:
        """Create artifact reference from dictionary.

        Args:
            data: Dictionary with artifact data.

        Returns:
            ArtifactReference: New instance.
        """
        return cls(
            name=data.get("name", ""),
            artifact_type=ArtifactType(data.get("artifact_type", "docker_image")),
            location=data.get("location", ""),
            checksum=data.get("checksum"),
        )


@dataclass
class ReleaseManifest:
    """Release manifest containing version information and artifacts.

    Attributes:
        version: Semantic version of the release.
        features: List of feature IDs included in this release.
        changelog: Human-readable changelog entries.
        artifacts: List of artifact references for this release.
        rollback_plan: Description of how to rollback this release.
    """

    version: str
    features: list[str]
    changelog: str
    artifacts: list[ArtifactReference]
    rollback_plan: str

    def to_dict(self) -> dict[str, Any]:
        """Serialize release manifest to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "version": self.version,
            "features": self.features,
            "changelog": self.changelog,
            "artifacts": [artifact.to_dict() for artifact in self.artifacts],
            "rollback_plan": self.rollback_plan,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ReleaseManifest:
        """Create release manifest from dictionary.

        Args:
            data: Dictionary with manifest data.

        Returns:
            ReleaseManifest: New instance.
        """
        return cls(
            version=data.get("version", ""),
            features=data.get("features", []),
            changelog=data.get("changelog", ""),
            artifacts=[
                ArtifactReference.from_dict(a) for a in data.get("artifacts", [])
            ],
            rollback_plan=data.get("rollback_plan", ""),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string.

        Args:
            indent: JSON indentation level.

        Returns:
            str: JSON string representation.
        """
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> ReleaseManifest:
        """Create from JSON string.

        Args:
            json_str: JSON string.

        Returns:
            ReleaseManifest: New instance.
        """
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format release manifest as markdown.

        Returns:
            str: Markdown formatted manifest.
        """
        lines = [
            "# Release Manifest",
            "",
            f"**Version:** {self.version}",
            "",
        ]

        if self.features:
            lines.extend(["## Features", ""])
            for feature in self.features:
                lines.append(f"- {feature}")
            lines.append("")

        lines.extend(["## Changelog", "", self.changelog, ""])

        if self.artifacts:
            lines.extend(["## Artifacts", ""])
            for artifact in self.artifacts:
                lines.extend([
                    f"### {artifact.name}",
                    "",
                    f"**Type:** {artifact.artifact_type.value}",
                    f"**Location:** {artifact.location}",
                ])
                if artifact.checksum:
                    lines.append(f"**Checksum:** {artifact.checksum}")
                lines.append("")

        lines.extend(["## Rollback Plan", "", self.rollback_plan, ""])

        return "\n".join(lines)


class StepType(str, Enum):
    """Types of deployment steps."""

    PREPARE = "prepare"
    DEPLOY = "deploy"
    VERIFY = "verify"
    PROMOTE = "promote"
    CLEANUP = "cleanup"


@dataclass
class DeploymentStep:
    """Individual step in a deployment plan.

    Attributes:
        order: Order in which this step executes.
        name: Human-readable name of the step.
        step_type: Type of step (prepare, deploy, verify, etc.).
        command: Command or action to execute.
        timeout_seconds: Maximum time for this step to complete.
        rollback_command: Optional command to rollback this step.
    """

    order: int
    name: str
    step_type: StepType
    command: str
    timeout_seconds: int
    rollback_command: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize deployment step to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "order": self.order,
            "name": self.name,
            "step_type": self.step_type.value,
            "command": self.command,
            "timeout_seconds": self.timeout_seconds,
            "rollback_command": self.rollback_command,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeploymentStep:
        """Create deployment step from dictionary.

        Args:
            data: Dictionary with step data.

        Returns:
            DeploymentStep: New instance.
        """
        return cls(
            order=data.get("order", 0),
            name=data.get("name", ""),
            step_type=StepType(data.get("step_type", "deploy")),
            command=data.get("command", ""),
            timeout_seconds=data.get("timeout_seconds", 300),
            rollback_command=data.get("rollback_command"),
        )


class HealthCheckType(str, Enum):
    """Types of health checks."""

    HTTP = "http"
    TCP = "tcp"
    COMMAND = "command"
    GRPC = "grpc"


@dataclass
class HealthCheck:
    """Health check configuration for deployed services.

    Attributes:
        name: Human-readable name of the health check.
        check_type: Type of health check (http, tcp, command, grpc).
        target: Target to check (endpoint path, port, command, etc.).
        interval_seconds: Interval between checks.
        timeout_seconds: Timeout for each check.
        success_threshold: Number of successes before marking healthy.
        failure_threshold: Number of failures before marking unhealthy.
    """

    name: str
    check_type: HealthCheckType
    target: str
    interval_seconds: int
    timeout_seconds: int
    success_threshold: int
    failure_threshold: int

    def to_dict(self) -> dict[str, Any]:
        """Serialize health check to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "name": self.name,
            "check_type": self.check_type.value,
            "target": self.target,
            "interval_seconds": self.interval_seconds,
            "timeout_seconds": self.timeout_seconds,
            "success_threshold": self.success_threshold,
            "failure_threshold": self.failure_threshold,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HealthCheck:
        """Create health check from dictionary.

        Args:
            data: Dictionary with health check data.

        Returns:
            HealthCheck: New instance.
        """
        return cls(
            name=data.get("name", ""),
            check_type=HealthCheckType(data.get("check_type", "http")),
            target=data.get("target", ""),
            interval_seconds=data.get("interval_seconds", 30),
            timeout_seconds=data.get("timeout_seconds", 5),
            success_threshold=data.get("success_threshold", 1),
            failure_threshold=data.get("failure_threshold", 3),
        )


@dataclass
class DeploymentPlan:
    """Complete deployment plan for a release.

    Attributes:
        release_version: Version being deployed.
        target_environment: Environment to deploy to (staging, production).
        strategy: Deployment strategy (rolling, blue-green, canary).
        steps: Ordered list of deployment steps.
        rollback_triggers: Conditions that trigger automatic rollback.
        health_checks: Health checks to verify deployment success.
    """

    release_version: str
    target_environment: str
    strategy: DeploymentStrategy
    steps: list[DeploymentStep]
    rollback_triggers: list[str]
    health_checks: list[HealthCheck]

    def to_dict(self) -> dict[str, Any]:
        """Serialize deployment plan to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "release_version": self.release_version,
            "target_environment": self.target_environment,
            "strategy": self.strategy.value,
            "steps": [step.to_dict() for step in self.steps],
            "rollback_triggers": self.rollback_triggers,
            "health_checks": [check.to_dict() for check in self.health_checks],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DeploymentPlan:
        """Create deployment plan from dictionary.

        Args:
            data: Dictionary with plan data.

        Returns:
            DeploymentPlan: New instance.
        """
        return cls(
            release_version=data.get("release_version", ""),
            target_environment=data.get("target_environment", ""),
            strategy=DeploymentStrategy(data.get("strategy", "rolling")),
            steps=[DeploymentStep.from_dict(s) for s in data.get("steps", [])],
            rollback_triggers=data.get("rollback_triggers", []),
            health_checks=[
                HealthCheck.from_dict(h) for h in data.get("health_checks", [])
            ],
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string.

        Args:
            indent: JSON indentation level.

        Returns:
            str: JSON string representation.
        """
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> DeploymentPlan:
        """Create from JSON string.

        Args:
            json_str: JSON string.

        Returns:
            DeploymentPlan: New instance.
        """
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format deployment plan as markdown.

        Returns:
            str: Markdown formatted plan.
        """
        lines = [
            "# Deployment Plan",
            "",
            f"**Release Version:** {self.release_version}",
            f"**Target Environment:** {self.target_environment}",
            f"**Strategy:** {self.strategy.value}",
            "",
        ]

        if self.steps:
            lines.extend(["## Steps", ""])
            for step in sorted(self.steps, key=lambda s: s.order):
                lines.extend([
                    f"### Step {step.order}: {step.name}",
                    "",
                    f"**Type:** {step.step_type.value}",
                    f"**Command:** `{step.command}`",
                    f"**Timeout:** {step.timeout_seconds}s",
                ])
                if step.rollback_command:
                    lines.append(f"**Rollback:** `{step.rollback_command}`")
                lines.append("")

        if self.health_checks:
            lines.extend(["## Health Checks", ""])
            for check in self.health_checks:
                lines.extend([
                    f"### {check.name}",
                    "",
                    f"**Type:** {check.check_type.value}",
                    f"**Target:** {check.target}",
                    f"**Interval:** {check.interval_seconds}s",
                    f"**Success Threshold:** {check.success_threshold}",
                    f"**Failure Threshold:** {check.failure_threshold}",
                    "",
                ])

        if self.rollback_triggers:
            lines.extend(["## Rollback Triggers", ""])
            for trigger in self.rollback_triggers:
                lines.append(f"- {trigger}")
            lines.append("")

        return "\n".join(lines)


class MetricType(str, Enum):
    """Types of metrics for monitoring."""

    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class MetricDefinition:
    """Definition of a metric to collect.

    Attributes:
        name: Metric name (Prometheus-style).
        metric_type: Type of metric (counter, gauge, histogram, summary).
        description: Human-readable description.
        labels: List of label names for this metric.
    """

    name: str
    metric_type: MetricType
    description: str
    labels: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Serialize metric definition to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "name": self.name,
            "metric_type": self.metric_type.value,
            "description": self.description,
            "labels": self.labels,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MetricDefinition:
        """Create metric definition from dictionary.

        Args:
            data: Dictionary with metric data.

        Returns:
            MetricDefinition: New instance.
        """
        return cls(
            name=data.get("name", ""),
            metric_type=MetricType(data.get("metric_type", "counter")),
            description=data.get("description", ""),
            labels=data.get("labels", []),
        )


class AlertSeverity(str, Enum):
    """Severity levels for alerts."""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


@dataclass
class AlertRule:
    """Alert rule for monitoring.

    Attributes:
        name: Name of the alert rule.
        condition: PromQL or condition expression.
        severity: Severity level of the alert.
        description: Human-readable description.
        runbook_url: Optional URL to runbook for this alert.
    """

    name: str
    condition: str
    severity: AlertSeverity
    description: str
    runbook_url: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize alert rule to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "name": self.name,
            "condition": self.condition,
            "severity": self.severity.value,
            "description": self.description,
            "runbook_url": self.runbook_url,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AlertRule:
        """Create alert rule from dictionary.

        Args:
            data: Dictionary with alert data.

        Returns:
            AlertRule: New instance.
        """
        return cls(
            name=data.get("name", ""),
            condition=data.get("condition", ""),
            severity=AlertSeverity(data.get("severity", "warning")),
            description=data.get("description", ""),
            runbook_url=data.get("runbook_url"),
        )


@dataclass
class DashboardConfig:
    """Configuration for a monitoring dashboard.

    Attributes:
        name: Internal name of the dashboard.
        title: Display title for the dashboard.
        panels: List of panel IDs or definitions to include.
        refresh_interval_seconds: Auto-refresh interval.
    """

    name: str
    title: str
    panels: list[str]
    refresh_interval_seconds: int

    def to_dict(self) -> dict[str, Any]:
        """Serialize dashboard config to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "name": self.name,
            "title": self.title,
            "panels": self.panels,
            "refresh_interval_seconds": self.refresh_interval_seconds,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DashboardConfig:
        """Create dashboard config from dictionary.

        Args:
            data: Dictionary with dashboard data.

        Returns:
            DashboardConfig: New instance.
        """
        return cls(
            name=data.get("name", ""),
            title=data.get("title", ""),
            panels=data.get("panels", []),
            refresh_interval_seconds=data.get("refresh_interval_seconds", 30),
        )


@dataclass
class MonitoringConfig:
    """Complete monitoring configuration for a deployment.

    Attributes:
        deployment_id: ID of the deployment being monitored.
        metrics: List of metric definitions to collect.
        alerts: List of alert rules.
        dashboards: List of dashboard configurations.
    """

    deployment_id: str
    metrics: list[MetricDefinition]
    alerts: list[AlertRule]
    dashboards: list[DashboardConfig]

    def to_dict(self) -> dict[str, Any]:
        """Serialize monitoring config to dictionary.

        Returns:
            dict: Dictionary representation.
        """
        return {
            "deployment_id": self.deployment_id,
            "metrics": [metric.to_dict() for metric in self.metrics],
            "alerts": [alert.to_dict() for alert in self.alerts],
            "dashboards": [dashboard.to_dict() for dashboard in self.dashboards],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MonitoringConfig:
        """Create monitoring config from dictionary.

        Args:
            data: Dictionary with config data.

        Returns:
            MonitoringConfig: New instance.
        """
        return cls(
            deployment_id=data.get("deployment_id", ""),
            metrics=[
                MetricDefinition.from_dict(m) for m in data.get("metrics", [])
            ],
            alerts=[AlertRule.from_dict(a) for a in data.get("alerts", [])],
            dashboards=[
                DashboardConfig.from_dict(d) for d in data.get("dashboards", [])
            ],
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string.

        Args:
            indent: JSON indentation level.

        Returns:
            str: JSON string representation.
        """
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> MonitoringConfig:
        """Create from JSON string.

        Args:
            json_str: JSON string.

        Returns:
            MonitoringConfig: New instance.
        """
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format monitoring config as markdown.

        Returns:
            str: Markdown formatted config.
        """
        lines = [
            "# Monitoring Configuration",
            "",
            f"**Deployment ID:** {self.deployment_id}",
            "",
        ]

        if self.metrics:
            lines.extend(["## Metrics", ""])
            for metric in self.metrics:
                lines.extend([
                    f"### {metric.name}",
                    "",
                    f"**Type:** {metric.metric_type.value}",
                    f"**Description:** {metric.description}",
                ])
                if metric.labels:
                    lines.append(f"**Labels:** {', '.join(metric.labels)}")
                lines.append("")

        if self.alerts:
            lines.extend(["## Alerts", ""])
            for alert in self.alerts:
                lines.extend([
                    f"### {alert.name}",
                    "",
                    f"**Severity:** {alert.severity.value}",
                    f"**Condition:** `{alert.condition}`",
                    f"**Description:** {alert.description}",
                ])
                if alert.runbook_url:
                    lines.append(f"**Runbook:** {alert.runbook_url}")
                lines.append("")

        if self.dashboards:
            lines.extend(["## Dashboards", ""])
            for dashboard in self.dashboards:
                lines.extend([
                    f"### {dashboard.title}",
                    "",
                    f"**Name:** {dashboard.name}",
                    f"**Refresh Interval:** {dashboard.refresh_interval_seconds}s",
                ])
                if dashboard.panels:
                    lines.append(f"**Panels:** {', '.join(dashboard.panels)}")
                lines.append("")

        return "\n".join(lines)
