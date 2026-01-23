"""Prompts for Design agents."""

from src.workers.agents.design.prompts.surveyor_prompts import (
    SURVEYOR_SYSTEM_PROMPT,
    format_technology_analysis_prompt,
    format_research_synthesis_prompt,
    format_recommendation_prompt,
)
from src.workers.agents.design.prompts.architect_prompts import (
    ARCHITECT_SYSTEM_PROMPT,
    format_component_design_prompt,
    format_interface_definition_prompt,
    format_diagram_generation_prompt,
    format_nfr_validation_prompt,
)
from src.workers.agents.design.prompts.planner_prompts import (
    PLANNER_SYSTEM_PROMPT,
    format_task_breakdown_prompt,
    format_dependency_analysis_prompt,
    format_complexity_estimation_prompt,
)

__all__ = [
    # Surveyor prompts
    "SURVEYOR_SYSTEM_PROMPT",
    "format_technology_analysis_prompt",
    "format_research_synthesis_prompt",
    "format_recommendation_prompt",
    # Architect prompts
    "ARCHITECT_SYSTEM_PROMPT",
    "format_component_design_prompt",
    "format_interface_definition_prompt",
    "format_diagram_generation_prompt",
    "format_nfr_validation_prompt",
    # Planner prompts
    "PLANNER_SYSTEM_PROMPT",
    "format_task_breakdown_prompt",
    "format_dependency_analysis_prompt",
    "format_complexity_estimation_prompt",
]
