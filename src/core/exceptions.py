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
