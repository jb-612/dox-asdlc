"""Development Agents package for aSDLC.

Provides agents for the TDD development phase that implement the
test-driven development workflow: write tests, implement code,
debug failures, and review implementations.

Agents:
    - UTestAgent: Writes tests before implementation (TDD red phase)
    - CodingAgent: Implements code to pass tests (TDD green phase)
    - DebuggerAgent: Analyzes and fixes persistent failures
    - ReviewerAgent: Reviews code for quality and security

Orchestrator:
    - TDDOrchestrator: Coordinates the full TDD loop with retry and escalation

Example:
    from src.workers.agents.development import (
        TDDOrchestrator,
        DevelopmentConfig,
        create_utest_agent,
        create_coding_agent,
    )

    # Create agents
    utest = create_utest_agent(llm_client=client, artifact_writer=writer)
    coding = create_coding_agent(llm_client=client, artifact_writer=writer)
    debugger = create_debugger_agent(llm_client=client, artifact_writer=writer)
    reviewer = create_reviewer_agent(llm_client=client, artifact_writer=writer)

    # Create orchestrator
    orchestrator = create_tdd_orchestrator(
        utest_agent=utest,
        coding_agent=coding,
        debugger_agent=debugger,
        reviewer_agent=reviewer,
        test_runner=TestRunner(),
        config=DevelopmentConfig(),
    )

    # Run TDD loop
    result = await orchestrator.run_tdd_loop(
        context=context,
        task_description="Implement feature X",
        acceptance_criteria=["Should do Y", "Should handle Z"],
    )
"""

from src.workers.agents.development.config import DevelopmentConfig, ConfigValidationError
from src.workers.agents.development.models import (
    TestType,
    TestCase,
    TestSuite,
    CodeFile,
    Implementation,
    TestResult,
    TestRunResult,
    IssueSeverity,
    ReviewIssue,
    CodeReview,
    CodeChange,
    DebugAnalysis,
    DevelopmentResult,
)
from src.workers.agents.development.utest_agent import UTestAgent, UTestAgentError
from src.workers.agents.development.coding_agent import CodingAgent, CodingAgentError
from src.workers.agents.development.debugger_agent import DebuggerAgent, DebuggerAgentError
from src.workers.agents.development.reviewer_agent import ReviewerAgent, ReviewerAgentError
from src.workers.agents.development.tdd_orchestrator import (
    TDDOrchestrator,
    TDDOrchestratorError,
)
from src.workers.agents.development.test_runner import (
    TestRunner,
    TestRunnerError,
    TestTimeoutError,
)

__all__ = [
    # Configuration
    "DevelopmentConfig",
    "ConfigValidationError",
    # Models - Test
    "TestType",
    "TestCase",
    "TestSuite",
    # Models - Implementation
    "CodeFile",
    "Implementation",
    # Models - Test Results
    "TestResult",
    "TestRunResult",
    # Models - Review
    "IssueSeverity",
    "ReviewIssue",
    "CodeReview",
    # Models - Debug
    "CodeChange",
    "DebugAnalysis",
    # Models - Result
    "DevelopmentResult",
    # Agents
    "UTestAgent",
    "UTestAgentError",
    "CodingAgent",
    "CodingAgentError",
    "DebuggerAgent",
    "DebuggerAgentError",
    "ReviewerAgent",
    "ReviewerAgentError",
    # Orchestrator
    "TDDOrchestrator",
    "TDDOrchestratorError",
    # Test Runner
    "TestRunner",
    "TestRunnerError",
    "TestTimeoutError",
    # Metadata and Registration
    "AGENT_METADATA",
    "register_development_agents",
    # Factory Functions
    "create_utest_agent",
    "create_coding_agent",
    "create_debugger_agent",
    "create_reviewer_agent",
    "create_tdd_orchestrator",
]

# Agent metadata for registration
AGENT_METADATA = {
    "utest_agent": {
        "class": UTestAgent,
        "description": "Writes pytest test cases from acceptance criteria (TDD red phase)",
        "phase": "development",
        "inputs": ["task_description", "acceptance_criteria"],
        "outputs": ["test_suite.json", "test_file.py"],
        "capabilities": ["test_generation", "criteria_coverage"],
    },
    "coding_agent": {
        "class": CodingAgent,
        "description": "Generates implementation code to pass tests (TDD green phase)",
        "phase": "development",
        "inputs": ["task_description", "test_code"],
        "outputs": ["implementation.json", "source_files"],
        "capabilities": ["implementation", "rlm_exploration", "retry_handling"],
    },
    "debugger_agent": {
        "class": DebuggerAgent,
        "description": "Analyzes test failures and generates fix suggestions using RLM",
        "phase": "development",
        "inputs": ["test_output", "implementation"],
        "outputs": ["debug_analysis.json", "debug_analysis.md"],
        "capabilities": ["failure_analysis", "root_cause_detection", "rlm_exploration"],
    },
    "reviewer_agent": {
        "class": ReviewerAgent,
        "description": "Reviews implementation code for quality, security, and style",
        "phase": "development",
        "inputs": ["implementation", "test_suite", "test_results"],
        "outputs": ["review.json", "review.md"],
        "capabilities": ["quality_review", "security_scan", "style_check"],
    },
}


def register_development_agents(dispatcher: "AgentDispatcher") -> None:
    """Register development agents with the agent dispatcher.

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


def create_utest_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DevelopmentConfig | None = None,
) -> UTestAgent:
    """Factory function to create a UTest agent.

    Args:
        llm_client: LLM client for test generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        UTestAgent: Configured UTest agent instance.
    """
    return UTestAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DevelopmentConfig(),
    )


def create_coding_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DevelopmentConfig | None = None,
    rlm_integration: "RLMIntegration | None" = None,
) -> CodingAgent:
    """Factory function to create a Coding agent.

    Args:
        llm_client: LLM client for code generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.
        rlm_integration: Optional RLM integration for complex tasks.

    Returns:
        CodingAgent: Configured Coding agent instance.
    """
    return CodingAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DevelopmentConfig(),
        rlm_integration=rlm_integration,
    )


def create_debugger_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DevelopmentConfig | None = None,
    rlm_integration: "RLMIntegration | None" = None,
) -> DebuggerAgent:
    """Factory function to create a Debugger agent.

    Args:
        llm_client: LLM client for analysis.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.
        rlm_integration: Optional RLM integration for codebase exploration.

    Returns:
        DebuggerAgent: Configured Debugger agent instance.
    """
    return DebuggerAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DevelopmentConfig(),
        rlm_integration=rlm_integration,
    )


def create_reviewer_agent(
    llm_client: "LLMClient",
    artifact_writer: "ArtifactWriter",
    config: DevelopmentConfig | None = None,
) -> ReviewerAgent:
    """Factory function to create a Reviewer agent.

    Args:
        llm_client: LLM client for review generation.
        artifact_writer: Writer for artifacts.
        config: Optional configuration.

    Returns:
        ReviewerAgent: Configured Reviewer agent instance.
    """
    return ReviewerAgent(
        llm_client=llm_client,
        artifact_writer=artifact_writer,
        config=config or DevelopmentConfig(),
    )


def create_tdd_orchestrator(
    utest_agent: "UTestAgent",
    coding_agent: "CodingAgent",
    debugger_agent: "DebuggerAgent",
    reviewer_agent: "ReviewerAgent",
    test_runner: "TestRunner",
    config: DevelopmentConfig | None = None,
    hitl_dispatcher: "HITLDispatcher | None" = None,
) -> TDDOrchestrator:
    """Factory function to create a TDD orchestrator.

    Args:
        utest_agent: Agent for generating test cases.
        coding_agent: Agent for generating implementation.
        debugger_agent: Agent for debugging failures.
        reviewer_agent: Agent for reviewing code.
        test_runner: Utility for running tests.
        config: Optional development configuration.
        hitl_dispatcher: Optional HITL dispatcher for gate submissions.

    Returns:
        TDDOrchestrator: Configured TDD orchestrator instance.
    """
    return TDDOrchestrator(
        utest_agent=utest_agent,
        coding_agent=coding_agent,
        debugger_agent=debugger_agent,
        reviewer_agent=reviewer_agent,
        test_runner=test_runner,
        config=config or DevelopmentConfig(),
        hitl_dispatcher=hitl_dispatcher,
    )
