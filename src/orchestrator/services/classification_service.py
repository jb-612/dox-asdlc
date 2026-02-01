"""Classification Service for Auto-Classification Engine.

This module provides the core classification logic for categorizing ideas
as functional or non-functional requirements and assigning labels.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import redis.asyncio as redis

from src.orchestrator.api.models.classification import (
    ClassificationResult,
    ClassificationType,
    LabelDefinition,
    LabelTaxonomy,
)
from src.orchestrator.api.models.idea import IdeaClassification
from src.orchestrator.api.models.llm_config import AgentRole
from src.orchestrator.services.classification_prompts import (
    build_classification_prompt,
    get_prompt_version,
)

if TYPE_CHECKING:
    from src.infrastructure.llm.factory import LLMClientFactory
    from src.orchestrator.services.ideas_service import IdeasService
    from src.orchestrator.services.label_taxonomy_service import LabelTaxonomyService


logger = logging.getLogger(__name__)


# Redis key prefix for classification results
REDIS_CLASSIFICATION_KEY_PREFIX = "classification:result:"

# LLM temperature for classification (low for consistency)
CLASSIFICATION_TEMPERATURE = 0.3

# Max tokens for classification response
CLASSIFICATION_MAX_TOKENS = 500

# Max retries for LLM calls
MAX_LLM_RETRIES = 3


class ClassificationService:
    """Service for classifying ideas using LLM and rule-based fallback.

    Provides methods for classifying ideas as functional or non-functional
    requirements and assigning labels from a configurable taxonomy.

    Usage:
        service = ClassificationService()
        result = await service.classify_idea("idea-123")

        # Force reclassification
        result = await service.classify_idea("idea-123", force=True)

        # Get stored result
        result = await service.get_classification_result("idea-123")
    """

    def __init__(
        self,
        redis_client: redis.Redis | None = None,
        taxonomy_service: LabelTaxonomyService | None = None,
        ideas_service: IdeasService | None = None,
        llm_factory: LLMClientFactory | None = None,
    ) -> None:
        """Initialize the classification service.

        Args:
            redis_client: Optional Redis client for storing results.
            taxonomy_service: Optional taxonomy service for label management.
            ideas_service: Optional ideas service for retrieving ideas.
            llm_factory: Optional LLM factory for creating LLM clients.
        """
        self._redis_client = redis_client
        self._taxonomy_service = taxonomy_service
        self._ideas_service = ideas_service
        self._llm_factory = llm_factory

    async def _get_redis(self) -> redis.Redis:
        """Get or create the Redis client.

        Returns:
            redis.Redis: The Redis client instance.
        """
        if self._redis_client is None:
            import os

            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                redis_host = os.environ.get("REDIS_HOST", "localhost")
                redis_port = os.environ.get("REDIS_PORT", "6379")
                redis_url = f"redis://{redis_host}:{redis_port}"
            self._redis_client = redis.from_url(redis_url)
        return self._redis_client

    def _get_taxonomy_service(self) -> LabelTaxonomyService:
        """Get or create the taxonomy service.

        Returns:
            LabelTaxonomyService: The taxonomy service instance.
        """
        if self._taxonomy_service is None:
            from src.orchestrator.services.label_taxonomy_service import (
                get_label_taxonomy_service,
            )

            self._taxonomy_service = get_label_taxonomy_service()
        return self._taxonomy_service

    def _get_ideas_service(self) -> IdeasService:
        """Get or create the ideas service.

        Returns:
            IdeasService: The ideas service instance.
        """
        if self._ideas_service is None:
            from src.orchestrator.services.ideas_service import get_ideas_service

            self._ideas_service = get_ideas_service()
        return self._ideas_service

    def _get_llm_factory(self) -> LLMClientFactory:
        """Get or create the LLM factory.

        Returns:
            LLMClientFactory: The LLM factory instance.
        """
        if self._llm_factory is None:
            from src.infrastructure.llm.factory import get_llm_client_factory

            self._llm_factory = get_llm_client_factory()
        return self._llm_factory

    async def classify_idea(
        self,
        idea_id: str,
        force: bool = False,
    ) -> ClassificationResult:
        """Classify an idea as functional or non-functional.

        Args:
            idea_id: The ID of the idea to classify.
            force: If True, reclassify even if already classified.

        Returns:
            ClassificationResult: The classification result.

        Raises:
            ValueError: If the idea is not found.
        """
        # Get the idea
        ideas_service = self._get_ideas_service()
        idea = await ideas_service.get_idea(idea_id)

        if idea is None:
            raise ValueError(f"Idea not found: {idea_id}")

        # Check if already classified (unless force)
        if (
            not force
            and idea.classification != IdeaClassification.UNDETERMINED
        ):
            existing = await self.get_classification_result(idea_id)
            if existing is not None:
                return existing

        # Get taxonomy
        taxonomy_service = self._get_taxonomy_service()
        taxonomy = await taxonomy_service.get_taxonomy()
        taxonomy_text = await taxonomy_service.to_prompt_format()

        # Build prompt
        prompt = self.build_classification_prompt(idea.content, taxonomy_text)

        # Try LLM classification
        try:
            result = await self._classify_with_llm(
                idea_id=idea_id,
                prompt=prompt,
                taxonomy=taxonomy,
            )
        except Exception as e:
            logger.warning(
                f"LLM classification failed for {idea_id}, using rule-based fallback: {e}"
            )
            result = self._classify_with_rules(
                idea_id=idea_id,
                content=idea.content,
                taxonomy=taxonomy,
            )

        # Store the result
        await self.store_classification_result(result)

        # Update the idea with classification
        from src.orchestrator.api.models.idea import UpdateIdeaRequest

        update_request = UpdateIdeaRequest(
            classification=IdeaClassification(result.classification.value),
            labels=list(set(idea.labels + result.labels)),
        )
        await ideas_service.update_idea(idea_id, update_request)

        return result

    async def _classify_with_llm(
        self,
        idea_id: str,
        prompt: str,
        taxonomy: LabelTaxonomy,
    ) -> ClassificationResult:
        """Classify an idea using the LLM.

        Args:
            idea_id: The ID of the idea.
            prompt: The classification prompt.
            taxonomy: The label taxonomy for validation.

        Returns:
            ClassificationResult: The classification result.
        """
        llm_factory = self._get_llm_factory()
        client = await llm_factory.get_client(AgentRole.DISCOVERY)

        response = await client.generate(
            prompt=prompt,
            temperature=CLASSIFICATION_TEMPERATURE,
            max_tokens=CLASSIFICATION_MAX_TOKENS,
        )

        # Parse the response
        parsed = self.parse_classification_response(response.content)

        # Validate labels
        valid_labels = self.validate_labels(parsed.get("labels", []), taxonomy)

        # Create result
        classification_type = ClassificationType(parsed["classification"])

        return ClassificationResult(
            idea_id=idea_id,
            classification=classification_type,
            confidence=parsed["confidence"],
            labels=valid_labels,
            reasoning=parsed.get("reasoning", ""),
            model_version=f"{client.model}:{get_prompt_version()}",
        )

    def _classify_with_rules(
        self,
        idea_id: str,
        content: str,
        taxonomy: LabelTaxonomy,
    ) -> ClassificationResult:
        """Classify an idea using rule-based keyword matching.

        This is a fallback when LLM classification fails.

        Args:
            idea_id: The ID of the idea.
            content: The idea content.
            taxonomy: The label taxonomy.

        Returns:
            ClassificationResult: The classification result.
        """
        content_lower = content.lower()

        # Match labels based on keywords
        matched_labels: list[str] = []
        label_scores: dict[str, float] = {}

        for label in taxonomy.labels:
            if label.keywords:
                matches = sum(
                    1 for keyword in label.keywords if keyword.lower() in content_lower
                )
                if matches > 0:
                    score = min(0.3 + (matches * 0.1), 0.7)  # Cap at 0.7 for rule-based
                    matched_labels.append(label.id)
                    label_scores[label.id] = score

        # Determine classification based on keywords
        non_functional_keywords = [
            "performance",
            "speed",
            "fast",
            "slow",
            "security",
            "encrypt",
            "scale",
            "concurrent",
            "reliability",
            "uptime",
            "latency",
        ]
        functional_keywords = [
            "add",
            "create",
            "build",
            "implement",
            "feature",
            "allow",
            "enable",
            "user can",
            "ability to",
        ]

        nf_matches = sum(1 for kw in non_functional_keywords if kw in content_lower)
        f_matches = sum(1 for kw in functional_keywords if kw in content_lower)

        if nf_matches > f_matches:
            classification = ClassificationType.NON_FUNCTIONAL
            confidence = min(0.5 + (nf_matches * 0.05), 0.7)
        elif f_matches > nf_matches:
            classification = ClassificationType.FUNCTIONAL
            confidence = min(0.5 + (f_matches * 0.05), 0.7)
        else:
            classification = ClassificationType.UNDETERMINED
            confidence = 0.3

        return ClassificationResult(
            idea_id=idea_id,
            classification=classification,
            confidence=confidence,
            labels=matched_labels,
            reasoning="Classification based on keyword matching (LLM fallback).",
            model_version=f"rule-based:{get_prompt_version()}",
        )

    def build_classification_prompt(
        self,
        idea_content: str,
        taxonomy_text: str,
    ) -> str:
        """Build a classification prompt for an idea.

        Args:
            idea_content: The content of the idea to classify.
            taxonomy_text: Formatted taxonomy text for the prompt.

        Returns:
            str: The complete classification prompt.
        """
        # Use the imported function from classification_prompts
        from src.orchestrator.services.classification_prompts import (
            CLASSIFICATION_PROMPT,
        )

        return CLASSIFICATION_PROMPT.format(
            idea_content=idea_content,
            taxonomy_text=taxonomy_text,
        )

    def parse_classification_response(self, response: str) -> dict[str, Any]:
        """Parse the LLM classification response.

        Args:
            response: The raw LLM response string.

        Returns:
            dict: Parsed classification data with defaults for missing fields.
        """
        # Try to extract JSON from markdown code block
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response)
        if json_match:
            response = json_match.group(1)

        try:
            data = json.loads(response)
        except json.JSONDecodeError:
            logger.warning("Failed to parse classification response as JSON")
            return {
                "classification": "undetermined",
                "confidence": 0.0,
                "reasoning": "Failed to parse LLM response",
                "labels": [],
                "label_scores": {},
            }

        # Normalize classification value
        classification = data.get("classification", "undetermined").lower()
        if classification not in ["functional", "non_functional", "undetermined"]:
            classification = "undetermined"

        return {
            "classification": classification,
            "confidence": float(data.get("confidence", 0.5)),
            "reasoning": data.get("reasoning", ""),
            "labels": data.get("labels", []),
            "label_scores": data.get("label_scores", {}),
        }

    def validate_labels(
        self,
        labels: list[str],
        taxonomy: LabelTaxonomy,
    ) -> list[str]:
        """Validate labels against the taxonomy.

        Args:
            labels: List of label IDs to validate.
            taxonomy: The label taxonomy to validate against.

        Returns:
            list[str]: List of valid label IDs.
        """
        valid_label_ids = {label.id for label in taxonomy.labels}
        return [label for label in labels if label in valid_label_ids]

    async def store_classification_result(
        self,
        result: ClassificationResult,
    ) -> None:
        """Store a classification result in Redis.

        Args:
            result: The classification result to store.
        """
        redis_client = await self._get_redis()
        key = f"{REDIS_CLASSIFICATION_KEY_PREFIX}{result.idea_id}"

        await redis_client.set(
            key,
            json.dumps(result.model_dump()),
        )

    async def get_classification_result(
        self,
        idea_id: str,
    ) -> ClassificationResult | None:
        """Get a stored classification result.

        Args:
            idea_id: The ID of the idea.

        Returns:
            ClassificationResult | None: The result if found, None otherwise.
        """
        redis_client = await self._get_redis()
        key = f"{REDIS_CLASSIFICATION_KEY_PREFIX}{idea_id}"

        data = await redis_client.get(key)
        if data is None:
            return None

        result_dict = json.loads(data)
        return ClassificationResult(
            idea_id=result_dict["idea_id"],
            classification=ClassificationType(result_dict["classification"]),
            confidence=result_dict["confidence"],
            labels=result_dict["labels"],
            reasoning=result_dict.get("reasoning"),
            model_version=result_dict.get("model_version"),
        )


# Global service instance
_classification_service: ClassificationService | None = None


def get_classification_service() -> ClassificationService:
    """Get the singleton classification service instance.

    Returns:
        ClassificationService: The service instance.
    """
    global _classification_service
    if _classification_service is None:
        _classification_service = ClassificationService()
    return _classification_service
