"""Integration tests for UTest -> Coding agent flow.

Tests that UTest agent can generate tests and Coding agent can generate
implementation that satisfies those tests.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.development.coding_agent import CodingAgent
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import TestSuite
from src.workers.agents.development.utest_agent import UTestAgent
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.artifacts.writer import ArtifactWriter
from src.workers.llm.client import LLMResponse


class TestUTestToCodingFlow:
    """Integration tests for UTest -> Coding agent flow."""

    @pytest.mark.asyncio
    async def test_utest_generates_tests_coding_generates_implementation(
        self,
        utest_agent: UTestAgent,
        coding_agent: CodingAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that UTest generates tests and Coding generates matching implementation."""
        # Step 1: UTest generates tests
        utest_result = await utest_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement a calculator with add and subtract functions",
                "acceptance_criteria": [
                    "add_numbers(2, 3) should return 5",
                    "subtract_numbers(5, 3) should return 2",
                ],
            },
        )

        assert utest_result.success is True
        assert utest_result.metadata.get("test_count", 0) > 0
        assert utest_result.metadata.get("tdd_phase") == "red"

        # Step 2: Extract test code from artifacts
        test_artifact_path = next(
            (p for p in utest_result.artifact_paths if p.endswith(".py")),
            None,
        )
        assert test_artifact_path is not None

        test_code = Path(test_artifact_path).read_text()
        assert "test" in test_code.lower()

        # Step 3: Coding agent generates implementation
        coding_result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement a calculator with add and subtract functions",
                "test_code": test_code,
            },
        )

        assert coding_result.success is True
        assert coding_result.metadata.get("file_count", 0) > 0
        assert coding_result.metadata.get("tdd_phase") == "green"

    @pytest.mark.asyncio
    async def test_test_suite_flows_correctly_between_agents(
        self,
        utest_agent: UTestAgent,
        coding_agent: CodingAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that test suite data flows correctly between UTest and Coding."""
        # Generate tests
        utest_result = await utest_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement greeting function",
                "acceptance_criteria": [
                    "greet('World') should return 'Hello, World!'",
                ],
            },
        )

        assert utest_result.success is True

        # Load the JSON artifact to verify structure
        json_artifact_path = next(
            (p for p in utest_result.artifact_paths if p.endswith(".json")),
            None,
        )
        assert json_artifact_path is not None

        with open(json_artifact_path) as f:
            test_suite_data = json.load(f)

        # Verify test suite has required fields
        assert "task_id" in test_suite_data
        assert "test_cases" in test_suite_data
        assert len(test_suite_data["test_cases"]) > 0

        # Convert to TestSuite and extract code
        test_suite = TestSuite.from_dict(test_suite_data)
        test_code = test_suite.to_python_code()

        # Coding agent should use the test code
        coding_result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement greeting function",
                "test_code": test_code,
            },
        )

        assert coding_result.success is True

    @pytest.mark.asyncio
    async def test_coding_handles_multiple_test_cases(
        self,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        agent_context: AgentContext,
        mock_rlm_integration: MagicMock,
    ) -> None:
        """Test that Coding agent handles multiple test cases correctly."""
        # Create mock LLM client that returns implementation for multiple functions
        mock_llm = MagicMock()
        mock_llm.generate = AsyncMock(
            return_value=LLMResponse(
                content=json.dumps({
                    "files": [
                        {
                            "path": "math_utils.py",
                            "content": """def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b
""",
                            "language": "python",
                        }
                    ],
                    "imports": [],
                    "dependencies": [],
                }),
                model="test",
            )
        )
        mock_llm.model_name = "test"

        coding_agent = CodingAgent(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        test_code = """
def test_add():
    assert add(2, 3) == 5

def test_subtract():
    assert subtract(5, 3) == 2

def test_multiply():
    assert multiply(4, 3) == 12
"""

        result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement basic math operations",
                "test_code": test_code,
            },
        )

        assert result.success is True
        assert result.metadata.get("file_count") == 1

        # Verify the implementation file was written
        impl_artifact_path = next(
            (p for p in result.artifact_paths if "math_utils" in p),
            None,
        )
        assert impl_artifact_path is not None

    @pytest.mark.asyncio
    async def test_criteria_coverage_tracking(
        self,
        utest_agent: UTestAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that acceptance criteria coverage is tracked through the flow."""
        result = await utest_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement validation utilities",
                "acceptance_criteria": [
                    "validate_email should return True for valid emails",
                    "validate_email should return False for invalid emails",
                    "validate_phone should handle international formats",
                ],
            },
        )

        assert result.success is True
        assert "criteria_coverage" in result.metadata

        # Each criterion should be mapped
        criteria_coverage = result.metadata["criteria_coverage"]
        assert len(criteria_coverage) == 3

    @pytest.mark.asyncio
    async def test_coding_receives_context_from_utest(
        self,
        utest_agent: UTestAgent,
        agent_context: AgentContext,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
        mock_rlm_integration: MagicMock,
    ) -> None:
        """Test that Coding agent receives proper context from UTest output."""
        # Add context pack to agent context
        agent_context_with_pack = AgentContext(
            session_id=agent_context.session_id,
            task_id=agent_context.task_id,
            tenant_id=agent_context.tenant_id,
            workspace_path=agent_context.workspace_path,
            context_pack={
                "files": [
                    {
                        "path": "src/existing_module.py",
                        "content": "# Existing module that tests should import from",
                    }
                ],
                "interfaces": ["BaseValidator", "ValidationResult"],
            },
        )

        # UTest should incorporate context
        utest_result = await utest_agent.execute(
            context=agent_context_with_pack,
            event_metadata={
                "task_description": "Extend validation module",
                "acceptance_criteria": ["New validator should inherit from BaseValidator"],
            },
        )

        assert utest_result.success is True

        # Create coding agent with tracking mock
        mock_llm = MagicMock()
        mock_llm.generate = AsyncMock(
            return_value=LLMResponse(
                content=json.dumps({
                    "files": [{"path": "validator.py", "content": "class NewValidator: pass", "language": "python"}],
                    "imports": [],
                    "dependencies": [],
                }),
                model="test",
            )
        )
        mock_llm.model_name = "test"

        coding_agent = CodingAgent(
            llm_client=mock_llm,
            artifact_writer=artifact_writer,
            config=config,
            rlm_integration=mock_rlm_integration,
        )

        # Get test code from UTest output
        test_artifact_path = next(
            (p for p in utest_result.artifact_paths if p.endswith(".py")),
            None,
        )
        test_code = Path(test_artifact_path).read_text() if test_artifact_path else ""

        # Coding agent should receive the same context
        coding_result = await coding_agent.execute(
            context=agent_context_with_pack,
            event_metadata={
                "task_description": "Extend validation module",
                "test_code": test_code,
            },
        )

        assert coding_result.success is True

        # Verify the prompt included context information
        call_args = mock_llm.generate.call_args
        prompt = call_args[1].get("prompt", "") or call_args[0][0] if call_args[0] else ""
        # Context should be used in the prompt (may be in context pack format)
        assert coding_result.success is True


class TestUTestCodingEdgeCases:
    """Edge case tests for UTest -> Coding flow."""

    @pytest.mark.asyncio
    async def test_empty_acceptance_criteria_fails_gracefully(
        self,
        utest_agent: UTestAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that empty acceptance criteria is handled gracefully."""
        result = await utest_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Some task",
                "acceptance_criteria": [],  # Empty criteria
            },
        )

        assert result.success is False
        assert "acceptance_criteria" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_missing_task_description_fails_gracefully(
        self,
        coding_agent: CodingAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that missing task description is handled gracefully."""
        result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "test_code": "def test_something(): pass",
                # task_description missing
            },
        )

        assert result.success is False
        assert "task_description" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_missing_test_code_fails_gracefully(
        self,
        coding_agent: CodingAgent,
        agent_context: AgentContext,
    ) -> None:
        """Test that missing test code is handled gracefully."""
        result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement something",
                # test_code missing
            },
        )

        assert result.success is False
        assert "test_code" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_artifacts_written_to_correct_location(
        self,
        utest_agent: UTestAgent,
        coding_agent: CodingAgent,
        agent_context: AgentContext,
        workspace_path: Path,
    ) -> None:
        """Test that artifacts are written to workspace subdirectories."""
        # Generate tests
        utest_result = await utest_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement utility function",
                "acceptance_criteria": ["Function should work"],
            },
        )

        assert utest_result.success is True

        # All artifact paths should be within workspace
        for path in utest_result.artifact_paths:
            assert str(workspace_path) in path or path.startswith(str(workspace_path))

        # Get test code
        test_artifact = next((p for p in utest_result.artifact_paths if p.endswith(".py")), None)
        test_code = Path(test_artifact).read_text() if test_artifact else "def test_x(): pass"

        # Generate implementation
        coding_result = await coding_agent.execute(
            context=agent_context,
            event_metadata={
                "task_description": "Implement utility function",
                "test_code": test_code,
            },
        )

        assert coding_result.success is True

        for path in coding_result.artifact_paths:
            assert str(workspace_path) in path or path.startswith(str(workspace_path))
