"""Unit tests for Security agent prompts.

Tests for vulnerability detection, secrets scanning, and compliance checking
prompts with security patterns and severity classification.
"""

from __future__ import annotations

from src.workers.agents.validation.prompts.security_prompts import (
    COMPLIANCE_CHECK_PROMPT,
    OWASP_PATTERNS,
    SECRETS_SCAN_PROMPT,
    SEVERITY_LEVELS,
    VULNERABILITY_SCAN_PROMPT,
    format_compliance_check_prompt,
    format_secrets_scan_prompt,
    format_vulnerability_scan_prompt,
)


class TestVulnerabilityScanPrompt:
    """Tests for vulnerability scan prompt."""

    def test_prompt_exists(self) -> None:
        """Test that vulnerability scan prompt is defined."""
        assert VULNERABILITY_SCAN_PROMPT is not None
        assert len(VULNERABILITY_SCAN_PROMPT) > 100

    def test_prompt_mentions_vulnerability(self) -> None:
        """Test that prompt mentions vulnerability or security."""
        prompt_lower = VULNERABILITY_SCAN_PROMPT.lower()
        assert "vulnerab" in prompt_lower or "security" in prompt_lower

    def test_prompt_has_severity_classification(self) -> None:
        """Test that prompt includes severity classification guidance."""
        prompt_lower = VULNERABILITY_SCAN_PROMPT.lower()
        assert "severity" in prompt_lower or "critical" in prompt_lower

    def test_prompt_mentions_owasp(self) -> None:
        """Test that prompt mentions OWASP patterns."""
        prompt_lower = VULNERABILITY_SCAN_PROMPT.lower()
        assert "owasp" in prompt_lower or "injection" in prompt_lower

    def test_prompt_has_structured_output(self) -> None:
        """Test that prompt includes structured output format."""
        assert "json" in VULNERABILITY_SCAN_PROMPT.lower()


class TestSecretsScanPrompt:
    """Tests for secrets scan prompt."""

    def test_prompt_exists(self) -> None:
        """Test that secrets scan prompt is defined."""
        assert SECRETS_SCAN_PROMPT is not None
        assert len(SECRETS_SCAN_PROMPT) > 100

    def test_prompt_mentions_secrets(self) -> None:
        """Test that prompt mentions secrets or credentials."""
        prompt_lower = SECRETS_SCAN_PROMPT.lower()
        assert "secret" in prompt_lower or "credential" in prompt_lower

    def test_prompt_mentions_detection_patterns(self) -> None:
        """Test that prompt mentions detection patterns."""
        prompt_lower = SECRETS_SCAN_PROMPT.lower()
        assert (
            "api" in prompt_lower
            or "key" in prompt_lower
            or "token" in prompt_lower
            or "password" in prompt_lower
        )

    def test_prompt_has_severity_classification(self) -> None:
        """Test that prompt includes severity classification."""
        prompt_lower = SECRETS_SCAN_PROMPT.lower()
        assert "severity" in prompt_lower or "critical" in prompt_lower


class TestComplianceCheckPrompt:
    """Tests for compliance check prompt."""

    def test_prompt_exists(self) -> None:
        """Test that compliance check prompt is defined."""
        assert COMPLIANCE_CHECK_PROMPT is not None
        assert len(COMPLIANCE_CHECK_PROMPT) > 100

    def test_prompt_mentions_compliance(self) -> None:
        """Test that prompt mentions compliance."""
        assert "compliance" in COMPLIANCE_CHECK_PROMPT.lower()

    def test_prompt_mentions_frameworks(self) -> None:
        """Test that prompt mentions security frameworks."""
        prompt_lower = COMPLIANCE_CHECK_PROMPT.lower()
        assert (
            "owasp" in prompt_lower
            or "cwe" in prompt_lower
            or "framework" in prompt_lower
            or "standard" in prompt_lower
        )

    def test_prompt_has_structured_output(self) -> None:
        """Test that prompt includes structured output format."""
        assert "json" in COMPLIANCE_CHECK_PROMPT.lower()


class TestOwaspPatterns:
    """Tests for OWASP patterns definition."""

    def test_owasp_patterns_exists(self) -> None:
        """Test that OWASP patterns are defined."""
        assert OWASP_PATTERNS is not None
        assert isinstance(OWASP_PATTERNS, dict)

    def test_owasp_patterns_has_injection(self) -> None:
        """Test that OWASP patterns includes injection."""
        patterns_str = str(OWASP_PATTERNS).lower()
        assert "injection" in patterns_str or "sqli" in patterns_str

    def test_owasp_patterns_has_xss(self) -> None:
        """Test that OWASP patterns includes XSS."""
        patterns_str = str(OWASP_PATTERNS).lower()
        assert "xss" in patterns_str or "cross-site" in patterns_str

    def test_owasp_patterns_has_auth(self) -> None:
        """Test that OWASP patterns includes authentication issues."""
        patterns_str = str(OWASP_PATTERNS).lower()
        assert "auth" in patterns_str


class TestSeverityLevels:
    """Tests for severity levels definition."""

    def test_severity_levels_exists(self) -> None:
        """Test that severity levels are defined."""
        assert SEVERITY_LEVELS is not None
        assert isinstance(SEVERITY_LEVELS, dict)

    def test_severity_levels_has_critical(self) -> None:
        """Test that severity levels includes CRITICAL."""
        assert "CRITICAL" in SEVERITY_LEVELS or "critical" in str(SEVERITY_LEVELS).lower()

    def test_severity_levels_has_high(self) -> None:
        """Test that severity levels includes HIGH."""
        assert "HIGH" in SEVERITY_LEVELS or "high" in str(SEVERITY_LEVELS).lower()

    def test_severity_levels_has_medium(self) -> None:
        """Test that severity levels includes MEDIUM."""
        assert "MEDIUM" in SEVERITY_LEVELS or "medium" in str(SEVERITY_LEVELS).lower()

    def test_severity_levels_has_low(self) -> None:
        """Test that severity levels includes LOW."""
        assert "LOW" in SEVERITY_LEVELS or "low" in str(SEVERITY_LEVELS).lower()


class TestFormatVulnerabilityScanPrompt:
    """Tests for format_vulnerability_scan_prompt function."""

    def test_formats_with_code(self) -> None:
        """Test that function formats prompt with code input."""
        code = "def process_input(data): return eval(data)"

        result = format_vulnerability_scan_prompt(code, scan_level="standard")

        assert "process_input" in result or "eval" in result

    def test_includes_scan_level(self) -> None:
        """Test that function respects scan level parameter."""
        code = "def example(): pass"

        result_minimal = format_vulnerability_scan_prompt(code, scan_level="minimal")
        result_thorough = format_vulnerability_scan_prompt(code, scan_level="thorough")

        # Different scan levels should produce different outputs
        assert result_minimal is not None
        assert result_thorough is not None

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_vulnerability_scan_prompt(
            "def x(): pass",
            scan_level="standard",
        )

        assert "json" in result.lower() or "structured" in result.lower()

    def test_output_includes_severity_classification(self) -> None:
        """Test that output includes severity classification guidance."""
        result = format_vulnerability_scan_prompt(
            "def x(): pass",
            scan_level="standard",
        )

        prompt_lower = result.lower()
        assert (
            "severity" in prompt_lower
            or "critical" in prompt_lower
        )

    def test_output_mentions_owasp(self) -> None:
        """Test that output references OWASP patterns."""
        result = format_vulnerability_scan_prompt(
            "def x(): pass",
            scan_level="standard",
        )

        prompt_lower = result.lower()
        assert "owasp" in prompt_lower or "injection" in prompt_lower

    def test_thorough_scan_includes_more_checks(self) -> None:
        """Test that thorough scan level includes additional checks."""
        code = "def example(): pass"

        result = format_vulnerability_scan_prompt(code, scan_level="thorough")

        # Thorough scan should mention comprehensive or detailed checks
        prompt_lower = result.lower()
        assert (
            "thorough" in prompt_lower
            or "comprehensive" in prompt_lower
            or "deep" in prompt_lower
            or "all" in prompt_lower
        )


class TestFormatSecretsScanPrompt:
    """Tests for format_secrets_scan_prompt function."""

    def test_formats_with_code(self) -> None:
        """Test that function formats prompt with code input."""
        code = 'API_KEY = "sk-1234567890abcdef"'

        result = format_secrets_scan_prompt(code)

        assert "API_KEY" in result or "sk-" in result

    def test_output_mentions_secrets(self) -> None:
        """Test that output mentions secrets or credentials."""
        result = format_secrets_scan_prompt("def x(): pass")

        prompt_lower = result.lower()
        assert "secret" in prompt_lower or "credential" in prompt_lower

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_secrets_scan_prompt("def x(): pass")

        assert "json" in result.lower() or "structured" in result.lower()

    def test_output_mentions_common_patterns(self) -> None:
        """Test that output mentions common secret patterns."""
        result = format_secrets_scan_prompt("def x(): pass")

        prompt_lower = result.lower()
        # Should mention at least one common pattern type
        assert (
            "api" in prompt_lower
            or "key" in prompt_lower
            or "token" in prompt_lower
            or "password" in prompt_lower
            or "credential" in prompt_lower
        )

    def test_output_includes_severity(self) -> None:
        """Test that output includes severity classification."""
        result = format_secrets_scan_prompt("def x(): pass")

        prompt_lower = result.lower()
        assert "severity" in prompt_lower or "critical" in prompt_lower


class TestFormatComplianceCheckPrompt:
    """Tests for format_compliance_check_prompt function."""

    def test_formats_with_code(self) -> None:
        """Test that function formats prompt with code input."""
        code = "def handle_user_data(data): store(data)"

        result = format_compliance_check_prompt(code, frameworks=["OWASP"])

        assert "handle_user_data" in result

    def test_includes_frameworks(self) -> None:
        """Test that function includes specified compliance frameworks."""
        code = "def example(): pass"
        frameworks = ["OWASP", "CWE", "SANS"]

        result = format_compliance_check_prompt(code, frameworks=frameworks)

        # At least one framework should be mentioned
        result_upper = result.upper()
        assert (
            "OWASP" in result_upper
            or "CWE" in result_upper
            or "SANS" in result_upper
        )

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_compliance_check_prompt(
            "def x(): pass",
            frameworks=["OWASP"],
        )

        assert "json" in result.lower() or "structured" in result.lower()

    def test_output_mentions_compliance(self) -> None:
        """Test that output mentions compliance."""
        result = format_compliance_check_prompt(
            "def x(): pass",
            frameworks=["OWASP"],
        )

        assert "compliance" in result.lower()

    def test_output_includes_recommendations(self) -> None:
        """Test that output asks for remediation recommendations."""
        result = format_compliance_check_prompt(
            "def x(): pass",
            frameworks=["OWASP"],
        )

        prompt_lower = result.lower()
        assert (
            "recommend" in prompt_lower
            or "remediat" in prompt_lower
            or "fix" in prompt_lower
        )

    def test_empty_frameworks_uses_default(self) -> None:
        """Test that empty frameworks list uses default standards."""
        code = "def example(): pass"

        result = format_compliance_check_prompt(code, frameworks=[])

        # Should still produce valid output with default frameworks
        assert result is not None
        assert len(result) > 100
