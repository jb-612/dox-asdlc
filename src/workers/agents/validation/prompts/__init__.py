"""Prompts for validation agents."""

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
from src.workers.agents.validation.prompts.validation_prompts import (
    INTEGRATION_VERIFICATION_PROMPT,
    PERFORMANCE_ANALYSIS_PROMPT,
    TEST_RESULT_INTERPRETATION_PROMPT,
    format_integration_check_prompt,
    format_performance_analysis_prompt,
    format_validation_prompt,
)

__all__ = [
    # Validation prompts
    "TEST_RESULT_INTERPRETATION_PROMPT",
    "INTEGRATION_VERIFICATION_PROMPT",
    "PERFORMANCE_ANALYSIS_PROMPT",
    "format_validation_prompt",
    "format_integration_check_prompt",
    "format_performance_analysis_prompt",
    # Security prompts
    "VULNERABILITY_SCAN_PROMPT",
    "SECRETS_SCAN_PROMPT",
    "COMPLIANCE_CHECK_PROMPT",
    "OWASP_PATTERNS",
    "SEVERITY_LEVELS",
    "format_vulnerability_scan_prompt",
    "format_secrets_scan_prompt",
    "format_compliance_check_prompt",
]
