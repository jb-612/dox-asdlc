"""Coding Agent for implementation generation.

Generates implementation code to pass tests, following TDD principles.
Integrates with RLM for complex tasks and retry scenarios.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeFile,
    Implementation,
)
from src.workers.agents.development.prompts.coding_prompts import (
    format_implementation_prompt,
    format_retry_implementation_prompt,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient
    from src.workers.rlm.integration import RLMIntegration

logger = logging.getLogger(__name__)


class CodingAgentError(Exception):
    """Raised when Coding agent operations fail."""

    pass


class CodingAgent:
    """Agent that generates implementation code to pass tests.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses LLM to generate implementation code that satisfies the provided
    test suite (TDD green phase).

    On retry attempts (fail_count > 0), integrates with RLM for deeper
    exploration of the codebase to find patterns and solutions.

    Example:
        agent = CodingAgent(
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
        rlm_integration: RLMIntegration | None = None,
    ) -> None:
        """Initialize the Coding agent.

        Args:
            llm_client: LLM client for code generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
            rlm_integration: Optional RLM integration for complex tasks.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config
        self._rlm_integration = rlm_integration

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "coding"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute implementation generation from test code.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - task_description: Description of what to implement (required)
                - test_code: Test code that implementation must pass (required)
                - fail_count: Number of failed attempts (optional, default 0)
                - previous_implementation: Previous failed implementation (optional)
                - test_errors: List of test error messages (optional)
                - debug_analysis: Debug analysis dict with fixes (optional)

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(f"Coding Agent starting for task {context.task_id}")

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

            test_code = event_metadata.get("test_code", "")
            if not test_code:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No test_code provided in event_metadata",
                    should_retry=False,
                )

            # Extract retry context
            fail_count = event_metadata.get("fail_count", 0)
            previous_implementation = event_metadata.get("previous_implementation", "")
            test_errors = event_metadata.get("test_errors", [])
            debug_analysis = event_metadata.get("debug_analysis")

            # Build context string from context pack if available
            context_pack_str = self._build_context_string(context)

            # Check if RLM should be used
            used_rlm = False
            rlm_context = ""

            if self._should_use_rlm(fail_count):
                rlm_result = await self._run_rlm_exploration(
                    task_description=task_description,
                    test_code=test_code,
                    test_errors=test_errors,
                    context=context,
                )
                if rlm_result:
                    used_rlm = True
                    rlm_context = rlm_result

            # Extract debug hints if debug_analysis is provided
            debug_hints = self._extract_debug_hints(debug_analysis)

            # Generate implementation using LLM
            implementation = await self._generate_implementation(
                task_description=task_description,
                test_code=test_code,
                context_pack=context_pack_str,
                fail_count=fail_count,
                previous_implementation=previous_implementation,
                test_errors=test_errors,
                debug_hints=debug_hints,
                rlm_context=rlm_context,
                task_id=context.task_id,
            )

            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate implementation from tests",
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, implementation)

            logger.info(
                f"Coding Agent completed for task {context.task_id}, "
                f"files: {len(implementation.files)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata={
                    "file_count": len(implementation.files),
                    "imports": implementation.imports,
                    "dependencies": implementation.dependencies,
                    "fail_count": fail_count,
                    "used_rlm": used_rlm,
                    "tdd_phase": "green",  # Implementation to make tests pass
                },
            )

        except Exception as e:
            logger.error(f"Coding Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _should_use_rlm(self, fail_count: int) -> bool:
        """Determine if RLM should be used for this attempt.

        Args:
            fail_count: Number of failed attempts.

        Returns:
            bool: True if RLM should be used.
        """
        # Only use RLM if enabled and we have failed attempts
        if not self._config.enable_rlm:
            return False

        if not self._rlm_integration:
            return False

        # Use RLM on retry (fail_count > 0)
        return fail_count > 0

    async def _run_rlm_exploration(
        self,
        task_description: str,
        test_code: str,
        test_errors: list[str],
        context: AgentContext,
    ) -> str | None:
        """Run RLM exploration for complex tasks.

        Args:
            task_description: Description of the task.
            test_code: Test code to pass.
            test_errors: List of test errors from previous attempts.
            context: Agent context.

        Returns:
            str | None: RLM exploration results or None.
        """
        if not self._rlm_integration:
            return None

        try:
            # Build exploration query
            errors_text = "\n".join(test_errors) if test_errors else ""
            query = f"""
Find implementation patterns to pass these tests:

Task: {task_description}

Test Code:
{test_code}

Errors from previous attempts:
{errors_text if errors_text else "None"}

Look for:
1. Similar implementations in the codebase
2. Interface definitions that must be satisfied
3. Common patterns for this type of functionality
"""

            # Check if RLM should trigger
            trigger_result = self._rlm_integration.should_use_rlm(
                query=query,
                fail_count=len(test_errors) if test_errors else 1,
                agent_type="coding",
            )

            if trigger_result.should_trigger:
                result = await self._rlm_integration.explore(
                    query=query,
                    task_id=context.task_id,
                )
                return result.formatted_output

            return None

        except Exception as e:
            logger.warning(f"RLM exploration failed: {e}")
            return None

    def _extract_debug_hints(
        self, debug_analysis: dict[str, Any] | None
    ) -> list[str]:
        """Extract debug hints from debug analysis.

        Args:
            debug_analysis: Debug analysis dictionary.

        Returns:
            list[str]: List of debug hints.
        """
        if not debug_analysis:
            return []

        hints = []

        # Add root cause
        root_cause = debug_analysis.get("root_cause", "")
        if root_cause:
            hints.append(f"Root cause: {root_cause}")

        # Add fix suggestion
        fix_suggestion = debug_analysis.get("fix_suggestion", "")
        if fix_suggestion:
            hints.append(f"Suggested fix: {fix_suggestion}")

        # Add code changes
        code_changes = debug_analysis.get("code_changes", [])
        for change in code_changes:
            description = change.get("description", "")
            if description:
                hints.append(f"Code change: {description}")

        return hints

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

    async def _generate_implementation(
        self,
        task_description: str,
        test_code: str,
        context_pack: str | None,
        fail_count: int,
        previous_implementation: str,
        test_errors: list[str],
        debug_hints: list[str],
        rlm_context: str,
        task_id: str,
    ) -> Implementation | None:
        """Generate implementation from test code.

        Args:
            task_description: Description of the task.
            test_code: Test code to pass.
            context_pack: Optional existing code context.
            fail_count: Number of failed attempts.
            previous_implementation: Previous failed implementation.
            test_errors: List of test error messages.
            debug_hints: Hints from debug analysis.
            rlm_context: Additional context from RLM exploration.
            task_id: Task identifier.

        Returns:
            Implementation | None: Generated implementation or None if failed.
        """
        # Build prompt based on whether this is a retry
        is_retry = fail_count > 0 and (previous_implementation or test_errors)
        if is_retry:
            prompt = format_retry_implementation_prompt(
                task_description=task_description,
                test_code=test_code,
                previous_implementation=previous_implementation or "(no previous implementation available)",
                test_errors=test_errors,
                fail_count=fail_count,
                debug_hints=debug_hints,
            )
        else:
            prompt = format_implementation_prompt(
                task_description=task_description,
                test_code=test_code,
                context_pack=context_pack,
            )
            # Add debug hints even on first attempt if they're provided
            if debug_hints:
                hints_text = "\n".join(f"- {hint}" for hint in debug_hints)
                prompt = f"{prompt}\n\n## Debug Hints\n\nConsider these insights when implementing:\n{hints_text}"

        # Add RLM context if available
        if rlm_context:
            prompt = f"{prompt}\n\n## Additional Context from Codebase Analysis\n\n{rlm_context}"

        # Add output format instructions
        prompt = f"""{prompt}

## Output Format

Respond with a JSON object containing:
```json
{{
    "files": [
        {{
            "path": "relative/path/to/file.py",
            "content": "full file content here",
            "language": "python"
        }}
    ],
    "imports": ["list", "of", "imports"],
    "dependencies": ["external", "packages"]
}}
```
"""

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse response
            impl_data = self._parse_json_from_response(response.content)

            if not impl_data or "files" not in impl_data:
                logger.warning("Invalid implementation response - no files found")
                return None

            # Build implementation
            files = []
            for file_data in impl_data.get("files", []):
                try:
                    code_file = CodeFile(
                        path=file_data.get("path", ""),
                        content=file_data.get("content", ""),
                        language=file_data.get("language", "python"),
                    )
                    files.append(code_file)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid file: {e}")
                    continue

            if not files:
                return None

            return Implementation(
                task_id=task_id,
                files=files,
                imports=impl_data.get("imports", []),
                dependencies=impl_data.get("dependencies", []),
            )

        except Exception as e:
            logger.error(f"Implementation generation failed: {e}")
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

    async def _write_artifacts(
        self,
        context: AgentContext,
        implementation: Implementation,
    ) -> list[str]:
        """Write implementation artifacts.

        Args:
            context: Agent context.
            implementation: Generated implementation.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = implementation.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_implementation.json",
        )
        paths.append(json_path)

        # Write each implementation file
        for code_file in implementation.files:
            file_content = code_file.content
            file_name = code_file.path.replace("/", "_")
            file_path = await self._artifact_writer.write_artifact(
                session_id=context.session_id,
                task_id=context.task_id,
                content=file_content,
                artifact_type=ArtifactType.TEXT,
                filename=f"{context.task_id}_{file_name}",
            )
            paths.append(file_path)

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
