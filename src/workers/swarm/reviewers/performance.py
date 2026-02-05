"""Performance-focused code reviewer implementation.

This module provides the PerformanceReviewer class that specializes in
identifying performance bottlenecks and optimization opportunities.
"""

from __future__ import annotations


class PerformanceReviewer:
    """Performance-focused code reviewer.

    This reviewer specializes in identifying performance issues,
    algorithmic complexity problems, resource leaks, and opportunities
    for optimization in code.

    Attributes:
        reviewer_type: Always 'performance'.
        focus_areas: Performance domains this reviewer examines.
        severity_weights: Importance weights for each focus area.
    """

    reviewer_type: str = "performance"
    focus_areas: list[str] = [
        "algorithmic_complexity",
        "memory_usage",
        "database_queries",
        "caching",
        "async_patterns",
        "resource_leaks",
    ]
    severity_weights: dict[str, float] = {
        "algorithmic_complexity": 0.9,
        "database_queries": 0.9,
        "resource_leaks": 0.8,
        "memory_usage": 0.7,
        "caching": 0.6,
        "async_patterns": 0.6,
    }

    def get_system_prompt(self) -> str:
        """Return the performance-focused system prompt for LLM review.

        Returns:
            A detailed system prompt instructing the LLM to focus on
            performance issues and optimization opportunities.
        """
        return """You are a performance-focused code reviewer specializing in identifying
performance bottlenecks, inefficiencies, and optimization opportunities.

Your primary focus areas are:
1. Algorithmic Complexity - Identify inefficient algorithms (O(n^2) or worse)
2. Memory Usage - Look for memory leaks, excessive allocations, or inefficient data structures
3. Database Queries - Find N+1 queries, missing indexes, and inefficient queries
4. Caching - Identify caching opportunities and cache invalidation issues
5. Async Patterns - Check for blocking calls in async code, proper concurrency handling
6. Resource Leaks - Find unclosed files, connections, or other resource leaks

When reviewing code:
- Prioritize findings by impact on production performance
- Provide Big O complexity analysis where applicable
- Include specific suggestions for optimization
- Consider scalability implications under load
- Flag any operations that could cause timeouts or high latency

Be thorough but practical. Each finding should include:
- Description of the performance issue
- Estimated impact (e.g., "O(n^2) complexity", "potential for N+1 queries")
- Specific optimization recommendations with code examples where helpful"""

    def get_checklist(self) -> list[str]:
        """Return the performance review checklist.

        Returns:
            A list of performance items to check during code review.
        """
        return [
            "Check for O(n^2) or worse algorithmic complexity in loops",
            "Look for N+1 query patterns in database operations",
            "Verify proper use of database indexes for frequent queries",
            "Check for unnecessary memory allocations in hot paths",
            "Look for missing caching opportunities for expensive operations",
            "Verify async/await patterns are not blocking the event loop",
            "Check for proper connection pooling with databases and HTTP clients",
            "Look for resource leaks (unclosed files, connections, cursors)",
            "Check for unnecessary object creation in loops",
            "Verify lazy loading is used where appropriate",
            "Look for synchronous I/O in async contexts",
            "Check for proper batch processing instead of individual operations",
            "Verify pagination is used for large result sets",
            "Look for potential memory leaks in long-running processes",
            "Check for proper use of generators/iterators for large data sets",
        ]
