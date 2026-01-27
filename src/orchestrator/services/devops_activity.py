"""DevOps activity service for tracking operations via coordination messages.

This service reads coordination messages (DEVOPS_STARTED, DEVOPS_STEP_UPDATE,
DEVOPS_COMPLETE, DEVOPS_FAILED) to build a view of current and recent
DevOps activities.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from src.core.exceptions import CoordinationError
from src.infrastructure.coordination.client import CoordinationClient
from src.infrastructure.coordination.config import get_coordination_config
from src.infrastructure.coordination.types import (
    CoordinationMessage,
    MessageQuery,
    MessageType,
)
from src.orchestrator.api.models.devops_activity import (
    DevOpsActivity,
    DevOpsActivityResponse,
    DevOpsActivityStatus,
    DevOpsStep,
    DevOpsStepStatus,
)


logger = logging.getLogger(__name__)


# DevOps message types we care about
DEVOPS_MESSAGE_TYPES = {
    MessageType.DEVOPS_STARTED,
    MessageType.DEVOPS_STEP_UPDATE,
    MessageType.DEVOPS_COMPLETE,
    MessageType.DEVOPS_FAILED,
}


class DevOpsActivityService:
    """Service for tracking DevOps activities via coordination messages.

    This service queries the coordination system for DevOps-related messages
    and builds activity objects from them. It handles:

    - DEVOPS_STARTED: Creates new activity with initial steps
    - DEVOPS_STEP_UPDATE: Updates step status within an activity
    - DEVOPS_COMPLETE: Marks activity as completed
    - DEVOPS_FAILED: Marks activity as failed with error

    Usage:
        service = DevOpsActivityService()
        response = await service.get_activity()
        if response.current:
            print(f"Current operation: {response.current.operation}")
    """

    def __init__(self) -> None:
        """Initialize the DevOps activity service."""
        self._client: CoordinationClient | None = None
        self._redis: redis.Redis | None = None

    async def _get_client(self) -> CoordinationClient:
        """Get or create the coordination client.

        Returns:
            CoordinationClient instance
        """
        if self._client is None:
            config = get_coordination_config()
            self._redis = redis.from_url(config.redis_url)
            self._client = CoordinationClient(self._redis, config)
        return self._client

    async def get_activity(self, limit: int = 10) -> DevOpsActivityResponse:
        """Get current and recent DevOps activities.

        Queries coordination messages to build the activity response.

        Args:
            limit: Maximum number of recent activities to return.

        Returns:
            DevOpsActivityResponse with current and recent activities.
        """
        try:
            client = await self._get_client()

            # Get recent messages (fetch more than limit to filter)
            messages = await client.get_messages(
                MessageQuery(limit=limit * 10)
            )

            # Filter to DevOps-related messages
            devops_messages = [
                msg for msg in messages if msg.type in DEVOPS_MESSAGE_TYPES
            ]

            # Build activities from messages
            activities = self._build_activities(devops_messages)

            # Separate current (in-progress) from recent (completed/failed)
            current = None
            recent = []

            for activity in activities.values():
                if activity.status == DevOpsActivityStatus.IN_PROGRESS:
                    # Take the most recent in-progress as current
                    if current is None or activity.started_at > current.started_at:
                        current = activity
                else:
                    recent.append(activity)

            # Sort recent by start time descending
            recent.sort(key=lambda a: a.started_at, reverse=True)

            # Apply limit
            recent = recent[:limit]

            return DevOpsActivityResponse(current=current, recent=recent)

        except CoordinationError as e:
            logger.warning(f"Coordination unavailable: {e}")
            return DevOpsActivityResponse(current=None, recent=[])
        except Exception as e:
            logger.error(f"Error getting DevOps activity: {e}")
            return DevOpsActivityResponse(current=None, recent=[])

    async def get_current_activity(self) -> DevOpsActivity | None:
        """Get the current in-progress DevOps activity.

        Returns:
            The current activity if one is in progress, None otherwise.
        """
        response = await self.get_activity(limit=1)
        return response.current

    async def get_recent_activities(self, limit: int = 10) -> list[DevOpsActivity]:
        """Get recent completed or failed DevOps activities.

        Args:
            limit: Maximum number of activities to return.

        Returns:
            List of recent activities, sorted by start time descending.
        """
        response = await self.get_activity(limit=limit)
        return response.recent

    def _build_activities(
        self, messages: list[CoordinationMessage]
    ) -> dict[str, DevOpsActivity]:
        """Build activity objects from coordination messages.

        Args:
            messages: List of DevOps coordination messages.

        Returns:
            Dictionary mapping activity ID to DevOpsActivity.
        """
        activities: dict[str, DevOpsActivity] = {}
        step_updates: dict[str, list[tuple[str, DevOpsStepStatus, datetime]]] = {}

        # Sort messages by timestamp to process in order
        sorted_messages = sorted(messages, key=lambda m: m.timestamp)

        for msg in sorted_messages:
            try:
                payload_data = self._parse_description(msg.payload.description)
                if not payload_data:
                    continue

                activity_id = payload_data.get("activity_id")
                if not activity_id:
                    continue

                if msg.type == MessageType.DEVOPS_STARTED:
                    activities[activity_id] = self._create_activity_from_started(
                        activity_id, payload_data, msg.timestamp
                    )
                    step_updates[activity_id] = []

                elif msg.type == MessageType.DEVOPS_STEP_UPDATE:
                    step_name = payload_data.get("step")
                    step_status = payload_data.get("status", "running")
                    if step_name and activity_id in step_updates:
                        step_updates[activity_id].append(
                            (step_name, self._parse_step_status(step_status), msg.timestamp)
                        )

                elif msg.type == MessageType.DEVOPS_COMPLETE:
                    if activity_id in activities:
                        activities[activity_id] = self._complete_activity(
                            activities[activity_id], msg.timestamp
                        )

                elif msg.type == MessageType.DEVOPS_FAILED:
                    if activity_id in activities:
                        error = payload_data.get("error")
                        activities[activity_id] = self._fail_activity(
                            activities[activity_id], msg.timestamp, error
                        )

            except Exception as e:
                logger.warning(f"Error processing message {msg.id}: {e}")
                continue

        # Apply step updates to activities
        for activity_id, updates in step_updates.items():
            if activity_id in activities:
                activities[activity_id] = self._apply_step_updates(
                    activities[activity_id], updates
                )

        return activities

    def _parse_description(self, description: str) -> dict[str, Any] | None:
        """Parse JSON from message description.

        Args:
            description: Message description (may be JSON).

        Returns:
            Parsed dictionary or None if parsing fails.
        """
        try:
            return json.loads(description)
        except json.JSONDecodeError:
            logger.debug(f"Could not parse description as JSON: {description[:100]}")
            return None

    def _create_activity_from_started(
        self,
        activity_id: str,
        payload: dict[str, Any],
        timestamp: datetime,
    ) -> DevOpsActivity:
        """Create a new activity from a DEVOPS_STARTED message.

        Args:
            activity_id: Unique activity identifier.
            payload: Parsed message payload.
            timestamp: Message timestamp.

        Returns:
            New DevOpsActivity in IN_PROGRESS status.
        """
        operation = payload.get("operation", "Unknown operation")
        step_names = payload.get("steps", [])

        steps = [
            DevOpsStep(name=name, status=DevOpsStepStatus.PENDING)
            for name in step_names
        ]

        return DevOpsActivity(
            id=activity_id,
            operation=operation,
            status=DevOpsActivityStatus.IN_PROGRESS,
            started_at=timestamp,
            completed_at=None,
            steps=steps,
        )

    def _parse_step_status(self, status_str: str) -> DevOpsStepStatus:
        """Parse step status from string.

        Args:
            status_str: Status string from message.

        Returns:
            DevOpsStepStatus enum value.
        """
        status_map = {
            "pending": DevOpsStepStatus.PENDING,
            "running": DevOpsStepStatus.RUNNING,
            "completed": DevOpsStepStatus.COMPLETED,
            "failed": DevOpsStepStatus.FAILED,
        }
        return status_map.get(status_str.lower(), DevOpsStepStatus.PENDING)

    def _apply_step_updates(
        self,
        activity: DevOpsActivity,
        updates: list[tuple[str, DevOpsStepStatus, datetime]],
    ) -> DevOpsActivity:
        """Apply step updates to an activity.

        Args:
            activity: Activity to update.
            updates: List of (step_name, status, timestamp) tuples.

        Returns:
            Updated activity with step statuses applied.
        """
        # Build a map of step names to latest status
        step_statuses: dict[str, tuple[DevOpsStepStatus, datetime]] = {}
        for step_name, status, timestamp in updates:
            if step_name not in step_statuses or timestamp > step_statuses[step_name][1]:
                step_statuses[step_name] = (status, timestamp)

        # Update steps with new statuses
        updated_steps = []
        for step in activity.steps:
            if step.name in step_statuses:
                new_status, update_time = step_statuses[step.name]
                completed_at = update_time if new_status in (
                    DevOpsStepStatus.COMPLETED, DevOpsStepStatus.FAILED
                ) else None
                started_at = step.started_at or (
                    update_time if new_status != DevOpsStepStatus.PENDING else None
                )
                updated_steps.append(DevOpsStep(
                    name=step.name,
                    status=new_status,
                    started_at=started_at,
                    completed_at=completed_at,
                    error=step.error,
                ))
            else:
                updated_steps.append(step)

        return DevOpsActivity(
            id=activity.id,
            operation=activity.operation,
            status=activity.status,
            started_at=activity.started_at,
            completed_at=activity.completed_at,
            steps=updated_steps,
        )

    def _complete_activity(
        self, activity: DevOpsActivity, timestamp: datetime
    ) -> DevOpsActivity:
        """Mark an activity as completed.

        Args:
            activity: Activity to complete.
            timestamp: Completion timestamp.

        Returns:
            Activity with COMPLETED status.
        """
        # Mark all pending steps as completed
        completed_steps = [
            DevOpsStep(
                name=step.name,
                status=DevOpsStepStatus.COMPLETED if step.status == DevOpsStepStatus.PENDING else step.status,
                started_at=step.started_at,
                completed_at=timestamp if step.status == DevOpsStepStatus.PENDING else step.completed_at,
                error=step.error,
            )
            for step in activity.steps
        ]

        return DevOpsActivity(
            id=activity.id,
            operation=activity.operation,
            status=DevOpsActivityStatus.COMPLETED,
            started_at=activity.started_at,
            completed_at=timestamp,
            steps=completed_steps,
        )

    def _fail_activity(
        self, activity: DevOpsActivity, timestamp: datetime, error: str | None
    ) -> DevOpsActivity:
        """Mark an activity as failed.

        Args:
            activity: Activity to fail.
            timestamp: Failure timestamp.
            error: Error message.

        Returns:
            Activity with FAILED status.
        """
        # Find the currently running step (if any) and mark it failed
        failed_steps = []
        for step in activity.steps:
            if step.status == DevOpsStepStatus.RUNNING:
                failed_steps.append(DevOpsStep(
                    name=step.name,
                    status=DevOpsStepStatus.FAILED,
                    started_at=step.started_at,
                    completed_at=timestamp,
                    error=error,
                ))
            else:
                failed_steps.append(step)

        return DevOpsActivity(
            id=activity.id,
            operation=activity.operation,
            status=DevOpsActivityStatus.FAILED,
            started_at=activity.started_at,
            completed_at=timestamp,
            steps=failed_steps,
        )

    async def close(self) -> None:
        """Close the service and release resources."""
        if self._redis:
            await self._redis.close()
            self._redis = None
        self._client = None
