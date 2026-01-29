"""SecurityAgent for vulnerability scanning and compliance checking.

Implements the security scanning agent that scans for vulnerabilities,
checks secrets exposure, verifies compliance requirements, and generates
security reports. Uses pattern-based detection combined with LLM analysis
for comprehensive security assessment.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.validation.config import ValidationConfig
from src.workers.agents.validation.models import (
    SecurityCategory,
    SecurityFinding,
    SecurityReport,
    Severity,
)

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


class SecurityAgentError(Exception):
    """Raised when SecurityAgent operations fail."""

    pass


# Security Scanner Patterns - Secrets Detection
SECRET_PATTERNS = [
    # API keys
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded API key detected"),
    (r'(?i)AKIA[0-9A-Z]{16}', "AWS Access Key ID detected"),
    (r'sk-[a-zA-Z0-9]{20,}', "OpenAI/Stripe API key detected"),
    # Passwords
    (r'(?i)(password|passwd|pwd)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded password detected"),
    (r'(?i)(db_password|database_password|mysql_password)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded database password detected"),
    # Tokens
    (r'(?i)(token|auth_token|access_token|bearer)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded token detected"),
    (r'ghp_[a-zA-Z0-9]{36,}', "GitHub Personal Access Token detected"),
    (r'(?i)eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+', "JWT token detected"),
    # Secrets
    (r'(?i)(secret|private_key|secret_key)\s*[=:]\s*["\'][^"\']+["\']', "Hardcoded secret detected"),
]

# Safe patterns that should be ignored (environment variables, config lookups)
SAFE_PATTERNS = [
    r'os\.environ\.get\s*\(',
    r'os\.getenv\s*\(',
    r'config\.get\s*\(',
    r'settings\.',
    r'env\.',
    r'#.*',  # Comments
]

# Injection vulnerability patterns
INJECTION_PATTERNS = [
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
    (r'subprocess\.\w+\s*\([^)]*shell\s*=\s*True', "Shell injection via subprocess with shell=True"),
    (r'subprocess\.call\s*\([^)]*\+', "Command injection via subprocess.call with concatenation"),
]

# XSS vulnerability patterns
XSS_PATTERNS = [
    (r'f["\']<[^>]*\{[^}]+\}[^>]*>', "Potential XSS via unescaped HTML in f-string"),
    (r'["\']<[^>]*["\']\s*\+\s*\w+\s*\+\s*["\']', "Potential XSS via HTML concatenation"),
    (r'f"<\w+>\{[^}]+\}</\w+>"', "Potential XSS via unescaped user content in HTML f-string"),
    (r"f'<\w+>\{[^}]+\}</\w+>'", "Potential XSS via unescaped user content in HTML f-string"),
]

# OWASP vulnerability patterns
OWASP_PATTERNS = [
    # Insecure deserialization
    (r'pickle\.loads?\s*\(', "Insecure deserialization with pickle.loads()"),
    (r'yaml\.load\s*\([^)]*\)', "Potentially unsafe YAML loading (use safe_load)"),
    (r'marshal\.loads?\s*\(', "Insecure deserialization with marshal"),
    # Code execution
    (r'\beval\s*\(', "Dangerous use of eval()"),
    (r'\bexec\s*\(', "Dangerous use of exec()"),
    (r'__import__\s*\(', "Dynamic import can be dangerous"),
    # Path traversal
    (r'open\s*\([^)]*\+[^)]*\)', "Potential path traversal via string concatenation in open()"),
    (r'(?i)with\s+open\s*\([^)]*\+[^)]*filename', "Potential path traversal vulnerability"),
    (r'/data/.*\+\s*\w+', "Potential path traversal in file path construction"),
    # Weak cryptography
    (r'hashlib\.md5\s*\(', "Weak cryptography: MD5 should not be used for security"),
    (r'hashlib\.sha1\s*\(', "Weak cryptography: SHA1 should not be used for security"),
    # Hardcoded credentials
    (r'(?i)admin.*password', "Possible hardcoded admin credentials"),
]


class SecurityAgent:
    """Agent that scans for security vulnerabilities and checks compliance.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses pattern-based detection combined with LLM analysis for comprehensive
    security assessment including vulnerability scanning, secrets detection,
    and compliance verification.

    Example:
        agent = SecurityAgent(
            llm_client=client,
            artifact_writer=writer,
            config=ValidationConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: ValidationConfig,
    ) -> None:
        """Initialize the SecurityAgent.

        Args:
            llm_client: LLM client for compliance analysis.
            artifact_writer: Writer for persisting artifacts.
            config: Validation configuration.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "security_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute security scan on the provided implementation.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - implementation: The implementation to scan (required)
                - feature_id: Feature identifier for the report
                - compliance_frameworks: Optional list of frameworks to check

        Returns:
            AgentResult: Result with security report artifacts on success.
        """
        logger.info(f"SecurityAgent starting for task {context.task_id}")

        try:
            # Validate required inputs
            implementation = event_metadata.get("implementation")
            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No implementation provided in event_metadata",
                    should_retry=False,
                )

            # Extract optional metadata
            feature_id = event_metadata.get("feature_id", context.task_id)
            compliance_frameworks = event_metadata.get(
                "compliance_frameworks", ["OWASP_TOP_10"]
            )

            # Extract code from implementation
            code_content = self._extract_code_content(implementation)

            # Run pattern-based security scans
            pattern_findings = self._run_security_scans(code_content)

            # Run LLM-based compliance analysis
            llm_analysis = await self._run_compliance_analysis(
                code_content=code_content,
                compliance_frameworks=compliance_frameworks,
            )

            # Merge findings
            all_findings = self._merge_findings(pattern_findings, llm_analysis)

            # Determine pass/fail status
            # Passed only if no critical or high severity findings
            has_blocking_findings = any(
                f.severity in (Severity.CRITICAL, Severity.HIGH)
                for f in all_findings
            )
            passed = not has_blocking_findings

            # Get compliance status from LLM analysis
            compliance_status = llm_analysis.get("compliance_status", {})
            scan_coverage = llm_analysis.get("scan_coverage", 85.0)

            # Create security report
            security_report = SecurityReport(
                feature_id=feature_id,
                findings=all_findings,
                passed=passed,
                scan_coverage=scan_coverage,
                compliance_status=compliance_status,
            )

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, security_report)

            logger.info(
                f"SecurityAgent completed for task {context.task_id}, "
                f"passed: {passed}, findings: {len(all_findings)}"
            )

            metadata: dict[str, Any] = {
                "security_report": security_report.to_dict(),
            }

            # Set HITL gate if passed
            if passed:
                metadata["hitl_gate"] = "HITL-5"
            else:
                metadata["hitl_gate"] = None

            return AgentResult(
                success=passed,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata=metadata,
            )

        except Exception as e:
            logger.error(f"SecurityAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _extract_code_content(self, implementation: dict[str, Any]) -> str:
        """Extract code content from implementation.

        Args:
            implementation: Implementation dict with files.

        Returns:
            str: Combined code content.
        """
        content_parts = []
        files = implementation.get("files", [])

        for file_info in files:
            path = file_info.get("path", "unknown")
            content = file_info.get("content", "")
            content_parts.append(f"# File: {path}\n{content}")

        return "\n\n".join(content_parts)

    def _run_security_scans(self, code: str) -> list[SecurityFinding]:
        """Run all pattern-based security scans.

        Args:
            code: Source code to scan.

        Returns:
            list[SecurityFinding]: Combined list of all security findings.
        """
        all_findings: list[SecurityFinding] = []

        # Run all scan types
        all_findings.extend(self._scan_for_secrets(code))
        all_findings.extend(self._scan_for_injection_vulnerabilities(code))
        all_findings.extend(self._scan_for_xss_vulnerabilities(code))
        all_findings.extend(self._scan_for_owasp_vulnerabilities(code))

        return all_findings

    def _is_safe_line(self, line: str) -> bool:
        """Check if line contains safe patterns.

        Args:
            line: Code line to check.

        Returns:
            bool: True if line is safe (uses env vars, config, etc.).
        """
        for safe_pattern in SAFE_PATTERNS:
            if re.search(safe_pattern, line):
                return True
        return False

    def _scan_for_secrets(self, code: str) -> list[SecurityFinding]:
        """Scan code for hardcoded secrets.

        Args:
            code: Source code to scan.

        Returns:
            list[SecurityFinding]: List of secret findings.
        """
        findings: list[SecurityFinding] = []
        finding_counter = 0

        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            # Skip safe patterns
            if self._is_safe_line(line):
                continue

            for pattern, description in SECRET_PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    finding_counter += 1
                    findings.append(
                        SecurityFinding(
                            id=f"SEC-{finding_counter:03d}",
                            severity=Severity.CRITICAL,
                            category=SecurityCategory.SECRETS,
                            location=f"line {line_num}",
                            description=description,
                            remediation="Use environment variables or a secrets manager instead of hardcoding credentials",
                        )
                    )

        return findings

    def _scan_for_injection_vulnerabilities(self, code: str) -> list[SecurityFinding]:
        """Scan code for injection vulnerabilities.

        Args:
            code: Source code to scan.

        Returns:
            list[SecurityFinding]: List of injection findings.
        """
        findings: list[SecurityFinding] = []
        finding_counter = 0

        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            for pattern, description in INJECTION_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    finding_counter += 1
                    findings.append(
                        SecurityFinding(
                            id=f"INJ-{finding_counter:03d}",
                            severity=Severity.CRITICAL,
                            category=SecurityCategory.INJECTION,
                            location=f"line {line_num}",
                            description=description,
                            remediation="Use parameterized queries for SQL, subprocess with list arguments for commands",
                        )
                    )

        return findings

    def _scan_for_xss_vulnerabilities(self, code: str) -> list[SecurityFinding]:
        """Scan code for XSS vulnerabilities.

        Args:
            code: Source code to scan.

        Returns:
            list[SecurityFinding]: List of XSS findings.
        """
        findings: list[SecurityFinding] = []
        finding_counter = 0

        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            for pattern, description in XSS_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    finding_counter += 1
                    findings.append(
                        SecurityFinding(
                            id=f"XSS-{finding_counter:03d}",
                            severity=Severity.CRITICAL,
                            category=SecurityCategory.XSS,
                            location=f"line {line_num}",
                            description=description,
                            remediation="Use proper HTML escaping or a templating engine with auto-escaping",
                        )
                    )

        return findings

    def _scan_for_owasp_vulnerabilities(self, code: str) -> list[SecurityFinding]:
        """Scan code for OWASP vulnerability patterns.

        Args:
            code: Source code to scan.

        Returns:
            list[SecurityFinding]: List of OWASP findings.
        """
        findings: list[SecurityFinding] = []
        finding_counter = 0

        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            for pattern, description in OWASP_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    finding_counter += 1
                    severity = Severity.CRITICAL
                    remediation = "Review and replace with a secure alternative"

                    # Customize severity and remediation
                    if "pickle" in description.lower() or "eval" in description.lower():
                        remediation = "Use JSON or other safe serialization formats; avoid eval/exec"
                    elif "path" in description.lower():
                        severity = Severity.HIGH
                        remediation = "Validate and sanitize file paths; use os.path.join with basename"
                    elif "yaml" in description.lower():
                        remediation = "Use yaml.safe_load() instead of yaml.load()"
                    elif "md5" in description.lower() or "sha1" in description.lower():
                        severity = Severity.HIGH
                        remediation = "Use SHA-256 or stronger hashing algorithms for security purposes"

                    findings.append(
                        SecurityFinding(
                            id=f"OWASP-{finding_counter:03d}",
                            severity=severity,
                            category=SecurityCategory.OTHER,
                            location=f"line {line_num}",
                            description=description,
                            remediation=remediation,
                        )
                    )

        return findings

    async def _run_compliance_analysis(
        self,
        code_content: str,
        compliance_frameworks: list[str],
    ) -> dict[str, Any]:
        """Run LLM-based compliance analysis.

        Args:
            code_content: Code to analyze.
            compliance_frameworks: Frameworks to check against.

        Returns:
            dict: Compliance analysis results.
        """
        prompt = self._format_compliance_prompt(code_content, compliance_frameworks)

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse response
            analysis = self._parse_json_from_response(response.content)

            if not analysis:
                logger.warning("Invalid compliance analysis response - no valid JSON")
                return {
                    "findings": [],
                    "compliance_status": {},
                    "scan_coverage": 80.0,
                }

            return analysis

        except Exception as e:
            logger.error(f"Compliance analysis failed: {e}")
            raise

    def _format_compliance_prompt(
        self,
        code_content: str,
        compliance_frameworks: list[str],
    ) -> str:
        """Format prompt for compliance analysis.

        Args:
            code_content: Code to analyze.
            compliance_frameworks: Frameworks to check.

        Returns:
            str: Formatted prompt.
        """
        frameworks_list = ", ".join(compliance_frameworks)

        # Truncate code if too long
        max_code_length = 10000
        if len(code_content) > max_code_length:
            code_content = code_content[:max_code_length] + "\n... (truncated)"

        return f"""You are a security analyst reviewing code for compliance and vulnerabilities.

## Code to Analyze

```python
{code_content}
```

## Compliance Frameworks to Check

{frameworks_list}

## Instructions

Analyze the code for:
1. Compliance with the specified frameworks
2. Additional security vulnerabilities not covered by pattern scanning
3. Overall security posture

## Output Format

Respond with a JSON object:
```json
{{
    "findings": [
        {{
            "id": "LLM-001",
            "severity": "critical|high|medium|low|info",
            "category": "injection|xss|secrets|auth|crypto|configuration|other",
            "location": "description of location",
            "description": "What was found",
            "remediation": "How to fix it"
        }}
    ],
    "compliance_status": {{
        "FRAMEWORK_NAME": true/false
    }},
    "scan_coverage": 95.0
}}
```

Set compliance status to true if the code meets the framework requirements, false otherwise.
Only include findings not covered by standard pattern detection.
"""

    def _parse_json_from_response(self, content: str) -> dict[str, Any] | None:
        """Parse JSON from LLM response, handling code blocks.

        Args:
            content: Raw LLM response content.

        Returns:
            dict | None: Parsed JSON or None if parsing fails.
        """
        # Try direct JSON parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from code blocks
        patterns = [
            r'```json\s*\n?(.*?)\n?```',
            r'```\s*\n?(.*?)\n?```',
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except json.JSONDecodeError:
                    continue

        # Try finding JSON-like content
        json_start = content.find('{')
        json_end = content.rfind('}')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            try:
                return json.loads(content[json_start:json_end + 1])
            except json.JSONDecodeError:
                pass

        return None

    def _merge_findings(
        self,
        pattern_findings: list[SecurityFinding],
        llm_analysis: dict[str, Any],
    ) -> list[SecurityFinding]:
        """Merge pattern-based and LLM-based findings.

        Args:
            pattern_findings: Findings from pattern scanning.
            llm_analysis: Analysis from LLM.

        Returns:
            list[SecurityFinding]: Merged findings.
        """
        all_findings = list(pattern_findings)

        # Add LLM findings
        llm_findings = llm_analysis.get("findings", [])
        for finding_data in llm_findings:
            try:
                severity_str = finding_data.get("severity", "medium").lower()
                category_str = finding_data.get("category", "other").lower()

                # Map severity
                severity_map = {
                    "critical": Severity.CRITICAL,
                    "high": Severity.HIGH,
                    "medium": Severity.MEDIUM,
                    "low": Severity.LOW,
                    "info": Severity.INFO,
                }
                severity = severity_map.get(severity_str, Severity.MEDIUM)

                # Map category
                category_map = {
                    "injection": SecurityCategory.INJECTION,
                    "xss": SecurityCategory.XSS,
                    "secrets": SecurityCategory.SECRETS,
                    "auth": SecurityCategory.AUTH,
                    "crypto": SecurityCategory.CRYPTO,
                    "configuration": SecurityCategory.CONFIGURATION,
                    "other": SecurityCategory.OTHER,
                }
                category = category_map.get(category_str, SecurityCategory.OTHER)

                finding = SecurityFinding(
                    id=finding_data.get("id", f"LLM-{len(all_findings) + 1:03d}"),
                    severity=severity,
                    category=category,
                    location=finding_data.get("location", "unknown"),
                    description=finding_data.get("description", ""),
                    remediation=finding_data.get("remediation", ""),
                )
                all_findings.append(finding)

            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid LLM finding: {e}")
                continue

        return all_findings

    async def _write_artifacts(
        self,
        context: AgentContext,
        security_report: SecurityReport,
    ) -> list[str]:
        """Write security report artifacts.

        Args:
            context: Agent context.
            security_report: Generated security report.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = security_report.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_security_report.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = security_report.to_markdown()
        markdown_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_security_report.md",
        )
        paths.append(markdown_path)

        return paths

    def validate_context(self, context: AgentContext) -> bool:
        """Validate that context is suitable for execution.

        Args:
            context: Agent context to validate.

        Returns:
            bool: True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
