"""Debugger Agent for test failure analysis and fix generation.

Analyzes test failures using an AgentBackend to understand codebase context,
identifies root causes, and generates actionable code changes to fix issues.
CLI backends (like Claude Code) handle the multi-step analysis natively
with their agentic loop.
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Any

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeChange,
    DebugAnalysis,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Output schema for structured JSON validation
# ---------------------------------------------------------------------------

DEBUGGER_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "failure_id": {"type": "string"},
        "root_cause": {"type": "string"},
        "fix_suggestion": {"type": "string"},
        "code_changes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string"},
                    "original_code": {"type": "string"},
                    "new_code": {"type": "string"},
                    "description": {"type": "string"},
                    "line_start": {"type": "integer"},
                    "line_end": {"type": "integer"},
                },
                "required": ["file_path", "new_code", "description"],
            },
        },
    },
    "required": ["root_cause", "fix_suggestion", "code_changes"],
}


# ---------------------------------------------------------------------------
# System prompt derived from debugger_prompts.py prompt constants
# ---------------------------------------------------------------------------

DEBUGGER_SYSTEM_PROMPT = (
    "You are an expert debugger specializing in test failure analysis.\n"
    "\n"
    "Your task is to:\n"
    "1. Examine test output and implementation to identify failing tests\n"
    "2. Perform root cause analysis by looking beyond symptoms\n"
    "3. Generate specific, minimal code changes to fix the issues\n"
    "\n"
    "Analysis Guidelines:\n"
    "- Read error messages and stack traces carefully\n"
    "- Compare expected vs actual values\n"
    "- Trace data flow through the implementation\n"
    "- Look for common root causes: logic errors, type mismatches,\n"
    "  missing initialization, off-by-one errors, race conditions\n"
    "\n"
    "Fix Guidelines:\n"
    "- Minimal changes only -- fix what is needed, nothing more\n"
    "- Ensure fixes do not break other functionality\n"
    "- Fixes must make the failing tests pass\n"
    "- Follow existing code quality standards\n"
)


# ---------------------------------------------------------------------------
# Module-level helper functions
# ---------------------------------------------------------------------------


def _build_debug_prompt(
    test_output: str,
    implementation: str,
    stack_trace: str | None = None,
    test_code: str | None = None,
    context_hints: list[str] | None = None,
) -> str:
    """Build comprehensive debug analysis prompt.

    Combines failure analysis, root cause identification, and fix suggestion
    into a single prompt for the backend to handle in one execution.

    Args:
        test_output: Test runner output showing failures.
        implementation: The source code being tested.
        stack_trace: Optional detailed stack trace.
        test_code: Optional test source code for context.
        context_hints: Optional list of hints from context pack.

    Returns:
        str: Combined prompt for the backend.
    """
    sections = [
        "Analyze the following test failures, identify the root cause,",
        "and generate specific code changes to fix the issues.",
        "",
        "## Test Output",
        "",
        "```",
        test_output,
        "```",
        "",
        "## Implementation Being Tested",
        "",
        "```python",
        implementation,
        "```",
    ]

    if stack_trace:
        sections.extend([
            "",
            "## Stack Trace",
            "",
            "```",
            stack_trace,
            "```",
        ])

    if test_code:
        sections.extend([
            "",
            "## Test Code",
            "",
            "```python",
            test_code,
            "```",
        ])

    if context_hints:
        sections.extend(["", "## Context Hints", ""])
        sections.extend(f"- {hint}" for hint in context_hints)

    sections.extend([
        "",
        "## Required Output Format",
        "",
        "Respond with a JSON object containing:",
        "```json",
        "{",
        '    "failure_id": "unique-failure-id",',
        '    "root_cause": "Clear description of the root cause",',
        '    "fix_suggestion": "Description of how to fix the issue",',
        '    "code_changes": [',
        "        {",
        '            "file_path": "path/to/file.py",',
        '            "original_code": "original code to replace",',
        '            "new_code": "new code to insert",',
        '            "description": "what this change does",',
        '            "line_start": 1,',
        '            "line_end": 5',
        "        }",
        "    ]",
        "}",
        "```",
    ])

    return "\n".join(sections)


def _parse_debug_from_result(
    result: BackendResult,
    task_id: str,
) -> DebugAnalysis | None:
    """Parse a BackendResult into a DebugAnalysis domain object.

    Prefers ``structured_output`` when the backend provides it (e.g. via
    ``--json-schema`` validation). Falls back to extracting JSON from the
    raw ``output`` text.

    Args:
        result: The result from backend execution.
        task_id: Task identifier used as fallback failure_id.

    Returns:
        DebugAnalysis or None if parsing fails.
    """
    # Prefer structured_output if the backend provided it
    analysis_data = result.structured_output
    if not analysis_data:
        analysis_data = parse_json_from_response(result.output)

    if not analysis_data:
        logger.warning("Invalid debug analysis response -- no valid JSON found")
        return None

    # Build code changes
    code_changes: list[CodeChange] = []
    for change_data in analysis_data.get("code_changes", []):
        try:
            code_change = CodeChange(
                file_path=change_data.get("file_path", ""),
                original_code=change_data.get("original_code", ""),
                new_code=change_data.get("new_code", ""),
                description=change_data.get("description", ""),
                line_start=change_data.get("line_start", 0),
                line_end=change_data.get("line_end", 0),
            )
            code_changes.append(code_change)
        except (ValueError, KeyError) as e:
            logger.warning(f"Skipping invalid code change: {e}")
            continue

    return DebugAnalysis(
        failure_id=analysis_data.get("failure_id", f"{task_id}-failure"),
        root_cause=analysis_data.get("root_cause", ""),
        fix_suggestion=analysis_data.get("fix_suggestion", ""),
        code_changes=code_changes,
    )


class DebuggerAgentError(Exception):
    """Raised when Debugger agent operations fail."""

    pass


class DebuggerAgent:
    """Agent that analyzes test failures and generates fix suggestions.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses an AgentBackend (CLI or LLM API) to perform failure analysis,
    root cause identification, and fix generation in a single execution.

    Example:
        agent = DebuggerAgent(
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
        """Initialize the Debugger agent.

        Args:
            backend: AgentBackend for execution (CLI or LLM API).
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "debugger"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute debug analysis for test failures.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - test_output: Test output including failures (required)
                - implementation: The implementation code being tested (required)
                - stack_trace: Optional detailed stack trace
                - test_code: Optional test code for context

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(f"Debugger Agent starting for task {context.task_id}")

        try:
            # Validate required inputs
            test_output = event_metadata.get("test_output", "")
            if not test_output:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No test_output provided in event_metadata",
                    should_retry=False,
                )

            implementation = event_metadata.get("implementation", "")
            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No implementation provided in event_metadata",
                    should_retry=False,
                )

            # Extract optional context
            stack_trace = event_metadata.get("stack_trace")
            test_code = event_metadata.get("test_code")

            # Build context hints from context pack
            context_hints = self._build_context_hints(context)

            # Build combined prompt
            prompt = _build_debug_prompt(
                test_output=test_output,
                implementation=implementation,
                stack_trace=stack_trace,
                test_code=test_code,
                context_hints=context_hints if context_hints else None,
            )

            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.debugger_model,
                output_schema=DEBUGGER_OUTPUT_SCHEMA,
                timeout_seconds=self._config.test_timeout_seconds,
                allowed_tools=["Read", "Glob", "Grep"],
                system_prompt=DEBUGGER_SYSTEM_PROMPT,
            )

            # Single backend execution replaces the 3 sequential LLM calls
            backend_result = await self._backend.execute(
                prompt=prompt,
                workspace_path=context.workspace_path,
                config=backend_config,
            )

            if not backend_result.success:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message=(
                        backend_result.error
                        or "Backend execution failed"
                    ),
                    should_retry=True,
                )

            # Parse the result into a domain object
            debug_analysis = _parse_debug_from_result(
                backend_result, context.task_id,
            )

            if not debug_analysis:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate debug analysis from test failures",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, debug_analysis)

            logger.info(
                f"Debugger Agent completed for task {context.task_id}, "
                f"changes: {len(debug_analysis.code_changes)}"
            )

            metadata: dict[str, Any] = {
                "root_cause": debug_analysis.root_cause,
                "fix_suggestion": debug_analysis.fix_suggestion,
                "code_changes": [c.to_dict() for c in debug_analysis.code_changes],
                "backend": self._backend.backend_name,
            }

            if backend_result.cost_usd is not None:
                metadata["cost_usd"] = backend_result.cost_usd

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata=metadata,
            )

        except Exception as e:
            logger.error(f"Debugger Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _build_context_hints(self, context: AgentContext) -> list[str]:
        """Build context hints from context pack.

        Args:
            context: Agent context with optional context pack.

        Returns:
            list[str]: Context hints for prompt building.
        """
        hints: list[str] = []

        if not context.context_pack:
            return hints

        files = context.context_pack.get("files", [])
        for file_info in files[:5]:  # Limit to 5 files
            path = file_info.get("path", "")
            if path:
                hints.append(f"Related file: {path}")

        interfaces = context.context_pack.get("interfaces", [])
        if interfaces:
            hints.append(f"Relevant interfaces: {', '.join(interfaces)}")

        return hints

    def _extract_test_expectations(self, test_code: str) -> list[str]:
        """Extract test expectations from test code.

        Args:
            test_code: Test code to analyze.

        Returns:
            list[str]: List of test expectations.
        """
        expectations: list[str] = []

        # Extract assert statements
        assert_pattern = r'assert\s+(.+?)(?:\s*,\s*["\'](.+?)["\'])?$'
        for line in test_code.split("\n"):
            line = line.strip()
            match = re.match(assert_pattern, line)
            if match:
                expectation = match.group(1)
                message = match.group(2)
                if message:
                    expectations.append(f"{expectation}: {message}")
                else:
                    expectations.append(expectation)

        return expectations

    async def _write_artifacts(
        self,
        context: AgentContext,
        debug_analysis: DebugAnalysis,
    ) -> list[str]:
        """Write debug analysis artifacts.

        Args:
            context: Agent context.
            debug_analysis: Generated debug analysis.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths: list[str] = []

        # Write JSON artifact (structured data)
        json_content = debug_analysis.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_debug_analysis.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = debug_analysis.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_debug_analysis.md",
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
