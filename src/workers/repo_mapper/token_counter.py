"""Token counting for context packs using tiktoken."""

from __future__ import annotations

import hashlib
from functools import lru_cache

import tiktoken

from src.workers.repo_mapper.models import ParsedFile, SymbolInfo


class TokenCounter:
    """Counts tokens in text using tiktoken.

    Uses the cl100k_base encoding (used by GPT-4 and Claude models).
    Caches token counts for repeated content.
    """

    def __init__(self, encoding_name: str = "cl100k_base") -> None:
        """Initialize the token counter.

        Args:
            encoding_name: Name of the tiktoken encoding to use
        """
        self._encoding = tiktoken.get_encoding(encoding_name)
        self._cache: dict[str, int] = {}
        self._cache_hits = 0
        self._cache_misses = 0

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens in

        Returns:
            Number of tokens
        """
        if not text:
            return 0

        # Create cache key from content hash
        cache_key = hashlib.md5(text.encode()).hexdigest()

        # Check cache
        if cache_key in self._cache:
            self._cache_hits += 1
            return self._cache[cache_key]

        # Count tokens (allow special tokens in source code)
        self._cache_misses += 1
        tokens = self._encoding.encode(text, disallowed_special=())
        count = len(tokens)

        # Cache the result
        self._cache[cache_key] = count

        return count

    def count_symbol(self, symbol: SymbolInfo) -> int:
        """Count tokens for a symbol (signature + docstring).

        Args:
            symbol: Symbol to count tokens for

        Returns:
            Estimated token count
        """
        parts = []

        if symbol.signature:
            parts.append(symbol.signature)

        if symbol.docstring:
            parts.append(symbol.docstring)

        content = "\n".join(parts)
        return self.count_tokens(content)

    def count_parsed_file(self, parsed_file: ParsedFile) -> int:
        """Count tokens in a parsed file.

        Args:
            parsed_file: Parsed file to count tokens for

        Returns:
            Total token count for the file
        """
        return self.count_tokens(parsed_file.raw_content)

    def estimate_signature_tokens(self, signature: str) -> int:
        """Estimate token count for a function/method signature.

        This is just a wrapper around count_tokens for consistency.

        Args:
            signature: Function or method signature

        Returns:
            Token count
        """
        return self.count_tokens(signature)

    def get_cache_stats(self) -> dict[str, int]:
        """Get cache statistics.

        Returns:
            Dictionary with cache size, hits, and misses
        """
        return {
            "size": len(self._cache),
            "hits": self._cache_hits,
            "misses": self._cache_misses,
        }

    def clear_cache(self) -> None:
        """Clear the token count cache."""
        self._cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0


@lru_cache(maxsize=1)
def get_token_counter() -> TokenCounter:
    """Get cached TokenCounter instance.

    Returns:
        TokenCounter instance
    """
    return TokenCounter()
