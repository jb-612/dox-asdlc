"""Stub agent for testing the worker framework.

Provides a configurable test agent that can simulate various behaviors
for framework validation and testing purposes.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from src.workers.agents.protocols import AgentContext, AgentResult

logger = logging.getLogger(__name__)


class StubAgent:
    """Test agent with configurable behavior.

    Used for framework validation, testing, and development.
    Can be configured to succeed, fail, delay, raise exceptions,
    generate artifacts, and more.

    Example:
        # Success case
        agent = StubAgent()
        result = await agent.execute(context, {})
        assert result.success is True

        # Failure case
        agent = StubAgent(success=False, error_message="Test failure")
        result = await agent.execute(context, {})
        assert result.success is False

        # With delay
        agent = StubAgent(delay_seconds=1.0)
        await agent.execute(context, {})  # Takes ~1 second
    """

    def __init__(
        self,
        success: bool = True,
        error_message: str | None = None,
        should_retry: bool = False,
        delay_seconds: float = 0.0,
        artifact_count: int = 0,
        validation_fails: bool = False,
        raise_exception: Exception | None = None,
        on_execute: Callable[[AgentContext], Awaitable[None]] | None = None,
        on_cleanup: Callable[[AgentContext], Awaitable[None]] | None = None,
    ) -> None:
        """Initialize the stub agent.

        Args:
            success: Whether execution should succeed.
            error_message: Error message for failed executions.
            should_retry: Whether failure should be retried.
            delay_seconds: Simulated execution delay.
            artifact_count: Number of mock artifacts to generate.
            validation_fails: Whether context validation should fail.
            raise_exception: Exception to raise during execution.
            on_execute: Callback called during execution.
            on_cleanup: Callback called during cleanup.
        """
        self._success = success
        self._error_message = error_message
        self._should_retry = should_retry
        self._delay_seconds = delay_seconds
        self._artifact_count = artifact_count
        self._validation_fails = validation_fails
        self._raise_exception = raise_exception
        self._on_execute = on_execute
        self._on_cleanup = on_cleanup

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "stub"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute the stub agent.

        Simulates agent execution with configurable behavior.

        Args:
            context: Execution context.
            event_metadata: Event metadata.

        Returns:
            AgentResult: Configured result.

        Raises:
            Exception: If raise_exception was configured.
        """
        start_time = time.time()

        logger.info(f"StubAgent executing for task: {context.task_id}")

        # Simulate delay if configured
        if self._delay_seconds > 0:
            await asyncio.sleep(self._delay_seconds)

        # Call custom callback if provided
        if self._on_execute:
            await self._on_execute(context)

        # Raise exception if configured
        if self._raise_exception:
            raise self._raise_exception

        # Generate artifacts if requested
        artifact_paths = []
        for i in range(self._artifact_count):
            artifact_paths.append(f"/artifacts/{context.task_id}/artifact_{i}.txt")

        # Build metadata
        execution_time_ms = (time.time() - start_time) * 1000
        result_metadata: dict[str, Any] = {
            "execution_time_ms": round(execution_time_ms, 2),
        }

        # Include context pack info if present
        if context.context_pack:
            files = context.context_pack.get("files", [])
            result_metadata["context_pack_files"] = len(files)

        return AgentResult(
            success=self._success,
            agent_type=self.agent_type,
            task_id=context.task_id,
            error_message=self._error_message,
            should_retry=self._should_retry,
            artifact_paths=artifact_paths,
            metadata=result_metadata,
        )

    async def validate_context(self, context: AgentContext) -> bool:
        """Validate the execution context.

        Args:
            context: The context to validate.

        Returns:
            bool: True if valid, False if configured to fail.
        """
        return not self._validation_fails

    async def cleanup(self, context: AgentContext) -> None:
        """Cleanup after execution.

        Args:
            context: The execution context.
        """
        if self._on_cleanup:
            await self._on_cleanup(context)

    @classmethod
    def create_failing(
        cls,
        error_message: str = "Stub agent failure",
        should_retry: bool = False,
    ) -> StubAgent:
        """Create a stub agent configured to fail.

        Args:
            error_message: The error message.
            should_retry: Whether to indicate retry is possible.

        Returns:
            StubAgent: Configured to fail.
        """
        return cls(
            success=False,
            error_message=error_message,
            should_retry=should_retry,
        )

    @classmethod
    def create_slow(cls, delay: float = 1.0) -> StubAgent:
        """Create a stub agent with execution delay.

        Args:
            delay: Delay in seconds.

        Returns:
            StubAgent: Configured with delay.
        """
        return cls(delay_seconds=delay)
