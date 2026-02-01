"""Idea Handler for Slack HITL Bridge.

Handles capturing ideas from Slack messages and reactions
for the Brainflare Hub ideas repository.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from src.infrastructure.slack_bridge.config import SlackBridgeConfig
from src.orchestrator.api.models.idea import CreateIdeaRequest, Idea

if TYPE_CHECKING:
    from src.orchestrator.services.ideas_service import IdeasService

logger = logging.getLogger(__name__)


class IdeaHandler:
    """Handler for capturing ideas from Slack messages and reactions.

    Monitors configured Slack channels for new messages and specific emoji
    reactions to capture ideas and forward them to the Brainflare Hub.

    Attributes:
        ideas_service: Service for creating/managing ideas.
        slack_client: Slack WebClient for API calls.
        config: SlackBridgeConfig with channel and emoji settings.

    Example:
        ```python
        handler = IdeaHandler(
            ideas_service=ideas_service,
            slack_client=slack_client,
            config=config,
        )

        # Handle message in ideas channel
        await handler.handle_message(event)

        # Handle emoji reaction for idea capture
        await handler.handle_reaction(event)
        ```
    """

    def __init__(
        self,
        ideas_service: IdeasService,
        slack_client: Any,
        config: SlackBridgeConfig,
    ) -> None:
        """Initialize the IdeaHandler.

        Args:
            ideas_service: Service for creating/managing ideas.
            slack_client: Slack WebClient for API calls.
            config: SlackBridgeConfig with channel and emoji settings.
        """
        self.ideas_service = ideas_service
        self.slack_client = slack_client
        self.config = config

    @property
    def ideas_channels(self) -> list[str]:
        """Get configured ideas channels.

        Returns:
            List of Slack channel IDs to monitor for ideas.
        """
        return self.config.ideas_channels

    @property
    def ideas_emoji(self) -> str:
        """Get configured ideas emoji.

        Returns:
            Emoji name (without colons) for idea capture reactions.
        """
        return self.config.ideas_emoji

    async def handle_message(self, event: dict) -> Idea | None:
        """Process a message event from an ideas channel.

        Creates an idea from the message if it's in a configured
        ideas channel and not from a bot.

        Args:
            event: Slack message event containing:
                - channel: Channel ID
                - user: User ID who posted
                - text: Message content
                - ts: Message timestamp
                - team: Workspace team ID

        Returns:
            Idea | None: The created idea, or None if not applicable.
        """
        channel = event.get("channel", "")
        user = event.get("user", "")
        text = event.get("text", "")
        ts = event.get("ts", "")
        bot_id = event.get("bot_id")

        # Filter: Only process messages in configured ideas channels
        if channel not in self.ideas_channels:
            logger.debug(f"Ignoring message in non-ideas channel: {channel}")
            return None

        # Filter: Ignore bot messages
        if bot_id:
            logger.debug(f"Ignoring bot message from {bot_id}")
            return None

        # Filter: Ignore empty messages
        if not text or not text.strip():
            logger.debug("Ignoring empty message")
            return None

        # Create idea from message
        idea = await self.create_idea_from_message(event)

        if idea:
            # Add confirmation reaction
            await self._add_confirmation_reaction(channel, ts)

        return idea

    async def handle_reaction(self, event: dict) -> Idea | None:
        """Process an emoji reaction event for idea capture.

        Captures an idea when a user adds the configured emoji
        reaction to a message.

        Args:
            event: Slack reaction_added event containing:
                - reaction: Emoji name (without colons)
                - user: User ID who reacted
                - item: Contains type, channel, ts
                - item_user: User ID of original message author

        Returns:
            Idea | None: The created idea, or None if not applicable.
        """
        reaction = event.get("reaction", "")
        item = event.get("item", {})
        item_type = item.get("type", "")
        channel = item.get("channel", "")
        ts = item.get("ts", "")

        # Filter: Only process message reactions
        if item_type != "message":
            logger.debug(f"Ignoring reaction on non-message item: {item_type}")
            return None

        # Filter: Only process configured emoji
        if reaction != self.ideas_emoji:
            logger.debug(f"Ignoring non-ideas emoji: {reaction}")
            return None

        # Fetch the original message
        message = await self._fetch_message(channel, ts)
        if not message:
            logger.warning(f"Could not fetch message for reaction: {channel}/{ts}")
            return None

        # Add team info from the fetched message or use a default
        team = message.get("team", "unknown")

        # Build the message event for idea creation
        message_event = {
            "channel": channel,
            "user": message.get("user", ""),
            "text": message.get("text", ""),
            "ts": ts,
            "team": team,
        }

        # Create idea from the original message
        idea = await self.create_idea_from_message(message_event)

        if idea:
            # Add confirmation reaction
            try:
                await self._add_confirmation_reaction(channel, ts)
            except Exception as e:
                # Log but don't fail - idea was still created
                logger.warning(f"Failed to add confirmation reaction: {e}")

        return idea

    async def create_idea_from_message(self, message: dict) -> Idea | None:
        """Create an idea from a Slack message.

        Builds a source_ref for deduplication and creates the idea
        via the IdeasService.

        Args:
            message: Message data containing:
                - channel: Channel ID
                - user: User ID
                - text: Message content
                - ts: Message timestamp
                - team: Workspace team ID

        Returns:
            Idea | None: The created idea, or None if duplicate/invalid.
        """
        channel = message.get("channel", "")
        user = message.get("user", "")
        text = message.get("text", "")
        ts = message.get("ts", "")
        team = message.get("team", "unknown")

        # Build source_ref for deduplication
        source_ref = f"slack:{team}:{channel}:{ts}"

        # Check for duplicate via source_ref label
        source_label = f"source_ref:{source_ref}"
        try:
            existing, total = await self.ideas_service.list_ideas(search=source_ref)
            # Check if any existing idea has this exact source_ref
            for idea in existing:
                if source_label in idea.labels:
                    logger.info(f"Duplicate idea skipped: {source_ref}")
                    return None
        except Exception as e:
            logger.warning(f"Error checking for duplicate: {e}")
            # Continue with creation attempt

        # Get user display name
        author_name = await self._get_user_name(user)

        # Create the idea request
        request = CreateIdeaRequest(
            content=text,
            author_id=user,
            author_name=author_name,
            labels=[source_label],
        )

        try:
            idea = await self.ideas_service.create_idea(request)
            logger.info(f"Created idea {idea.id} from Slack message: {source_ref}")
            return idea
        except ValueError as e:
            # Handle word limit or validation errors
            logger.warning(f"Failed to create idea from Slack message: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating idea: {e}")
            return None

    async def _fetch_message(self, channel: str, ts: str) -> dict | None:
        """Fetch a message from Slack by channel and timestamp.

        Args:
            channel: Slack channel ID.
            ts: Message timestamp.

        Returns:
            dict | None: The message data, or None if not found.
        """
        try:
            result = await self.slack_client.conversations_history(
                channel=channel,
                latest=ts,
                inclusive=True,
                limit=1,
            )

            if result.get("ok") and result.get("messages"):
                return result["messages"][0]

            return None
        except Exception as e:
            logger.error(f"Error fetching message from Slack: {e}")
            return None

    async def _get_user_name(self, user_id: str) -> str:
        """Get display name for a Slack user.

        Args:
            user_id: Slack user ID.

        Returns:
            str: User's display name, or user_id if lookup fails.
        """
        try:
            result = await self.slack_client.users_info(user=user_id)
            if result.get("ok"):
                return result.get("user", {}).get("real_name", user_id)
            return user_id
        except Exception as e:
            logger.warning(f"Failed to get user info for {user_id}: {e}")
            return user_id

    async def _add_confirmation_reaction(self, channel: str, ts: str) -> None:
        """Add confirmation reaction to indicate idea was captured.

        Args:
            channel: Slack channel ID.
            ts: Message timestamp.
        """
        try:
            await self.slack_client.reactions_add(
                channel=channel,
                name="white_check_mark",
                timestamp=ts,
            )
        except Exception as e:
            logger.warning(f"Failed to add confirmation reaction: {e}")
