"""Custom exceptions for the aSDLC system.

All exceptions inherit from ASDLCError for consistent handling.
"""

from __future__ import annotations


class ASDLCError(Exception):
    """Base exception for all aSDLC errors."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        self.message = message
        self.details = details or {}
        super().__init__(message)

    def to_dict(self) -> dict:
        """Convert exception to dictionary for JSON serialization."""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
        }


# Configuration errors
class ConfigurationError(ASDLCError):
    """Raised when configuration is invalid or missing."""


class EnvironmentError(ConfigurationError):
    """Raised when required environment variables are missing."""


# Redis/infrastructure errors
class RedisConnectionError(ASDLCError):
    """Raised when Redis connection fails."""


class RedisOperationError(ASDLCError):
    """Raised when a Redis operation fails."""


class StreamError(ASDLCError):
    """Raised when stream operations fail."""


class ConsumerGroupError(StreamError):
    """Raised when consumer group operations fail."""


# Task and event errors
class TaskNotFoundError(ASDLCError):
    """Raised when a task cannot be found."""


class TaskStateError(ASDLCError):
    """Raised when task state is invalid for the requested operation."""


class EventProcessingError(ASDLCError):
    """Raised when event processing fails."""


class DuplicateEventError(EventProcessingError):
    """Raised when a duplicate event is detected."""


# Agent errors
class AgentError(ASDLCError):
    """Base error for agent-related failures."""


class AgentTimeoutError(AgentError):
    """Raised when agent execution times out."""


class AgentExecutionError(AgentError):
    """Raised when agent execution fails."""


# Git/artifact errors
class GitOperationError(ASDLCError):
    """Raised when a Git operation fails."""


class ArtifactNotFoundError(ASDLCError):
    """Raised when a required artifact is missing."""


class ArtifactValidationError(ASDLCError):
    """Raised when artifact validation fails."""


# HITL errors
class HITLError(ASDLCError):
    """Base error for HITL-related failures."""


class GateApprovalError(HITLError):
    """Raised when a gate approval fails or is rejected."""


# Health check errors
class HealthCheckError(ASDLCError):
    """Raised when a health check fails."""


class DependencyHealthError(HealthCheckError):
    """Raised when a dependency health check fails."""


# KnowledgeStore errors
class KnowledgeStoreError(ASDLCError):
    """Base error for knowledge store operations."""


class DocumentNotFoundError(KnowledgeStoreError):
    """Raised when a document is not found in the knowledge store."""


class IndexingError(KnowledgeStoreError):
    """Raised when document indexing fails."""


class SearchError(KnowledgeStoreError):
    """Raised when a search operation fails."""


class EmbeddingError(KnowledgeStoreError):
    """Raised when embedding generation fails."""


class BackendConnectionError(KnowledgeStoreError):
    """Raised when connection to the knowledge store backend fails."""


# Multi-tenancy errors
class TenantError(ASDLCError):
    """Base error for tenant-related failures."""


class TenantNotSetError(TenantError):
    """Raised when tenant context is required but not set."""


class TenantNotAllowedError(TenantError):
    """Raised when the requested tenant is not in the allowlist."""


# Repo Mapper errors
class RepoMapperError(ASDLCError):
    """Base error for repo mapper operations."""


class ParseError(RepoMapperError):
    """Raised when file parsing fails."""


class DependencyResolutionError(RepoMapperError):
    """Raised when dependency resolution fails."""


# Coordination errors
class CoordinationError(ASDLCError):
    """Base error for CLI coordination operations."""


class MessageNotFoundError(CoordinationError):
    """Raised when a coordination message is not found."""


class PublishError(CoordinationError):
    """Raised when message publishing fails."""


class AcknowledgeError(CoordinationError):
    """Raised when message acknowledgment fails."""


class PresenceError(CoordinationError):
    """Raised when presence operations fail."""


# RLM (Recursive LLM) errors
class RLMError(ASDLCError):
    """Base error for RLM operations."""


class BudgetExceededError(RLMError):
    """Raised when RLM sub-call budget is exhausted.

    Attributes:
        budget_limit: Maximum sub-calls allowed
        subcalls_used: Number of sub-calls already made
    """

    def __init__(
        self,
        message: str = "Sub-call budget exceeded",
        budget_limit: int = 0,
        subcalls_used: int = 0,
    ) -> None:
        super().__init__(
            message,
            details={"budget_limit": budget_limit, "subcalls_used": subcalls_used},
        )
        self.budget_limit = budget_limit
        self.subcalls_used = subcalls_used


class RLMTimeoutError(RLMError):
    """Raised when RLM exploration exceeds time limit.

    Attributes:
        timeout_seconds: Configured timeout value
        elapsed_seconds: Actual elapsed time
    """

    def __init__(
        self,
        message: str = "RLM exploration timeout",
        timeout_seconds: float = 0,
        elapsed_seconds: float = 0,
    ) -> None:
        super().__init__(
            message,
            details={"timeout_seconds": timeout_seconds, "elapsed_seconds": elapsed_seconds},
        )
        self.timeout_seconds = timeout_seconds
        self.elapsed_seconds = elapsed_seconds


class RLMToolError(RLMError):
    """Raised when an RLM tool execution fails."""


class RLMCacheError(RLMError):
    """Raised when RLM cache operations fail."""


# Repo Ingestion errors
class IngestionError(ASDLCError):
    """Error during repository ingestion.

    Attributes:
        file_path: Path to the file that caused the error (if applicable).
        cause: The underlying exception that caused this error.
    """

    def __init__(
        self,
        message: str,
        file_path: str | None = None,
        cause: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.file_path = file_path
        self.cause = cause
