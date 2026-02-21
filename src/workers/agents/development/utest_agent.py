"""UTest Agent for test-first development.

Generates pytest test cases from task descriptions and acceptance criteria,
following TDD principles where tests are written before implementation.

Delegates work to a pluggable AgentBackend (Claude Code CLI, Codex CLI,
or direct LLM API calls).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    TestCase,
    TestSuite,
    TestType,
)
from src.workers.agents.development.prompts.utest_prompts import (
    format_test_generation_prompt,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
UTEST_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "test_cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "test_type": {
                        "type": "string",
                        "enum": ["unit", "integration", "e2e"],
                    },
                    "code": {"type": "string"},
                    "requirement_ref": {"type": "string"},
                },
                "required": ["id", "name", "code"],
            },
        },
        "setup_code": {"type": "string"},
        "teardown_code": {"type": "string"},
        "fixtures": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["test_cases"],
}


def _build_utest_prompt(
    task_description: str,
    acceptance_criteria: list[str],
    existing_context: str | None,
) -> str:
    """Build the prompt for the UTest backend.

    Combines the existing format_test_generation_prompt with JSON output
    format instructions so the backend returns structured data.

    Args:
        task_description: Description of the implementation task.
        acceptance_criteria: List of acceptance criteria to cover.
        existing_context: Optional existing code context.

    Returns:
        Formatted prompt string.
    """
    base_prompt = format_test_generation_prompt(
        task_description=task_description,
        acceptance_criteria=acceptance_criteria,
        context=existing_context,
    )

    json_output_instructions = "\n".join([
        "",
        "## Required JSON Output",
        "",
        "Respond with valid JSON matching this schema:",
        "```json",
        "{",
        '  "test_cases": [',
        "    {",
        '      "id": "TC-001",',
        '      "name": "test_should_do_x_when_y",',
        '      "description": "Describes what the test validates",',
        '      "test_type": "unit",',
        '      "code": "def test_should_do_x_when_y():\\n    assert ...",',
        '      "requirement_ref": "AC-001"',
        "    }",
        "  ],",
        '  "setup_code": "import pytest\\n...",',
        '  "teardown_code": "",',
        '  "fixtures": ["fixture_name"]',
        "}",
        "```",
    ])

    return base_prompt + json_output_instructions


def _parse_test_suite_from_result(result: BackendResult) -> dict[str, Any] | None:
    """Parse test suite data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.

    Args:
        result: Backend execution result.

    Returns:
        Parsed dict containing test_cases, or None if parsing fails.
    """
    # Prefer structured_output from --json-schema backends
    if result.structured_output and "test_cases" in result.structured_output:
        return result.structured_output

    # Fall back to parsing from raw text output
    content = result.output
    if not content:
        return None

    parsed = parse_json_from_response(content)
    if parsed is None or "test_cases" not in parsed:
        return None

    return parsed


class UTestAgentError(Exception):
    """Raised when UTest agent operations fail."""

    pass


class UTestAgent:
    """Agent that generates pytest test cases from acceptance criteria.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Delegates the actual test generation work to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = UTestAgent(
            backend=backend,
            artifact_writer=writer,
            config=DevelopmentConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
    ) -> None:
        """Initialize the UTest agent.

        Args:
            backend: Pluggable agent backend for test generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "utest"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute test generation from acceptance criteria.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - task_description: Description of the implementation task (required)
                - acceptance_criteria: List of acceptance criteria to cover (required)

        Returns:
            AgentResult with artifact paths on success.
        """
        logger.info(
            f"UTest Agent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Validate required inputs
            task_description = event_metadata.get("task_description", "")
            if not task_description:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No task_description provided in event_metadata",
                    should_retry=False,
                )

            acceptance_criteria = event_metadata.get("acceptance_criteria", [])
            if not acceptance_criteria:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No acceptance_criteria provided in event_metadata",
                    should_retry=False,
                )

            # Build context string from context pack if available
            existing_context = self._build_context_string(context)

            # Build prompt
            prompt = _build_utest_prompt(
                task_description=task_description,
                acceptance_criteria=acceptance_criteria,
                existing_context=existing_context,
            )

            # Configure backend
            backend_config = BackendConfig(
                model=self._config.utest_model,
                output_schema=UTEST_OUTPUT_SCHEMA,
                timeout_seconds=300,
                allowed_tools=["Read", "Glob", "Grep"],
            )

            # Execute via backend
            result = await self._backend.execute(
                prompt=prompt,
                workspace_path=context.workspace_path,
                config=backend_config,
            )

            if not result.success:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message=result.error or "Backend execution failed",
                    should_retry=True,
                )

            # Parse test suite from backend output
            test_data = _parse_test_suite_from_result(result)

            if not test_data:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to parse test suite from backend output",
                    should_retry=True,
                )

            # Build domain model from parsed data
            test_suite = self._build_test_suite(test_data, context.task_id)

            if not test_suite:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to build test suite from parsed data",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, test_suite)

            # Calculate criteria coverage
            criteria_coverage = self._calculate_criteria_coverage(
                test_suite, acceptance_criteria
            )

            logger.info(
                f"UTest Agent completed for task {context.task_id}, "
                f"tests: {len(test_suite.test_cases)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata={
                    "test_count": len(test_suite.test_cases),
                    "fixtures": test_suite.fixtures,
                    "criteria_coverage": criteria_coverage,
                    "tdd_phase": "red",  # Tests are designed to fail initially
                    "backend": self._backend.backend_name,
                    "cost_usd": result.cost_usd,
                    "turns": result.turns,
                    "session_id": result.session_id,
                },
            )

        except Exception as e:
            logger.error(f"UTest Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _build_context_string(self, context: AgentContext) -> str | None:
        """Build context string from context pack.

        Args:
            context: Agent context with optional context pack.

        Returns:
            Context string for prompt or None.
        """
        if not context.context_pack:
            return None

        files = context.context_pack.get("files", [])
        if not files:
            return None

        context_parts = []
        for file_info in files[:5]:  # Limit to 5 files to avoid prompt bloat
            path = file_info.get("path", "")
            content = file_info.get("content", "")
            if path and content:
                context_parts.append(f"# File: {path}\n{content}")

        interfaces = context.context_pack.get("interfaces", [])
        if interfaces:
            context_parts.append(f"# Relevant interfaces: {', '.join(interfaces)}")

        return "\n\n".join(context_parts) if context_parts else None

    @staticmethod
    def _build_test_suite(
        test_data: dict[str, Any],
        task_id: str,
    ) -> TestSuite | None:
        """Build a TestSuite domain model from parsed data.

        Args:
            test_data: Parsed dict containing test_cases and optional fields.
            task_id: Task identifier.

        Returns:
            TestSuite or None if no valid test cases could be built.
        """
        test_cases: list[TestCase] = []
        for tc_data in test_data.get("test_cases", []):
            try:
                test_case = TestCase(
                    id=tc_data.get("id", f"TC-{len(test_cases) + 1:03d}"),
                    name=tc_data.get("name", ""),
                    description=tc_data.get("description", ""),
                    test_type=TestType(tc_data.get("test_type", "unit")),
                    code=tc_data.get("code", ""),
                    requirement_ref=tc_data.get("requirement_ref", ""),
                    metadata=tc_data.get("metadata", {}),
                )
                test_cases.append(test_case)
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid test case: {e}")
                continue

        if not test_cases:
            return None

        return TestSuite(
            task_id=task_id,
            test_cases=test_cases,
            setup_code=test_data.get("setup_code", ""),
            teardown_code=test_data.get("teardown_code", ""),
            fixtures=test_data.get("fixtures", []),
        )

    def _calculate_criteria_coverage(
        self,
        test_suite: TestSuite,
        acceptance_criteria: list[str],
    ) -> dict[str, list[str]]:
        """Calculate which tests cover which acceptance criteria.

        Args:
            test_suite: Generated test suite.
            acceptance_criteria: Original acceptance criteria.

        Returns:
            Mapping of criterion to list of test IDs.
        """
        coverage: dict[str, list[str]] = {}

        for i, _criterion in enumerate(acceptance_criteria):
            criterion_id = f"AC-{i + 1:03d}"
            coverage[criterion_id] = []

            for test_case in test_suite.test_cases:
                # Check if test references this criterion
                ref = test_case.requirement_ref.upper()
                if criterion_id in ref or f"AC-{i + 1}" in ref:
                    coverage[criterion_id].append(test_case.id)

        return coverage

    async def _write_artifacts(
        self,
        context: AgentContext,
        test_suite: TestSuite,
    ) -> list[str]:
        """Write test suite artifacts.

        Args:
            context: Agent context.
            test_suite: Generated test suite.

        Returns:
            Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = test_suite.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_tests.json",
        )
        paths.append(json_path)

        # Write Python test file (using TEXT type for .py files)
        python_content = test_suite.to_python_code()
        python_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=python_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"test_{context.task_id}.py",
        )
        paths.append(python_path)

        return paths

    def validate_context(self, context: AgentContext) -> bool:
        """Validate that context is suitable for execution.

        Args:
            context: Agent context to validate.

        Returns:
            True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
