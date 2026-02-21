"""Prompts for development agents."""

from src.workers.agents.development.prompts.utest_prompts import (
    COVERAGE_ANALYSIS_PROMPT,
    FIXTURE_CREATION_PROMPT,
    TEST_GENERATION_PROMPT,
    format_coverage_analysis_prompt,
    format_fixture_creation_prompt,
    format_test_generation_prompt,
)
from src.workers.agents.development.prompts.coding_prompts import (
    IMPLEMENTATION_PROMPT,
    RETRY_IMPLEMENTATION_PROMPT,
    STYLE_COMPLIANCE_PROMPT,
    format_implementation_prompt,
    format_retry_implementation_prompt,
    format_style_compliance_prompt,
)
from src.workers.agents.development.prompts.debugger_prompts import (
    FAILURE_ANALYSIS_PROMPT,
    FIX_SUGGESTION_PROMPT,
    ROOT_CAUSE_PROMPT,
    format_failure_analysis_prompt,
    format_fix_suggestion_prompt,
    format_root_cause_prompt,
)
from src.workers.agents.development.prompts.reviewer_prompts import (
    QUALITY_REVIEW_PROMPT,
    SECURITY_REVIEW_PROMPT,
    STYLE_REVIEW_PROMPT,
    format_quality_review_prompt,
    format_security_review_prompt,
    format_style_review_prompt,
)

__all__ = [
    # UTest prompts
    "COVERAGE_ANALYSIS_PROMPT",
    "FIXTURE_CREATION_PROMPT",
    "TEST_GENERATION_PROMPT",
    "format_coverage_analysis_prompt",
    "format_fixture_creation_prompt",
    "format_test_generation_prompt",
    # Coding prompts
    "IMPLEMENTATION_PROMPT",
    "RETRY_IMPLEMENTATION_PROMPT",
    "STYLE_COMPLIANCE_PROMPT",
    "format_implementation_prompt",
    "format_retry_implementation_prompt",
    "format_style_compliance_prompt",
    # Debugger prompts
    "FAILURE_ANALYSIS_PROMPT",
    "FIX_SUGGESTION_PROMPT",
    "ROOT_CAUSE_PROMPT",
    "format_failure_analysis_prompt",
    "format_fix_suggestion_prompt",
    "format_root_cause_prompt",
    # Reviewer prompts
    "QUALITY_REVIEW_PROMPT",
    "SECURITY_REVIEW_PROMPT",
    "STYLE_REVIEW_PROMPT",
    "format_quality_review_prompt",
    "format_security_review_prompt",
    "format_style_review_prompt",
]
