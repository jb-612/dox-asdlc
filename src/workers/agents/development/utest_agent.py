"""UTest Agent for test-first development.

Generates pytest test cases from task descriptions and acceptance criteria,
following TDD principles where tests are written before implementation.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

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
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


class UTestAgentError(Exception):
    """Raised when UTest agent operations fail."""

    pass


class UTestAgent:
    """Agent that generates pytest test cases from acceptance criteria.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses LLM to generate comprehensive test cases that will initially fail
    (TDD red phase), covering all acceptance criteria.

    Example:
        agent = UTestAgent(
            llm_client=client,
            artifact_writer=writer,
            config=DevelopmentConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
    ) -> None:
        """Initialize the UTest agent.

        Args:
            llm_client: LLM client for test generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._llm_client = llm_client
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
                - existing_context: Optional existing code context

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(f"UTest Agent starting for task {context.task_id}")

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

            # Generate test cases using LLM
            test_suite = await self._generate_test_suite(
                task_description=task_description,
                acceptance_criteria=acceptance_criteria,
                existing_context=existing_context,
                task_id=context.task_id,
            )

            if not test_suite:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate test suite from acceptance criteria",
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
            str | None: Context string for prompt or None.
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

    async def _generate_test_suite(
        self,
        task_description: str,
        acceptance_criteria: list[str],
        existing_context: str | None,
        task_id: str,
    ) -> TestSuite | None:
        """Generate test suite from acceptance criteria.

        Args:
            task_description: Description of the task.
            acceptance_criteria: List of acceptance criteria.
            existing_context: Optional existing code context.
            task_id: Task identifier.

        Returns:
            TestSuite | None: Generated test suite or None if failed.
        """
        prompt = format_test_generation_prompt(
            task_description=task_description,
            acceptance_criteria=acceptance_criteria,
            context=existing_context,
        )

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse response
            test_data = self._parse_json_from_response(response.content)

            if not test_data or "test_cases" not in test_data:
                logger.warning("Invalid test generation response - no test_cases found")
                return None

            # Build test cases
            test_cases = []
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

        except Exception as e:
            logger.error(f"Test generation failed: {e}")
            raise  # Re-raise to let caller handle and report the error

    def _parse_json_from_response(self, content: str) -> dict[str, Any] | None:
        """Parse JSON from LLM response, handling code blocks.

        Args:
            content: Raw LLM response content.

        Returns:
            dict | None: Parsed JSON or None if parsing fails.
        """
        # Try direct JSON parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from code blocks
        patterns = [
            r'```json\s*\n?(.*?)\n?```',
            r'```\s*\n?(.*?)\n?```',
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except json.JSONDecodeError:
                    continue

        # Try finding JSON-like content
        json_start = content.find('{')
        json_end = content.rfind('}')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            try:
                return json.loads(content[json_start:json_end + 1])
            except json.JSONDecodeError:
                pass

        return None

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
            dict: Mapping of criterion to list of test IDs.
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
            list[str]: Paths to written artifacts.
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
            bool: True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
