"""Unit tests for RLMAgent."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from unittest.mock import Mock, MagicMock

import pytest

from src.workers.rlm.agent import RLMAgent, AgentIteration, EXPLORATION_SYSTEM_PROMPT
from src.workers.rlm.models import ExplorationStep, ToolCall


# Mock structures for Anthropic responses
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


def create_mock_response(text: str, tokens: int = 100) -> MockResponse:
    """Create a mock Anthropic response."""
    return MockResponse(
        content=[MockTextBlock(text=text)],
        usage=MockUsage(input_tokens=tokens // 2, output_tokens=tokens // 2),
    )


def create_mock_client(response_text: str, tokens: int = 100) -> Mock:
    """Create a mock Anthropic client."""
    mock_client = Mock()
    mock_client.messages.create.return_value = create_mock_response(response_text, tokens)
    return mock_client


def create_mock_tool_surface() -> Mock:
    """Create a mock REPLToolSurface."""
    mock_surface = Mock()
    mock_surface.get_tool_descriptions.return_value = {
        "list_files": "List files in a directory",
        "read_file": "Read file contents",
        "grep": "Search for patterns",
    }
    mock_surface.invoke_safe.return_value = (["file1.py", "file2.py"], None)
    mock_surface.get_stats.return_value = {"total_invocations": 0}
    return mock_surface


class TestAgentIteration:
    """Tests for AgentIteration dataclass."""

    def test_create_iteration(self) -> None:
        """Test creating an iteration result."""
        iteration = AgentIteration(
            thought="I need to find the auth module",
            tool_calls=[{"tool": "grep", "args": {"pattern": "auth"}}],
            findings=["Found auth.py in src/"],
            next_direction="Read the auth.py file",
            raw_response="<thought>...</thought>",
            is_done=False,
        )

        assert iteration.thought == "I need to find the auth module"
        assert len(iteration.tool_calls) == 1
        assert len(iteration.findings) == 1
        assert iteration.is_done is False

    def test_iteration_done(self) -> None:
        """Test iteration with done flag."""
        iteration = AgentIteration(
            thought="I have all the information",
            tool_calls=[],
            findings=["Complete analysis of auth system"],
            next_direction="DONE",
            raw_response="",
            is_done=True,
        )

        assert iteration.is_done is True

    def test_to_exploration_step(self) -> None:
        """Test conversion to ExplorationStep."""
        iteration = AgentIteration(
            thought="Testing conversion",
            tool_calls=[
                {
                    "tool": "list_files",
                    "args": {"directory": "src/"},
                    "result": '["file.py"]',
                    "duration_ms": 5.0,
                }
            ],
            findings=["Found files"],
            next_direction="Continue",
            raw_response="",
            is_done=False,
        )

        step = iteration.to_exploration_step(iteration=3, subcalls_used=1)

        assert step.iteration == 3
        assert step.thought == "Testing conversion"
        assert step.subcalls_used == 1
        assert len(step.tool_calls) == 1
        assert step.tool_calls[0].tool_name == "list_files"


class TestRLMAgentCreation:
    """Tests for RLMAgent creation."""

    def test_create_with_defaults(self) -> None:
        """Test creating agent with defaults."""
        client = create_mock_client("<thought>test</thought>")
        surface = create_mock_tool_surface()

        agent = RLMAgent(
            client=client,
            tool_surface=surface,
        )

        assert agent.model == "claude-sonnet-4-20250514"
        assert agent.max_tokens == 4096
        assert agent.total_iterations == 0

    def test_create_with_custom_model(self) -> None:
        """Test creating agent with custom model."""
        client = create_mock_client("<thought>test</thought>")
        surface = create_mock_tool_surface()

        agent = RLMAgent(
            client=client,
            tool_surface=surface,
            model="claude-3-opus-20240229",
            max_tokens=8192,
        )

        assert agent.model == "claude-3-opus-20240229"
        assert agent.max_tokens == 8192


class TestRLMAgentRunIteration:
    """Tests for run_iteration method."""

    def test_basic_iteration(self) -> None:
        """Test running a basic iteration."""
        response_text = """
<thought>
I need to find Python files in the src directory.
</thought>

<tool_calls>
[{"tool": "list_files", "args": {"directory": "src/", "pattern": "*.py"}}]
</tool_calls>

<findings>
- Found the source directory structure
</findings>

<next_direction>
Read the main.py file
</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        iteration = agent.run_iteration(
            query="What files are in the project?",
        )

        assert "find Python files" in iteration.thought
        assert len(iteration.tool_calls) == 1
        assert iteration.tool_calls[0]["tool"] == "list_files"
        assert iteration.is_done is False
        assert agent.total_iterations == 1

    def test_iteration_with_context(self) -> None:
        """Test iteration with context provided."""
        response_text = """
<thought>Looking at auth</thought>
<tool_calls>[]</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        agent.run_iteration(
            query="How does auth work?",
            context="Focus on the OAuth implementation",
        )

        # Verify context was included in the call
        call_args = client.messages.create.call_args
        user_message = call_args.kwargs["messages"][0]["content"]
        assert "OAuth implementation" in user_message

    def test_iteration_with_history(self) -> None:
        """Test iteration with exploration history."""
        response_text = """
<thought>Continuing exploration</thought>
<tool_calls>[]</tool_calls>
<findings></findings>
<next_direction>Done</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        history = [
            ExplorationStep(
                iteration=0,
                thought="Previous step",
                tool_calls=[],
                findings_so_far=["Found something"],
                next_direction="Continue",
            )
        ]

        agent.run_iteration(
            query="Continue investigation",
            history=history,
        )

        call_args = client.messages.create.call_args
        user_message = call_args.kwargs["messages"][0]["content"]
        assert "Exploration History" in user_message

    def test_iteration_with_accumulated_findings(self) -> None:
        """Test iteration with accumulated findings."""
        response_text = """
<thought>Building on findings</thought>
<tool_calls>[]</tool_calls>
<findings></findings>
<next_direction>DONE</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        agent.run_iteration(
            query="Summarize findings",
            accumulated_findings=["Finding 1", "Finding 2"],
        )

        call_args = client.messages.create.call_args
        user_message = call_args.kwargs["messages"][0]["content"]
        assert "Findings So Far" in user_message
        assert "Finding 1" in user_message

    def test_iteration_done_detection(self) -> None:
        """Test that DONE is detected correctly."""
        response_text = """
<thought>Complete</thought>
<tool_calls>[]</tool_calls>
<findings>- Final finding</findings>
<next_direction>DONE</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        iteration = agent.run_iteration(query="Test")

        assert iteration.is_done is True


class TestRLMAgentToolExecution:
    """Tests for tool execution during iteration."""

    def test_tool_calls_executed(self) -> None:
        """Test that tool calls are executed."""
        response_text = """
<thought>Running tools</thought>
<tool_calls>
[{"tool": "list_files", "args": {"directory": "src/"}}]
</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        iteration = agent.run_iteration(query="List files")

        # Verify tool was invoked
        surface.invoke_safe.assert_called_once_with("list_files", directory="src/")

        # Verify result was captured
        assert len(iteration.tool_calls) == 1
        assert "result" in iteration.tool_calls[0]

    def test_multiple_tool_calls(self) -> None:
        """Test multiple tool calls in one iteration."""
        response_text = """
<thought>Multiple tools</thought>
<tool_calls>
[
  {"tool": "list_files", "args": {"directory": "src/"}},
  {"tool": "grep", "args": {"pattern": "TODO"}}
]
</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        iteration = agent.run_iteration(query="Test")

        assert len(iteration.tool_calls) == 2
        assert surface.invoke_safe.call_count == 2

    def test_tool_error_captured(self) -> None:
        """Test that tool errors are captured."""
        response_text = """
<thought>Test</thought>
<tool_calls>
[{"tool": "bad_tool", "args": {}}]
</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()
        surface.invoke_safe.return_value = (None, "Unknown tool: bad_tool")

        agent = RLMAgent(client=client, tool_surface=surface)

        iteration = agent.run_iteration(query="Test")

        assert "Error" in iteration.tool_calls[0]["result"]
        assert iteration.tool_calls[0]["success"] is False


class TestRLMAgentParsing:
    """Tests for response parsing."""

    def test_parse_thought(self) -> None:
        """Test parsing thought tag."""
        response_text = """
<thought>
This is my reasoning about the code.
It spans multiple lines.
</thought>
<tool_calls>[]</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        assert "reasoning about the code" in iteration.thought
        assert "multiple lines" in iteration.thought

    def test_parse_findings(self) -> None:
        """Test parsing findings list."""
        response_text = """
<thought>Found things</thought>
<tool_calls>[]</tool_calls>
<findings>
- First finding about the code
- Second finding with details
- Third finding
</findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        assert len(iteration.findings) == 3
        assert "First finding" in iteration.findings[0]

    def test_parse_invalid_tool_calls(self) -> None:
        """Test parsing with invalid JSON in tool_calls."""
        response_text = """
<thought>Test</thought>
<tool_calls>
not valid json
</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        # Should handle gracefully
        assert iteration.tool_calls == []

    def test_parse_missing_tags(self) -> None:
        """Test parsing response with missing tags."""
        response_text = """
Just some text without proper tags.
"""
        client = create_mock_client(response_text)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        # Should handle gracefully
        assert iteration.thought == ""
        assert iteration.tool_calls == []
        assert iteration.findings == []


class TestRLMAgentSystemPrompt:
    """Tests for system prompt generation."""

    def test_system_prompt_includes_tools(self) -> None:
        """Test that system prompt includes tool descriptions."""
        client = create_mock_client("<thought>test</thought>")
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)
        agent.run_iteration(query="Test")

        call_args = client.messages.create.call_args
        system_prompt = call_args.kwargs["system"]

        assert "list_files" in system_prompt
        assert "read_file" in system_prompt
        assert "grep" in system_prompt


class TestRLMAgentFinding:
    """Tests for finding creation."""

    def test_create_finding(self) -> None:
        """Test creating a finding."""
        client = create_mock_client("<thought>test</thought>")
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        finding = agent.create_finding(
            description="Found authentication logic",
            evidence="def authenticate(user): ...",
            source_file="src/auth.py",
            line_range=(10, 25),
            confidence=0.9,
            tags=["auth", "security"],
        )

        assert finding.description == "Found authentication logic"
        assert finding.source_file == "src/auth.py"
        assert finding.line_range == (10, 25)
        assert finding.confidence == 0.9
        assert "auth" in finding.tags


class TestRLMAgentStats:
    """Tests for statistics tracking."""

    def test_iteration_count(self) -> None:
        """Test iteration counting."""
        client = create_mock_client("<thought>test</thought>")
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        agent.run_iteration(query="Test 1")
        agent.run_iteration(query="Test 2")
        agent.run_iteration(query="Test 3")

        assert agent.total_iterations == 3

    def test_token_tracking(self) -> None:
        """Test token usage tracking."""
        client = create_mock_client("<thought>test</thought>", tokens=200)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        agent.run_iteration(query="Test")

        assert agent.total_tokens == 200

    def test_get_stats(self) -> None:
        """Test get_stats method."""
        client = create_mock_client("<thought>test</thought>", tokens=150)
        surface = create_mock_tool_surface()

        agent = RLMAgent(client=client, tool_surface=surface)

        agent.run_iteration(query="Test")

        stats = agent.get_stats()

        assert stats["total_iterations"] == 1
        assert stats["total_tokens"] == 150
        assert "tool_surface_stats" in stats

    def test_repr(self) -> None:
        """Test string representation."""
        client = create_mock_client("<thought>test</thought>", tokens=100)
        surface = create_mock_tool_surface()

        agent = RLMAgent(
            client=client,
            tool_surface=surface,
            model="test-model",
        )
        agent.run_iteration(query="Test")

        repr_str = repr(agent)

        assert "test-model" in repr_str
        assert "iterations=1" in repr_str
        assert "tokens=100" in repr_str


class TestRLMAgentToolResultFormatting:
    """Tests for tool result formatting."""

    def test_format_string_result(self) -> None:
        """Test formatting string result."""
        client = create_mock_client("""
<thought>Test</thought>
<tool_calls>[{"tool": "read_file", "args": {"file_path": "test.py"}}]</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
""")
        surface = create_mock_tool_surface()
        surface.invoke_safe.return_value = ("def hello(): pass", None)

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        assert iteration.tool_calls[0]["result"] == "def hello(): pass"

    def test_format_list_result(self) -> None:
        """Test formatting list result."""
        client = create_mock_client("""
<thought>Test</thought>
<tool_calls>[{"tool": "list_files", "args": {}}]</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
""")
        surface = create_mock_tool_surface()
        surface.invoke_safe.return_value = (["a.py", "b.py"], None)

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        assert "a.py" in iteration.tool_calls[0]["result"]
        assert "b.py" in iteration.tool_calls[0]["result"]

    def test_format_long_result_truncated(self) -> None:
        """Test that long results are truncated."""
        client = create_mock_client("""
<thought>Test</thought>
<tool_calls>[{"tool": "read_file", "args": {}}]</tool_calls>
<findings></findings>
<next_direction>Continue</next_direction>
""")
        surface = create_mock_tool_surface()
        long_content = "x" * 5000
        surface.invoke_safe.return_value = (long_content, None)

        agent = RLMAgent(client=client, tool_surface=surface)
        iteration = agent.run_iteration(query="Test")

        result = iteration.tool_calls[0]["result"]
        assert len(result) < 5000
        assert "truncated" in result
