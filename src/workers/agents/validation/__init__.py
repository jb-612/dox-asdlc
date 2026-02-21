"""Validation Agents package for aSDLC.

Provides agents for the validation phase that run E2E tests, perform
security scanning, and verify compliance requirements.

Agents:
    - ValidationAgent: Runs E2E tests and validates implementations
    - SecurityAgent: Scans for vulnerabilities and checks compliance

Example:
    from src.workers.agents.validation import (
        ValidationAgent,
        SecurityAgent,
        ValidationConfig,
        create_validation_agent,
        create_security_agent,
    )

    # Create agents
    validation = create_validation_agent(
        backend=backend,
        artifact_writer=writer,
        test_runner=runner,
    )

    security = create_security_agent(
        backend=backend,
        artifact_writer=writer,
    )

    # Execute validation
    result = await validation.execute(context, event_metadata)
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.agents.development.test_runner import TestRunner

from src.workers.agents.validation.config import (
    ValidationConfig,
    ConfigValidationError,
)
from src.workers.agents.validation.models import (
    CheckCategory,
    Severity,
    SecurityCategory,
    ValidationCheck,
    ValidationReport,
    SecurityFinding,
    SecurityReport,
)
from src.workers.agents.validation.validation_agent import (
    ValidationAgent,
    ValidationAgentError,
)
from src.workers.agents.validation.security_agent import (
    SecurityAgent,
    SecurityAgentError,
)

__all__ = [
    # Config
    "ValidationConfig",
    "ConfigValidationError",
    # Models
    "CheckCategory",
    "Severity",
    "SecurityCategory",
    "ValidationCheck",
    "ValidationReport",
    "SecurityFinding",
    "SecurityReport",
    # Agents
    "ValidationAgent",
    "ValidationAgentError",
    "SecurityAgent",
    "SecurityAgentError",
    # Metadata and Registration
    "AGENT_METADATA",
    "register_validation_agents",
    # Factory Functions
    "create_validation_agent",
    "create_security_agent",
]

# Agent metadata for registration
AGENT_METADATA = {
    "validation_agent": {
        "class": ValidationAgent,
        "description": "Runs E2E tests and validates implementations against acceptance criteria",
        "phase": "validation",
        "inputs": ["implementation", "acceptance_criteria", "feature_id"],
        "outputs": ["validation_report.json", "validation_report.md"],
        "capabilities": ["e2e_testing", "integration_validation"],
    },
    "security_agent": {
        "class": SecurityAgent,
        "description": "Scans for security vulnerabilities and checks compliance requirements",
        "phase": "validation",
        "inputs": ["implementation", "feature_id", "compliance_frameworks"],
        "outputs": ["security_report.json", "security_report.md"],
        "capabilities": ["vulnerability_scanning", "secrets_detection", "compliance_checking", "owasp_patterns"],
    },
}


def register_validation_agents(dispatcher: "AgentDispatcher") -> None:
    """Register validation agents with the agent dispatcher.

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


def create_validation_agent(
    backend: AgentBackend,
    artifact_writer: ArtifactWriter,
    test_runner: TestRunner,
    config: ValidationConfig | None = None,
) -> ValidationAgent:
    """Factory function to create a Validation agent.

    Args:
        backend: Agent backend for validation analysis.
        artifact_writer: Writer for artifacts.
        test_runner: Test runner for E2E tests.
        config: Optional configuration.

    Returns:
        ValidationAgent: Configured Validation agent instance.
    """
    return ValidationAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        test_runner=test_runner,
        config=config or ValidationConfig(),
    )


def create_security_agent(
    backend: AgentBackend,
    artifact_writer: ArtifactWriter,
    config: ValidationConfig | None = None,
) -> SecurityAgent:
    """Factory function to create a Security agent.

    Args:
        backend: Agent backend for compliance analysis.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        SecurityAgent: Configured Security agent instance.
    """
    return SecurityAgent(
        backend=backend,
        artifact_writer=artifact_writer,
        config=config or ValidationConfig(),
    )
