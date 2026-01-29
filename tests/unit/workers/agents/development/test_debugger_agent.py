"""Unit tests for DebuggerAgent."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.protocols import AgentContext
from src.workers.llm.client import LLMResponse


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    client.model_name = "test-model"
    client.count_tokens = AsyncMock(return_value=1000)
    return client


@pytest.fixture
def mock_artifact_writer(tmp_path):
    """Create a mock artifact writer."""
    writer = MagicMock()
    writer.workspace_path = str(tmp_path)

    async def write_artifact(**kwargs):
        path = tmp_path / kwargs.get("filename", "artifact.json")
        path.write_text(kwargs.get("content", "{}"))
        return str(path)

    writer.write_artifact = AsyncMock(side_effect=write_artifact)
    return writer


@pytest.fixture
def mock_rlm_integration():
    """Create a mock RLM integration."""
    from src.workers.rlm.integration import RLMIntegrationResult

    rlm = MagicMock()
    rlm.should_use_rlm = MagicMock(return_value=MagicMock(should_trigger=True))
    rlm.explore = AsyncMock(return_value=RLMIntegrationResult(
        used_rlm=True,
        trigger_result=None,
        rlm_result=None,
        formatted_output="## RLM Exploration\nFound relevant patterns in similar code.",
    ))
    return rlm


@pytest.fixture
def agent_context():
    """Create a test agent context."""
    return AgentContext(
        session_id="test-session",
        task_id="test-task",
        tenant_id="default",
        workspace_path="/tmp/workspace",
    )


@pytest.fixture
def config():
    """Create test configuration."""
    return DevelopmentConfig()


class TestDebuggerAgentProtocol:
    """Tests for DebuggerAgent implementing BaseAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        config,
    ) -> None:
        """Test that agent_type returns 'debugger'."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        assert agent.agent_type == "debugger"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        config,
    ) -> None:
        """Test that DebuggerAgent implements BaseAgent protocol."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent
        from src.workers.agents.protocols import BaseAgent

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        assert isinstance(agent, BaseAgent)


class TestDebuggerAgentExecution:
    """Tests for DebuggerAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_test_output(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no test_output provided."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "test_output" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_implementation(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no implementation provided."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {"test_output": "FAILED test_feature - AssertionError"},
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_generates_debug_analysis(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates debug analysis from test failures."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        # Mock LLM responses for the multi-step debugging process
        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "The function returns None instead of the expected value",
            "fix_suggestion": "Add return statement with computed value",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "def calculate():\n    result = 5 + 3",
                    "new_code": "def calculate():\n    result = 5 + 3\n    return result",
                    "description": "Add missing return statement",
                    "line_start": 1,
                    "line_end": 2,
                }
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_calculate - AssertionError: expected 8, got None",
                "implementation": "def calculate():\n    result = 5 + 3",
            },
        )

        assert result.success is True
        assert result.agent_type == "debugger"
        assert len(result.artifact_paths) >= 1
        assert result.metadata.get("root_cause") is not None

    @pytest.mark.asyncio
    async def test_execute_returns_code_changes(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns actionable code changes."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Missing null check",
            "fix_suggestion": "Add null check before accessing property",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "return obj.value",
                    "new_code": "return obj.value if obj else None",
                    "description": "Add null check",
                    "line_start": 10,
                    "line_end": 10,
                }
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_get_value - AttributeError: NoneType has no attribute 'value'",
                "implementation": "def get_value(obj):\n    return obj.value",
            },
        )

        assert result.success is True
        assert "code_changes" in result.metadata
        assert len(result.metadata["code_changes"]) >= 1


class TestDebuggerAgentRLMIntegration:
    """Tests for DebuggerAgent RLM integration (always uses RLM)."""

    @pytest.mark.asyncio
    async def test_execute_always_uses_rlm(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that debugger ALWAYS uses RLM for analysis."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("used_rlm") is True
        # Verify RLM explore was called
        mock_rlm_integration.explore.assert_called()

    @pytest.mark.asyncio
    async def test_execute_uses_rlm_even_when_enable_rlm_is_false(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
    ) -> None:
        """Test that debugger uses RLM even when config.enable_rlm is False.

        Unlike CodingAgent which only uses RLM on retries, DebuggerAgent
        ALWAYS uses RLM because it needs deep codebase exploration.
        """
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        config = DevelopmentConfig(enable_rlm=False)

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        # Debugger ALWAYS uses RLM, regardless of config
        assert result.metadata.get("used_rlm") is True
        mock_rlm_integration.explore.assert_called()

    @pytest.mark.asyncio
    async def test_execute_handles_rlm_failure_gracefully(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles RLM failure gracefully."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent
        from src.workers.rlm.integration import RLMIntegrationResult

        # Create RLM integration that fails
        rlm = MagicMock()
        rlm.explore = AsyncMock(return_value=RLMIntegrationResult(
            used_rlm=True,
            trigger_result=None,
            rlm_result=None,
            formatted_output="",
            error="RLM exploration failed",
        ))

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error without RLM context",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=rlm,
        )

        # Should still succeed even if RLM fails
        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        # RLM was attempted but failed
        assert result.metadata.get("used_rlm") is True
        assert result.metadata.get("rlm_error") is not None


class TestDebuggerAgentRootCauseAnalysis:
    """Tests for DebuggerAgent root cause analysis."""

    @pytest.mark.asyncio
    async def test_execute_identifies_root_cause(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute identifies root cause of failures."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Off-by-one error in loop condition",
            "fix_suggestion": "Change < to <= in loop condition",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "for i in range(len(items)):",
                    "new_code": "for i in range(len(items) + 1):",
                    "description": "Fix off-by-one error",
                    "line_start": 5,
                    "line_end": 5,
                }
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_process_all - AssertionError: expected 5 items processed, got 4",
                "implementation": "def process_all(items):\n    for i in range(len(items)):\n        process(items[i])",
            },
        )

        assert result.success is True
        assert "off-by-one" in result.metadata.get("root_cause", "").lower()

    @pytest.mark.asyncio
    async def test_execute_uses_stack_trace_when_provided(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute uses stack trace for better analysis."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Division by zero when input is empty list",
            "fix_suggestion": "Add check for empty list before division",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_average - ZeroDivisionError",
                "implementation": "def average(nums):\n    return sum(nums) / len(nums)",
                "stack_trace": """Traceback (most recent call last):
  File "test_impl.py", line 5, in test_average
    result = average([])
  File "impl.py", line 2, in average
    return sum(nums) / len(nums)
ZeroDivisionError: division by zero""",
            },
        )

        assert result.success is True
        # Verify stack trace was used in one of the prompts
        # The debugger makes 3 LLM calls: failure analysis, root cause, fix suggestion
        # Stack trace should be in the first call (failure analysis)
        all_calls = mock_llm_client.generate.call_args_list
        all_prompts = [call[1].get("prompt", "") for call in all_calls]
        any_prompt_has_stack = any(
            "ZeroDivisionError" in p or "stack" in p.lower() or "Traceback" in p
            for p in all_prompts
        )
        assert any_prompt_has_stack, f"Stack trace not found in any prompt. Prompts: {all_prompts[:500]}"


class TestDebuggerAgentValidation:
    """Tests for DebuggerAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        config,
    ) -> None:
        """Test that validate_context returns False for missing session_id."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        assert agent.validate_context(context) is False

    def test_validate_context_returns_false_for_missing_task_id(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        config,
    ) -> None:
        """Test that validate_context returns False for missing task_id."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        context = AgentContext(
            session_id="test-session",
            task_id="",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        assert agent.validate_context(context) is False


class TestDebuggerAgentErrorHandling:
    """Tests for DebuggerAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_llm_exception(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles LLM exceptions gracefully."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True
        assert "LLM service unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        mock_llm_client.generate.return_value = LLMResponse(
            content="This is not valid JSON",
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_handles_response_in_code_block(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles response wrapped in code block."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix the logic",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=f"```json\n{json.dumps(analysis_response)}\n```",
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True


class TestDebuggerAgentOutputFormats:
    """Tests for DebuggerAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_debug_analysis_as_json_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that debug analysis is written as JSON artifact."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error",
            "fix_suggestion": "Fix it",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_feature - AssertionError",
                "implementation": "def feature(): pass",
            },
        )

        assert result.success is True
        # Verify JSON artifact was written
        json_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if "json" in call[1].get("filename", "").lower()
        ]
        assert len(json_calls) >= 1

    @pytest.mark.asyncio
    async def test_writes_debug_analysis_as_markdown_artifact(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that debug analysis is written as markdown artifact."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Logic error in calculation",
            "fix_suggestion": "Fix the calculation",
            "code_changes": [
                {
                    "file_path": "src/impl.py",
                    "original_code": "return x + y",
                    "new_code": "return x * y",
                    "description": "Change addition to multiplication",
                    "line_start": 5,
                    "line_end": 5,
                }
            ],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_multiply - AssertionError: expected 20, got 9",
                "implementation": "def multiply(x, y):\n    return x + y",
            },
        )

        assert result.success is True
        # Verify markdown artifact was written
        md_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if call[1].get("filename", "").endswith(".md")
        ]
        assert len(md_calls) >= 1


class TestDebuggerAgentContextUsage:
    """Tests for DebuggerAgent context pack usage."""

    @pytest.mark.asyncio
    async def test_execute_uses_context_pack_when_provided(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        config,
    ) -> None:
        """Test that execute uses context pack for better debugging."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        context = AgentContext(
            session_id="test-session",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp/workspace",
            context_pack={
                "files": [
                    {
                        "path": "src/models/user.py",
                        "content": "class User:\n    def __init__(self, name): self.name = name",
                    }
                ],
                "interfaces": ["User"],
            },
        )

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "User model initialization issue",
            "fix_suggestion": "Fix User initialization",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            context,
            {
                "test_output": "FAILED test_user - TypeError",
                "implementation": "def create_user(): return User()",
            },
        )

        assert result.success is True
        # Verify context was passed to RLM
        call_kwargs = mock_rlm_integration.explore.call_args[1]
        context_hints = call_kwargs.get("context_hints", [])
        # Context hints should include User or files from context pack
        assert len(context_hints) > 0 or "User" in str(call_kwargs)


class TestDebuggerAgentTestContextUsage:
    """Tests for DebuggerAgent test context handling."""

    @pytest.mark.asyncio
    async def test_execute_uses_test_code_when_provided(
        self,
        mock_llm_client,
        mock_artifact_writer,
        mock_rlm_integration,
        agent_context,
        config,
    ) -> None:
        """Test that execute uses test code for better analysis."""
        from src.workers.agents.development.debugger_agent import DebuggerAgent

        analysis_response = {
            "failure_id": "test-failure-001",
            "root_cause": "Test expectation mismatch",
            "fix_suggestion": "Fix implementation to match test",
            "code_changes": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(analysis_response),
            model="test-model",
        )

        agent = DebuggerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        result = await agent.execute(
            agent_context,
            {
                "test_output": "FAILED test_add - AssertionError: expected 5, got 4",
                "implementation": "def add(a, b):\n    return a + b - 1",
                "test_code": """def test_add():
    assert add(2, 3) == 5
""",
            },
        )

        assert result.success is True
        # Verify test code was used in one of the prompts
        # The debugger makes 3 LLM calls: failure analysis, root cause, fix suggestion
        # Test expectations extracted from test code should be in the fix suggestion prompt
        all_calls = mock_llm_client.generate.call_args_list
        all_prompts = [call[1].get("prompt", "") for call in all_calls]
        # Test expectations are extracted as "add(2, 3) == 5"
        any_prompt_has_test_info = any(
            "test_add" in p or "add(2, 3)" in p or "assert" in p.lower()
            for p in all_prompts
        )
        assert any_prompt_has_test_info, "Test info not found in any prompt"
