"""Prompts for Security agent.

Provides prompts for vulnerability detection, secrets scanning, and compliance
checking with OWASP patterns and severity classification guidelines.
"""

from __future__ import annotations

from typing import Any

# OWASP Top 10 vulnerability patterns for detection
OWASP_PATTERNS: dict[str, dict[str, Any]] = {
    "A01:2021-Broken-Access-Control": {
        "description": "Failures to enforce proper access controls",
        "patterns": [
            "Missing authorization checks",
            "Insecure direct object references (IDOR)",
            "Path traversal vulnerabilities",
            "CORS misconfiguration",
            "Privilege escalation",
        ],
        "severity": "CRITICAL",
    },
    "A02:2021-Cryptographic-Failures": {
        "description": "Failures related to cryptography",
        "patterns": [
            "Weak encryption algorithms (DES, MD5, SHA1)",
            "Hardcoded encryption keys",
            "Missing encryption for sensitive data",
            "Insecure random number generation",
        ],
        "severity": "HIGH",
    },
    "A03:2021-Injection": {
        "description": "SQL, NoSQL, OS, LDAP injection and XSS vulnerabilities",
        "patterns": [
            "SQL injection via string concatenation",
            "Command injection via os.system/subprocess",
            "LDAP injection",
            "XPath injection",
            "Use of eval() or exec()",
            "Cross-site scripting (XSS) via unescaped output",
            "HTML injection in templates",
        ],
        "severity": "CRITICAL",
    },
    "A04:2021-Insecure-Design": {
        "description": "Design flaws that cannot be fixed by implementation",
        "patterns": [
            "Missing rate limiting",
            "No account lockout mechanism",
            "Insufficient input validation design",
            "Trust boundary violations",
        ],
        "severity": "HIGH",
    },
    "A05:2021-Security-Misconfiguration": {
        "description": "Insecure default configurations",
        "patterns": [
            "Debug mode enabled in production",
            "Default credentials",
            "Unnecessary features enabled",
            "Missing security headers",
            "Verbose error messages exposing internals",
        ],
        "severity": "MEDIUM",
    },
    "A06:2021-Vulnerable-Components": {
        "description": "Using components with known vulnerabilities",
        "patterns": [
            "Outdated dependencies",
            "Unpatched libraries",
            "Deprecated APIs",
        ],
        "severity": "HIGH",
    },
    "A07:2021-Auth-Failures": {
        "description": "Authentication and session management failures",
        "patterns": [
            "Weak password requirements",
            "Credential stuffing vulnerabilities",
            "Session fixation",
            "Missing multi-factor authentication",
            "Insecure session management",
        ],
        "severity": "CRITICAL",
    },
    "A08:2021-Software-Data-Integrity": {
        "description": "Integrity failures in software and data",
        "patterns": [
            "Insecure deserialization",
            "Missing integrity verification",
            "Untrusted CI/CD pipeline",
            "Auto-update without verification",
        ],
        "severity": "HIGH",
    },
    "A09:2021-Security-Logging-Failures": {
        "description": "Insufficient logging and monitoring",
        "patterns": [
            "Missing audit logs",
            "Logs not capturing security events",
            "No alerting on suspicious activity",
            "Log injection vulnerabilities",
        ],
        "severity": "MEDIUM",
    },
    "A10:2021-SSRF": {
        "description": "Server-Side Request Forgery",
        "patterns": [
            "Unvalidated URL fetching",
            "Internal service exposure",
            "Cloud metadata access",
        ],
        "severity": "HIGH",
    },
}


# Severity levels with descriptions and response guidelines
SEVERITY_LEVELS: dict[str, dict[str, str]] = {
    "CRITICAL": {
        "description": "Immediate exploitation possible, data breach or system compromise likely",
        "response": "Must fix before release, blocks deployment",
        "examples": "Remote code execution, SQL injection, authentication bypass",
    },
    "HIGH": {
        "description": "Significant security impact, exploitation requires minimal effort",
        "response": "Must fix before release unless risk accepted by security team",
        "examples": "XSS, CSRF, insecure deserialization, hardcoded secrets",
    },
    "MEDIUM": {
        "description": "Moderate security impact, may require specific conditions",
        "response": "Should fix in current release cycle",
        "examples": "Missing security headers, verbose errors, weak configurations",
    },
    "LOW": {
        "description": "Minor security impact, defense-in-depth concern",
        "response": "Fix when convenient, track for future release",
        "examples": "Information disclosure, missing best practices",
    },
    "INFO": {
        "description": "Informational finding, no direct security impact",
        "response": "Consider for future improvements",
        "examples": "Code quality suggestions, documentation gaps",
    },
}


VULNERABILITY_SCAN_PROMPT = """You are an expert security engineer performing vulnerability analysis.

Your task is to scan code for security vulnerabilities following OWASP guidelines
and industry best practices. Identify potential security issues and classify them
by severity.

## OWASP Top 10 Categories to Check

1. **A01:2021 - Broken Access Control**: Missing authorization, IDOR, path traversal
2. **A02:2021 - Cryptographic Failures**: Weak crypto, exposed secrets, missing encryption
3. **A03:2021 - Injection**: SQL, command, LDAP, XPath injection, eval/exec usage
4. **A04:2021 - Insecure Design**: Missing rate limiting, no lockout, trust violations
5. **A05:2021 - Security Misconfiguration**: Debug mode, default creds, verbose errors
6. **A06:2021 - Vulnerable Components**: Outdated dependencies, deprecated APIs
7. **A07:2021 - Authentication Failures**: Weak passwords, session issues, missing MFA
8. **A08:2021 - Software Data Integrity**: Insecure deserialization, missing verification
9. **A09:2021 - Security Logging Failures**: Missing audit logs, no alerting
10. **A10:2021 - SSRF**: Unvalidated URL fetching, internal service exposure

## Severity Classification

- **CRITICAL**: Immediate exploitation possible, data breach or system compromise
- **HIGH**: Significant impact, exploitation requires minimal effort
- **MEDIUM**: Moderate impact, may require specific conditions
- **LOW**: Minor impact, defense-in-depth concern
- **INFO**: Informational, no direct security impact

## Detection Patterns

Look for these specific patterns:
- SQL queries built with string concatenation or f-strings
- Use of eval(), exec(), or compile() with user input
- os.system(), subprocess with shell=True
- Hardcoded passwords, API keys, or secrets
- Missing input validation or sanitization
- Insecure random number generation (random instead of secrets)
- Pickle/marshal deserialization of untrusted data
- Debug flags enabled
- Missing authentication/authorization decorators
- Unvalidated redirects or forwards

## Output Format

Provide your analysis as structured JSON:

```json
{
  "scan_summary": {
    "files_scanned": 0,
    "lines_analyzed": 0,
    "scan_level": "minimal|standard|thorough"
  },
  "findings": [
    {
      "id": "VULN-001",
      "owasp_category": "A03:2021-Injection",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "title": "Brief vulnerability title",
      "location": {
        "file": "filename.py",
        "line": 42,
        "function": "vulnerable_function"
      },
      "description": "Detailed description of the vulnerability",
      "evidence": "Code snippet showing the issue",
      "remediation": "How to fix this vulnerability",
      "references": ["CWE-89", "https://owasp.org/..."]
    }
  ],
  "statistics": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  },
  "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW|NONE",
  "recommendations": ["Priority ordered list of actions"]
}
```
"""


SECRETS_SCAN_PROMPT = """You are an expert security engineer scanning for exposed secrets.

Your task is to detect hardcoded secrets, credentials, API keys, and other
sensitive information that should not be in source code. This prevents
accidental exposure of authentication materials.

## Secret Types to Detect

### API Keys and Tokens
- AWS access keys (AKIA...)
- Google API keys (AIza...)
- GitHub tokens (ghp_, gho_, ghs_)
- Slack tokens (xoxb-, xoxa-, xoxp-)
- Stripe keys (sk_live_, pk_live_)
- Generic API keys (api_key, apikey, api-key)

### Credentials
- Passwords in code or config
- Database connection strings with credentials
- SSH private keys
- JWT secrets
- OAuth client secrets

### Cloud Provider Secrets
- AWS secret access keys
- Azure storage keys
- GCP service account keys
- Cloud API credentials

### Certificates and Keys
- Private keys (BEGIN RSA PRIVATE KEY)
- Certificates with private keys
- PGP private keys

## Detection Patterns

```
# Common patterns to flag:
- Variable names: password, secret, key, token, credential, auth
- String patterns: "sk-", "pk-", "AKIA", "AIza", "ghp_", "xox"
- Assignment patterns: PASSWORD = "...", api_key: "..."
- Environment references without validation
- Base64 encoded secrets
- Hex encoded keys
```

## Severity Classification

- **CRITICAL**: Production credentials, cloud provider keys, database passwords
- **HIGH**: API keys with significant permissions, JWT secrets
- **MEDIUM**: Development/test credentials, less sensitive tokens
- **LOW**: Potentially sensitive patterns that may be false positives
- **INFO**: Informational findings, patterns to review

## False Positive Handling

Consider these as potential false positives:
- Placeholder values like "YOUR_API_KEY_HERE"
- Environment variable references: os.getenv("SECRET")
- Test fixtures with clearly fake data
- Documentation examples

## Output Format

Provide your analysis as structured JSON:

```json
{
  "scan_summary": {
    "files_scanned": 0,
    "secrets_found": 0,
    "unique_secret_types": 0
  },
  "findings": [
    {
      "id": "SECRET-001",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "secret_type": "aws_access_key|api_key|password|token|certificate",
      "location": {
        "file": "filename.py",
        "line": 42,
        "column": 15
      },
      "description": "What was found",
      "evidence": "Redacted evidence showing pattern",
      "confidence": "high|medium|low",
      "remediation": "How to fix (rotate, use env vars, use secrets manager)"
    }
  ],
  "statistics": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  },
  "recommendations": [
    "Rotate exposed credentials immediately",
    "Use environment variables or secrets manager",
    "Add .gitignore patterns for sensitive files"
  ],
  "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW|NONE"
}
```
"""


COMPLIANCE_CHECK_PROMPT = """You are an expert security compliance auditor.

Your task is to verify code compliance with security frameworks and standards.
Check adherence to OWASP guidelines, CWE classifications, and security best
practices applicable to the codebase.

## Compliance Frameworks

### OWASP Application Security Verification Standard (ASVS)
- V1: Architecture, Design and Threat Modeling
- V2: Authentication
- V3: Session Management
- V4: Access Control
- V5: Validation, Sanitization and Encoding
- V6: Stored Cryptography
- V7: Error Handling and Logging
- V8: Data Protection
- V9: Communication
- V10: Malicious Code
- V11: Business Logic
- V12: Files and Resources
- V13: API and Web Service
- V14: Configuration

### CWE (Common Weakness Enumeration)
- CWE-20: Improper Input Validation
- CWE-22: Path Traversal
- CWE-78: OS Command Injection
- CWE-79: Cross-site Scripting (XSS)
- CWE-89: SQL Injection
- CWE-94: Code Injection
- CWE-119: Buffer Errors
- CWE-200: Information Exposure
- CWE-287: Improper Authentication
- CWE-311: Missing Encryption
- CWE-312: Cleartext Storage of Sensitive Information
- CWE-327: Use of Broken Crypto Algorithm
- CWE-352: Cross-Site Request Forgery
- CWE-434: Unrestricted File Upload
- CWE-502: Deserialization of Untrusted Data
- CWE-601: URL Redirection
- CWE-798: Hardcoded Credentials

### SANS Top 25
- Focus on most dangerous software errors
- Maps to CWE classifications

## Compliance Checks

For each compliance area, verify:

1. **Input Validation (CWE-20)**
   - All user inputs validated
   - Allowlist validation preferred
   - Consistent validation across entry points

2. **Authentication (CWE-287)**
   - Strong password requirements
   - Account lockout mechanism
   - Secure credential storage
   - Multi-factor authentication support

3. **Authorization (CWE-285)**
   - Role-based access control
   - Principle of least privilege
   - Authorization on all sensitive operations

4. **Cryptography (CWE-327, CWE-311)**
   - Strong encryption algorithms
   - Proper key management
   - TLS for data in transit
   - Encryption at rest for sensitive data

5. **Error Handling (CWE-209)**
   - No sensitive data in errors
   - Consistent error responses
   - Proper logging without secrets

6. **Logging (CWE-778)**
   - Security events logged
   - Log integrity protected
   - Sufficient detail for forensics

## Output Format

Provide your analysis as structured JSON:

```json
{
  "compliance_summary": {
    "frameworks_checked": ["OWASP ASVS", "CWE"],
    "total_requirements": 0,
    "compliant": 0,
    "non_compliant": 0,
    "not_applicable": 0
  },
  "findings": [
    {
      "id": "COMPLIANCE-001",
      "framework": "OWASP ASVS|CWE|SANS",
      "requirement": "V5.1.1|CWE-20",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "status": "PASS|FAIL|NOT_APPLICABLE|NEEDS_REVIEW",
      "description": "What was checked",
      "evidence": "Code or configuration evidence",
      "remediation": "How to achieve compliance",
      "references": ["Link to standard documentation"]
    }
  ],
  "compliance_status": {
    "OWASP_ASVS": {"passed": 0, "failed": 0, "percentage": 0.0},
    "CWE": {"passed": 0, "failed": 0, "percentage": 0.0}
  },
  "recommendations": [
    "Priority ordered compliance remediation steps"
  ],
  "overall_compliance": "COMPLIANT|PARTIALLY_COMPLIANT|NON_COMPLIANT"
}
```
"""


def format_vulnerability_scan_prompt(
    code: str,
    scan_level: str = "standard",
    file_path: str | None = None,
    context: str | None = None,
) -> str:
    """Format the vulnerability scan prompt with code to analyze.

    Args:
        code: The code to scan for vulnerabilities.
        scan_level: Scan depth - "minimal", "standard", or "thorough".
        file_path: Optional file path for context.
        context: Optional additional context about the codebase.

    Returns:
        str: Formatted prompt for vulnerability scanning.
    """
    prompt_parts = [
        VULNERABILITY_SCAN_PROMPT,
        "",
        "## Scan Configuration",
        "",
        f"**Scan Level:** {scan_level}",
        "",
    ]

    # Add scan level specific instructions
    if scan_level == "minimal":
        prompt_parts.extend([
            "Focus on CRITICAL and HIGH severity issues only.",
            "Check for obvious injection and authentication flaws.",
            "",
        ])
    elif scan_level == "thorough":
        prompt_parts.extend([
            "Perform comprehensive deep analysis of all OWASP categories.",
            "Include LOW and INFO findings for defense in depth.",
            "Check for subtle security anti-patterns.",
            "Analyze data flow for potential vulnerabilities.",
            "",
        ])
    else:  # standard
        prompt_parts.extend([
            "Check all OWASP categories at standard depth.",
            "Focus on CRITICAL, HIGH, and MEDIUM severity issues.",
            "",
        ])

    if file_path:
        prompt_parts.extend([f"**File:** {file_path}", ""])

    prompt_parts.extend([
        "## Code to Analyze",
        "",
        "```python",
        code,
        "```",
    ])

    if context:
        prompt_parts.extend([
            "",
            "## Additional Context",
            "",
            context,
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Analyze the code for security vulnerabilities following OWASP guidelines.",
        "Classify each finding by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO).",
        "Provide specific remediation recommendations for each issue.",
        "Return results as structured JSON following the output format above.",
    ])

    return "\n".join(prompt_parts)


def format_secrets_scan_prompt(
    code: str,
    file_path: str | None = None,
    include_patterns: list[str] | None = None,
) -> str:
    """Format the secrets scan prompt with code to analyze.

    Args:
        code: The code to scan for secrets.
        file_path: Optional file path for context.
        include_patterns: Optional list of additional patterns to check.

    Returns:
        str: Formatted prompt for secrets scanning.
    """
    prompt_parts = [
        SECRETS_SCAN_PROMPT,
        "",
    ]

    if file_path:
        prompt_parts.extend([f"**File:** {file_path}", ""])

    prompt_parts.extend([
        "## Code to Analyze",
        "",
        "```python",
        code,
        "```",
    ])

    if include_patterns:
        prompt_parts.extend([
            "",
            "## Additional Patterns to Check",
            "",
        ])
        for pattern in include_patterns:
            prompt_parts.append(f"- {pattern}")
        prompt_parts.append("")

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Scan the code for hardcoded secrets, API keys, credentials, and tokens.",
        "Classify each finding by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO).",
        "Flag both confirmed secrets and suspicious patterns.",
        "Provide confidence level (high/medium/low) for each finding.",
        "Return results as structured JSON following the output format above.",
    ])

    return "\n".join(prompt_parts)


def format_compliance_check_prompt(
    code: str,
    frameworks: list[str],
    file_path: str | None = None,
    specific_requirements: list[str] | None = None,
) -> str:
    """Format the compliance check prompt with code and frameworks.

    Args:
        code: The code to check for compliance.
        frameworks: List of compliance frameworks to check (e.g., ["OWASP", "CWE"]).
        file_path: Optional file path for context.
        specific_requirements: Optional list of specific requirements to verify.

    Returns:
        str: Formatted prompt for compliance checking.
    """
    prompt_parts = [
        COMPLIANCE_CHECK_PROMPT,
        "",
        "## Compliance Scope",
        "",
    ]

    # Use default frameworks if none specified
    effective_frameworks = frameworks if frameworks else ["OWASP ASVS", "CWE"]

    prompt_parts.append("**Frameworks to verify:**")
    for framework in effective_frameworks:
        prompt_parts.append(f"- {framework}")
    prompt_parts.append("")

    if file_path:
        prompt_parts.extend([f"**File:** {file_path}", ""])

    prompt_parts.extend([
        "## Code to Analyze",
        "",
        "```python",
        code,
        "```",
    ])

    if specific_requirements:
        prompt_parts.extend([
            "",
            "## Specific Requirements to Verify",
            "",
        ])
        for req in specific_requirements:
            prompt_parts.append(f"- {req}")
        prompt_parts.append("")

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        f"Check code compliance against: {', '.join(effective_frameworks)}",
        "Verify adherence to security best practices.",
        "Classify each finding by severity and compliance status.",
        "Provide remediation recommendations for non-compliant areas.",
        "Return results as structured JSON following the output format above.",
    ])

    return "\n".join(prompt_parts)
