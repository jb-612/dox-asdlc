"""Debugger Agent for test failure analysis and fix generation.

Analyzes test failures using RLM exploration to understand codebase context,
identifies root causes, and generates actionable code changes to fix issues.
Unlike CodingAgent, DebuggerAgent ALWAYS uses RLM for analysis.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeChange,
    DebugAnalysis,
)
from src.workers.agents.development.prompts.debugger_prompts import (
    format_failure_analysis_prompt,
    format_fix_suggestion_prompt,
    format_root_cause_prompt,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient
    from src.workers.rlm.integration import RLMIntegration

logger = logging.getLogger(__name__)


class DebuggerAgentError(Exception):
    """Raised when Debugger agent operations fail."""

    pass


class DebuggerAgent:
    """Agent that analyzes test failures and generates fix suggestions.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses RLM to explore the codebase for relevant context before analyzing
    failures and generating code changes.

    Unlike CodingAgent which only uses RLM on retries, DebuggerAgent
    ALWAYS uses RLM because deep codebase exploration is essential for
    effective debugging.

    Example:
        agent = DebuggerAgent(
            llm_client=client,
            artifact_writer=writer,
            config=DevelopmentConfig(),
            rlm_integration=rlm,
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        rlm_integration: RLMIntegration | None = None,
    ) -> None:
        """Initialize the Debugger agent.

        Args:
            llm_client: LLM client for analysis.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
            rlm_integration: RLM integration for codebase exploration.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config
        self._rlm_integration = rlm_integration

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

            # ALWAYS use RLM for debugging (unlike CodingAgent)
            used_rlm = True
            rlm_context = ""
            rlm_error = None

            if self._rlm_integration:
                rlm_result = await self._run_rlm_exploration(
                    test_output=test_output,
                    implementation=implementation,
                    context_hints=context_hints,
                    context=context,
                )
                if rlm_result:
                    rlm_context = rlm_result.get("formatted_output", "")
                    if rlm_result.get("error"):
                        rlm_error = rlm_result.get("error")

            # Generate debug analysis using LLM
            debug_analysis = await self._generate_debug_analysis(
                test_output=test_output,
                implementation=implementation,
                stack_trace=stack_trace,
                test_code=test_code,
                rlm_context=rlm_context,
                task_id=context.task_id,
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
                "used_rlm": used_rlm,
            }

            if rlm_error:
                metadata["rlm_error"] = rlm_error

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
            list[str]: Context hints for RLM exploration.
        """
        hints = []

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

    async def _run_rlm_exploration(
        self,
        test_output: str,
        implementation: str,
        context_hints: list[str],
        context: AgentContext,
    ) -> dict[str, Any] | None:
        """Run RLM exploration for debugging context.

        Args:
            test_output: Test failure output.
            implementation: Implementation code.
            context_hints: Hints from context pack.
            context: Agent context.

        Returns:
            dict | None: RLM exploration results or None.
        """
        if not self._rlm_integration:
            return None

        try:
            # Build exploration query focused on debugging
            query = f"""
Analyze these test failures and find relevant context in the codebase:

Test Output:
{test_output}

Implementation Being Tested:
{implementation}

Look for:
1. Similar implementations that work correctly
2. Interface definitions that must be satisfied
3. Test patterns for this type of functionality
4. Common error handling patterns
5. Dependencies and their expected behavior
"""

            result = await self._rlm_integration.explore(
                query=query,
                context_hints=context_hints,
                task_id=context.task_id,
            )

            return {
                "formatted_output": result.formatted_output,
                "error": result.error,
            }

        except Exception as e:
            logger.warning(f"RLM exploration failed: {e}")
            return {
                "formatted_output": "",
                "error": str(e),
            }

    async def _generate_debug_analysis(
        self,
        test_output: str,
        implementation: str,
        stack_trace: str | None,
        test_code: str | None,
        rlm_context: str,
        task_id: str,
    ) -> DebugAnalysis | None:
        """Generate debug analysis from test failures.

        Args:
            test_output: Test failure output.
            implementation: Implementation code.
            stack_trace: Optional stack trace.
            test_code: Optional test code.
            rlm_context: Context from RLM exploration.
            task_id: Task identifier.

        Returns:
            DebugAnalysis | None: Generated analysis or None if failed.
        """
        # Step 1: Failure analysis
        failure_prompt = format_failure_analysis_prompt(
            test_output=test_output,
            implementation=implementation,
            stack_trace=stack_trace,
        )

        if rlm_context:
            failure_prompt = f"{failure_prompt}\n\n## Codebase Context from RLM\n\n{rlm_context}"

        try:
            failure_response = await self._llm_client.generate(
                prompt=failure_prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )
            failure_analysis = failure_response.content

            # Step 2: Root cause analysis
            root_cause_prompt = format_root_cause_prompt(
                failure_analysis=failure_analysis,
                code_context=rlm_context if rlm_context else None,
                test_context=test_code,
            )

            root_cause_response = await self._llm_client.generate(
                prompt=root_cause_prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )
            root_cause_analysis = root_cause_response.content

            # Step 3: Fix suggestions with structured output
            test_expectations = self._extract_test_expectations(test_code) if test_code else None

            fix_prompt = format_fix_suggestion_prompt(
                root_cause=root_cause_analysis,
                code=implementation,
                test_expectations=test_expectations,
            )

            # Add output format instructions
            fix_prompt = f"""{fix_prompt}

## Output Format

Respond with a JSON object containing:
```json
{{
    "failure_id": "unique-failure-id",
    "root_cause": "Clear description of the root cause",
    "fix_suggestion": "Description of how to fix the issue",
    "code_changes": [
        {{
            "file_path": "path/to/file.py",
            "original_code": "original code to replace",
            "new_code": "new code to insert",
            "description": "what this change does",
            "line_start": 1,
            "line_end": 5
        }}
    ]
}}
```
"""

            fix_response = await self._llm_client.generate(
                prompt=fix_prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse the response
            analysis_data = self._parse_json_from_response(fix_response.content)

            if not analysis_data:
                logger.warning("Invalid debug analysis response - no valid JSON found")
                return None

            # Build code changes
            code_changes = []
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

        except Exception as e:
            logger.error(f"Debug analysis generation failed: {e}")
            raise

    def _extract_test_expectations(self, test_code: str) -> list[str]:
        """Extract test expectations from test code.

        Args:
            test_code: Test code to analyze.

        Returns:
            list[str]: List of test expectations.
        """
        expectations = []

        # Extract assert statements
        assert_pattern = r'assert\s+(.+?)(?:\s*,\s*["\'](.+?)["\'])?$'
        for line in test_code.split('\n'):
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

        paths = []

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
