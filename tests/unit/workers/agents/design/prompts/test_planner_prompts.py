"""Unit tests for Planner Agent prompts."""

from __future__ import annotations

import pytest

from src.workers.agents.design.prompts.planner_prompts import (
    PLANNER_SYSTEM_PROMPT,
    format_task_breakdown_prompt,
    format_dependency_analysis_prompt,
    format_complexity_estimation_prompt,
    format_critical_path_prompt,
    format_implementation_plan_prompt,
    TASK_BREAKDOWN_EXAMPLE,
    CRITICAL_PATH_EXAMPLE,
)


class TestPlannerSystemPrompt:
    """Tests for the system prompt."""

    def test_system_prompt_exists(self) -> None:
        """Test that system prompt is defined."""
        assert PLANNER_SYSTEM_PROMPT
        assert len(PLANNER_SYSTEM_PROMPT) > 100

    def test_system_prompt_contains_role(self) -> None:
        """Test that system prompt defines the agent role."""
        assert "Implementation Planner Agent" in PLANNER_SYSTEM_PROMPT

    def test_system_prompt_mentions_json(self) -> None:
        """Test that system prompt mentions JSON output."""
        assert "JSON" in PLANNER_SYSTEM_PROMPT

    def test_system_prompt_mentions_responsibilities(self) -> None:
        """Test that system prompt outlines responsibilities."""
        assert "task" in PLANNER_SYSTEM_PROMPT.lower()
        assert "dependencies" in PLANNER_SYSTEM_PROMPT.lower()
        assert "critical path" in PLANNER_SYSTEM_PROMPT.lower()


class TestTaskBreakdownPrompt:
    """Tests for the task breakdown prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        architecture = '{"components": []}'
        prd_content = "Build a user service."

        prompt = format_task_breakdown_prompt(architecture, prd_content)

        assert architecture in prompt
        assert prd_content in prompt
        assert "## Architecture Document" in prompt
        assert "## PRD Document" in prompt

    def test_prompt_with_acceptance_criteria(self) -> None:
        """Test prompt with acceptance criteria."""
        architecture = '{}'
        prd_content = "PRD"
        acceptance = "Must handle 1000 users."

        prompt = format_task_breakdown_prompt(
            architecture, prd_content, acceptance
        )

        assert acceptance in prompt
        assert "## Acceptance Criteria" in prompt

    def test_prompt_contains_task_schema(self) -> None:
        """Test that prompt contains task schema."""
        prompt = format_task_breakdown_prompt('{}', "PRD")

        assert '"id"' in prompt
        assert '"title"' in prompt
        assert '"description"' in prompt
        assert '"component"' in prompt
        assert '"dependencies"' in prompt
        assert '"acceptance_criteria"' in prompt
        assert '"estimated_complexity"' in prompt

    def test_prompt_contains_complexity_guide(self) -> None:
        """Test that prompt includes complexity guide."""
        prompt = format_task_breakdown_prompt('{}', "PRD")

        assert "S (Small)" in prompt or "S:" in prompt
        assert "M (Medium)" in prompt or "M:" in prompt
        assert "L (Large)" in prompt or "L:" in prompt
        assert "XL (Extra Large)" in prompt or "XL:" in prompt


class TestDependencyAnalysisPrompt:
    """Tests for the dependency analysis prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tasks = '{"tasks": [{"id": "T001"}]}'
        architecture = '{"components": []}'

        prompt = format_dependency_analysis_prompt(tasks, architecture)

        assert tasks in prompt
        assert architecture in prompt
        assert "## Tasks" in prompt
        assert "## Architecture" in prompt

    def test_prompt_contains_analysis_schema(self) -> None:
        """Test that prompt contains analysis schema."""
        prompt = format_dependency_analysis_prompt('{}', '{}')

        assert '"refined_dependencies"' in prompt
        assert '"circular_dependencies"' in prompt
        assert '"parallelizable_groups"' in prompt
        assert '"dependency_graph"' in prompt


class TestComplexityEstimationPrompt:
    """Tests for the complexity estimation prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tasks = '{"tasks": []}'
        tech_survey = '{"technologies": []}'

        prompt = format_complexity_estimation_prompt(tasks, tech_survey)

        assert tasks in prompt
        assert tech_survey in prompt
        assert "## Tasks" in prompt
        assert "## Technology Survey" in prompt

    def test_prompt_contains_estimation_schema(self) -> None:
        """Test that prompt contains estimation schema."""
        prompt = format_complexity_estimation_prompt('{}', '{}')

        assert '"estimations"' in prompt
        assert '"complexity"' in prompt
        assert '"hours_estimate"' in prompt
        assert '"risk_level"' in prompt

    def test_prompt_contains_hours_guide(self) -> None:
        """Test that prompt includes hours guide."""
        prompt = format_complexity_estimation_prompt('{}', '{}')

        assert "2-4 hours" in prompt
        assert "4-8 hours" in prompt
        assert "8-16 hours" in prompt
        assert "16+" in prompt


class TestCriticalPathPrompt:
    """Tests for the critical path prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tasks = '{"tasks": []}'
        dep_graph = '{"T001": ["T002"]}'

        prompt = format_critical_path_prompt(tasks, dep_graph)

        assert tasks in prompt
        assert dep_graph in prompt
        assert "## Tasks with Estimations" in prompt
        assert "## Dependency Graph" in prompt

    def test_prompt_contains_critical_path_schema(self) -> None:
        """Test that prompt contains critical path schema."""
        prompt = format_critical_path_prompt('{}', '{}')

        assert '"critical_path"' in prompt
        assert '"critical_path_duration_hours"' in prompt
        assert '"phases"' in prompt
        assert '"slack_analysis"' in prompt
        assert '"milestones"' in prompt


class TestImplementationPlanPrompt:
    """Tests for the implementation plan prompt formatter."""

    def test_basic_prompt_format(self) -> None:
        """Test basic prompt formatting."""
        tasks = '{"tasks": []}'
        critical_path = '{"critical_path": []}'
        phases = '{"phases": []}'
        arch_ref = "ARCH-001"

        prompt = format_implementation_plan_prompt(
            tasks, critical_path, phases, arch_ref
        )

        assert tasks in prompt
        assert critical_path in prompt
        assert phases in prompt
        assert arch_ref in prompt

    def test_prompt_contains_plan_schema(self) -> None:
        """Test that prompt contains plan schema."""
        prompt = format_implementation_plan_prompt('{}', '{}', '{}', "ARCH")

        assert '"architecture_reference"' in prompt
        assert '"phases"' in prompt
        assert '"tasks"' in prompt
        assert '"critical_path"' in prompt
        assert '"milestones"' in prompt


class TestExamples:
    """Tests for example outputs."""

    def test_task_breakdown_example_exists(self) -> None:
        """Test that task breakdown example is defined."""
        assert TASK_BREAKDOWN_EXAMPLE
        assert "Example output" in TASK_BREAKDOWN_EXAMPLE

    def test_task_breakdown_example_structure(self) -> None:
        """Test task breakdown example has expected structure."""
        assert '"tasks"' in TASK_BREAKDOWN_EXAMPLE
        assert '"id"' in TASK_BREAKDOWN_EXAMPLE
        assert '"title"' in TASK_BREAKDOWN_EXAMPLE
        assert '"dependencies"' in TASK_BREAKDOWN_EXAMPLE

    def test_critical_path_example_exists(self) -> None:
        """Test that critical path example is defined."""
        assert CRITICAL_PATH_EXAMPLE
        assert "Example output" in CRITICAL_PATH_EXAMPLE

    def test_critical_path_example_structure(self) -> None:
        """Test critical path example has expected structure."""
        assert '"critical_path"' in CRITICAL_PATH_EXAMPLE
        assert '"phases"' in CRITICAL_PATH_EXAMPLE
        assert '"milestones"' in CRITICAL_PATH_EXAMPLE


class TestPromptParameterization:
    """Tests for proper prompt parameterization."""

    def test_task_breakdown_uses_parameters(self) -> None:
        """Test that task breakdown prompt uses parameters."""
        prompt1 = format_task_breakdown_prompt('{"a": 1}', "PRD A")
        prompt2 = format_task_breakdown_prompt('{"b": 2}', "PRD B")

        assert prompt1 != prompt2
        assert "PRD A" in prompt1
        assert "PRD B" in prompt2

    def test_dependency_analysis_uses_parameters(self) -> None:
        """Test that dependency analysis prompt uses parameters."""
        prompt1 = format_dependency_analysis_prompt('{"c": 1}', '{}')
        prompt2 = format_dependency_analysis_prompt('{"d": 2}', '{}')

        assert prompt1 != prompt2

    def test_complexity_estimation_uses_parameters(self) -> None:
        """Test that complexity estimation prompt uses parameters."""
        prompt1 = format_complexity_estimation_prompt('{}', '{"tech": "A"}')
        prompt2 = format_complexity_estimation_prompt('{}', '{"tech": "B"}')

        assert prompt1 != prompt2

    def test_critical_path_uses_parameters(self) -> None:
        """Test that critical path prompt uses parameters."""
        prompt1 = format_critical_path_prompt('{}', '{"a": 1}')
        prompt2 = format_critical_path_prompt('{}', '{"b": 2}')

        assert prompt1 != prompt2
