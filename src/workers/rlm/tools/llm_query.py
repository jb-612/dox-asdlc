"""LLM query tool for RLM exploration.

Provides sub-call capability to query a smaller/faster LLM model
for focused analysis during exploration.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

from src.core.exceptions import BudgetExceededError, RLMError
from src.workers.rlm.budget_manager import SubCallBudgetManager
from src.workers.rlm.cache import SubCallCache

if TYPE_CHECKING:
    from anthropic import Anthropic

logger = logging.getLogger(__name__)


class LLMClient(Protocol):
    """Protocol for LLM client interface.

    This allows for dependency injection and easier testing.
    """

    def messages_create(
        self,
        model: str,
        max_tokens: int,
        messages: list[dict[str, Any]],
    ) -> Any:
        """Create a message completion."""
        ...


@dataclass
class LLMQueryResult:
    """Result from an LLM query.

    Attributes:
        response: The LLM's response text
        cached: Whether the result came from cache
        tokens_used: Number of tokens used (0 if cached)
        duration_ms: Query duration in milliseconds
        model: Model used for the query
    """

    response: str
    cached: bool
    tokens_used: int
    duration_ms: float
    model: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "response": self.response,
            "cached": self.cached,
            "tokens_used": self.tokens_used,
            "duration_ms": self.duration_ms,
            "model": self.model,
        }


@dataclass
class LLMQueryTool:
    """LLM query tool for sub-calls during RLM exploration.

    Integrates with budget management and caching to efficiently
    make focused LLM queries during exploration.

    Attributes:
        client: Anthropic client for API calls
        budget_manager: Budget manager for tracking sub-calls
        cache: Cache for storing query results
        model: Model identifier to use for queries
        max_tokens: Maximum tokens per response
        default_system_prompt: Default system prompt for queries

    Example:
        from anthropic import Anthropic

        client = Anthropic()
        budget = SubCallBudgetManager(max_total=50)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
            model="claude-3-5-haiku-20241022",
        )

        result = await tool.query(
            prompt="What does this function do?",
            context="def foo(): return 42",
        )
    """

    client: Any  # Anthropic client
    budget_manager: SubCallBudgetManager
    cache: SubCallCache
    model: str = "claude-3-5-haiku-20241022"
    max_tokens: int = 500
    default_system_prompt: str = field(
        default=(
            "You are a code analysis assistant. Provide concise, accurate "
            "analysis of the code or question provided. Focus on the specific "
            "question asked and be direct in your response."
        )
    )
    _total_tokens_used: int = field(default=0, init=False)
    _total_queries: int = field(default=0, init=False)
    _cached_queries: int = field(default=0, init=False)

    def query(
        self,
        prompt: str,
        context: str = "",
        system_prompt: str | None = None,
        max_tokens: int | None = None,
    ) -> LLMQueryResult:
        """Execute an LLM query.

        Args:
            prompt: The question or instruction for the LLM
            context: Additional context (code, text) to analyze
            system_prompt: Optional override for system prompt
            max_tokens: Optional override for max tokens

        Returns:
            LLMQueryResult with response and metadata

        Raises:
            BudgetExceededError: If sub-call budget is exhausted
            RLMError: If the API call fails
        """
        start_time = time.perf_counter()
        self._total_queries += 1

        # Check budget before proceeding
        if not self.budget_manager.can_make_call():
            raise BudgetExceededError(
                message="Cannot make LLM query: sub-call budget exceeded",
                budget_limit=self.budget_manager.max_total,
                subcalls_used=self.budget_manager.total_used,
            )

        # Build the full prompt for cache key
        full_context = self._build_context(prompt, context)

        # Check cache first
        cached_result = self.cache.get(prompt, full_context)
        if cached_result is not None:
            self._cached_queries += 1
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.debug(f"Cache hit for query (length: {len(prompt)})")
            return LLMQueryResult(
                response=cached_result,
                cached=True,
                tokens_used=0,
                duration_ms=duration_ms,
                model=self.model,
            )

        # Record the sub-call (this will raise if budget exceeded)
        self.budget_manager.record_call()

        # Make the API call
        try:
            result = self._make_api_call(
                prompt=prompt,
                context=context,
                system_prompt=system_prompt or self.default_system_prompt,
                max_tokens=max_tokens or self.max_tokens,
            )
        except Exception as e:
            # Log but re-raise as RLMError
            logger.error(f"LLM API call failed: {e}")
            raise RLMError(f"LLM query failed: {e}") from e

        # Cache the result
        self.cache.set(prompt, full_context, result.response)

        duration_ms = (time.perf_counter() - start_time) * 1000
        self._total_tokens_used += result.tokens_used

        logger.debug(
            f"LLM query completed: {result.tokens_used} tokens, "
            f"{duration_ms:.1f}ms, model={self.model}"
        )

        return LLMQueryResult(
            response=result.response,
            cached=False,
            tokens_used=result.tokens_used,
            duration_ms=duration_ms,
            model=self.model,
        )

    def _build_context(self, prompt: str, context: str) -> str:
        """Build the full context string for caching.

        Args:
            prompt: The prompt
            context: Additional context

        Returns:
            Combined context string
        """
        if context:
            return f"Context:\n{context}\n\nPrompt:\n{prompt}"
        return prompt

    def _make_api_call(
        self,
        prompt: str,
        context: str,
        system_prompt: str,
        max_tokens: int,
    ) -> LLMQueryResult:
        """Make the actual API call to the LLM.

        Args:
            prompt: The prompt
            context: Additional context
            system_prompt: System prompt to use
            max_tokens: Maximum tokens for response

        Returns:
            LLMQueryResult with response
        """
        # Build user message with context
        if context:
            user_content = f"Context:\n```\n{context}\n```\n\n{prompt}"
        else:
            user_content = prompt

        messages = [{"role": "user", "content": user_content}]

        # Call the Anthropic API
        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )

        # Extract response text
        response_text = ""
        if response.content:
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text

        # Calculate tokens used
        tokens_used = 0
        if hasattr(response, "usage"):
            tokens_used = (
                getattr(response.usage, "input_tokens", 0)
                + getattr(response.usage, "output_tokens", 0)
            )

        return LLMQueryResult(
            response=response_text,
            cached=False,
            tokens_used=tokens_used,
            duration_ms=0,  # Will be set by caller
            model=self.model,
        )

    def query_with_retry(
        self,
        prompt: str,
        context: str = "",
        max_retries: int = 2,
        **kwargs: Any,
    ) -> LLMQueryResult:
        """Execute an LLM query with retry on transient failures.

        Args:
            prompt: The question or instruction
            context: Additional context
            max_retries: Maximum retry attempts
            **kwargs: Additional arguments for query()

        Returns:
            LLMQueryResult with response

        Raises:
            BudgetExceededError: If budget exceeded
            RLMError: If all retries fail
        """
        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                return self.query(prompt, context, **kwargs)
            except BudgetExceededError:
                # Don't retry budget errors
                raise
            except RLMError as e:
                last_error = e
                if attempt < max_retries:
                    logger.warning(
                        f"LLM query failed (attempt {attempt + 1}/{max_retries + 1}): {e}"
                    )
                    # Simple exponential backoff
                    time.sleep(0.5 * (2**attempt))

        raise RLMError(f"LLM query failed after {max_retries + 1} attempts") from last_error

    def can_query(self) -> bool:
        """Check if a query can be made within budget.

        Returns:
            True if budget allows a query
        """
        return self.budget_manager.can_make_call()

    @property
    def total_tokens_used(self) -> int:
        """Return total tokens used across all queries."""
        return self._total_tokens_used

    @property
    def total_queries(self) -> int:
        """Return total number of queries made."""
        return self._total_queries

    @property
    def cached_queries(self) -> int:
        """Return number of queries served from cache."""
        return self._cached_queries

    @property
    def cache_hit_rate(self) -> float:
        """Return cache hit rate as percentage."""
        if self._total_queries == 0:
            return 0.0
        return (self._cached_queries / self._total_queries) * 100

    def get_stats(self) -> dict[str, Any]:
        """Get query statistics.

        Returns:
            Dictionary with query stats
        """
        return {
            "total_queries": self._total_queries,
            "cached_queries": self._cached_queries,
            "cache_hit_rate": self.cache_hit_rate,
            "total_tokens_used": self._total_tokens_used,
            "budget_remaining": self.budget_manager.remaining,
            "budget_total": self.budget_manager.max_total,
        }

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"LLMQueryTool(model={self.model}, "
            f"queries={self._total_queries}, "
            f"tokens={self._total_tokens_used})"
        )
