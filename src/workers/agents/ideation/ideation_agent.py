"""IdeationAgent for structured PRD interviews.

Conducts structured interviews to gather requirements and track
maturity progress toward PRD generation readiness.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, TYPE_CHECKING

from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.agents.ideation.utils import parse_json_from_response

if TYPE_CHECKING:
    from src.workers.llm.client import LLMClient

logger = logging.getLogger(__name__)


class InterviewPhase(str, Enum):
    """Interview phases for PRD ideation."""

    OPENING = "opening"
    PROBLEM = "problem"
    USERS = "users"
    FUNCTIONAL = "functional"
    NFR = "nfr"
    SCOPE = "scope"
    SUCCESS = "success"
    RISKS = "risks"
    COMPLETE = "complete"


@dataclass
class MaturityCategory:
    """Maturity category definition.

    Attributes:
        id: Unique category identifier.
        name: Human-readable category name.
        weight: Weight for overall maturity calculation (0-100).
        description: Description of what this category covers.
    """

    id: str
    name: str
    weight: int
    description: str = ""


# Standard maturity categories with weights summing to 100
MATURITY_CATEGORIES: list[MaturityCategory] = [
    MaturityCategory(
        id="problem",
        name="Problem Statement",
        weight=15,
        description="Understanding of the problem being solved",
    ),
    MaturityCategory(
        id="users",
        name="Target Users",
        weight=10,
        description="Identification of user personas and needs",
    ),
    MaturityCategory(
        id="functional",
        name="Functional Requirements",
        weight=25,
        description="Core functionality the system must provide",
    ),
    MaturityCategory(
        id="nfr",
        name="Non-Functional Requirements",
        weight=15,
        description="Performance, security, scalability requirements",
    ),
    MaturityCategory(
        id="scope",
        name="Scope & Constraints",
        weight=15,
        description="What is in and out of scope, technical constraints",
    ),
    MaturityCategory(
        id="success",
        name="Success Criteria",
        weight=10,
        description="How success will be measured",
    ),
    MaturityCategory(
        id="risks",
        name="Risks & Assumptions",
        weight=10,
        description="Known risks and underlying assumptions",
    ),
]


# Default values as constants
_DEFAULT_MODEL = "claude-sonnet-4-20250514"
_DEFAULT_MAX_TOKENS = 4096
_DEFAULT_TEMPERATURE = 0.4
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_RETRY_DELAY_SECONDS = 1.0
_DEFAULT_SUBMIT_THRESHOLD = 80.0


@dataclass
class IdeationConfig:
    """Configuration for IdeationAgent.

    Attributes:
        model: LLM model to use.
        max_tokens: Maximum tokens for LLM responses.
        temperature: LLM temperature for generation.
        max_retries: Maximum retry attempts on failure.
        retry_delay_seconds: Delay between retries.
        submit_threshold: Minimum maturity score to submit PRD.
    """

    model: str = _DEFAULT_MODEL
    max_tokens: int = _DEFAULT_MAX_TOKENS
    temperature: float = _DEFAULT_TEMPERATURE
    max_retries: int = _DEFAULT_MAX_RETRIES
    retry_delay_seconds: float = _DEFAULT_RETRY_DELAY_SECONDS
    submit_threshold: float = _DEFAULT_SUBMIT_THRESHOLD


# System prompt for the ideation agent
IDEATION_SYSTEM_PROMPT = """You are an expert Product Manager conducting a structured interview to gather requirements for a Product Requirements Document (PRD).

Your role is to:
1. Ask probing questions to understand the user's needs
2. Extract concrete requirements from their responses
3. Identify gaps in coverage across requirement categories
4. Guide the conversation through all necessary areas

You must respond with a JSON object containing:
- response: Your conversational response to the user
- extracted_requirements: Array of requirements extracted from the latest message
- maturity_updates: Object mapping category IDs to new scores (0-100)
- follow_up_questions: Array of suggested follow-up questions
- current_phase: The current interview phase
- identified_gaps: (optional) Array of category IDs that need more coverage

Categories to cover (with weights):
- problem (15%): Problem Statement - the core problem being solved
- users (10%): Target Users - who will use the system
- functional (25%): Functional Requirements - what the system must do
- nfr (15%): Non-Functional Requirements - performance, security, etc.
- scope (15%): Scope & Constraints - boundaries and limitations
- success (10%): Success Criteria - how to measure success
- risks (10%): Risks & Assumptions - potential issues and assumptions

Requirement format:
{
  "id": "REQ-XXX",
  "description": "Clear requirement statement",
  "type": "functional" | "non_functional" | "constraint",
  "priority": "must_have" | "should_have" | "could_have",
  "category_id": "problem" | "users" | "functional" | "nfr" | "scope" | "success" | "risks"
}

Always respond in valid JSON format."""


class IdeationAgent:
    """Agent that conducts structured interviews for PRD ideation.

    Implements the BaseAgent protocol to be dispatched by the worker pool.
    Guides users through requirement gathering with maturity tracking.

    Example:
        agent = IdeationAgent(llm_client=client, config=IdeationConfig())
        result = await agent.execute(context, event_metadata)
    """

    def __init__(
        self,
        llm_client: LLMClient,
        config: IdeationConfig | None = None,
    ) -> None:
        """Initialize the ideation agent.

        Args:
            llm_client: LLM client for text generation.
            config: Agent configuration.
        """
        self._llm_client = llm_client
        self._config = config or IdeationConfig()

    @property
    def agent_type(self) -> str:
        """Return the agent type identifier."""
        return "ideation_agent"

    async def execute(
        self,
        context: AgentContext,
        event_metadata: dict[str, Any],
    ) -> AgentResult:
        """Execute ideation interview step.

        Args:
            context: Execution context with session/task info.
            event_metadata: Additional metadata from triggering event.
                Expected keys:
                - user_message: User's message (required)
                - conversation_history: Previous messages (optional)
                - current_maturity: Current category scores (optional)

        Returns:
            AgentResult: Result with response and maturity updates.
        """
        logger.info(f"IdeationAgent starting for task {context.task_id}")

        try:
            user_message = event_metadata.get("user_message", "")
            if not user_message:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="No user_message provided in event_metadata",
                    should_retry=False,
                )

            conversation_history = event_metadata.get("conversation_history", [])
            current_maturity = event_metadata.get("current_maturity", {})

            # Build the prompt
            prompt = self._build_prompt(
                user_message=user_message,
                conversation_history=conversation_history,
                current_maturity=current_maturity,
            )

            # Get response from LLM
            response_data = await self._get_llm_response(prompt)

            if response_data is None:
                return AgentResult(
                    success=False,
                    agent_type=self.agent_type,
                    task_id=context.task_id,
                    error_message="Failed to get valid response from LLM",
                    should_retry=True,
                )

            logger.info(
                f"IdeationAgent completed for task {context.task_id}, "
                f"phase: {response_data.get('current_phase', 'unknown')}"
            )

            return AgentResult(
                success=True,
                agent_type=self.agent_type,
                task_id=context.task_id,
                metadata={
                    "response": response_data.get("response", ""),
                    "extracted_requirements": response_data.get("extracted_requirements", []),
                    "maturity_updates": response_data.get("maturity_updates", {}),
                    "follow_up_questions": response_data.get("follow_up_questions", []),
                    "current_phase": response_data.get("current_phase", "opening"),
                    "identified_gaps": response_data.get("identified_gaps", []),
                },
            )

        except Exception as e:
            logger.error(f"IdeationAgent failed: {e}", exc_info=True)
            return AgentResult(
                success=False,
                agent_type=self.agent_type,
                task_id=context.task_id,
                error_message=str(e),
                should_retry=True,
            )

    def _build_prompt(
        self,
        user_message: str,
        conversation_history: list[dict[str, str]],
        current_maturity: dict[str, float],
    ) -> str:
        """Build the prompt for the LLM.

        Args:
            user_message: The user's current message.
            conversation_history: Previous conversation messages.
            current_maturity: Current maturity scores by category.

        Returns:
            str: The formatted prompt.
        """
        # Build maturity context
        maturity_context = "Current maturity scores:\n"
        overall = self.calculate_overall_maturity(current_maturity)
        maturity_context += f"Overall: {overall:.1f}%\n"

        for category in MATURITY_CATEGORIES:
            score = current_maturity.get(category.id, 0)
            maturity_context += f"- {category.name}: {score}%\n"

        # Build conversation context
        conversation_context = ""
        if conversation_history:
            conversation_context = "Conversation history:\n"
            for msg in conversation_history[-10:]:  # Last 10 messages
                role = msg.get("role", "user")
                content = msg.get("content", "")
                conversation_context += f"{role.upper()}: {content}\n\n"

        # Identify gaps
        gaps = self.identify_gaps(current_maturity, threshold=50)
        gaps_context = ""
        if gaps:
            gaps_context = f"\nCategories needing attention: {', '.join(gaps)}\n"

        prompt = f"""
{maturity_context}
{gaps_context}
{conversation_context}

USER MESSAGE: {user_message}

Based on the current maturity scores and conversation, provide your response as a JSON object with the structure specified in the system prompt.
"""

        return prompt

    async def _get_llm_response(self, prompt: str) -> dict[str, Any] | None:
        """Get and parse LLM response.

        Args:
            prompt: The prompt to send to the LLM.

        Returns:
            dict | None: Parsed response or None on failure.
        """
        for attempt in range(self._config.max_retries):
            try:
                response = await self._llm_client.generate(
                    prompt=prompt,
                    system=IDEATION_SYSTEM_PROMPT,
                    max_tokens=self._config.max_tokens,
                    temperature=self._config.temperature,
                )

                parsed = parse_json_from_response(response.content)
                if parsed:
                    return parsed

                logger.warning(f"Invalid JSON on attempt {attempt + 1}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

            except Exception as e:
                logger.warning(f"LLM call failed on attempt {attempt + 1}: {e}")
                if attempt < self._config.max_retries - 1:
                    await asyncio.sleep(self._config.retry_delay_seconds)

        return None

    def calculate_overall_maturity(self, category_scores: dict[str, float]) -> float:
        """Calculate overall maturity from category scores.

        Args:
            category_scores: Scores by category ID (0-100).

        Returns:
            float: Overall weighted maturity score (0-100).
        """
        total = 0.0
        for category in MATURITY_CATEGORIES:
            score = category_scores.get(category.id, 0)
            total += score * category.weight / 100

        return total

    def can_submit(self, category_scores: dict[str, float]) -> bool:
        """Check if maturity is sufficient for PRD submission.

        Args:
            category_scores: Scores by category ID.

        Returns:
            bool: True if overall maturity >= threshold.
        """
        overall = self.calculate_overall_maturity(category_scores)
        return overall >= self._config.submit_threshold

    def get_maturity_level(self, score: float) -> str:
        """Get maturity level name for a score.

        Args:
            score: Maturity score (0-100).

        Returns:
            str: Level name (concept, exploration, defined, refined, complete).
        """
        if score < 20:
            return "concept"
        elif score < 40:
            return "exploration"
        elif score < 60:
            return "defined"
        elif score < 80:
            return "refined"
        else:
            return "complete"

    def identify_gaps(
        self,
        category_scores: dict[str, float],
        threshold: float = 40,
    ) -> list[str]:
        """Identify categories below threshold.

        Args:
            category_scores: Scores by category ID.
            threshold: Minimum score threshold.

        Returns:
            list[str]: Category IDs below threshold.
        """
        gaps = []
        for category in MATURITY_CATEGORIES:
            score = category_scores.get(category.id, 0)
            if score < threshold:
                gaps.append(category.id)
        return gaps

    def validate_context(self, context: AgentContext) -> bool:
        """Validate that context is suitable for execution.

        Args:
            context: Agent context to validate.

        Returns:
            bool: True if context is valid.
        """
        return bool(
            context.session_id
            and context.task_id
            and context.workspace_path
        )
