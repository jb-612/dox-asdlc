"""RLM integration with agent system.

Provides the integration layer for connecting RLM exploration to the
agent runner framework. This module will be connected to AgentRunner
once P03-F01 is complete.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING

from src.workers.rlm.agent import RLMAgent
from src.workers.rlm.audit import RLMAuditor
from src.workers.rlm.budget_manager import SubCallBudgetManager
from src.workers.rlm.cache import SubCallCache
from src.workers.rlm.config import RLMConfig
from src.workers.rlm.models import RLMResult
from src.workers.rlm.orchestrator import RLMOrchestrator
from src.workers.rlm.tools.file_tools import FileTools
from src.workers.rlm.tools.llm_query import LLMQueryTool
from src.workers.rlm.tools.registry import REPLToolSurface
from src.workers.rlm.tools.symbol_tools import SymbolTools
from src.workers.rlm.trigger import RLMTriggerDetector, TriggerResult

if TYPE_CHECKING:
    from anthropic import Anthropic

logger = logging.getLogger(__name__)


@dataclass
class RLMIntegrationResult:
    """Result from RLM integration processing.

    Attributes:
        used_rlm: Whether RLM mode was used
        trigger_result: Trigger detection result
        rlm_result: RLM exploration result (if used)
        formatted_output: Formatted output for agent consumption
        error: Error message if failed
    """

    used_rlm: bool
    trigger_result: TriggerResult | None
    rlm_result: RLMResult | None
    formatted_output: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "used_rlm": self.used_rlm,
            "trigger_result": self.trigger_result.to_dict() if self.trigger_result else None,
            "rlm_result": self.rlm_result.to_dict() if self.rlm_result else None,
            "formatted_output": self.formatted_output,
            "error": self.error,
        }


@dataclass
class RLMIntegration:
    """Integration layer for RLM with agent system.

    Provides a high-level interface for using RLM exploration from
    within the agent framework. Handles trigger detection, RLM
    orchestration, and result formatting.

    Attributes:
        client: Anthropic client for LLM calls
        config: RLM configuration
        repo_root: Repository root path for file operations
        auto_trigger: Whether to auto-detect when to use RLM

    Example:
        integration = RLMIntegration(
            client=anthropic_client,
            config=RLMConfig.from_env(),
            repo_root="/path/to/repo",
        )

        # Check if RLM should be used
        if integration.should_use_rlm(query=query, context_tokens=150000):
            result = await integration.explore(query)
            formatted = result.formatted_output
    """

    client: Any  # Anthropic client
    config: RLMConfig
    repo_root: str = "."
    auto_trigger: bool = True
    _trigger_detector: RLMTriggerDetector = field(init=False)
    _auditor: RLMAuditor = field(init=False)
    _exploration_count: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        """Initialize components."""
        self._trigger_detector = RLMTriggerDetector(
            context_threshold=self.config.max_subcalls * 2000,  # Rough estimate
            fail_count_threshold=4,
            multi_file_threshold=10,
        )
        self._auditor = RLMAuditor(audit_dir=self.config.audit_dir)

    def should_use_rlm(
        self,
        query: str = "",
        context_tokens: int = 0,
        file_count: int = 0,
        fail_count: int = 0,
        agent_type: str = "",
        explicit_rlm: bool = False,
    ) -> TriggerResult:
        """Check if RLM mode should be used.

        Args:
            query: The task query
            context_tokens: Current context size in tokens
            file_count: Number of files involved
            fail_count: Number of failed attempts
            agent_type: Type of agent (e.g., "debugger")
            explicit_rlm: Whether RLM was explicitly requested

        Returns:
            TriggerResult with decision and reasons
        """
        return self._trigger_detector.check(
            query=query,
            context_tokens=context_tokens,
            file_count=file_count,
            fail_count=fail_count,
            agent_type=agent_type,
            explicit_rlm=explicit_rlm,
        )

    async def explore(
        self,
        query: str,
        context_hints: list[str] | None = None,
        task_id: str | None = None,
        save_audit: bool = True,
    ) -> RLMIntegrationResult:
        """Execute RLM exploration.

        Args:
            query: The exploration query
            context_hints: Optional hints for exploration
            task_id: Optional task identifier
            save_audit: Whether to save audit trail

        Returns:
            RLMIntegrationResult with exploration results
        """
        self._exploration_count += 1

        try:
            # Create components
            orchestrator = self._create_orchestrator()

            # Run exploration
            rlm_result = await orchestrator.explore(
                query=query,
                context_hints=context_hints,
                task_id=task_id,
            )

            # Save audit if requested
            if save_audit:
                self._auditor.save_result(rlm_result)

            # Format output for agent consumption
            formatted = self._format_for_agent(rlm_result)

            return RLMIntegrationResult(
                used_rlm=True,
                trigger_result=None,
                rlm_result=rlm_result,
                formatted_output=formatted,
            )

        except Exception as e:
            logger.error(f"RLM exploration failed: {e}", exc_info=True)
            return RLMIntegrationResult(
                used_rlm=True,
                trigger_result=None,
                rlm_result=None,
                formatted_output=f"RLM exploration failed: {e}",
                error=str(e),
            )

    async def process_with_rlm_check(
        self,
        query: str,
        context_tokens: int = 0,
        file_count: int = 0,
        fail_count: int = 0,
        agent_type: str = "",
        explicit_rlm: bool = False,
        context_hints: list[str] | None = None,
        task_id: str | None = None,
    ) -> RLMIntegrationResult:
        """Process a query, using RLM if triggered.

        This is the main entry point for agent integration. It checks
        if RLM should be used and executes exploration if so.

        Args:
            query: The task query
            context_tokens: Current context size
            file_count: Number of files involved
            fail_count: Number of failed attempts
            agent_type: Type of agent
            explicit_rlm: Whether RLM was explicitly requested
            context_hints: Optional exploration hints
            task_id: Optional task identifier

        Returns:
            RLMIntegrationResult with results or skip indication
        """
        # Check if RLM should be triggered
        trigger_result = self.should_use_rlm(
            query=query,
            context_tokens=context_tokens,
            file_count=file_count,
            fail_count=fail_count,
            agent_type=agent_type,
            explicit_rlm=explicit_rlm,
        )

        if not trigger_result.should_trigger and self.auto_trigger:
            # RLM not needed
            return RLMIntegrationResult(
                used_rlm=False,
                trigger_result=trigger_result,
                rlm_result=None,
                formatted_output="",
            )

        # Use RLM
        result = await self.explore(
            query=query,
            context_hints=context_hints,
            task_id=task_id,
        )
        result.trigger_result = trigger_result

        return result

    def explore_sync(
        self,
        query: str,
        context_hints: list[str] | None = None,
        task_id: str | None = None,
    ) -> RLMIntegrationResult:
        """Synchronous wrapper for explore().

        Args:
            query: The exploration query
            context_hints: Optional hints
            task_id: Optional task identifier

        Returns:
            RLMIntegrationResult
        """
        import asyncio
        return asyncio.run(self.explore(query, context_hints, task_id))

    def _create_orchestrator(self) -> RLMOrchestrator:
        """Create a fresh orchestrator for exploration."""
        # Create budget manager
        budget = SubCallBudgetManager(
            max_total=self.config.max_subcalls,
            max_per_iteration=self.config.max_subcalls_per_iteration,
        )

        # Create cache
        cache = SubCallCache(enabled=self.config.cache_enabled)

        # Create tools
        file_tools = FileTools(repo_root=self.repo_root)
        symbol_tools = SymbolTools(repo_root=self.repo_root)

        # Create LLM query tool (for sub-calls)
        llm_query_tool = LLMQueryTool(
            client=self.client,
            budget_manager=budget,
            cache=cache,
            model=self.config.model,
            max_tokens=self.config.max_tokens_per_subcall,
        )

        # Create tool surface
        tool_surface = REPLToolSurface(
            file_tools=file_tools,
            symbol_tools=symbol_tools,
            llm_query_tool=llm_query_tool,
        )

        # Create agent
        agent = RLMAgent(
            client=self.client,
            tool_surface=tool_surface,
        )

        # Create orchestrator
        return RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=self.config,
        )

    def _format_for_agent(self, result: RLMResult) -> str:
        """Format RLM result for agent consumption.

        Args:
            result: The RLM exploration result

        Returns:
            Formatted string for agent context
        """
        lines = []

        # Header
        if result.success:
            lines.append("## RLM Exploration Results")
        else:
            lines.append("## RLM Exploration (Partial Results)")
            if result.error:
                lines.append(f"**Note**: {result.error}")

        lines.append("")

        # Synthesis
        if result.synthesis:
            lines.append("### Summary")
            lines.append(result.synthesis)
            lines.append("")

        # Key findings
        if result.findings:
            lines.append("### Key Findings")
            for i, finding in enumerate(result.findings, 1):
                lines.append(f"{i}. **{finding.source_file}**: {finding.description}")
                if finding.line_range:
                    lines.append(f"   (lines {finding.line_range[0]}-{finding.line_range[1]})")
            lines.append("")

        # Citations
        if result.citations:
            lines.append("### References")
            for citation in result.citations[:10]:  # Limit to 10
                lines.append(f"- `{citation.file_path}:{citation.line_start}-{citation.line_end}`")
            lines.append("")

        # Usage stats
        lines.append("### Exploration Stats")
        lines.append(f"- Iterations: {len(result.trajectory.steps)}")
        lines.append(f"- Sub-calls: {result.usage.subcall_count}")
        lines.append(f"- Cache hits: {result.usage.cached_subcalls}")
        lines.append(f"- Duration: {result.usage.wall_time_seconds:.1f}s")

        return "\n".join(lines)

    @property
    def exploration_count(self) -> int:
        """Return number of explorations run."""
        return self._exploration_count

    def get_stats(self) -> dict[str, Any]:
        """Get integration statistics."""
        return {
            "exploration_count": self._exploration_count,
            "config": self.config.to_dict(),
            "trigger_thresholds": self._trigger_detector.get_thresholds(),
            "audit_stats": self._auditor.get_stats(),
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"RLMIntegration(explorations={self._exploration_count}, "
            f"auto_trigger={self.auto_trigger})"
        )
