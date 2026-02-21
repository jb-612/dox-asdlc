"""Coding Agent for implementation generation.

Generates implementation code to pass tests, following TDD principles.
Delegates work to a pluggable AgentBackend (Claude Code CLI,
Codex CLI, or direct LLM API calls).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeFile,
    Implementation,
)
from src.workers.agents.development.prompts.coding_prompts import (
    IMPLEMENTATION_PROMPT,
    format_implementation_prompt,
    format_retry_implementation_prompt,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.agents.backends.base import AgentBackend
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)


# JSON Schema for structured output validation (CLI backends)
CODING_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "files": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                    "language": {"type": "string"},
                },
                "required": ["path", "content"],
            },
        },
        "imports": {"type": "array", "items": {"type": "string"}},
        "dependencies": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["files"],
}

# System prompt for the coding backend
CODING_SYSTEM_PROMPT = IMPLEMENTATION_PROMPT


def _build_coding_prompt(
    task_description: str,
    test_code: str,
    context_pack: str | None = None,
    fail_count: int = 0,
    previous_implementation: str = "",
    test_errors: list[str] | None = None,
    debug_hints: list[str] | None = None,
) -> str:
    """Build the complete prompt for the coding backend.

    Combines task description, test code, retry context, debug hints,
    and context pack into a single comprehensive prompt.

    Args:
        task_description: Description of what to implement.
        test_code: Test code that implementation must pass.
        context_pack: Optional existing code context.
        fail_count: Number of failed attempts.
        previous_implementation: Previous failed implementation.
        test_errors: List of test error messages.
        debug_hints: Hints from debug analysis.

    Returns:
        str: Complete prompt for the backend.
    """
    is_retry = fail_count > 0 and (previous_implementation or test_errors)

    if is_retry:
        prompt = format_retry_implementation_prompt(
            task_description=task_description,
            test_code=test_code,
            previous_implementation=(
                previous_implementation
                or "(no previous implementation available)"
            ),
            test_errors=test_errors or [],
            fail_count=fail_count,
            debug_hints=debug_hints,
        )
    else:
        prompt = format_implementation_prompt(
            task_description=task_description,
            test_code=test_code,
            context_pack=context_pack,
        )
        # Add debug hints even on first attempt if provided
        if debug_hints:
            hints_text = "\n".join(f"- {hint}" for hint in debug_hints)
            prompt = (
                f"{prompt}\n\n## Debug Hints\n\n"
                f"Consider these insights when implementing:\n{hints_text}"
            )

    return prompt


def _parse_implementation_from_result(
    result: BackendResult,
    task_id: str,
) -> Implementation | None:
    """Parse implementation data from backend result.

    Handles structured output (from --json-schema), direct JSON,
    and JSON embedded in text/code blocks.

    Args:
        result: Backend execution result.
        task_id: Task identifier for the implementation.

    Returns:
        Implementation | None: Parsed implementation or None if parsing fails.
    """
    # Try structured output first (from --json-schema)
    impl_data = None

    if result.structured_output and "files" in result.structured_output:
        impl_data = result.structured_output
    else:
        # Fall back to parsing text output
        content = result.output
        if content:
            impl_data = parse_json_from_response(content)

    if not impl_data or "files" not in impl_data:
        return None

    # Build Implementation from parsed data
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


class CodingAgentError(Exception):
    """Raised when Coding agent operations fail."""

    pass


class CodingAgent:
    """Agent that generates implementation code to pass tests.

    Delegates the actual code generation to a pluggable AgentBackend
    (Claude Code CLI, Codex CLI, or direct LLM API).

    Example:
        from src.workers.agents.backends.cli_backend import CLIAgentBackend
        backend = CLIAgentBackend(cli="claude")
        agent = CodingAgent(
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
        """Initialize the Coding agent.

        Args:
            backend: Agent backend for code generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
        self._artifact_writer = artifact_writer
        self._config = config

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
        logger.info(
            f"Coding Agent starting for task {context.task_id} "
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
            previous_implementation = event_metadata.get(
                "previous_implementation", ""
            )
            test_errors = event_metadata.get("test_errors", [])
            debug_analysis = event_metadata.get("debug_analysis")

            # Build context string from context pack if available
            context_pack_str = self._build_context_string(context)

            # Extract debug hints if debug_analysis is provided
            debug_hints = self._extract_debug_hints(debug_analysis)

            # Build the comprehensive prompt
            prompt = _build_coding_prompt(
                task_description=task_description,
                test_code=test_code,
                context_pack=context_pack_str,
                fail_count=fail_count,
                previous_implementation=previous_implementation,
                test_errors=test_errors,
                debug_hints=debug_hints,
            )

            # Configure the backend
            backend_config = BackendConfig(
                model=self._config.coding_model,
                output_schema=CODING_OUTPUT_SCHEMA,
                system_prompt=CODING_SYSTEM_PROMPT,
                timeout_seconds=self._config.test_timeout_seconds,
                allowed_tools=["Read", "Glob", "Grep", "Write", "Edit"],
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

            # Parse implementation from result
            implementation = _parse_implementation_from_result(
                result, context.task_id
            )

            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message=(
                        "Failed to parse implementation from backend output"
                    ),
                    should_retry=True,
                )

            # Write artifacts
            artifact_paths = await self._write_artifacts(
                context, implementation
            )

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
                    "tdd_phase": "green",  # Implementation to make tests pass
                    "backend": self._backend.backend_name,
                    "cost_usd": result.cost_usd,
                    "turns": result.turns,
                    "session_id": result.session_id,
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
            context_parts.append(
                f"# Relevant interfaces: {', '.join(interfaces)}"
            )

        return "\n\n".join(context_parts) if context_parts else None

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
