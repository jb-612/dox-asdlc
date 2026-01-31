"""LLM Streaming API routes.

This module provides Server-Sent Events (SSE) streaming endpoint for
real-time LLM responses, enabling token-by-token display in the UI.

Endpoints:
- POST /api/llm/stream - Stream LLM response using SSE
"""

from __future__ import annotations

import json
import logging
from typing import Annotated, Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.infrastructure.llm.base_client import StreamChunk
from src.infrastructure.llm.factory import (
    LLMClientError,
    LLMClientFactory,
    get_llm_client_factory,
)


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/llm", tags=["llm-streaming"])


# =============================================================================
# Request/Response Models
# =============================================================================


class StreamRequest(BaseModel):
    """Request model for streaming LLM responses.

    Attributes:
        role: Agent role to use for configuration (e.g., 'discovery', 'design').
        prompt: The user prompt to send to the LLM.
        system_prompt: Optional system prompt to set context.
    """

    role: str = Field(description="Agent role to use for LLM configuration")
    prompt: str = Field(description="The prompt to send to the LLM")
    system_prompt: str | None = Field(
        default=None, description="Optional system prompt for context"
    )


# =============================================================================
# Helper Functions
# =============================================================================


def format_sse_event(
    token: str,
    done: bool,
    total_tokens: int | None = None,
) -> str:
    """Format an SSE event.

    Args:
        token: The text token.
        done: Whether this is the final event.
        total_tokens: Total tokens used (only in final event).

    Returns:
        str: Formatted SSE event string.
    """
    data: dict[str, Any] = {"token": token, "done": done}
    if total_tokens is not None:
        data["total_tokens"] = total_tokens

    # Use standard JSON format with spaces after separators for readability
    return f"data: {json.dumps(data, separators=(', ', ': '))}\n\n"


async def stream_generator(
    factory: LLMClientFactory,
    role: str,
    prompt: str,
    system_prompt: str | None,
) -> AsyncIterator[str]:
    """Generate SSE events from LLM stream.

    Args:
        factory: LLM client factory.
        role: Agent role for configuration.
        prompt: User prompt.
        system_prompt: Optional system prompt.

    Yields:
        str: SSE formatted events.
    """
    client = await factory.get_client(role)

    total_tokens = 0
    async for chunk in client.generate_stream(prompt=prompt, system=system_prompt):
        if chunk.is_final:
            # Extract total tokens from usage
            if chunk.usage:
                total_tokens = chunk.usage.get("input_tokens", 0) + chunk.usage.get(
                    "output_tokens", 0
                )
            yield format_sse_event(token="", done=True, total_tokens=total_tokens)
        else:
            yield format_sse_event(token=chunk.content, done=False)


# =============================================================================
# Streaming Endpoint
# =============================================================================


@router.post("/stream")
async def stream_llm_response(
    request: StreamRequest,
    factory: Annotated[LLMClientFactory, Depends(get_llm_client_factory)],
) -> StreamingResponse:
    """Stream LLM response token by token using SSE.

    This endpoint streams the LLM response as Server-Sent Events,
    allowing the frontend to display tokens as they arrive.

    Args:
        request: Stream request with role, prompt, and optional system prompt.
        factory: LLM client factory (injected).

    Returns:
        StreamingResponse: SSE stream of tokens.

    Raises:
        HTTPException: 400 if role is invalid, 500 for other errors.
    """
    try:
        # Validate that we can get a client before starting the stream
        # This catches role validation errors early
        await factory.get_client(request.role)
    except LLMClientError as e:
        logger.warning(f"Invalid role or configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error(f"Failed to get LLM client: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize LLM client: error occurred",
        ) from e

    return StreamingResponse(
        stream_generator(
            factory=factory,
            role=request.role,
            prompt=request.prompt,
            system_prompt=request.system_prompt,
        ),
        media_type="text/event-stream",
    )
