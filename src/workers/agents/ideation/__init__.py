"""Ideation agents package.

Provides agents and utilities for PRD Ideation Studio (P05-F11):
- IdeationAgent: Conducts structured interviews
- PRDGenerator: Generates PRD from ideation output
- UserStoryExtractor: Extracts user stories from requirements
- parse_json_from_response: Shared utility for parsing LLM JSON responses
"""

from __future__ import annotations

from src.workers.agents.ideation.ideation_agent import (
    IdeationAgent,
    IdeationConfig,
    InterviewPhase,
    MaturityCategory,
    MATURITY_CATEGORIES,
)
from src.workers.agents.ideation.prd_generator import (
    PRDGenerator,
    PRDGeneratorConfig,
    PRDGeneratorResult,
    IdeationToPRDInput,
)
from src.workers.agents.ideation.user_story_extractor import (
    UserStoryExtractor,
    UserStoryExtractorConfig,
    ExtractedUserStory,
    UserStoryExtractionInput,
    UserStoryExtractionResult,
)
from src.workers.agents.ideation.utils import parse_json_from_response

__all__ = [
    # IdeationAgent
    "IdeationAgent",
    "IdeationConfig",
    "InterviewPhase",
    "MaturityCategory",
    "MATURITY_CATEGORIES",
    # PRDGenerator
    "PRDGenerator",
    "PRDGeneratorConfig",
    "PRDGeneratorResult",
    "IdeationToPRDInput",
    # UserStoryExtractor
    "UserStoryExtractor",
    "UserStoryExtractorConfig",
    "ExtractedUserStory",
    "UserStoryExtractionInput",
    "UserStoryExtractionResult",
    # Utilities
    "parse_json_from_response",
]
