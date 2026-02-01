"""Unit tests for Slack Bridge Idea Handler.

Tests the IdeaHandler class for processing Slack messages and reactions
to capture ideas for the Brainflare Hub.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import SecretStr

from src.infrastructure.slack_bridge.config import SlackBridgeConfig
from src.orchestrator.api.models.idea import Idea, IdeaStatus


class TestIdeaHandlerInitialization:
    """Tests for IdeaHandler initialization."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
            ideas_channels=["C-IDEAS-1", "C-IDEAS-2"],
            ideas_emoji="bulb",
        )

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Mock IdeasService."""
        mock = AsyncMock()
        mock.create_idea = AsyncMock(
            return_value=Idea(
                id="idea-abc123",
                content="Test idea",
                author_id="U001",
                author_name="Test User",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=2,
            )
        )
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.reactions_add = AsyncMock(return_value={"ok": True})
        mock.conversations_history = AsyncMock(
            return_value={
                "ok": True,
                "messages": [
                    {
                        "user": "U001",
                        "text": "Great feature idea here",
                        "ts": "1234567890.123456",
                        "team": "T001",
                    }
                ],
            }
        )
        mock.users_info = AsyncMock(
            return_value={"ok": True, "user": {"real_name": "Test User"}}
        )
        return mock

    def test_handler_initialization(
        self, config: SlackBridgeConfig, mock_ideas_service: AsyncMock, mock_slack: MagicMock
    ):
        """Handler initializes with correct config and ideas service."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )
        assert handler.config == config
        assert handler.ideas_service == mock_ideas_service

    def test_handler_has_ideas_channels(
        self, config: SlackBridgeConfig, mock_ideas_service: AsyncMock, mock_slack: MagicMock
    ):
        """Handler exposes configured ideas channels."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )
        assert handler.ideas_channels == ["C-IDEAS-1", "C-IDEAS-2"]

    def test_handler_has_ideas_emoji(
        self, config: SlackBridgeConfig, mock_ideas_service: AsyncMock, mock_slack: MagicMock
    ):
        """Handler exposes configured ideas emoji."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        handler = IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )
        assert handler.ideas_emoji == "bulb"


class TestHandleMessage:
    """Tests for handle_message method."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
            ideas_channels=["C-IDEAS"],
            ideas_emoji="bulb",
        )

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Mock IdeasService."""
        mock = AsyncMock()
        mock.create_idea = AsyncMock(
            return_value=Idea(
                id="idea-abc123",
                content="Test idea",
                author_id="U001",
                author_name="Test User",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=2,
            )
        )
        mock.list_ideas = AsyncMock(return_value=([], 0))
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.reactions_add = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(
            return_value={"ok": True, "user": {"real_name": "Test User"}}
        )
        return mock

    @pytest.fixture
    def handler(
        self,
        config: SlackBridgeConfig,
        mock_ideas_service: AsyncMock,
        mock_slack: MagicMock,
    ):
        """Create IdeaHandler instance."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        return IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_handle_message_in_ideas_channel(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Message in ideas channel creates idea."""
        event = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "This is a great idea for a feature",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        result = await handler.handle_message(event)

        assert result is not None
        mock_ideas_service.create_idea.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_message_outside_ideas_channel(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Message outside ideas channel is ignored."""
        event = {
            "channel": "C-GENERAL",  # Not an ideas channel
            "user": "U001",
            "text": "This is just a regular message",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        result = await handler.handle_message(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_message_adds_confirmation_reaction(
        self, handler, mock_slack: MagicMock
    ):
        """Idea capture adds confirmation reaction to message."""
        event = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "New feature idea",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        await handler.handle_message(event)

        mock_slack.reactions_add.assert_called_once_with(
            channel="C-IDEAS",
            name="white_check_mark",
            timestamp="1234567890.123456",
        )

    @pytest.mark.asyncio
    async def test_handle_message_ignores_bot_messages(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Bot messages are ignored."""
        event = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "Bot message",
            "ts": "1234567890.123456",
            "team": "T001",
            "bot_id": "B001",  # This is a bot message
        }

        result = await handler.handle_message(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_message_ignores_empty_text(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Messages with empty text are ignored."""
        event = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        result = await handler.handle_message(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()


class TestCreateIdeaFromMessage:
    """Tests for create_idea_from_message method."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
            ideas_channels=["C-IDEAS"],
            ideas_emoji="bulb",
        )

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Mock IdeasService."""
        mock = AsyncMock()
        mock.create_idea = AsyncMock(
            return_value=Idea(
                id="idea-abc123",
                content="Test idea",
                author_id="U001",
                author_name="Test User",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=2,
            )
        )
        mock.list_ideas = AsyncMock(return_value=([], 0))
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.reactions_add = AsyncMock(return_value={"ok": True})
        mock.users_info = AsyncMock(
            return_value={"ok": True, "user": {"real_name": "Test User"}}
        )
        return mock

    @pytest.fixture
    def handler(
        self,
        config: SlackBridgeConfig,
        mock_ideas_service: AsyncMock,
        mock_slack: MagicMock,
    ):
        """Create IdeaHandler instance."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        return IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_create_idea_builds_correct_source_ref(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Source ref follows slack:{team_id}:{channel_id}:{message_ts} format."""
        message = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "Feature request content",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        await handler.create_idea_from_message(message)

        call_args = mock_ideas_service.create_idea.call_args
        request = call_args[0][0]
        # The source_ref should be stored in labels with prefix for searchability
        assert "source_ref:slack:T001:C-IDEAS:1234567890.123456" in request.labels

    @pytest.mark.asyncio
    async def test_create_idea_sets_author_info(
        self, handler, mock_ideas_service: AsyncMock, mock_slack: MagicMock
    ):
        """Idea includes author_id and author_name from Slack."""
        message = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "My great idea",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        await handler.create_idea_from_message(message)

        call_args = mock_ideas_service.create_idea.call_args
        request = call_args[0][0]
        assert request.author_id == "U001"
        assert request.author_name == "Test User"

    @pytest.mark.asyncio
    async def test_create_idea_checks_for_duplicate(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Duplicate ideas (same source_ref) are not created."""
        # Return an existing idea with same source_ref
        existing_idea = Idea(
            id="idea-existing",
            content="Existing idea",
            author_id="U001",
            author_name="Test User",
            status=IdeaStatus.ACTIVE,
            labels=["source_ref:slack:T001:C-IDEAS:1234567890.123456"],
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            word_count=2,
        )
        mock_ideas_service.list_ideas = AsyncMock(return_value=([existing_idea], 1))

        message = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "Duplicate idea",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        result = await handler.create_idea_from_message(message)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_idea_handles_word_limit_validation(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Ideas exceeding 144 words are handled gracefully."""
        # Create a message with 150+ words
        long_text = " ".join(["word"] * 150)

        mock_ideas_service.create_idea = AsyncMock(
            side_effect=ValueError("Idea exceeds 144 word limit (150 words)")
        )

        message = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": long_text,
            "ts": "1234567890.123456",
            "team": "T001",
        }

        result = await handler.create_idea_from_message(message)

        # Should return None and not raise
        assert result is None

    @pytest.mark.asyncio
    async def test_create_idea_returns_created_idea(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Successfully created idea is returned."""
        message = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "Awesome feature request",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        result = await handler.create_idea_from_message(message)

        assert result is not None
        assert result.id == "idea-abc123"


class TestHandleReaction:
    """Tests for handle_reaction method (reaction-based idea capture)."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
            ideas_channels=["C-IDEAS", "C-GENERAL"],  # Include both for reaction capture
            ideas_emoji="bulb",
        )

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Mock IdeasService."""
        mock = AsyncMock()
        mock.create_idea = AsyncMock(
            return_value=Idea(
                id="idea-xyz789",
                content="Captured via reaction",
                author_id="U002",
                author_name="Original Author",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=3,
            )
        )
        mock.list_ideas = AsyncMock(return_value=([], 0))
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.reactions_add = AsyncMock(return_value={"ok": True})
        mock.conversations_history = AsyncMock(
            return_value={
                "ok": True,
                "messages": [
                    {
                        "user": "U002",  # Original message author
                        "text": "Great feature idea here",
                        "ts": "1234567890.123456",
                        "team": "T001",
                    }
                ],
            }
        )
        mock.users_info = AsyncMock(
            return_value={"ok": True, "user": {"real_name": "Original Author"}}
        )
        return mock

    @pytest.fixture
    def handler(
        self,
        config: SlackBridgeConfig,
        mock_ideas_service: AsyncMock,
        mock_slack: MagicMock,
    ):
        """Create IdeaHandler instance."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        return IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_handle_reaction_with_configured_emoji(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Reaction with configured emoji captures idea."""
        event = {
            "type": "reaction_added",
            "reaction": "bulb",  # Configured emoji
            "user": "U001",  # Reactor
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",  # Original author
        }

        result = await handler.handle_reaction(event)

        assert result is not None
        mock_ideas_service.create_idea.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_reaction_ignores_wrong_emoji(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Reaction with non-configured emoji is ignored."""
        event = {
            "type": "reaction_added",
            "reaction": "thumbsup",  # Not the configured emoji
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        result = await handler.handle_reaction(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_reaction_attributes_to_original_author(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Idea is attributed to original message author, not reactor."""
        event = {
            "type": "reaction_added",
            "reaction": "bulb",
            "user": "U001",  # Reactor
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",  # Original author
        }

        await handler.handle_reaction(event)

        call_args = mock_ideas_service.create_idea.call_args
        request = call_args[0][0]
        assert request.author_id == "U002"  # Original author, not U001

    @pytest.mark.asyncio
    async def test_handle_reaction_fetches_message_content(
        self, handler, mock_slack: MagicMock
    ):
        """Original message is fetched via Slack API."""
        event = {
            "type": "reaction_added",
            "reaction": "bulb",
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        await handler.handle_reaction(event)

        mock_slack.conversations_history.assert_called_once_with(
            channel="C-IDEAS",
            latest="1234567890.123456",
            inclusive=True,
            limit=1,
        )

    @pytest.mark.asyncio
    async def test_handle_reaction_adds_confirmation(
        self, handler, mock_slack: MagicMock
    ):
        """Confirmation reaction is added after idea capture."""
        event = {
            "type": "reaction_added",
            "reaction": "bulb",
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        await handler.handle_reaction(event)

        mock_slack.reactions_add.assert_called_once_with(
            channel="C-IDEAS",
            name="white_check_mark",
            timestamp="1234567890.123456",
        )

    @pytest.mark.asyncio
    async def test_handle_reaction_ignores_non_message_items(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Reactions on non-message items (files, etc.) are ignored."""
        event = {
            "type": "reaction_added",
            "reaction": "bulb",
            "user": "U001",
            "item": {
                "type": "file",  # Not a message
                "file": "F001",
            },
        }

        result = await handler.handle_reaction(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_reaction_prevents_duplicate_capture(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Same message cannot be captured twice via reaction."""
        existing_idea = Idea(
            id="idea-existing",
            content="Already captured",
            author_id="U002",
            author_name="Original Author",
            status=IdeaStatus.ACTIVE,
            labels=["source_ref:slack:T001:C-IDEAS:1234567890.123456"],
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            word_count=2,
        )
        mock_ideas_service.list_ideas = AsyncMock(return_value=([existing_idea], 1))

        event = {
            "type": "reaction_added",
            "reaction": "bulb",
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        result = await handler.handle_reaction(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_reaction_handles_missing_message(
        self, handler, mock_slack: MagicMock, mock_ideas_service: AsyncMock
    ):
        """Gracefully handles case where message cannot be fetched."""
        mock_slack.conversations_history = AsyncMock(
            return_value={"ok": True, "messages": []}  # No messages found
        )

        event = {
            "type": "reaction_added",
            "reaction": "bulb",
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        result = await handler.handle_reaction(event)

        assert result is None
        mock_ideas_service.create_idea.assert_not_called()


class TestIdeaHandlerIntegration:
    """Integration-like tests for IdeaHandler."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
            ideas_channels=["C-IDEAS"],
            ideas_emoji="lightbulb",  # Different emoji
        )

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Mock IdeasService."""
        mock = AsyncMock()
        mock.create_idea = AsyncMock(
            return_value=Idea(
                id="idea-test123",
                content="Test idea",
                author_id="U001",
                author_name="Test User",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=2,
            )
        )
        mock.list_ideas = AsyncMock(return_value=([], 0))
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.reactions_add = AsyncMock(return_value={"ok": True})
        mock.conversations_history = AsyncMock(
            return_value={
                "ok": True,
                "messages": [
                    {
                        "user": "U002",
                        "text": "Captured idea",
                        "ts": "1234567890.123456",
                        "team": "T001",
                    }
                ],
            }
        )
        mock.users_info = AsyncMock(
            return_value={"ok": True, "user": {"real_name": "Test User"}}
        )
        return mock

    @pytest.fixture
    def handler(
        self,
        config: SlackBridgeConfig,
        mock_ideas_service: AsyncMock,
        mock_slack: MagicMock,
    ):
        """Create IdeaHandler instance."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        return IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_custom_emoji_configuration(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Handler respects custom emoji configuration."""
        # Using 'lightbulb' not 'bulb'
        event = {
            "type": "reaction_added",
            "reaction": "lightbulb",  # Custom configured emoji
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        result = await handler.handle_reaction(event)

        assert result is not None
        mock_ideas_service.create_idea.assert_called_once()

    @pytest.mark.asyncio
    async def test_source_label_includes_slack_prefix(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Source label is prefixed with 'source_ref:' for searchability."""
        message = {
            "channel": "C-IDEAS",
            "user": "U001",
            "text": "Test idea content",
            "ts": "1234567890.123456",
            "team": "T001",
        }

        await handler.create_idea_from_message(message)

        call_args = mock_ideas_service.create_idea.call_args
        request = call_args[0][0]
        source_labels = [l for l in request.labels if l.startswith("source_ref:")]
        assert len(source_labels) == 1
        assert source_labels[0] == "source_ref:slack:T001:C-IDEAS:1234567890.123456"

    @pytest.mark.asyncio
    async def test_handles_slack_api_error_gracefully(
        self, handler, mock_slack: MagicMock
    ):
        """Slack API errors are handled without raising."""
        mock_slack.reactions_add = AsyncMock(
            side_effect=Exception("Slack API Error")
        )

        event = {
            "type": "reaction_added",
            "reaction": "lightbulb",
            "user": "U001",
            "item": {
                "type": "message",
                "channel": "C-IDEAS",
                "ts": "1234567890.123456",
            },
            "item_user": "U002",
        }

        # Should not raise, but return None
        result = await handler.handle_reaction(event)

        # Idea was created even if confirmation reaction failed
        assert result is not None


class TestCreateIdeaFromCommand:
    """Tests for create_idea_from_command method."""

    @pytest.fixture
    def config(self) -> SlackBridgeConfig:
        """Sample config for testing."""
        return SlackBridgeConfig(
            bot_token=SecretStr("xoxb-test"),
            app_token=SecretStr("xapp-test"),
            signing_secret=SecretStr("secret"),
            routing_policy={},
            rbac_map={},
            ideas_channels=["C-IDEAS"],
            ideas_emoji="bulb",
        )

    @pytest.fixture
    def mock_ideas_service(self) -> AsyncMock:
        """Mock IdeasService."""
        mock = AsyncMock()
        mock.create_idea = AsyncMock(
            return_value=Idea(
                id="idea-cmd123",
                content="Command idea",
                author_id="U001",
                author_name="Command User",
                status=IdeaStatus.ACTIVE,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                word_count=2,
            )
        )
        return mock

    @pytest.fixture
    def mock_slack(self) -> MagicMock:
        """Mock Slack WebClient."""
        mock = MagicMock()
        mock.users_info = AsyncMock(
            return_value={"ok": True, "user": {"real_name": "Command User"}}
        )
        return mock

    @pytest.fixture
    def handler(
        self,
        config: SlackBridgeConfig,
        mock_ideas_service: AsyncMock,
        mock_slack: MagicMock,
    ):
        """Create IdeaHandler instance."""
        from src.infrastructure.slack_bridge.idea_handler import IdeaHandler

        return IdeaHandler(
            ideas_service=mock_ideas_service,
            slack_client=mock_slack,
            config=config,
        )

    @pytest.mark.asyncio
    async def test_create_idea_from_command_success(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Successfully creates idea from command."""
        result = await handler.create_idea_from_command(
            user_id="U001",
            text="This is my idea from a command",
            channel_id="C-IDEAS",
        )

        assert result is not None
        assert result.id == "idea-cmd123"
        mock_ideas_service.create_idea.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_idea_from_command_sets_author_info(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Command idea includes correct author info."""
        await handler.create_idea_from_command(
            user_id="U001",
            text="My command idea",
            channel_id="C-IDEAS",
        )

        call_args = mock_ideas_service.create_idea.call_args
        request = call_args[0][0]
        assert request.author_id == "U001"
        assert request.author_name == "Command User"

    @pytest.mark.asyncio
    async def test_create_idea_from_command_builds_source_label(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Source label follows source_ref:slack:command:{channel}:{user} format."""
        await handler.create_idea_from_command(
            user_id="U001",
            text="My command idea",
            channel_id="C-IDEAS",
        )

        call_args = mock_ideas_service.create_idea.call_args
        request = call_args[0][0]
        assert "source_ref:slack:command:C-IDEAS:U001" in request.labels

    @pytest.mark.asyncio
    async def test_create_idea_from_command_handles_value_error(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """ValueError (e.g., word limit) returns None."""
        mock_ideas_service.create_idea = AsyncMock(
            side_effect=ValueError("Idea exceeds 144 word limit")
        )

        result = await handler.create_idea_from_command(
            user_id="U001",
            text="Word " * 150,  # Exceeds limit
            channel_id="C-IDEAS",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_create_idea_from_command_handles_exception(
        self, handler, mock_ideas_service: AsyncMock
    ):
        """Unexpected exceptions return None."""
        mock_ideas_service.create_idea = AsyncMock(
            side_effect=Exception("Database error")
        )

        result = await handler.create_idea_from_command(
            user_id="U001",
            text="My idea",
            channel_id="C-IDEAS",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_create_idea_from_command_gets_user_display_name(
        self, handler, mock_slack: MagicMock
    ):
        """User display name is fetched from Slack."""
        await handler.create_idea_from_command(
            user_id="U001",
            text="My idea",
            channel_id="C-IDEAS",
        )

        mock_slack.users_info.assert_called_once_with(user="U001")
