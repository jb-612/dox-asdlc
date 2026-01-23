"""Unit tests for Surveyor Agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.design.prompts.surveyor_prompts import (
    SURVEYOR_SYSTEM_PROMPT,
    format_technology_analysis_prompt,
    format_research_synthesis_prompt,
    format_recommendation_prompt,
    format_rlm_trigger_prompt,
    TECHNOLOGY_ANALYSIS_EXAMPLE,
    RECOMMENDATION_EXAMPLE,
)


class TestSurveyorSystemPrompt:
    """Tests for the system prompt."""

    def test_system_prompt_exists(self) -> None:
        """Test that system prompt is defined."""
        assert SURVEYOR_SYSTEM_PROMPT
        assert len(SURVEYOR_SYSTEM_PROMPT) > 100

    def test_system_prompt_contains_role(self) -> None:
        """Test that system prompt defines the agent role."""
        assert "Technology Surveyor Agent" in SURVEYOR_SYSTEM_PROMPT

    def test_system_prompt_mentions_json(self) -> None:
        """Test that system prompt mentions JSON output."""
        assert "JSON" in SURVEYOR_SYSTEM_PROMPT

    def test_system_prompt_mentions_responsibilities(self) -> None:
        """Test that system prompt outlines responsibilities."""
        assert "Analyze PRD" in SURVEYOR_SYSTEM_PROMPT
        assert "recommend" in SURVEYOR_SYSTEM_PROMPT.lower()


class TestTechnologyAnalysisPrompt:
    """Tests for the technology analysis prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting with just PRD."""
        prd_content = "The system must support 1000 users."
        prompt = format_technology_analysis_prompt(prd_content)

        assert prd_content in prompt
        assert "## PRD Document" in prompt
        assert "technology_needs" in prompt
        assert "existing_decisions" in prompt
        assert "research_topics" in prompt

    def test_prompt_with_context_pack(self) -> None:
        """Test prompt with context pack summary."""
        prd_content = "Build a web application."
        context_summary = "Project uses Python 3.11 and FastAPI."

        prompt = format_technology_analysis_prompt(prd_content, context_summary)

        assert context_summary in prompt
        assert "## Existing Codebase Context" in prompt

    def test_prompt_with_existing_patterns(self) -> None:
        """Test prompt with existing patterns."""
        prd_content = "Add a caching layer."
        patterns = "Currently using Redis for session storage."

        prompt = format_technology_analysis_prompt(
            prd_content, existing_patterns=patterns
        )

        assert patterns in prompt
        assert "## Existing Technology Patterns" in prompt

    def test_prompt_with_all_sections(self) -> None:
        """Test prompt with all optional sections."""
        prd_content = "New microservice."
        context = "Python project."
        patterns = "Using FastAPI pattern."

        prompt = format_technology_analysis_prompt(prd_content, context, patterns)

        assert prd_content in prompt
        assert context in prompt
        assert patterns in prompt
        assert "## PRD Document" in prompt
        assert "## Existing Codebase Context" in prompt
        assert "## Existing Technology Patterns" in prompt

    def test_prompt_contains_schema(self) -> None:
        """Test that prompt contains JSON schema."""
        prompt = format_technology_analysis_prompt("PRD content")

        assert '"technology_needs"' in prompt
        assert '"category"' in prompt
        assert '"priority"' in prompt


class TestResearchSynthesisPrompt:
    """Tests for the research synthesis prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tech_needs = '{"technology_needs": [{"category": "database"}]}'
        prompt = format_research_synthesis_prompt(tech_needs)

        assert tech_needs in prompt
        assert "## Technology Needs" in prompt
        assert "evaluations" in prompt

    def test_prompt_with_rlm_findings(self) -> None:
        """Test prompt with RLM findings."""
        tech_needs = '{"technology_needs": []}'
        rlm_findings = "Research found that PostgreSQL is well-suited."

        prompt = format_research_synthesis_prompt(tech_needs, rlm_findings)

        assert rlm_findings in prompt
        assert "## Research Findings" in prompt

    def test_prompt_with_additional_context(self) -> None:
        """Test prompt with additional context."""
        tech_needs = '{"technology_needs": []}'
        context = "Must be HIPAA compliant."

        prompt = format_research_synthesis_prompt(
            tech_needs, additional_context=context
        )

        assert context in prompt
        assert "## Additional Context" in prompt

    def test_prompt_contains_evaluation_schema(self) -> None:
        """Test that prompt contains evaluation schema."""
        prompt = format_research_synthesis_prompt('{}')

        assert '"options"' in prompt
        assert '"fit_score"' in prompt
        assert '"recommendation"' in prompt
        assert '"confidence"' in prompt


class TestRecommendationPrompt:
    """Tests for the recommendation generation prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        evaluations = '{"evaluations": []}'
        prd_ref = "PRD-001"

        prompt = format_recommendation_prompt(evaluations, prd_ref)

        assert prd_ref in prompt
        assert evaluations in prompt
        assert "## PRD Reference" in prompt

    def test_prompt_with_constraints(self) -> None:
        """Test prompt with constraints summary."""
        evaluations = '{"evaluations": []}'
        prd_ref = "PRD-002"
        constraints = "- Must support 10K concurrent users\n- Sub-100ms latency"

        prompt = format_recommendation_prompt(evaluations, prd_ref, constraints)

        assert constraints in prompt
        assert "## Key Constraints" in prompt

    def test_prompt_contains_output_schema(self) -> None:
        """Test that prompt contains output schema."""
        prompt = format_recommendation_prompt('{}', "PRD-001")

        assert '"technologies"' in prompt
        assert '"selected"' in prompt
        assert '"risk_assessment"' in prompt
        assert '"recommendations"' in prompt


class TestRlmTriggerPrompt:
    """Tests for the RLM trigger decision prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tech_needs = '{"technology_needs": []}'
        unknown_techs = ["GraphQL federation", "Event sourcing"]

        prompt = format_rlm_trigger_prompt(tech_needs, unknown_techs)

        assert tech_needs in prompt
        assert "GraphQL federation" in prompt
        assert "Event sourcing" in prompt

    def test_prompt_contains_decision_schema(self) -> None:
        """Test that prompt contains decision schema."""
        prompt = format_rlm_trigger_prompt('{}', ["tech1"])

        assert '"needs_research"' in prompt
        assert '"research_priority"' in prompt
        assert '"research_queries"' in prompt

    def test_prompt_lists_technologies(self) -> None:
        """Test that technologies are listed properly."""
        techs = ["Kafka", "RabbitMQ", "NATS"]
        prompt = format_rlm_trigger_prompt('{}', techs)

        for tech in techs:
            assert f"- {tech}" in prompt


class TestExamples:
    """Tests for example prompts."""

    def test_technology_analysis_example_exists(self) -> None:
        """Test that technology analysis example is defined."""
        assert TECHNOLOGY_ANALYSIS_EXAMPLE
        assert "Example input" in TECHNOLOGY_ANALYSIS_EXAMPLE
        assert "Example output" in TECHNOLOGY_ANALYSIS_EXAMPLE

    def test_technology_analysis_example_is_valid_json_structure(self) -> None:
        """Test that example contains valid-looking JSON."""
        assert '"technology_needs"' in TECHNOLOGY_ANALYSIS_EXAMPLE
        assert '"category"' in TECHNOLOGY_ANALYSIS_EXAMPLE

    def test_recommendation_example_exists(self) -> None:
        """Test that recommendation example is defined."""
        assert RECOMMENDATION_EXAMPLE
        assert "Example output" in RECOMMENDATION_EXAMPLE

    def test_recommendation_example_is_valid_json_structure(self) -> None:
        """Test that example contains valid-looking JSON."""
        assert '"technologies"' in RECOMMENDATION_EXAMPLE
        assert '"risk_assessment"' in RECOMMENDATION_EXAMPLE


class TestPromptParameterization:
    """Tests for proper prompt parameterization."""

    def test_technology_analysis_no_hardcoded_values(self) -> None:
        """Test that technology analysis prompt uses parameters."""
        prompt1 = format_technology_analysis_prompt("PRD A")
        prompt2 = format_technology_analysis_prompt("PRD B")

        # Prompts should differ based on parameters
        assert prompt1 != prompt2
        assert "PRD A" in prompt1
        assert "PRD B" in prompt2

    def test_research_synthesis_no_hardcoded_values(self) -> None:
        """Test that research synthesis prompt uses parameters."""
        prompt1 = format_research_synthesis_prompt('{"a": 1}')
        prompt2 = format_research_synthesis_prompt('{"b": 2}')

        assert prompt1 != prompt2

    def test_recommendation_no_hardcoded_values(self) -> None:
        """Test that recommendation prompt uses parameters."""
        prompt1 = format_recommendation_prompt('{}', "PRD-001")
        prompt2 = format_recommendation_prompt('{}', "PRD-002")

        assert prompt1 != prompt2
        assert "PRD-001" in prompt1
        assert "PRD-002" in prompt2
