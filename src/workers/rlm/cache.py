"""Sub-call caching for RLM exploration.

Caches LLM sub-call results to avoid redundant API calls and reduce costs.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """Single cache entry.

    Attributes:
        key: Cache key (hash)
        prompt: Original prompt
        context: Context provided
        result: Cached result
        created_at: When entry was created
        hit_count: Number of times this entry was accessed
    """

    key: str
    prompt: str
    context: str
    result: str
    created_at: datetime
    hit_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "key": self.key,
            "prompt": self.prompt,
            "context": self.context,
            "result": self.result,
            "created_at": self.created_at.isoformat(),
            "hit_count": self.hit_count,
        }


@dataclass
class CacheStats:
    """Statistics about cache usage.

    Attributes:
        total_requests: Total number of cache lookups
        hits: Number of cache hits
        misses: Number of cache misses
        entries: Current number of entries
        evictions: Number of entries evicted
    """

    total_requests: int = 0
    hits: int = 0
    misses: int = 0
    entries: int = 0
    evictions: int = 0

    @property
    def hit_rate(self) -> float:
        """Calculate hit rate as percentage."""
        if self.total_requests == 0:
            return 0.0
        return (self.hits / self.total_requests) * 100

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "total_requests": self.total_requests,
            "hits": self.hits,
            "misses": self.misses,
            "entries": self.entries,
            "evictions": self.evictions,
            "hit_rate": self.hit_rate,
        }


@dataclass
class SubCallCache:
    """Cache for RLM sub-call results.

    Caches LLM query results based on prompt and context hash to avoid
    redundant API calls during exploration.

    Attributes:
        max_entries: Maximum number of cache entries (0 = unlimited)
        enabled: Whether caching is enabled

    Example:
        cache = SubCallCache(max_entries=1000)

        # Check cache before making call
        result = cache.get(prompt, context)
        if result is None:
            result = await make_llm_call(prompt, context)
            cache.set(prompt, context, result)
    """

    max_entries: int = 0
    enabled: bool = True
    _cache: dict[str, CacheEntry] = field(default_factory=dict, init=False)
    _stats: CacheStats = field(default_factory=CacheStats, init=False)

    @staticmethod
    def _generate_key(prompt: str, context: str) -> str:
        """Generate cache key from prompt and context.

        Args:
            prompt: The prompt text
            context: The context text

        Returns:
            SHA-256 hash of combined prompt and context
        """
        combined = f"prompt:{prompt}\ncontext:{context}"
        return hashlib.sha256(combined.encode()).hexdigest()

    def get(self, prompt: str, context: str) -> str | None:
        """Get cached result for prompt and context.

        Args:
            prompt: The prompt to look up
            context: The context to look up

        Returns:
            Cached result if found, None otherwise
        """
        if not self.enabled:
            return None

        self._stats.total_requests += 1
        key = self._generate_key(prompt, context)

        entry = self._cache.get(key)
        if entry is not None:
            self._stats.hits += 1
            entry.hit_count += 1
            logger.debug(f"Cache hit for key {key[:16]}... (hits: {entry.hit_count})")
            return entry.result

        self._stats.misses += 1
        logger.debug(f"Cache miss for key {key[:16]}...")
        return None

    def set(self, prompt: str, context: str, result: str) -> None:
        """Store result in cache.

        Args:
            prompt: The prompt text
            context: The context text
            result: The result to cache
        """
        if not self.enabled:
            return

        key = self._generate_key(prompt, context)

        # Check if we need to evict entries
        if self.max_entries > 0 and len(self._cache) >= self.max_entries:
            self._evict_oldest()

        self._cache[key] = CacheEntry(
            key=key,
            prompt=prompt,
            context=context,
            result=result,
            created_at=datetime.now(timezone.utc),
        )
        self._stats.entries = len(self._cache)

        logger.debug(f"Cached result for key {key[:16]}... (entries: {len(self._cache)})")

    def _evict_oldest(self) -> None:
        """Evict the oldest entry from cache."""
        if not self._cache:
            return

        # Find oldest entry by created_at
        oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        del self._cache[oldest_key]
        self._stats.evictions += 1
        self._stats.entries = len(self._cache)

        logger.debug(f"Evicted oldest cache entry {oldest_key[:16]}...")

    def contains(self, prompt: str, context: str) -> bool:
        """Check if cache contains entry for prompt and context.

        Does not update statistics.

        Args:
            prompt: The prompt to check
            context: The context to check

        Returns:
            True if entry exists
        """
        if not self.enabled:
            return False
        key = self._generate_key(prompt, context)
        return key in self._cache

    def clear(self) -> int:
        """Clear all cache entries.

        Returns:
            Number of entries cleared
        """
        count = len(self._cache)
        self._cache.clear()
        self._stats.entries = 0
        logger.info(f"Cleared {count} cache entries")
        return count

    def get_stats(self) -> CacheStats:
        """Get cache statistics.

        Returns:
            Current cache statistics
        """
        return self._stats

    def get_entry(self, prompt: str, context: str) -> CacheEntry | None:
        """Get full cache entry (not just result).

        Does not update statistics.

        Args:
            prompt: The prompt to look up
            context: The context to look up

        Returns:
            CacheEntry if found, None otherwise
        """
        if not self.enabled:
            return None
        key = self._generate_key(prompt, context)
        return self._cache.get(key)

    def remove(self, prompt: str, context: str) -> bool:
        """Remove specific entry from cache.

        Args:
            prompt: The prompt to remove
            context: The context to remove

        Returns:
            True if entry was removed, False if not found
        """
        key = self._generate_key(prompt, context)
        if key in self._cache:
            del self._cache[key]
            self._stats.entries = len(self._cache)
            return True
        return False

    def get_all_entries(self) -> list[CacheEntry]:
        """Get all cache entries.

        Returns:
            List of all cache entries
        """
        return list(self._cache.values())

    def to_dict(self) -> dict[str, Any]:
        """Convert cache state to dictionary.

        Returns:
            Dictionary representation
        """
        return {
            "max_entries": self.max_entries,
            "enabled": self.enabled,
            "entries": [entry.to_dict() for entry in self._cache.values()],
            "stats": self._stats.to_dict(),
        }

    def __len__(self) -> int:
        """Return number of cache entries."""
        return len(self._cache)

    def __repr__(self) -> str:
        """Return string representation."""
        return (
            f"SubCallCache(entries={len(self._cache)}, "
            f"hit_rate={self._stats.hit_rate:.1f}%, "
            f"enabled={self.enabled})"
        )
