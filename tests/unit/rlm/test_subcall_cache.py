"""Unit tests for SubCallCache."""

from __future__ import annotations

import pytest

from src.workers.rlm.cache import SubCallCache, CacheStats


class TestSubCallCacheInit:
    """Tests for initialization."""

    def test_create_with_defaults(self) -> None:
        """Test creating cache with default values."""
        cache = SubCallCache()
        assert cache.max_entries == 0  # Unlimited
        assert cache.enabled is True
        assert len(cache) == 0

    def test_create_with_max_entries(self) -> None:
        """Test creating cache with max entries limit."""
        cache = SubCallCache(max_entries=100)
        assert cache.max_entries == 100

    def test_create_disabled(self) -> None:
        """Test creating disabled cache."""
        cache = SubCallCache(enabled=False)
        assert cache.enabled is False


class TestGetAndSet:
    """Tests for get and set methods."""

    def test_get_returns_none_on_miss(self) -> None:
        """Test get returns None for cache miss."""
        cache = SubCallCache()
        result = cache.get("prompt", "context")
        assert result is None

    def test_set_and_get(self) -> None:
        """Test basic set and get."""
        cache = SubCallCache()
        cache.set("prompt1", "context1", "result1")

        result = cache.get("prompt1", "context1")
        assert result == "result1"

    def test_different_prompts_are_separate(self) -> None:
        """Test different prompts create separate entries."""
        cache = SubCallCache()
        cache.set("prompt1", "context", "result1")
        cache.set("prompt2", "context", "result2")

        assert cache.get("prompt1", "context") == "result1"
        assert cache.get("prompt2", "context") == "result2"

    def test_different_contexts_are_separate(self) -> None:
        """Test different contexts create separate entries."""
        cache = SubCallCache()
        cache.set("prompt", "context1", "result1")
        cache.set("prompt", "context2", "result2")

        assert cache.get("prompt", "context1") == "result1"
        assert cache.get("prompt", "context2") == "result2"

    def test_set_updates_existing_entry(self) -> None:
        """Test set updates existing entry."""
        cache = SubCallCache()
        cache.set("prompt", "context", "result1")
        cache.set("prompt", "context", "result2")

        result = cache.get("prompt", "context")
        assert result == "result2"
        assert len(cache) == 1

    def test_get_disabled_cache_returns_none(self) -> None:
        """Test get always returns None when disabled."""
        cache = SubCallCache(enabled=False)
        cache._cache["key"] = "value"  # Direct set for test

        result = cache.get("prompt", "context")
        assert result is None

    def test_set_disabled_cache_is_noop(self) -> None:
        """Test set does nothing when disabled."""
        cache = SubCallCache(enabled=False)
        cache.set("prompt", "context", "result")

        assert len(cache) == 0


class TestEviction:
    """Tests for cache eviction."""

    def test_eviction_when_max_reached(self) -> None:
        """Test oldest entry is evicted when max reached."""
        cache = SubCallCache(max_entries=2)

        cache.set("p1", "c1", "r1")
        cache.set("p2", "c2", "r2")
        cache.set("p3", "c3", "r3")  # Should evict p1

        assert len(cache) == 2
        assert cache.get("p1", "c1") is None
        assert cache.get("p2", "c2") == "r2"
        assert cache.get("p3", "c3") == "r3"

    def test_no_eviction_when_unlimited(self) -> None:
        """Test no eviction with unlimited cache."""
        cache = SubCallCache(max_entries=0)  # Unlimited

        for i in range(100):
            cache.set(f"p{i}", f"c{i}", f"r{i}")

        assert len(cache) == 100

    def test_eviction_updates_stats(self) -> None:
        """Test eviction updates statistics."""
        cache = SubCallCache(max_entries=1)

        cache.set("p1", "c1", "r1")
        cache.set("p2", "c2", "r2")  # Evicts p1

        stats = cache.get_stats()
        assert stats.evictions == 1


class TestStatistics:
    """Tests for cache statistics."""

    def test_initial_stats(self) -> None:
        """Test initial statistics are zero."""
        cache = SubCallCache()
        stats = cache.get_stats()

        assert stats.total_requests == 0
        assert stats.hits == 0
        assert stats.misses == 0
        assert stats.entries == 0

    def test_hit_increments_stats(self) -> None:
        """Test cache hit increments stats."""
        cache = SubCallCache()
        cache.set("p", "c", "r")
        cache.get("p", "c")

        stats = cache.get_stats()
        assert stats.total_requests == 1
        assert stats.hits == 1
        assert stats.misses == 0

    def test_miss_increments_stats(self) -> None:
        """Test cache miss increments stats."""
        cache = SubCallCache()
        cache.get("p", "c")

        stats = cache.get_stats()
        assert stats.total_requests == 1
        assert stats.hits == 0
        assert stats.misses == 1

    def test_hit_rate_calculation(self) -> None:
        """Test hit rate calculation."""
        cache = SubCallCache()
        cache.set("p", "c", "r")

        # 2 hits, 1 miss
        cache.get("p", "c")
        cache.get("p", "c")
        cache.get("other", "context")

        stats = cache.get_stats()
        assert stats.hit_rate == pytest.approx(66.67, rel=0.01)

    def test_hit_rate_zero_when_no_requests(self) -> None:
        """Test hit rate is 0 when no requests."""
        cache = SubCallCache()
        stats = cache.get_stats()
        assert stats.hit_rate == 0.0

    def test_entry_hit_count(self) -> None:
        """Test individual entry hit count."""
        cache = SubCallCache()
        cache.set("p", "c", "r")

        cache.get("p", "c")
        cache.get("p", "c")
        cache.get("p", "c")

        entry = cache.get_entry("p", "c")
        assert entry is not None
        assert entry.hit_count == 3


class TestContains:
    """Tests for contains method."""

    def test_contains_returns_true_for_existing(self) -> None:
        """Test contains returns True for existing entry."""
        cache = SubCallCache()
        cache.set("p", "c", "r")

        assert cache.contains("p", "c") is True

    def test_contains_returns_false_for_missing(self) -> None:
        """Test contains returns False for missing entry."""
        cache = SubCallCache()

        assert cache.contains("p", "c") is False

    def test_contains_does_not_update_stats(self) -> None:
        """Test contains does not update statistics."""
        cache = SubCallCache()
        cache.set("p", "c", "r")

        cache.contains("p", "c")
        cache.contains("other", "context")

        stats = cache.get_stats()
        assert stats.total_requests == 0


class TestClear:
    """Tests for clear method."""

    def test_clear_removes_all_entries(self) -> None:
        """Test clear removes all entries."""
        cache = SubCallCache()
        cache.set("p1", "c1", "r1")
        cache.set("p2", "c2", "r2")

        count = cache.clear()

        assert count == 2
        assert len(cache) == 0

    def test_clear_returns_zero_for_empty(self) -> None:
        """Test clear returns 0 for empty cache."""
        cache = SubCallCache()
        count = cache.clear()
        assert count == 0

    def test_clear_updates_stats_entries(self) -> None:
        """Test clear updates entries stat."""
        cache = SubCallCache()
        cache.set("p", "c", "r")
        cache.clear()

        stats = cache.get_stats()
        assert stats.entries == 0


class TestRemove:
    """Tests for remove method."""

    def test_remove_existing_entry(self) -> None:
        """Test removing existing entry."""
        cache = SubCallCache()
        cache.set("p", "c", "r")

        result = cache.remove("p", "c")

        assert result is True
        assert len(cache) == 0

    def test_remove_non_existing_entry(self) -> None:
        """Test removing non-existing entry."""
        cache = SubCallCache()

        result = cache.remove("p", "c")

        assert result is False


class TestGetEntry:
    """Tests for get_entry method."""

    def test_get_entry_returns_full_entry(self) -> None:
        """Test get_entry returns full CacheEntry."""
        cache = SubCallCache()
        cache.set("prompt", "context", "result")

        entry = cache.get_entry("prompt", "context")

        assert entry is not None
        assert entry.prompt == "prompt"
        assert entry.context == "context"
        assert entry.result == "result"
        assert entry.created_at is not None

    def test_get_entry_returns_none_for_missing(self) -> None:
        """Test get_entry returns None for missing entry."""
        cache = SubCallCache()

        entry = cache.get_entry("p", "c")
        assert entry is None


class TestGetAllEntries:
    """Tests for get_all_entries method."""

    def test_get_all_entries(self) -> None:
        """Test getting all entries."""
        cache = SubCallCache()
        cache.set("p1", "c1", "r1")
        cache.set("p2", "c2", "r2")

        entries = cache.get_all_entries()

        assert len(entries) == 2


class TestToDict:
    """Tests for to_dict method."""

    def test_to_dict_includes_all_fields(self) -> None:
        """Test to_dict includes all expected fields."""
        cache = SubCallCache(max_entries=100, enabled=True)
        cache.set("p", "c", "r")
        cache.get("p", "c")  # Record a hit

        d = cache.to_dict()

        assert d["max_entries"] == 100
        assert d["enabled"] is True
        assert len(d["entries"]) == 1
        assert "stats" in d
        assert d["stats"]["hits"] == 1


class TestRepr:
    """Tests for __repr__ method."""

    def test_repr(self) -> None:
        """Test string representation."""
        cache = SubCallCache()
        cache.set("p", "c", "r")
        cache.get("p", "c")

        repr_str = repr(cache)

        assert "entries=1" in repr_str
        assert "hit_rate=" in repr_str
        assert "enabled=True" in repr_str


class TestCacheStats:
    """Tests for CacheStats dataclass."""

    def test_cache_stats_defaults(self) -> None:
        """Test CacheStats default values."""
        stats = CacheStats()
        assert stats.total_requests == 0
        assert stats.hits == 0
        assert stats.misses == 0
        assert stats.entries == 0
        assert stats.evictions == 0

    def test_cache_stats_hit_rate(self) -> None:
        """Test hit rate property."""
        stats = CacheStats(total_requests=10, hits=7, misses=3)
        assert stats.hit_rate == 70.0

    def test_cache_stats_to_dict(self) -> None:
        """Test to_dict method."""
        stats = CacheStats(
            total_requests=100,
            hits=80,
            misses=20,
            entries=50,
            evictions=10,
        )

        d = stats.to_dict()

        assert d["total_requests"] == 100
        assert d["hits"] == 80
        assert d["misses"] == 20
        assert d["entries"] == 50
        assert d["evictions"] == 10
        assert d["hit_rate"] == 80.0
