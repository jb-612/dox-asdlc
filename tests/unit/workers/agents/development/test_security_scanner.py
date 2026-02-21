"""Unit tests for security_scanner module."""

from __future__ import annotations

import pytest

from src.workers.agents.development.models import IssueSeverity
from src.workers.agents.development.security_scanner import (
    INJECTION_PATTERNS,
    OWASP_PATTERNS,
    SAFE_PATTERNS,
    SECRET_PATTERNS,
    run_security_scan,
    scan_for_injection_vulnerabilities,
    scan_for_owasp_vulnerabilities,
    scan_for_secrets,
)


class TestScanForSecrets:
    """Tests for scan_for_secrets()."""

    def test_detects_api_key_patterns(self) -> None:
        """Test that the scanner detects API key patterns."""
        code = '''
API_KEY = "sk-1234567890abcdef"
api_key = "AKIAIOSFODNN7EXAMPLE"
'''
        findings = scan_for_secrets(code)

        assert len(findings) >= 1
        assert any(
            "api" in f.description.lower() or "key" in f.description.lower()
            for f in findings
        )
        assert all(f.severity.value in ("high", "critical") for f in findings)

    def test_detects_password_patterns(self) -> None:
        """Test that the scanner detects password patterns."""
        code = '''
password = "secret123"
PASSWORD = "admin"
db_password = "hunter2"
'''
        findings = scan_for_secrets(code)

        assert len(findings) >= 1
        assert any("password" in f.description.lower() for f in findings)

    def test_detects_token_patterns(self) -> None:
        """Test that the scanner detects token patterns."""
        code = '''
token = "ghp_xxxxxxxxxxxxxxxxxxxx"
AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIs..."
access_token = "ya29.a0ARrdaM..."
'''
        findings = scan_for_secrets(code)

        assert len(findings) >= 1
        assert any("token" in f.description.lower() for f in findings)

    def test_ignores_safe_patterns(self) -> None:
        """Test that the scanner ignores environment variable lookups."""
        safe_code = '''
# API_KEY should be loaded from environment
api_key = os.environ.get("API_KEY")
password = os.getenv("PASSWORD")
token = config.get("token")
'''
        findings = scan_for_secrets(safe_code)
        assert len(findings) == 0

    def test_returns_critical_severity_for_secrets(self) -> None:
        """Test that secret findings have CRITICAL severity."""
        code = 'password = "hunter2"'
        findings = scan_for_secrets(code)
        assert len(findings) >= 1
        assert all(f.severity == IssueSeverity.CRITICAL for f in findings)

    def test_includes_line_numbers(self) -> None:
        """Test that findings include correct line numbers."""
        code = "safe_line = 1\npassword = 'secret'\nanother_safe_line = 2"
        findings = scan_for_secrets(code)
        assert len(findings) >= 1
        assert findings[0].line_number == 2

    def test_includes_security_metadata(self) -> None:
        """Test that findings include category and type metadata."""
        code = 'api_key = "sk-12345678901234567890"'
        findings = scan_for_secrets(code)
        assert len(findings) >= 1
        assert findings[0].metadata.get("category") == "security"
        assert findings[0].metadata.get("type") == "secret"


class TestScanForInjectionVulnerabilities:
    """Tests for scan_for_injection_vulnerabilities()."""

    def test_detects_sql_injection(self) -> None:
        """Test that the scanner detects SQL injection vulnerabilities."""
        sql_injection_code = '''
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return execute(query)
'''
        findings = scan_for_injection_vulnerabilities(sql_injection_code)

        assert len(findings) >= 1
        assert any("sql" in f.description.lower() for f in findings)
        assert all(f.severity.value in ("high", "critical") for f in findings)

    def test_detects_command_injection(self) -> None:
        """Test that the scanner detects command injection vulnerabilities."""
        command_injection_code = '''
def run_command(user_input):
    os.system(f"ls {user_input}")
    subprocess.call("rm " + user_input, shell=True)
'''
        findings = scan_for_injection_vulnerabilities(command_injection_code)

        assert len(findings) >= 1
        assert any(
            "command" in f.description.lower() or "shell" in f.description.lower()
            for f in findings
        )

    def test_detects_xss_patterns(self) -> None:
        """Test that the scanner detects XSS patterns."""
        xss_code = '''
def render_html(user_input):
    return f"<div>{user_input}</div>"
'''
        findings = scan_for_injection_vulnerabilities(xss_code)

        assert len(findings) >= 1
        assert any(
            "xss" in f.description.lower() or "html" in f.description.lower()
            for f in findings
        )

    def test_returns_injection_type_metadata(self) -> None:
        """Test that injection findings have correct metadata type."""
        code = 'query = f"SELECT * FROM t WHERE id = {x}"'
        findings = scan_for_injection_vulnerabilities(code)
        assert len(findings) >= 1
        assert findings[0].metadata.get("type") == "injection"


class TestScanForOwaspVulnerabilities:
    """Tests for scan_for_owasp_vulnerabilities()."""

    def test_detects_insecure_deserialization(self) -> None:
        """Test that the scanner detects insecure deserialization."""
        deserialization_code = '''
import pickle

def load_data(user_data):
    return pickle.loads(user_data)
'''
        findings = scan_for_owasp_vulnerabilities(deserialization_code)

        assert len(findings) >= 1
        assert any(
            "deserialization" in f.description.lower() or "pickle" in f.description.lower()
            for f in findings
        )

    def test_detects_path_traversal(self) -> None:
        """Test that the scanner detects path traversal vulnerabilities."""
        path_traversal_code = '''
def read_file(filename):
    path = "/data/" + filename
    with open(path) as f:
        return f.read()
'''
        findings = scan_for_owasp_vulnerabilities(path_traversal_code)

        assert len(findings) >= 1
        assert any(
            "path" in f.description.lower() or "traversal" in f.description.lower()
            for f in findings
        )

    def test_detects_eval_usage(self) -> None:
        """Test that the scanner detects eval usage."""
        eval_code = '''
def calculate(user_expression):
    return eval(user_expression)
'''
        findings = scan_for_owasp_vulnerabilities(eval_code)

        assert len(findings) >= 1
        assert any("eval" in f.description.lower() for f in findings)

    def test_path_traversal_has_high_severity(self) -> None:
        """Test that path traversal findings are HIGH (not CRITICAL)."""
        code = 'path = "/data/" + filename'
        findings = scan_for_owasp_vulnerabilities(code)
        path_findings = [f for f in findings if "path" in f.description.lower()]
        assert len(path_findings) >= 1
        assert path_findings[0].severity == IssueSeverity.HIGH

    def test_weak_crypto_has_high_severity(self) -> None:
        """Test that weak cryptography findings are HIGH severity."""
        code = "digest = hashlib.md5(data)"
        findings = scan_for_owasp_vulnerabilities(code)
        assert len(findings) >= 1
        md5_findings = [f for f in findings if "md5" in f.description.lower()]
        assert len(md5_findings) >= 1
        assert md5_findings[0].severity == IssueSeverity.HIGH

    def test_returns_owasp_type_metadata(self) -> None:
        """Test that OWASP findings have correct metadata type."""
        code = "result = eval(user_expr)"
        findings = scan_for_owasp_vulnerabilities(code)
        assert len(findings) >= 1
        assert findings[0].metadata.get("type") == "owasp"


class TestRunSecurityScan:
    """Tests for the combined run_security_scan() function."""

    def test_combines_all_scan_types(self) -> None:
        """Test that run_security_scan combines all scan types."""
        vulnerable_code = '''
API_KEY = "sk-secret123"
password = "admin"

def query(user_input):
    return f"SELECT * FROM users WHERE name = '{user_input}'"

def process(data):
    return pickle.loads(data)
'''
        findings = run_security_scan(vulnerable_code)

        # Should detect secrets, injection, and OWASP issues
        assert len(findings) >= 3
        categories = set()
        for f in findings:
            if f.metadata:
                categories.add(f.metadata.get("category", ""))
        assert "security" in categories or len(findings) >= 3

    def test_returns_empty_for_clean_code(self) -> None:
        """Test that clean code produces zero findings."""
        clean_code = '''
import os

def get_config():
    api_key = os.environ.get("API_KEY")
    return {"key": api_key}
'''
        findings = run_security_scan(clean_code)
        assert len(findings) == 0

    def test_issue_ids_are_unique_within_type(self) -> None:
        """Test that issue IDs do not collide within a single scan type."""
        code = '''
password = "pass1"
api_key = "sk-12345678901234567890"
'''
        findings = run_security_scan(code)
        ids = [f.id for f in findings]
        assert len(ids) == len(set(ids)), f"Duplicate IDs found: {ids}"


class TestPatternConstants:
    """Tests ensuring pattern lists are non-empty and well-formed."""

    def test_secret_patterns_non_empty(self) -> None:
        """SECRET_PATTERNS list must not be empty."""
        assert len(SECRET_PATTERNS) > 0

    def test_safe_patterns_non_empty(self) -> None:
        """SAFE_PATTERNS list must not be empty."""
        assert len(SAFE_PATTERNS) > 0

    def test_injection_patterns_non_empty(self) -> None:
        """INJECTION_PATTERNS list must not be empty."""
        assert len(INJECTION_PATTERNS) > 0

    def test_owasp_patterns_non_empty(self) -> None:
        """OWASP_PATTERNS list must not be empty."""
        assert len(OWASP_PATTERNS) > 0

    def test_secret_patterns_are_tuples_of_two(self) -> None:
        """Each SECRET_PATTERN entry should be (regex, description)."""
        for entry in SECRET_PATTERNS:
            assert isinstance(entry, tuple) and len(entry) == 2
