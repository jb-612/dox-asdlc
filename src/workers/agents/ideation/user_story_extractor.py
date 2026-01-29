"""User Story Extractor for generating user stories from requirements.

Extracts user stories in "As a / I want / So that" format from
requirements and PRD context.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext
from src.workers.agents.ideation.utils import parse_json_from_response

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


# Default configuration values
_DEFAULT_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MAX_TOKENS = 4096
_DEFAULT_TEMPERATURE = 0.3
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_RETRY_DELAY_SECONDS = 1.0


@dataclass
class UserStoryExtractorConfig:
    """Configuration for UserStoryExtractor.

    Attributes:
        model: LLM model to use.
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation.
        max_retries: Maximum retry attempts on failure.
        retry_delay_seconds: Delay between retries.
    """

    model: str = _DEFAULT_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    max_retries: int = _DEFAULT_MAX_RETRIES
    retry_delay_seconds: float = _DEFAULT_RETRY_DELAY_SECONDS


@dataclass
class ExtractedUserStory:
    """User story extracted from requirements.

    Attributes:
        id: Unique story identifier.
        title: Brief story title.
        as_a: User persona (As a...).
        i_want: Desired action (I want...).
        so_that: Expected benefit (So that...).
        acceptance_criteria: List of acceptance criteria.
        linked_requirements: IDs of linked requirements.
        priority: Story priority.
    """

    id: str
    title: str
    as_a: str
    i_want: str
    so_that: str
    acceptance_criteria: list[str]
    linked_requirements: list[str]
    priority: str = "should_have"


@dataclass
class UserStoryExtractionInput:
    """Input for user story extraction.

    Attributes:
        requirements: List of requirements to extract stories from.
        prd_context: Context from the PRD.
    """

    requirements: list[dict[str, Any]]
    prd_context: dict[str, Any] = field(default_factory=dict)


@dataclass
class UserStoryExtractionResult:
    """Result from user story extraction.

    Attributes:
        success: Whether extraction succeeded.
        user_stories: Extracted user stories.
        coverage_report: Report on requirement coverage.
        error_message: Error description (if failed).
    """

    success: bool
    user_stories: list[ExtractedUserStory] = field(default_factory=list)
    coverage_report: dict[str, Any] = field(default_factory=dict)
    error_message: str | None = None


# System prompt for user story extraction
USER_STORY_EXTRACTION_PROMPT = """You are an expert Agile coach extracting user stories from product requirements.

For each requirement or group of related requirements, create a user story in the following format:

{
  "user_stories": [
    {
      "id": "US-001",
      "title": "Brief story title",
      "as_a": "user persona",
      "i_want": "the desired action or feature",
      "so_that": "the expected benefit or value",
      "acceptance_criteria": [
        "Given [context], when [action], then [outcome]",
        "More acceptance criteria..."
      ],
      "linked_requirements": ["REQ-001", "REQ-002"],
      "priority": "must_have" | "should_have" | "could_have"
    }
  ]
}

Guidelines:
1. Each user story should be from a specific user's perspective
2. The "i_want" should be actionable and concrete
3. The "so_that" should describe the business or user value
4. Include 2-5 acceptance criteria per story
5. Link stories to their source requirements
6. Derive priority from the linked requirements (highest priority wins)
7. Group related requirements into single stories when appropriate
8. Ensure all functional requirements are covered by at least one story

Respond with valid JSON only."""


class UserStoryExtractor:
    """Extracts user stories from requirements and PRD context.

    Takes requirements and generates user stories in standard
    "As a / I want / So that" format with acceptance criteria.

    Example:
        extractor = UserStoryExtractor(
            llm_client=client,
            config=UserStoryExtractorConfig(),
        )
        result = await extractor.extract(context, extraction_input)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        config: UserStoryExtractorConfig | None = None,
    ) -> None:
        """Initialize the user story extractor.

        Args:
            llm_client: LLM client for text generation.
            config: Extractor configuration.
        """
        self._llm_client = llm_client
        self._config = config or UserStoryExtractorConfig()

    @property
    def extractor_type(self) -> str:
        """Return the extractor type identifier."""
        return "user_story_extractor"

    async def extract(
        self,
        context: AgentContext,
        extraction_input: UserStoryExtractionInput,
    ) -> UserStoryExtractionResult:
        """Extract user stories from requirements.

        Args:
            context: Execution context with session/task info.
            extraction_input: Input data for extraction.

        Returns:
            UserStoryExtractionResult: Result with user stories or error.
        """
        logger.info(f"UserStoryExtractor starting for task {context.task_id}")

        # Validate input
        if not extraction_input.requirements:
            return UserStoryExtractionResult(
                success=False,
                error_message="No requirements provided for user story extraction",
            )

        try:
            # Build prompt
            prompt = self._build_extraction_prompt(extraction_input)

            # Get stories from LLM
            stories_data = await self._get_stories(prompt)

            if stories_data is None:
                return UserStoryExtractionResult(
                    success=False,
                    error_message="Failed to extract user stories from LLM response",
                )

            # Parse stories
            user_stories = self._parse_stories(stories_data)

            # Build coverage report
            coverage_report = self._build_coverage_report(
                user_stories,
                extraction_input.requirements,
            )

            logger.info(
                f"UserStoryExtractor completed for task {context.task_id}, "
                f"stories: {len(user_stories)}"
            )

            return UserStoryExtractionResult(
                success=True,
                user_stories=user_stories,
                coverage_report=coverage_report,
            )

        except Exception as e:
            logger.error(f"UserStoryExtractor failed: {e}", exc_info=True)
            return UserStoryExtractionResult(
                success=False,
                error_message=str(e),
            )

    def _build_extraction_prompt(
        self,
        extraction_input: UserStoryExtractionInput,
    ) -> str:
        """Build the prompt for user story extraction.

        Args:
            extraction_input: Input data for extraction.

        Returns:
            str: The formatted prompt.
        """
        requirements_json = json.dumps(
            extraction_input.requirements,
            indent=2,
        )

        context_info = ""
        if extraction_input.prd_context:
            if "title" in extraction_input.prd_context:
                context_info += f"Project: {extraction_input.prd_context['title']}\n"
            if "target_users" in extraction_input.prd_context:
                users = extraction_input.prd_context["target_users"]
                context_info += f"Target Users: {', '.join(users)}\n"
            if "executive_summary" in extraction_input.prd_context:
                context_info += f"Summary: {extraction_input.prd_context['executive_summary']}\n"

        return f"""
{context_info}

Requirements to convert to user stories:
{requirements_json}

Generate user stories that cover all the functional requirements.
Each story should have clear acceptance criteria and be linked to source requirements.
"""

    async def _get_stories(self, prompt: str) -> dict[str, Any] | None:
        """Get user stories from LLM.

        Args:
            prompt: The extraction prompt.

        Returns:
            dict | None: Parsed stories data or None on failure.
        """
        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=USER_STORY_EXTRACTION_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                parsed = parse_json_from_response(response.content)
                if parsed:
                    return parsed

                logger.warning(f"Invalid stories JSON on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"Story extraction attempt {attempt + 1} failed: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    def _parse_stories(
        self,
        stories_data: dict[str, Any],
    ) -> list[ExtractedUserStory]:
        """Parse user stories from LLM response.

        Args:
            stories_data: Parsed JSON with user_stories array.

        Returns:
            list[ExtractedUserStory]: Parsed user stories.
        """
        stories = []
        raw_stories = stories_data.get("user_stories", [])

        for i, raw in enumerate(raw_stories):
            try:
                story = ExtractedUserStory(
                    id=raw.get("id", f"US-{i + 1:03d}"),
                    title=raw.get("title", ""),
                    as_a=raw.get("as_a", "user"),
                    i_want=raw.get("i_want", ""),
                    so_that=raw.get("so_that", ""),
                    acceptance_criteria=raw.get("acceptance_criteria", []),
                    linked_requirements=raw.get("linked_requirements", []),
                    priority=raw.get("priority", "should_have"),
                )
                stories.append(story)
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid user story: {e}")
                continue

        return stories

    def _build_coverage_report(
        self,
        user_stories: list[ExtractedUserStory],
        requirements: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Build requirement coverage report.

        Args:
            user_stories: Extracted user stories.
            requirements: Original requirements.

        Returns:
            dict: Coverage report with covered and uncovered requirements.
        """
        # Get all requirement IDs
        all_req_ids = {req.get("id") for req in requirements if req.get("id")}

        # Get covered requirement IDs from stories
        covered_req_ids = set()
        for story in user_stories:
            covered_req_ids.update(story.linked_requirements)

        # Identify uncovered requirements
        uncovered_req_ids = all_req_ids - covered_req_ids

        return {
            "total_requirements": len(all_req_ids),
            "covered_requirements": list(covered_req_ids),
            "uncovered_requirements": list(uncovered_req_ids),
            "coverage_percentage": (
                len(covered_req_ids) / len(all_req_ids) * 100
                if all_req_ids else 0
            ),
            "total_stories": len(user_stories),
        }
