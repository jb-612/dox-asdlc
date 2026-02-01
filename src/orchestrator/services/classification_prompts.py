"""Classification prompts for the Auto-Classification Engine.

This module contains prompt templates and utilities for LLM-based
idea classification. Prompts are versioned for tracking and auditing.
"""

from __future__ import annotations

from typing import Any

from src.orchestrator.api.models.classification import LabelTaxonomy


# Prompt version for tracking changes
PROMPT_VERSION = "1.0.0"


# Main classification prompt template
CLASSIFICATION_PROMPT = """You are an expert product analyst tasked with classifying product ideas.

Analyze the following idea and classify it based on the criteria below.

## IDEA TO CLASSIFY

{idea_content}

## CLASSIFICATION GUIDELINES

1. **Functional Requirements** (classification: "functional")
   - Describe WHAT the system should do
   - User-facing features and capabilities
   - Actions, behaviors, or operations the system performs
   - Examples: "Add user login", "Enable CSV export", "Create search filter"

2. **Non-Functional Requirements** (classification: "non_functional")
   - Describe HOW the system should perform
   - Quality attributes and constraints
   - Performance, security, scalability, usability concerns
   - Examples: "Improve page load time", "Add encryption", "Support 1000 concurrent users"

3. **Undetermined** (classification: "undetermined")
   - Idea is too vague or ambiguous to classify
   - Contains both functional and non-functional aspects equally
   - Lacks sufficient detail for accurate classification

## LABEL TAXONOMY

{taxonomy_text}

## INSTRUCTIONS

1. Read the idea carefully
2. Determine if it describes WHAT (functional) or HOW (non-functional)
3. Select relevant labels from the taxonomy based on keywords and context
4. Assign confidence scores (0.0-1.0) for classification and each label
5. Provide brief reasoning for your classification

## RESPONSE FORMAT

Respond with ONLY a JSON object in this exact format:

{{
    "classification": "functional" | "non_functional" | "undetermined",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation of why this classification was chosen",
    "labels": ["label1", "label2"],
    "label_scores": {{"label1": 0.9, "label2": 0.7}}
}}

## EXAMPLES

### Functional Example
Idea: "Add ability for users to reset their password via email"
Response:
{{
    "classification": "functional",
    "confidence": 0.95,
    "reasoning": "This describes a specific user action (password reset) that the system should perform.",
    "labels": ["feature", "authentication"],
    "label_scores": {{"feature": 0.95, "authentication": 0.90}}
}}

### Non-Functional Example
Idea: "Reduce API response time to under 100ms for better user experience"
Response:
{{
    "classification": "non_functional",
    "confidence": 0.92,
    "reasoning": "This describes a performance requirement (response time) rather than a new feature.",
    "labels": ["performance", "api"],
    "label_scores": {{"performance": 0.95, "api": 0.80}}
}}

Now classify the idea provided above."""


# Few-shot examples for functional classification
FUNCTIONAL_EXAMPLES = [
    {
        "idea": "Add user login with OAuth support",
        "classification": "functional",
        "confidence": 0.95,
        "reasoning": "Describes a specific feature (OAuth login) the system should implement.",
        "labels": ["feature", "authentication"],
    },
    {
        "idea": "Create a dashboard showing sales metrics",
        "classification": "functional",
        "confidence": 0.92,
        "reasoning": "Describes a new UI component (dashboard) with specific functionality.",
        "labels": ["feature", "ui", "dashboard"],
    },
    {
        "idea": "Enable bulk export of customer data to CSV",
        "classification": "functional",
        "confidence": 0.94,
        "reasoning": "Describes a specific action (export) the system should perform.",
        "labels": ["feature", "api"],
    },
]


# Few-shot examples for non-functional classification
NON_FUNCTIONAL_EXAMPLES = [
    {
        "idea": "Improve page load time to under 2 seconds",
        "classification": "non_functional",
        "confidence": 0.95,
        "reasoning": "Describes a performance quality attribute, not a new feature.",
        "labels": ["performance"],
    },
    {
        "idea": "Add SSL encryption for all API endpoints",
        "classification": "non_functional",
        "confidence": 0.93,
        "reasoning": "Describes a security requirement rather than user functionality.",
        "labels": ["security", "api"],
    },
    {
        "idea": "System should handle 10,000 concurrent users",
        "classification": "non_functional",
        "confidence": 0.96,
        "reasoning": "Describes a scalability constraint, not a user-facing feature.",
        "labels": ["performance", "infrastructure"],
    },
]


def build_taxonomy_context(taxonomy: LabelTaxonomy) -> str:
    """Format a taxonomy for inclusion in the classification prompt.

    Args:
        taxonomy: The label taxonomy to format.

    Returns:
        str: Formatted taxonomy text suitable for LLM prompts.
    """
    lines = []

    for label in taxonomy.labels:
        # Label header with ID and name
        lines.append(f"- **{label.id}** ({label.name})")

        # Description if available
        if label.description:
            lines.append(f"  Description: {label.description}")

        # Keywords if available
        if label.keywords:
            keywords_str = ", ".join(label.keywords)
            lines.append(f"  Keywords: {keywords_str}")

        lines.append("")  # Empty line between labels

    return "\n".join(lines)


def build_classification_prompt(
    idea_content: str,
    taxonomy: LabelTaxonomy,
) -> str:
    """Build a complete classification prompt for an idea.

    Args:
        idea_content: The content of the idea to classify.
        taxonomy: The label taxonomy to use for classification.

    Returns:
        str: Complete prompt ready for LLM submission.
    """
    taxonomy_text = build_taxonomy_context(taxonomy)

    return CLASSIFICATION_PROMPT.format(
        idea_content=idea_content,
        taxonomy_text=taxonomy_text,
    )


def get_prompt_version() -> str:
    """Get the current prompt version.

    Returns:
        str: Version string for the classification prompt.
    """
    return PROMPT_VERSION
