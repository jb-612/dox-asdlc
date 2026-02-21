"""ValidationAgent for E2E testing and validation report generation.

Delegates validation analysis to a pluggable AgentBackend (Claude Code CLI,
Codex CLI, or direct LLM API calls). Runs E2E tests via TestRunner, then
uses the backend to generate a validation report against acceptance criteria.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.development.models import TestRunResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    CheckCategory,
    ValidationCheck,
    ValidationReport,
)

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.agents.development.test_runner import TestRunner

logger = logging.getLogger(__name__)


class ValidationAgentError(Exception):
    """Raised when ValidationAgent operations fail."""

    pass


# JSON Schema for structured output validation (CLI backends)
VALIDATION_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "checks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["functional", "performance", "compatibility"],
                    },
                    "passed": {"type": "boolean"},
                    "details": {"type": "string"},
                    "evidence": {"type": ["string", "null"]},
                },
                "required": ["name", "category", "passed", "details"],
            },
        },
        "recommendations": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["checks", "recommendations"],
}

# System prompt for the validation backend
VALIDATION_SYSTEM_PROMPT = (
    "You are a validation analyst reviewing implementations against "
    "acceptance criteria and E2E test results. Analyze the provided "
    "implementation, acceptance criteria, and test results. Identify "
    "any gaps in coverage, integration issues, performance concerns, "
    "and compatibility problems. Respond with structured JSON containing "
    "validation checks and recommendations."
)


class ValidationAgent:
    """Agent that runs E2E tests and generates validation reports.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Delegates the validation analysis to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = ValidationAgent(
            backend=backend,
            artifact_writer=writer,
            test_runner=runner,
            config=ValidationConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        test_runner: TestRunner,
        config: ValidationConfig,
    ) -> None:
        """Initialize the ValidationAgent.

        Args:
            backend: Agent backend for validation analysis.
            artifact_writer: Writer for persisting artifacts.
            test_runner: Test runner for executing E2E tests.
            config: Validation configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._test_runner = test_runner
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "validation_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute validation for implementation code.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - implementation: The implementation to validate (required)
                - acceptance_criteria: List of acceptance criteria (required)
                - test_path: Path to E2E tests (optional, uses default)
                - feature_id: Feature identifier for the report

        Returns:
            AgentResult: Result with validation report artifacts on success.
        """
        logger.info(
            f"ValidationAgent starting for task {context.task_id} "
            f"(backend={self._backend.backend_name})"
        )

        try:
            # Validate required inputs
            implementation = event_metadata.get("implementation")
            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No implementation provided in event_metadata",
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

            # Extract optional metadata
            test_path = event_metadata.get("test_path", "tests/e2e")
            feature_id = event_metadata.get("feature_id", context.task_id)

            # Run E2E tests
            e2e_results = await self._run_e2e_tests(
                test_path=test_path,
                context=context,
            )

            # Generate validation report using backend
            validation_report = await self._generate_validation_report(
                implementation=implementation,
                acceptance_criteria=acceptance_criteria,
                e2e_results=e2e_results,
                feature_id=feature_id,
                context=context,
            )

            if not validation_report:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate validation report",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, validation_report)

            # Determine success based on validation result
            success = validation_report.passed

            logger.info(
                f"ValidationAgent completed for task {context.task_id}, "
                f"passed: {success}, checks: {len(validation_report.checks)}"
            )

            metadata: dict[str, Any] = {
                "validation_report": validation_report.to_dict(),
                "backend": self._backend.backend_name,
            }

            # Set next agent if validation passed
            if success:
                metadata["next_agent"] = "security_agent"
            else:
                metadata["next_agent"] = None

            return AgentResult(
                success=success,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata=metadata,
            )

        except Exception as e:
            logger.error(f"ValidationAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _run_e2e_tests(
        self,
        test_path: str,
        context: AgentContext,
    ) -> TestRunResult:
        """Run E2E tests using the test runner.

        Args:
            test_path: Path to E2E tests.
            context: Agent context.

        Returns:
            TestRunResult: Results of the E2E test run.
        """
        from pathlib import Path

        test_path_obj = Path(context.workspace_path) / test_path

        # Configure timeout from config
        self._test_runner.timeout_seconds = self._config.e2e_test_timeout

        return self._test_runner.run_tests(
            test_path=test_path_obj,
            with_coverage=True,
            suite_id=f"{context.task_id}-e2e",
        )

    async def _generate_validation_report(
        self,
        implementation: dict[str, Any],
        acceptance_criteria: list[str],
        e2e_results: TestRunResult,
        feature_id: str,
        context: AgentContext,
    ) -> ValidationReport | None:
        """Generate validation report using the backend.

        Args:
            implementation: Implementation being validated.
            acceptance_criteria: Acceptance criteria to validate.
            e2e_results: E2E test results.
            feature_id: Feature identifier.
            context: Agent context.

        Returns:
            ValidationReport | None: Generated report or None if failed.
        """
        # Build prompt for validation analysis
        prompt = self._format_validation_prompt(
            implementation=implementation,
            acceptance_criteria=acceptance_criteria,
            e2e_results=e2e_results,
        )

        # Configure the backend
        backend_config = BackendConfig(
            model=self._config.validation_model,
            output_schema=VALIDATION_OUTPUT_SCHEMA,
            system_prompt=VALIDATION_SYSTEM_PROMPT,
            timeout_seconds=self._config.e2e_test_timeout,
            allowed_tools=["Read", "Glob", "Grep"],
        )

        # Execute via backend
        result = await self._backend.execute(
            prompt=prompt,
            workspace_path=context.workspace_path,
            config=backend_config,
        )

        if not result.success:
            logger.warning(
                f"Backend execution failed: {result.error or 'unknown error'}"
            )
            return None

        # Parse response - prefer structured_output, fall back to text parsing
        analysis_data = None
        if result.structured_output and "checks" in result.structured_output:
            analysis_data = result.structured_output
        else:
            analysis_data = parse_json_from_response(result.output)

        if not analysis_data:
            logger.warning("Invalid validation analysis response - no valid JSON")
            return None

        # Build validation checks
        checks = []
        for check_data in analysis_data.get("checks", []):
            try:
                check = ValidationCheck(
                    name=check_data.get("name", ""),
                    category=CheckCategory(check_data.get("category", "functional")),
                    passed=check_data.get("passed", False),
                    details=check_data.get("details", ""),
                    evidence=check_data.get("evidence"),
                )
                checks.append(check)
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid validation check: {e}")
                continue

        # Determine overall pass/fail
        # All checks must pass AND E2E tests must pass
        all_checks_passed = all(check.passed for check in checks) if checks else True
        e2e_passed = e2e_results.all_passed()
        overall_passed = all_checks_passed and e2e_passed

        return ValidationReport(
            feature_id=feature_id,
            checks=checks,
            e2e_results=e2e_results,
            passed=overall_passed,
            recommendations=analysis_data.get("recommendations", []),
        )

    def _format_validation_prompt(
        self,
        implementation: dict[str, Any],
        acceptance_criteria: list[str],
        e2e_results: TestRunResult,
    ) -> str:
        """Format prompt for validation analysis.

        Args:
            implementation: Implementation being validated.
            acceptance_criteria: Acceptance criteria.
            e2e_results: E2E test results.

        Returns:
            str: Formatted prompt.
        """
        # Summarize implementation files
        impl_summary = ""
        files = implementation.get("files", [])
        for file_info in files[:5]:
            path = file_info.get("path", "unknown")
            content = file_info.get("content", "")
            impl_summary += f"\n### {path}\n```\n{content[:1000]}...\n```\n"

        # Format acceptance criteria
        criteria_list = "\n".join(f"- {c}" for c in acceptance_criteria)

        # Format E2E results
        e2e_summary = f"""
E2E Test Results:
- Passed: {e2e_results.passed}
- Failed: {e2e_results.failed}
- Coverage: {e2e_results.coverage}%

Test Details:
"""
        for result in e2e_results.results[:10]:  # Limit to 10 results
            status = "PASS" if result.passed else "FAIL"
            e2e_summary += f"- {result.test_id}: {status}"
            if result.error:
                e2e_summary += f" - {result.error[:200]}"
            e2e_summary += "\n"

        prompt = f"""Analyze this implementation against the acceptance criteria and E2E test results.

## Implementation
{impl_summary}

## Acceptance Criteria
{criteria_list}

## E2E Test Results
{e2e_summary}

## Output Format

Respond with a JSON object containing:
```json
{{
    "checks": [
        {{
            "name": "Check name",
            "category": "functional|performance|compatibility",
            "passed": true,
            "details": "Detailed description of the check result",
            "evidence": "Reference to evidence file or null"
        }}
    ],
    "recommendations": ["List of recommendations for improvement"]
}}
```

Include checks for:
1. E2E test coverage of acceptance criteria
2. Integration point verification
3. Performance baseline compliance (if applicable)
4. Compatibility requirements (if applicable)
"""

        return prompt

    async def _write_artifacts(
        self,
        context: AgentContext,
        validation_report: ValidationReport,
    ) -> list[str]:
        """Write validation report artifacts.

        Args:
            context: Agent context.
            validation_report: Generated validation report.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = validation_report.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_validation_report.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = validation_report.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_validation_report.md",
        )
        paths.append(markdown_path)

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
