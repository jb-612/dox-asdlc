"""Secrets management infrastructure.

This module provides a unified interface for storing and retrieving
encrypted credentials for LLM providers and third-party integrations.
"""

from src.infrastructure.secrets.service import SecretsService, get_secrets_service

__all__ = ["SecretsService", "get_secrets_service"]
