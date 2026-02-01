"""Secrets management infrastructure.

This module provides two complementary secrets management interfaces:

1. SecretsClient abstraction (client.py) - For centralized external secrets:
   - Infisical (self-hosted, for local dev)
   - GCP Secret Manager (for cloud environments)
   - Environment variables (fallback)

2. SecretsService (service.py) - For local encrypted credential storage:
   - Redis-backed encrypted storage
   - Integration credentials (Slack, GitHub, etc.)
   - Used by the Admin/LLM configuration UI
"""

from src.infrastructure.secrets.service import SecretsService, get_secrets_service
from src.infrastructure.secrets.client import (
    SecretsClient,
    EnvironmentSecretsClient,
    get_secrets_client,
    reset_secrets_client,
)

__all__ = [
    # Legacy service for Redis-backed encrypted credential storage
    "SecretsService",
    "get_secrets_service",
    # Client abstraction for external secrets management
    "SecretsClient",
    "EnvironmentSecretsClient",
    "get_secrets_client",
    "reset_secrets_client",
]
