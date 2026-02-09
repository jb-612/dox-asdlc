"""Integration tests for Guardrails MCP server.

Tests the full MCP protocol flow through handle_request, exercising the
complete chain: JSON-RPC -> handle_request -> tool method -> evaluator
-> store mock -> response.

These tests mock at the store level to test the full server-evaluator-store
integration without requiring a real Elasticsearch connection.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.core.guardrails.models import (
    ActionType,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
)
from src.infrastructure.guardrails.guardrails_mcp import GuardrailsMCPServer


def make_request(method: str, params: dict | None = None, request_id: int = 1) -> dict:
    """Build a JSON-RPC 2.0 request.

    Args:
        method: The RPC method name.
        params: Optional parameters dictionary.
        request_id: Request ID (default 1).

    Returns:
        JSON-RPC 2.0 request dictionary.
    """
    req: dict = {"jsonrpc": "2.0", "method": method, "id": request_id}
    if params:
        req["params"] = params
    return req


def make_tool_call(
    tool_name: str, arguments: dict | None = None, request_id: int = 1
) -> dict:
    """Build a tools/call JSON-RPC request.

    Args:
        tool_name: Name of the tool to call.
        arguments: Tool arguments (default empty dict).
        request_id: Request ID (default 1).

    Returns:
        JSON-RPC 2.0 tools/call request.
    """
    return make_request(
        "tools/call",
        {
            "name": tool_name,
            "arguments": arguments or {},
        },
        request_id,
    )


@pytest.fixture
def sample_guidelines() -> list[Guideline]:
    """Create sample guidelines for testing.

    Returns 3 guidelines:
    1. TDD protocol for backend (high priority 100)
    2. Path restriction for frontend (medium priority 50)
    3. HITL gate for devops invocation (low priority 10)
    """
    now = datetime.now(timezone.utc)

    tdd_guideline = Guideline(
        id="tdd-backend",
        name="TDD Protocol for Backend",
        description="Require TDD for backend implementation",
        enabled=True,
        category=GuidelineCategory.TDD_PROTOCOL,
        priority=100,
        condition=GuidelineCondition(
            agents=["backend"],
            domains=["P01", "P02", "P03"],
        ),
        action=GuidelineAction(
            type=ActionType.INSTRUCTION,
            instruction="Follow TDD protocol: Red, Green, Refactor.",
            tools_allowed=["pytest", "python"],
            tools_denied=["rm"],
        ),
        metadata={},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="test",
    )

    path_restriction_guideline = Guideline(
        id="path-frontend",
        name="Frontend Path Restriction",
        description="Frontend agents limited to UI paths",
        enabled=True,
        category=GuidelineCategory.CONTEXT_CONSTRAINT,
        priority=50,
        condition=GuidelineCondition(
            agents=["frontend"],
            paths=["src/hitl_ui/*", "docker/hitl-ui/*"],
        ),
        action=GuidelineAction(
            type=ActionType.TOOL_RESTRICTION,
            instruction="Frontend agents must only modify UI paths.",
            tools_allowed=["npm", "npx"],
            tools_denied=["kubectl", "docker"],
        ),
        metadata={},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="test",
    )

    hitl_gate_guideline = Guideline(
        id="hitl-devops",
        name="DevOps Invocation Gate",
        description="Require HITL confirmation for devops operations",
        enabled=True,
        category=GuidelineCategory.HITL_GATE,
        priority=10,
        condition=GuidelineCondition(
            gate_types=["devops_invocation"],
        ),
        action=GuidelineAction(
            type=ActionType.HITL_GATE,
            gate_type="devops_invocation",
        ),
        metadata={},
        version=1,
        created_at=now,
        updated_at=now,
        created_by="test",
    )

    return [tdd_guideline, path_restriction_guideline, hitl_gate_guideline]


@pytest.fixture
async def mock_server(sample_guidelines: list[Guideline]) -> GuardrailsMCPServer:
    """Create a server with mocked store but real evaluator.

    The store is mocked to return sample guidelines and audit IDs,
    but the evaluator logic runs for real to test the full chain.

    Args:
        sample_guidelines: Sample guidelines fixture.

    Returns:
        GuardrailsMCPServer with mocked store.
    """
    server = GuardrailsMCPServer()

    # Mock the store at the bottom of the chain
    mock_store = AsyncMock()
    mock_store.list_guidelines = AsyncMock(
        return_value=(sample_guidelines, len(sample_guidelines))
    )
    mock_store.log_audit_entry = AsyncMock(return_value="audit-entry-123")
    mock_store._ensure_indices_exist = AsyncMock()

    # Patch _get_evaluator to inject mock store but real evaluator
    with patch.object(server, "_get_evaluator") as mock_get_eval:
        # Import here to avoid circular imports
        from src.core.guardrails.evaluator import GuardrailsEvaluator

        # Create real evaluator with mock store
        evaluator = GuardrailsEvaluator(store=mock_store, cache_ttl=60.0)
        server._evaluator = evaluator
        server._store = mock_store
        mock_get_eval.return_value = evaluator

        yield server


class TestFullMCPFlowGetContext:
    """Test the full MCP request/response flow for get_context."""

    @pytest.mark.asyncio
    async def test_full_flow_backend_context_matches_tdd_guideline(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test full MCP flow for backend agent matching TDD guideline."""
        # Arrange - Build MCP request
        request = make_tool_call(
            "guardrails_get_context",
            {
                "agent": "backend",
                "domain": "P01",
                "action": "implement",
            },
        )

        # Act - Call handle_request (full MCP protocol)
        response = await mock_server.handle_request(request)

        # Assert - Verify MCP response structure
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 1
        assert "result" in response
        assert "content" in response["result"]
        assert len(response["result"]["content"]) == 1

        # Parse the tool result JSON
        content = response["result"]["content"][0]
        assert content["type"] == "text"
        result = json.loads(content["text"])

        # Verify tool result content
        assert result["success"] is True
        assert result["matched_count"] == 1
        assert "TDD protocol" in result["combined_instruction"]
        assert "pytest" in result["tools_allowed"]
        assert "python" in result["tools_allowed"]
        assert "rm" in result["tools_denied"]
        assert result["hitl_gates"] == []

        # Verify guideline details
        assert len(result["guidelines"]) == 1
        guideline = result["guidelines"][0]
        assert guideline["id"] == "tdd-backend"
        assert guideline["name"] == "TDD Protocol for Backend"
        assert guideline["priority"] == 100
        assert guideline["match_score"] == 1.0
        assert set(guideline["matched_fields"]) == {"agents", "domains"}

    @pytest.mark.asyncio
    async def test_full_flow_frontend_context_matches_path_restriction(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test full MCP flow for frontend agent with path matching."""
        # Arrange
        request = make_tool_call(
            "guardrails_get_context",
            {
                "agent": "frontend",
                "paths": ["src/hitl_ui/components/Button.tsx"],
            },
        )

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        assert result["success"] is True
        assert result["matched_count"] == 1
        assert "Frontend agents must only modify UI paths" in result[
            "combined_instruction"
        ]
        assert "npm" in result["tools_allowed"]
        assert "npx" in result["tools_allowed"]
        assert "kubectl" in result["tools_denied"]
        assert "docker" in result["tools_denied"]

        guideline = result["guidelines"][0]
        assert guideline["id"] == "path-frontend"
        assert set(guideline["matched_fields"]) == {"agents", "paths"}

    @pytest.mark.asyncio
    async def test_full_flow_hitl_gate_for_devops_invocation(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test full MCP flow for devops gate type."""
        # Arrange
        request = make_tool_call(
            "guardrails_get_context",
            {
                "agent": "backend",
                "gate_type": "devops_invocation",
            },
        )

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        assert result["success"] is True
        assert result["matched_count"] == 1
        assert "devops_invocation" in result["hitl_gates"]

        guideline = result["guidelines"][0]
        assert guideline["id"] == "hitl-devops"
        assert set(guideline["matched_fields"]) == {"gate_types"}


class TestFullMCPFlowLogDecision:
    """Test the full MCP request/response flow for log_decision."""

    @pytest.mark.asyncio
    async def test_full_flow_log_approved_decision(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test full MCP flow for logging approved decision."""
        # Arrange
        request = make_tool_call(
            "guardrails_log_decision",
            {
                "guideline_id": "tdd-backend",
                "result": "approved",
                "reason": "User confirmed TDD approach",
                "user_response": "yes, proceed with TDD",
                "agent": "backend",
                "domain": "P01",
                "session_id": "test-session-123",
            },
        )

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert "result" in response

        result = json.loads(response["result"]["content"][0]["text"])
        assert result["success"] is True
        assert result["audit_id"] == "audit-entry-123"

        # Verify store was called
        mock_server._store.log_audit_entry.assert_called_once()
        audit_entry = mock_server._store.log_audit_entry.call_args[0][0]
        assert audit_entry["event_type"] == "gate_decision"
        assert audit_entry["guideline_id"] == "tdd-backend"
        assert audit_entry["decision"]["result"] == "approved"
        assert audit_entry["decision"]["reason"] == "User confirmed TDD approach"
        assert audit_entry["decision"]["user_response"] == "yes, proceed with TDD"
        assert audit_entry["context"]["agent"] == "backend"
        assert audit_entry["context"]["domain"] == "P01"

    @pytest.mark.asyncio
    async def test_full_flow_log_rejected_decision_minimal(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test full MCP flow for logging rejected decision with minimal params."""
        # Arrange
        request = make_tool_call(
            "guardrails_log_decision",
            {
                "guideline_id": "hitl-devops",
                "result": "rejected",
                "reason": "User declined devops operation",
            },
        )

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])
        assert result["success"] is True
        assert result["audit_id"] == "audit-entry-123"


class TestToolListIntegration:
    """Test tools/list includes both guardrails tools."""

    @pytest.mark.asyncio
    async def test_tools_list_includes_both_tools(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test tools/list MCP request returns both guardrails tools."""
        # Arrange
        request = make_request("tools/list")

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert "result" in response
        assert "tools" in response["result"]

        tools = response["result"]["tools"]
        assert len(tools) == 2

        tool_names = {t["name"] for t in tools}
        assert "guardrails_get_context" in tool_names
        assert "guardrails_log_decision" in tool_names

        # Verify schemas have required fields
        for tool in tools:
            assert "name" in tool
            assert "description" in tool
            assert "inputSchema" in tool
            assert tool["inputSchema"]["type"] == "object"


class TestInitializeHandshake:
    """Test the MCP initialize handshake."""

    @pytest.mark.asyncio
    async def test_initialize_returns_server_info(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test initialize MCP request returns correct server info."""
        # Arrange
        request = make_request("initialize", {"clientInfo": {"name": "test-client"}})

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert "result" in response

        result = response["result"]
        assert result["protocolVersion"] == "2024-11-05"
        assert result["serverInfo"]["name"] == "guardrails-mcp-server"
        assert result["serverInfo"]["version"] == "1.0.0"
        assert "capabilities" in result
        assert "tools" in result["capabilities"]


class TestNoMatchingGuidelines:
    """Test behavior when no guidelines match the context."""

    @pytest.mark.asyncio
    async def test_no_matching_guidelines_returns_empty(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test get_context when no guidelines match returns empty result."""
        # Arrange - Use an agent that doesn't match any conditions
        request = make_tool_call(
            "guardrails_get_context",
            {
                "agent": "orchestrator",
                "domain": "P99",  # Non-existent domain
            },
        )

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        assert result["success"] is True
        assert result["matched_count"] == 0
        assert result["combined_instruction"] == ""
        assert result["tools_allowed"] == []
        assert result["tools_denied"] == []
        assert result["hitl_gates"] == []
        assert result["guidelines"] == []


class TestMultipleMatchingGuidelines:
    """Test conflict resolution when multiple guidelines match."""

    @pytest.fixture
    def multi_match_guidelines(self) -> list[Guideline]:
        """Create guidelines that can match the same context with different priorities."""
        now = datetime.now(timezone.utc)

        high_priority = Guideline(
            id="high-priority",
            name="High Priority Instruction",
            description="High priority guideline",
            enabled=True,
            category=GuidelineCategory.TDD_PROTOCOL,
            priority=200,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.INSTRUCTION,
                instruction="High priority instruction.",
                tools_allowed=["pytest", "git"],
                tools_denied=["rm"],
            ),
            metadata={},
            version=1,
            created_at=now,
            updated_at=now,
            created_by="test",
        )

        low_priority = Guideline(
            id="low-priority",
            name="Low Priority Instruction",
            description="Low priority guideline",
            enabled=True,
            category=GuidelineCategory.CONTEXT_CONSTRAINT,
            priority=50,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.INSTRUCTION,
                instruction="Low priority instruction.",
                tools_allowed=["python"],
                tools_denied=["docker"],
            ),
            metadata={},
            version=1,
            created_at=now,
            updated_at=now,
            created_by="test",
        )

        return [high_priority, low_priority]

    @pytest.mark.asyncio
    async def test_multiple_guidelines_sorted_by_priority(
        self, multi_match_guidelines: list[Guideline]
    ):
        """Test that multiple matching guidelines are sorted by priority."""
        # Arrange - Create server with multi-match guidelines
        server = GuardrailsMCPServer()
        mock_store = AsyncMock()
        mock_store.list_guidelines = AsyncMock(
            return_value=(multi_match_guidelines, len(multi_match_guidelines))
        )
        mock_store._ensure_indices_exist = AsyncMock()

        from src.core.guardrails.evaluator import GuardrailsEvaluator

        evaluator = GuardrailsEvaluator(store=mock_store, cache_ttl=60.0)
        server._evaluator = evaluator
        server._store = mock_store

        request = make_tool_call(
            "guardrails_get_context",
            {"agent": "backend"},
        )

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        assert result["success"] is True
        assert result["matched_count"] == 2

        # Verify instructions concatenated in priority order (high to low)
        assert (
            result["combined_instruction"]
            == "High priority instruction.\n\nLow priority instruction."
        )

        # Verify tools merged as union
        assert set(result["tools_allowed"]) == {"pytest", "git", "python"}

        # Verify tools_denied wins over tools_allowed
        assert set(result["tools_denied"]) == {"rm", "docker"}

        # Verify guidelines returned in priority order
        guidelines = result["guidelines"]
        assert len(guidelines) == 2
        assert guidelines[0]["id"] == "high-priority"
        assert guidelines[0]["priority"] == 200
        assert guidelines[1]["id"] == "low-priority"
        assert guidelines[1]["priority"] == 50

    @pytest.mark.asyncio
    async def test_tools_denied_overrides_tools_allowed(
        self, multi_match_guidelines: list[Guideline]
    ):
        """Test that tools_denied always wins over tools_allowed in conflicts."""
        # Arrange - Create guidelines where same tool appears in both lists
        now = datetime.now(timezone.utc)

        allow_docker = Guideline(
            id="allow-docker",
            name="Allow Docker",
            description="Allows docker",
            enabled=True,
            category=GuidelineCategory.TDD_PROTOCOL,
            priority=100,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.INSTRUCTION,
                instruction="Docker allowed.",
                tools_allowed=["docker"],
            ),
            metadata={},
            version=1,
            created_at=now,
            updated_at=now,
            created_by="test",
        )

        deny_docker = Guideline(
            id="deny-docker",
            name="Deny Docker",
            description="Denies docker",
            enabled=True,
            category=GuidelineCategory.SECURITY,
            priority=50,
            condition=GuidelineCondition(agents=["backend"]),
            action=GuidelineAction(
                type=ActionType.TOOL_RESTRICTION,
                instruction="Docker denied.",
                tools_denied=["docker"],
            ),
            metadata={},
            version=1,
            created_at=now,
            updated_at=now,
            created_by="test",
        )

        guidelines = [allow_docker, deny_docker]

        # Create server
        server = GuardrailsMCPServer()
        mock_store = AsyncMock()
        mock_store.list_guidelines = AsyncMock(return_value=(guidelines, len(guidelines)))
        mock_store._ensure_indices_exist = AsyncMock()

        from src.core.guardrails.evaluator import GuardrailsEvaluator

        evaluator = GuardrailsEvaluator(store=mock_store, cache_ttl=60.0)
        server._evaluator = evaluator
        server._store = mock_store

        request = make_tool_call("guardrails_get_context", {"agent": "backend"})

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        # Docker should NOT be in allowed (deny wins)
        assert "docker" not in result["tools_allowed"]
        assert "docker" in result["tools_denied"]


class TestErrorPropagation:
    """Test that errors are properly propagated through the MCP protocol."""

    @pytest.mark.asyncio
    async def test_store_exception_returns_error_response(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test that store exception results in MCP error response."""
        # Arrange - Make store raise exception
        mock_server._store.list_guidelines.side_effect = Exception(
            "Elasticsearch connection failed"
        )

        request = make_tool_call("guardrails_get_context", {"agent": "backend"})

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        assert result["success"] is False
        assert "error" in result
        assert "Elasticsearch connection failed" in result["error"]

    @pytest.mark.asyncio
    async def test_log_decision_store_error(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test that log_decision handles store errors gracefully."""
        # Arrange
        mock_server._store.log_audit_entry.side_effect = Exception("Audit log failed")

        request = make_tool_call(
            "guardrails_log_decision",
            {
                "guideline_id": "test",
                "result": "approved",
                "reason": "test",
            },
        )

        # Act
        response = await mock_server.handle_request(request)

        # Assert
        assert response is not None
        result = json.loads(response["result"]["content"][0]["text"])

        assert result["success"] is False
        assert "error" in result
        assert "Audit log failed" in result["error"]


class TestAuditLogStructure:
    """Test the structure of audit log entries created after log_decision."""

    @pytest.mark.asyncio
    async def test_audit_entry_structure_with_full_context(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test that audit entry has correct structure with full context."""
        # Arrange
        request = make_tool_call(
            "guardrails_log_decision",
            {
                "guideline_id": "test-guideline",
                "result": "approved",
                "reason": "User approved",
                "user_response": "yes",
                "agent": "backend",
                "domain": "P01",
                "action": "implement",
                "session_id": "session-123",
            },
        )

        # Act
        await mock_server.handle_request(request)

        # Assert - Verify audit entry structure
        mock_server._store.log_audit_entry.assert_called_once()
        audit_entry = mock_server._store.log_audit_entry.call_args[0][0]

        # Required fields
        assert audit_entry["event_type"] == "gate_decision"
        assert audit_entry["guideline_id"] == "test-guideline"
        assert "timestamp" in audit_entry

        # Decision details
        assert audit_entry["decision"]["result"] == "approved"
        assert audit_entry["decision"]["reason"] == "User approved"
        assert audit_entry["decision"]["user_response"] == "yes"

        # Context details
        assert audit_entry["context"]["agent"] == "backend"
        assert audit_entry["context"]["domain"] == "P01"
        assert audit_entry["context"]["action"] == "implement"
        assert audit_entry["context"]["session_id"] == "session-123"

    @pytest.mark.asyncio
    async def test_audit_entry_without_optional_context(
        self, mock_server: GuardrailsMCPServer
    ):
        """Test audit entry with minimal required fields only."""
        # Arrange
        request = make_tool_call(
            "guardrails_log_decision",
            {
                "guideline_id": "minimal-test",
                "result": "skipped",
                "reason": "Not applicable",
            },
        )

        # Act
        await mock_server.handle_request(request)

        # Assert
        mock_server._store.log_audit_entry.assert_called_once()
        audit_entry = mock_server._store.log_audit_entry.call_args[0][0]

        assert audit_entry["event_type"] == "gate_decision"
        assert audit_entry["guideline_id"] == "minimal-test"
        assert audit_entry["decision"]["result"] == "skipped"
        assert audit_entry["decision"]["reason"] == "Not applicable"

        # Context should not be present when no context fields provided
        assert "context" not in audit_entry
