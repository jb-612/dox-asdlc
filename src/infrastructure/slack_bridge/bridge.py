"""Main Slack Bridge application module.

Provides the SlackBridge class which serves as the main entry point
for the Slack HITL Bridge. Uses Slack Bolt with Socket Mode for
secure, outbound-only connections.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
from datetime import datetime, timezone
from typing import Any, Callable

import redis.asyncio as redis
from aiohttp import web
from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler

from src.infrastructure.slack_bridge.config import ChannelConfig, SlackBridgeConfig
from src.infrastructure.slack_bridge.decision_handler import (
    DecisionHandler,
    GateAlreadyDecidedException,
    GateNotFoundException,
    RBACDeniedException,
)
from src.infrastructure.slack_bridge.gate_consumer import GateConsumer
from src.infrastructure.slack_bridge.policy import RoutingPolicy

logger = logging.getLogger(__name__)

# Version for startup logging
__version__ = "1.0.0"


class StartupValidationError(Exception):
    """Raised when startup validation fails."""

    pass


class SlackBridge:
    """Main Slack HITL Bridge application.

    Coordinates gate notifications (OUT direction) and decision capture
    (IN direction) between the aSDLC system and Slack.

    Uses Slack Bolt AsyncApp with Socket Mode for:
    - No inbound webhook URLs to secure
    - Outbound-only connections
    - Automatic reconnection handling

    Attributes:
        config: SlackBridgeConfig with tokens and routing settings.
        app: Slack Bolt AsyncApp instance.
        decision_handler: Handler for approval/rejection decisions.
        gate_consumer: Consumer for gate events from Redis Streams.

    Example:
        ```python
        config = SlackBridgeConfig(...)
        bridge = SlackBridge(config=config)
        await bridge.start()
        ```
    """

    def __init__(
        self,
        config: SlackBridgeConfig,
        redis_client: redis.Redis | None = None,
        health_port: int = 8085,
    ) -> None:
        """Initialize the Slack Bridge.

        Args:
            config: SlackBridgeConfig with tokens and routing settings.
            redis_client: Optional Redis client. Creates one if not provided.
            health_port: Port for HTTP health check server.
        """
        self.config = config
        self._running = False
        self._consumer_task: asyncio.Task | None = None
        self._health_port = health_port
        self._health_server: web.AppRunner | None = None
        self._start_time: datetime | None = None

        # Health status tracking
        self._slack_connected = False
        self._redis_connected = False

        # Initialize Slack Bolt app
        self.app = AsyncApp(
            token=config.bot_token.get_secret_value(),
            signing_secret=config.signing_secret.get_secret_value(),
        )

        # Initialize Redis client
        self._redis_client = redis_client

        # Initialize routing policy
        self.policy = RoutingPolicy(config)

        # Initialize handlers (will be set up after Redis client is available)
        self.decision_handler: DecisionHandler | None = None
        self.gate_consumer: GateConsumer | None = None

        # Set up handlers if redis client is provided
        if redis_client:
            self._setup_handlers(redis_client)

        # Register action handlers
        self._register_handlers()

    def _setup_handlers(self, redis_client: redis.Redis) -> None:
        """Set up decision handler and gate consumer.

        Args:
            redis_client: Redis client instance.
        """
        self.decision_handler = DecisionHandler(
            redis_client=redis_client,
            slack_client=self.app.client,
            config=self.config,
        )

        self.gate_consumer = GateConsumer(
            redis_client=redis_client,
            slack_client=self.app.client,
            config=self.config,
        )

    def _register_handlers(self) -> None:
        """Register Slack action and view handlers."""
        # Register approve_gate action handler
        self.app.action("approve_gate")(self._handle_approve_gate)

        # Register reject_gate action handler
        self.app.action("reject_gate")(self._handle_reject_gate)

        # Register rejection modal view handler with regex pattern
        self.app.view({"type": "view_submission", "callback_id": "rejection_modal_.*"})(
            self._handle_rejection_modal
        )

    async def _handle_approve_gate(
        self,
        ack: Callable,
        body: dict,
        client: Any,
    ) -> None:
        """Handle approve_gate button click.

        Args:
            ack: Acknowledgement function.
            body: Action body from Slack.
            client: Slack client instance.
        """
        await ack()

        user_id = body.get("user", {}).get("id", "")
        channel_id = body.get("channel", {}).get("id", "")
        message = body.get("message", {})
        message_ts = message.get("ts", "")
        original_blocks = message.get("blocks", [])
        request_id = body.get("actions", [{}])[0].get("value", "")

        # Get channel config for this channel
        channel_config = self._get_channel_config_for_channel(channel_id)
        if not channel_config:
            await client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text="Error: No configuration found for this channel.",
            )
            return

        try:
            # Ensure decision handler is initialized
            if self.decision_handler is None:
                await client.chat_postEphemeral(
                    channel=channel_id,
                    user=user_id,
                    text="Error: Bridge not fully initialized.",
                )
                return

            # Process approval
            await self.decision_handler.handle_approval(
                request_id=request_id,
                slack_user_id=user_id,
                channel_config=channel_config,
            )

            # Get user display name
            user_info = await client.users_info(user=user_id)
            user_name = user_info.get("user", {}).get("real_name", user_id)

            # Update message
            await self.decision_handler.update_message_after_approval(
                channel=channel_id,
                message_ts=message_ts,
                original_blocks=original_blocks,
                approver_name=user_name,
            )

        except RBACDeniedException as e:
            logger.warning(f"RBAC denied for approval: {e}")
            await client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text=f"You are not authorized to approve this gate. Required role: {channel_config.required_role}",
            )

        except GateAlreadyDecidedException as e:
            logger.info(f"Gate already decided: {e}")
            await client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text="This gate has already been decided.",
            )

        except GateNotFoundException as e:
            logger.warning(f"Gate not found: {e}")
            await client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text="This gate request could not be found.",
            )

        except Exception as e:
            logger.error(f"Error handling approval: {e}")
            await client.chat_postEphemeral(
                channel=channel_id,
                user=user_id,
                text="An error occurred while processing your approval.",
            )

    async def _handle_reject_gate(
        self,
        ack: Callable,
        body: dict,
        client: Any,
    ) -> None:
        """Handle reject_gate button click.

        Opens the rejection reason modal.

        Args:
            ack: Acknowledgement function.
            body: Action body from Slack.
            client: Slack client instance.
        """
        await ack()

        trigger_id = body.get("trigger_id", "")
        request_id = body.get("actions", [{}])[0].get("value", "")

        if self.decision_handler is None:
            logger.error("Decision handler not initialized")
            return

        await self.decision_handler.open_rejection_modal(
            trigger_id=trigger_id,
            request_id=request_id,
        )

    async def _handle_rejection_modal(
        self,
        ack: Callable,
        body: dict,
        client: Any,
    ) -> None:
        """Handle rejection modal submission.

        Args:
            ack: Acknowledgement function.
            body: View submission body from Slack.
            client: Slack client instance.
        """
        await ack()

        user_id = body.get("user", {}).get("id", "")
        view = body.get("view", {})

        # Get request_id from private_metadata
        request_id = view.get("private_metadata", "")

        # Find channel config based on the request
        # For now, we'll use a default config from routing policy
        channel_config = self._get_default_channel_config()

        if not channel_config:
            logger.error("No channel config available for rejection")
            return

        if self.decision_handler is None:
            logger.error("Decision handler not initialized")
            return

        result = await self.decision_handler.handle_rejection_modal_submit(
            view_submission=view,
            slack_user_id=user_id,
            channel_config=channel_config,
        )

        if not result.get("success"):
            logger.warning(f"Rejection failed: {result.get('error')}")

    def _get_channel_config_for_channel(self, channel_id: str) -> ChannelConfig | None:
        """Find channel config for a given channel ID.

        Args:
            channel_id: Slack channel ID.

        Returns:
            ChannelConfig if found, None otherwise.
        """
        for gate_type, config in self.config.routing_policy.items():
            if config.channel_id == channel_id:
                return config
        return None

    def _get_default_channel_config(self) -> ChannelConfig | None:
        """Get a default channel config.

        Returns:
            First channel config from routing policy, or None.
        """
        if self.config.routing_policy:
            return next(iter(self.config.routing_policy.values()))
        return None

    async def validate_startup(self) -> None:
        """Validate configuration and connections on startup.

        Tests Slack token with auth.test API call and verifies Redis connection.
        Logs startup status and version.

        Raises:
            StartupValidationError: If validation fails.
        """
        logger.info(f"Slack Bridge v{__version__} starting validation...")

        # Validate config is not empty
        if not self.config.bot_token.get_secret_value():
            raise StartupValidationError(
                "SLACK_BOT_TOKEN is required but not set"
            )
        if not self.config.app_token.get_secret_value():
            raise StartupValidationError(
                "SLACK_APP_TOKEN is required but not set"
            )
        if not self.config.signing_secret.get_secret_value():
            raise StartupValidationError(
                "SLACK_SIGNING_SECRET is required but not set"
            )

        # Validate Slack token with auth.test
        try:
            auth_response = await self.app.client.auth_test()
            if not auth_response.get("ok"):
                raise StartupValidationError(
                    f"Slack auth.test failed: {auth_response.get('error', 'unknown error')}"
                )
            bot_user_id = auth_response.get("user_id", "unknown")
            team_name = auth_response.get("team", "unknown")
            logger.info(f"Slack connection validated: bot={bot_user_id}, team={team_name}")
            self._slack_connected = True
        except Exception as e:
            if isinstance(e, StartupValidationError):
                raise
            raise StartupValidationError(f"Failed to validate Slack token: {e}")

        # Validate Redis connection
        if self._redis_client:
            try:
                await self._redis_client.ping()
                logger.info("Redis connection validated")
                self._redis_connected = True
            except Exception as e:
                raise StartupValidationError(f"Failed to connect to Redis: {e}")
        else:
            logger.warning("No Redis client provided - skipping Redis validation")

        logger.info(f"Slack Bridge v{__version__} validation complete")

    async def get_health_status(self) -> dict:
        """Get current health status of the bridge.

        Checks Slack and Redis connection status.

        Returns:
            Dict with health status for each component.
        """
        status = {
            "status": "healthy",
            "version": __version__,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": None,
            "components": {
                "slack": {"status": "unknown", "connected": False},
                "redis": {"status": "unknown", "connected": False},
                "gate_consumer": {"status": "unknown", "running": False},
            },
        }

        if self._start_time:
            uptime = datetime.now(timezone.utc) - self._start_time
            status["uptime_seconds"] = uptime.total_seconds()

        # Check Slack connection
        try:
            auth_response = await self.app.client.auth_test()
            if auth_response.get("ok"):
                status["components"]["slack"] = {
                    "status": "healthy",
                    "connected": True,
                    "bot_id": auth_response.get("user_id"),
                }
                self._slack_connected = True
            else:
                status["components"]["slack"] = {
                    "status": "unhealthy",
                    "connected": False,
                    "error": auth_response.get("error", "unknown"),
                }
                status["status"] = "unhealthy"
                self._slack_connected = False
        except Exception as e:
            status["components"]["slack"] = {
                "status": "unhealthy",
                "connected": False,
                "error": str(e),
            }
            status["status"] = "unhealthy"
            self._slack_connected = False

        # Check Redis connection
        if self._redis_client:
            try:
                await self._redis_client.ping()
                status["components"]["redis"] = {
                    "status": "healthy",
                    "connected": True,
                }
                self._redis_connected = True
            except Exception as e:
                status["components"]["redis"] = {
                    "status": "unhealthy",
                    "connected": False,
                    "error": str(e),
                }
                status["status"] = "unhealthy"
                self._redis_connected = False
        else:
            status["components"]["redis"] = {
                "status": "not_configured",
                "connected": False,
            }

        # Check gate consumer
        if self._consumer_task:
            if self._consumer_task.done():
                exception = self._consumer_task.exception() if not self._consumer_task.cancelled() else None
                status["components"]["gate_consumer"] = {
                    "status": "stopped",
                    "running": False,
                    "error": str(exception) if exception else None,
                }
                if exception:
                    status["status"] = "degraded"
            else:
                status["components"]["gate_consumer"] = {
                    "status": "healthy",
                    "running": True,
                }
        else:
            status["components"]["gate_consumer"] = {
                "status": "not_started",
                "running": False,
            }

        return status

    async def _health_handler(self, request: web.Request) -> web.Response:
        """Handle /health endpoint requests.

        Args:
            request: aiohttp request object.

        Returns:
            JSON response with health status.
        """
        status = await self.get_health_status()
        http_status = 200 if status["status"] == "healthy" else 503
        return web.Response(
            text=json.dumps(status, indent=2),
            status=http_status,
            content_type="application/json",
        )

    async def _start_health_server(self) -> None:
        """Start the HTTP health check server."""
        app = web.Application()
        app.router.add_get("/health", self._health_handler)
        app.router.add_get("/", self._health_handler)  # Alias for convenience

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self._health_port)
        await site.start()
        self._health_server = runner
        logger.info(f"Health check server started on port {self._health_port}")

    async def _stop_health_server(self) -> None:
        """Stop the HTTP health check server."""
        if self._health_server:
            await self._health_server.cleanup()
            self._health_server = None
            logger.info("Health check server stopped")

    async def start(self, skip_validation: bool = False) -> None:
        """Start the Slack Bridge.

        Performs startup validation, initializes Socket Mode handler,
        starts health check server, starts gate consumer, and handles
        graceful shutdown.

        Args:
            skip_validation: If True, skip startup validation (for testing).

        Raises:
            StartupValidationError: If startup validation fails.
        """
        self._start_time = datetime.now(timezone.utc)
        self._running = True

        # Set up signal handlers for graceful shutdown
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.shutdown()))

        logger.info(f"Starting Slack Bridge v{__version__}...")

        # Perform startup validation
        if not skip_validation:
            await self.validate_startup()

        # Start health check server
        await self._start_health_server()

        # Initialize Socket Mode handler
        handler = AsyncSocketModeHandler(
            app=self.app,
            app_token=self.config.app_token.get_secret_value(),
        )

        try:
            # Start gate consumer in background
            if self.gate_consumer:
                self._consumer_task = asyncio.create_task(self.gate_consumer.run())
                logger.info("Gate consumer started")

            logger.info("Slack Bridge ready and listening for events")

            # Start Socket Mode handler
            await handler.start_async()

        except asyncio.CancelledError:
            logger.info("Slack Bridge cancelled")
        finally:
            await self.shutdown()

    async def shutdown(self) -> None:
        """Gracefully shutdown the Slack Bridge.

        Stops the gate consumer, health server, and cleans up resources.
        """
        if not self._running:
            return

        self._running = False
        logger.info("Shutting down Slack Bridge...")

        # Stop health check server
        await self._stop_health_server()

        # Cancel consumer task
        if self._consumer_task and not self._consumer_task.done():
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass

        # Close Redis connection if we own it
        if self._redis_client:
            try:
                await self._redis_client.close()
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")

        logger.info("Slack Bridge shutdown complete")


def load_config_from_file(config_path: str) -> dict:
    """Load configuration from JSON file.

    Args:
        config_path: Path to JSON configuration file.

    Returns:
        Dict with configuration values.
    """
    with open(config_path) as f:
        return json.load(f)


async def main() -> None:
    """Main entry point for the Slack Bridge.

    Loads configuration from environment and optional config file,
    validates startup, and runs the bridge.
    """
    from pydantic import SecretStr

    from src.infrastructure.slack_bridge.config import ChannelConfig

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    logger.info(f"Slack Bridge v{__version__} initializing...")

    # Load optional config file
    config_file = os.environ.get("SLACK_CONFIG_FILE", "")
    file_config: dict = {}
    if config_file and os.path.exists(config_file):
        try:
            file_config = load_config_from_file(config_file)
            logger.info(f"Loaded configuration from {config_file}")
        except Exception as e:
            logger.error(f"Failed to load config file {config_file}: {e}")
            raise StartupValidationError(f"Invalid config file: {e}")

    # Build routing policy from config file
    routing_policy: dict[str, ChannelConfig] = {}
    for gate_type, channel_data in file_config.get("routing_policy", {}).items():
        routing_policy[gate_type] = ChannelConfig(**channel_data)

    # Load configuration from environment (env vars take precedence)
    config = SlackBridgeConfig(
        bot_token=SecretStr(os.environ.get("SLACK_BOT_TOKEN", "")),
        app_token=SecretStr(os.environ.get("SLACK_APP_TOKEN", "")),
        signing_secret=SecretStr(os.environ.get("SLACK_SIGNING_SECRET", "")),
        routing_policy=routing_policy,
        rbac_map=file_config.get("rbac_map", {}),
        ideas_channels=file_config.get("ideas_channels", []),
        ideas_emoji=file_config.get("ideas_emoji", "bulb"),
        consumer_group=file_config.get("consumer_group", "slack_bridge"),
        consumer_name=file_config.get("consumer_name", "bridge_1"),
    )

    # Get health port from environment
    health_port = int(os.environ.get("HEALTH_PORT", "8085"))

    # Create Redis client
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)

    # Create and start bridge
    bridge = SlackBridge(
        config=config,
        redis_client=redis_client,
        health_port=health_port,
    )

    try:
        await bridge.start()
    except StartupValidationError as e:
        logger.error(f"Startup validation failed: {e}")
        raise SystemExit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
