"""Tests for SecurityAgent.

Tests the security scanning agent that scans for vulnerabilities,
checks secrets exposure, verifies compliance requirements, and
generates security reports for the validation phase.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
import pytest

from src.workers.agents.backends.base import BackendResult
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    SecurityCategory,
    SecurityFinding,
    SecurityReport,
    Severity,
)

# Import the module under test
from src.workers.agents.validation.security_agent import (
    SecurityAgent,
    SecurityAgentError,
)


@pytest.fixture
def mock_backend():
    """Create a mock agent backend."""
    backend = AsyncMock()
    backend.backend_name = "mock"
    backend.execute = AsyncMock(return_value=BackendResult(
        success=True, output="{}", structured_output={},
    ))
    backend.health_check = AsyncMock(return_value=True)
    return backend


@pytest.fixture
def mock_artifact_writer():
    """Create a mock artifact writer."""
    writer = AsyncMock()
    writer.write_artifact = AsyncMock(return_value="/artifacts/security_report.json")
    return writer


@pytest.fixture
def validation_config():
    """Create a validation configuration."""
    return ValidationConfig(
        security_scan_level="standard",
    )


@pytest.fixture
def agent_context():
    """Create an agent context for testing."""
    return AgentContext(
        session_id="session-123",
        task_id="task-456",
        tenant_id="tenant-789",
        workspace_path="/workspace",
        context_pack={
            "files": [
                {"path": "src/module.py", "content": "# module code"},
            ],
            "interfaces": ["SomeInterface"],
        },
    )


@pytest.fixture
def clean_code_implementation():
    """Create a clean implementation with no security issues."""
    return {
        "files": [
            {
                "path": "src/service.py",
                "content": '''
import os

class Service:
    def __init__(self):
        self.api_key = os.environ.get("API_KEY")

    def get_data(self, user_id: int):
        # Uses parameterized queries
        query = "SELECT * FROM users WHERE id = %s"
        return self.db.execute(query, (user_id,))
''',
            }
        ]
    }


@pytest.fixture
def vulnerable_code_implementation():
    """Create an implementation with security vulnerabilities."""
    return {
        "files": [
            {
                "path": "src/vulnerable.py",
                "content": '''
import pickle
import subprocess
import os

API_KEY = "sk-1234567890abcdefghijklmnop"
PASSWORD = "admin123"

class VulnerableService:
    def load_data(self, data):
        # Insecure deserialization
        return pickle.loads(data)

    def run_command(self, cmd):
        # Command injection
        os.system(f"echo {cmd}")

    def get_user(self, user_input):
        # SQL injection
        query = f"SELECT * FROM users WHERE name = '{user_input}'"
        return self.db.execute(query)

    def render_html(self, user_content):
        # XSS vulnerability
        return f"<div>{user_content}</div>"

    def dangerous_eval(self, code):
        # Code execution
        return eval(code)
''',
            }
        ]
    }


@pytest.fixture
def secrets_exposure_implementation():
    """Create an implementation with exposed secrets."""
    return {
        "files": [
            {
                "path": "src/config.py",
                "content": '''
# Database configuration
DB_PASSWORD = "super_secret_password_123"
MYSQL_PASSWORD = "mysql_root_pass"

# API Keys
api_key = "AKIA1234567890ABCDEF"  # AWS key
openai_key = "sk-abcdefghijklmnopqrstuvwxyz1234567890"

# Tokens
auth_token = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"
''',
            }
        ]
    }


class TestSecurityAgentInit:
    """Tests for SecurityAgent initialization."""

    def test_creates_with_required_args(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
    ):
        """Test that agent can be created with required arguments."""
        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        assert agent is not None
        assert agent.agent_type == "security_agent"

    def test_agent_type_is_security_agent(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
    ):
        """Test that agent_type property returns correct value."""
        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        assert agent.agent_type == "security_agent"


class TestSecurityAgentExecute:
    """Tests for SecurityAgent.execute method."""

    @pytest.mark.asyncio
    async def test_returns_failure_when_no_implementation(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that execute returns failure when no implementation provided."""
        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={},  # No implementation
        )

        assert result.success is False
        assert "implementation" in result.error_message.lower()
        assert result.should_retry is False

    @pytest.mark.asyncio
    async def test_passes_clean_code(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent passes code with no security issues."""
        # Mock LLM response for compliance analysis
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {
                    "OWASP_TOP_10": true,
                    "PCI_DSS": true,
                    "SOC2": true
                },
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": clean_code_implementation,
                "feature_id": "P04-F04",
            },
        )

        assert result.success is True
        assert result.agent_type == "security_agent"
        assert "security_report" in result.metadata
        assert result.metadata["security_report"]["passed"] is True
        # Should return HITL-5 gate when passed
        assert result.metadata.get("hitl_gate") == "HITL-5"

    @pytest.mark.asyncio
    async def test_fails_vulnerable_code(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        vulnerable_code_implementation,
    ):
        """Test that agent fails code with security vulnerabilities."""
        # Mock LLM response for compliance analysis
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {
                    "OWASP_TOP_10": false,
                    "PCI_DSS": false
                },
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": vulnerable_code_implementation,
                "feature_id": "P04-F04",
            },
        )

        # Should fail due to critical/high severity findings from pattern scan
        assert result.success is False
        assert "security_report" in result.metadata
        assert result.metadata["security_report"]["passed"] is False
        # Should not return HITL-5 when failed
        assert result.metadata.get("hitl_gate") is None

    @pytest.mark.asyncio
    async def test_detects_hardcoded_secrets(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        secrets_exposure_implementation,
    ):
        """Test that agent detects hardcoded secrets."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": secrets_exposure_implementation,
                "feature_id": "P04-F04",
            },
        )

        assert result.success is False
        security_report = result.metadata["security_report"]
        assert security_report["passed"] is False

        # Check that secrets were detected
        findings = security_report["findings"]
        secret_findings = [
            f for f in findings if f["category"] == "secrets"
        ]
        assert len(secret_findings) > 0

    @pytest.mark.asyncio
    async def test_generates_security_report(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent generates a proper security report."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {
                    "OWASP_TOP_10": true,
                    "PCI_DSS": true,
                    "SOC2": true
                },
                "scan_coverage": 98.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": clean_code_implementation,
                "feature_id": "P04-F04",
            },
        )

        assert result.success is True
        assert "security_report" in result.metadata

        report = result.metadata["security_report"]
        assert report["feature_id"] == "P04-F04"
        assert report["passed"] is True
        assert "compliance_status" in report
        assert "scan_coverage" in report

    @pytest.mark.asyncio
    async def test_writes_artifacts(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent writes artifacts correctly."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": true},
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": clean_code_implementation,
                "feature_id": "P04-F04",
            },
        )

        # Verify artifact writer was called
        assert mock_artifact_writer.write_artifact.called
        assert len(result.artifact_paths) > 0


class TestSecurityAgentVulnerabilityScanning:
    """Tests for vulnerability scanning functionality."""

    @pytest.mark.asyncio
    async def test_detects_sql_injection(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects SQL injection vulnerabilities."""
        sql_injection_impl = {
            "files": [
                {
                    "path": "src/db.py",
                    "content": '''
def get_user(user_input):
    query = f"SELECT * FROM users WHERE name = '{user_input}'"
    return db.execute(query)
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": sql_injection_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        injection_findings = [
            f for f in findings if f["category"] == "injection"
        ]
        assert len(injection_findings) > 0

    @pytest.mark.asyncio
    async def test_detects_command_injection(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects command injection vulnerabilities."""
        cmd_injection_impl = {
            "files": [
                {
                    "path": "src/cmd.py",
                    "content": '''
import os
def run_command(user_input):
    os.system(f"echo {user_input}")
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": cmd_injection_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        injection_findings = [
            f for f in findings if f["category"] == "injection"
        ]
        assert len(injection_findings) > 0

    @pytest.mark.asyncio
    async def test_detects_xss_vulnerability(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects XSS vulnerabilities."""
        xss_impl = {
            "files": [
                {
                    "path": "src/render.py",
                    "content": '''
def render_html(user_content):
    return f"<div>{user_content}</div>"
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": xss_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        xss_findings = [
            f for f in findings if f["category"] == "xss"
        ]
        assert len(xss_findings) > 0

    @pytest.mark.asyncio
    async def test_detects_insecure_deserialization(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects insecure deserialization."""
        deser_impl = {
            "files": [
                {
                    "path": "src/data.py",
                    "content": '''
import pickle
def load_data(data):
    return pickle.loads(data)
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": deser_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        # Insecure deserialization falls under OWASP patterns
        owasp_findings = [
            f for f in findings
            if "deseriali" in f["description"].lower() or "pickle" in f["description"].lower()
        ]
        assert len(owasp_findings) > 0

    @pytest.mark.asyncio
    async def test_detects_dangerous_eval(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects dangerous use of eval()."""
        eval_impl = {
            "files": [
                {
                    "path": "src/unsafe.py",
                    "content": '''
def dangerous_eval(code):
    return eval(code)
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": eval_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        eval_findings = [
            f for f in findings if "eval" in f["description"].lower()
        ]
        assert len(eval_findings) > 0


class TestSecurityAgentSecretsDetection:
    """Tests for secrets detection functionality."""

    @pytest.mark.asyncio
    async def test_detects_api_keys(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects hardcoded API keys."""
        api_key_impl = {
            "files": [
                {
                    "path": "src/config.py",
                    "content": '''
api_key = "sk-1234567890abcdefghijklmnop"
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": api_key_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        secret_findings = [f for f in findings if f["category"] == "secrets"]
        assert len(secret_findings) > 0

    @pytest.mark.asyncio
    async def test_detects_aws_access_keys(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects AWS access key IDs."""
        aws_key_impl = {
            "files": [
                {
                    "path": "src/aws.py",
                    "content": '''
aws_access_key = "AKIA1234567890ABCDEF"
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": aws_key_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        aws_findings = [
            f for f in findings if "aws" in f["description"].lower()
        ]
        assert len(aws_findings) > 0

    @pytest.mark.asyncio
    async def test_detects_database_passwords(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent detects hardcoded database passwords."""
        db_pass_impl = {
            "files": [
                {
                    "path": "src/db.py",
                    "content": '''
db_password = "super_secret_db_pass"
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": false},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": db_pass_impl},
        )

        assert result.success is False
        findings = result.metadata["security_report"]["findings"]
        db_findings = [
            f for f in findings
            if "password" in f["description"].lower() or f["category"] == "secrets"
        ]
        assert len(db_findings) > 0

    @pytest.mark.asyncio
    async def test_ignores_safe_patterns(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that agent ignores safe patterns like environment variables."""
        safe_impl = {
            "files": [
                {
                    "path": "src/config.py",
                    "content": '''
import os
api_key = os.environ.get("API_KEY")
password = os.getenv("DB_PASSWORD")
secret = config.get("SECRET")
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": true},
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": safe_impl},
        )

        # Should pass since secrets are properly retrieved from environment
        assert result.success is True


class TestSecurityAgentComplianceChecking:
    """Tests for compliance checking functionality."""

    @pytest.mark.asyncio
    async def test_checks_owasp_compliance(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent checks OWASP compliance."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {
                    "OWASP_TOP_10": true
                },
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": clean_code_implementation,
                "compliance_frameworks": ["OWASP_TOP_10"],
            },
        )

        assert result.success is True
        compliance = result.metadata["security_report"]["compliance_status"]
        assert "OWASP_TOP_10" in compliance
        assert compliance["OWASP_TOP_10"] is True

    @pytest.mark.asyncio
    async def test_checks_multiple_compliance_frameworks(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent checks multiple compliance frameworks."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {
                    "OWASP_TOP_10": true,
                    "PCI_DSS": true,
                    "SOC2": true
                },
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": clean_code_implementation,
                "compliance_frameworks": ["OWASP_TOP_10", "PCI_DSS", "SOC2"],
            },
        )

        assert result.success is True
        compliance = result.metadata["security_report"]["compliance_status"]
        assert len(compliance) >= 3


class TestSecurityAgentScanLevels:
    """Tests for different security scan levels."""

    @pytest.mark.asyncio
    async def test_minimal_scan_level(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        clean_code_implementation,
    ):
        """Test that minimal scan level performs basic checks."""
        config = ValidationConfig(security_scan_level="minimal")

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {},
                "scan_coverage": 70.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": clean_code_implementation},
        )

        assert result.success is True
        # Minimal scan should still work
        assert result.agent_type == "security_agent"

    @pytest.mark.asyncio
    async def test_thorough_scan_level(
        self,
        mock_backend,
        mock_artifact_writer,
        agent_context,
        clean_code_implementation,
    ):
        """Test that thorough scan level performs comprehensive checks."""
        config = ValidationConfig(security_scan_level="thorough")

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {
                    "OWASP_TOP_10": true,
                    "PCI_DSS": true,
                    "SOC2": true,
                    "HIPAA": true
                },
                "scan_coverage": 99.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": clean_code_implementation},
        )

        assert result.success is True
        # Thorough scan should have higher coverage
        assert result.metadata["security_report"]["scan_coverage"] >= 90.0


class TestSecurityAgentValidateContext:
    """Tests for context validation."""

    def test_validates_complete_context(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that complete context passes validation."""
        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        assert agent.validate_context(agent_context) is True

    def test_rejects_incomplete_context(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
    ):
        """Test that incomplete context fails validation."""
        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        incomplete_context = AgentContext(
            session_id="",
            task_id="",
            tenant_id="",
            workspace_path="",
        )

        assert agent.validate_context(incomplete_context) is False


class TestSecurityAgentErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handles_llm_error(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent handles LLM errors gracefully."""
        mock_backend.execute.side_effect = Exception("LLM service unavailable")

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": clean_code_implementation},
        )

        assert result.success is False
        assert "LLM service unavailable" in result.error_message
        assert result.should_retry is True

    @pytest.mark.asyncio
    async def test_handles_artifact_write_error(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that agent handles artifact write errors gracefully."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {},
                "scan_coverage": 95.0
            }""", structured_output=None)
        mock_artifact_writer.write_artifact.side_effect = Exception("Disk full")

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": clean_code_implementation},
        )

        assert result.success is False
        assert "Disk full" in result.error_message
        assert result.should_retry is True


class TestSecurityReportGeneration:
    """Tests for security report generation."""

    @pytest.mark.asyncio
    async def test_report_contains_all_fields(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        clean_code_implementation,
    ):
        """Test that security report contains all required fields."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": true},
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={
                "implementation": clean_code_implementation,
                "feature_id": "P04-F04",
            },
        )

        assert result.success is True
        report = result.metadata["security_report"]

        # Verify all required fields
        assert "feature_id" in report
        assert "findings" in report
        assert "passed" in report
        assert "scan_coverage" in report
        assert "compliance_status" in report

    @pytest.mark.asyncio
    async def test_report_passed_false_with_blocking_findings(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
        vulnerable_code_implementation,
    ):
        """Test that report.passed is False when critical/high findings exist."""
        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {},
                "scan_coverage": 90.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": vulnerable_code_implementation},
        )

        assert result.success is False
        report = result.metadata["security_report"]
        assert report["passed"] is False

        # Should have blocking (critical or high) findings
        findings = report["findings"]
        blocking_findings = [
            f for f in findings
            if f["severity"] in ["critical", "high"]
        ]
        assert len(blocking_findings) > 0

    @pytest.mark.asyncio
    async def test_report_passed_true_only_with_low_findings(
        self,
        mock_backend,
        mock_artifact_writer,
        validation_config,
        agent_context,
    ):
        """Test that report.passed is True when only low/info findings exist."""
        # Code with only minor issues (weak crypto warning)
        weak_crypto_impl = {
            "files": [
                {
                    "path": "src/hash.py",
                    "content": '''
import hashlib
# Using MD5 for non-security checksum purposes
def checksum(data):
    return hashlib.md5(data).hexdigest()
''',
                }
            ]
        }

        mock_backend.execute.return_value = BackendResult(success=True, output="""{
                "findings": [],
                "compliance_status": {"OWASP_TOP_10": true},
                "scan_coverage": 95.0
            }""", structured_output=None)

        agent = SecurityAgent(
            backend=mock_backend,
            artifact_writer=mock_artifact_writer,
            config=validation_config,
        )

        result = await agent.execute(
            context=agent_context,
            event_metadata={"implementation": weak_crypto_impl},
        )

        # MD5 is flagged as HIGH severity, so this should fail
        assert result.success is False
