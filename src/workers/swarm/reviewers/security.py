"""Security-focused code reviewer implementation.

This module provides the SecurityReviewer class that specializes in
identifying security vulnerabilities and best practices violations.
"""

from __future__ import annotations


class SecurityReviewer:
    """Security-focused code reviewer.

    This reviewer specializes in identifying security vulnerabilities,
    authentication/authorization issues, input validation problems,
    and other security-related concerns in code.

    Attributes:
        reviewer_type: Always 'security'.
        focus_areas: Security domains this reviewer examines.
        severity_weights: Importance weights for each focus area.
    """

    reviewer_type: str = "security"
    focus_areas: list[str] = [
        "authentication",
        "authorization",
        "input_validation",
        "secrets_exposure",
        "injection_vulnerabilities",
        "cryptography",
    ]
    severity_weights: dict[str, float] = {
        "authentication": 1.0,
        "authorization": 1.0,
        "injection_vulnerabilities": 1.0,
        "secrets_exposure": 0.9,
        "cryptography": 0.8,
        "input_validation": 0.7,
    }

    def get_system_prompt(self) -> str:
        """Return the security-focused system prompt for LLM review.

        Returns:
            A detailed system prompt instructing the LLM to focus on
            security vulnerabilities and best practices.
        """
        return """You are a security-focused code reviewer specializing in identifying
vulnerabilities and security best practices violations.

Your primary focus areas are:
1. Authentication - Verify proper authentication mechanisms are in place
2. Authorization - Check that access controls are properly implemented
3. Input Validation - Ensure all user inputs are validated and sanitized
4. Secrets Exposure - Look for hardcoded credentials, API keys, or sensitive data
5. Injection Vulnerabilities - Identify SQL, command, or other injection risks
6. Cryptography - Review cryptographic implementations for weaknesses

When reviewing code:
- Prioritize findings by severity (CRITICAL > HIGH > MEDIUM > LOW > INFO)
- Provide specific line numbers and code snippets for each finding
- Include actionable recommendations for remediation
- Consider the OWASP Top 10 and CWE/SANS Top 25 vulnerabilities
- Flag any security anti-patterns or deprecated security practices

Be thorough but avoid false positives. Each finding should include:
- Clear description of the vulnerability
- Potential impact if exploited
- Specific remediation steps"""

    def get_checklist(self) -> list[str]:
        """Return the security review checklist.

        Returns:
            A list of security items to check during code review.
        """
        return [
            "Check for hardcoded credentials or API keys in the codebase",
            "Verify input validation on all user inputs and external data",
            "Look for SQL injection vulnerabilities in database queries",
            "Check for command injection possibilities in shell executions",
            "Verify authentication is required on all protected endpoints",
            "Check that authorization checks are performed before sensitive operations",
            "Look for path traversal vulnerabilities in file operations",
            "Verify proper escaping of output to prevent XSS attacks",
            "Check for insecure direct object references (IDOR)",
            "Review cryptographic implementations for weak algorithms or improper use",
            "Verify secrets are not logged or exposed in error messages",
            "Check for proper session management and token handling",
            "Look for race conditions in security-critical code paths",
            "Verify CORS configuration is appropriately restrictive",
            "Check for proper TLS/SSL configuration and certificate validation",
        ]
