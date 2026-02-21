"""Unit tests for ReviewerAgent (AgentBackend-based)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeReview,
    IssueSeverity,
    ReviewIssue,
)


@pytest.fixture
def mock_backend():
    """Create a mock AgentBackend."""
    backend = MagicMock()
    backend.execute = AsyncMock()
    backend.backend_name = "test-backend"
    backend.health_check = AsyncMock(return_value=True)
    return backend


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


def _backend_result(review_data: dict) -> BackendResult:
    """Helper to build a successful BackendResult with JSON output."""
    return BackendResult(
        success=True,
        output=json.dumps(review_data),
        structured_output=review_data,
    )


def _backend_result_text(text: str) -> BackendResult:
    """Helper to build a successful BackendResult with plain text output."""
    return BackendResult(
        success=True,
        output=text,
        structured_output=None,
    )


class TestReviewerAgentProtocol:
    """Tests for ReviewerAgent implementing DomainAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'reviewer'."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "reviewer"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that ReviewerAgent implements BaseAgent protocol."""
        from src.workers.agents.protocols import BaseAgent
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert isinstance(agent, BaseAgent)

    def test_agent_uses_opus_model_by_default(
        self,
        mock_backend,
        mock_artifact_writer,
    ) -> None:
        """Test that ReviewerAgent uses Opus model by default."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        config = DevelopmentConfig()
        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        # Verify the config has Opus model for reviewer
        assert "opus" in config.reviewer_model.lower()


class TestReviewerAgentExecution:
    """Tests for ReviewerAgent.execute() method."""

    @pytest.mark.asyncio
    async def test_execute_returns_error_when_no_implementation(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no implementation provided."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(agent_context, {})

        assert result.success is False
        assert "implementation" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_execute_generates_code_review(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates a CodeReview from implementation."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": ["Consider adding more docstrings"],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "def hello(): return 'world'",
            },
        )

        assert result.success is True
        assert result.agent_type == "reviewer"
        assert len(result.artifact_paths) >= 1

    @pytest.mark.asyncio
    async def test_execute_reviews_implementation_quality(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute reviews implementation quality."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": False,
            "issues": [
                {
                    "id": "QUAL-001",
                    "description": "Function lacks error handling",
                    "severity": "medium",
                    "file_path": "main.py",
                    "line_number": 10,
                    "suggestion": "Add try-except block",
                    "category": "quality",
                }
            ],
            "suggestions": ["Improve error handling"],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "def risky(): pass",
            },
        )

        assert result.success is True
        assert result.metadata.get("passed") is False
        assert result.metadata.get("issue_count") == 1

    @pytest.mark.asyncio
    async def test_execute_checks_security_concerns(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute checks for security concerns."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": False,
            "issues": [
                {
                    "id": "SEC-001",
                    "description": "Hardcoded password detected",
                    "severity": "critical",
                    "file_path": "auth.py",
                    "line_number": 5,
                    "suggestion": "Use environment variables or secrets manager",
                    "category": "security",
                }
            ],
            "suggestions": [],
            "security_concerns": ["Hardcoded credentials found"],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "password = 'secret123'",
            },
        )

        assert result.success is True
        assert result.metadata.get("passed") is False
        assert len(result.metadata.get("security_concerns", [])) > 0

    @pytest.mark.asyncio
    async def test_execute_verifies_style_compliance(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute verifies style compliance."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [
                {
                    "id": "STYLE-001",
                    "description": "Line too long (120 chars)",
                    "severity": "low",
                    "file_path": "utils.py",
                    "line_number": 15,
                    "suggestion": "Break line into multiple lines",
                    "category": "style",
                }
            ],
            "suggestions": ["Follow PEP 8 style guide"],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "def func(): very_long_variable_name = some_function_call_that_is_too_long()",
            },
        )

        assert result.success is True
        # Style issues with low severity should still allow review to pass
        assert result.metadata.get("passed") is True

    @pytest.mark.asyncio
    async def test_execute_generates_review_with_issues(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates review with ReviewIssue items."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": False,
            "issues": [
                {
                    "id": "QUAL-001",
                    "description": "Missing type hints",
                    "severity": "medium",
                    "file_path": "main.py",
                    "line_number": 1,
                    "suggestion": "Add type hints to function signature",
                    "category": "quality",
                },
                {
                    "id": "SEC-001",
                    "description": "SQL injection vulnerability",
                    "severity": "critical",
                    "file_path": "db.py",
                    "line_number": 20,
                    "suggestion": "Use parameterized queries",
                    "category": "security",
                },
            ],
            "suggestions": ["Improve overall code quality"],
            "security_concerns": ["SQL injection risk"],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "def query(user_input): return f'SELECT * FROM users WHERE id = {user_input}'",
            },
        )

        assert result.success is True
        # 2 from LLM + 1 from security scanner detecting SQL injection
        assert result.metadata.get("issue_count") >= 2
        assert result.metadata.get("passed") is False

    @pytest.mark.asyncio
    async def test_execute_passes_backend_config_with_schema(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute passes BackendConfig with output schema."""
        from src.workers.agents.development.reviewer_agent import (
            ReviewerAgent,
            REVIEWER_OUTPUT_SCHEMA,
        )

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": [],
            "security_concerns": [],
        }
        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        # Verify backend.execute was called with correct config
        call_kwargs = mock_backend.execute.call_args
        passed_config = call_kwargs.kwargs.get("config") or call_kwargs[1].get("config")
        assert passed_config is not None
        assert isinstance(passed_config, BackendConfig)
        assert passed_config.output_schema == REVIEWER_OUTPUT_SCHEMA
        assert passed_config.allowed_tools == ["Read", "Glob", "Grep"]
        assert passed_config.timeout_seconds == 300

    @pytest.mark.asyncio
    async def test_execute_uses_structured_output_when_available(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that structured_output is preferred over parsing raw text."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        structured = {
            "passed": True,
            "issues": [],
            "suggestions": ["from structured"],
            "security_concerns": [],
        }
        mock_backend.execute.return_value = BackendResult(
            success=True,
            output="junk text that is not json",
            structured_output=structured,
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is True
        assert result.metadata["suggestions"] == ["from structured"]

    @pytest.mark.asyncio
    async def test_execute_falls_back_to_text_parsing(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test fallback to parse_json_from_response when no structured_output."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_data = {
            "passed": True,
            "issues": [],
            "suggestions": ["parsed from text"],
            "security_concerns": [],
        }
        mock_backend.execute.return_value = _backend_result_text(
            json.dumps(review_data),
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is True
        assert result.metadata["suggestions"] == ["parsed from text"]


class TestReviewerAgentIssueHandling:
    """Tests for ReviewerAgent issue severity and categorization."""

    @pytest.mark.asyncio
    async def test_categorizes_issues_by_severity(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that issues are categorized by severity."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": False,
            "issues": [
                {
                    "id": "LOW-001",
                    "description": "Minor style issue",
                    "severity": "low",
                    "file_path": "main.py",
                    "line_number": 1,
                    "suggestion": "Fix style",
                    "category": "style",
                },
                {
                    "id": "MED-001",
                    "description": "Medium quality issue",
                    "severity": "medium",
                    "file_path": "main.py",
                    "line_number": 2,
                    "suggestion": "Improve quality",
                    "category": "quality",
                },
                {
                    "id": "HIGH-001",
                    "description": "High priority issue",
                    "severity": "high",
                    "file_path": "main.py",
                    "line_number": 3,
                    "suggestion": "Fix urgently",
                    "category": "quality",
                },
                {
                    "id": "CRIT-001",
                    "description": "Critical security issue",
                    "severity": "critical",
                    "file_path": "main.py",
                    "line_number": 4,
                    "suggestion": "Fix immediately",
                    "category": "security",
                },
            ],
            "suggestions": [],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "code"},
        )

        assert result.success is True
        # Verify severity breakdown is in metadata
        severity_counts = result.metadata.get("severity_counts", {})
        assert severity_counts.get("low", 0) >= 1
        assert severity_counts.get("medium", 0) >= 1
        assert severity_counts.get("high", 0) >= 1
        assert severity_counts.get("critical", 0) >= 1

    @pytest.mark.asyncio
    async def test_critical_issues_fail_review(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that critical issues cause review to fail."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": False,
            "issues": [
                {
                    "id": "CRIT-001",
                    "description": "Critical vulnerability",
                    "severity": "critical",
                    "file_path": "main.py",
                    "line_number": 1,
                    "suggestion": "Fix immediately",
                    "category": "security",
                }
            ],
            "suggestions": [],
            "security_concerns": ["Critical vulnerability found"],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "vulnerable code"},
        )

        assert result.success is True  # Agent execution succeeded
        assert result.metadata.get("passed") is False  # But review failed


class TestReviewerAgentValidation:
    """Tests for ReviewerAgent validation methods."""

    def test_validate_context_returns_true_for_valid_context(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that validate_context returns False for missing session_id."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        context = AgentContext(
            session_id="",
            task_id="test-task",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False

    def test_validate_context_returns_false_for_missing_task_id(
        self,
        mock_backend,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that validate_context returns False for missing task_id."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        context = AgentContext(
            session_id="test-session",
            task_id="",
            tenant_id="default",
            workspace_path="/tmp",
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False


class TestReviewerAgentErrorHandling:
    """Tests for ReviewerAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_backend_exception(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles backend exceptions gracefully."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        mock_backend.execute.side_effect = Exception("Backend service unavailable")

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is False
        assert result.should_retry is True
        assert "Backend service unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        mock_backend.execute.return_value = _backend_result_text(
            "This is not valid JSON",
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is False
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_execute_handles_response_in_code_block(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that LLM responses in code blocks are parsed correctly."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": [],
            "security_concerns": [],
        }

        # Return as text wrapped in code block, no structured output
        mock_backend.execute.return_value = _backend_result_text(
            f"```json\n{json.dumps(review_response)}\n```",
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_execute_handles_backend_failure_result(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that a BackendResult with success=False is handled."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        mock_backend.execute.return_value = BackendResult(
            success=False,
            output="",
            error="Model refused the request",
        )

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is False
        assert result.should_retry is True


class TestReviewerAgentOutputFormats:
    """Tests for ReviewerAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_review_as_json_artifact(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that review is written as JSON artifact."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": ["Good code"],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
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
    async def test_writes_review_as_markdown_artifact(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that review is written as markdown artifact."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": ["Good code"],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is True
        # Verify markdown artifact was written
        md_calls = [
            call
            for call in mock_artifact_writer.write_artifact.call_args_list
            if call[1].get("filename", "").endswith(".md")
        ]
        assert len(md_calls) >= 1


class TestReviewerAgentWithTestSuite:
    """Tests for ReviewerAgent reviewing implementation with test suite."""

    @pytest.mark.asyncio
    async def test_execute_includes_test_suite_in_review(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes test suite in review when provided."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": ["Tests cover main functionality"],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "def hello(): return 'world'",
                "test_suite": "def test_hello(): assert hello() == 'world'",
            },
        )

        assert result.success is True
        # Verify prompt included test suite
        call_kwargs = mock_backend.execute.call_args
        prompt = call_kwargs.kwargs.get("prompt") or call_kwargs[0][0]
        assert "test" in prompt.lower()

    @pytest.mark.asyncio
    async def test_execute_includes_test_results_in_review(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes test results in review when provided."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": [],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {
                "implementation": "def hello(): return 'world'",
                "test_results": "5 passed, 0 failed, 90% coverage",
            },
        )

        assert result.success is True
        # Verify prompt included test results
        call_kwargs = mock_backend.execute.call_args
        prompt = call_kwargs.kwargs.get("prompt") or call_kwargs[0][0]
        assert "passed" in prompt.lower() or "coverage" in prompt.lower()


class TestReviewerAgentSecurityIntegration:
    """Tests that ReviewerAgent integrates with security_scanner module."""

    @pytest.mark.asyncio
    async def test_execute_includes_security_scan_results(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute includes security scan results in review."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": [],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        # Code with hardcoded secret
        vulnerable_code = '\nAPI_KEY = "sk-secret123"\n'

        result = await agent.execute(
            agent_context,
            {"implementation": vulnerable_code},
        )

        assert result.success is True
        # Security scan should flag the issue even if LLM didn't
        assert (
            result.metadata.get("security_scan_findings", 0) >= 1
            or result.metadata.get("issue_count", 0) >= 1
        )

    @pytest.mark.asyncio
    async def test_execute_security_findings_affect_passed_status(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that critical security findings cause review to fail."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        # LLM says passed but we have critical security issues
        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": [],
            "security_concerns": [],
        }

        mock_backend.execute.return_value = _backend_result(review_response)

        agent = ReviewerAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        # Code with SQL injection vulnerability
        vulnerable_code = '''
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return db.execute(query)
'''

        result = await agent.execute(
            agent_context,
            {"implementation": vulnerable_code},
        )

        assert result.success is True  # Agent execution succeeded
        # Review should fail due to critical security findings
        assert result.metadata.get("passed") is False


class TestReviewerOutputSchema:
    """Tests for REVIEWER_OUTPUT_SCHEMA constant."""

    def test_schema_has_required_fields(self) -> None:
        """Test that the output schema includes the required top-level fields."""
        from src.workers.agents.development.reviewer_agent import REVIEWER_OUTPUT_SCHEMA

        assert REVIEWER_OUTPUT_SCHEMA["required"] == ["passed", "issues"]

    def test_schema_issues_item_properties(self) -> None:
        """Test that the schema defines expected issue properties."""
        from src.workers.agents.development.reviewer_agent import REVIEWER_OUTPUT_SCHEMA

        issue_props = REVIEWER_OUTPUT_SCHEMA["properties"]["issues"]["items"]["properties"]
        assert "id" in issue_props
        assert "severity" in issue_props
        assert issue_props["severity"]["enum"] == ["low", "medium", "high", "critical"]
