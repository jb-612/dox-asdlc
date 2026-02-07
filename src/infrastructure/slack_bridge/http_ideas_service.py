"""HTTP-based Ideas Service for Slack Bridge.

Calls the orchestrator's REST API to create ideas, ensuring Slack-created
ideas follow the same data path as web-created ideas and are persisted
to Elasticsearch via the orchestrator.
"""

from __future__ import annotations

import logging
import os

import aiohttp

from src.orchestrator.api.models.idea import CreateIdeaRequest, Idea

logger = logging.getLogger(__name__)


class HttpIdeasService:
    """Ideas service that calls the orchestrator REST API via HTTP.

    Replaces the old RedisIdeasService which wrote to a Redis Stream
    that nobody consumed. This service calls POST /api/brainflare/ideas
    on the orchestrator, ensuring ideas are persisted to Elasticsearch.

    Attributes:
        _base_url: Base URL of the orchestrator service.
        _session: Lazily-created aiohttp ClientSession.

    Example:
        ```python
        service = HttpIdeasService()
        idea = await service.create_idea(request)
        await service.close()
        ```
    """

    def __init__(self, base_url: str | None = None) -> None:
        """Initialize the HTTP ideas service.

        Args:
            base_url: Orchestrator base URL. If not provided, reads from
                      ORCHESTRATOR_URL env var (default: http://localhost:8080).
        """
        if base_url is not None:
            self._base_url = base_url
        else:
            self._base_url = os.environ.get(
                "ORCHESTRATOR_URL", "http://localhost:8080"
            )
        self._session: aiohttp.ClientSession | None = None

    def _get_session(self) -> aiohttp.ClientSession:
        """Get or create the aiohttp session lazily.

        Returns:
            aiohttp.ClientSession: The HTTP session.
        """
        if self._session is None:
            self._session = aiohttp.ClientSession()
        return self._session

    async def create_idea(self, request: CreateIdeaRequest) -> Idea:
        """Create an idea by calling the orchestrator REST API.

        Args:
            request: The idea creation request.

        Returns:
            The created Idea object.

        Raises:
            ValueError: If the orchestrator returns HTTP 400
                        (e.g., word count validation failure).
            Exception: If the orchestrator returns a server error (5xx)
                       or a connection error occurs.
        """
        session = self._get_session()
        url = f"{self._base_url}/api/brainflare/ideas"
        payload = request.model_dump(mode="json")

        try:
            async with session.post(url, json=payload) as response:
                body = await response.json()

                if response.status == 200:
                    logger.info(
                        f"Created idea via orchestrator API: {body.get('id', 'unknown')}"
                    )
                    return Idea(**body)

                if 400 <= response.status < 500:
                    detail = body.get("detail", "Bad request")
                    logger.warning(
                        f"Orchestrator rejected idea creation: {detail}"
                    )
                    raise ValueError(detail)

                # 5xx or other unexpected status codes
                detail = body.get("detail", "Unknown error")
                logger.error(
                    f"Orchestrator API error (HTTP {response.status}): {detail}"
                )
                raise Exception(
                    f"Orchestrator API error (HTTP {response.status}): {detail}"
                )

        except aiohttp.ClientError as e:
            logger.error(f"Failed to connect to orchestrator at {url}: {e}")
            raise Exception(
                f"Failed to connect to orchestrator at {url}: {e}"
            ) from e

    async def close(self) -> None:
        """Close the HTTP session.

        Safe to call multiple times or when no session was created.
        """
        if self._session is not None:
            await self._session.close()
            self._session = None
