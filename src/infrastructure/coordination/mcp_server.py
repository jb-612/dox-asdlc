"""MCP server for CLI coordination tools.

Exposes coordination functionality as MCP tools that can be invoked
by Claude Code. This provides the same interface as the bash scripts
but uses the Redis backend directly.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
from datetime import UTC, datetime
from typing import Any

from src.core.redis_client import close_redis_client, get_redis_client
from src.infrastructure.coordination.client import CoordinationClient
from src.infrastructure.coordination.config import CoordinationConfig
from src.infrastructure.coordination.types import MessageQuery, MessageType

logger = logging.getLogger(__name__)


class CoordinationMCPServer:
    """MCP server providing coordination tools.

    Exposes four tools matching the bash script interface:
    - coord_publish_message: Publish a coordination message
    - coord_check_messages: Query messages with filters
    - coord_ack_message: Acknowledge a message
    - coord_get_presence: Get instance presence information

    This server uses stdio transport and runs as a subprocess of Claude Code.
    """

    def __init__(self) -> None:
        """Initialize the MCP server.

        Raises:
            RuntimeError: If instance identity cannot be determined from
                CLAUDE_INSTANCE_ID environment variable or git user.email.
        """
        self._client: CoordinationClient | None = None
        self._config = CoordinationConfig.from_env()

        # Resolve identity at startup (fail-fast)
        self._instance_id = self._resolve_instance_id()
        logger.info(f"Coordination MCP server initialized with identity: {self._instance_id}")

    def _resolve_instance_id(self) -> str:
        """Resolve instance identity from environment variable.

        Priority:
        1. CLAUDE_INSTANCE_ID environment variable (if not empty or "unknown")
        2. Default to "pm" if in main repository
        3. Raise error if in worktree without CLAUDE_INSTANCE_ID

        Returns:
            Instance ID string (e.g., "p11-guardrails", "pm", "p04-review-swarm")

        Raises:
            RuntimeError: If instance identity cannot be determined
        """
        # Check environment variable first
        env_id = os.environ.get("CLAUDE_INSTANCE_ID")
        if env_id and env_id.lower() != "unknown":
            return env_id

        # Check if we're in a worktree
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                capture_output=True,
                text=True,
                timeout=5,
                cwd=os.getcwd(),
            )
            repo_root = result.stdout.strip()

            # Check if .git is a file (worktree) or directory (main repo)
            git_path = os.path.join(repo_root, ".git")
            if os.path.isfile(git_path):
                # We're in a worktree without CLAUDE_INSTANCE_ID
                raise RuntimeError(
                    "Running in worktree without CLAUDE_INSTANCE_ID. "
                    "Set CLAUDE_INSTANCE_ID environment variable to the context name "
                    "(e.g., export CLAUDE_INSTANCE_ID=p11-guardrails)"
                )

            # We're in main repo, default to "pm"
            logger.info("In main repository without CLAUDE_INSTANCE_ID, defaulting to 'pm'")
            return "pm"

        except subprocess.TimeoutExpired:
            logger.warning("Timeout checking git repository")
        except subprocess.SubprocessError as e:
            logger.warning(f"Failed to check git repository: {e}")

        # Cannot determine identity
        raise RuntimeError(
            "Cannot determine instance identity. Set CLAUDE_INSTANCE_ID "
            "environment variable (e.g., export CLAUDE_INSTANCE_ID=p11-guardrails)"
        )

    async def _get_client(self) -> CoordinationClient:
        """Get or create the coordination client."""
        if self._client is None:
            redis = await get_redis_client()
            self._client = CoordinationClient(
                redis_client=redis,
                config=self._config,
                instance_id=self._instance_id,
            )
        return self._client

    async def coord_publish_message(
        self,
        msg_type: str,
        subject: str,
        description: str,
        to_instance: str = "orchestrator",
        requires_ack: bool = True,
    ) -> dict[str, Any]:
        """Publish a coordination message.

        Validates sender identity before publishing. Messages with invalid
        sender identity (None, empty string, or "unknown") are rejected.

        Args:
            msg_type: Message type (e.g., READY_FOR_REVIEW, GENERAL)
            subject: Brief subject line
            description: Detailed message content
            to_instance: Target instance ID (default: orchestrator)
            requires_ack: Whether acknowledgment is required

        Returns:
            Dict with success status and message details. On validation
            failure, returns error dict with "error" and "hint" fields.

        Example response:
            {
                "success": true,
                "message_id": "msg-abc12345",
                "type": "READY_FOR_REVIEW",
                "from": "backend",
                "to": "orchestrator"
            }
        """
        # Validate sender identity before publishing
        if self._instance_id in (None, "", "unknown"):
            return {
                "success": False,
                "error": "Invalid sender identity. Cannot publish messages with unknown sender.",
                "hint": "Set CLAUDE_INSTANCE_ID or configure git user.email",
            }

        try:
            # Validate message type
            try:
                message_type = MessageType(msg_type)
            except ValueError:
                return {
                    "success": False,
                    "error": f"Invalid message type: {msg_type}",
                    "valid_types": [t.value for t in MessageType],
                }

            client = await self._get_client()
            message = await client.publish_message(
                msg_type=message_type,
                subject=subject,
                description=description,
                from_instance=self._instance_id,
                to_instance=to_instance,
                requires_ack=requires_ack,
            )

            return {
                "success": True,
                "message_id": message.id,
                "type": message.type.value,
                "from": message.from_instance,
                "to": message.to_instance,
                "timestamp": message.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "requires_ack": message.requires_ack,
            }

        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_check_messages(
        self,
        to_instance: str | None = None,
        from_instance: str | None = None,
        msg_type: str | None = None,
        pending_only: bool = False,
        limit: int = 100,
    ) -> dict[str, Any]:
        """Query coordination messages with filters.

        Args:
            to_instance: Filter by target instance
            from_instance: Filter by sender instance
            msg_type: Filter by message type
            pending_only: Only return unacknowledged messages
            limit: Maximum number of results

        Returns:
            Dict with success status and list of messages

        Example response:
            {
                "success": true,
                "count": 2,
                "messages": [
                    {
                        "id": "msg-abc123",
                        "type": "READY_FOR_REVIEW",
                        "from": "backend",
                        "to": "orchestrator",
                        "subject": "Feature ready",
                        ...
                    }
                ]
            }
        """
        try:
            # Build query
            query_type = None
            if msg_type:
                try:
                    query_type = MessageType(msg_type)
                except ValueError:
                    return {
                        "success": False,
                        "error": f"Invalid message type: {msg_type}",
                        "valid_types": [t.value for t in MessageType],
                    }

            query = MessageQuery(
                to_instance=to_instance,
                from_instance=from_instance,
                msg_type=query_type,
                pending_only=pending_only,
                limit=min(limit, 1000),
            )

            client = await self._get_client()
            messages = await client.get_messages(query)

            return {
                "success": True,
                "count": len(messages),
                "messages": [msg.to_dict() for msg in messages],
            }

        except Exception as e:
            logger.error(f"Failed to check messages: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_ack_message(
        self,
        message_id: str,
        comment: str | None = None,
    ) -> dict[str, Any]:
        """Acknowledge a coordination message.

        Args:
            message_id: The message ID to acknowledge
            comment: Optional comment for the acknowledgment

        Returns:
            Dict with success status

        Example response:
            {
                "success": true,
                "message_id": "msg-abc123",
                "acknowledged_by": "orchestrator"
            }
        """
        try:
            client = await self._get_client()
            result = await client.acknowledge_message(
                message_id=message_id,
                ack_by=self._instance_id,
                comment=comment,
            )

            if result:
                return {
                    "success": True,
                    "message_id": message_id,
                    "acknowledged_by": self._instance_id,
                }
            else:
                return {
                    "success": False,
                    "error": f"Message not found: {message_id}",
                }

        except Exception as e:
            logger.error(f"Failed to acknowledge message: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_get_presence(self) -> dict[str, Any]:
        """Get presence information for all CLI instances with stale detection.

        Returns:
            Dict with success status and instance presence data including
            stale flag and seconds since last heartbeat.

        Example response:
            {
                "success": true,
                "instances": {
                    "backend": {
                        "instance_id": "backend",
                        "active": true,
                        "last_heartbeat": "2026-01-23T12:00:00Z",
                        "session_id": "abc-123",
                        "stale": false,
                        "seconds_since_heartbeat": 45
                    },
                    "frontend": {
                        "instance_id": "frontend",
                        "active": true,
                        "last_heartbeat": "2026-01-23T11:50:00Z",
                        "stale": true,
                        "seconds_since_heartbeat": 600
                    }
                }
            }
        """
        try:
            client = await self._get_client()
            presence = await client.get_presence()
            now = datetime.now(UTC)

            # Stale threshold: 5 minutes (300 seconds)
            stale_threshold_seconds = 300

            instances: dict[str, Any] = {}
            for instance_id, info in presence.items():
                # Get basic info from PresenceInfo.to_dict()
                instance_data = info.to_dict()

                # Calculate time since last heartbeat
                last_hb = info.last_heartbeat
                if last_hb.tzinfo is None:
                    last_hb = last_hb.replace(tzinfo=UTC)
                delta = now - last_hb
                seconds_since_heartbeat = int(delta.total_seconds())

                # Add stale detection fields
                instance_data["stale"] = seconds_since_heartbeat >= stale_threshold_seconds
                instance_data["seconds_since_heartbeat"] = seconds_since_heartbeat

                instances[instance_id] = instance_data

            return {
                "success": True,
                "instances": instances,
            }

        except Exception as e:
            logger.error(f"Failed to get presence: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_register_presence(
        self,
        role: str,
        worktree_path: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Register session presence with metadata.

        Registers the current session as active with optional metadata.
        This should be called at session startup.

        Args:
            role: The role/instance ID to register (e.g., "backend", "frontend")
            worktree_path: Optional path to the git worktree for this session
            session_id: Optional unique session identifier

        Returns:
            Dict with success status and registration details

        Example response:
            {
                "success": true,
                "role": "backend",
                "registered_at": "2026-02-05T10:00:00Z",
                "worktree_path": "/path/to/.worktrees/backend",
                "session_id": "session-abc123"
            }
        """
        try:
            client = await self._get_client()
            await client.register_instance(
                instance_id=role,
                session_id=session_id,
            )

            now = datetime.now(UTC)
            result: dict[str, Any] = {
                "success": True,
                "role": role,
                "registered_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

            if worktree_path:
                result["worktree_path"] = worktree_path
            if session_id:
                result["session_id"] = session_id

            logger.info(f"Registered presence for role: {role}")
            return result

        except Exception as e:
            logger.error(f"Failed to register presence for {role}: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_deregister_presence(self, role: str) -> dict[str, Any]:
        """Mark session as inactive.

        Deregisters the session, marking it as inactive while preserving
        the last heartbeat timestamp for history. This should be called
        when a session is ending gracefully.

        Args:
            role: The role/instance ID to deregister

        Returns:
            Dict with success status

        Example response:
            {
                "success": true,
                "role": "backend"
            }
        """
        try:
            client = await self._get_client()
            await client.unregister_instance(role)

            logger.info(f"Deregistered presence for role: {role}")
            return {
                "success": True,
                "role": role,
            }

        except Exception as e:
            logger.error(f"Failed to deregister presence for {role}: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_heartbeat(self, role: str) -> dict[str, Any]:
        """Update heartbeat timestamp for a session.

        Updates only the heartbeat timestamp to indicate the session is
        still active. This should be called periodically (every 60 seconds)
        to prevent the session from being marked as stale.

        The operation refreshes the TTL to 5 minutes and is designed to
        be fast (<100ms).

        Args:
            role: The role/instance ID to heartbeat

        Returns:
            Dict with success status and new heartbeat timestamp

        Example response:
            {
                "success": true,
                "role": "backend",
                "last_heartbeat": "2026-02-05T10:00:00Z"
            }
        """
        try:
            client = await self._get_client()
            await client.heartbeat(role)

            now = datetime.now(UTC)
            logger.debug(f"Heartbeat for role: {role}")
            return {
                "success": True,
                "role": role,
                "last_heartbeat": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

        except Exception as e:
            logger.error(f"Failed to heartbeat for {role}: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def coord_get_notifications(self, limit: int = 100) -> dict[str, Any]:
        """Get and clear pending notifications for the current instance.

        This tool retrieves all queued notifications that were sent while
        the instance was offline. The notifications are returned and removed
        from the queue.

        Args:
            limit: Maximum number of notifications to retrieve (default: 100)

        Returns:
            Dict with success status and list of notifications

        Example response:
            {
                "success": true,
                "count": 2,
                "notifications": [
                    {
                        "event": "message_published",
                        "message_id": "msg-abc123",
                        "type": "READY_FOR_REVIEW",
                        "from": "backend",
                        "to": "orchestrator",
                        "requires_ack": true,
                        "timestamp": "2026-01-23T12:00:00Z"
                    }
                ]
            }
        """
        try:
            client = await self._get_client()
            notifications = await client.pop_notifications(
                instance_id=self._instance_id,
                limit=min(limit, 1000),
            )

            return {
                "success": True,
                "count": len(notifications),
                "notifications": [n.to_dict() for n in notifications],
            }

        except Exception as e:
            logger.error(f"Failed to get notifications: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Get MCP tool schema definitions.

        Returns:
            List of tool schemas in MCP format
        """
        return [
            {
                "name": "coord_publish_message",
                "description": "Publish a coordination message to another CLI instance",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "msg_type": {
                            "type": "string",
                            "description": "Message type",
                            "enum": [t.value for t in MessageType],
                        },
                        "subject": {
                            "type": "string",
                            "description": "Brief subject line for the message",
                        },
                        "description": {
                            "type": "string",
                            "description": "Detailed message content",
                        },
                        "to_instance": {
                            "type": "string",
                            "description": "Target instance ID (default: orchestrator)",
                            "default": "orchestrator",
                        },
                        "requires_ack": {
                            "type": "boolean",
                            "description": "Whether acknowledgment is required",
                            "default": True,
                        },
                    },
                    "required": ["msg_type", "subject", "description"],
                },
            },
            {
                "name": "coord_check_messages",
                "description": "Query coordination messages with optional filters",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "to_instance": {
                            "type": "string",
                            "description": "Filter by target instance",
                        },
                        "from_instance": {
                            "type": "string",
                            "description": "Filter by sender instance",
                        },
                        "msg_type": {
                            "type": "string",
                            "description": "Filter by message type",
                            "enum": [t.value for t in MessageType],
                        },
                        "pending_only": {
                            "type": "boolean",
                            "description": "Only return unacknowledged messages",
                            "default": False,
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results",
                            "default": 100,
                        },
                    },
                },
            },
            {
                "name": "coord_ack_message",
                "description": "Acknowledge a coordination message",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "message_id": {
                            "type": "string",
                            "description": "The message ID to acknowledge",
                        },
                        "comment": {
                            "type": "string",
                            "description": "Optional comment for the acknowledgment",
                        },
                    },
                    "required": ["message_id"],
                },
            },
            {
                "name": "coord_get_presence",
                "description": (
                    "Get presence info for CLI instances with stale detection"
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "coord_get_notifications",
                "description": "Get and clear pending notifications for this instance",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of notifications to retrieve",
                            "default": 100,
                        },
                    },
                },
            },
            {
                "name": "coord_register_presence",
                "description": "Register session as active with metadata. Call at session startup.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "role": {
                            "type": "string",
                            "description": "Role/instance ID to register (e.g., backend, frontend)",
                        },
                        "worktree_path": {
                            "type": "string",
                            "description": "Optional path to git worktree for this session",
                        },
                        "session_id": {
                            "type": "string",
                            "description": "Optional unique session identifier",
                        },
                    },
                    "required": ["role"],
                },
            },
            {
                "name": "coord_deregister_presence",
                "description": "Mark session as inactive. Call when session ends gracefully.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "role": {
                            "type": "string",
                            "description": "Role/instance ID to deregister",
                        },
                    },
                    "required": ["role"],
                },
            },
            {
                "name": "coord_heartbeat",
                "description": "Update heartbeat timestamp. Call every 60 seconds to stay active.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "role": {
                            "type": "string",
                            "description": "Role/instance ID to heartbeat",
                        },
                    },
                    "required": ["role"],
                },
            },
        ]

    async def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """Handle an incoming MCP request.

        Args:
            request: The MCP request object

        Returns:
            MCP response object
        """
        method = request.get("method", "")
        params = request.get("params", {})
        request_id = request.get("id")

        try:
            if method == "initialize":
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {
                            "name": "coordination-mcp-server",
                            "version": "1.0.0",
                        },
                        "capabilities": {
                            "tools": {},
                        },
                    },
                }

            elif method == "tools/list":
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "tools": self.get_tool_schemas(),
                    },
                }

            elif method == "tools/call":
                tool_name = params.get("name", "")
                arguments = params.get("arguments", {})

                if tool_name == "coord_publish_message":
                    result = await self.coord_publish_message(**arguments)
                elif tool_name == "coord_check_messages":
                    result = await self.coord_check_messages(**arguments)
                elif tool_name == "coord_ack_message":
                    result = await self.coord_ack_message(**arguments)
                elif tool_name == "coord_get_presence":
                    result = await self.coord_get_presence()
                elif tool_name == "coord_get_notifications":
                    result = await self.coord_get_notifications(**arguments)
                elif tool_name == "coord_register_presence":
                    result = await self.coord_register_presence(**arguments)
                elif tool_name == "coord_deregister_presence":
                    result = await self.coord_deregister_presence(**arguments)
                elif tool_name == "coord_heartbeat":
                    result = await self.coord_heartbeat(**arguments)
                else:
                    return {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {
                            "code": -32601,
                            "message": f"Unknown tool: {tool_name}",
                        },
                    }

                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(result, indent=2),
                            }
                        ],
                    },
                }

            elif method == "notifications/initialized":
                # Notification, no response needed
                return None

            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Unknown method: {method}",
                    },
                }

        except Exception as e:
            logger.error(f"Error handling request: {e}")
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32603,
                    "message": str(e),
                },
            }

    async def run_stdio(self) -> None:
        """Run the MCP server using stdio transport.

        Reads JSON-RPC requests from stdin and writes responses to stdout.
        """
        logger.info(f"Starting coordination MCP server (instance: {self._instance_id})")

        # Read from stdin line by line
        while True:
            try:
                line = await asyncio.get_event_loop().run_in_executor(
                    None, sys.stdin.readline
                )
                if not line:
                    break  # EOF

                line = line.strip()
                if not line:
                    continue

                try:
                    request = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    continue

                response = await self.handle_request(request)

                if response is not None:
                    print(json.dumps(response), flush=True)

            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")

        # Cleanup
        await close_redis_client()
        logger.info("Coordination MCP server stopped")


async def main() -> None:
    """Entry point for the MCP server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stderr,
    )

    server = CoordinationMCPServer()
    await server.run_stdio()


if __name__ == "__main__":
    asyncio.run(main())
