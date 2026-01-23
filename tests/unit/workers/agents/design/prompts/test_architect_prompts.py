"""Unit tests for Architect Agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.design.prompts.architect_prompts import (
    ARCHITECT_SYSTEM_PROMPT,
    format_component_design_prompt,
    format_interface_definition_prompt,
    format_diagram_generation_prompt,
    format_nfr_validation_prompt,
    format_architecture_refinement_prompt,
    COMPONENT_DESIGN_EXAMPLE,
    DIAGRAM_EXAMPLE,
)


class TestArchitectSystemPrompt:
    """Tests for the system prompt."""

    def test_system_prompt_exists(self) -> None:
        """Test that system prompt is defined."""
        assert ARCHITECT_SYSTEM_PROMPT
        assert len(ARCHITECT_SYSTEM_PROMPT) > 100

    def test_system_prompt_contains_role(self) -> None:
        """Test that system prompt defines the agent role."""
        assert "Solution Architect Agent" in ARCHITECT_SYSTEM_PROMPT

    def test_system_prompt_mentions_json(self) -> None:
        """Test that system prompt mentions JSON output."""
        assert "JSON" in ARCHITECT_SYSTEM_PROMPT

    def test_system_prompt_mentions_mermaid(self) -> None:
        """Test that system prompt mentions Mermaid diagrams."""
        assert "Mermaid" in ARCHITECT_SYSTEM_PROMPT

    def test_system_prompt_mentions_responsibilities(self) -> None:
        """Test that system prompt outlines responsibilities."""
        assert "component" in ARCHITECT_SYSTEM_PROMPT.lower()
        assert "interface" in ARCHITECT_SYSTEM_PROMPT.lower()
        assert "diagram" in ARCHITECT_SYSTEM_PROMPT.lower()


class TestComponentDesignPrompt:
    """Tests for the component design prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tech_survey = '{"technologies": []}'
        prd_content = "Build a user management system."

        prompt = format_component_design_prompt(tech_survey, prd_content)

        assert tech_survey in prompt
        assert prd_content in prompt
        assert "## Technology Survey" in prompt
        assert "## PRD Document" in prompt
        assert '"components"' in prompt

    def test_prompt_with_context_pack(self) -> None:
        """Test prompt with context pack summary."""
        tech_survey = '{"technologies": []}'
        prd_content = "Build API."
        context_summary = "Existing FastAPI project structure."

        prompt = format_component_design_prompt(
            tech_survey, prd_content, context_summary
        )

        assert context_summary in prompt
        assert "## Existing Codebase Context" in prompt

    def test_prompt_contains_architecture_styles(self) -> None:
        """Test that prompt includes architecture style options."""
        prompt = format_component_design_prompt('{}', "PRD")

        assert "monolith" in prompt
        assert "microservices" in prompt
        assert "event_driven" in prompt

    def test_prompt_contains_component_schema(self) -> None:
        """Test that prompt contains component schema."""
        prompt = format_component_design_prompt('{}', "PRD")

        assert '"name"' in prompt
        assert '"responsibility"' in prompt
        assert '"interfaces"' in prompt
        assert '"dependencies"' in prompt

    def test_prompt_contains_data_flow_schema(self) -> None:
        """Test that prompt contains data flow schema."""
        prompt = format_component_design_prompt('{}', "PRD")

        assert '"data_flows"' in prompt
        assert '"source"' in prompt
        assert '"target"' in prompt
        assert '"protocol"' in prompt


class TestInterfaceDefinitionPrompt:
    """Tests for the interface definition prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        components = '{"components": [{"name": "UserService"}]}'
        tech_survey = '{"technologies": []}'

        prompt = format_interface_definition_prompt(components, tech_survey)

        assert components in prompt
        assert tech_survey in prompt
        assert "## Components" in prompt

    def test_prompt_contains_interface_schema(self) -> None:
        """Test that prompt contains interface schema."""
        prompt = format_interface_definition_prompt('{}', '{}')

        assert '"interface_name"' in prompt
        assert '"methods"' in prompt
        assert '"parameters"' in prompt
        assert '"returns"' in prompt

    def test_prompt_contains_data_types_schema(self) -> None:
        """Test that prompt contains data types schema."""
        prompt = format_interface_definition_prompt('{}', '{}')

        assert '"data_types"' in prompt
        assert '"shared_types"' in prompt
        assert '"fields"' in prompt


class TestDiagramGenerationPrompt:
    """Tests for the diagram generation prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        architecture = '{"components": [], "data_flows": []}'

        prompt = format_diagram_generation_prompt(architecture)

        assert architecture in prompt
        assert "## Architecture" in prompt
        assert "Mermaid" in prompt

    def test_prompt_with_custom_diagram_types(self) -> None:
        """Test prompt with custom diagram types."""
        architecture = '{}'
        diagram_types = ["sequence", "erd"]

        prompt = format_diagram_generation_prompt(architecture, diagram_types)

        assert "sequence" in prompt
        assert "erd" in prompt

    def test_prompt_contains_default_diagram_types(self) -> None:
        """Test prompt includes default diagram types."""
        prompt = format_diagram_generation_prompt('{}')

        assert "component" in prompt
        assert "sequence" in prompt
        assert "deployment" in prompt

    def test_prompt_contains_mermaid_examples(self) -> None:
        """Test that prompt includes Mermaid syntax examples."""
        prompt = format_diagram_generation_prompt('{}')

        assert "```mermaid" in prompt
        assert "graph TB" in prompt or "sequenceDiagram" in prompt

    def test_prompt_contains_diagram_schema(self) -> None:
        """Test that prompt contains diagram schema."""
        prompt = format_diagram_generation_prompt('{}')

        assert '"diagram_type"' in prompt
        assert '"title"' in prompt
        assert '"mermaid_code"' in prompt


class TestNfrValidationPrompt:
    """Tests for the NFR validation prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        architecture = '{"components": []}'
        nfr_requirements = "System must handle 10K concurrent users."

        prompt = format_nfr_validation_prompt(architecture, nfr_requirements)

        assert architecture in prompt
        assert nfr_requirements in prompt
        assert "## Architecture" in prompt
        assert "## Non-Functional Requirements" in prompt

    def test_prompt_contains_nfr_categories(self) -> None:
        """Test that prompt lists NFR categories."""
        prompt = format_nfr_validation_prompt('{}', "NFRs")

        assert "Performance" in prompt
        assert "Scalability" in prompt
        assert "Reliability" in prompt
        assert "Security" in prompt
        assert "Maintainability" in prompt
        assert "Observability" in prompt

    def test_prompt_contains_evaluation_schema(self) -> None:
        """Test that prompt contains evaluation schema."""
        prompt = format_nfr_validation_prompt('{}', "NFRs")

        assert '"nfr_evaluation"' in prompt
        assert '"status"' in prompt
        assert '"how_addressed"' in prompt
        assert '"gaps"' in prompt
        assert '"recommendations"' in prompt

    def test_prompt_contains_overall_assessment(self) -> None:
        """Test that prompt includes overall assessment schema."""
        prompt = format_nfr_validation_prompt('{}', "NFRs")

        assert '"overall_assessment"' in prompt
        assert '"score"' in prompt
        assert '"critical_gaps"' in prompt


class TestArchitectureRefinementPrompt:
    """Tests for the architecture refinement prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        architecture = '{"components": []}'
        nfr_evaluation = '{"nfr_evaluation": []}'

        prompt = format_architecture_refinement_prompt(architecture, nfr_evaluation)

        assert architecture in prompt
        assert nfr_evaluation in prompt
        assert "## Current Architecture" in prompt
        assert "## NFR Evaluation" in prompt

    def test_prompt_with_feedback(self) -> None:
        """Test prompt with review feedback."""
        architecture = '{}'
        nfr_evaluation = '{}'
        feedback = "Add caching layer for better performance."

        prompt = format_architecture_refinement_prompt(
            architecture, nfr_evaluation, feedback
        )

        assert feedback in prompt
        assert "## Review Feedback" in prompt

    def test_prompt_contains_changes_schema(self) -> None:
        """Test that prompt contains changes tracking schema."""
        prompt = format_architecture_refinement_prompt('{}', '{}')

        assert '"changes_made"' in prompt
        assert '"change"' in prompt
        assert '"rationale"' in prompt


class TestExamples:
    """Tests for example outputs."""

    def test_component_design_example_exists(self) -> None:
        """Test that component design example is defined."""
        assert COMPONENT_DESIGN_EXAMPLE
        assert "Example output" in COMPONENT_DESIGN_EXAMPLE

    def test_component_design_example_structure(self) -> None:
        """Test component design example has expected structure."""
        assert '"architecture_style"' in COMPONENT_DESIGN_EXAMPLE
        assert '"components"' in COMPONENT_DESIGN_EXAMPLE
        assert '"data_flows"' in COMPONENT_DESIGN_EXAMPLE

    def test_diagram_example_exists(self) -> None:
        """Test that diagram example is defined."""
        assert DIAGRAM_EXAMPLE
        assert "Example" in DIAGRAM_EXAMPLE

    def test_diagram_example_contains_mermaid(self) -> None:
        """Test diagram example contains Mermaid code."""
        assert '"mermaid_code"' in DIAGRAM_EXAMPLE
        assert "graph TB" in DIAGRAM_EXAMPLE or "subgraph" in DIAGRAM_EXAMPLE


class TestPromptParameterization:
    """Tests for proper prompt parameterization."""

    def test_component_design_uses_parameters(self) -> None:
        """Test that component design prompt uses parameters."""
        prompt1 = format_component_design_prompt('{"a": 1}', "PRD A")
        prompt2 = format_component_design_prompt('{"b": 2}', "PRD B")

        assert prompt1 != prompt2
        assert "PRD A" in prompt1
        assert "PRD B" in prompt2

    def test_interface_definition_uses_parameters(self) -> None:
        """Test that interface definition prompt uses parameters."""
        prompt1 = format_interface_definition_prompt('{"c": 1}', '{}')
        prompt2 = format_interface_definition_prompt('{"d": 2}', '{}')

        assert prompt1 != prompt2

    def test_diagram_generation_uses_parameters(self) -> None:
        """Test that diagram generation prompt uses parameters."""
        prompt1 = format_diagram_generation_prompt('{"e": 1}')
        prompt2 = format_diagram_generation_prompt('{"f": 2}')

        assert prompt1 != prompt2

    def test_nfr_validation_uses_parameters(self) -> None:
        """Test that NFR validation prompt uses parameters."""
        prompt1 = format_nfr_validation_prompt('{}', "NFR set 1")
        prompt2 = format_nfr_validation_prompt('{}', "NFR set 2")

        assert prompt1 != prompt2
        assert "NFR set 1" in prompt1
        assert "NFR set 2" in prompt2
