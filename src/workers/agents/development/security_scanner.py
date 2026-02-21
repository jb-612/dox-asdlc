"""Security scanner for static code analysis.

Pattern-based detection of hardcoded secrets, injection vulnerabilities,
and common OWASP security patterns.
"""

from __future__ import annotations

import re

from src.workers.agents.development.models import IssueSeverity, ReviewIssue

# ---------------------------------------------------------------------------
# Patterns for detecting hardcoded secrets
# ---------------------------------------------------------------------------
SECRET_PATTERNS: list[tuple[str, str]] = [
    # API keys
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded API key detected"),
    (r'(?i)AKIA[0-9A-Z]{16}', "AWS Access Key ID detected"),
    (r'sk-[a-zA-Z0-9]{20,}', "OpenAI/Stripe API key detected"),
    # Passwords
    (r'(?i)(password|passwd|pwd)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded password detected"),
    (
        r'(?i)(db_password|database_password|mysql_password)\s*[=:]\s*["\'][^"\']+["\']',
        "Hardcoded database password detected",
    ),
    # Tokens
    (
        r'(?i)(token|auth_token|access_token|bearer)\s*[=:]\s*["\'][^"\']+["\']',
        "Hardcoded token detected",
    ),
    (r'ghp_[a-zA-Z0-9]{36,}', "GitHub Personal Access Token detected"),
    (r'(?i)eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+', "JWT token detected"),
    # Secrets
    (
        r'(?i)(secret|private_key|secret_key)\s*[=:]\s*["\'][^"\']+["\']',
        "Hardcoded secret detected",
    ),
]

# Safe patterns that should be ignored (environment variables, config lookups)
SAFE_PATTERNS: list[str] = [
    r'os\.environ\.get\s*\(',
    r'os\.getenv\s*\(',
    r'config\.get\s*\(',
    r'settings\.',
    r'env\.',
    r'#.*',  # Comments
]

# Injection vulnerability patterns
INJECTION_PATTERNS: list[tuple[str, str]] = [
    # SQL Injection
    (r'f["\']SELECT\s+.*\{', "Potential SQL injection via f-string"),
    (r'f["\']INSERT\s+.*\{', "Potential SQL injection via f-string"),
    (r'f["\']UPDATE\s+.*\{', "Potential SQL injection via f-string"),
    (r'f["\']DELETE\s+.*\{', "Potential SQL injection via f-string"),
    (r'["\']SELECT\s+.*["\']\s*\+\s*', "Potential SQL injection via string concatenation"),
    (r'["\']INSERT\s+.*["\']\s*\+\s*', "Potential SQL injection via string concatenation"),
    (r'\.format\(.*\).*SELECT', "Potential SQL injection via format()"),
    (r'%\s*\(.*\).*SELECT', "Potential SQL injection via % formatting"),
    # Command Injection
    (r'os\.system\s*\(\s*f["\']', "Command injection via os.system with f-string"),
    (r'os\.system\s*\([^)]*\+', "Command injection via os.system with concatenation"),
    (
        r'subprocess\.\w+\s*\([^)]*shell\s*=\s*True',
        "Shell injection via subprocess with shell=True",
    ),
    (
        r'subprocess\.call\s*\([^)]*\+',
        "Command injection via subprocess.call with concatenation",
    ),
    # XSS
    (r'f["\']<[^>]*\{[^}]+\}[^>]*>', "Potential XSS via unescaped HTML in f-string"),
    (
        r'["\']<[^>]*["\']\s*\+\s*\w+\s*\+\s*["\']',
        "Potential XSS via HTML concatenation",
    ),
    (
        r'f"<\w+>\{[^}]+\}</\w+>"',
        "Potential XSS via unescaped user content in HTML f-string",
    ),
    (
        r"f'<\w+>\{[^}]+\}</\w+>'",
        "Potential XSS via unescaped user content in HTML f-string",
    ),
]

# OWASP vulnerability patterns
OWASP_PATTERNS: list[tuple[str, str]] = [
    # Insecure deserialization
    (r'pickle\.loads?\s*\(', "Insecure deserialization with pickle.loads()"),
    (r'yaml\.load\s*\([^)]*\)', "Potentially unsafe YAML loading (use safe_load)"),
    (r'marshal\.loads?\s*\(', "Insecure deserialization with marshal"),
    # Code execution
    (r'\beval\s*\(', "Dangerous use of eval()"),
    (r'\bexec\s*\(', "Dangerous use of exec()"),
    (r'__import__\s*\(', "Dynamic import can be dangerous"),
    # Path traversal
    (
        r'open\s*\([^)]*\+[^)]*\)',
        "Potential path traversal via string concatenation in open()",
    ),
    (
        r'(?i)with\s+open\s*\([^)]*\+[^)]*filename',
        "Potential path traversal vulnerability",
    ),
    (r'/data/.*\+\s*\w+', "Potential path traversal in file path construction"),
    # Weak cryptography
    (r'hashlib\.md5\s*\(', "Weak cryptography: MD5 should not be used for security"),
    (r'hashlib\.sha1\s*\(', "Weak cryptography: SHA1 should not be used for security"),
    # Hardcoded credentials
    (r'(?i)admin.*password', "Possible hardcoded admin credentials"),
]


def _is_safe_line(line: str) -> bool:
    """Check whether a line matches a safe pattern.

    Args:
        line: A single line of source code.

    Returns:
        True if the line uses an environment variable or config lookup.
    """
    for safe_pattern in SAFE_PATTERNS:
        if re.search(safe_pattern, line):
            return True
    return False


def scan_for_secrets(code: str) -> list[ReviewIssue]:
    """Scan code for hardcoded secrets like API keys, passwords, and tokens.

    Args:
        code: Source code to scan.

    Returns:
        List of security issues found.
    """
    issues: list[ReviewIssue] = []
    issue_counter = 0

    lines = code.split("\n")
    for line_num, line in enumerate(lines, 1):
        if _is_safe_line(line):
            continue

        for pattern, description in SECRET_PATTERNS:
            matches = re.finditer(pattern, line)
            for _match in matches:
                issue_counter += 1
                issues.append(
                    ReviewIssue(
                        id=f"SEC-{issue_counter:03d}",
                        description=description,
                        severity=IssueSeverity.CRITICAL,
                        file_path="",
                        line_number=line_num,
                        suggestion=(
                            "Use environment variables or a secrets manager "
                            "instead of hardcoding credentials"
                        ),
                        metadata={"category": "security", "type": "secret"},
                    )
                )

    return issues


def scan_for_injection_vulnerabilities(code: str) -> list[ReviewIssue]:
    """Scan code for injection vulnerabilities (SQL, command, XSS).

    Args:
        code: Source code to scan.

    Returns:
        List of injection vulnerability issues found.
    """
    issues: list[ReviewIssue] = []
    issue_counter = 0

    lines = code.split("\n")
    for line_num, line in enumerate(lines, 1):
        for pattern, description in INJECTION_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                issue_counter += 1
                issues.append(
                    ReviewIssue(
                        id=f"INJ-{issue_counter:03d}",
                        description=description,
                        severity=IssueSeverity.CRITICAL,
                        file_path="",
                        line_number=line_num,
                        suggestion=(
                            "Use parameterized queries for SQL, subprocess with "
                            "list arguments for commands, and proper escaping for HTML"
                        ),
                        metadata={"category": "security", "type": "injection"},
                    )
                )

    return issues


def scan_for_owasp_vulnerabilities(code: str) -> list[ReviewIssue]:
    """Scan code for common OWASP vulnerability patterns.

    Args:
        code: Source code to scan.

    Returns:
        List of OWASP vulnerability issues found.
    """
    issues: list[ReviewIssue] = []
    issue_counter = 0

    lines = code.split("\n")
    for line_num, line in enumerate(lines, 1):
        for pattern, description in OWASP_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                issue_counter += 1
                severity = IssueSeverity.CRITICAL
                suggestion = "Review and replace with a secure alternative"

                # Customize severity and suggestions
                if "pickle" in description.lower() or "eval" in description.lower():
                    suggestion = (
                        "Use JSON or other safe serialization formats; "
                        "avoid eval/exec"
                    )
                elif "path" in description.lower():
                    severity = IssueSeverity.HIGH
                    suggestion = (
                        "Validate and sanitize file paths; "
                        "use os.path.join with basename"
                    )
                elif "yaml" in description.lower():
                    suggestion = "Use yaml.safe_load() instead of yaml.load()"
                elif "md5" in description.lower() or "sha1" in description.lower():
                    severity = IssueSeverity.HIGH
                    suggestion = (
                        "Use SHA-256 or stronger hashing algorithms "
                        "for security purposes"
                    )

                issues.append(
                    ReviewIssue(
                        id=f"OWASP-{issue_counter:03d}",
                        description=description,
                        severity=severity,
                        file_path="",
                        line_number=line_num,
                        suggestion=suggestion,
                        metadata={"category": "security", "type": "owasp"},
                    )
                )

    return issues


def run_security_scan(code: str) -> list[ReviewIssue]:
    """Run all security scans on the provided code.

    Combines secret detection, injection vulnerability scanning,
    and OWASP pattern checks.

    Args:
        code: Source code to scan.

    Returns:
        Combined list of all security issues found.
    """
    all_issues: list[ReviewIssue] = []

    all_issues.extend(scan_for_secrets(code))
    all_issues.extend(scan_for_injection_vulnerabilities(code))
    all_issues.extend(scan_for_owasp_vulnerabilities(code))

    return all_issues
