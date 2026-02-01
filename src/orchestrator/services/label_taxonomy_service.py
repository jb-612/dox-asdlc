"""Label Taxonomy Service.

This module provides the service layer for managing label taxonomies
used in idea classification. Data is stored in Redis.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from src.orchestrator.api.models.classification import (
    LabelDefinition,
    LabelTaxonomy,
)


logger = logging.getLogger(__name__)


# Redis key for taxonomy storage
REDIS_TAXONOMY_KEY = "classification:taxonomy:default"


# Default label definitions
DEFAULT_LABELS: list[LabelDefinition] = [
    LabelDefinition(
        id="feature",
        name="Feature",
        description="A new user-facing feature or capability",
        keywords=["new", "add", "create", "implement", "build", "introduce"],
        color="#22c55e",  # green
    ),
    LabelDefinition(
        id="bug",
        name="Bug",
        description="A defect or issue that needs fixing",
        keywords=["fix", "bug", "error", "broken", "issue", "problem", "crash"],
        color="#ef4444",  # red
    ),
    LabelDefinition(
        id="improvement",
        name="Improvement",
        description="Enhancement to an existing feature",
        keywords=["improve", "enhance", "better", "optimize", "upgrade", "refine"],
        color="#3b82f6",  # blue
    ),
    LabelDefinition(
        id="performance",
        name="Performance",
        description="Performance optimization or improvement",
        keywords=["speed", "fast", "slow", "performance", "optimize", "latency", "throughput"],
        color="#f59e0b",  # amber
    ),
    LabelDefinition(
        id="security",
        name="Security",
        description="Security-related concerns or improvements",
        keywords=["security", "vulnerability", "auth", "permission", "access", "encrypt"],
        color="#dc2626",  # dark red
    ),
    LabelDefinition(
        id="documentation",
        name="Documentation",
        description="Documentation updates or additions",
        keywords=["doc", "documentation", "readme", "guide", "tutorial", "comment"],
        color="#8b5cf6",  # purple
    ),
    LabelDefinition(
        id="api",
        name="API",
        description="API-related changes or additions",
        keywords=["api", "endpoint", "rest", "graphql", "request", "response"],
        color="#06b6d4",  # cyan
    ),
    LabelDefinition(
        id="ui",
        name="UI",
        description="User interface changes",
        keywords=["ui", "ux", "interface", "design", "layout", "style", "css", "visual"],
        color="#ec4899",  # pink
    ),
    LabelDefinition(
        id="backend",
        name="Backend",
        description="Backend/server-side changes",
        keywords=["backend", "server", "database", "service", "worker", "queue"],
        color="#64748b",  # slate
    ),
    LabelDefinition(
        id="infrastructure",
        name="Infrastructure",
        description="Infrastructure and DevOps changes",
        keywords=["infra", "devops", "deploy", "kubernetes", "docker", "ci", "cd", "pipeline"],
        color="#78716c",  # stone
    ),
]


def _create_default_taxonomy() -> LabelTaxonomy:
    """Create the default taxonomy with predefined labels.
    
    Returns:
        LabelTaxonomy: A new taxonomy with default labels.
    """
    now = datetime.now(timezone.utc)
    return LabelTaxonomy(
        id="default",
        name="Default Taxonomy",
        description="Standard label taxonomy for idea classification",
        labels=DEFAULT_LABELS.copy(),
        version="1.0",
        created_at=now,
        updated_at=now,
    )


class LabelTaxonomyService:
    """Service for managing label taxonomies.

    Provides CRUD operations for label taxonomies and individual labels,
    with data stored in Redis.

    Usage:
        service = LabelTaxonomyService()
        taxonomy = await service.get_taxonomy()
        
        label = await service.get_label("feature")
        await service.add_label(LabelDefinition(...))
        await service.update_label("feature", LabelDefinition(...))
        await service.delete_label("feature")
        
        prompt_text = await service.to_prompt_format()
    """

    def __init__(self, redis_client: redis.Redis | None = None) -> None:
        """Initialize the label taxonomy service.

        Args:
            redis_client: Optional Redis client. If not provided, will
                create a default client when needed.
        """
        self._redis_client = redis_client

    async def _get_redis(self) -> redis.Redis:
        """Get or create the Redis client.

        Returns:
            redis.Redis: The Redis client instance.
        """
        if self._redis_client is None:
            import os

            # Support both REDIS_URL and REDIS_HOST/REDIS_PORT
            redis_url = os.environ.get("REDIS_URL")
            if not redis_url:
                redis_host = os.environ.get("REDIS_HOST", "localhost")
                redis_port = os.environ.get("REDIS_PORT", "6379")
                redis_url = f"redis://{redis_host}:{redis_port}"
            self._redis_client = redis.from_url(redis_url)
        return self._redis_client

    async def get_taxonomy(self) -> LabelTaxonomy:
        """Get the current label taxonomy.

        If no taxonomy is stored, returns the default taxonomy.

        Returns:
            LabelTaxonomy: The current taxonomy.
        """
        redis_client = await self._get_redis()
        data = await redis_client.get(REDIS_TAXONOMY_KEY)

        if not data:
            return _create_default_taxonomy()

        taxonomy_dict = json.loads(data)
        return LabelTaxonomy(
            id=taxonomy_dict["id"],
            name=taxonomy_dict["name"],
            description=taxonomy_dict.get("description"),
            labels=[
                LabelDefinition(
                    id=label["id"],
                    name=label["name"],
                    description=label.get("description"),
                    keywords=label.get("keywords", []),
                    color=label.get("color"),
                )
                for label in taxonomy_dict.get("labels", [])
            ],
            version=taxonomy_dict["version"],
            created_at=datetime.fromisoformat(taxonomy_dict["created_at"]),
            updated_at=datetime.fromisoformat(taxonomy_dict["updated_at"]),
        )

    async def update_taxonomy(self, taxonomy: LabelTaxonomy) -> LabelTaxonomy:
        """Update the label taxonomy.

        Args:
            taxonomy: The taxonomy to store.

        Returns:
            LabelTaxonomy: The stored taxonomy with updated timestamp.
        """
        redis_client = await self._get_redis()

        # Update the timestamp
        now = datetime.now(timezone.utc)
        updated_taxonomy = LabelTaxonomy(
            id=taxonomy.id,
            name=taxonomy.name,
            description=taxonomy.description,
            labels=taxonomy.labels,
            version=taxonomy.version,
            created_at=taxonomy.created_at,
            updated_at=now,
        )

        # Serialize and store
        taxonomy_dict = {
            "id": updated_taxonomy.id,
            "name": updated_taxonomy.name,
            "description": updated_taxonomy.description,
            "labels": [
                {
                    "id": label.id,
                    "name": label.name,
                    "description": label.description,
                    "keywords": label.keywords,
                    "color": label.color,
                }
                for label in updated_taxonomy.labels
            ],
            "version": updated_taxonomy.version,
            "created_at": updated_taxonomy.created_at.isoformat(),
            "updated_at": updated_taxonomy.updated_at.isoformat(),
        }

        await redis_client.set(REDIS_TAXONOMY_KEY, json.dumps(taxonomy_dict))
        return updated_taxonomy

    async def add_label(self, label: LabelDefinition) -> LabelTaxonomy:
        """Add a new label to the taxonomy.

        Args:
            label: The label definition to add.

        Returns:
            LabelTaxonomy: The updated taxonomy.

        Raises:
            ValueError: If a label with the same ID already exists.
        """
        taxonomy = await self.get_taxonomy()

        # Check for duplicate ID
        if any(existing.id == label.id for existing in taxonomy.labels):
            raise ValueError(f"Label with ID '{label.id}' already exists")

        # Add the label
        new_labels = list(taxonomy.labels)
        new_labels.append(label)

        # Create updated taxonomy
        updated_taxonomy = LabelTaxonomy(
            id=taxonomy.id,
            name=taxonomy.name,
            description=taxonomy.description,
            labels=new_labels,
            version=taxonomy.version,
            created_at=taxonomy.created_at,
            updated_at=taxonomy.updated_at,
        )

        return await self.update_taxonomy(updated_taxonomy)

    async def update_label(self, label_id: str, label: LabelDefinition) -> LabelTaxonomy:
        """Update an existing label in the taxonomy.

        Args:
            label_id: The ID of the label to update.
            label: The new label definition.

        Returns:
            LabelTaxonomy: The updated taxonomy.

        Raises:
            KeyError: If the label is not found.
        """
        taxonomy = await self.get_taxonomy()

        # Find the label index
        label_index = None
        for i, existing in enumerate(taxonomy.labels):
            if existing.id == label_id:
                label_index = i
                break

        if label_index is None:
            raise KeyError(f"Label with ID '{label_id}' not found")

        # Update the label
        new_labels = list(taxonomy.labels)
        new_labels[label_index] = label

        # Create updated taxonomy
        updated_taxonomy = LabelTaxonomy(
            id=taxonomy.id,
            name=taxonomy.name,
            description=taxonomy.description,
            labels=new_labels,
            version=taxonomy.version,
            created_at=taxonomy.created_at,
            updated_at=taxonomy.updated_at,
        )

        return await self.update_taxonomy(updated_taxonomy)

    async def delete_label(self, label_id: str) -> LabelTaxonomy:
        """Delete a label from the taxonomy.

        Args:
            label_id: The ID of the label to delete.

        Returns:
            LabelTaxonomy: The updated taxonomy.

        Raises:
            KeyError: If the label is not found.
        """
        taxonomy = await self.get_taxonomy()

        # Find and remove the label
        original_count = len(taxonomy.labels)
        new_labels = [label for label in taxonomy.labels if label.id != label_id]

        if len(new_labels) == original_count:
            raise KeyError(f"Label with ID '{label_id}' not found")

        # Create updated taxonomy
        updated_taxonomy = LabelTaxonomy(
            id=taxonomy.id,
            name=taxonomy.name,
            description=taxonomy.description,
            labels=new_labels,
            version=taxonomy.version,
            created_at=taxonomy.created_at,
            updated_at=taxonomy.updated_at,
        )

        return await self.update_taxonomy(updated_taxonomy)

    async def get_label(self, label_id: str) -> LabelDefinition | None:
        """Get a single label by ID.

        Args:
            label_id: The ID of the label to retrieve.

        Returns:
            LabelDefinition | None: The label if found, None otherwise.
        """
        taxonomy = await self.get_taxonomy()

        for label in taxonomy.labels:
            if label.id == label_id:
                return label

        return None

    async def to_prompt_format(self) -> str:
        """Format the taxonomy for use in an LLM prompt.

        Returns a human-readable text representation of the taxonomy
        suitable for including in classification prompts.

        Returns:
            str: Formatted taxonomy text for LLM prompts.
        """
        taxonomy = await self.get_taxonomy()

        lines = [
            "Available labels for classification:",
            "",
        ]

        for label in taxonomy.labels:
            # Label header
            lines.append(f"- {label.id} ({label.name})")
            
            # Description
            if label.description:
                lines.append(f"  Description: {label.description}")
            
            # Keywords
            if label.keywords:
                keywords_str = ", ".join(label.keywords)
                lines.append(f"  Keywords: {keywords_str}")
            
            lines.append("")

        return "\n".join(lines)


# Global service instance
_label_taxonomy_service: LabelTaxonomyService | None = None


def get_label_taxonomy_service() -> LabelTaxonomyService:
    """Get the singleton label taxonomy service instance.

    Returns:
        LabelTaxonomyService: The service instance.
    """
    global _label_taxonomy_service
    if _label_taxonomy_service is None:
        _label_taxonomy_service = LabelTaxonomyService()
    return _label_taxonomy_service
