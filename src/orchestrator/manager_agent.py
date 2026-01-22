"""Manager Agent - Core orchestration component.

The Manager Agent is the exclusive commit gateway and state machine owner.
It consumes events from Redis Streams, manages task state transitions,
dispatches work to agent workers, and applies patches to the repository.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, Awaitable

from src.core.events import ASDLCEvent, EventType, HandlerResult
from src.orchestrator.git_gateway import GitGateway
from src.orchestrator.state_machine import TaskState
from src.orchestrator.task_manager import Task, TaskManager, SessionManager

logger = logging.getLogger(__name__)

# Event types handled by the Manager Agent
HANDLED_EVENT_TYPES = {
    EventType.TASK_CREATED,
    EventType.TASK_DISPATCHED,
    EventType.AGENT_COMPLETED,
    EventType.AGENT_ERROR,
    EventType.TASK_FAILED,
    EventType.GATE_APPROVED,
    EventType.GATE_REJECTED,
    EventType.PATCH_CREATED,
}

# Fail count threshold for RLM mode (from System_Design.md Section 5.2)
RLM_FAIL_THRESHOLD = 4


class ManagerAgent:
    """Core orchestration agent.

    Consumes events from Redis Streams, manages task state,
    dispatches work to workers, and applies Git changes.

    This is the only component with Git write access (via GitGateway).
    """

    def __init__(
        self,
        task_manager: TaskManager,
        session_manager: SessionManager,
        git_gateway: GitGateway,
        event_publisher: Callable[[ASDLCEvent], Awaitable[str]],
    ):
        """Initialize the Manager Agent.

        Args:
            task_manager: Manager for task state.
            session_manager: Manager for session state.
            git_gateway: Gateway for Git operations.
            event_publisher: Function to publish events to stream.
        """
        self.task_manager = task_manager
        self.session_manager = session_manager
        self.git_gateway = git_gateway
        self.event_publisher = event_publisher

    def can_handle(self, event_type: EventType) -> bool:
        """Check if this agent handles the given event type.

        Args:
            event_type: The type of event.

        Returns:
            True if this agent processes this event type.
        """
        return event_type in HANDLED_EVENT_TYPES

    async def handle(self, event: ASDLCEvent) -> HandlerResult:
        """Process an event.

        Routes the event to the appropriate handler method.

        Args:
            event: The event to process.

        Returns:
            HandlerResult indicating success/failure.
        """
        try:
            handler_method = self._get_handler(event.event_type)
            if handler_method is None:
                logger.warning(f"No handler for event type: {event.event_type}")
                return HandlerResult(success=True)  # Ack to avoid redelivery

            await handler_method(event)
            return HandlerResult(success=True)

        except Exception as e:
            logger.exception(f"Error handling event {event.event_id}: {e}")
            return HandlerResult(
                success=False,
                should_retry=True,
                error_message=str(e),
            )

    def _get_handler(
        self,
        event_type: EventType,
    ) -> Callable[[ASDLCEvent], Awaitable[None]] | None:
        """Get the handler method for an event type."""
        handlers = {
            EventType.TASK_CREATED: self._handle_task_created,
            EventType.TASK_DISPATCHED: self._handle_task_dispatched,
            EventType.AGENT_COMPLETED: self._handle_agent_completed,
            EventType.AGENT_ERROR: self._handle_agent_error,
            EventType.TASK_FAILED: self._handle_task_failed,
            EventType.GATE_APPROVED: self._handle_gate_approved,
            EventType.GATE_REJECTED: self._handle_gate_rejected,
            EventType.PATCH_CREATED: self._handle_patch_created,
        }
        return handlers.get(event_type)

    async def _handle_task_created(self, event: ASDLCEvent) -> None:
        """Handle TASK_CREATED event.

        Creates the task in Redis and optionally dispatches it.
        """
        logger.info(f"Handling TASK_CREATED: {event.task_id}")

        now = datetime.now(timezone.utc)
        task = Task(
            task_id=event.task_id or "",
            session_id=event.session_id,
            epic_id=event.epic_id or "",
            state=TaskState.PENDING,
            git_sha=event.git_sha,
            created_at=now,
            updated_at=now,
        )

        await self.task_manager.create_task(task)
        logger.info(f"Created task: {task.task_id}")

    async def _handle_task_dispatched(self, event: ASDLCEvent) -> None:
        """Handle TASK_DISPATCHED event.

        Updates task state to IN_PROGRESS.
        """
        if not event.task_id:
            return

        logger.info(f"Handling TASK_DISPATCHED: {event.task_id}")

        task = await self.task_manager.get_task(event.task_id)
        if task is None:
            logger.error(f"Task not found: {event.task_id}")
            return

        agent_type = event.metadata.get("agent_type", "unknown")
        await self.task_manager.update_state(
            event.task_id,
            TaskState.IN_PROGRESS,
            current_agent=agent_type,
        )

    async def _handle_agent_completed(self, event: ASDLCEvent) -> None:
        """Handle AGENT_COMPLETED event.

        If the agent produced a patch, apply it. Then advance state.
        """
        if not event.task_id:
            return

        logger.info(f"Handling AGENT_COMPLETED: {event.task_id}")

        task = await self.task_manager.get_task(event.task_id)
        if task is None:
            logger.error(f"Task not found: {event.task_id}")
            return

        # Check for patches to apply
        patch_paths = [
            p for p in event.artifact_paths
            if p.endswith(".patch")
        ]

        if patch_paths and self.git_gateway.is_write_allowed():
            for patch_path in patch_paths:
                try:
                    new_sha = await self.git_gateway.apply_patch(
                        patch_path,
                        f"Apply patch for task {event.task_id}",
                        event.task_id,
                    )
                    logger.info(f"Applied patch, new SHA: {new_sha}")

                    # Update session with new SHA
                    await self.session_manager.update_git_sha(
                        event.session_id, new_sha
                    )
                except Exception as e:
                    logger.error(f"Failed to apply patch: {e}")
                    await self._handle_task_failure(task, str(e))
                    return

        # Advance to TESTING state
        await self.task_manager.update_state(
            event.task_id,
            TaskState.TESTING,
        )

        # Publish event for test runner
        test_event = ASDLCEvent(
            event_type=EventType.TASK_DISPATCHED,
            session_id=event.session_id,
            task_id=event.task_id,
            timestamp=datetime.now(timezone.utc),
            metadata={"agent_type": "test-runner"},
        )
        await self.event_publisher(test_event)

    async def _handle_agent_error(self, event: ASDLCEvent) -> None:
        """Handle AGENT_ERROR event.

        Increment fail count and potentially trigger RLM or failure.
        """
        if not event.task_id:
            return

        logger.info(f"Handling AGENT_ERROR: {event.task_id}")

        task = await self.task_manager.get_task(event.task_id)
        if task is None:
            return

        await self._handle_task_failure(
            task,
            event.metadata.get("error_message", "Agent error"),
        )

    async def _handle_task_failed(self, event: ASDLCEvent) -> None:
        """Handle TASK_FAILED event.

        Increment fail count, potentially trigger debugger or mark failed.
        """
        if not event.task_id:
            return

        logger.info(f"Handling TASK_FAILED: {event.task_id}")

        task = await self.task_manager.get_task(event.task_id)
        if task is None:
            return

        await self._handle_task_failure(
            task,
            event.metadata.get("error_message", "Task failed"),
        )

    async def _handle_task_failure(self, task: Task, error_message: str) -> None:
        """Common failure handling logic.

        Increments fail count and dispatches to debugger if threshold exceeded.
        """
        fail_count = await self.task_manager.increment_fail_count(task.task_id)
        logger.warning(
            f"Task {task.task_id} failed (count: {fail_count}): {error_message}"
        )

        if fail_count > RLM_FAIL_THRESHOLD:
            # Dispatch to debugger agent in RLM mode
            logger.info(f"Task {task.task_id} exceeds fail threshold, using RLM mode")

            debug_event = ASDLCEvent(
                event_type=EventType.AGENT_STARTED,
                session_id=task.session_id,
                task_id=task.task_id,
                epic_id=task.epic_id,
                mode="rlm",
                timestamp=datetime.now(timezone.utc),
                metadata={
                    "agent_type": "debugger",
                    "fail_count": fail_count,
                    "error_message": error_message,
                },
            )
            await self.event_publisher(debug_event)

    async def _handle_gate_approved(self, event: ASDLCEvent) -> None:
        """Handle GATE_APPROVED event.

        Advance task state based on current state.
        """
        if not event.task_id:
            return

        logger.info(f"Handling GATE_APPROVED: {event.task_id}")

        task = await self.task_manager.get_task(event.task_id)
        if task is None:
            logger.error(f"Task not found: {event.task_id}")
            return

        # From BLOCKED_HITL, approval moves to COMPLETE
        if task.state == TaskState.BLOCKED_HITL:
            await self.task_manager.update_state(
                event.task_id,
                TaskState.COMPLETE,
            )
            logger.info(f"Task {event.task_id} completed")

            # Publish completion event
            complete_event = ASDLCEvent(
                event_type=EventType.TASK_COMPLETED,
                session_id=event.session_id,
                task_id=event.task_id,
                timestamp=datetime.now(timezone.utc),
            )
            await self.event_publisher(complete_event)

    async def _handle_gate_rejected(self, event: ASDLCEvent) -> None:
        """Handle GATE_REJECTED event.

        Move task back to IN_PROGRESS for retry, increment fail count.
        """
        if not event.task_id:
            return

        logger.info(f"Handling GATE_REJECTED: {event.task_id}")

        task = await self.task_manager.get_task(event.task_id)
        if task is None:
            logger.error(f"Task not found: {event.task_id}")
            return

        # Increment fail count
        fail_count = await self.task_manager.increment_fail_count(event.task_id)

        # Move back to IN_PROGRESS for retry
        await self.task_manager.update_state(
            event.task_id,
            TaskState.IN_PROGRESS,
        )

        # Get rejection feedback
        feedback = event.metadata.get("feedback", "Gate rejected")

        # Dispatch back to agent with feedback
        retry_event = ASDLCEvent(
            event_type=EventType.AGENT_STARTED,
            session_id=event.session_id,
            task_id=event.task_id,
            epic_id=task.epic_id,
            mode="rlm" if fail_count > RLM_FAIL_THRESHOLD else "normal",
            timestamp=datetime.now(timezone.utc),
            metadata={
                "agent_type": task.current_agent or "coding-agent",
                "retry": True,
                "fail_count": fail_count,
                "feedback": feedback,
            },
        )
        await self.event_publisher(retry_event)

    async def _handle_patch_created(self, event: ASDLCEvent) -> None:
        """Handle PATCH_CREATED event.

        Apply the patch if Git write is allowed.
        """
        if not event.task_id:
            return

        logger.info(f"Handling PATCH_CREATED: {event.task_id}")

        if not event.artifact_paths:
            logger.warning(f"PATCH_CREATED without artifact_paths: {event.task_id}")
            return

        patch_path = event.artifact_paths[0]

        if self.git_gateway.is_write_allowed():
            try:
                new_sha = await self.git_gateway.apply_patch(
                    patch_path,
                    f"Apply patch for task {event.task_id}",
                    event.task_id,
                )

                # Publish patch applied event
                applied_event = ASDLCEvent(
                    event_type=EventType.PATCH_APPLIED,
                    session_id=event.session_id,
                    task_id=event.task_id,
                    git_sha=new_sha,
                    timestamp=datetime.now(timezone.utc),
                )
                await self.event_publisher(applied_event)

            except Exception as e:
                logger.error(f"Failed to apply patch: {e}")

                rejected_event = ASDLCEvent(
                    event_type=EventType.PATCH_REJECTED,
                    session_id=event.session_id,
                    task_id=event.task_id,
                    timestamp=datetime.now(timezone.utc),
                    metadata={"error": str(e)},
                )
                await self.event_publisher(rejected_event)

    async def dispatch_to_worker(
        self,
        task: Task,
        agent_type: str,
        mode: str = "normal",
    ) -> None:
        """Dispatch a task to a worker agent.

        Args:
            task: The task to dispatch.
            agent_type: Type of agent to handle the task.
            mode: Execution mode ("normal" or "rlm").
        """
        logger.info(f"Dispatching task {task.task_id} to {agent_type}")

        # Update task state to IN_PROGRESS
        await self.task_manager.update_state(
            task.task_id,
            TaskState.IN_PROGRESS,
            current_agent=agent_type,
        )

        # Publish AGENT_STARTED event
        event = ASDLCEvent(
            event_type=EventType.AGENT_STARTED,
            session_id=task.session_id,
            task_id=task.task_id,
            epic_id=task.epic_id,
            git_sha=task.git_sha,
            mode=mode,
            timestamp=datetime.now(timezone.utc),
            metadata={
                "agent_type": agent_type,
                "context_pack": f"/context/packs/{task.task_id}.json",
            },
        )
        await self.event_publisher(event)

        logger.info(f"Dispatched task {task.task_id} to {agent_type}")
