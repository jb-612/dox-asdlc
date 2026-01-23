"""RLM (Recursive LLM) exploration system.

Provides iterative codebase exploration for tasks that exceed context limits,
using a sub-call budget and REPL-style tool surface.
"""

from __future__ import annotations

from src.workers.rlm.agent import AgentIteration, RLMAgent
from src.workers.rlm.audit import AuditEntry, RLMAuditor
from src.workers.rlm.budget_manager import BudgetSnapshot, SubCallBudgetManager
from src.workers.rlm.cache import CacheEntry, CacheStats, SubCallCache
from src.workers.rlm.config import RLMConfig
from src.workers.rlm.integration import RLMIntegration, RLMIntegrationResult
from src.workers.rlm.orchestrator import RLMOrchestrator
from src.workers.rlm.trigger import RLMTriggerDetector, TriggerReason, TriggerResult
from src.workers.rlm.models import (
    Citation,
    ExplorationStep,
    ExplorationTrajectory,
    Finding,
    GrepMatch,
    RLMResult,
    RLMUsage,
    ToolCall,
)

__all__ = [
    # Agent
    "AgentIteration",
    "RLMAgent",
    # Audit
    "AuditEntry",
    "RLMAuditor",
    # Budget
    "BudgetSnapshot",
    "SubCallBudgetManager",
    # Cache
    "CacheEntry",
    "CacheStats",
    "SubCallCache",
    # Config
    "RLMConfig",
    # Integration
    "RLMIntegration",
    "RLMIntegrationResult",
    # Orchestrator
    "RLMOrchestrator",
    # Trigger
    "RLMTriggerDetector",
    "TriggerReason",
    "TriggerResult",
    # Models
    "Citation",
    "ExplorationStep",
    "ExplorationTrajectory",
    "Finding",
    "GrepMatch",
    "RLMResult",
    "RLMUsage",
    "ToolCall",
]
