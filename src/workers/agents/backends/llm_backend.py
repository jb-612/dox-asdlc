"""LLM API-based agent backend (legacy/fallback).

Wraps the existing LLMClient protocol to execute prompts via
direct API calls. Used when no CLI tool is available or for
simple single-shot prompts that don't need agentic tool use.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from src.workers.agents.backends.base import (
    AgentBackend,
    BackendConfig,
    BackendResult,
)

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


class LLMAgentBackend:
    """Agent backend using direct LLM API calls.

    Wraps the existing LLMClient protocol for backward compatibility.
    This backend makes single-shot prompt-to-response calls without
    agentic tool use loops.

    Example:
        from src.workers.llm.client import StubLLMClient
        backend = LLMAgentBackend(llm_client=StubLLMClient())
        result = await backend.execute(
            prompt="Break this PRD into tasks",
            workspace_path="/workspace",
        )
    """

    def __init__(self, llm_client: LLMClient) -> None:
        """Initialize LLM backend.

        Args:
            llm_client: LLM client implementing the LLMClient protocol.
        """
        self._llm_client = llm_client

    @property
    def backend_name(self) -> str:
        """Return the backend identifier."""
        return f"llm-{self._llm_client.model_name}"

    async def execute(
        self,
        prompt: str,
        workspace_path: str,
        config: BackendConfig | None = None,
    ) -> BackendResult:
        """Execute a prompt via direct LLM API call.

        Args:
            prompt: The task prompt.
            workspace_path: Working directory (not used by LLM backend).
            config: Execution configuration.

        Returns:
            BackendResult with LLM response.
        """
        config = config or BackendConfig()

        kwargs: dict = {}
        if config.model:
            kwargs["model"] = config.model

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                system=config.system_prompt,
                **kwargs,
            )

            return BackendResult(
                success=True,
                output=response.content,
                cost_usd=None,
                turns=1,
                metadata={
                    "model": response.model,
                    "usage": response.usage,
                    "stop_reason": response.stop_reason,
                },
            )

        except Exception as e:
            logger.error(f"LLM backend failed: {e}")
            return BackendResult(
                success=False,
                error=str(e),
            )

    async def health_check(self) -> bool:
        """Check if the LLM client is functional.

        Returns:
            True (assumes LLM client is available if configured).
        """
        return True
