"""RLM Agent for codebase exploration.

Implements the core agent logic that iteratively explores a codebase
using tool calls and LLM reasoning.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

from src.workers.rlm.models import (
    ExplorationStep,
    Finding,
    ToolCall,
)
from src.workers.rlm.tools.registry import REPLToolSurface

if TYPE_CHECKING:
    from anthropic import Anthropic

logger = logging.getLogger(__name__)


# System prompt for the exploration agent
EXPLORATION_SYSTEM_PROMPT = """You are a code exploration agent. Your task is to explore a codebase to answer a specific question or find specific information.

You have access to the following tools:
{tool_descriptions}

## Instructions

1. Think step by step about what information you need
2. Use tools to explore the codebase
3. Keep track of what you've found
4. When you have enough information, provide your findings

## Output Format

For each step, provide your response in this format:

<thought>
Your reasoning about what to explore next and why.
</thought>

<tool_calls>
[
  {{"tool": "tool_name", "args": {{"arg1": "value1", "arg2": "value2"}}}}
]
</tool_calls>

<findings>
- Finding 1: Description of what you discovered
- Finding 2: Another discovery
</findings>

<next_direction>
What you plan to explore next, or "DONE" if you have enough information.
</next_direction>

If you have gathered enough information and want to conclude, set next_direction to "DONE" and provide a comprehensive synthesis in your findings.

## Important Notes

- Be systematic and thorough
- Don't repeat the same tool calls
- Focus on the specific question asked
- Cite file paths and line numbers when referencing code
"""


@dataclass
class AgentIteration:
    """Result from a single agent iteration.

    Attributes:
        thought: Agent's reasoning
        tool_calls: Tool calls made in this iteration
        findings: Findings discovered
        next_direction: Planned next direction
        raw_response: Raw LLM response
        is_done: Whether agent signaled completion
    """

    thought: str
    tool_calls: list[dict[str, Any]]
    findings: list[str]
    next_direction: str
    raw_response: str
    is_done: bool

    def to_exploration_step(self, iteration: int, subcalls_used: int) -> ExplorationStep:
        """Convert to ExplorationStep model."""
        tool_call_models = []
        for tc in self.tool_calls:
            tool_call_models.append(
                ToolCall(
                    tool_name=tc.get("tool", "unknown"),
                    arguments=tc.get("args", {}),
                    result=tc.get("result", ""),
                    duration_ms=tc.get("duration_ms", 0),
                    timestamp=datetime.now(timezone.utc),
                )
            )

        return ExplorationStep(
            iteration=iteration,
            thought=self.thought,
            tool_calls=tool_call_models,
            findings_so_far=self.findings,
            next_direction=self.next_direction,
            subcalls_used=subcalls_used,
        )


@dataclass
class RLMAgent:
    """Agent for RLM exploration.

    Executes single iterations of exploration using LLM reasoning
    and tool calls.

    Attributes:
        client: Anthropic client for LLM calls
        tool_surface: REPLToolSurface for tool execution
        model: Model to use for exploration
        max_tokens: Maximum tokens per response

    Example:
        agent = RLMAgent(
            client=anthropic_client,
            tool_surface=tool_surface,
            model="claude-sonnet-4-20250514",
        )

        iteration = agent.run_iteration(
            query="How does the authentication work?",
            context="Looking at auth module",
            history=[],
        )
    """

    client: Any  # Anthropic client
    tool_surface: REPLToolSurface
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096
    _total_iterations: int = field(default=0, init=False)
    _total_tokens: int = field(default=0, init=False)

    def run_iteration(
        self,
        query: str,
        context: str = "",
        history: list[ExplorationStep] | None = None,
        accumulated_findings: list[str] | None = None,
    ) -> AgentIteration:
        """Run a single exploration iteration.

        Args:
            query: The exploration query/question
            context: Additional context or hints
            history: Previous exploration steps
            accumulated_findings: Findings from previous iterations

        Returns:
            AgentIteration with results from this iteration
        """
        self._total_iterations += 1
        start_time = time.perf_counter()

        # Build the system prompt with tool descriptions
        system_prompt = self._build_system_prompt()

        # Build the user message
        user_message = self._build_user_message(
            query=query,
            context=context,
            history=history or [],
            accumulated_findings=accumulated_findings or [],
        )

        # Call the LLM
        response = self._call_llm(system_prompt, user_message)

        # Parse the response
        iteration = self._parse_response(response)

        # Execute tool calls
        iteration = self._execute_tool_calls(iteration)

        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.debug(
            f"Iteration {self._total_iterations} completed in {duration_ms:.1f}ms, "
            f"tool_calls={len(iteration.tool_calls)}, "
            f"findings={len(iteration.findings)}, "
            f"done={iteration.is_done}"
        )

        return iteration

    def _build_system_prompt(self) -> str:
        """Build system prompt with tool descriptions."""
        tool_descriptions = self.tool_surface.get_tool_descriptions()

        tool_desc_text = "\n".join(
            f"- {name}: {desc}" for name, desc in tool_descriptions.items()
        )

        return EXPLORATION_SYSTEM_PROMPT.format(tool_descriptions=tool_desc_text)

    def _build_user_message(
        self,
        query: str,
        context: str,
        history: list[ExplorationStep],
        accumulated_findings: list[str],
    ) -> str:
        """Build the user message for the LLM."""
        parts = []

        # Query
        parts.append(f"## Query\n{query}")

        # Context if provided
        if context:
            parts.append(f"\n## Context\n{context}")

        # Previous findings
        if accumulated_findings:
            findings_text = "\n".join(f"- {f}" for f in accumulated_findings)
            parts.append(f"\n## Findings So Far\n{findings_text}")

        # History summary
        if history:
            history_text = self._summarize_history(history)
            parts.append(f"\n## Exploration History\n{history_text}")

        parts.append(
            "\n## Instructions\n"
            "Continue exploring to answer the query. "
            "Use tools to gather information. "
            "When you have enough information, set next_direction to 'DONE'."
        )

        return "\n".join(parts)

    def _summarize_history(self, history: list[ExplorationStep]) -> str:
        """Summarize exploration history for context."""
        summaries = []
        for step in history[-5:]:  # Last 5 steps only
            tool_names = [tc.tool_name for tc in step.tool_calls]
            summaries.append(
                f"Step {step.iteration}: {step.thought[:100]}... "
                f"(tools: {', '.join(tool_names)})"
            )
        return "\n".join(summaries)

    def _call_llm(self, system_prompt: str, user_message: str) -> str:
        """Call the LLM and return the response."""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        # Track tokens
        if hasattr(response, "usage"):
            self._total_tokens += (
                getattr(response.usage, "input_tokens", 0)
                + getattr(response.usage, "output_tokens", 0)
            )

        # Extract text
        response_text = ""
        if response.content:
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text

        return response_text

    def _parse_response(self, response: str) -> AgentIteration:
        """Parse LLM response into structured format."""
        thought = self._extract_tag(response, "thought")
        tool_calls_json = self._extract_tag(response, "tool_calls")
        findings_raw = self._extract_tag(response, "findings")
        next_direction = self._extract_tag(response, "next_direction")

        # Parse tool calls
        tool_calls: list[dict[str, Any]] = []
        if tool_calls_json:
            try:
                parsed = json.loads(tool_calls_json)
                if isinstance(parsed, list):
                    tool_calls = parsed
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse tool_calls JSON: {tool_calls_json[:100]}")

        # Parse findings
        findings: list[str] = []
        if findings_raw:
            for line in findings_raw.strip().split("\n"):
                line = line.strip()
                if line.startswith("-"):
                    findings.append(line[1:].strip())
                elif line:
                    findings.append(line)

        # Check if done
        is_done = next_direction.strip().upper() == "DONE"

        return AgentIteration(
            thought=thought,
            tool_calls=tool_calls,
            findings=findings,
            next_direction=next_direction,
            raw_response=response,
            is_done=is_done,
        )

    def _extract_tag(self, text: str, tag: str) -> str:
        """Extract content between XML-style tags."""
        pattern = rf"<{tag}>(.*?)</{tag}>"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()
        return ""

    def _execute_tool_calls(self, iteration: AgentIteration) -> AgentIteration:
        """Execute tool calls and add results."""
        executed_calls = []

        for tc in iteration.tool_calls:
            tool_name = tc.get("tool", "")
            args = tc.get("args", {})

            start_time = time.perf_counter()
            result, error = self.tool_surface.invoke_safe(tool_name, **args)
            duration_ms = (time.perf_counter() - start_time) * 1000

            if error:
                result_str = f"Error: {error}"
            else:
                result_str = self._format_tool_result(result)

            executed_calls.append({
                "tool": tool_name,
                "args": args,
                "result": result_str,
                "duration_ms": duration_ms,
                "success": error is None,
            })

        # Replace tool calls with executed versions
        iteration.tool_calls = executed_calls
        return iteration

    def _format_tool_result(self, result: Any, max_length: int = 2000) -> str:
        """Format tool result for inclusion in context."""
        if result is None:
            return "None"

        if isinstance(result, str):
            result_str = result
        elif isinstance(result, (list, dict)):
            try:
                result_str = json.dumps(result, indent=2, default=str)
            except Exception:
                result_str = str(result)
        else:
            result_str = str(result)

        if len(result_str) > max_length:
            return result_str[:max_length] + f"\n... (truncated, {len(result_str)} chars total)"
        return result_str

    def create_finding(
        self,
        description: str,
        evidence: str,
        source_file: str,
        line_range: tuple[int, int] | None = None,
        confidence: float = 1.0,
        tags: list[str] | None = None,
    ) -> Finding:
        """Create a Finding object from exploration results.

        Args:
            description: Human-readable description
            evidence: Supporting code/text
            source_file: File where finding was made
            line_range: Optional (start, end) line numbers
            confidence: Confidence score (0-1)
            tags: Optional categorization tags

        Returns:
            Finding object
        """
        return Finding(
            description=description,
            evidence=evidence,
            source_file=source_file,
            line_range=line_range,
            confidence=confidence,
            tags=tags or [],
        )

    @property
    def total_iterations(self) -> int:
        """Return total iterations executed."""
        return self._total_iterations

    @property
    def total_tokens(self) -> int:
        """Return total tokens used."""
        return self._total_tokens

    def get_stats(self) -> dict[str, Any]:
        """Get agent statistics."""
        return {
            "total_iterations": self._total_iterations,
            "total_tokens": self._total_tokens,
            "model": self.model,
            "tool_surface_stats": self.tool_surface.get_stats(),
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"RLMAgent(model={self.model}, "
            f"iterations={self._total_iterations}, "
            f"tokens={self._total_tokens})"
        )
