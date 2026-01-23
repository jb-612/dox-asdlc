"""RLM Orchestrator for exploration coordination.

Coordinates multiple iterations of RLMAgent exploration with budget
management, timeout handling, and result synthesis.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from src.core.exceptions import BudgetExceededError, RLMTimeoutError
from src.workers.rlm.agent import RLMAgent
from src.workers.rlm.budget_manager import SubCallBudgetManager
from src.workers.rlm.cache import SubCallCache
from src.workers.rlm.config import RLMConfig
from src.workers.rlm.models import (
    Citation,
    ExplorationStep,
    ExplorationTrajectory,
    Finding,
    RLMResult,
    RLMUsage,
)

if TYPE_CHECKING:
    from src.workers.rlm.tools.registry import REPLToolSurface

logger = logging.getLogger(__name__)


@dataclass
class RLMOrchestrator:
    """Orchestrates RLM exploration sessions.

    Manages the iteration loop, budget enforcement, timeout handling,
    and result synthesis for RLM exploration.

    Attributes:
        agent: RLMAgent for running iterations
        budget_manager: Budget manager for sub-call limits
        cache: Cache for sub-call results
        config: RLM configuration
        max_iterations: Maximum exploration iterations

    Example:
        orchestrator = RLMOrchestrator(
            agent=agent,
            budget_manager=budget,
            cache=cache,
            config=config,
        )

        result = await orchestrator.explore(
            query="How does the auth system work?",
            context_hints=["Look at src/auth/"],
        )
    """

    agent: RLMAgent
    budget_manager: SubCallBudgetManager
    cache: SubCallCache
    config: RLMConfig
    max_iterations: int = 10
    _exploration_count: int = field(default=0, init=False)

    async def explore(
        self,
        query: str,
        context_hints: list[str] | None = None,
        task_id: str | None = None,
    ) -> RLMResult:
        """Execute an exploration session.

        Args:
            query: The question or task to explore
            context_hints: Optional hints about where to look
            task_id: Optional task identifier (generated if not provided)

        Returns:
            RLMResult with findings and metadata

        Raises:
            RLMTimeoutError: If exploration exceeds timeout
            BudgetExceededError: If budget is exhausted
        """
        task_id = task_id or str(uuid.uuid4())
        self._exploration_count += 1
        start_time = time.perf_counter()

        logger.info(
            f"Starting exploration {task_id}: {query[:100]}... "
            f"(timeout={self.config.timeout_seconds}s, "
            f"budget={self.config.max_subcalls})"
        )

        # Initialize tracking
        steps: list[ExplorationStep] = []
        accumulated_findings: list[str] = []
        all_findings: list[Finding] = []
        citations: list[Citation] = []

        # Create trajectory
        trajectory = ExplorationTrajectory(
            steps=[],
            start_time=datetime.now(timezone.utc),
            end_time=None,
            total_subcalls=0,
            cached_hits=0,
            query=query,
            context_hints=context_hints or [],
        )

        try:
            # Run with timeout
            result = await asyncio.wait_for(
                self._exploration_loop(
                    query=query,
                    context_hints=context_hints or [],
                    steps=steps,
                    accumulated_findings=accumulated_findings,
                    all_findings=all_findings,
                    citations=citations,
                ),
                timeout=self.config.timeout_seconds,
            )

            # Update trajectory
            trajectory.steps = steps
            trajectory.end_time = datetime.now(timezone.utc)
            trajectory.total_subcalls = self.budget_manager.total_used
            trajectory.cached_hits = self.cache.get_stats().hits

            # Build usage
            wall_time = time.perf_counter() - start_time
            usage = self._build_usage(wall_time)

            # Synthesize findings
            synthesis = self._synthesize_findings(accumulated_findings, result)

            logger.info(
                f"Exploration {task_id} completed: "
                f"{len(all_findings)} findings, "
                f"{len(steps)} iterations, "
                f"{wall_time:.1f}s"
            )

            return RLMResult(
                task_id=task_id,
                success=True,
                findings=all_findings,
                synthesis=synthesis,
                trajectory=trajectory,
                usage=usage,
                citations=citations,
            )

        except asyncio.TimeoutError:
            # Handle timeout
            wall_time = time.perf_counter() - start_time
            trajectory.steps = steps
            trajectory.end_time = datetime.now(timezone.utc)
            trajectory.total_subcalls = self.budget_manager.total_used

            usage = self._build_usage(wall_time)

            logger.warning(
                f"Exploration {task_id} timed out after {wall_time:.1f}s"
            )

            return RLMResult.failure(
                task_id=task_id,
                error=f"Exploration timed out after {self.config.timeout_seconds}s",
                trajectory=trajectory,
                usage=usage,
            )

        except BudgetExceededError as e:
            # Handle budget exhaustion
            wall_time = time.perf_counter() - start_time
            trajectory.steps = steps
            trajectory.end_time = datetime.now(timezone.utc)
            trajectory.total_subcalls = self.budget_manager.total_used

            usage = self._build_usage(wall_time)

            logger.warning(
                f"Exploration {task_id} exhausted budget: {e.message}"
            )

            # Return partial results if we have any
            if all_findings:
                synthesis = self._synthesize_findings(
                    accumulated_findings,
                    "Exploration ended due to budget limits. Partial results below.",
                )
                return RLMResult(
                    task_id=task_id,
                    success=True,  # Partial success
                    findings=all_findings,
                    synthesis=synthesis,
                    trajectory=trajectory,
                    usage=usage,
                    citations=citations,
                    error="Budget exhausted - partial results",
                )

            return RLMResult.failure(
                task_id=task_id,
                error=f"Budget exhausted: {e.message}",
                trajectory=trajectory,
                usage=usage,
            )

        except Exception as e:
            # Handle unexpected errors
            wall_time = time.perf_counter() - start_time
            trajectory.steps = steps
            trajectory.end_time = datetime.now(timezone.utc)
            trajectory.total_subcalls = self.budget_manager.total_used

            usage = self._build_usage(wall_time)

            logger.error(f"Exploration {task_id} failed: {e}", exc_info=True)

            return RLMResult.failure(
                task_id=task_id,
                error=str(e),
                trajectory=trajectory,
                usage=usage,
            )

    async def _exploration_loop(
        self,
        query: str,
        context_hints: list[str],
        steps: list[ExplorationStep],
        accumulated_findings: list[str],
        all_findings: list[Finding],
        citations: list[Citation],
    ) -> str:
        """Run the exploration iteration loop.

        Args:
            query: The exploration query
            context_hints: Context hints
            steps: List to accumulate exploration steps
            accumulated_findings: List to accumulate finding descriptions
            all_findings: List to accumulate Finding objects
            citations: List to accumulate citations

        Returns:
            Final result/synthesis from agent
        """
        context = self._build_initial_context(context_hints)

        for iteration in range(self.max_iterations):
            # Check budget
            if not self.budget_manager.can_make_call():
                logger.info(f"Budget exhausted at iteration {iteration}")
                raise BudgetExceededError(
                    message="Sub-call budget exhausted",
                    budget_limit=self.budget_manager.max_total,
                    subcalls_used=self.budget_manager.total_used,
                )

            # Run iteration
            logger.debug(f"Running iteration {iteration}")
            iteration_result = self.agent.run_iteration(
                query=query,
                context=context,
                history=steps,
                accumulated_findings=accumulated_findings,
            )

            # Record subcalls used
            subcalls_this_iteration = len([
                tc for tc in iteration_result.tool_calls
                if tc.get("tool") == "llm_query"
            ])

            # Create exploration step
            step = iteration_result.to_exploration_step(
                iteration=iteration,
                subcalls_used=subcalls_this_iteration,
            )
            steps.append(step)

            # Accumulate findings
            for finding_desc in iteration_result.findings:
                if finding_desc not in accumulated_findings:
                    accumulated_findings.append(finding_desc)

            # Extract citations from tool calls
            for tc in iteration_result.tool_calls:
                citation = self._extract_citation(tc)
                if citation:
                    citations.append(citation)

            # Reset iteration budget
            self.budget_manager.reset_iteration()

            # Check if done
            if iteration_result.is_done:
                logger.info(f"Agent signaled completion at iteration {iteration}")
                return iteration_result.next_direction

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.1)

        # Max iterations reached
        logger.info(f"Max iterations ({self.max_iterations}) reached")
        return "Max iterations reached"

    def _build_initial_context(self, context_hints: list[str]) -> str:
        """Build initial context from hints."""
        if not context_hints:
            return ""
        return "Context hints:\n" + "\n".join(f"- {hint}" for hint in context_hints)

    def _extract_citation(self, tool_call: dict[str, Any]) -> Citation | None:
        """Extract citation from a tool call if applicable."""
        tool_name = tool_call.get("tool", "")
        args = tool_call.get("args", {})
        result = tool_call.get("result", "")

        if tool_name == "read_file" and args.get("file_path"):
            file_path = args["file_path"]
            start_line = args.get("start_line", 1)
            end_line = args.get("end_line", start_line + 10)

            return Citation.from_content(
                file_path=file_path,
                line_start=start_line,
                line_end=end_line,
                content=result[:500] if isinstance(result, str) else str(result)[:500],
            )

        return None

    def _synthesize_findings(
        self,
        findings: list[str],
        final_message: str,
    ) -> str:
        """Synthesize findings into a summary."""
        if not findings:
            return final_message

        parts = ["## Summary", final_message, "", "## Findings"]
        for i, finding in enumerate(findings, 1):
            parts.append(f"{i}. {finding}")

        return "\n".join(parts)

    def _build_usage(self, wall_time: float) -> RLMUsage:
        """Build usage metrics."""
        cache_stats = self.cache.get_stats()

        return RLMUsage(
            subcall_count=self.budget_manager.total_used,
            cached_subcalls=cache_stats.hits,
            total_tokens=self.agent.total_tokens,
            wall_time_seconds=wall_time,
            model_calls=self.agent.total_iterations,
            budget_limit=self.budget_manager.max_total,
            budget_remaining=self.budget_manager.remaining,
        )

    def explore_sync(
        self,
        query: str,
        context_hints: list[str] | None = None,
        task_id: str | None = None,
    ) -> RLMResult:
        """Synchronous wrapper for explore().

        Args:
            query: The exploration query
            context_hints: Optional context hints
            task_id: Optional task identifier

        Returns:
            RLMResult
        """
        return asyncio.run(self.explore(query, context_hints, task_id))

    @property
    def exploration_count(self) -> int:
        """Return number of explorations run."""
        return self._exploration_count

    def get_stats(self) -> dict[str, Any]:
        """Get orchestrator statistics."""
        return {
            "exploration_count": self._exploration_count,
            "budget_stats": self.budget_manager.to_dict(),
            "cache_stats": self.cache.get_stats().to_dict(),
            "agent_stats": self.agent.get_stats(),
            "config": self.config.to_dict(),
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"RLMOrchestrator(explorations={self._exploration_count}, "
            f"budget={self.budget_manager.remaining}/{self.budget_manager.max_total})"
        )
