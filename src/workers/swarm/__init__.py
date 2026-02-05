"""Parallel Review Swarm module.

This module provides functionality for running multiple code reviewers
in parallel and aggregating their findings into a unified report.
"""

from src.workers.swarm.aggregator import ResultAggregator
from src.workers.swarm.config import SwarmConfig, get_swarm_config
from src.workers.swarm.dispatcher import SwarmDispatcher
from src.workers.swarm.models import (
    ReviewerResult,
    ReviewFinding,
    Severity,
    SwarmSession,
    SwarmStatus,
    UnifiedReport,
)
from src.workers.swarm.redis_store import SwarmRedisStore
from src.workers.swarm.reviewers import (
    PerformanceReviewer,
    ReviewerRegistry,
    SecurityReviewer,
    SpecializedReviewer,
    StyleReviewer,
    default_registry,
)
from src.workers.swarm.session import SwarmSessionManager

__all__ = [
    # Models
    "Severity",
    "SwarmStatus",
    "ReviewFinding",
    "ReviewerResult",
    "UnifiedReport",
    "SwarmSession",
    # Configuration
    "SwarmConfig",
    "get_swarm_config",
    # Storage
    "SwarmRedisStore",
    # Session Management
    "SwarmSessionManager",
    # Dispatcher
    "SwarmDispatcher",
    # Aggregator
    "ResultAggregator",
    # Reviewers
    "SpecializedReviewer",
    "ReviewerRegistry",
    "SecurityReviewer",
    "PerformanceReviewer",
    "StyleReviewer",
    "default_registry",
]
