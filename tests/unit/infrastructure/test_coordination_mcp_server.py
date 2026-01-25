"""Tests for coordination MCP server."""

import subprocess
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.infrastructure.coordination.mcp_server import CoordinationMCPServer
from src.infrastructure.coordination.types import (
    CoordinationMessage,
    MessagePayload,
    MessageType,
    PresenceInfo,
)


class TestIdentityResolution:
    """Tests for instance identity resolution."""

    def test_identity_from_backend_git_email(self) -> None:
        """Test identity resolution from backend git email."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-backend@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {}, clear=True):
            with patch("subprocess.run", return_value=mock_result) as mock_run:
                server = CoordinationMCPServer()
                assert server._instance_id == "backend"
                mock_run.assert_called_once()

    def test_identity_from_frontend_git_email(self) -> None:
        """Test identity resolution from frontend git email."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-frontend@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {}, clear=True):
            with patch("subprocess.run", return_value=mock_result):
                server = CoordinationMCPServer()
                assert server._instance_id == "frontend"

    def test_identity_from_orchestrator_git_email(self) -> None:
        """Test identity resolution from orchestrator git email."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-orchestrator@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {}, clear=True):
            with patch("subprocess.run", return_value=mock_result):
                server = CoordinationMCPServer()
                assert server._instance_id == "orchestrator"

    def test_identity_from_devops_git_email(self) -> None:
        """Test identity resolution from devops git email."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-devops@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {}, clear=True):
            with patch("subprocess.run", return_value=mock_result):
                server = CoordinationMCPServer()
                assert server._instance_id == "devops"

    def test_env_var_takes_precedence_over_git_email(self) -> None:
        """Test CLAUDE_INSTANCE_ID env var takes precedence over git email."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-backend@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "custom-instance"}):
            with patch("subprocess.run", return_value=mock_result) as mock_run:
                server = CoordinationMCPServer()
                assert server._instance_id == "custom-instance"
                # subprocess.run should NOT be called since env var is set
                mock_run.assert_not_called()

    def test_empty_env_var_is_ignored(self) -> None:
        """Test empty CLAUDE_INSTANCE_ID env var falls through to git."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-backend@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": ""}):
            with patch("subprocess.run", return_value=mock_result) as mock_run:
                server = CoordinationMCPServer()
                assert server._instance_id == "backend"
                mock_run.assert_called_once()

    def test_unknown_env_var_value_is_ignored(self) -> None:
        """Test 'unknown' CLAUDE_INSTANCE_ID env var falls through to git."""
        mock_result = MagicMock()
        mock_result.stdout = "claude-frontend@asdlc.local\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "unknown"}):
            with patch("subprocess.run", return_value=mock_result) as mock_run:
                server = CoordinationMCPServer()
                assert server._instance_id == "frontend"
                mock_run.assert_called_once()

    def test_unknown_git_email_raises_runtime_error(self) -> None:
        """Test unknown git email raises RuntimeError with guidance."""
        mock_result = MagicMock()
        mock_result.stdout = "unknown-user@example.com\n"
        mock_result.returncode = 0

        with patch.dict("os.environ", {}, clear=True):
            with patch("subprocess.run", return_value=mock_result):
                with pytest.raises(RuntimeError) as exc_info:
                    CoordinationMCPServer()

                error_message = str(exc_info.value)
                assert "Cannot determine instance identity" in error_message
                assert "CLAUDE_INSTANCE_ID" in error_message
                assert "git user.email" in error_message

    def test_git_config_failure_raises_runtime_error(self) -> None:
        """Test git config subprocess failure raises RuntimeError."""
        with patch.dict("os.environ", {}, clear=True):
            with patch(
                "subprocess.run",
                side_effect=subprocess.SubprocessError("git not found"),
            ):
                with pytest.raises(RuntimeError) as exc_info:
                    CoordinationMCPServer()

                error_message = str(exc_info.value)
                assert "Cannot determine instance identity" in error_message

    def test_git_config_timeout_raises_runtime_error(self) -> None:
        """Test git config timeout raises RuntimeError with clear message."""
        with patch.dict("os.environ", {}, clear=True):
            with patch(
                "subprocess.run",
                side_effect=subprocess.TimeoutExpired(cmd="git", timeout=5),
            ):
                with pytest.raises(RuntimeError) as exc_info:
                    CoordinationMCPServer()

                error_message = str(exc_info.value)
                assert "Cannot determine instance identity" in error_message


class TestCoordinationMCPServerTools:
    """Tests for MCP server tool methods."""

    @pytest.fixture
    def server(self) -> CoordinationMCPServer:
        """Create test server."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "test-instance"}):
            return CoordinationMCPServer()

    @pytest.fixture
    def mock_client(self) -> AsyncMock:
        """Create mock coordination client."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_publish_message_success(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test successful message publishing."""
        mock_message = CoordinationMessage(
            id="msg-test123",
            type=MessageType.READY_FOR_REVIEW,
            from_instance="test-instance",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(subject="Test", description="Description"),
        )
        mock_client.publish_message = AsyncMock(return_value=mock_message)
        server._client = mock_client

        result = await server.coord_publish_message(
            msg_type="READY_FOR_REVIEW",
            subject="Test Subject",
            description="Test Description",
        )

        assert result["success"] is True
        assert result["message_id"] == "msg-test123"
        assert result["type"] == "READY_FOR_REVIEW"
        mock_client.publish_message.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_publish_message_invalid_type(
        self,
        server: CoordinationMCPServer,
    ) -> None:
        """Test publishing with invalid message type."""
        result = await server.coord_publish_message(
            msg_type="INVALID_TYPE",
            subject="Test",
            description="Test",
        )

        assert result["success"] is False
        assert "Invalid message type" in result["error"]
        assert "valid_types" in result

    @pytest.mark.asyncio
    async def test_publish_message_error(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test publishing with error."""
        mock_client.publish_message = AsyncMock(side_effect=Exception("Redis error"))
        server._client = mock_client

        result = await server.coord_publish_message(
            msg_type="GENERAL",
            subject="Test",
            description="Test",
        )

        assert result["success"] is False
        assert "Redis error" in result["error"]

    @pytest.mark.asyncio
    async def test_check_messages_success(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test checking messages successfully."""
        mock_messages = [
            CoordinationMessage(
                id="msg-001",
                type=MessageType.GENERAL,
                from_instance="backend",
                to_instance="orchestrator",
                timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
                requires_ack=True,
                payload=MessagePayload(subject="Test 1", description="Desc 1"),
            ),
        ]
        mock_client.get_messages = AsyncMock(return_value=mock_messages)
        server._client = mock_client

        result = await server.coord_check_messages(pending_only=True)

        assert result["success"] is True
        assert result["count"] == 1
        assert len(result["messages"]) == 1
        mock_client.get_messages.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_check_messages_with_filters(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test checking messages with filters."""
        mock_client.get_messages = AsyncMock(return_value=[])
        server._client = mock_client

        result = await server.coord_check_messages(
            to_instance="orchestrator",
            from_instance="backend",
            msg_type="READY_FOR_REVIEW",
            pending_only=True,
            limit=10,
        )

        assert result["success"] is True
        # Verify query was built with filters
        call_args = mock_client.get_messages.call_args
        query = call_args[0][0]
        assert query.to_instance == "orchestrator"
        assert query.from_instance == "backend"
        assert query.msg_type == MessageType.READY_FOR_REVIEW
        assert query.pending_only is True
        assert query.limit == 10

    @pytest.mark.asyncio
    async def test_check_messages_invalid_type(
        self,
        server: CoordinationMCPServer,
    ) -> None:
        """Test checking with invalid message type."""
        result = await server.coord_check_messages(msg_type="INVALID")

        assert result["success"] is False
        assert "Invalid message type" in result["error"]

    @pytest.mark.asyncio
    async def test_ack_message_success(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test acknowledging message successfully."""
        mock_client.acknowledge_message = AsyncMock(return_value=True)
        server._client = mock_client

        result = await server.coord_ack_message(
            message_id="msg-test123",
            comment="Acknowledged",
        )

        assert result["success"] is True
        assert result["message_id"] == "msg-test123"
        assert result["acknowledged_by"] == "test-instance"
        mock_client.acknowledge_message.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ack_message_not_found(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test acknowledging non-existent message."""
        mock_client.acknowledge_message = AsyncMock(return_value=False)
        server._client = mock_client

        result = await server.coord_ack_message(message_id="msg-notfound")

        assert result["success"] is False
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_get_presence_success(
        self,
        server: CoordinationMCPServer,
        mock_client: AsyncMock,
    ) -> None:
        """Test getting presence information."""
        mock_presence = {
            "backend": PresenceInfo(
                instance_id="backend",
                active=True,
                last_heartbeat=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            ),
        }
        mock_client.get_presence = AsyncMock(return_value=mock_presence)
        server._client = mock_client

        result = await server.coord_get_presence()

        assert result["success"] is True
        assert "backend" in result["instances"]
        assert result["instances"]["backend"]["active"] is True


class TestCoordinationMCPServerSchemas:
    """Tests for MCP server schema definitions."""

    @pytest.fixture
    def server(self) -> CoordinationMCPServer:
        """Create test server."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "test-instance"}):
            return CoordinationMCPServer()

    def test_get_tool_schemas(self, server: CoordinationMCPServer) -> None:
        """Test that tool schemas are valid."""
        schemas = server.get_tool_schemas()

        assert len(schemas) == 5
        tool_names = [s["name"] for s in schemas]
        assert "coord_publish_message" in tool_names
        assert "coord_check_messages" in tool_names
        assert "coord_ack_message" in tool_names
        assert "coord_get_presence" in tool_names
        assert "coord_get_notifications" in tool_names

    def test_publish_schema_has_required_fields(
        self,
        server: CoordinationMCPServer,
    ) -> None:
        """Test publish schema has required fields."""
        schemas = server.get_tool_schemas()
        publish_schema = next(
            s for s in schemas if s["name"] == "coord_publish_message"
        )

        assert "msg_type" in publish_schema["inputSchema"]["required"]
        assert "subject" in publish_schema["inputSchema"]["required"]
        assert "description" in publish_schema["inputSchema"]["required"]

    def test_ack_schema_requires_message_id(
        self,
        server: CoordinationMCPServer,
    ) -> None:
        """Test ack schema requires message_id."""
        schemas = server.get_tool_schemas()
        ack_schema = next(s for s in schemas if s["name"] == "coord_ack_message")

        assert "message_id" in ack_schema["inputSchema"]["required"]


class TestCoordinationMCPServerRequestHandling:
    """Tests for MCP request handling."""

    @pytest.fixture
    def server(self) -> CoordinationMCPServer:
        """Create test server."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "test-instance"}):
            return CoordinationMCPServer()

    @pytest.mark.asyncio
    async def test_handle_initialize(self, server: CoordinationMCPServer) -> None:
        """Test handling initialize request."""
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {},
        }

        response = await server.handle_request(request)

        assert response["id"] == 1
        assert "result" in response
        assert response["result"]["serverInfo"]["name"] == "coordination-mcp-server"

    @pytest.mark.asyncio
    async def test_handle_tools_list(self, server: CoordinationMCPServer) -> None:
        """Test handling tools/list request."""
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        }

        response = await server.handle_request(request)

        assert response["id"] == 2
        assert "result" in response
        assert len(response["result"]["tools"]) == 5

    @pytest.mark.asyncio
    async def test_handle_tools_call_publish(
        self,
        server: CoordinationMCPServer,
    ) -> None:
        """Test handling tools/call for publish."""
        mock_client = AsyncMock()
        mock_message = CoordinationMessage(
            id="msg-test",
            type=MessageType.GENERAL,
            from_instance="test-instance",
            to_instance="orchestrator",
            timestamp=datetime(2026, 1, 23, 12, 0, 0, tzinfo=timezone.utc),
            requires_ack=True,
            payload=MessagePayload(subject="Test", description="Desc"),
        )
        mock_client.publish_message = AsyncMock(return_value=mock_message)
        server._client = mock_client

        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "coord_publish_message",
                "arguments": {
                    "msg_type": "GENERAL",
                    "subject": "Test",
                    "description": "Description",
                },
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 3
        assert "result" in response
        assert response["result"]["content"][0]["type"] == "text"

    @pytest.mark.asyncio
    async def test_handle_unknown_tool(self, server: CoordinationMCPServer) -> None:
        """Test handling unknown tool call."""
        request = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "unknown_tool",
                "arguments": {},
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 4
        assert "error" in response
        assert "Unknown tool" in response["error"]["message"]

    @pytest.mark.asyncio
    async def test_handle_unknown_method(self, server: CoordinationMCPServer) -> None:
        """Test handling unknown method."""
        request = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "unknown/method",
            "params": {},
        }

        response = await server.handle_request(request)

        assert response["id"] == 5
        assert "error" in response
        assert "Unknown method" in response["error"]["message"]

    @pytest.mark.asyncio
    async def test_handle_notification(self, server: CoordinationMCPServer) -> None:
        """Test handling notification (no response needed)."""
        request = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        }

        response = await server.handle_request(request)

        assert response is None


class TestMessageValidation:
    """Tests for message validation before publishing."""

    @pytest.fixture
    def server_with_valid_identity(self) -> CoordinationMCPServer:
        """Create test server with valid identity."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            return CoordinationMCPServer()

    @pytest.mark.asyncio
    async def test_reject_unknown_sender(self) -> None:
        """Test that 'unknown' sender is rejected with error response."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()
            # Manually set invalid instance_id to test validation path
            server._instance_id = "unknown"

            result = await server.coord_publish_message(
                msg_type="GENERAL",
                subject="Test",
                description="Test message",
            )

            assert result["success"] is False
            assert "Invalid sender identity" in result["error"]
            assert "hint" in result

    @pytest.mark.asyncio
    async def test_reject_empty_string_sender(self) -> None:
        """Test that empty string sender is rejected with error response."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()
            # Manually set invalid instance_id to test validation path
            server._instance_id = ""

            result = await server.coord_publish_message(
                msg_type="GENERAL",
                subject="Test",
                description="Test message",
            )

            assert result["success"] is False
            assert "Invalid sender identity" in result["error"]
            assert "hint" in result

    @pytest.mark.asyncio
    async def test_reject_none_sender(self) -> None:
        """Test that None sender is rejected with error response."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()
            # Manually set invalid instance_id to test validation path
            server._instance_id = None  # type: ignore[assignment]

            result = await server.coord_publish_message(
                msg_type="GENERAL",
                subject="Test",
                description="Test message",
            )

            assert result["success"] is False
            assert "Invalid sender identity" in result["error"]
            assert "hint" in result

    @pytest.mark.asyncio
    async def test_accept_valid_sender(self) -> None:
        """Test that valid sender publishes successfully."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()

            mock_client = AsyncMock()
            mock_message = CoordinationMessage(
                id="msg-valid123",
                type=MessageType.GENERAL,
                from_instance="backend",
                to_instance="orchestrator",
                timestamp=datetime(2026, 1, 25, 12, 0, 0, tzinfo=timezone.utc),
                requires_ack=True,
                payload=MessagePayload(subject="Test", description="Test message"),
            )
            mock_client.publish_message = AsyncMock(return_value=mock_message)
            server._client = mock_client

            result = await server.coord_publish_message(
                msg_type="GENERAL",
                subject="Test",
                description="Test message",
            )

            assert result["success"] is True
            assert result["message_id"] == "msg-valid123"
            mock_client.publish_message.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_error_response_includes_hint(self) -> None:
        """Test that error response includes both error and hint fields."""
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()
            # Manually set invalid instance_id to test validation path
            server._instance_id = "unknown"

            result = await server.coord_publish_message(
                msg_type="GENERAL",
                subject="Test",
                description="Test message",
            )

            assert result["success"] is False
            assert "error" in result
            assert "hint" in result
            assert "CLAUDE_INSTANCE_ID" in result["hint"]
            assert "git user.email" in result["hint"]


class TestMessageAttribution:
    """Tests for message attribution via the 'from' field.

    These tests verify that:
    1. Published messages include the correct 'from' field matching the resolved identity
    2. Messages can be queried/filtered by from_instance

    This is critical for traceability and coordination between CLI instances.
    """

    @pytest.mark.asyncio
    async def test_published_message_from_field_matches_instance_id(self) -> None:
        """Test that the 'from' field in published message matches self._instance_id.

        When a message is published, the returned message should have a 'from'
        field that exactly matches the server's resolved _instance_id. This
        ensures proper attribution of messages to their source.
        """
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()

            # Verify the server has the expected identity
            assert server._instance_id == "backend"

            mock_client = AsyncMock()
            mock_message = CoordinationMessage(
                id="msg-attribution-test",
                type=MessageType.STATUS_UPDATE,
                from_instance="backend",  # Should match server._instance_id
                to_instance="orchestrator",
                timestamp=datetime(2026, 1, 25, 14, 0, 0, tzinfo=timezone.utc),
                requires_ack=False,
                payload=MessagePayload(
                    subject="Attribution Test",
                    description="Testing message attribution",
                ),
            )
            mock_client.publish_message = AsyncMock(return_value=mock_message)
            server._client = mock_client

            result = await server.coord_publish_message(
                msg_type="STATUS_UPDATE",
                subject="Attribution Test",
                description="Testing message attribution",
                to_instance="orchestrator",
                requires_ack=False,
            )

            # Verify the response includes the correct 'from' field
            assert result["success"] is True
            assert "from" in result
            assert result["from"] == "backend"
            assert result["from"] == server._instance_id

    @pytest.mark.asyncio
    async def test_published_message_from_field_matches_different_identities(
        self,
    ) -> None:
        """Test that 'from' field correctly reflects different instance identities.

        Each CLI role (frontend, orchestrator, devops) should have its own
        identity properly reflected in the 'from' field of published messages.
        """
        for instance_id in ["frontend", "orchestrator", "devops"]:
            with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": instance_id}):
                server = CoordinationMCPServer()
                assert server._instance_id == instance_id

                mock_client = AsyncMock()
                mock_message = CoordinationMessage(
                    id=f"msg-{instance_id}-test",
                    type=MessageType.GENERAL,
                    from_instance=instance_id,
                    to_instance="backend",
                    timestamp=datetime(2026, 1, 25, 14, 0, 0, tzinfo=timezone.utc),
                    requires_ack=True,
                    payload=MessagePayload(
                        subject=f"Test from {instance_id}",
                        description="Identity test",
                    ),
                )
                mock_client.publish_message = AsyncMock(return_value=mock_message)
                server._client = mock_client

                result = await server.coord_publish_message(
                    msg_type="GENERAL",
                    subject=f"Test from {instance_id}",
                    description="Identity test",
                    to_instance="backend",
                )

                assert result["success"] is True
                assert result["from"] == instance_id
                assert result["from"] == server._instance_id

    @pytest.mark.asyncio
    async def test_query_by_from_instance_filter_returns_matching_messages(
        self,
    ) -> None:
        """Test that querying with from_instance filter returns correctly filtered messages.

        When filtering messages by from_instance, only messages from the
        specified sender should be returned. This enables CLI instances to
        retrieve messages from a specific source.
        """
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "orchestrator"}):
            server = CoordinationMCPServer()

            # Create mock messages from different senders
            mock_messages = [
                CoordinationMessage(
                    id="msg-from-backend",
                    type=MessageType.READY_FOR_REVIEW,
                    from_instance="backend",
                    to_instance="orchestrator",
                    timestamp=datetime(2026, 1, 25, 14, 0, 0, tzinfo=timezone.utc),
                    requires_ack=True,
                    payload=MessagePayload(
                        subject="Backend ready",
                        description="Backend work complete",
                    ),
                ),
            ]

            mock_client = AsyncMock()
            mock_client.get_messages = AsyncMock(return_value=mock_messages)
            server._client = mock_client

            # Query messages from 'backend' specifically
            result = await server.coord_check_messages(
                from_instance="backend",
                pending_only=True,
            )

            assert result["success"] is True
            assert result["count"] == 1

            # Verify the query was constructed with from_instance filter
            call_args = mock_client.get_messages.call_args
            query = call_args[0][0]
            assert query.from_instance == "backend"

            # Verify the returned message has the expected from field
            # Note: to_dict() uses "from" as the key (not "from_instance")
            assert len(result["messages"]) == 1
            assert result["messages"][0]["from"] == "backend"

    @pytest.mark.asyncio
    async def test_query_by_from_instance_with_no_matches_returns_empty(self) -> None:
        """Test that querying with from_instance filter returns empty when no matches.

        When filtering by a from_instance that has no messages, the result
        should indicate success with an empty message list and count of 0.
        """
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "backend"}):
            server = CoordinationMCPServer()

            mock_client = AsyncMock()
            mock_client.get_messages = AsyncMock(return_value=[])
            server._client = mock_client

            # Query messages from 'devops' when none exist
            result = await server.coord_check_messages(
                from_instance="devops",
            )

            assert result["success"] is True
            assert result["count"] == 0
            assert len(result["messages"]) == 0

            # Verify the query included the from_instance filter
            call_args = mock_client.get_messages.call_args
            query = call_args[0][0]
            assert query.from_instance == "devops"

    @pytest.mark.asyncio
    async def test_publish_passes_instance_id_to_client(self) -> None:
        """Test that coord_publish_message passes self._instance_id to the client.

        The from_instance parameter passed to the coordination client's
        publish_message method should match the server's _instance_id.
        This ensures the attribution is set correctly at the client level.
        """
        with patch.dict("os.environ", {"CLAUDE_INSTANCE_ID": "frontend"}):
            server = CoordinationMCPServer()

            mock_client = AsyncMock()
            mock_message = CoordinationMessage(
                id="msg-client-test",
                type=MessageType.BLOCKING_ISSUE,
                from_instance="frontend",
                to_instance="backend",
                timestamp=datetime(2026, 1, 25, 14, 0, 0, tzinfo=timezone.utc),
                requires_ack=True,
                payload=MessagePayload(
                    subject="Blocked",
                    description="Need backend support",
                ),
            )
            mock_client.publish_message = AsyncMock(return_value=mock_message)
            server._client = mock_client

            await server.coord_publish_message(
                msg_type="BLOCKING_ISSUE",
                subject="Blocked",
                description="Need backend support",
                to_instance="backend",
            )

            # Verify the client was called with the correct from_instance
            mock_client.publish_message.assert_awaited_once()
            call_kwargs = mock_client.publish_message.call_args[1]
            assert call_kwargs["from_instance"] == "frontend"
            assert call_kwargs["from_instance"] == server._instance_id
