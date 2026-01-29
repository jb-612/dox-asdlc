"""Unit tests for ReviewerAgent."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeReview,
    IssueSeverity,
    ReviewIssue,
)
from src.workers.llm.client import LLMResponse


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    client = MagicMock()
    client.generate = AsyncMock()
    client.model_name = "test-model"
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


class TestReviewerAgentProtocol:
    """Tests for ReviewerAgent implementing DomainAgent protocol."""

    def test_agent_type_returns_correct_value(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that agent_type returns 'reviewer'."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.agent_type == "reviewer"

    def test_agent_implements_base_agent_protocol(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that ReviewerAgent implements BaseAgent protocol."""
        from src.workers.agents.protocols import BaseAgent
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert isinstance(agent, BaseAgent)

    def test_agent_uses_opus_model_by_default(
        self,
        mock_llm_client,
        mock_artifact_writer,
    ) -> None:
        """Test that ReviewerAgent uses Opus model by default."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        config = DevelopmentConfig()
        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute returns error when no implementation provided."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute generates a CodeReview from implementation."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        # Mock LLM response with review data
        review_response = {
            "passed": True,
            "issues": [],
            "suggestions": ["Consider adding more docstrings"],
            "security_concerns": [],
        }

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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


class TestReviewerAgentIssueHandling:
    """Tests for ReviewerAgent issue severity and categorization."""

    @pytest.mark.asyncio
    async def test_categorizes_issues_by_severity(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that validate_context returns True for valid context."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(agent_context) is True

    def test_validate_context_returns_false_for_missing_session_id(
        self,
        mock_llm_client,
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
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False

    def test_validate_context_returns_false_for_missing_task_id(
        self,
        mock_llm_client,
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
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        assert agent.validate_context(context) is False


class TestReviewerAgentErrorHandling:
    """Tests for ReviewerAgent error handling."""

    @pytest.mark.asyncio
    async def test_execute_handles_llm_exception(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles LLM exceptions gracefully."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        mock_llm_client.generate.side_effect = Exception("LLM service unavailable")

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is False
        assert result.should_retry is True
        assert "LLM service unavailable" in result.error_message

    @pytest.mark.asyncio
    async def test_execute_handles_invalid_json_response(
        self,
        mock_llm_client,
        mock_artifact_writer,
        agent_context,
        config,
    ) -> None:
        """Test that execute handles invalid JSON response."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        mock_llm_client.generate.return_value = LLMResponse(
            content="This is not valid JSON",
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        # Wrap response in code block
        mock_llm_client.generate.return_value = LLMResponse(
            content=f"```json\n{json.dumps(review_response)}\n```",
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            agent_context,
            {"implementation": "def hello(): pass"},
        )

        assert result.success is True


class TestReviewerAgentOutputFormats:
    """Tests for ReviewerAgent output formats."""

    @pytest.mark.asyncio
    async def test_writes_review_as_json_artifact(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "test" in prompt.lower()

    @pytest.mark.asyncio
    async def test_execute_includes_test_results_in_review(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
        call_kwargs = mock_llm_client.generate.call_args[1]
        prompt = call_kwargs.get("prompt", "")
        assert "passed" in prompt.lower() or "coverage" in prompt.lower()


class TestSecurityScanner:
    """Tests for security scanner functionality in ReviewerAgent."""

    def test_scan_secrets_detects_api_key_patterns(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects API key patterns."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        code_with_api_key = '''
API_KEY = "sk-1234567890abcdef"
api_key = "AKIAIOSFODNN7EXAMPLE"
'''
        findings = agent.scan_for_secrets(code_with_api_key)

        assert len(findings) >= 1
        assert any("api" in f.description.lower() or "key" in f.description.lower() for f in findings)
        assert all(f.severity.value in ("high", "critical") for f in findings)

    def test_scan_secrets_detects_password_patterns(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects password patterns."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        code_with_password = '''
password = "secret123"
PASSWORD = "admin"
db_password = "hunter2"
'''
        findings = agent.scan_for_secrets(code_with_password)

        assert len(findings) >= 1
        assert any("password" in f.description.lower() for f in findings)

    def test_scan_secrets_detects_token_patterns(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects token patterns."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        code_with_token = '''
token = "ghp_xxxxxxxxxxxxxxxxxxxx"
AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIs..."
access_token = "ya29.a0ARrdaM..."
'''
        findings = agent.scan_for_secrets(code_with_token)

        assert len(findings) >= 1
        assert any("token" in f.description.lower() for f in findings)

    def test_scan_secrets_ignores_safe_patterns(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner ignores safe patterns."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        safe_code = '''
# API_KEY should be loaded from environment
api_key = os.environ.get("API_KEY")
password = os.getenv("PASSWORD")
token = config.get("token")
'''
        findings = agent.scan_for_secrets(safe_code)

        # Should find no hardcoded secrets
        assert len(findings) == 0

    def test_scan_injection_detects_sql_injection(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects SQL injection vulnerabilities."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        sql_injection_code = '''
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return execute(query)
'''
        findings = agent.scan_for_injection_vulnerabilities(sql_injection_code)

        assert len(findings) >= 1
        assert any("sql" in f.description.lower() for f in findings)
        assert all(f.severity.value in ("high", "critical") for f in findings)

    def test_scan_injection_detects_command_injection(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects command injection vulnerabilities."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        command_injection_code = '''
def run_command(user_input):
    os.system(f"ls {user_input}")
    subprocess.call("rm " + user_input, shell=True)
'''
        findings = agent.scan_for_injection_vulnerabilities(command_injection_code)

        assert len(findings) >= 1
        assert any("command" in f.description.lower() or "shell" in f.description.lower() for f in findings)

    def test_scan_injection_detects_xss_patterns(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects XSS patterns."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        xss_code = '''
def render_html(user_input):
    return f"<div>{user_input}</div>"
'''
        findings = agent.scan_for_injection_vulnerabilities(xss_code)

        assert len(findings) >= 1
        assert any("xss" in f.description.lower() or "html" in f.description.lower() for f in findings)

    def test_scan_owasp_detects_insecure_deserialization(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects insecure deserialization."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        deserialization_code = '''
import pickle

def load_data(user_data):
    return pickle.loads(user_data)
'''
        findings = agent.scan_for_owasp_vulnerabilities(deserialization_code)

        assert len(findings) >= 1
        assert any("deserialization" in f.description.lower() or "pickle" in f.description.lower() for f in findings)

    def test_scan_owasp_detects_path_traversal(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects path traversal vulnerabilities."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        path_traversal_code = '''
def read_file(filename):
    path = "/data/" + filename
    with open(path) as f:
        return f.read()
'''
        findings = agent.scan_for_owasp_vulnerabilities(path_traversal_code)

        assert len(findings) >= 1
        assert any("path" in f.description.lower() or "traversal" in f.description.lower() for f in findings)

    def test_scan_owasp_detects_eval_usage(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that security scanner detects eval usage."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        eval_code = '''
def calculate(user_expression):
    return eval(user_expression)
'''
        findings = agent.scan_for_owasp_vulnerabilities(eval_code)

        assert len(findings) >= 1
        assert any("eval" in f.description.lower() for f in findings)

    def test_run_security_scan_combines_all_scans(
        self,
        mock_llm_client,
        mock_artifact_writer,
        config,
    ) -> None:
        """Test that run_security_scan combines all scan types."""
        from src.workers.agents.development.reviewer_agent import ReviewerAgent

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        vulnerable_code = '''
API_KEY = "sk-secret123"
password = "admin"

def query(user_input):
    return f"SELECT * FROM users WHERE name = '{user_input}'"

def process(data):
    return pickle.loads(data)
'''
        findings = agent.run_security_scan(vulnerable_code)

        # Should detect secrets, injection, and OWASP issues
        assert len(findings) >= 3
        categories = set()
        for f in findings:
            if "metadata" in dir(f) and f.metadata:
                categories.add(f.metadata.get("category", ""))
        assert "security" in categories or len(findings) >= 3

    @pytest.mark.asyncio
    async def test_execute_includes_security_scan_results(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        # Code with hardcoded secret
        vulnerable_code = '''
API_KEY = "sk-secret123"
'''

        result = await agent.execute(
            agent_context,
            {"implementation": vulnerable_code},
        )

        assert result.success is True
        # Security scan should flag the issue even if LLM didn't
        assert result.metadata.get("security_scan_findings", 0) >= 1 or result.metadata.get("issue_count", 0) >= 1

    @pytest.mark.asyncio
    async def test_execute_security_findings_affect_passed_status(
        self,
        mock_llm_client,
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

        mock_llm_client.generate.return_value = LLMResponse(
            content=json.dumps(review_response),
            model="test-model",
        )

        agent = ReviewerAgent(
            llm_client=mock_llm_client,
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
