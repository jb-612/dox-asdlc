"""Tests for coordination MCP server."""

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

        assert len(schemas) == 4
        tool_names = [s["name"] for s in schemas]
        assert "coord_publish_message" in tool_names
        assert "coord_check_messages" in tool_names
        assert "coord_ack_message" in tool_names
        assert "coord_get_presence" in tool_names

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
        assert len(response["result"]["tools"]) == 4

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
