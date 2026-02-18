"""Elasticsearch store for guardrails guidelines and audit logs.

Provides async CRUD operations for guideline documents and append-only
audit log entries, following the same patterns as
:class:`src.infrastructure.knowledge_store.elasticsearch_store.ElasticsearchStore`.

Multi-tenancy is supported through an optional ``index_prefix`` that is
prepended to index names.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from elasticsearch import ApiError, AsyncElasticsearch, ConflictError, NotFoundError

from src.core.guardrails.exceptions import (
    GuardrailsError,
    GuidelineConflictError,
    GuidelineNotFoundError,
)
from src.core.guardrails.models import Guideline, GuidelineCategory
from src.infrastructure.guardrails.guardrails_mappings import (
    GUARDRAILS_AUDIT_INDEX,
    GUARDRAILS_AUDIT_MAPPING,
    GUARDRAILS_CONFIG_INDEX,
    GUARDRAILS_CONFIG_MAPPING,
)

logger = logging.getLogger(__name__)


class GuardrailsStore:
    """Elasticsearch store for guardrails guidelines and audit logs.

    Attributes:
        _client: The async Elasticsearch client.
        _index_prefix: Optional prefix for multi-tenant index isolation.
        _index_exists_cache: In-memory cache to avoid repeated index existence checks.

    Example:
        ```python
        from elasticsearch import AsyncElasticsearch

        es = AsyncElasticsearch(hosts=["http://localhost:9200"])
        store = GuardrailsStore(es_client=es)

        guideline = await store.create_guideline(my_guideline)
        fetched = await store.get_guideline(guideline.id)
        ```
    """

    def __init__(
        self,
        es_client: AsyncElasticsearch,
        index_prefix: str = "",
    ) -> None:
        """Initialize with an ES client and optional index prefix.

        Args:
            es_client: An ``AsyncElasticsearch`` instance.
            index_prefix: Optional prefix for multi-tenancy index isolation.
        """
        if index_prefix and not re.match(r"^[a-zA-Z0-9_-]*$", index_prefix):
            raise GuardrailsError(
                "Invalid index prefix: contains unsafe characters",
                details={"index_prefix": index_prefix},
            )
        self._client = es_client
        self._index_prefix = index_prefix
        self._index_exists_cache: dict[str, bool] = {}

    # ------------------------------------------------------------------
    # Resource cleanup
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying Elasticsearch client.

        Releases sockets and file descriptors held by the async ES client.
        Safe to call multiple times.
        """
        if self._client is not None:
            await self._client.close()
            logger.debug("Guardrails ES client closed")

    # ------------------------------------------------------------------
    # Index name helpers
    # ------------------------------------------------------------------

    def _get_config_index(self) -> str:
        """Return the config index name, with optional prefix.

        Returns:
            The fully-qualified index name for guideline config documents.
        """
        if self._index_prefix:
            return f"{self._index_prefix}_{GUARDRAILS_CONFIG_INDEX}"
        return GUARDRAILS_CONFIG_INDEX

    def _get_audit_index(self) -> str:
        """Return the audit index name, with optional prefix.

        Returns:
            The fully-qualified index name for audit log entries.
        """
        if self._index_prefix:
            return f"{self._index_prefix}_{GUARDRAILS_AUDIT_INDEX}"
        return GUARDRAILS_AUDIT_INDEX

    # ------------------------------------------------------------------
    # Index lifecycle
    # ------------------------------------------------------------------

    async def _ensure_indices_exist(self) -> None:
        """Create config and audit indices if they do not exist.

        Uses an in-memory cache so that repeated calls within the same
        process lifetime are free after the first successful check.

        Raises:
            GuardrailsError: If the Elasticsearch call fails.
        """
        for index_name, mapping in [
            (self._get_config_index(), GUARDRAILS_CONFIG_MAPPING),
            (self._get_audit_index(), GUARDRAILS_AUDIT_MAPPING),
        ]:
            if index_name in self._index_exists_cache:
                continue
            try:
                exists = await self._client.indices.exists(index=index_name)
                if not exists:
                    logger.info("Creating index: %s", index_name)
                    await self._client.indices.create(
                        index=index_name, body=mapping
                    )
                self._index_exists_cache[index_name] = True
            except ApiError as exc:
                raise GuardrailsError(
                    f"Failed to ensure index: {exc}",
                    details={"index": index_name},
                ) from exc

    # ------------------------------------------------------------------
    # Guideline CRUD
    # ------------------------------------------------------------------

    async def create_guideline(self, guideline: Guideline) -> Guideline:
        """Create a new guideline document in Elasticsearch.

        Args:
            guideline: The guideline to persist.

        Returns:
            The same ``Guideline`` instance (unchanged).

        Raises:
            GuardrailsError: If the indexing call fails.
        """
        await self._ensure_indices_exist()
        doc = guideline.to_dict()
        try:
            await self._client.index(
                index=self._get_config_index(),
                id=guideline.id,
                body=doc,
                refresh="wait_for",
            )
            logger.debug("Created guideline: %s", guideline.id)
            return guideline
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to create guideline: {exc}",
                details={"guideline_id": guideline.id},
            ) from exc

    async def get_guideline(self, guideline_id: str) -> Guideline:
        """Retrieve a guideline by its ID.

        Args:
            guideline_id: The unique identifier of the guideline.

        Returns:
            The matching ``Guideline``.

        Raises:
            GuidelineNotFoundError: If no document matches ``guideline_id``.
            GuardrailsError: If the ES call fails for other reasons.
        """
        await self._ensure_indices_exist()
        try:
            result = await self._client.get(
                index=self._get_config_index(), id=guideline_id
            )
            return Guideline.from_dict(result["_source"])
        except NotFoundError:
            raise GuidelineNotFoundError(guideline_id)
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to get guideline: {exc}",
                details={"guideline_id": guideline_id},
            ) from exc

    async def update_guideline(self, guideline: Guideline) -> Guideline:
        """Update a guideline with optimistic locking.

        Reads the current version from Elasticsearch and compares it with
        ``guideline.version``.  If they do not match a
        :class:`GuidelineConflictError` is raised.  The write uses
        Elasticsearch ``if_seq_no`` / ``if_primary_term`` to guarantee
        atomic compare-and-swap at the storage level, preventing silent
        lost updates under concurrent modification.  On success the
        version is incremented and ``updated_at`` refreshed.

        Args:
            guideline: The guideline with changes.  ``guideline.version``
                must match the version currently stored in ES.

        Returns:
            A new ``Guideline`` instance with incremented version and
            updated ``updated_at`` timestamp.

        Raises:
            GuidelineNotFoundError: If the guideline does not exist.
            GuidelineConflictError: If the version in ES differs from
                ``guideline.version``, or if the document was modified
                between the read and write (ES 409 conflict).
            GuardrailsError: If the ES call fails for other reasons.
        """
        await self._ensure_indices_exist()
        try:
            current = await self._client.get(
                index=self._get_config_index(), id=guideline.id
            )
            current_version = current["_source"].get("version", 1)
            if current_version != guideline.version:
                raise GuidelineConflictError(
                    guideline.id, guideline.version, current_version
                )

            # Extract ES-native OCC metadata for conflict detection
            seq_no = current.get("_seq_no")
            primary_term = current.get("_primary_term")

            # Build updated document with incremented version
            updated_data = guideline.to_dict()
            updated_data["version"] = guideline.version + 1
            updated_data["updated_at"] = datetime.now(timezone.utc).isoformat()

            index_kwargs: dict[str, Any] = {
                "index": self._get_config_index(),
                "id": guideline.id,
                "body": updated_data,
                "refresh": "wait_for",
            }
            if seq_no is not None and primary_term is not None:
                index_kwargs["if_seq_no"] = seq_no
                index_kwargs["if_primary_term"] = primary_term

            await self._client.index(**index_kwargs)
            logger.debug(
                "Updated guideline %s to version %d",
                guideline.id,
                updated_data["version"],
            )
            return Guideline.from_dict(updated_data)
        except NotFoundError:
            raise GuidelineNotFoundError(guideline.id)
        except GuidelineConflictError:
            raise  # re-raise without wrapping
        except ConflictError as exc:
            raise GuidelineConflictError(
                guideline.id, guideline.version, guideline.version
            ) from exc
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to update guideline: {exc}",
                details={"guideline_id": guideline.id},
            ) from exc

    async def delete_guideline(self, guideline_id: str) -> bool:
        """Delete a guideline by ID.

        Args:
            guideline_id: The unique identifier of the guideline.

        Returns:
            ``True`` if the document was deleted.

        Raises:
            GuidelineNotFoundError: If the document does not exist.
            GuardrailsError: If the ES call fails for other reasons.
        """
        await self._ensure_indices_exist()
        try:
            await self._client.delete(
                index=self._get_config_index(),
                id=guideline_id,
                refresh="wait_for",
            )
            logger.debug("Deleted guideline: %s", guideline_id)
            return True
        except NotFoundError:
            raise GuidelineNotFoundError(guideline_id)
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to delete guideline: {exc}",
                details={"guideline_id": guideline_id},
            ) from exc

    async def list_guidelines(
        self,
        category: GuidelineCategory | None = None,
        enabled: bool | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Guideline], int]:
        """List guidelines with optional filtering and pagination.

        Args:
            category: Optional category filter (exact match).
            enabled: Optional enabled-state filter.
            page: 1-based page number.
            page_size: Number of results per page.

        Returns:
            A tuple of ``(guidelines, total_count)``.

        Raises:
            GuardrailsError: If the ES search call fails.
        """
        await self._ensure_indices_exist()

        filters: list[dict[str, Any]] = []
        if category is not None:
            filters.append({"term": {"category": category.value}})
        if enabled is not None:
            filters.append({"term": {"enabled": enabled}})

        query: dict[str, Any] = (
            {"bool": {"filter": filters}} if filters else {"match_all": {}}
        )

        try:
            result = await self._client.search(
                index=self._get_config_index(),
                body={
                    "query": query,
                    "from": (page - 1) * page_size,
                    "size": page_size,
                    "sort": [{"priority": "desc"}, {"name.keyword": "asc"}],
                },
            )
            guidelines = [
                Guideline.from_dict(hit["_source"])
                for hit in result["hits"]["hits"]
            ]
            total: int = result["hits"]["total"]["value"]
            return guidelines, total
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to list guidelines: {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # Audit log operations
    # ------------------------------------------------------------------

    async def log_audit_entry(self, entry: dict[str, Any]) -> str:
        """Persist an audit log entry.

        If ``entry`` lacks an ``id`` field one is generated.
        If ``entry`` lacks a ``timestamp`` field the current UTC time is used.

        Args:
            entry: A dictionary representing the audit event.

        Returns:
            The entry ID (either provided or generated).

        Raises:
            GuardrailsError: If the indexing call fails.
        """
        await self._ensure_indices_exist()
        entry = dict(entry)  # Defensive copy to avoid mutating caller's dict
        entry_id = entry.get("id", str(uuid.uuid4()))
        entry["id"] = entry_id
        if "timestamp" not in entry:
            entry["timestamp"] = datetime.now(timezone.utc).isoformat()
        try:
            await self._client.index(
                index=self._get_audit_index(),
                id=entry_id,
                body=entry,
                refresh="wait_for",
            )
            logger.debug("Logged audit entry: %s", entry_id)
            return entry_id
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to log audit entry: {exc}",
                details={"entry_id": entry_id},
            ) from exc

    async def list_audit_entries(
        self,
        guideline_id: str | None = None,
        event_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict[str, Any]], int]:
        """List audit entries with optional filtering and pagination.

        Args:
            guideline_id: Filter by guideline ID.
            event_type: Filter by event type string.
            date_from: ISO date string for lower bound (inclusive).
            date_to: ISO date string for upper bound (inclusive).
            page: 1-based page number.
            page_size: Number of results per page.

        Returns:
            A tuple of ``(entries, total_count)``.

        Raises:
            GuardrailsError: If the ES search call fails.
        """
        await self._ensure_indices_exist()

        filters: list[dict[str, Any]] = []
        if guideline_id:
            filters.append({"term": {"guideline_id": guideline_id}})
        if event_type:
            filters.append({"term": {"event_type": event_type}})
        if date_from or date_to:
            date_range: dict[str, str] = {}
            if date_from:
                date_range["gte"] = date_from
            if date_to:
                date_range["lte"] = date_to
            filters.append({"range": {"timestamp": date_range}})

        query: dict[str, Any] = (
            {"bool": {"filter": filters}} if filters else {"match_all": {}}
        )

        try:
            result = await self._client.search(
                index=self._get_audit_index(),
                body={
                    "query": query,
                    "from": (page - 1) * page_size,
                    "size": page_size,
                    "sort": [{"timestamp": "desc"}],
                },
            )
            entries = [hit["_source"] for hit in result["hits"]["hits"]]
            total: int = result["hits"]["total"]["value"]
            return entries, total
        except ApiError as exc:
            raise GuardrailsError(
                f"Failed to list audit entries: {exc}"
            ) from exc
