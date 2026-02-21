"""Design Agents package for aSDLC.

Provides agents for the design phase that transform PRD documents
into technical designs, architectures, and implementation plans.

Agents:
    - SurveyorAgent: Analyzes PRD for technology needs and generates tech survey
    - ArchitectAgent: Designs component architecture with Mermaid diagrams
    - PlannerAgent: Breaks architecture into implementation tasks

Coordinator:
    - DesignCoordinator: Orchestrates Surveyor → Architect → Planner workflow

Example:
    from src.workers.agents.design import (
        DesignCoordinator,
        DesignConfig,
    )

    coordinator = DesignCoordinator(
        llm_client=client,
        artifact_writer=writer,
        hitl_dispatcher=dispatcher,
        config=DesignConfig(),
    )

    result = await coordinator.run(
        context=agent_context,
        prd_content="Build a user authentication system...",
    )
"""

from src.workers.agents.design.config import DesignConfig, ConfigValidationError
from src.workers.agents.design.models import (
    TechnologyChoice,
    TechSurvey,
    Risk,
    RiskLevel,
    Component,
    Interface,
    DataFlow,
    DiagramReference,
    DiagramType,
    Architecture,
    ArchitectureStyle,
    ImplementationTask,
    Phase,
    ComplexityLevel,
    ImplementationPlan,
    DesignResult,
)
from src.workers.agents.design.surveyor_agent import SurveyorAgent, SurveyorAgentError
from src.workers.agents.design.architect_agent import ArchitectAgent, ArchitectAgentError
from src.workers.agents.design.planner_agent import PlannerAgent
from src.workers.agents.design.coordinator import (
    DesignCoordinator,
    DesignCoordinatorError,
    EvidenceBundle,
)

__all__ = [
    # Configuration
    "DesignConfig",
    "ConfigValidationError",
    # Tech Survey Models
    "TechnologyChoice",
    "TechSurvey",
    "Risk",
    "RiskLevel",
    # Architecture Models
    "Component",
    "Interface",
    "DataFlow",
    "DiagramReference",
    "DiagramType",
    "Architecture",
    "ArchitectureStyle",
    # Implementation Plan Models
    "ImplementationTask",
    "Phase",
    "ComplexityLevel",
    "ImplementationPlan",
    # Result
    "DesignResult",
    # Agents
    "SurveyorAgent",
    "SurveyorAgentError",
    "ArchitectAgent",
    "ArchitectAgentError",
    "PlannerAgent",
    # Coordinator
    "DesignCoordinator",
    "DesignCoordinatorError",
    "EvidenceBundle",
]

# Agent metadata for registration
AGENT_METADATA = {
    "surveyor_agent": {
        "class": SurveyorAgent,
        "description": "Analyzes PRD for technology needs and generates tech survey",
        "phase": "design",
        "inputs": ["prd_content", "prd_reference"],
        "outputs": ["tech_survey.json", "tech_survey.md"],
        "capabilities": ["technology_analysis", "rlm_research", "context_pack_consumption"],
    },
    "architect_agent": {
        "class": ArchitectAgent,
        "description": "Designs component architecture with Mermaid diagrams",
        "phase": "design",
        "inputs": ["tech_survey", "prd_content", "nfr_requirements"],
        "outputs": ["architecture.json", "architecture.md"],
        "capabilities": ["component_design", "diagram_generation", "nfr_validation"],
    },
    "planner_agent": {
        "class": PlannerAgent,
        "description": "Breaks architecture into implementation tasks",
        "phase": "design",
        "inputs": ["architecture", "prd_content", "acceptance_criteria"],
        "outputs": ["implementation_plan.json", "implementation_plan.md"],
        "capabilities": ["task_breakdown", "dependency_analysis", "critical_path"],
    },
}


def register_design_agents(dispatcher: "AgentDispatcher") -> None:
    """Register design agents with the agent dispatcher.

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


def create_surveyor_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DesignConfig | None = None,
    rlm_integration: "RLMIntegration | None" = None,
    repo_mapper: "RepoMapper | None" = None,
) -> SurveyorAgent:
    """Factory function to create a Surveyor agent.

    Args:
        llm_client: LLM client for generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.
        rlm_integration: Optional RLM integration for deep research.
        repo_mapper: Optional RepoMapper for context pack.

    Returns:
        SurveyorAgent: Configured Surveyor agent instance.
    """
    return SurveyorAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DesignConfig(),
        rlm_integration=rlm_integration,
        repo_mapper=repo_mapper,
    )


def create_architect_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DesignConfig | None = None,
) -> ArchitectAgent:
    """Factory function to create an Architect agent.

    Args:
        llm_client: LLM client for generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        ArchitectAgent: Configured Architect agent instance.
    """
    return ArchitectAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DesignConfig(),
    )


def create_planner_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DesignConfig | None = None,
    backend: "AgentBackend | None" = None,
) -> PlannerAgent:
    """Factory function to create a Planner agent.

    Args:
        llm_client: LLM client for generation (used if no backend).
        artifact_writer: Writer for artifacts.
        config: Optional configuration.
        backend: Optional AgentBackend. If not provided, wraps
            llm_client in LLMAgentBackend for backward compatibility.

    Returns:
        PlannerAgent: Configured Planner agent instance.
    """
    if backend is None:
        from src.workers.agents.backends.llm_backend import LLMAgentBackend
        backend = LLMAgentBackend(llm_client=llm_client)

    return PlannerAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or DesignConfig(),
    )


def create_design_coordinator(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    hitl_dispatcher: "HITLDispatcher | None" = None,
    config: DesignConfig | None = None,
    rlm_integration: "RLMIntegration | None" = None,
    repo_mapper: "RepoMapper | None" = None,
) -> DesignCoordinator:
    """Factory function to create a Design coordinator.

    Args:
        llm_client: LLM client for generation.
        artifact_writer: Writer for artifacts.
        hitl_dispatcher: Optional HITL dispatcher.
        config: Optional configuration.
        rlm_integration: Optional RLM integration.
        repo_mapper: Optional RepoMapper for context pack.

    Returns:
        DesignCoordinator: Configured coordinator instance.
    """
    return DesignCoordinator(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        hitl_dispatcher=hitl_dispatcher,
        config=config or DesignConfig(),
        rlm_integration=rlm_integration,
        repo_mapper=repo_mapper,
    )
