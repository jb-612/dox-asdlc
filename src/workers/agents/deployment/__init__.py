"""Deployment Agents package for aSDLC.

Provides agents for release management, deployment planning, and monitoring
configuration in the aSDLC workflow.

Agents:
    - ReleaseAgent: Generates release manifests and rollback plans
    - DeploymentAgent: Creates deployment plans with health checks
    - MonitorAgent: Configures monitoring metrics, alerts, and dashboards

Coordinator:
    - ValidationDeploymentCoordinator: Orchestrates Validation -> Security -> HITL-5
      and Release -> Deployment -> HITL-6 -> Monitor workflows

Example:
    from src.workers.agents.deployment import (
        ValidationDeploymentCoordinator,
        DeploymentConfig,
        create_validation_deployment_coordinator,
    )

    coordinator = create_validation_deployment_coordinator(
        llm_client=client,
        artifact_writer=writer,
        test_runner=runner,
    )

    # Run validation phase
    result = await coordinator.run_validation(context, implementation, criteria)

    # Run deployment phase after HITL-5 approval
    result = await coordinator.run_deployment(
        context, hitl5_approval, validation_report, security_report, "staging"
    )
"""

from src.workers.agents.deployment.config import (
    DeploymentConfig,
    DeploymentConfigValidationError,
    DeploymentStrategy,
)
from src.workers.agents.deployment.models import (
    ArtifactType,
    ArtifactReference,
    ReleaseManifest,
    StepType,
    DeploymentStep,
    HealthCheckType,
    HealthCheck,
    DeploymentPlan,
    MetricType,
    MetricDefinition,
    AlertSeverity,
    AlertRule,
    DashboardConfig,
    MonitoringConfig,
)
from src.workers.agents.deployment.release_agent import (
    ReleaseAgent,
    ReleaseAgentError,
)
from src.workers.agents.deployment.deployment_agent import (
    DeploymentAgent,
    DeploymentAgentError,
)
from src.workers.agents.deployment.monitor_agent import (
    MonitorAgent,
    MonitorAgentError,
)
from src.workers.agents.deployment.coordinator import (
    ValidationDeploymentCoordinator,
    ValidationDeploymentCoordinatorError,
    EvidenceBundle,
    ValidationResult,
    DeploymentResult,
    RejectionResult,
)

__all__ = [
    # Config
    "DeploymentConfig",
    "DeploymentConfigValidationError",
    "DeploymentStrategy",
    # Models
    "ArtifactType",
    "ArtifactReference",
    "ReleaseManifest",
    "StepType",
    "DeploymentStep",
    "HealthCheckType",
    "HealthCheck",
    "DeploymentPlan",
    "MetricType",
    "MetricDefinition",
    "AlertSeverity",
    "AlertRule",
    "DashboardConfig",
    "MonitoringConfig",
    # Agents
    "ReleaseAgent",
    "ReleaseAgentError",
    "DeploymentAgent",
    "DeploymentAgentError",
    "MonitorAgent",
    "MonitorAgentError",
    # Coordinator
    "ValidationDeploymentCoordinator",
    "ValidationDeploymentCoordinatorError",
    "EvidenceBundle",
    "ValidationResult",
    "DeploymentResult",
    "RejectionResult",
    # Metadata and Registration
    "AGENT_METADATA",
    "register_deployment_agents",
    # Factory Functions
    "create_release_agent",
    "create_deployment_agent",
    "create_monitor_agent",
    "create_validation_deployment_coordinator",
]

# Agent metadata for registration
AGENT_METADATA = {
    "release_agent": {
        "class": ReleaseAgent,
        "description": "Generates release manifests with changelog and rollback plans",
        "phase": "deployment",
        "inputs": ["validation_report", "security_report", "commits", "version"],
        "outputs": ["release_manifest.json", "release_manifest.md"],
        "capabilities": ["manifest_generation", "changelog_creation", "rollback_planning"],
    },
    "deployment_agent": {
        "class": DeploymentAgent,
        "description": "Creates deployment plans with health checks and rollback triggers",
        "phase": "deployment",
        "inputs": ["release_manifest", "target_environment", "deployment_strategy"],
        "outputs": ["deployment_plan.json", "deployment_plan.md"],
        "capabilities": ["deployment_planning", "health_check_config", "rollback_triggers", "multi_strategy"],
    },
    "monitor_agent": {
        "class": MonitorAgent,
        "description": "Generates monitoring configurations with metrics, alerts, and dashboards",
        "phase": "deployment",
        "inputs": ["deployment_plan"],
        "outputs": ["monitoring_config.json", "monitoring_config.md"],
        "capabilities": ["monitoring_config", "metrics_definition", "alert_rules", "dashboard_generation"],
    },
}


def register_deployment_agents(dispatcher: "AgentDispatcher") -> None:
    """Register deployment agents with the agent dispatcher.

    Note: This function is called from workers/main.py with proper
    dependency injection. The actual instantiation requires dependencies
    (llm_client, artifact_writer, etc.) that must be provided at runtime.

    Args:
        dispatcher: The agent dispatcher to register with.
    """
    # Import here to avoid circular imports
    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from src.workers.agents.dispatcher import AgentDispatcher

    # Register agent type metadata (not instances)
    # Actual instances are created by the dispatcher with proper dependencies
    for agent_type, metadata in AGENT_METADATA.items():
        dispatcher.register_agent_type(
            agent_type=agent_type,
            metadata=metadata,
        )


def create_release_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DeploymentConfig | None = None,
) -> ReleaseAgent:
    """Factory function to create a Release agent.

    Args:
        llm_client: LLM client for manifest generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        ReleaseAgent: Configured Release agent instance.
    """
    return ReleaseAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DeploymentConfig(),
    )


def create_deployment_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DeploymentConfig | None = None,
) -> DeploymentAgent:
    """Factory function to create a Deployment agent.

    Args:
        llm_client: LLM client for deployment plan generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        DeploymentAgent: Configured Deployment agent instance.
    """
    return DeploymentAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DeploymentConfig(),
    )


def create_monitor_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DeploymentConfig | None = None,
) -> MonitorAgent:
    """Factory function to create a Monitor agent.

    Args:
        llm_client: LLM client for monitoring config generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        MonitorAgent: Configured Monitor agent instance.
    """
    return MonitorAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DeploymentConfig(),
    )


def create_validation_deployment_coordinator(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    test_runner: "TestRunner",
    validation_config: "ValidationConfig | None" = None,
    deployment_config: DeploymentConfig | None = None,
    rlm_integration: "RLMIntegration | None" = None,
    hitl_dispatcher: "HITLDispatcher | None" = None,
) -> ValidationDeploymentCoordinator:
    """Factory function to create a ValidationDeploymentCoordinator.

    Args:
        llm_client: LLM client for all agents.
        artifact_writer: Writer for artifacts.
        test_runner: Test runner for validation agent.
        validation_config: Optional validation configuration.
        deployment_config: Optional deployment configuration.
        rlm_integration: Optional RLM integration.
        hitl_dispatcher: Optional HITL dispatcher.

    Returns:
        ValidationDeploymentCoordinator: Configured coordinator instance.
    """
    # Import ValidationConfig here to avoid circular imports at module level
    from src.workers.agents.validation.config import ValidationConfig

    return ValidationDeploymentCoordinator(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        test_runner=test_runner,
        validation_config=validation_config or ValidationConfig(),
        deployment_config=deployment_config or DeploymentConfig(),
        rlm_integration=rlm_integration,
        hitl_dispatcher=hitl_dispatcher,
    )
