"""Discovery Agents package for aSDLC.

Provides agents for the discovery phase that transform raw user requirements
into structured PRD documents and testable acceptance criteria.

Agents:
    - PRDAgent: Generates structured PRD from raw requirements
    - AcceptanceAgent: Generates Given-When-Then acceptance criteria from PRD

Coordinator:
    - DiscoveryCoordinator: Orchestrates PRD -> Acceptance -> HITL-1 workflow

Example:
    from src.workers.agents.discovery import (
        DiscoveryCoordinator,
        DiscoveryConfig,
        ProjectContext,
    )

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

from src.workers.agents.discovery.config import DiscoveryConfig, ConfigValidationError
from src.workers.agents.discovery.models import (
    Requirement,
    RequirementPriority,
    RequirementType,
    PRDSection,
    PRDDocument,
    AcceptanceCriterion,
    AcceptanceCriteria,
    CoverageEntry,
    DiscoveryResult,
)
from src.workers.agents.discovery.prd_agent import PRDAgent, PRDAgentError
from src.workers.agents.discovery.acceptance_agent import (
    AcceptanceAgent,
    AcceptanceAgentError,
)
from src.workers.agents.discovery.coordinator import (
    DiscoveryCoordinator,
    DiscoveryCoordinatorError,
    ProjectContext,
    run_discovery_workflow,
)

__all__ = [
    # Configuration
    "DiscoveryConfig",
    "ConfigValidationError",
    # Models
    "Requirement",
    "RequirementPriority",
    "RequirementType",
    "PRDSection",
    "PRDDocument",
    "AcceptanceCriterion",
    "AcceptanceCriteria",
    "CoverageEntry",
    "DiscoveryResult",
    # Agents
    "PRDAgent",
    "PRDAgentError",
    "AcceptanceAgent",
    "AcceptanceAgentError",
    # Coordinator
    "DiscoveryCoordinator",
    "DiscoveryCoordinatorError",
    "ProjectContext",
    "run_discovery_workflow",
]

# Agent metadata for registration
AGENT_METADATA = {
    "prd_agent": {
        "class": PRDAgent,
        "description": "Generates structured PRD documents from raw requirements",
        "phase": "discovery",
        "inputs": ["raw_requirements", "project_context"],
        "outputs": ["prd.json", "prd.md"],
        "capabilities": ["requirements_extraction", "prd_generation"],
    },
    "acceptance_agent": {
        "class": AcceptanceAgent,
        "description": "Generates testable acceptance criteria from PRD documents",
        "phase": "discovery",
        "inputs": ["prd_document"],
        "outputs": ["acceptance_criteria.json", "acceptance_criteria.md"],
        "capabilities": ["criteria_generation", "coverage_analysis"],
    },
}


def register_discovery_agents(dispatcher: "AgentDispatcher") -> None:
    """Register discovery agents with the agent dispatcher.

    Note: This function is called from workers/main.py with proper
    dependency injection. The actual instantiation requires dependencies
    (backend, artifact_writer, etc.) that must be provided at runtime.

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


def create_prd_agent(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    config: DiscoveryConfig | None = None,
) -> PRDAgent:
    """Factory function to create a PRD agent.

    Args:
        backend: Agent backend for PRD generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        PRDAgent: Configured PRD agent instance.
    """
    return PRDAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or DiscoveryConfig(),
    )


def create_acceptance_agent(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    config: DiscoveryConfig | None = None,
) -> AcceptanceAgent:
    """Factory function to create an Acceptance agent.

    Args:
        backend: Agent backend for criteria generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        AcceptanceAgent: Configured Acceptance agent instance.
    """
    return AcceptanceAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or DiscoveryConfig(),
    )


def create_discovery_coordinator(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    hitl_dispatcher: "HITLDispatcher | None" = None,
    config: DiscoveryConfig | None = None,
) -> DiscoveryCoordinator:
    """Factory function to create a Discovery coordinator.

    Args:
        backend: Agent backend for generation.
        artifact_writer: Writer for artifacts.
        hitl_dispatcher: Optional HITL dispatcher.
        config: Optional configuration.

    Returns:
        DiscoveryCoordinator: Configured coordinator instance.
    """
    return DiscoveryCoordinator(
        backend=backend,
        artifact_writer=artifact_writer,
        hitl_dispatcher=hitl_dispatcher,
        config=config or DiscoveryConfig(),
    )
