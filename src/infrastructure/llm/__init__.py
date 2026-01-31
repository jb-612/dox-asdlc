"""LLM infrastructure components.

This package provides infrastructure for LLM integration including:
- Model discovery for vendor APIs
- Base client interface and implementations
- Client factory for role-based configuration
"""

from src.infrastructure.llm.model_discovery import ModelDiscoveryService
from src.infrastructure.llm.base_client import BaseLLMClient, LLMResponse, StreamChunk
from src.infrastructure.llm.factory import (
    LLMClientFactory,
    LLMClientError,
    get_llm_client_factory,
)

__all__ = [
    "ModelDiscoveryService",
    "BaseLLMClient",
    "LLMResponse",
    "StreamChunk",
    "LLMClientFactory",
    "LLMClientError",
    "get_llm_client_factory",
]
