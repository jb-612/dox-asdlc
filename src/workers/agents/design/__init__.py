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
        backend=backend,
        artifact_writer=writer,
        hitl_dispatcher=dispatcher,
        config=DesignConfig(),
    )

    result = await coordinator.run(
        context=agent_context,
        prd_content="Build a user authentication system...",
    )
"""

from typing import TYPE_CHECKING

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
        "capabilities": ["technology_analysis", "context_pack_consumption"],
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


def create_surveyor_agent(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    config: DesignConfig | None = None,
) -> SurveyorAgent:
    """Factory function to create a Surveyor agent.

    Args:
        backend: Agent backend for generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        SurveyorAgent: Configured Surveyor agent instance.
    """
    return SurveyorAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or DesignConfig(),
    )


def create_architect_agent(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    config: DesignConfig | None = None,
) -> ArchitectAgent:
    """Factory function to create an Architect agent.

    Args:
        backend: Agent backend for generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        ArchitectAgent: Configured Architect agent instance.
    """
    return ArchitectAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or DesignConfig(),
    )


def create_planner_agent(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    config: DesignConfig | None = None,
) -> PlannerAgent:
    """Factory function to create a Planner agent.

    Args:
        backend: Agent backend for generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        PlannerAgent: Configured Planner agent instance.
    """
    return PlannerAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or DesignConfig(),
    )


def create_design_coordinator(
    backend: "AgentBackend",
    artifact_writer: "ArtifactWriter",
    hitl_dispatcher: "HITLDispatcher | None" = None,
    config: DesignConfig | None = None,
) -> DesignCoordinator:
    """Factory function to create a Design coordinator.

    Args:
        backend: Agent backend for generation.
        artifact_writer: Writer for artifacts.
        hitl_dispatcher: Optional HITL dispatcher.
        config: Optional configuration.

    Returns:
        DesignCoordinator: Configured coordinator instance.
    """
    return DesignCoordinator(
        backend=backend,
        artifact_writer=artifact_writer,
        hitl_dispatcher=hitl_dispatcher,
        config=config or DesignConfig(),
    )
