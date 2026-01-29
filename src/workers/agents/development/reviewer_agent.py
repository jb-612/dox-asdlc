"""Reviewer Agent for code review.

Reviews implementation code for quality, security, and style compliance
using the Opus model for high-quality code review. Includes a security
scanner that detects hardcoded secrets, injection vulnerabilities, and
common OWASP patterns.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeReview,
    IssueSeverity,
    ReviewIssue,
)
from src.workers.agents.development.prompts.reviewer_prompts import (
    format_quality_review_prompt,
    format_security_review_prompt,
)
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


# Security Scanner Patterns
# Patterns for detecting hardcoded secrets
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
    # XSS
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


class ReviewerAgentError(Exception):
    """Raised when Reviewer agent operations fail."""

    pass


class ReviewerAgent:
    """Agent that reviews code for quality, security, and style.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses Opus model for high-quality code review to identify issues,
    security vulnerabilities, and style violations.

    Example:
        agent = ReviewerAgent(
            llm_client=client,
            artifact_writer=writer,
            config=DevelopmentConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
    ) -> None:
        """Initialize the Reviewer agent.

        Args:
            llm_client: LLM client for review generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._llm_client = llm_client
        self._artifact_writer = artifact_writer
        self._config = config

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "reviewer"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute code review on the provided implementation.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - implementation: Implementation code to review (required)
                - test_suite: Optional test suite code
                - test_results: Optional test execution results

        Returns:
            AgentResult: Result with artifact paths on success.
        """
        logger.info(f"Reviewer Agent starting for task {context.task_id}")

        try:
            # Validate required inputs
            implementation = event_metadata.get("implementation", "")
            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No implementation provided in event_metadata",
                    should_retry=False,
                )

            # Extract optional inputs
            test_suite = event_metadata.get("test_suite")
            test_results = event_metadata.get("test_results")

            # Run security scan first (pattern-based detection)
            security_scan_findings = self.run_security_scan(implementation)

            # Generate code review using LLM
            code_review = await self._generate_code_review(
                implementation=implementation,
                test_suite=test_suite,
                test_results=test_results,
                task_id=context.task_id,
            )

            if not code_review:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate code review",
                    should_retry=True,
                )

            # Merge security scan findings into code review
            code_review = self._merge_security_findings(code_review, security_scan_findings)

            # Write artifacts
            artifact_paths = await self._write_artifacts(context, code_review)

            # Calculate severity counts
            severity_counts = self._count_severities(code_review.issues)

            logger.info(
                f"Reviewer Agent completed for task {context.task_id}, "
                f"issues: {len(code_review.issues)}, passed: {code_review.passed}, "
                f"security_scan_findings: {len(security_scan_findings)}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                artifact_paths=artifact_paths,
                metadata={
                    "passed": code_review.passed,
                    "issue_count": len(code_review.issues),
                    "suggestions": code_review.suggestions,
                    "security_concerns": code_review.security_concerns,
                    "severity_counts": severity_counts,
                    "security_scan_findings": len(security_scan_findings),
                },
            )

        except Exception as e:
            logger.error(f"Reviewer Agent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    async def _generate_code_review(
        self,
        implementation: str,
        test_suite: str | None,
        test_results: str | None,
        task_id: str,
    ) -> CodeReview | None:
        """Generate code review from implementation.

        Args:
            implementation: Implementation code to review.
            test_suite: Optional test suite code.
            test_results: Optional test execution results.
            task_id: Task identifier.

        Returns:
            CodeReview | None: Generated code review or None if failed.
        """
        prompt = format_quality_review_prompt(
            implementation=implementation,
            test_suite=test_suite,
            test_results=test_results,
        )

        # Add output format instructions
        prompt = f"""{prompt}

## Output Format

Respond with a JSON object containing:
```json
{{
    "passed": true/false,
    "issues": [
        {{
            "id": "ISSUE-001",
            "description": "Issue description",
            "severity": "low|medium|high|critical",
            "file_path": "path/to/file.py",
            "line_number": 10,
            "suggestion": "How to fix the issue",
            "category": "quality|security|style"
        }}
    ],
    "suggestions": ["General improvement suggestions"],
    "security_concerns": ["Security-related concerns if any"]
}}
```

Set "passed" to false if any critical or high severity issues are found.
"""

        try:
            response = await self._llm_client.generate(
                prompt=prompt,
                max_tokens=self._config.max_tokens,
                temperature=self._config.temperature,
            )

            # Parse response
            review_data = self._parse_json_from_response(response.content)

            if not review_data:
                logger.warning("Invalid review response - could not parse JSON")
                return None

            # Build review issues
            issues = []
            for issue_data in review_data.get("issues", []):
                try:
                    severity_str = issue_data.get("severity", "medium").lower()
                    severity = IssueSeverity(severity_str)

                    review_issue = ReviewIssue(
                        id=issue_data.get("id", f"ISSUE-{len(issues) + 1:03d}"),
                        description=issue_data.get("description", ""),
                        severity=severity,
                        file_path=issue_data.get("file_path", ""),
                        line_number=issue_data.get("line_number", 0),
                        suggestion=issue_data.get("suggestion", ""),
                        metadata={"category": issue_data.get("category", "quality")},
                    )
                    issues.append(review_issue)
                except (ValueError, KeyError) as e:
                    logger.warning(f"Skipping invalid issue: {e}")
                    continue

            return CodeReview(
                implementation_id=task_id,
                passed=review_data.get("passed", True),
                issues=issues,
                suggestions=review_data.get("suggestions", []),
                security_concerns=review_data.get("security_concerns", []),
            )

        except Exception as e:
            logger.error(f"Code review generation failed: {e}")
            raise

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

    def _count_severities(self, issues: list[ReviewIssue]) -> dict[str, int]:
        """Count issues by severity level.

        Args:
            issues: List of review issues.

        Returns:
            dict: Mapping of severity to count.
        """
        counts: dict[str, int] = {
            "low": 0,
            "medium": 0,
            "high": 0,
            "critical": 0,
        }

        for issue in issues:
            severity = issue.severity.value
            if severity in counts:
                counts[severity] += 1

        return counts

    def _merge_security_findings(
        self,
        code_review: CodeReview,
        security_findings: list[ReviewIssue],
    ) -> CodeReview:
        """Merge security scan findings into the code review.

        Adds security scan findings to the review issues and updates
        the passed status if critical/high severity issues are found.

        Args:
            code_review: Original code review from LLM.
            security_findings: Security issues from pattern-based scan.

        Returns:
            CodeReview: Updated code review with merged findings.
        """
        if not security_findings:
            return code_review

        # Add security findings to issues
        existing_ids = {issue.id for issue in code_review.issues}
        for finding in security_findings:
            # Avoid duplicates if LLM found the same issue
            if finding.id not in existing_ids:
                code_review.issues.append(finding)
                existing_ids.add(finding.id)

        # Add security concerns to the list
        for finding in security_findings:
            concern = f"{finding.description} (line {finding.line_number})"
            if concern not in code_review.security_concerns:
                code_review.security_concerns.append(concern)

        # Update passed status: fail if any critical or high severity issues
        has_critical_issues = any(
            issue.severity in (IssueSeverity.CRITICAL, IssueSeverity.HIGH)
            for issue in code_review.issues
        )

        if has_critical_issues:
            code_review.passed = False

        return code_review

    async def _write_artifacts(
        self,
        context: AgentContext,
        code_review: CodeReview,
    ) -> list[str]:
        """Write code review artifacts.

        Args:
            context: Agent context.
            code_review: Generated code review.

        Returns:
            list[str]: Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths = []

        # Write JSON artifact (structured data)
        json_content = code_review.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_review.json",
        )
        paths.append(json_path)

        # Write Markdown artifact (human-readable)
        markdown_content = code_review.to_markdown()
        md_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=markdown_content,
            artifact_type=ArtifactType.TEXT,
            filename=f"{context.task_id}_review.md",
        )
        paths.append(md_path)

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

    def scan_for_secrets(self, code: str) -> list[ReviewIssue]:
        """Scan code for hardcoded secrets like API keys, passwords, and tokens.

        Args:
            code: Source code to scan.

        Returns:
            list[ReviewIssue]: List of security issues found.
        """
        issues: list[ReviewIssue] = []
        issue_counter = 0

        # Check if line contains safe patterns (environment variables, config)
        def is_safe_line(line: str) -> bool:
            for safe_pattern in SAFE_PATTERNS:
                if re.search(safe_pattern, line):
                    return True
            return False

        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            # Skip safe patterns
            if is_safe_line(line):
                continue

            for pattern, description in SECRET_PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    issue_counter += 1
                    issues.append(
                        ReviewIssue(
                            id=f"SEC-{issue_counter:03d}",
                            description=description,
                            severity=IssueSeverity.CRITICAL,
                            file_path="",
                            line_number=line_num,
                            suggestion="Use environment variables or a secrets manager instead of hardcoding credentials",
                            metadata={"category": "security", "type": "secret"},
                        )
                    )

        return issues

    def scan_for_injection_vulnerabilities(self, code: str) -> list[ReviewIssue]:
        """Scan code for injection vulnerabilities (SQL, command, XSS).

        Args:
            code: Source code to scan.

        Returns:
            list[ReviewIssue]: List of injection vulnerability issues found.
        """
        issues: list[ReviewIssue] = []
        issue_counter = 0

        lines = code.split('\n')
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
                            suggestion="Use parameterized queries for SQL, subprocess with list arguments for commands, and proper escaping for HTML",
                            metadata={"category": "security", "type": "injection"},
                        )
                    )

        return issues

    def scan_for_owasp_vulnerabilities(self, code: str) -> list[ReviewIssue]:
        """Scan code for common OWASP vulnerability patterns.

        Args:
            code: Source code to scan.

        Returns:
            list[ReviewIssue]: List of OWASP vulnerability issues found.
        """
        issues: list[ReviewIssue] = []
        issue_counter = 0

        lines = code.split('\n')
        for line_num, line in enumerate(lines, 1):
            for pattern, description in OWASP_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    issue_counter += 1
                    severity = IssueSeverity.CRITICAL
                    suggestion = "Review and replace with a secure alternative"

                    # Customize severity and suggestions
                    if "pickle" in description.lower() or "eval" in description.lower():
                        suggestion = "Use JSON or other safe serialization formats; avoid eval/exec"
                    elif "path" in description.lower():
                        severity = IssueSeverity.HIGH
                        suggestion = "Validate and sanitize file paths; use os.path.join with basename"
                    elif "yaml" in description.lower():
                        suggestion = "Use yaml.safe_load() instead of yaml.load()"
                    elif "md5" in description.lower() or "sha1" in description.lower():
                        severity = IssueSeverity.HIGH
                        suggestion = "Use SHA-256 or stronger hashing algorithms for security purposes"

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

    def run_security_scan(self, code: str) -> list[ReviewIssue]:
        """Run all security scans on the provided code.

        Combines secret detection, injection vulnerability scanning,
        and OWASP pattern checks.

        Args:
            code: Source code to scan.

        Returns:
            list[ReviewIssue]: Combined list of all security issues found.
        """
        all_issues: list[ReviewIssue] = []

        # Run all scan types
        all_issues.extend(self.scan_for_secrets(code))
        all_issues.extend(self.scan_for_injection_vulnerabilities(code))
        all_issues.extend(self.scan_for_owasp_vulnerabilities(code))

        return all_issues
