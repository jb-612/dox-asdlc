"""Prompts for Validation agent.

Provides prompts for test result interpretation, integration verification, and
performance analysis with structured output format and issue categorization.
"""

from __future__ import annotations

from typing import Any


TEST_RESULT_INTERPRETATION_PROMPT = """You are an expert QA engineer analyzing test results.

Your task is to interpret test execution results and identify issues that need attention.
Provide a detailed analysis with issue categorization by severity.

## Analysis Guidelines

1. **Test Status**: Analyze pass/fail status for each test
2. **Failure Root Cause**: Identify why tests failed
3. **Pattern Recognition**: Find common failure patterns
4. **Flakiness Detection**: Identify potentially flaky tests
5. **Coverage Gaps**: Note areas with missing test coverage

## Issue Severity Categories

- **CRITICAL**: Test failures indicating broken core functionality
- **HIGH**: Significant test failures affecting user experience
- **MEDIUM**: Test failures for edge cases or non-critical paths
- **LOW**: Minor issues, warnings, or style violations
- **INFO**: Informational findings, not blocking

## Issue Classification

For each issue found, classify by type:
- **functional**: Core functionality not working as expected
- **performance**: Tests failing due to performance thresholds
- **compatibility**: Issues with different environments or configurations
- **flaky**: Tests that pass/fail inconsistently

## Output Format

Provide your analysis as structured JSON:

```json
{
  "summary": {
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0
  },
  "issues": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "category": "functional|performance|compatibility|flaky",
      "test_name": "test_name_here",
      "description": "What went wrong",
      "root_cause": "Why it failed",
      "recommendation": "How to fix it"
    }
  ],
  "patterns": ["List of observed patterns"],
  "overall_verdict": "PASS|FAIL",
  "confidence": 0.95
}
```
"""


INTEGRATION_VERIFICATION_PROMPT = """You are an expert systems engineer verifying integration points.

Your task is to verify that all system components integrate correctly and
communication between services works as expected.

## Verification Guidelines

1. **Contract Compliance**: Verify API contracts are honored
2. **Data Flow**: Check data flows correctly between components
3. **Error Handling**: Verify error propagation and handling
4. **Timeout Behavior**: Check timeout configurations and handling
5. **Fallback Mechanisms**: Verify fallbacks work when dependencies fail

## Integration Checks

For each integration point, verify:
- Request/response format matches contract
- Authentication and authorization work
- Error responses are properly formatted
- Retries and circuit breakers function correctly
- Logging captures sufficient detail

## Issue Categories

- **contract_violation**: API does not match documented contract
- **connectivity**: Cannot reach dependent service
- **data_mismatch**: Data format or content incorrect
- **timeout**: Operations exceed time limits
- **authentication**: Auth tokens or credentials fail
- **authorization**: Permission denied errors

## Output Format

Provide your analysis as structured JSON:

```json
{
  "integration_points": [
    {
      "name": "Service A -> Service B",
      "status": "PASS|FAIL|WARN",
      "issues": [
        {
          "type": "contract_violation|connectivity|data_mismatch|timeout|authentication|authorization",
          "description": "What was found",
          "evidence": "Log line or test output",
          "remediation": "How to fix"
        }
      ]
    }
  ],
  "overall_status": "PASS|FAIL",
  "critical_issues_count": 0,
  "recommendations": ["List of recommendations"]
}
```
"""


PERFORMANCE_ANALYSIS_PROMPT = """You are an expert performance engineer analyzing system metrics.

Your task is to analyze performance test results, identify bottlenecks, and
recommend optimizations. Compare against baselines when available.

## Analysis Guidelines

1. **Latency Analysis**: Evaluate response times (avg, p50, p95, p99)
2. **Throughput Analysis**: Assess requests per second capacity
3. **Resource Utilization**: Analyze CPU, memory, disk, network usage
4. **Scalability**: Evaluate behavior under increasing load
5. **Stability**: Check for degradation over time

## Performance Metrics

Key metrics to analyze:
- **Latency**: avg_latency_ms, p50, p95, p99
- **Throughput**: requests_per_second, transactions_per_second
- **Errors**: error_rate, timeout_rate
- **Resources**: cpu_percent, memory_mb, disk_io, network_io

## Baseline Comparison

When baselines are provided:
- Calculate percentage change from baseline
- Flag regressions exceeding 10% degradation
- Highlight improvements exceeding 10%

## Issue Severity

- **CRITICAL**: >50% regression or system instability
- **HIGH**: 20-50% regression affecting user experience
- **MEDIUM**: 10-20% regression, noticeable impact
- **LOW**: <10% regression or minor concerns
- **INFO**: Informational, within acceptable range

## Output Format

Provide your analysis as structured JSON:

```json
{
  "metrics_analysis": {
    "latency": {
      "current": {"avg_ms": 0, "p95_ms": 0, "p99_ms": 0},
      "baseline": {"avg_ms": 0, "p95_ms": 0, "p99_ms": 0},
      "change_percent": 0,
      "status": "PASS|WARN|FAIL"
    },
    "throughput": {
      "current_rps": 0,
      "baseline_rps": 0,
      "change_percent": 0,
      "status": "PASS|WARN|FAIL"
    },
    "resource_utilization": {
      "cpu_percent": 0,
      "memory_mb": 0,
      "status": "PASS|WARN|FAIL"
    }
  },
  "bottlenecks": [
    {
      "component": "database|api|cache|network",
      "description": "What is the bottleneck",
      "impact": "How it affects performance",
      "suggestion": "How to improve"
    }
  ],
  "regressions": [
    {
      "metric": "metric_name",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "baseline_value": 0,
      "current_value": 0,
      "change_percent": 0
    }
  ],
  "improvements": ["List of recommended optimizations"],
  "overall_verdict": "PASS|WARN|FAIL",
  "summary": "Brief performance summary"
}
```
"""


def format_validation_prompt(
    implementation: str,
    acceptance_criteria: str,
    e2e_results: str,
    context_pack: str | None = None,
    feature_id: str | None = None,
) -> str:
    """Format the validation prompt with implementation and test results.

    Args:
        implementation: The implementation code being validated.
        acceptance_criteria: Acceptance criteria to validate against.
        e2e_results: E2E test execution results.
        context_pack: Optional existing code context.
        feature_id: Optional feature identifier.

    Returns:
        str: Formatted prompt for validation analysis.
    """
    prompt_parts = [
        TEST_RESULT_INTERPRETATION_PROMPT,
        "",
        "## Validation Context",
        "",
    ]

    if feature_id:
        prompt_parts.extend([f"**Feature ID:** {feature_id}", ""])

    prompt_parts.extend([
        "## Implementation Under Validation",
        "",
        "```python",
        implementation,
        "```",
        "",
        "## Acceptance Criteria",
        "",
        acceptance_criteria,
        "",
        "## E2E Test Results",
        "",
        e2e_results,
    ])

    if context_pack:
        prompt_parts.extend([
            "",
            "## Additional Code Context",
            "",
            "```python",
            context_pack,
            "```",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Analyze the test results against the acceptance criteria and provide:",
        "1. Structured JSON analysis following the output format above",
        "2. Issue categorization by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)",
        "3. Clear recommendations for any failures",
        "4. Overall verdict on validation pass/fail status",
        "",
        "Focus on whether the implementation meets the acceptance criteria.",
    ])

    return "\n".join(prompt_parts)


def format_integration_check_prompt(
    components: list[str],
    test_results: str,
    contracts: dict[str, str] | None = None,
    external_dependencies: list[str] | None = None,
    error_logs: str | None = None,
) -> str:
    """Format the integration check prompt with component information.

    Args:
        components: List of integration components to verify.
        test_results: Integration test results.
        contracts: Optional dict of service contracts.
        external_dependencies: Optional list of external dependencies.
        error_logs: Optional error logs from test execution.

    Returns:
        str: Formatted prompt for integration verification.
    """
    prompt_parts = [
        INTEGRATION_VERIFICATION_PROMPT,
        "",
        "## Integration Components",
        "",
    ]

    for component in components:
        prompt_parts.append(f"- {component}")

    prompt_parts.extend([
        "",
        "## Test Results",
        "",
        test_results,
    ])

    if contracts:
        prompt_parts.extend([
            "",
            "## API Contracts",
            "",
        ])
        for service, contract in contracts.items():
            prompt_parts.extend([
                f"### {service}",
                "",
                "```",
                contract,
                "```",
                "",
            ])

    if external_dependencies:
        prompt_parts.extend([
            "",
            "## External Dependencies",
            "",
        ])
        for dep in external_dependencies:
            prompt_parts.append(f"- {dep}")
        prompt_parts.append("")

    if error_logs:
        prompt_parts.extend([
            "",
            "## Error Logs",
            "",
            "```",
            error_logs,
            "```",
        ])

    prompt_parts.extend([
        "",
        "## Instructions",
        "",
        "Verify all integration points and provide:",
        "1. Structured JSON analysis following the output format above",
        "2. Status check for each integration point (PASS/FAIL/WARN)",
        "3. Detailed issue descriptions with remediation steps",
        "4. Overall integration status verdict",
        "",
        "Focus on contract compliance and data flow correctness.",
    ])

    return "\n".join(prompt_parts)


def format_performance_analysis_prompt(
    metrics: dict[str, Any],
    baselines: dict[str, Any] | None = None,
    test_context: str | None = None,
    resource_utilization: dict[str, Any] | None = None,
    duration_seconds: int | None = None,
) -> str:
    """Format the performance analysis prompt with metrics data.

    Args:
        metrics: Performance metrics from test execution.
        baselines: Optional baseline metrics for comparison.
        test_context: Optional description of test context.
        resource_utilization: Optional resource utilization data.
        duration_seconds: Optional test duration in seconds.

    Returns:
        str: Formatted prompt for performance analysis.
    """
    prompt_parts = [
        PERFORMANCE_ANALYSIS_PROMPT,
        "",
        "## Performance Metrics",
        "",
    ]

    # Format metrics as a table
    prompt_parts.append("| Metric | Value |")
    prompt_parts.append("|--------|-------|")
    for metric_name, metric_value in metrics.items():
        prompt_parts.append(f"| {metric_name} | {metric_value} |")
    prompt_parts.append("")

    if baselines:
        prompt_parts.extend([
            "## Baseline Metrics (for comparison)",
            "",
            "| Metric | Baseline Value |",
            "|--------|----------------|",
        ])
        for metric_name, baseline_value in baselines.items():
            prompt_parts.append(f"| {metric_name} | {baseline_value} |")
        prompt_parts.append("")

    if test_context:
        prompt_parts.extend([
            "## Test Context",
            "",
            test_context,
            "",
        ])

    if resource_utilization:
        prompt_parts.extend([
            "## Resource Utilization",
            "",
            "| Resource | Value |",
            "|----------|-------|",
        ])
        for resource, value in resource_utilization.items():
            prompt_parts.append(f"| {resource} | {value} |")
        prompt_parts.append("")

    if duration_seconds:
        prompt_parts.extend([
            f"**Test Duration:** {duration_seconds} seconds",
            "",
        ])

    prompt_parts.extend([
        "## Instructions",
        "",
        "Analyze the performance metrics and provide:",
        "1. Structured JSON analysis following the output format above",
        "2. Comparison against baselines (if provided)",
        "3. Identification of any performance regressions",
        "4. Recommendations for improvement",
        "5. Overall performance verdict (PASS/WARN/FAIL)",
        "",
        "Flag any metrics that suggest performance degradation or bottlenecks.",
    ])

    return "\n".join(prompt_parts)
