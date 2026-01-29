"""Tests for DeploymentAgent.

Tests the deployment planning agent that generates deployment plans,
configures health checks, defines rollback triggers, and supports
multiple deployment strategies (rolling, blue-green, canary).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.deployment.config import DeploymentConfig, DeploymentStrategy
from src.workers.agents.deployment.models import (
    ArtifactReference,
    ArtifactType,
    DeploymentPlan,
    DeploymentStep,
    HealthCheck,
    HealthCheckType,
    ReleaseManifest,
    StepType,
)

# Import the module under test (will be created)
from src.workers.agents.deployment.deployment_agent import (
    DeploymentAgent,
    DeploymentAgentError,
)


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = AsyncMock()
    client.generate = AsyncMock()
    return client


@pytest.fixture
def mock_artifact_writer():
    """Create a mock artifact writer."""
    writer = AsyncMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/deployment_plan.json")
    return writer


@pytest.fixture
def deployment_config():
    """Create a deployment configuration."""
    return DeploymentConfig()


@pytest.fixture
def agent_context():
    """Create an agent context for testing."""
    return AgentContext(
        session_id="session-123",
        task_id="task-456",
        tenant_id="tenant-789",
        workspace_path="/workspace",
        context_pack={
            "files": [
                {"path": "src/feature.py", "content": "# feature code"},
            ],
        },
    )


@pytest.fixture
def release_manifest():
    """Create a sample release manifest."""
    return ReleaseManifest(
        version="1.0.0",
        features=["P04-F04"],
        changelog="## Version 1.0.0\n\n- feat(P04-F04): Add deployment agent",
        artifacts=[
            ArtifactReference(
                name="orchestrator",
                artifact_type=ArtifactType.DOCKER_IMAGE,
                location="registry.io/orchestrator:1.0.0",
                checksum="sha256:abc123",
            ),
            ArtifactReference(
                name="dox-asdlc-chart",
                artifact_type=ArtifactType.HELM_CHART,
                location="charts/dox-asdlc-1.0.0.tgz",
                checksum="sha256:def456",
            ),
        ],
        rollback_plan="1. Run kubectl rollout undo\n2. Verify health",
    )


class TestDeploymentAgentInit:
    """Tests for DeploymentAgent initialization."""

    def test_creates_with_required_args(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that agent can be created with required arguments."""
        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent is not None
        assert agent.agent_type == "deployment_agent"

    def test_agent_type_is_deployment_agent(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that agent_type property returns correct value."""
        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent.agent_type == "deployment_agent"


class TestDeploymentAgentExecute:
    """Tests for DeploymentAgent.execute method."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_release_manifest(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
    ):
        """Test that execute returns failure when no release manifest provided."""
        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},  # No release_manifest
        )

        assert result.success is False
        assert "release" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_generates_deployment_plan_successfully(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that agent generates a deployment plan successfully."""
        # Mock LLM response for deployment plan generation
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [
                    {
                        "order": 1,
                        "name": "Pull Docker images",
                        "step_type": "prepare",
                        "command": "docker pull registry.io/orchestrator:1.0.0",
                        "timeout_seconds": 300,
                        "rollback_command": null
                    },
                    {
                        "order": 2,
                        "name": "Deploy Helm chart",
                        "step_type": "deploy",
                        "command": "helm upgrade --install dox-asdlc ./charts/dox-asdlc",
                        "timeout_seconds": 600,
                        "rollback_command": "helm rollback dox-asdlc"
                    },
                    {
                        "order": 3,
                        "name": "Verify deployment",
                        "step_type": "verify",
                        "command": "kubectl rollout status deployment/orchestrator",
                        "timeout_seconds": 300,
                        "rollback_command": null
                    }
                ],
                "rollback_triggers": [
                    "Error rate > 5%",
                    "Latency p99 > 500ms",
                    "Health check failures > 3"
                ],
                "health_checks": [
                    {
                        "name": "orchestrator-health",
                        "check_type": "http",
                        "target": "/health",
                        "interval_seconds": 30,
                        "timeout_seconds": 5,
                        "success_threshold": 1,
                        "failure_threshold": 3
                    }
                ]
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "target_environment": "staging",
            },
        )

        assert result.success is True
        assert result.agent_type == "deployment_agent"
        assert "deployment_plan" in result.metadata
        assert result.metadata.get("hitl_gate") == "HITL-6"

    @pytest.mark.asyncio
    async def test_sets_hitl_gate_to_hitl6(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that hitl_gate is set to HITL-6 on success."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        assert result.metadata.get("hitl_gate") == "HITL-6"


class TestDeploymentStrategySupport:
    """Tests for multiple deployment strategy support."""

    @pytest.mark.asyncio
    async def test_rolling_strategy(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        release_manifest,
    ):
        """Test deployment with rolling strategy."""
        config = DeploymentConfig(deployment_strategy=DeploymentStrategy.ROLLING)

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [
                    {
                        "order": 1,
                        "name": "Rolling update",
                        "step_type": "deploy",
                        "command": "kubectl set image deployment/app app=image:1.0.0",
                        "timeout_seconds": 600,
                        "rollback_command": "kubectl rollout undo deployment/app"
                    }
                ],
                "rollback_triggers": ["Error rate > 5%"],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "deployment_strategy": "rolling",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["strategy"] == "rolling"

    @pytest.mark.asyncio
    async def test_blue_green_strategy(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        release_manifest,
    ):
        """Test deployment with blue-green strategy."""
        config = DeploymentConfig(deployment_strategy=DeploymentStrategy.BLUE_GREEN)

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "production",
                "strategy": "blue-green",
                "steps": [
                    {
                        "order": 1,
                        "name": "Deploy to green environment",
                        "step_type": "deploy",
                        "command": "helm install dox-asdlc-green ./charts/dox-asdlc --set env=green",
                        "timeout_seconds": 600,
                        "rollback_command": "helm uninstall dox-asdlc-green"
                    },
                    {
                        "order": 2,
                        "name": "Verify green deployment",
                        "step_type": "verify",
                        "command": "kubectl rollout status deployment/dox-asdlc-green",
                        "timeout_seconds": 300,
                        "rollback_command": null
                    },
                    {
                        "order": 3,
                        "name": "Switch traffic to green",
                        "step_type": "promote",
                        "command": "scripts/switch-traffic.sh green",
                        "timeout_seconds": 60,
                        "rollback_command": "scripts/switch-traffic.sh blue"
                    }
                ],
                "rollback_triggers": ["Error rate > 1%", "Response time > 2s"],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "deployment_strategy": "blue-green",
                "target_environment": "production",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["strategy"] == "blue-green"
        # Blue-green should have traffic switching step
        step_names = [s["name"].lower() for s in plan["steps"]]
        assert any("traffic" in name or "switch" in name for name in step_names)

    @pytest.mark.asyncio
    async def test_canary_strategy(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        release_manifest,
    ):
        """Test deployment with canary strategy."""
        config = DeploymentConfig(
            deployment_strategy=DeploymentStrategy.CANARY,
            canary_percentage=10,
        )

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "production",
                "strategy": "canary",
                "steps": [
                    {
                        "order": 1,
                        "name": "Deploy canary (10% traffic)",
                        "step_type": "deploy",
                        "command": "kubectl apply -f canary-deployment.yaml",
                        "timeout_seconds": 300,
                        "rollback_command": "kubectl delete -f canary-deployment.yaml"
                    },
                    {
                        "order": 2,
                        "name": "Monitor canary metrics",
                        "step_type": "verify",
                        "command": "scripts/check_canary_metrics.sh",
                        "timeout_seconds": 900,
                        "rollback_command": null
                    },
                    {
                        "order": 3,
                        "name": "Promote to full deployment",
                        "step_type": "promote",
                        "command": "kubectl scale deployment dox-asdlc-canary --replicas=0 && kubectl apply -f full-deployment.yaml",
                        "timeout_seconds": 600,
                        "rollback_command": "kubectl rollout undo deployment/dox-asdlc"
                    }
                ],
                "rollback_triggers": ["Canary error rate > baseline + 5%", "Canary latency > baseline * 1.5"],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "deployment_strategy": "canary",
                "target_environment": "production",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["strategy"] == "canary"

    @pytest.mark.asyncio
    async def test_uses_strategy_from_event_metadata(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that strategy from event_metadata overrides config."""
        # Config says rolling, but metadata says canary
        config = DeploymentConfig(deployment_strategy=DeploymentStrategy.ROLLING)

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "canary",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "deployment_strategy": "canary",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["strategy"] == "canary"


class TestHealthCheckConfiguration:
    """Tests for health check configuration."""

    @pytest.mark.asyncio
    async def test_configures_http_health_check(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that HTTP health checks are configured."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": [
                    {
                        "name": "api-health",
                        "check_type": "http",
                        "target": "/health",
                        "interval_seconds": 30,
                        "timeout_seconds": 5,
                        "success_threshold": 1,
                        "failure_threshold": 3
                    }
                ]
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert len(plan["health_checks"]) > 0
        health_check = plan["health_checks"][0]
        assert health_check["check_type"] == "http"
        assert health_check["target"] == "/health"

    @pytest.mark.asyncio
    async def test_configures_tcp_health_check(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that TCP health checks are configured."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": [
                    {
                        "name": "redis-connection",
                        "check_type": "tcp",
                        "target": "redis:6379",
                        "interval_seconds": 15,
                        "timeout_seconds": 3,
                        "success_threshold": 1,
                        "failure_threshold": 3
                    }
                ]
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        tcp_checks = [h for h in plan["health_checks"] if h["check_type"] == "tcp"]
        assert len(tcp_checks) > 0

    @pytest.mark.asyncio
    async def test_uses_health_check_interval_from_config(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        release_manifest,
    ):
        """Test that health check interval from config is used."""
        config = DeploymentConfig(health_check_interval=60)

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": [
                    {
                        "name": "api-health",
                        "check_type": "http",
                        "target": "/health",
                        "interval_seconds": 60,
                        "timeout_seconds": 5,
                        "success_threshold": 1,
                        "failure_threshold": 3
                    }
                ]
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        # Verify the prompt included the config interval
        call_args = mock_llm_client.generate.call_args
        prompt = call_args.kwargs.get("prompt", call_args.args[0] if call_args.args else "")
        assert "60" in prompt


class TestRollbackTriggers:
    """Tests for rollback trigger definition."""

    @pytest.mark.asyncio
    async def test_defines_rollback_triggers(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that rollback triggers are defined."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [
                    "Error rate exceeds 5% for 5 minutes",
                    "P99 latency exceeds 500ms for 5 minutes",
                    "Memory usage exceeds 90% for 10 minutes",
                    "Health check failures exceed 3 consecutive"
                ],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert len(plan["rollback_triggers"]) > 0
        # Should include error rate trigger
        triggers_lower = [t.lower() for t in plan["rollback_triggers"]]
        assert any("error" in t for t in triggers_lower)

    @pytest.mark.asyncio
    async def test_rollback_disabled_reduces_triggers(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        release_manifest,
    ):
        """Test that disabled rollback reduces trigger definitions."""
        config = DeploymentConfig(rollback_enabled=False)

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        # Verify the prompt mentioned rollback is disabled
        call_args = mock_llm_client.generate.call_args
        prompt = call_args.kwargs.get("prompt", call_args.args[0] if call_args.args else "")
        assert "rollback" in prompt.lower() and "disabled" in prompt.lower()


class TestDeploymentSteps:
    """Tests for deployment step generation."""

    @pytest.mark.asyncio
    async def test_generates_ordered_steps(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that deployment steps are properly ordered."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [
                    {
                        "order": 1,
                        "name": "Prepare infrastructure",
                        "step_type": "prepare",
                        "command": "terraform apply",
                        "timeout_seconds": 300,
                        "rollback_command": null
                    },
                    {
                        "order": 2,
                        "name": "Deploy application",
                        "step_type": "deploy",
                        "command": "helm upgrade --install",
                        "timeout_seconds": 600,
                        "rollback_command": "helm rollback"
                    },
                    {
                        "order": 3,
                        "name": "Verify deployment",
                        "step_type": "verify",
                        "command": "kubectl rollout status",
                        "timeout_seconds": 300,
                        "rollback_command": null
                    }
                ],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        steps = plan["steps"]
        # Steps should be ordered
        orders = [s["order"] for s in steps]
        assert orders == sorted(orders)

    @pytest.mark.asyncio
    async def test_steps_include_rollback_commands(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that deployment steps include rollback commands."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [
                    {
                        "order": 1,
                        "name": "Deploy",
                        "step_type": "deploy",
                        "command": "helm upgrade --install dox-asdlc ./charts/dox-asdlc",
                        "timeout_seconds": 600,
                        "rollback_command": "helm rollback dox-asdlc"
                    }
                ],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        deploy_steps = [s for s in plan["steps"] if s["step_type"] == "deploy"]
        # Deploy steps should have rollback commands when rollback is enabled
        assert any(s.get("rollback_command") is not None for s in deploy_steps)


class TestEnvironmentHandling:
    """Tests for target environment handling."""

    @pytest.mark.asyncio
    async def test_uses_provided_target_environment(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that provided target environment is used."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "production",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                "target_environment": "production",
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["target_environment"] == "production"

    @pytest.mark.asyncio
    async def test_defaults_to_staging_environment(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that environment defaults to staging when not provided."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
                # No target_environment provided
            },
        )

        assert result.success is True
        plan = result.metadata["deployment_plan"]
        assert plan["target_environment"] == "staging"


class TestArtifactWriting:
    """Tests for artifact writing."""

    @pytest.mark.asyncio
    async def test_writes_json_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that agent writes JSON artifact."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        assert mock_artifact_writer.write_artifact.called
        assert len(result.artifact_paths) > 0

    @pytest.mark.asyncio
    async def test_writes_markdown_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that agent writes Markdown artifact."""
        # Track calls to write_artifact to verify both JSON and MD are written
        call_count = [0]

        async def track_calls(*args, **kwargs):
            call_count[0] += 1
            filename = kwargs.get("filename", "")
            if ".md" in filename:
                return "/artifacts/deployment_plan.md"
            return "/artifacts/deployment_plan.json"

        mock_artifact_writer.write_artifact.side_effect = track_calls

        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is True
        # Should write at least JSON and Markdown
        assert call_count[0] >= 2


class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_llm_error_gracefully(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that agent handles LLM errors gracefully."""
        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is False
        assert "LLM service unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_invalid_llm_response(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that agent handles invalid LLM response."""
        mock_llm_client.generate.return_value = MagicMock(
            content="This is not valid JSON"
        )

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_artifact_writer_error(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
        release_manifest,
    ):
        """Test that agent handles artifact writer errors."""
        mock_llm_client.generate.return_value = MagicMock(
            content="""{
                "release_version": "1.0.0",
                "target_environment": "staging",
                "strategy": "rolling",
                "steps": [],
                "rollback_triggers": [],
                "health_checks": []
            }"""
        )
        mock_artifact_writer.write_artifact.side_effect = Exception("Write failed")

        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "release_manifest": release_manifest.to_dict(),
            },
        )

        assert result.success is False
        assert "Write failed" in result.error_message
        assert result.should_retry is True


class TestValidateContext:
    """Tests for context validation."""

    def test_validates_complete_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
        agent_context,
    ):
        """Test that complete context passes validation."""
        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_rejects_incomplete_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        deployment_config,
    ):
        """Test that incomplete context fails validation."""
        agent = DeploymentAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=deployment_config,
        )

        incomplete_context = AgentContext(
            session_id="",
            task_id="",
            tenant_id="",
            workspace_path="",
        )

        assert agent.validate_context(incomplete_context) is False
