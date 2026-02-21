"""Reviewer Agent for code review.

Reviews implementation code for quality, security, and style compliance
using an AgentBackend for high-quality code review.  Delegates pattern-based
security scanning to the ``security_scanner`` module.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from src.workers.agents.backends.base import AgentBackend, BackendConfig
from src.workers.agents.backends.response_parser import parse_json_from_response
from src.workers.agents.development.config import DevelopmentConfig
from src.workers.agents.development.models import (
    CodeReview,
    IssueSeverity,
    ReviewIssue,
)
from src.workers.agents.development.prompts.reviewer_prompts import (
    QUALITY_REVIEW_PROMPT,
    format_quality_review_prompt,
)
from src.workers.agents.development.security_scanner import run_security_scan
from src.workers.agents.protocols import AgentContext, AgentResult

if TYPE_CHECKING:
    from src.workers.artifacts.writer import ArtifactWriter

logger = logging.getLogger(__name__)

# JSON Schema for structured reviewer output used with --json-schema.
REVIEWER_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "passed": {"type": "boolean"},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "description": {"type": "string"},
                    "severity": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "critical"],
                    },
                    "file_path": {"type": "string"},
                    "line_number": {"type": "integer"},
                    "suggestion": {"type": "string"},
                    "category": {"type": "string"},
                },
                "required": ["id", "description", "severity"],
            },
        },
        "suggestions": {"type": "array", "items": {"type": "string"}},
        "security_concerns": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["passed", "issues"],
}


class ReviewerAgentError(Exception):
    """Raised when Reviewer agent operations fail."""

    pass


class ReviewerAgent:
    """Agent that reviews code for quality, security, and style.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Uses an AgentBackend for high-quality code review to identify issues,
    security vulnerabilities, and style violations.

    Example:
        agent = ReviewerAgent(
            backend=backend,
            artifact_writer=writer,
            config=DevelopmentConfig(),
        )
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        backend: AgentBackend,
        artifact_writer: ArtifactWriter,
        config: DevelopmentConfig,
    ) -> None:
        """Initialize the Reviewer agent.

        Args:
            backend: AgentBackend for review generation.
            artifact_writer: Writer for persisting artifacts.
            config: Agent configuration.
        """
        self._backend = backend
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
            AgentResult with artifact paths on success.
        """
        logger.info("Reviewer Agent starting for task %s", context.task_id)

        try:
            implementation = event_metadata.get("implementation", "")
            if not implementation:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No implementation provided in event_metadata",
                    should_retry=False,
                )

            test_suite = event_metadata.get("test_suite")
            test_results = event_metadata.get("test_results")

            # Pattern-based security scan (no LLM needed)
            security_scan_findings = run_security_scan(implementation)

            # LLM-powered code review
            code_review = await self._generate_code_review(
                implementation=implementation,
                test_suite=test_suite,
                test_results=test_results,
                task_id=context.task_id,
                workspace_path=context.workspace_path,
            )

            if not code_review:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to generate code review",
                    should_retry=True,
                )

            code_review = self._merge_security_findings(
                code_review, security_scan_findings,
            )

            artifact_paths = await self._write_artifacts(context, code_review)
            severity_counts = self._count_severities(code_review.issues)

            logger.info(
                "Reviewer Agent completed for task %s, "
                "issues: %d, passed: %s, security_scan_findings: %d",
                context.task_id,
                len(code_review.issues),
                code_review.passed,
                len(security_scan_findings),
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
            logger.error("Reviewer Agent failed: %s", e, exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _generate_code_review(
        self,
        implementation: str,
        test_suite: str | None,
        test_results: str | None,
        task_id: str,
        workspace_path: str,
    ) -> CodeReview | None:
        """Generate code review from implementation via the backend.

        Args:
            implementation: Implementation code to review.
            test_suite: Optional test suite code.
            test_results: Optional test execution results.
            task_id: Task identifier.
            workspace_path: Working directory for backend execution.

        Returns:
            CodeReview or None if the backend call failed.
        """
        prompt = format_quality_review_prompt(
            implementation=implementation,
            test_suite=test_suite,
            test_results=test_results,
        )

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
            backend_config = BackendConfig(
                model=self._config.reviewer_model,
                output_schema=REVIEWER_OUTPUT_SCHEMA,
                timeout_seconds=300,
                allowed_tools=["Read", "Glob", "Grep"],
                system_prompt=QUALITY_REVIEW_PROMPT,
            )

            result = await self._backend.execute(
                prompt=prompt,
                workspace_path=workspace_path,
                config=backend_config,
            )

            if not result.success:
                logger.warning(
                    "Backend execution failed: %s", result.error,
                )
                return None

            # Prefer structured output when available
            review_data = result.structured_output
            if review_data is None:
                review_data = parse_json_from_response(result.output)

            if not review_data:
                logger.warning("Invalid review response - could not parse JSON")
                return None

            issues = self._parse_issues(review_data)

            return CodeReview(
                implementation_id=task_id,
                passed=review_data.get("passed", True),
                issues=issues,
                suggestions=review_data.get("suggestions", []),
                security_concerns=review_data.get("security_concerns", []),
            )

        except Exception as e:
            logger.error("Code review generation failed: %s", e)
            raise

    @staticmethod
    def _parse_issues(review_data: dict[str, Any]) -> list[ReviewIssue]:
        """Build ReviewIssue list from raw review data.

        Args:
            review_data: Parsed JSON from the backend response.

        Returns:
            List of ReviewIssue instances.
        """
        issues: list[ReviewIssue] = []
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
                    metadata={
                        "category": issue_data.get("category", "quality"),
                    },
                )
                issues.append(review_issue)
            except (ValueError, KeyError) as e:
                logger.warning("Skipping invalid issue: %s", e)
                continue
        return issues

    def _count_severities(self, issues: list[ReviewIssue]) -> dict[str, int]:
        """Count issues by severity level.

        Args:
            issues: List of review issues.

        Returns:
            Mapping of severity to count.
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
            Updated code review with merged findings.
        """
        if not security_findings:
            return code_review

        existing_ids = {issue.id for issue in code_review.issues}
        for finding in security_findings:
            if finding.id not in existing_ids:
                code_review.issues.append(finding)
                existing_ids.add(finding.id)

        for finding in security_findings:
            concern = f"{finding.description} (line {finding.line_number})"
            if concern not in code_review.security_concerns:
                code_review.security_concerns.append(concern)

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
            Paths to written artifacts.
        """
        from src.workers.artifacts.writer import ArtifactType

        paths: list[str] = []

        json_content = code_review.to_json()
        json_path = await self._artifact_writer.write_artifact(
            session_id=context.session_id,
            task_id=context.task_id,
            content=json_content,
            artifact_type=ArtifactType.REPORT,
            filename=f"{context.task_id}_review.json",
        )
        paths.append(json_path)

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
            True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
