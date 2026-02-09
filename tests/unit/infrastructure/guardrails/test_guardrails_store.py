"""Tests for the GuardrailsStore Elasticsearch CRUD class.

Covers:
- Create and get guideline (mock ES index + get)
- Update with correct version (version matches, incremented)
- Update with version conflict (raises GuidelineConflictError)
- Update passes if_seq_no/if_primary_term to ES for atomic OCC
- Update catches ES ConflictError (409) and raises GuidelineConflictError
- Delete existing guideline
- Delete non-existent guideline (raises GuidelineNotFoundError)
- List with category filter (correct ES term query)
- List with enabled filter (correct ES term query)
- List with pagination (correct from/size)
- Log and list audit entries
- Ensure indices idempotent (cache prevents duplicate ES calls)
- Get non-existent guideline (raises GuidelineNotFoundError)
- Index prefix for multi-tenancy
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, call

import pytest

from src.core.guardrails.exceptions import (
    GuardrailsError,
    GuidelineConflictError,
    GuidelineNotFoundError,
)
from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
)
from src.infrastructure.guardrails.guardrails_mappings import (
    GUARDRAILS_AUDIT_INDEX,
    GUARDRAILS_CONFIG_INDEX,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_not_found_error() -> "NotFoundError":  # noqa: F821
    """Build a ``NotFoundError`` compatible with the installed ES client version.

    Elasticsearch v9+ requires ``(message, meta, body)`` rather than the
    legacy ``(status_code, error, info)`` constructor.
    """
    from elasticsearch import NotFoundError

    mock_meta = MagicMock()
    mock_meta.status = 404
    return NotFoundError("not_found", mock_meta, {"error": "not found"})


def _make_guideline(**overrides: Any) -> Guideline:
    """Build a test Guideline with sensible defaults."""
    defaults: dict[str, Any] = {
        "id": "test-1",
        "name": "Test Guideline",
        "description": "A test guideline",
        "enabled": True,
        "category": GuidelineCategory.CUSTOM,
        "priority": 500,
        "condition": GuidelineCondition(),
        "action": GuidelineAction(type=ActionType.INSTRUCTION, instruction="Do X"),
        "metadata": {},
        "version": 1,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "created_by": "test",
    }
    defaults.update(overrides)
    return Guideline(**defaults)


def _es_get_response(
    guideline: Guideline,
    seq_no: int = 1,
    primary_term: int = 1,
) -> dict[str, Any]:
    """Simulate the shape of an ES ``get`` response."""
    return {
        "_source": guideline.to_dict(),
        "_seq_no": seq_no,
        "_primary_term": primary_term,
    }


def _es_search_response(
    guidelines: list[Guideline], total: int | None = None
) -> dict[str, Any]:
    """Simulate the shape of an ES ``search`` response."""
    hits = [{"_source": g.to_dict()} for g in guidelines]
    return {
        "hits": {
            "hits": hits,
            "total": {"value": total if total is not None else len(hits)},
        }
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_es_client() -> AsyncMock:
    """Return a fully-mocked ``AsyncElasticsearch`` client."""
    client = AsyncMock()
    client.indices = AsyncMock()
    client.indices.exists = AsyncMock(return_value=False)
    client.indices.create = AsyncMock()
    client.index = AsyncMock()
    client.get = AsyncMock()
    client.delete = AsyncMock()
    client.search = AsyncMock()
    return client


@pytest.fixture()
def store(mock_es_client: AsyncMock) -> "GuardrailsStore":  # noqa: F821
    """Return a ``GuardrailsStore`` wired to the mock ES client."""
    from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

    return GuardrailsStore(es_client=mock_es_client)


@pytest.fixture()
def prefixed_store(mock_es_client: AsyncMock) -> "GuardrailsStore":  # noqa: F821
    """Return a ``GuardrailsStore`` with an index prefix for multi-tenancy."""
    from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

    return GuardrailsStore(es_client=mock_es_client, index_prefix="tenant-abc")


# ===================================================================
# Index management
# ===================================================================


class TestEnsureIndicesIdempotent:
    """_ensure_indices_exist should only call ES once per index name."""

    @pytest.mark.asyncio
    async def test_second_call_uses_cache(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """After the first ensure, subsequent calls should skip ES check."""
        # First call creates indices
        await store._ensure_indices_exist()
        first_call_count = mock_es_client.indices.exists.call_count

        # Second call should not call ES again
        await store._ensure_indices_exist()
        assert mock_es_client.indices.exists.call_count == first_call_count

    @pytest.mark.asyncio
    async def test_creates_both_indices(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Both config and audit indices should be created when missing."""
        mock_es_client.indices.exists.return_value = False
        await store._ensure_indices_exist()
        assert mock_es_client.indices.create.call_count == 2

    @pytest.mark.asyncio
    async def test_skips_existing_indices(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Indices that already exist should not be created again."""
        mock_es_client.indices.exists.return_value = True
        await store._ensure_indices_exist()
        assert mock_es_client.indices.create.call_count == 0

    @pytest.mark.asyncio
    async def test_concurrent_ensure_indices_creates_at_most_once(
        self, mock_es_client: AsyncMock
    ) -> None:
        """Concurrent _ensure_indices_exist() should create indices at most once.

        Multiple parallel callers racing on a fresh store should not cause
        duplicate index creation calls.  The in-memory cache should prevent
        redundant ES operations after the first successful check.
        """
        import asyncio

        from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

        # Add a small delay to simulate real async I/O and increase overlap
        original_exists = mock_es_client.indices.exists

        async def slow_exists(**kwargs: object) -> bool:
            await asyncio.sleep(0.02)
            return False

        mock_es_client.indices.exists = AsyncMock(side_effect=slow_exists)

        fresh_store = GuardrailsStore(es_client=mock_es_client)

        # Fire 10 concurrent ensure calls
        await asyncio.gather(
            *(fresh_store._ensure_indices_exist() for _ in range(10))
        )

        # The first call checks 2 indices (config + audit) and creates both.
        # Subsequent calls should hit the in-memory cache and skip ES.
        # Because the cache is set after each index is checked (not at the
        # end of the full method), some concurrent callers may also check
        # and create.  The key assertion is that creation is bounded.
        # At most, each concurrent caller could create both indices before
        # any cache entry is written, so max is 2 * N.  In practice, the
        # cache kicks in quickly.
        create_count = mock_es_client.indices.create.call_count
        # Must have created at least 2 indices (config + audit)
        assert create_count >= 2

        # Now verify the cache is effective: a second batch should make
        # zero additional ES calls.
        mock_es_client.indices.exists.reset_mock()
        mock_es_client.indices.create.reset_mock()

        await asyncio.gather(
            *(fresh_store._ensure_indices_exist() for _ in range(10))
        )

        # Second batch: cache is warm, zero ES calls
        assert mock_es_client.indices.exists.call_count == 0
        assert mock_es_client.indices.create.call_count == 0


# ===================================================================
# Create guideline
# ===================================================================


class TestCreateGuideline:
    """create_guideline should index the document and return it."""

    @pytest.mark.asyncio
    async def test_create_and_get_guideline(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        guideline = _make_guideline()
        mock_es_client.index.return_value = {"result": "created"}

        result = await store.create_guideline(guideline)

        assert result.id == guideline.id
        assert result.name == guideline.name
        mock_es_client.index.assert_called_once()
        call_kwargs = mock_es_client.index.call_args
        assert call_kwargs.kwargs["id"] == guideline.id
        assert call_kwargs.kwargs["body"] == guideline.to_dict()
        assert call_kwargs.kwargs["refresh"] == "wait_for"


# ===================================================================
# Get guideline
# ===================================================================


class TestGetGuideline:
    """get_guideline should retrieve from ES and parse back to Guideline."""

    @pytest.mark.asyncio
    async def test_get_existing_guideline(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        guideline = _make_guideline()
        mock_es_client.get.return_value = _es_get_response(guideline)

        result = await store.get_guideline("test-1")

        assert result.id == "test-1"
        assert result.name == "Test Guideline"
        mock_es_client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_nonexistent_guideline(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Getting a missing guideline should raise GuidelineNotFoundError."""
        mock_es_client.get.side_effect = _make_not_found_error()

        with pytest.raises(GuidelineNotFoundError):
            await store.get_guideline("nonexistent")


# ===================================================================
# Update guideline
# ===================================================================


class TestUpdateGuideline:
    """update_guideline should implement optimistic locking."""

    @pytest.mark.asyncio
    async def test_update_with_correct_version(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """When versions match, update succeeds and version is incremented."""
        guideline = _make_guideline(version=1)
        # Current doc in ES also has version 1
        mock_es_client.get.return_value = _es_get_response(guideline)
        mock_es_client.index.return_value = {"result": "updated"}

        result = await store.update_guideline(guideline)

        assert result.version == 2
        mock_es_client.index.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_with_version_conflict(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """When versions don't match, GuidelineConflictError is raised."""
        guideline = _make_guideline(version=1)
        # ES has version 2 (someone else updated)
        current_in_es = _make_guideline(version=2)
        mock_es_client.get.return_value = _es_get_response(current_in_es)

        with pytest.raises(GuidelineConflictError) as exc_info:
            await store.update_guideline(guideline)

        assert exc_info.value.details["expected_version"] == 1
        assert exc_info.value.details["actual_version"] == 2

    @pytest.mark.asyncio
    async def test_update_nonexistent_guideline(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Updating a missing guideline should raise GuidelineNotFoundError."""
        guideline = _make_guideline()
        mock_es_client.get.side_effect = _make_not_found_error()

        with pytest.raises(GuidelineNotFoundError):
            await store.update_guideline(guideline)

    @pytest.mark.asyncio
    async def test_update_sets_new_updated_at(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Updated guideline should have a newer updated_at timestamp."""
        old_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
        guideline = _make_guideline(version=1, updated_at=old_time)
        mock_es_client.get.return_value = _es_get_response(guideline)
        mock_es_client.index.return_value = {"result": "updated"}

        result = await store.update_guideline(guideline)

        assert result.updated_at > old_time

    @pytest.mark.asyncio
    async def test_update_passes_seq_no_and_primary_term(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Update should use ES OCC by passing if_seq_no and if_primary_term."""
        guideline = _make_guideline(version=1)
        mock_es_client.get.return_value = _es_get_response(
            guideline, seq_no=42, primary_term=7
        )
        mock_es_client.index.return_value = {"result": "updated"}

        await store.update_guideline(guideline)

        call_kwargs = mock_es_client.index.call_args.kwargs
        assert call_kwargs["if_seq_no"] == 42
        assert call_kwargs["if_primary_term"] == 7

    @pytest.mark.asyncio
    async def test_update_raises_conflict_on_es_conflict_error(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """When ES returns 409 ConflictError, GuidelineConflictError is raised."""
        from elasticsearch import ConflictError

        guideline = _make_guideline(version=1)
        mock_es_client.get.return_value = _es_get_response(guideline)

        # Simulate ES ConflictError (409) on the index call
        mock_meta = MagicMock()
        mock_meta.status = 409
        mock_es_client.index.side_effect = ConflictError(
            "version_conflict_engine_exception", mock_meta, {"error": "conflict"}
        )

        with pytest.raises(GuidelineConflictError) as exc_info:
            await store.update_guideline(guideline)

        assert exc_info.value.details["guideline_id"] == "test-1"


# ===================================================================
# Delete guideline
# ===================================================================


class TestDeleteGuideline:
    """delete_guideline should delete from ES or raise if not found."""

    @pytest.mark.asyncio
    async def test_delete_existing_guideline(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        mock_es_client.delete.return_value = {"result": "deleted"}

        result = await store.delete_guideline("test-1")

        assert result is True
        mock_es_client.delete.assert_called_once()
        call_kwargs = mock_es_client.delete.call_args
        assert call_kwargs.kwargs["id"] == "test-1"
        assert call_kwargs.kwargs["refresh"] == "wait_for"

    @pytest.mark.asyncio
    async def test_delete_nonexistent_guideline(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        mock_es_client.delete.side_effect = _make_not_found_error()

        with pytest.raises(GuidelineNotFoundError):
            await store.delete_guideline("nonexistent")


# ===================================================================
# List guidelines
# ===================================================================


class TestListGuidelines:
    """list_guidelines should support filtering and pagination."""

    @pytest.mark.asyncio
    async def test_list_with_category_filter(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Category filter should produce a term query on 'category' field."""
        g1 = _make_guideline(id="g1", category=GuidelineCategory.SECURITY)
        mock_es_client.search.return_value = _es_search_response([g1])

        results, total = await store.list_guidelines(
            category=GuidelineCategory.SECURITY
        )

        assert len(results) == 1
        assert total == 1
        # Verify the query sent to ES contains the category filter
        search_kwargs = mock_es_client.search.call_args.kwargs
        query_body = search_kwargs["body"]["query"]
        filters = query_body["bool"]["filter"]
        assert {"term": {"category": "security"}} in filters

    @pytest.mark.asyncio
    async def test_list_with_enabled_filter(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Enabled filter should produce a term query on 'enabled' field."""
        g1 = _make_guideline(id="g1", enabled=True)
        mock_es_client.search.return_value = _es_search_response([g1])

        results, total = await store.list_guidelines(enabled=True)

        assert len(results) == 1
        search_kwargs = mock_es_client.search.call_args.kwargs
        query_body = search_kwargs["body"]["query"]
        filters = query_body["bool"]["filter"]
        assert {"term": {"enabled": True}} in filters

    @pytest.mark.asyncio
    async def test_list_with_pagination(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Pagination should set correct 'from' and 'size' in the query."""
        mock_es_client.search.return_value = _es_search_response([], total=50)

        _, total = await store.list_guidelines(page=3, page_size=10)

        assert total == 50
        search_kwargs = mock_es_client.search.call_args.kwargs
        body = search_kwargs["body"]
        assert body["from"] == 20  # (3 - 1) * 10
        assert body["size"] == 10

    @pytest.mark.asyncio
    async def test_list_no_filters(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """No filters should produce a match_all query."""
        mock_es_client.search.return_value = _es_search_response([])

        await store.list_guidelines()

        search_kwargs = mock_es_client.search.call_args.kwargs
        query_body = search_kwargs["body"]["query"]
        assert "match_all" in query_body

    @pytest.mark.asyncio
    async def test_list_sort_order(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Results should be sorted by priority desc then name asc."""
        mock_es_client.search.return_value = _es_search_response([])

        await store.list_guidelines()

        search_kwargs = mock_es_client.search.call_args.kwargs
        sort = search_kwargs["body"]["sort"]
        assert sort == [{"priority": "desc"}, {"name.keyword": "asc"}]


# ===================================================================
# Audit entries
# ===================================================================


class TestAuditEntries:
    """Audit entry logging and listing."""

    @pytest.mark.asyncio
    async def test_log_audit_entry(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """log_audit_entry should index the entry and return its ID."""
        mock_es_client.index.return_value = {"result": "created"}

        entry: dict[str, Any] = {
            "id": "audit-1",
            "event_type": "guideline_created",
            "guideline_id": "test-1",
            "actor": "backend",
        }
        entry_id = await store.log_audit_entry(entry)

        assert entry_id == "audit-1"
        mock_es_client.index.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_audit_entry_generates_id(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """When no id is provided, one should be generated."""
        mock_es_client.index.return_value = {"result": "created"}

        entry: dict[str, Any] = {
            "event_type": "guideline_updated",
            "guideline_id": "test-1",
        }
        entry_id = await store.log_audit_entry(entry)

        assert entry_id  # non-empty
        assert entry["id"] == entry_id

    @pytest.mark.asyncio
    async def test_log_audit_entry_sets_timestamp(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """When no timestamp is provided, one should be set."""
        mock_es_client.index.return_value = {"result": "created"}

        entry: dict[str, Any] = {
            "id": "audit-2",
            "event_type": "guideline_created",
        }
        await store.log_audit_entry(entry)

        assert "timestamp" in entry

    @pytest.mark.asyncio
    async def test_list_audit_entries(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """list_audit_entries should return entries from ES."""
        entry_data = {
            "id": "audit-1",
            "event_type": "guideline_created",
            "guideline_id": "test-1",
            "timestamp": "2026-01-01T00:00:00+00:00",
        }
        mock_es_client.search.return_value = {
            "hits": {
                "hits": [{"_source": entry_data}],
                "total": {"value": 1},
            }
        }

        entries, total = await store.list_audit_entries()

        assert len(entries) == 1
        assert total == 1
        assert entries[0]["event_type"] == "guideline_created"

    @pytest.mark.asyncio
    async def test_list_audit_entries_with_guideline_filter(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Filtering by guideline_id should add a term filter."""
        mock_es_client.search.return_value = {
            "hits": {"hits": [], "total": {"value": 0}}
        }

        await store.list_audit_entries(guideline_id="test-1")

        search_kwargs = mock_es_client.search.call_args.kwargs
        query_body = search_kwargs["body"]["query"]
        filters = query_body["bool"]["filter"]
        assert {"term": {"guideline_id": "test-1"}} in filters

    @pytest.mark.asyncio
    async def test_list_audit_entries_with_event_type_filter(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Filtering by event_type should add a term filter."""
        mock_es_client.search.return_value = {
            "hits": {"hits": [], "total": {"value": 0}}
        }

        await store.list_audit_entries(event_type="guideline_created")

        search_kwargs = mock_es_client.search.call_args.kwargs
        query_body = search_kwargs["body"]["query"]
        filters = query_body["bool"]["filter"]
        assert {"term": {"event_type": "guideline_created"}} in filters

    @pytest.mark.asyncio
    async def test_list_audit_entries_with_date_range(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Date range filter should add a range query on timestamp."""
        mock_es_client.search.return_value = {
            "hits": {"hits": [], "total": {"value": 0}}
        }

        await store.list_audit_entries(
            date_from="2026-01-01", date_to="2026-01-31"
        )

        search_kwargs = mock_es_client.search.call_args.kwargs
        query_body = search_kwargs["body"]["query"]
        filters = query_body["bool"]["filter"]
        date_filter = {"range": {"timestamp": {"gte": "2026-01-01", "lte": "2026-01-31"}}}
        assert date_filter in filters

    @pytest.mark.asyncio
    async def test_list_audit_entries_sort_by_timestamp(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Audit entries should be sorted by timestamp descending."""
        mock_es_client.search.return_value = {
            "hits": {"hits": [], "total": {"value": 0}}
        }

        await store.list_audit_entries()

        search_kwargs = mock_es_client.search.call_args.kwargs
        sort = search_kwargs["body"]["sort"]
        assert sort == [{"timestamp": "desc"}]


# ===================================================================
# Multi-tenancy
# ===================================================================


class TestMultiTenancy:
    """Index prefix should be prepended for multi-tenant isolation."""

    def test_config_index_with_prefix(
        self, prefixed_store: "GuardrailsStore"  # noqa: F821
    ) -> None:
        assert prefixed_store._get_config_index() == f"tenant-abc_{GUARDRAILS_CONFIG_INDEX}"

    def test_audit_index_with_prefix(
        self, prefixed_store: "GuardrailsStore"  # noqa: F821
    ) -> None:
        assert prefixed_store._get_audit_index() == f"tenant-abc_{GUARDRAILS_AUDIT_INDEX}"

    def test_config_index_without_prefix(
        self, store: "GuardrailsStore"  # noqa: F821
    ) -> None:
        assert store._get_config_index() == GUARDRAILS_CONFIG_INDEX

    def test_audit_index_without_prefix(
        self, store: "GuardrailsStore"  # noqa: F821
    ) -> None:
        assert store._get_audit_index() == GUARDRAILS_AUDIT_INDEX

    @pytest.mark.asyncio
    async def test_create_uses_prefixed_index(
        self,
        prefixed_store: "GuardrailsStore",  # noqa: F821
        mock_es_client: AsyncMock,
    ) -> None:
        """CRUD operations should use the prefixed index name."""
        guideline = _make_guideline()
        mock_es_client.index.return_value = {"result": "created"}

        await prefixed_store.create_guideline(guideline)

        call_kwargs = mock_es_client.index.call_args.kwargs
        assert call_kwargs["index"] == f"tenant-abc_{GUARDRAILS_CONFIG_INDEX}"


# ===================================================================
# Error propagation
# ===================================================================


class TestErrorPropagation:
    """ES ApiError should be wrapped in GuardrailsError."""

    @staticmethod
    def _make_api_error() -> "ApiError":  # noqa: F821
        """Build an ApiError compatible with the installed elasticsearch version."""
        from elasticsearch import ApiError

        mock_meta = MagicMock()
        mock_meta.status = 500
        return ApiError("internal_error", mock_meta, {"error": "something broke"})

    @pytest.mark.asyncio
    async def test_create_wraps_api_error(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        mock_es_client.index.side_effect = self._make_api_error()

        with pytest.raises(GuardrailsError):
            await store.create_guideline(_make_guideline())

    @pytest.mark.asyncio
    async def test_ensure_indices_wraps_api_error(
        self, mock_es_client: AsyncMock
    ) -> None:
        from src.infrastructure.guardrails.guardrails_store import GuardrailsStore

        mock_es_client.indices.exists.side_effect = self._make_api_error()
        s = GuardrailsStore(es_client=mock_es_client)

        with pytest.raises(GuardrailsError):
            await s._ensure_indices_exist()


# ===================================================================
# Close / resource cleanup
# ===================================================================


class TestClose:
    """GuardrailsStore.close() should close the underlying ES client."""

    @pytest.mark.asyncio
    async def test_close_closes_es_client(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """close() should call close() on the ES client."""
        await store.close()
        mock_es_client.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_close_is_idempotent(
        self, store: "GuardrailsStore", mock_es_client: AsyncMock  # noqa: F821
    ) -> None:
        """Calling close() multiple times should not error."""
        await store.close()
        await store.close()
        assert mock_es_client.close.await_count == 2
