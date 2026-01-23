"""Unit tests for LLM query tool."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest

from src.core.exceptions import BudgetExceededError, RLMError
from src.workers.rlm.budget_manager import SubCallBudgetManager
from src.workers.rlm.cache import SubCallCache
from src.workers.rlm.tools.llm_query import LLMQueryResult, LLMQueryTool


# Mock Anthropic response structures
@dataclass
class MockTextBlock:
    """Mock text block from Anthropic response."""

    text: str
    type: str = "text"


@dataclass
class MockUsage:
    """Mock usage from Anthropic response."""

    input_tokens: int
    output_tokens: int


@dataclass
class MockResponse:
    """Mock Anthropic API response."""

    content: list[MockTextBlock]
    usage: MockUsage
    id: str = "msg_123"
    model: str = "claude-3-5-haiku-20241022"
    role: str = "assistant"
    type: str = "message"


def create_mock_client(response_text: str = "Test response", tokens: int = 100) -> Mock:
    """Create a mock Anthropic client."""
    mock_client = Mock()
    mock_response = MockResponse(
        content=[MockTextBlock(text=response_text)],
        usage=MockUsage(input_tokens=tokens // 2, output_tokens=tokens // 2),
    )
    mock_client.messages.create.return_value = mock_response
    return mock_client


class TestLLMQueryResult:
    """Tests for LLMQueryResult dataclass."""

    def test_create_result(self) -> None:
        """Test creating a query result."""
        result = LLMQueryResult(
            response="Test response",
            cached=False,
            tokens_used=100,
            duration_ms=50.5,
            model="claude-3-5-haiku-20241022",
        )

        assert result.response == "Test response"
        assert result.cached is False
        assert result.tokens_used == 100
        assert result.duration_ms == 50.5
        assert result.model == "claude-3-5-haiku-20241022"

    def test_cached_result(self) -> None:
        """Test cached result has zero tokens."""
        result = LLMQueryResult(
            response="Cached response",
            cached=True,
            tokens_used=0,
            duration_ms=1.0,
            model="claude-3-5-haiku-20241022",
        )

        assert result.cached is True
        assert result.tokens_used == 0

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        result = LLMQueryResult(
            response="Test",
            cached=False,
            tokens_used=50,
            duration_ms=25.0,
            model="test-model",
        )

        data = result.to_dict()

        assert data["response"] == "Test"
        assert data["cached"] is False
        assert data["tokens_used"] == 50
        assert data["duration_ms"] == 25.0
        assert data["model"] == "test-model"


class TestLLMQueryToolCreation:
    """Tests for LLMQueryTool creation and configuration."""

    def test_create_with_defaults(self) -> None:
        """Test creating tool with default settings."""
        client = create_mock_client()
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        assert tool.model == "claude-3-5-haiku-20241022"
        assert tool.max_tokens == 500
        assert tool.total_queries == 0
        assert tool.total_tokens_used == 0

    def test_create_with_custom_settings(self) -> None:
        """Test creating tool with custom settings."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=100)
        cache = SubCallCache(enabled=False)

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
            model="claude-3-opus-20240229",
            max_tokens=1000,
        )

        assert tool.model == "claude-3-opus-20240229"
        assert tool.max_tokens == 1000

    def test_custom_system_prompt(self) -> None:
        """Test setting custom system prompt."""
        client = create_mock_client()
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
            default_system_prompt="Custom system prompt",
        )

        assert tool.default_system_prompt == "Custom system prompt"


class TestLLMQueryToolQuery:
    """Tests for the query method."""

    def test_basic_query(self) -> None:
        """Test basic query execution."""
        client = create_mock_client(response_text="Hello, world!", tokens=50)
        budget = SubCallBudgetManager(max_total=10)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        result = tool.query("What is 2+2?")

        assert result.response == "Hello, world!"
        assert result.cached is False
        assert result.tokens_used == 50
        assert result.duration_ms > 0
        assert tool.total_queries == 1
        assert budget.total_used == 1

    def test_query_with_context(self) -> None:
        """Test query with context."""
        client = create_mock_client(response_text="Function returns 42")
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        result = tool.query(
            prompt="What does this function return?",
            context="def foo():\n    return 42",
        )

        assert result.response == "Function returns 42"
        # Verify context was included in the API call
        call_args = client.messages.create.call_args
        user_message = call_args.kwargs["messages"][0]["content"]
        assert "def foo():" in user_message
        assert "return 42" in user_message

    def test_query_with_custom_system_prompt(self) -> None:
        """Test query with custom system prompt override."""
        client = create_mock_client()
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        tool.query(
            prompt="Analyze this",
            system_prompt="You are a security expert.",
        )

        call_args = client.messages.create.call_args
        assert call_args.kwargs["system"] == "You are a security expert."

    def test_query_with_custom_max_tokens(self) -> None:
        """Test query with custom max_tokens override."""
        client = create_mock_client()
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
            max_tokens=500,
        )

        tool.query(prompt="Test", max_tokens=1000)

        call_args = client.messages.create.call_args
        assert call_args.kwargs["max_tokens"] == 1000


class TestLLMQueryToolCaching:
    """Tests for caching behavior."""

    def test_cache_hit(self) -> None:
        """Test that cached results are returned."""
        client = create_mock_client(response_text="API response")
        budget = SubCallBudgetManager(max_total=10)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        # First query - cache miss
        result1 = tool.query("What is 2+2?")
        assert result1.cached is False
        assert budget.total_used == 1

        # Second query - cache hit
        result2 = tool.query("What is 2+2?")
        assert result2.cached is True
        assert result2.tokens_used == 0
        assert budget.total_used == 1  # No additional budget used

        # Verify API was only called once
        assert client.messages.create.call_count == 1

    def test_cache_disabled(self) -> None:
        """Test behavior with cache disabled."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=10)
        cache = SubCallCache(enabled=False)

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        # Two identical queries
        tool.query("What is 2+2?")
        tool.query("What is 2+2?")

        # Both should hit the API
        assert client.messages.create.call_count == 2
        assert budget.total_used == 2

    def test_different_context_not_cached(self) -> None:
        """Test that different context creates different cache entries."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=10)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        tool.query("Analyze", context="code1")
        tool.query("Analyze", context="code2")

        assert client.messages.create.call_count == 2

    def test_cache_hit_rate_tracking(self) -> None:
        """Test cache hit rate calculation."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=20)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        # 4 queries, 2 unique
        tool.query("Query A")
        tool.query("Query B")
        tool.query("Query A")  # Cache hit
        tool.query("Query B")  # Cache hit

        assert tool.total_queries == 4
        assert tool.cached_queries == 2
        assert tool.cache_hit_rate == 50.0


class TestLLMQueryToolBudget:
    """Tests for budget management integration."""

    def test_budget_exceeded_prevents_query(self) -> None:
        """Test that exceeding budget raises BudgetExceededError."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=2)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        # Use up budget
        tool.query("Query 1")
        tool.query("Query 2")

        # Third query should fail
        with pytest.raises(BudgetExceededError) as exc_info:
            tool.query("Query 3")

        assert exc_info.value.budget_limit == 2
        assert exc_info.value.subcalls_used == 2

    def test_iteration_budget_respected(self) -> None:
        """Test that iteration budget is respected."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=10, max_per_iteration=2)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        # Use iteration budget
        tool.query("Query 1")
        tool.query("Query 2")

        # Third query should fail due to iteration limit
        with pytest.raises(BudgetExceededError):
            tool.query("Query 3")

        # Reset iteration
        budget.reset_iteration()

        # Now should work
        result = tool.query("Query 3")
        assert result.response is not None

    def test_can_query_check(self) -> None:
        """Test can_query() method."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=1)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        assert tool.can_query() is True

        tool.query("Query 1")

        assert tool.can_query() is False

    def test_cached_query_doesnt_use_budget(self) -> None:
        """Test that cached queries don't consume budget."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=1)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        # First query uses budget
        tool.query("Query 1")
        assert budget.total_used == 1
        assert tool.can_query() is False

        # Cached query should still work
        result = tool.query("Query 1")
        assert result.cached is True
        assert budget.total_used == 1  # No additional budget used


class TestLLMQueryToolErrors:
    """Tests for error handling."""

    def test_api_error_raises_rlm_error(self) -> None:
        """Test that API errors are wrapped in RLMError."""
        client = Mock()
        client.messages.create.side_effect = Exception("API unavailable")
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        with pytest.raises(RLMError) as exc_info:
            tool.query("Test query")

        assert "API unavailable" in str(exc_info.value)

    def test_api_error_still_consumes_budget(self) -> None:
        """Test that failed API calls still consume budget."""
        client = Mock()
        client.messages.create.side_effect = Exception("API error")
        budget = SubCallBudgetManager(max_total=5)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        with pytest.raises(RLMError):
            tool.query("Test query")

        # Budget was consumed before the API call failed
        assert budget.total_used == 1


class TestLLMQueryToolRetry:
    """Tests for retry functionality."""

    def test_retry_on_failure(self) -> None:
        """Test that query_with_retry retries on failure."""
        client = Mock()
        # Fail twice, then succeed
        client.messages.create.side_effect = [
            Exception("Transient error 1"),
            Exception("Transient error 2"),
            MockResponse(
                content=[MockTextBlock(text="Success")],
                usage=MockUsage(input_tokens=10, output_tokens=10),
            ),
        ]
        budget = SubCallBudgetManager(max_total=10)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        result = tool.query_with_retry("Test", max_retries=2)

        assert result.response == "Success"
        assert client.messages.create.call_count == 3

    def test_retry_exhausted(self) -> None:
        """Test that retry gives up after max attempts."""
        client = Mock()
        client.messages.create.side_effect = Exception("Persistent error")
        budget = SubCallBudgetManager(max_total=10)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        with pytest.raises(RLMError) as exc_info:
            tool.query_with_retry("Test", max_retries=2)

        assert "failed after 3 attempts" in str(exc_info.value)

    def test_retry_does_not_retry_budget_error(self) -> None:
        """Test that BudgetExceededError is not retried."""
        client = create_mock_client()
        budget = SubCallBudgetManager(max_total=0)  # No budget
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        with pytest.raises(BudgetExceededError):
            tool.query_with_retry("Test", max_retries=5)

        # API should never have been called
        assert client.messages.create.call_count == 0


class TestLLMQueryToolStats:
    """Tests for statistics tracking."""

    def test_get_stats(self) -> None:
        """Test get_stats() method."""
        client = create_mock_client(tokens=100)
        budget = SubCallBudgetManager(max_total=50)
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        tool.query("Query 1")
        tool.query("Query 2")
        tool.query("Query 1")  # Cache hit

        stats = tool.get_stats()

        assert stats["total_queries"] == 3
        assert stats["cached_queries"] == 1
        assert stats["cache_hit_rate"] == pytest.approx(33.33, rel=0.1)
        assert stats["total_tokens_used"] == 200  # 2 API calls * 100 tokens
        assert stats["budget_remaining"] == 48
        assert stats["budget_total"] == 50

    def test_repr(self) -> None:
        """Test string representation."""
        client = create_mock_client(tokens=50)
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
            model="test-model",
        )

        tool.query("Test")

        repr_str = repr(tool)

        assert "test-model" in repr_str
        assert "queries=1" in repr_str
        assert "tokens=50" in repr_str


class TestLLMQueryToolMultipleBlocks:
    """Tests for handling multiple content blocks."""

    def test_multiple_text_blocks(self) -> None:
        """Test handling of multiple text blocks in response."""
        client = Mock()
        mock_response = MockResponse(
            content=[
                MockTextBlock(text="Part 1. "),
                MockTextBlock(text="Part 2."),
            ],
            usage=MockUsage(input_tokens=10, output_tokens=20),
        )
        client.messages.create.return_value = mock_response
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        result = tool.query("Test")

        assert result.response == "Part 1. Part 2."

    def test_empty_response(self) -> None:
        """Test handling of empty response."""
        client = Mock()
        mock_response = MockResponse(
            content=[],
            usage=MockUsage(input_tokens=10, output_tokens=0),
        )
        client.messages.create.return_value = mock_response
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        result = tool.query("Test")

        assert result.response == ""


class TestLLMQueryToolBuildContext:
    """Tests for context building."""

    def test_build_context_with_context(self) -> None:
        """Test context building with context provided."""
        client = create_mock_client()
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        context = tool._build_context("prompt", "context data")

        assert "Context:" in context
        assert "context data" in context
        assert "prompt" in context

    def test_build_context_without_context(self) -> None:
        """Test context building without context."""
        client = create_mock_client()
        budget = SubCallBudgetManager()
        cache = SubCallCache()

        tool = LLMQueryTool(
            client=client,
            budget_manager=budget,
            cache=cache,
        )

        context = tool._build_context("just the prompt", "")

        assert context == "just the prompt"
