"""Worker pool for concurrent agent execution.

Manages the lifecycle of agent workers, consuming events from Redis Streams
and dispatching them to appropriate agents.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from enum import Enum
from typing import Any

import redis.asyncio as redis

from src.core.events import ASDLCEvent, EventType
from src.workers.agents.dispatcher import AgentDispatcher, AgentNotFoundError
from src.workers.agents.protocols import AgentContext, AgentResult
from src.workers.config import WorkerConfig
from src.workers.pool.event_consumer import EventConsumer
from src.workers.pool.idempotency import WorkerIdempotencyTracker

logger = logging.getLogger(__name__)


class WorkerPoolState(Enum):
    """State of the worker pool."""

    STOPPED = "stopped"
    RUNNING = "running"
    SHUTTING_DOWN = "shutting_down"


class WorkerPool:
    """Manages concurrent agent execution.

    The worker pool:
    - Consumes AGENT_STARTED events from Redis Streams
    - Dispatches events to registered agents via the dispatcher
    - Manages concurrency with a semaphore
    - Publishes AGENT_COMPLETED or AGENT_ERROR events
    - Handles graceful shutdown

    Example:
        pool = WorkerPool(
            redis_client=redis_client,
            config=worker_config,
            dispatcher=agent_dispatcher,
            workspace_path="/app/workspace",
        )

        await pool.start()  # Runs until stopped
        # ...
        await pool.stop()  # Graceful shutdown
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        config: WorkerConfig,
        dispatcher: AgentDispatcher,
        workspace_path: str,
        tenant_id: str | None = None,
    ) -> None:
        """Initialize the worker pool.

        Args:
            redis_client: Redis async client.
            config: Worker pool configuration.
            dispatcher: Agent dispatcher for routing events.
            workspace_path: Path to the workspace directory.
            tenant_id: Optional tenant ID for multi-tenancy.
        """
        self._redis = redis_client
        self._config = config
        self._dispatcher = dispatcher
        self._workspace_path = workspace_path
        self._tenant_id = tenant_id

        # Components
        self._consumer = EventConsumer(
            client=redis_client,
            config=config,
            tenant_id=tenant_id,
        )
        self._idempotency = WorkerIdempotencyTracker(
            client=redis_client,
            tenant_id=tenant_id,
        )

        # State
        self._state = WorkerPoolState.STOPPED
        self._semaphore = asyncio.Semaphore(config.pool_size)
        self._active_tasks: set[asyncio.Task] = set()
        self._shutdown_event = asyncio.Event()

        # Metrics
        self._events_processed = 0
        self._events_succeeded = 0
        self._events_failed = 0

    @property
    def state(self) -> WorkerPoolState:
        """Return the current pool state."""
        return self._state

    @property
    def concurrency_limit(self) -> int:
        """Return the concurrency limit."""
        return self._config.pool_size

    def get_stats(self) -> dict[str, Any]:
        """Return pool statistics.

        Returns:
            dict: Statistics including state, counts, and active workers.
        """
        return {
            "state": self._state.value,
            "events_processed": self._events_processed,
            "events_succeeded": self._events_succeeded,
            "events_failed": self._events_failed,
            "active_workers": len(self._active_tasks),
            "concurrency_limit": self._config.pool_size,
        }

    async def start(self) -> None:
        """Start the worker pool.

        Begins consuming events from Redis Streams and processing them.
        Runs until stop() is called.
        """
        if self._state == WorkerPoolState.RUNNING:
            logger.warning("Worker pool already running")
            return

        self._state = WorkerPoolState.RUNNING
        self._shutdown_event.clear()
        logger.info(
            f"Worker pool started (pool_size={self._config.pool_size}, "
            f"consumer_group={self._config.consumer_group})"
        )

        try:
            await self._run_event_loop()
        finally:
            self._state = WorkerPoolState.STOPPED
            logger.info("Worker pool stopped")

    async def stop(self) -> None:
        """Stop the worker pool gracefully.

        Signals the pool to stop processing new events and waits
        for in-progress work to complete.
        """
        if self._state != WorkerPoolState.RUNNING:
            return

        self._state = WorkerPoolState.SHUTTING_DOWN
        self._shutdown_event.set()
        logger.info("Worker pool shutting down...")

        # Wait for active tasks to complete
        if self._active_tasks:
            logger.info(f"Waiting for {len(self._active_tasks)} active tasks...")
            try:
                await asyncio.wait_for(
                    asyncio.gather(*self._active_tasks, return_exceptions=True),
                    timeout=self._config.shutdown_timeout_seconds,
                )
            except TimeoutError:
                logger.warning("Shutdown timeout, cancelling remaining tasks")
                for task in self._active_tasks:
                    task.cancel()

    async def _run_event_loop(self) -> None:
        """Main event processing loop."""
        while self._state == WorkerPoolState.RUNNING:
            try:
                # Check if shutdown was requested
                if self._shutdown_event.is_set():
                    break

                # Read batch of events
                events = await self._consumer.read_events(block_ms=1000)

                # Yield control to allow other tasks to run
                # This is important when mocking returns immediately
                await asyncio.sleep(0)

                for event in events:
                    if self._state != WorkerPoolState.RUNNING:
                        break

                    # Process event with concurrency control
                    await self._semaphore.acquire()
                    task = asyncio.create_task(self._process_event(event))
                    self._active_tasks.add(task)
                    task.add_done_callback(self._task_done)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in event loop: {e}")
                await asyncio.sleep(1)  # Back off on error

    def _task_done(self, task: asyncio.Task) -> None:
        """Callback when a task completes."""
        self._active_tasks.discard(task)
        self._semaphore.release()

    async def _process_event(self, event: ASDLCEvent) -> None:
        """Process a single event.

        Args:
            event: The AGENT_STARTED event to process.
        """
        logger.info(f"Processing event: {event.event_id} (task: {event.task_id})")

        try:
            # Check idempotency
            is_new = await self._idempotency.check_and_mark_if_new(event)
            if not is_new:
                logger.info(f"Skipping duplicate event: {event.event_id}")
                await self._consumer.acknowledge(event.event_id)
                return

            # Build context
            context = AgentContext(
                session_id=event.session_id,
                task_id=event.task_id or "unknown",
                tenant_id=self._tenant_id or event.tenant_id or "default",
                workspace_path=self._workspace_path,
                metadata={
                    "git_sha": event.git_sha,
                    "epic_id": event.epic_id,
                    "mode": event.mode,
                },
            )

            # Dispatch to agent
            result = await self._dispatcher.dispatch(event, context)

            # Update metrics
            self._events_processed += 1
            if result.success:
                self._events_succeeded += 1
            else:
                self._events_failed += 1

            # Publish result event
            await self._publish_result(event, result)

            # Acknowledge the original event
            await self._consumer.acknowledge(event.event_id)

        except AgentNotFoundError as e:
            logger.error(f"Agent not found for event {event.event_id}: {e}")
            self._events_processed += 1
            self._events_failed += 1
            await self._publish_error(event, str(e))
            await self._consumer.acknowledge(event.event_id)

        except Exception as e:
            logger.exception(f"Error processing event {event.event_id}: {e}")
            self._events_processed += 1
            self._events_failed += 1
            await self._publish_error(event, str(e))
            await self._consumer.acknowledge(event.event_id)

    async def _publish_result(
        self,
        original_event: ASDLCEvent,
        result: AgentResult,
    ) -> None:
        """Publish the result of agent execution.

        Args:
            original_event: The original AGENT_STARTED event.
            result: The agent execution result.
        """
        if result.success:
            event_type = EventType.AGENT_COMPLETED
        else:
            event_type = EventType.AGENT_ERROR

        result_event = ASDLCEvent(
            event_type=event_type,
            session_id=original_event.session_id,
            task_id=original_event.task_id,
            epic_id=original_event.epic_id,
            git_sha=original_event.git_sha,
            artifact_paths=result.artifact_paths,
            mode=original_event.mode,
            tenant_id=original_event.tenant_id,
            timestamp=datetime.now(UTC),
            metadata={
                "agent_type": result.agent_type,
                "success": result.success,
                "error_message": result.error_message,
                "should_retry": result.should_retry,
                **result.metadata,
            },
        )

        await self._publish_event(result_event)

    async def _publish_error(
        self,
        original_event: ASDLCEvent,
        error_message: str,
    ) -> None:
        """Publish an error event.

        Args:
            original_event: The original AGENT_STARTED event.
            error_message: The error message.
        """
        error_event = ASDLCEvent(
            event_type=EventType.AGENT_ERROR,
            session_id=original_event.session_id,
            task_id=original_event.task_id,
            epic_id=original_event.epic_id,
            git_sha=original_event.git_sha,
            mode=original_event.mode,
            tenant_id=original_event.tenant_id,
            timestamp=datetime.now(UTC),
            metadata={
                "agent_type": original_event.metadata.get("agent_type", "unknown"),
                "success": False,
                "error_message": error_message,
                "should_retry": False,
            },
        )

        await self._publish_event(error_event)

    async def _publish_event(self, event: ASDLCEvent) -> str:
        """Publish an event to the stream.

        Args:
            event: The event to publish.

        Returns:
            str: The event ID assigned by Redis.
        """
        stream_name = self._consumer.stream_name
        event_data = event.to_stream_dict()

        event_id = await self._redis.xadd(stream_name, event_data, maxlen=10000)
        logger.debug(f"Published event {event_id}: {event.event_type.value}")
        return event_id
