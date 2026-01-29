"""Unit tests for Deployment models.

Tests for ArtifactReference, ReleaseManifest, DeploymentStep, HealthCheck,
DeploymentPlan, MetricDefinition, AlertRule, DashboardConfig, and MonitoringConfig
domain models used by the Release, Deployment, and Monitor agents.
"""

from __future__ import annotations

import json

import pytest

from src.workers.agents.deployment.config import DeploymentStrategy
from src.workers.agents.deployment.models import (
    ArtifactReference,
    ArtifactType,
    ReleaseManifest,
    DeploymentStep,
    StepType,
    HealthCheck,
    HealthCheckType,
    DeploymentPlan,
    MetricDefinition,
    MetricType,
    AlertRule,
    AlertSeverity,
    DashboardConfig,
    MonitoringConfig,
)


class TestArtifactType:
    """Tests for ArtifactType enum."""

    def test_artifact_type_values(self) -> None:
        """Test that artifact type has expected values."""
        assert ArtifactType.DOCKER_IMAGE.value == "docker_image"
        assert ArtifactType.HELM_CHART.value == "helm_chart"
        assert ArtifactType.BINARY.value == "binary"
        assert ArtifactType.CONFIG.value == "config"
        assert ArtifactType.DOCUMENTATION.value == "documentation"

    def test_artifact_type_is_string_enum(self) -> None:
        """Test that artifact type is a string enum."""
        assert isinstance(ArtifactType.DOCKER_IMAGE.value, str)


class TestArtifactReference:
    """Tests for ArtifactReference model."""

    def test_artifact_reference_creation(self) -> None:
        """Test that artifact reference can be created with required fields."""
        artifact = ArtifactReference(
            name="my-app",
            artifact_type=ArtifactType.DOCKER_IMAGE,
            location="registry.example.com/my-app:v1.0.0",
            checksum="sha256:abc123",
        )

        assert artifact.name == "my-app"
        assert artifact.artifact_type == ArtifactType.DOCKER_IMAGE
        assert artifact.location == "registry.example.com/my-app:v1.0.0"
        assert artifact.checksum == "sha256:abc123"

    def test_artifact_reference_with_none_checksum(self) -> None:
        """Test that artifact reference can have None checksum."""
        artifact = ArtifactReference(
            name="app-config",
            artifact_type=ArtifactType.CONFIG,
            location="s3://bucket/config.yaml",
            checksum=None,
        )

        assert artifact.checksum is None

    def test_artifact_reference_to_dict(self) -> None:
        """Test that artifact reference serializes to dictionary."""
        artifact = ArtifactReference(
            name="chart",
            artifact_type=ArtifactType.HELM_CHART,
            location="oci://registry/chart:v1.0.0",
            checksum="sha256:def456",
        )

        result = artifact.to_dict()

        assert result["name"] == "chart"
        assert result["artifact_type"] == "helm_chart"
        assert result["location"] == "oci://registry/chart:v1.0.0"
        assert result["checksum"] == "sha256:def456"

    def test_artifact_reference_from_dict(self) -> None:
        """Test that artifact reference deserializes from dictionary."""
        data = {
            "name": "binary-app",
            "artifact_type": "binary",
            "location": "/opt/app/binary",
            "checksum": None,
        }

        artifact = ArtifactReference.from_dict(data)

        assert artifact.name == "binary-app"
        assert artifact.artifact_type == ArtifactType.BINARY
        assert artifact.location == "/opt/app/binary"
        assert artifact.checksum is None

    def test_artifact_reference_roundtrip(self) -> None:
        """Test that to_dict and from_dict are inverse operations."""
        original = ArtifactReference(
            name="docs",
            artifact_type=ArtifactType.DOCUMENTATION,
            location="https://docs.example.com/v1.0.0",
            checksum="sha256:ghi789",
        )

        roundtrip = ArtifactReference.from_dict(original.to_dict())

        assert roundtrip.name == original.name
        assert roundtrip.artifact_type == original.artifact_type
        assert roundtrip.location == original.location
        assert roundtrip.checksum == original.checksum


class TestReleaseManifest:
    """Tests for ReleaseManifest model."""

    def _create_sample_artifacts(self) -> list[ArtifactReference]:
        """Create sample artifacts for testing."""
        return [
            ArtifactReference(
                name="app",
                artifact_type=ArtifactType.DOCKER_IMAGE,
                location="registry/app:v1.0.0",
                checksum="sha256:abc",
            ),
            ArtifactReference(
                name="chart",
                artifact_type=ArtifactType.HELM_CHART,
                location="oci://registry/chart:v1.0.0",
                checksum="sha256:def",
            ),
        ]

    def test_release_manifest_creation(self) -> None:
        """Test that release manifest can be created."""
        artifacts = self._create_sample_artifacts()

        manifest = ReleaseManifest(
            version="1.0.0",
            features=["P04-F04", "P04-F03"],
            changelog="- Added validation agents\n- Added deployment agents",
            artifacts=artifacts,
            rollback_plan="Revert to 0.9.0 using helm rollback",
        )

        assert manifest.version == "1.0.0"
        assert len(manifest.features) == 2
        assert "P04-F04" in manifest.features
        assert "validation agents" in manifest.changelog
        assert len(manifest.artifacts) == 2
        assert "rollback" in manifest.rollback_plan.lower()

    def test_release_manifest_to_dict(self) -> None:
        """Test that release manifest serializes to dictionary."""
        artifacts = self._create_sample_artifacts()

        manifest = ReleaseManifest(
            version="2.0.0",
            features=["P05-F01"],
            changelog="Major release",
            artifacts=artifacts,
            rollback_plan="Use previous release",
        )

        result = manifest.to_dict()

        assert result["version"] == "2.0.0"
        assert result["features"] == ["P05-F01"]
        assert result["changelog"] == "Major release"
        assert len(result["artifacts"]) == 2
        assert result["artifacts"][0]["name"] == "app"
        assert result["rollback_plan"] == "Use previous release"

    def test_release_manifest_from_dict(self) -> None:
        """Test that release manifest deserializes from dictionary."""
        data = {
            "version": "1.5.0",
            "features": ["P03-F01", "P03-F02"],
            "changelog": "Bug fixes",
            "artifacts": [
                {
                    "name": "app",
                    "artifact_type": "docker_image",
                    "location": "registry/app:v1.5.0",
                    "checksum": "sha256:xyz",
                },
            ],
            "rollback_plan": "Revert to 1.4.0",
        }

        manifest = ReleaseManifest.from_dict(data)

        assert manifest.version == "1.5.0"
        assert len(manifest.features) == 2
        assert manifest.changelog == "Bug fixes"
        assert len(manifest.artifacts) == 1
        assert manifest.artifacts[0].artifact_type == ArtifactType.DOCKER_IMAGE

    def test_release_manifest_to_json(self) -> None:
        """Test that release manifest serializes to JSON string."""
        manifest = ReleaseManifest(
            version="1.0.0",
            features=[],
            changelog="Initial release",
            artifacts=[],
            rollback_plan="N/A",
        )

        json_str = manifest.to_json()
        parsed = json.loads(json_str)

        assert parsed["version"] == "1.0.0"

    def test_release_manifest_from_json(self) -> None:
        """Test that release manifest deserializes from JSON string."""
        json_str = json.dumps({
            "version": "1.1.0",
            "features": [],
            "changelog": "Update",
            "artifacts": [],
            "rollback_plan": "Rollback",
        })

        manifest = ReleaseManifest.from_json(json_str)

        assert manifest.version == "1.1.0"

    def test_release_manifest_to_markdown(self) -> None:
        """Test that release manifest formats as markdown."""
        artifacts = self._create_sample_artifacts()

        manifest = ReleaseManifest(
            version="1.0.0",
            features=["P04-F04", "P04-F03"],
            changelog="- Feature 1\n- Feature 2",
            artifacts=artifacts,
            rollback_plan="helm rollback to v0.9.0",
        )

        md = manifest.to_markdown()

        assert "# Release Manifest" in md
        assert "1.0.0" in md
        assert "P04-F04" in md
        assert "Changelog" in md
        assert "Feature 1" in md
        assert "Artifacts" in md
        assert "Rollback Plan" in md


class TestStepType:
    """Tests for StepType enum."""

    def test_step_type_values(self) -> None:
        """Test that step type has expected values."""
        assert StepType.PREPARE.value == "prepare"
        assert StepType.DEPLOY.value == "deploy"
        assert StepType.VERIFY.value == "verify"
        assert StepType.PROMOTE.value == "promote"
        assert StepType.CLEANUP.value == "cleanup"


class TestDeploymentStep:
    """Tests for DeploymentStep model."""

    def test_deployment_step_creation(self) -> None:
        """Test that deployment step can be created."""
        step = DeploymentStep(
            order=1,
            name="Build Docker Image",
            step_type=StepType.PREPARE,
            command="docker build -t app:v1.0.0 .",
            timeout_seconds=300,
            rollback_command="docker rmi app:v1.0.0",
        )

        assert step.order == 1
        assert step.name == "Build Docker Image"
        assert step.step_type == StepType.PREPARE
        assert "docker build" in step.command
        assert step.timeout_seconds == 300
        assert step.rollback_command is not None

    def test_deployment_step_with_none_rollback(self) -> None:
        """Test that deployment step can have None rollback command."""
        step = DeploymentStep(
            order=2,
            name="Verify Deployment",
            step_type=StepType.VERIFY,
            command="kubectl get pods",
            timeout_seconds=60,
            rollback_command=None,
        )

        assert step.rollback_command is None

    def test_deployment_step_to_dict(self) -> None:
        """Test that deployment step serializes to dictionary."""
        step = DeploymentStep(
            order=3,
            name="Deploy to K8s",
            step_type=StepType.DEPLOY,
            command="helm upgrade app ./chart",
            timeout_seconds=600,
            rollback_command="helm rollback app",
        )

        result = step.to_dict()

        assert result["order"] == 3
        assert result["name"] == "Deploy to K8s"
        assert result["step_type"] == "deploy"
        assert result["command"] == "helm upgrade app ./chart"
        assert result["timeout_seconds"] == 600
        assert result["rollback_command"] == "helm rollback app"

    def test_deployment_step_from_dict(self) -> None:
        """Test that deployment step deserializes from dictionary."""
        data = {
            "order": 4,
            "name": "Promote to Production",
            "step_type": "promote",
            "command": "kubectl scale deployment app --replicas=3",
            "timeout_seconds": 120,
            "rollback_command": None,
        }

        step = DeploymentStep.from_dict(data)

        assert step.order == 4
        assert step.name == "Promote to Production"
        assert step.step_type == StepType.PROMOTE
        assert step.rollback_command is None

    def test_deployment_step_roundtrip(self) -> None:
        """Test that to_dict and from_dict are inverse operations."""
        original = DeploymentStep(
            order=5,
            name="Cleanup",
            step_type=StepType.CLEANUP,
            command="kubectl delete old-pods",
            timeout_seconds=180,
            rollback_command=None,
        )

        roundtrip = DeploymentStep.from_dict(original.to_dict())

        assert roundtrip.order == original.order
        assert roundtrip.name == original.name
        assert roundtrip.step_type == original.step_type
        assert roundtrip.command == original.command
        assert roundtrip.timeout_seconds == original.timeout_seconds


class TestHealthCheckType:
    """Tests for HealthCheckType enum."""

    def test_health_check_type_values(self) -> None:
        """Test that health check type has expected values."""
        assert HealthCheckType.HTTP.value == "http"
        assert HealthCheckType.TCP.value == "tcp"
        assert HealthCheckType.COMMAND.value == "command"
        assert HealthCheckType.GRPC.value == "grpc"


class TestHealthCheck:
    """Tests for HealthCheck model."""

    def test_health_check_creation(self) -> None:
        """Test that health check can be created."""
        check = HealthCheck(
            name="API Health",
            check_type=HealthCheckType.HTTP,
            target="/health",
            interval_seconds=30,
            timeout_seconds=5,
            success_threshold=3,
            failure_threshold=3,
        )

        assert check.name == "API Health"
        assert check.check_type == HealthCheckType.HTTP
        assert check.target == "/health"
        assert check.interval_seconds == 30
        assert check.timeout_seconds == 5
        assert check.success_threshold == 3
        assert check.failure_threshold == 3

    def test_health_check_tcp(self) -> None:
        """Test that TCP health check can be created."""
        check = HealthCheck(
            name="Database Connection",
            check_type=HealthCheckType.TCP,
            target="5432",
            interval_seconds=10,
            timeout_seconds=3,
            success_threshold=1,
            failure_threshold=3,
        )

        assert check.check_type == HealthCheckType.TCP
        assert check.target == "5432"

    def test_health_check_command(self) -> None:
        """Test that command health check can be created."""
        check = HealthCheck(
            name="Process Check",
            check_type=HealthCheckType.COMMAND,
            target="pgrep -x myapp",
            interval_seconds=15,
            timeout_seconds=5,
            success_threshold=1,
            failure_threshold=2,
        )

        assert check.check_type == HealthCheckType.COMMAND
        assert "pgrep" in check.target

    def test_health_check_to_dict(self) -> None:
        """Test that health check serializes to dictionary."""
        check = HealthCheck(
            name="gRPC Health",
            check_type=HealthCheckType.GRPC,
            target="grpc.health.v1.Health/Check",
            interval_seconds=20,
            timeout_seconds=10,
            success_threshold=2,
            failure_threshold=3,
        )

        result = check.to_dict()

        assert result["name"] == "gRPC Health"
        assert result["check_type"] == "grpc"
        assert result["target"] == "grpc.health.v1.Health/Check"
        assert result["interval_seconds"] == 20
        assert result["timeout_seconds"] == 10
        assert result["success_threshold"] == 2
        assert result["failure_threshold"] == 3

    def test_health_check_from_dict(self) -> None:
        """Test that health check deserializes from dictionary."""
        data = {
            "name": "HTTP Check",
            "check_type": "http",
            "target": "/api/status",
            "interval_seconds": 30,
            "timeout_seconds": 5,
            "success_threshold": 1,
            "failure_threshold": 3,
        }

        check = HealthCheck.from_dict(data)

        assert check.name == "HTTP Check"
        assert check.check_type == HealthCheckType.HTTP
        assert check.target == "/api/status"

    def test_health_check_roundtrip(self) -> None:
        """Test that to_dict and from_dict are inverse operations."""
        original = HealthCheck(
            name="Full Check",
            check_type=HealthCheckType.HTTP,
            target="/ready",
            interval_seconds=15,
            timeout_seconds=3,
            success_threshold=2,
            failure_threshold=4,
        )

        roundtrip = HealthCheck.from_dict(original.to_dict())

        assert roundtrip.name == original.name
        assert roundtrip.check_type == original.check_type
        assert roundtrip.target == original.target
        assert roundtrip.interval_seconds == original.interval_seconds


class TestDeploymentPlan:
    """Tests for DeploymentPlan model."""

    def _create_sample_steps(self) -> list[DeploymentStep]:
        """Create sample deployment steps for testing."""
        return [
            DeploymentStep(
                order=1,
                name="Prepare",
                step_type=StepType.PREPARE,
                command="echo prepare",
                timeout_seconds=60,
                rollback_command=None,
            ),
            DeploymentStep(
                order=2,
                name="Deploy",
                step_type=StepType.DEPLOY,
                command="helm upgrade",
                timeout_seconds=300,
                rollback_command="helm rollback",
            ),
        ]

    def _create_sample_health_checks(self) -> list[HealthCheck]:
        """Create sample health checks for testing."""
        return [
            HealthCheck(
                name="API",
                check_type=HealthCheckType.HTTP,
                target="/health",
                interval_seconds=30,
                timeout_seconds=5,
                success_threshold=3,
                failure_threshold=3,
            ),
        ]

    def test_deployment_plan_creation(self) -> None:
        """Test that deployment plan can be created."""
        steps = self._create_sample_steps()
        health_checks = self._create_sample_health_checks()

        plan = DeploymentPlan(
            release_version="1.0.0",
            target_environment="staging",
            strategy=DeploymentStrategy.ROLLING,
            steps=steps,
            rollback_triggers=["5xx error rate > 5%", "p99 latency > 1s"],
            health_checks=health_checks,
        )

        assert plan.release_version == "1.0.0"
        assert plan.target_environment == "staging"
        assert plan.strategy == DeploymentStrategy.ROLLING
        assert len(plan.steps) == 2
        assert len(plan.rollback_triggers) == 2
        assert len(plan.health_checks) == 1

    def test_deployment_plan_with_canary_strategy(self) -> None:
        """Test that deployment plan supports canary strategy."""
        steps = self._create_sample_steps()
        health_checks = self._create_sample_health_checks()

        plan = DeploymentPlan(
            release_version="1.0.0",
            target_environment="production",
            strategy=DeploymentStrategy.CANARY,
            steps=steps,
            rollback_triggers=["error rate > 1%"],
            health_checks=health_checks,
        )

        assert plan.strategy == DeploymentStrategy.CANARY

    def test_deployment_plan_with_blue_green_strategy(self) -> None:
        """Test that deployment plan supports blue-green strategy."""
        steps = self._create_sample_steps()
        health_checks = self._create_sample_health_checks()

        plan = DeploymentPlan(
            release_version="1.0.0",
            target_environment="production",
            strategy=DeploymentStrategy.BLUE_GREEN,
            steps=steps,
            rollback_triggers=[],
            health_checks=health_checks,
        )

        assert plan.strategy == DeploymentStrategy.BLUE_GREEN

    def test_deployment_plan_to_dict(self) -> None:
        """Test that deployment plan serializes to dictionary."""
        steps = self._create_sample_steps()
        health_checks = self._create_sample_health_checks()

        plan = DeploymentPlan(
            release_version="2.0.0",
            target_environment="production",
            strategy=DeploymentStrategy.CANARY,
            steps=steps,
            rollback_triggers=["failure"],
            health_checks=health_checks,
        )

        result = plan.to_dict()

        assert result["release_version"] == "2.0.0"
        assert result["target_environment"] == "production"
        assert result["strategy"] == "canary"
        assert len(result["steps"]) == 2
        assert result["steps"][0]["order"] == 1
        assert result["rollback_triggers"] == ["failure"]
        assert len(result["health_checks"]) == 1

    def test_deployment_plan_from_dict(self) -> None:
        """Test that deployment plan deserializes from dictionary."""
        data = {
            "release_version": "1.5.0",
            "target_environment": "staging",
            "strategy": "rolling",
            "steps": [
                {
                    "order": 1,
                    "name": "Deploy",
                    "step_type": "deploy",
                    "command": "deploy",
                    "timeout_seconds": 300,
                    "rollback_command": None,
                },
            ],
            "rollback_triggers": ["error"],
            "health_checks": [
                {
                    "name": "HTTP",
                    "check_type": "http",
                    "target": "/health",
                    "interval_seconds": 30,
                    "timeout_seconds": 5,
                    "success_threshold": 3,
                    "failure_threshold": 3,
                },
            ],
        }

        plan = DeploymentPlan.from_dict(data)

        assert plan.release_version == "1.5.0"
        assert plan.target_environment == "staging"
        assert plan.strategy == DeploymentStrategy.ROLLING
        assert len(plan.steps) == 1
        assert plan.steps[0].step_type == StepType.DEPLOY

    def test_deployment_plan_to_json(self) -> None:
        """Test that deployment plan serializes to JSON string."""
        plan = DeploymentPlan(
            release_version="1.0.0",
            target_environment="staging",
            strategy=DeploymentStrategy.ROLLING,
            steps=[],
            rollback_triggers=[],
            health_checks=[],
        )

        json_str = plan.to_json()
        parsed = json.loads(json_str)

        assert parsed["release_version"] == "1.0.0"

    def test_deployment_plan_from_json(self) -> None:
        """Test that deployment plan deserializes from JSON string."""
        json_str = json.dumps({
            "release_version": "1.1.0",
            "target_environment": "staging",
            "strategy": "rolling",
            "steps": [],
            "rollback_triggers": [],
            "health_checks": [],
        })

        plan = DeploymentPlan.from_json(json_str)

        assert plan.release_version == "1.1.0"

    def test_deployment_plan_to_markdown(self) -> None:
        """Test that deployment plan formats as markdown."""
        steps = self._create_sample_steps()
        health_checks = self._create_sample_health_checks()

        plan = DeploymentPlan(
            release_version="1.0.0",
            target_environment="production",
            strategy=DeploymentStrategy.CANARY,
            steps=steps,
            rollback_triggers=["5xx error rate > 5%", "p99 latency > 1s"],
            health_checks=health_checks,
        )

        md = plan.to_markdown()

        assert "# Deployment Plan" in md
        assert "1.0.0" in md
        assert "production" in md
        assert "canary" in md.lower()
        assert "Steps" in md
        assert "Health Checks" in md
        assert "Rollback Triggers" in md


class TestMetricType:
    """Tests for MetricType enum."""

    def test_metric_type_values(self) -> None:
        """Test that metric type has expected values."""
        assert MetricType.COUNTER.value == "counter"
        assert MetricType.GAUGE.value == "gauge"
        assert MetricType.HISTOGRAM.value == "histogram"
        assert MetricType.SUMMARY.value == "summary"


class TestMetricDefinition:
    """Tests for MetricDefinition model."""

    def test_metric_definition_creation(self) -> None:
        """Test that metric definition can be created."""
        metric = MetricDefinition(
            name="http_requests_total",
            metric_type=MetricType.COUNTER,
            description="Total HTTP requests",
            labels=["method", "status", "path"],
        )

        assert metric.name == "http_requests_total"
        assert metric.metric_type == MetricType.COUNTER
        assert metric.description == "Total HTTP requests"
        assert len(metric.labels) == 3

    def test_metric_definition_to_dict(self) -> None:
        """Test that metric definition serializes to dictionary."""
        metric = MetricDefinition(
            name="memory_usage_bytes",
            metric_type=MetricType.GAUGE,
            description="Current memory usage",
            labels=["service"],
        )

        result = metric.to_dict()

        assert result["name"] == "memory_usage_bytes"
        assert result["metric_type"] == "gauge"
        assert result["description"] == "Current memory usage"
        assert result["labels"] == ["service"]

    def test_metric_definition_from_dict(self) -> None:
        """Test that metric definition deserializes from dictionary."""
        data = {
            "name": "request_duration_seconds",
            "metric_type": "histogram",
            "description": "Request duration",
            "labels": ["endpoint"],
        }

        metric = MetricDefinition.from_dict(data)

        assert metric.name == "request_duration_seconds"
        assert metric.metric_type == MetricType.HISTOGRAM
        assert metric.labels == ["endpoint"]


class TestAlertSeverity:
    """Tests for AlertSeverity enum."""

    def test_alert_severity_values(self) -> None:
        """Test that alert severity has expected values."""
        assert AlertSeverity.CRITICAL.value == "critical"
        assert AlertSeverity.WARNING.value == "warning"
        assert AlertSeverity.INFO.value == "info"


class TestAlertRule:
    """Tests for AlertRule model."""

    def test_alert_rule_creation(self) -> None:
        """Test that alert rule can be created."""
        rule = AlertRule(
            name="HighErrorRate",
            condition="rate(http_requests_total{status=~'5..'}[5m]) > 0.05",
            severity=AlertSeverity.CRITICAL,
            description="Error rate exceeds 5%",
            runbook_url="https://docs.example.com/runbooks/high-error-rate",
        )

        assert rule.name == "HighErrorRate"
        assert "rate(" in rule.condition
        assert rule.severity == AlertSeverity.CRITICAL
        assert "5%" in rule.description
        assert rule.runbook_url is not None

    def test_alert_rule_without_runbook(self) -> None:
        """Test that alert rule can be created without runbook URL."""
        rule = AlertRule(
            name="MemoryWarning",
            condition="memory_usage_bytes > 1e9",
            severity=AlertSeverity.WARNING,
            description="Memory usage exceeds 1GB",
            runbook_url=None,
        )

        assert rule.runbook_url is None

    def test_alert_rule_to_dict(self) -> None:
        """Test that alert rule serializes to dictionary."""
        rule = AlertRule(
            name="Test",
            condition="metric > 1",
            severity=AlertSeverity.INFO,
            description="Test alert",
            runbook_url="https://example.com",
        )

        result = rule.to_dict()

        assert result["name"] == "Test"
        assert result["condition"] == "metric > 1"
        assert result["severity"] == "info"
        assert result["description"] == "Test alert"
        assert result["runbook_url"] == "https://example.com"

    def test_alert_rule_from_dict(self) -> None:
        """Test that alert rule deserializes from dictionary."""
        data = {
            "name": "FromDict",
            "condition": "rate > 0.1",
            "severity": "warning",
            "description": "High rate",
            "runbook_url": None,
        }

        rule = AlertRule.from_dict(data)

        assert rule.name == "FromDict"
        assert rule.severity == AlertSeverity.WARNING
        assert rule.runbook_url is None


class TestDashboardConfig:
    """Tests for DashboardConfig model."""

    def test_dashboard_config_creation(self) -> None:
        """Test that dashboard config can be created."""
        dashboard = DashboardConfig(
            name="Service Overview",
            title="Service Health Dashboard",
            panels=["request_rate", "error_rate", "latency_p99"],
            refresh_interval_seconds=30,
        )

        assert dashboard.name == "Service Overview"
        assert dashboard.title == "Service Health Dashboard"
        assert len(dashboard.panels) == 3
        assert dashboard.refresh_interval_seconds == 30

    def test_dashboard_config_to_dict(self) -> None:
        """Test that dashboard config serializes to dictionary."""
        dashboard = DashboardConfig(
            name="overview",
            title="Overview",
            panels=["panel1", "panel2"],
            refresh_interval_seconds=60,
        )

        result = dashboard.to_dict()

        assert result["name"] == "overview"
        assert result["title"] == "Overview"
        assert result["panels"] == ["panel1", "panel2"]
        assert result["refresh_interval_seconds"] == 60

    def test_dashboard_config_from_dict(self) -> None:
        """Test that dashboard config deserializes from dictionary."""
        data = {
            "name": "from_dict",
            "title": "From Dict",
            "panels": ["panel"],
            "refresh_interval_seconds": 120,
        }

        dashboard = DashboardConfig.from_dict(data)

        assert dashboard.name == "from_dict"
        assert dashboard.refresh_interval_seconds == 120


class TestMonitoringConfig:
    """Tests for MonitoringConfig model."""

    def _create_sample_metrics(self) -> list[MetricDefinition]:
        """Create sample metrics for testing."""
        return [
            MetricDefinition(
                name="requests_total",
                metric_type=MetricType.COUNTER,
                description="Total requests",
                labels=["method"],
            ),
        ]

    def _create_sample_alerts(self) -> list[AlertRule]:
        """Create sample alerts for testing."""
        return [
            AlertRule(
                name="HighError",
                condition="error_rate > 0.05",
                severity=AlertSeverity.CRITICAL,
                description="High error rate",
                runbook_url=None,
            ),
        ]

    def _create_sample_dashboards(self) -> list[DashboardConfig]:
        """Create sample dashboards for testing."""
        return [
            DashboardConfig(
                name="overview",
                title="Overview",
                panels=["panel1"],
                refresh_interval_seconds=30,
            ),
        ]

    def test_monitoring_config_creation(self) -> None:
        """Test that monitoring config can be created."""
        metrics = self._create_sample_metrics()
        alerts = self._create_sample_alerts()
        dashboards = self._create_sample_dashboards()

        config = MonitoringConfig(
            deployment_id="deploy-001",
            metrics=metrics,
            alerts=alerts,
            dashboards=dashboards,
        )

        assert config.deployment_id == "deploy-001"
        assert len(config.metrics) == 1
        assert len(config.alerts) == 1
        assert len(config.dashboards) == 1

    def test_monitoring_config_to_dict(self) -> None:
        """Test that monitoring config serializes to dictionary."""
        metrics = self._create_sample_metrics()
        alerts = self._create_sample_alerts()
        dashboards = self._create_sample_dashboards()

        config = MonitoringConfig(
            deployment_id="deploy-002",
            metrics=metrics,
            alerts=alerts,
            dashboards=dashboards,
        )

        result = config.to_dict()

        assert result["deployment_id"] == "deploy-002"
        assert len(result["metrics"]) == 1
        assert result["metrics"][0]["name"] == "requests_total"
        assert len(result["alerts"]) == 1
        assert result["alerts"][0]["severity"] == "critical"
        assert len(result["dashboards"]) == 1

    def test_monitoring_config_from_dict(self) -> None:
        """Test that monitoring config deserializes from dictionary."""
        data = {
            "deployment_id": "deploy-003",
            "metrics": [
                {
                    "name": "requests",
                    "metric_type": "counter",
                    "description": "Requests",
                    "labels": [],
                },
            ],
            "alerts": [
                {
                    "name": "Alert",
                    "condition": "x > 1",
                    "severity": "warning",
                    "description": "Alert",
                    "runbook_url": None,
                },
            ],
            "dashboards": [
                {
                    "name": "dashboard",
                    "title": "Dashboard",
                    "panels": [],
                    "refresh_interval_seconds": 60,
                },
            ],
        }

        config = MonitoringConfig.from_dict(data)

        assert config.deployment_id == "deploy-003"
        assert len(config.metrics) == 1
        assert config.metrics[0].metric_type == MetricType.COUNTER
        assert len(config.alerts) == 1
        assert config.alerts[0].severity == AlertSeverity.WARNING

    def test_monitoring_config_to_json(self) -> None:
        """Test that monitoring config serializes to JSON string."""
        config = MonitoringConfig(
            deployment_id="deploy-004",
            metrics=[],
            alerts=[],
            dashboards=[],
        )

        json_str = config.to_json()
        parsed = json.loads(json_str)

        assert parsed["deployment_id"] == "deploy-004"

    def test_monitoring_config_from_json(self) -> None:
        """Test that monitoring config deserializes from JSON string."""
        json_str = json.dumps({
            "deployment_id": "deploy-005",
            "metrics": [],
            "alerts": [],
            "dashboards": [],
        })

        config = MonitoringConfig.from_json(json_str)

        assert config.deployment_id == "deploy-005"

    def test_monitoring_config_to_markdown(self) -> None:
        """Test that monitoring config formats as markdown."""
        metrics = self._create_sample_metrics()
        alerts = self._create_sample_alerts()
        dashboards = self._create_sample_dashboards()

        config = MonitoringConfig(
            deployment_id="deploy-001",
            metrics=metrics,
            alerts=alerts,
            dashboards=dashboards,
        )

        md = config.to_markdown()

        assert "# Monitoring Configuration" in md
        assert "deploy-001" in md
        assert "Metrics" in md
        assert "requests_total" in md
        assert "Alerts" in md
        assert "HighError" in md
        assert "Dashboards" in md
