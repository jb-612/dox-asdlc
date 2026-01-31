"""Ideas Service for Brainflare Hub.

Handles CRUD operations for ideas with Elasticsearch storage.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import UTC, datetime

from elasticsearch import AsyncElasticsearch

from src.orchestrator.api.models.idea import (
    CreateIdeaRequest,
    Idea,
    IdeaClassification,
    IdeaStatus,
    UpdateIdeaRequest,
)

logger = logging.getLogger(__name__)

IDEAS_INDEX = "brainflare_ideas"


class IdeasService:
    """Service for managing ideas in Elasticsearch.

    Provides CRUD operations for ideas with support for filtering,
    pagination, and full-text search.

    Usage:
        service = IdeasService()
        idea = await service.create_idea(CreateIdeaRequest(content="My idea"))
        ideas, total = await service.list_ideas(status=IdeaStatus.ACTIVE)
    """

    def __init__(self, es_client: AsyncElasticsearch | None = None) -> None:
        """Initialize the ideas service.

        Args:
            es_client: Optional Elasticsearch client. If not provided,
                       will be created lazily using ELASTICSEARCH_URL env var.
        """
        self._es = es_client

    def _get_es(self) -> AsyncElasticsearch:
        """Get the Elasticsearch client, creating it lazily if needed.

        Returns:
            AsyncElasticsearch: The client instance.
        """
        if self._es is None:
            es_url = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
            self._es = AsyncElasticsearch([es_url])
        return self._es

    async def ensure_index(self) -> None:
        """Ensure the ideas index exists with proper mappings.

        Creates the brainflare_ideas index if it doesn't exist,
        with appropriate field mappings for search and filtering.
        """
        es = self._get_es()
        if not await es.indices.exists(index=IDEAS_INDEX):
            await es.indices.create(
                index=IDEAS_INDEX,
                body={
                    "mappings": {
                        "properties": {
                            "id": {"type": "keyword"},
                            "content": {"type": "text"},
                            "author_id": {"type": "keyword"},
                            "author_name": {"type": "text"},
                            "status": {"type": "keyword"},
                            "classification": {"type": "keyword"},
                            "labels": {"type": "keyword"},
                            "created_at": {"type": "date"},
                            "updated_at": {"type": "date"},
                            "word_count": {"type": "integer"},
                        }
                    }
                },
            )

    def _count_words(self, text: str) -> int:
        """Count words in text.

        Args:
            text: The text to count words in.

        Returns:
            int: Number of words in the text.
        """
        return len(text.split())

    async def create_idea(self, request: CreateIdeaRequest) -> Idea:
        """Create a new idea.

        Args:
            request: The idea creation request.

        Returns:
            Idea: The created idea.

        Raises:
            ValueError: If the content exceeds 144 words.
        """
        es = self._get_es()
        await self.ensure_index()

        # Validate word count
        word_count = self._count_words(request.content)
        if word_count > 144:
            raise ValueError(f"Idea exceeds 144 word limit ({word_count} words)")

        now = datetime.now(UTC)
        idea_id = f"idea-{uuid.uuid4().hex[:12]}"

        idea = Idea(
            id=idea_id,
            content=request.content,
            author_id=request.author_id,
            author_name=request.author_name,
            status=IdeaStatus.ACTIVE,
            classification=request.classification,
            labels=request.labels,
            created_at=now,
            updated_at=now,
            word_count=word_count,
        )

        await es.index(
            index=IDEAS_INDEX,
            id=idea_id,
            document=idea.model_dump(mode="json"),
        )
        await es.indices.refresh(index=IDEAS_INDEX)

        return idea

    async def get_idea(self, idea_id: str) -> Idea | None:
        """Get an idea by ID.

        Args:
            idea_id: The ID of the idea to retrieve.

        Returns:
            Idea | None: The idea if found, None otherwise.
        """
        es = self._get_es()
        try:
            result = await es.get(index=IDEAS_INDEX, id=idea_id)
            return Idea(**result["_source"])
        except Exception:
            return None

    async def update_idea(self, idea_id: str, request: UpdateIdeaRequest) -> Idea | None:
        """Update an existing idea.

        Args:
            idea_id: The ID of the idea to update.
            request: The update request with fields to modify.

        Returns:
            Idea | None: The updated idea if found, None otherwise.

        Raises:
            ValueError: If the new content exceeds 144 words.
        """
        es = self._get_es()

        existing = await self.get_idea(idea_id)
        if existing is None:
            return None

        update_data: dict = {}
        if request.content is not None:
            word_count = self._count_words(request.content)
            if word_count > 144:
                raise ValueError(f"Idea exceeds 144 word limit ({word_count} words)")
            update_data["content"] = request.content
            update_data["word_count"] = word_count
        if request.status is not None:
            update_data["status"] = request.status.value
        if request.classification is not None:
            update_data["classification"] = request.classification.value
        if request.labels is not None:
            update_data["labels"] = request.labels

        update_data["updated_at"] = datetime.now(UTC).isoformat()

        await es.update(
            index=IDEAS_INDEX,
            id=idea_id,
            doc=update_data,
        )
        await es.indices.refresh(index=IDEAS_INDEX)

        return await self.get_idea(idea_id)

    async def delete_idea(self, idea_id: str) -> bool:
        """Delete an idea.

        Args:
            idea_id: The ID of the idea to delete.

        Returns:
            bool: True if deleted, False if not found.
        """
        es = self._get_es()
        try:
            await es.delete(index=IDEAS_INDEX, id=idea_id)
            return True
        except Exception:
            return False

    async def list_ideas(
        self,
        status: IdeaStatus | None = None,
        classification: IdeaClassification | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Idea], int]:
        """List ideas with optional filters.

        Args:
            status: Filter by idea status.
            classification: Filter by classification type.
            search: Full-text search in content.
            limit: Maximum number of ideas to return.
            offset: Number of ideas to skip.

        Returns:
            tuple[list[Idea], int]: List of matching ideas and total count.
        """
        es = self._get_es()
        await self.ensure_index()

        query: dict = {"bool": {"must": []}}

        if status:
            query["bool"]["must"].append({"term": {"status": status.value}})
        if classification:
            query["bool"]["must"].append({"term": {"classification": classification.value}})
        if search:
            query["bool"]["must"].append({"match": {"content": search}})

        if not query["bool"]["must"]:
            query = {"match_all": {}}

        result = await es.search(
            index=IDEAS_INDEX,
            body={
                "query": query,
                "sort": [{"created_at": {"order": "desc"}}],
                "from": offset,
                "size": limit,
            },
        )

        ideas = [Idea(**hit["_source"]) for hit in result["hits"]["hits"]]
        total = result["hits"]["total"]["value"]

        return ideas, total


# Global service instance
_ideas_service: IdeasService | None = None


def get_ideas_service() -> IdeasService:
    """Get global ideas service instance.

    Returns:
        IdeasService: The singleton service instance.
    """
    global _ideas_service
    if _ideas_service is None:
        _ideas_service = IdeasService()
    return _ideas_service
