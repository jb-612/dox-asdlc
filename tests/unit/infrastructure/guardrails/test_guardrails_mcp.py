"""Unit tests for the Guardrails MCP server.

Tests the MCP protocol implementation for the guardrails_get_context tool.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.guardrails.models import (
    EvaluatedContext,
    EvaluatedGuideline,
    Guideline,
    GuidelineAction,
    GuidelineCategory,
    GuidelineCondition,
    TaskContext,
    ActionType,
)
from src.infrastructure.guardrails.guardrails_mcp import GuardrailsMCPServer


@pytest.fixture
def mock_evaluator():
    """Mock evaluator for testing."""
    evaluator = AsyncMock()
    evaluator.get_context = AsyncMock()
    return evaluator


@pytest.fixture
def mock_store():
    """Mock store for testing."""
    store = AsyncMock()
    return store


@pytest.fixture
def server():
    """Create a GuardrailsMCPServer instance for testing."""
    return GuardrailsMCPServer()


@pytest.fixture
def sample_guideline():
    """Create a sample guideline for testing."""
    from datetime import datetime, timezone

    return Guideline(
        id="test-guideline",
        name="Test Guideline",
        description="A test guideline",
        enabled=True,
        category=GuidelineCategory.COGNITIVE_ISOLATION,
        priority=100,
        condition=GuidelineCondition(
            agents=["backend"],
            domains=["P01"],
        ),
        action=GuidelineAction(
            type=ActionType.INSTRUCTION,
            instruction="Follow TDD protocol.",
            tools_allowed=["pytest"],
            tools_denied=["rm"],
        ),
        metadata={},
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        created_by="test",
    )


@pytest.fixture
def sample_evaluated_context(sample_guideline):
    """Create a sample evaluated context for testing."""
    context = TaskContext(
        agent="backend",
        domain="P01",
        action="implement",
    )
    evaluated_guideline = EvaluatedGuideline(
        guideline=sample_guideline,
        match_score=1.0,
        matched_fields=("agents", "domains"),
    )
    return EvaluatedContext(
        context=context,
        matched_guidelines=(evaluated_guideline,),
        combined_instruction="Follow TDD protocol.",
        tools_allowed=("pytest",),
        tools_denied=("rm",),
        hitl_gates=(),
    )


class TestGuardrailsGetContext:
    """Test the guardrails_get_context tool."""

    @pytest.mark.asyncio
    async def test_get_context_with_full_parameters(
        self, server, mock_evaluator, sample_evaluated_context
    ):
        """Test get_context with all parameters provided."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.get_context.return_value = sample_evaluated_context

        # Act
        result = await server.guardrails_get_context(
            agent="backend",
            domain="P01",
            action="implement",
            paths=["src/workers/test.py"],
            event="commit",
            gate_type="devops_invocation",
            session_id="test-session",
        )

        # Assert
        assert result["success"] is True
        assert result["matched_count"] == 1
        assert result["combined_instruction"] == "Follow TDD protocol."
        assert result["tools_allowed"] == ["pytest"]
        assert result["tools_denied"] == ["rm"]
        assert result["hitl_gates"] == []
        assert len(result["guidelines"]) == 1

        guideline_result = result["guidelines"][0]
        assert guideline_result["id"] == "test-guideline"
        assert guideline_result["name"] == "Test Guideline"
        assert guideline_result["priority"] == 100
        assert guideline_result["match_score"] == 1.0
        assert guideline_result["matched_fields"] == ["agents", "domains"]

        # Verify evaluator was called with correct context
        call_args = mock_evaluator.get_context.call_args[0][0]
        assert call_args.agent == "backend"
        assert call_args.domain == "P01"
        assert call_args.action == "implement"
        assert call_args.paths == ["src/workers/test.py"]
        assert call_args.event == "commit"
        assert call_args.gate_type == "devops_invocation"
        assert call_args.session_id == "test-session"

    @pytest.mark.asyncio
    async def test_get_context_with_minimal_parameters(
        self, server, mock_evaluator
    ):
        """Test get_context with only required agent parameter."""
        # Arrange
        context = TaskContext(agent="backend")
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )
        server._evaluator = mock_evaluator
        mock_evaluator.get_context.return_value = evaluated_context

        # Act
        result = await server.guardrails_get_context(agent="backend")

        # Assert
        assert result["success"] is True
        assert result["matched_count"] == 0
        assert result["combined_instruction"] == ""
        assert result["tools_allowed"] == []
        assert result["tools_denied"] == []
        assert result["hitl_gates"] == []
        assert result["guidelines"] == []

        # Verify evaluator was called with minimal context
        call_args = mock_evaluator.get_context.call_args[0][0]
        assert call_args.agent == "backend"
        assert call_args.domain is None
        assert call_args.action is None
        assert call_args.paths is None

    @pytest.mark.asyncio
    async def test_get_context_with_no_matching_guidelines(
        self, server, mock_evaluator
    ):
        """Test get_context when no guidelines match."""
        # Arrange
        context = TaskContext(agent="frontend", domain="P05")
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )
        server._evaluator = mock_evaluator
        mock_evaluator.get_context.return_value = evaluated_context

        # Act
        result = await server.guardrails_get_context(
            agent="frontend", domain="P05"
        )

        # Assert
        assert result["success"] is True
        assert result["matched_count"] == 0
        assert result["combined_instruction"] == ""
        assert result["tools_allowed"] == []
        assert result["tools_denied"] == []
        assert result["hitl_gates"] == []
        assert result["guidelines"] == []

    @pytest.mark.asyncio
    async def test_get_context_with_hitl_gates(
        self, server, mock_evaluator, sample_guideline
    ):
        """Test get_context when guidelines require HITL gates."""
        # Arrange
        # Create guideline with HITL gate
        guideline_with_gate = Guideline(
            id=sample_guideline.id,
            name=sample_guideline.name,
            description=sample_guideline.description,
            enabled=sample_guideline.enabled,
            category=sample_guideline.category,
            priority=sample_guideline.priority,
            condition=sample_guideline.condition,
            action=GuidelineAction(
                type=ActionType.HITL_GATE,
                gate_type="devops_invocation",
            ),
            metadata=sample_guideline.metadata,
            version=sample_guideline.version,
            created_at=sample_guideline.created_at,
            updated_at=sample_guideline.updated_at,
            created_by=sample_guideline.created_by,
        )

        context = TaskContext(agent="backend", domain="P01")
        evaluated_guideline = EvaluatedGuideline(
            guideline=guideline_with_gate,
            match_score=1.0,
            matched_fields=("agents", "domains"),
        )
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(evaluated_guideline,),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=("devops_invocation",),
        )
        server._evaluator = mock_evaluator
        mock_evaluator.get_context.return_value = evaluated_context

        # Act
        result = await server.guardrails_get_context(
            agent="backend", domain="P01"
        )

        # Assert
        assert result["success"] is True
        assert result["matched_count"] == 1
        assert result["hitl_gates"] == ["devops_invocation"]

    @pytest.mark.asyncio
    async def test_get_context_error_handling(self, server, mock_evaluator):
        """Test get_context when evaluator raises an exception."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.get_context.side_effect = Exception("Evaluator error")

        # Act
        result = await server.guardrails_get_context(agent="backend")

        # Assert
        assert result["success"] is False
        assert "error" in result
        assert "Evaluation failed" in result["error"]


class TestGetToolSchemas:
    """Test the get_tool_schemas method."""

    def test_get_tool_schemas(self, server):
        """Test that get_tool_schemas returns valid schema."""
        # Act
        schemas = server.get_tool_schemas()

        # Assert
        assert len(schemas) == 2

        # Find guardrails_get_context schema
        get_context_schema = next(
            s for s in schemas if s["name"] == "guardrails_get_context"
        )
        assert "description" in get_context_schema
        assert "inputSchema" in get_context_schema
        assert get_context_schema["inputSchema"]["type"] == "object"
        assert "properties" in get_context_schema["inputSchema"]

        # Check that required parameters are defined
        props = get_context_schema["inputSchema"]["properties"]
        assert "agent" in props
        assert "domain" in props
        assert "action" in props
        assert "paths" in props
        assert "event" in props
        assert "gate_type" in props
        assert "session_id" in props


class TestHandleRequest:
    """Test the handle_request method for MCP protocol compliance."""

    @pytest.mark.asyncio
    async def test_initialize_request(self, server):
        """Test handling initialize request."""
        # Arrange
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {},
        }

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 1
        assert "result" in response
        result = response["result"]
        assert result["protocolVersion"] == "2024-11-05"
        assert result["serverInfo"]["name"] == "guardrails-mcp-server"
        assert result["serverInfo"]["version"] == "1.0.0"
        assert "capabilities" in result
        assert "tools" in result["capabilities"]

    @pytest.mark.asyncio
    async def test_tools_list_request(self, server):
        """Test handling tools/list request."""
        # Arrange
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        }

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 2
        assert "result" in response
        assert "tools" in response["result"]
        tools = response["result"]["tools"]
        assert len(tools) == 2
        tool_names = [t["name"] for t in tools]
        assert "guardrails_get_context" in tool_names
        assert "guardrails_log_decision" in tool_names

    @pytest.mark.asyncio
    async def test_tools_call_request(self, server, mock_evaluator):
        """Test handling tools/call request."""
        # Arrange
        context = TaskContext(agent="backend")
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )
        server._evaluator = mock_evaluator
        mock_evaluator.get_context.return_value = evaluated_context

        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "guardrails_get_context",
                "arguments": {"agent": "backend"},
            },
        }

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 3
        assert "result" in response
        assert "content" in response["result"]
        assert len(response["result"]["content"]) == 1
        content = response["result"]["content"][0]
        assert content["type"] == "text"

        # Parse the JSON text to verify structure
        result_data = json.loads(content["text"])
        assert result_data["success"] is True
        assert result_data["matched_count"] == 0

    @pytest.mark.asyncio
    async def test_tools_call_unknown_tool(self, server):
        """Test handling tools/call with unknown tool name."""
        # Arrange
        request = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "unknown_tool",
                "arguments": {},
            },
        }

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 4
        assert "error" in response
        assert response["error"]["code"] == -32601
        assert "unknown_tool" in response["error"]["message"].lower()

    @pytest.mark.asyncio
    async def test_notifications_initialized(self, server):
        """Test handling notifications/initialized (no response)."""
        # Arrange
        request = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        }

        # Act
        response = await server.handle_request(request)

        # Assert (notification should return None)
        assert response is None

    @pytest.mark.asyncio
    async def test_unknown_method(self, server):
        """Test handling unknown method."""
        # Arrange
        request = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "unknown/method",
            "params": {},
        }

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 5
        assert "error" in response
        assert response["error"]["code"] == -32601
        assert "unknown method" in response["error"]["message"].lower()


class TestLazyInitialization:
    """Test lazy initialization of evaluator and store."""

    @pytest.mark.asyncio
    @patch("elasticsearch.AsyncElasticsearch")
    @patch("src.infrastructure.guardrails.guardrails_store.GuardrailsStore")
    @patch("src.core.guardrails.evaluator.GuardrailsEvaluator")
    async def test_lazy_initialization(
        self, mock_evaluator_class, mock_store_class, mock_es_class, monkeypatch
    ):
        """Test that evaluator is lazily initialized on first tool call."""
        # Arrange - set env vars BEFORE creating server
        monkeypatch.setenv("ELASTICSEARCH_URL", "http://test:9200")
        monkeypatch.setenv("GUARDRAILS_INDEX_PREFIX", "test-")
        monkeypatch.setenv("GUARDRAILS_CACHE_TTL", "120.0")

        # Create server AFTER env vars are set
        server = GuardrailsMCPServer()

        mock_es = AsyncMock()
        mock_es_class.return_value = mock_es
        mock_store = AsyncMock()
        mock_store_class.return_value = mock_store
        mock_evaluator = AsyncMock()
        mock_evaluator_class.return_value = mock_evaluator

        context = TaskContext(agent="backend")
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )
        mock_evaluator.get_context.return_value = evaluated_context

        # Verify evaluator is None initially
        assert server._evaluator is None
        assert server._store is None

        # Act
        await server.guardrails_get_context(agent="backend")

        # Assert initialization occurred
        mock_es_class.assert_called_once_with(hosts=["http://test:9200"])
        mock_store_class.assert_called_once_with(
            es_client=mock_es, index_prefix="test-"
        )
        mock_evaluator_class.assert_called_once_with(
            store=mock_store, cache_ttl=120.0
        )

        # Verify evaluator was set
        assert server._evaluator is mock_evaluator
        assert server._store is mock_store

    @pytest.mark.asyncio
    @patch("elasticsearch.AsyncElasticsearch")
    @patch("src.infrastructure.guardrails.guardrails_store.GuardrailsStore")
    @patch("src.core.guardrails.evaluator.GuardrailsEvaluator")
    async def test_evaluator_reused_after_initialization(
        self, mock_evaluator_class, mock_store_class, mock_es_class, server
    ):
        """Test that evaluator is reused and not recreated."""
        # Arrange
        mock_es = AsyncMock()
        mock_es_class.return_value = mock_es
        mock_store = AsyncMock()
        mock_store_class.return_value = mock_store
        mock_evaluator = AsyncMock()
        mock_evaluator_class.return_value = mock_evaluator

        context = TaskContext(agent="backend")
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )
        mock_evaluator.get_context.return_value = evaluated_context

        # Act - call twice
        await server.guardrails_get_context(agent="backend")
        await server.guardrails_get_context(agent="frontend")

        # Assert - only initialized once
        assert mock_es_class.call_count == 1
        assert mock_store_class.call_count == 1
        assert mock_evaluator_class.call_count == 1


class TestGuardrailsLogDecision:
    """Test the guardrails_log_decision tool."""

    @pytest.mark.asyncio
    async def test_log_approved_decision_with_full_context(
        self, server, mock_evaluator
    ):
        """Test logging approved decision with full context."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-entry-123"

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="test-guideline",
            result="approved",
            reason="User approved the operation",
            gate_type="devops_invocation",
            user_response="yes",
            agent="backend",
            domain="P01",
            action="implement",
            session_id="test-session-123",
        )

        # Assert
        assert result["success"] is True
        assert result["audit_id"] == "audit-entry-123"

        # Verify evaluator.log_decision was called with correct GateDecision
        call_args = mock_evaluator.log_decision.call_args[0][0]
        assert call_args.guideline_id == "test-guideline"
        assert call_args.gate_type == "devops_invocation"
        assert call_args.result == "approved"
        assert call_args.reason == "User approved the operation"
        assert call_args.user_response == "yes"
        assert call_args.context is not None
        assert call_args.context.agent == "backend"
        assert call_args.context.domain == "P01"
        assert call_args.context.action == "implement"
        assert call_args.context.session_id == "test-session-123"

    @pytest.mark.asyncio
    async def test_log_rejected_decision(self, server, mock_evaluator):
        """Test logging rejected decision."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-entry-456"

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="test-guideline-2",
            result="rejected",
            reason="User rejected the operation",
        )

        # Assert
        assert result["success"] is True
        assert result["audit_id"] == "audit-entry-456"

        # Verify decision
        call_args = mock_evaluator.log_decision.call_args[0][0]
        assert call_args.guideline_id == "test-guideline-2"
        assert call_args.result == "rejected"
        assert call_args.reason == "User rejected the operation"
        assert call_args.user_response == ""
        assert call_args.context is None

    @pytest.mark.asyncio
    async def test_log_with_user_response(self, server, mock_evaluator):
        """Test logging decision with user response."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-entry-789"

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="test-guideline-3",
            result="approved",
            reason="User chose to proceed",
            user_response="proceed with caution",
        )

        # Assert
        assert result["success"] is True
        assert result["audit_id"] == "audit-entry-789"

        call_args = mock_evaluator.log_decision.call_args[0][0]
        assert call_args.user_response == "proceed with caution"

    @pytest.mark.asyncio
    async def test_log_with_minimal_params(self, server, mock_evaluator):
        """Test logging with only required parameters."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-entry-minimal"

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="minimal-guideline",
            result="skipped",
            reason="Not applicable",
        )

        # Assert
        assert result["success"] is True
        assert result["audit_id"] == "audit-entry-minimal"

        call_args = mock_evaluator.log_decision.call_args[0][0]
        assert call_args.guideline_id == "minimal-guideline"
        assert call_args.result == "skipped"
        assert call_args.reason == "Not applicable"
        assert call_args.user_response == ""
        assert call_args.context is None

    @pytest.mark.asyncio
    async def test_log_decision_error_handling(self, server, mock_evaluator):
        """Test error handling when log_decision fails."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.side_effect = Exception(
            "Elasticsearch unavailable"
        )

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="test-guideline",
            result="approved",
            reason="Test reason",
        )

        # Assert
        assert result["success"] is False
        assert "error" in result
        assert "Decision logging failed" in result["error"]

    @pytest.mark.asyncio
    async def test_log_decision_with_gate_type(self, server, mock_evaluator):
        """Test that gate_type is passed through to GateDecision."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-gate-type-001"

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="hitl-gate-devops",
            result="approved",
            reason="User confirmed devops operation",
            gate_type="devops_invocation",
        )

        # Assert
        assert result["success"] is True
        assert result["audit_id"] == "audit-gate-type-001"

        # Verify gate_type is set on the GateDecision, not empty string
        call_args = mock_evaluator.log_decision.call_args[0][0]
        assert call_args.gate_type == "devops_invocation"

    @pytest.mark.asyncio
    async def test_log_decision_without_gate_type_defaults_empty(
        self, server, mock_evaluator
    ):
        """Test that gate_type defaults to empty string when not provided."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-no-gate"

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="some-guideline",
            result="skipped",
            reason="No gate needed",
        )

        # Assert
        assert result["success"] is True

        call_args = mock_evaluator.log_decision.call_args[0][0]
        assert call_args.gate_type == ""


class TestGetToolSchemasWithLogDecision:
    """Test that get_tool_schemas includes guardrails_log_decision."""

    def test_get_tool_schemas_includes_log_decision(self, server):
        """Test that get_tool_schemas includes guardrails_log_decision."""
        # Act
        schemas = server.get_tool_schemas()

        # Assert
        assert len(schemas) == 2
        schema_names = [s["name"] for s in schemas]
        assert "guardrails_get_context" in schema_names
        assert "guardrails_log_decision" in schema_names

        # Find the log_decision schema
        log_decision_schema = next(
            s for s in schemas if s["name"] == "guardrails_log_decision"
        )

        # Verify schema structure
        assert "description" in log_decision_schema
        assert "inputSchema" in log_decision_schema
        assert log_decision_schema["inputSchema"]["type"] == "object"

        # Check required fields
        props = log_decision_schema["inputSchema"]["properties"]
        assert "guideline_id" in props
        assert "result" in props
        assert "reason" in props
        assert "gate_type" in props
        assert "user_response" in props
        assert "agent" in props
        assert "domain" in props
        assert "action" in props
        assert "session_id" in props

        # Check required array
        required = log_decision_schema["inputSchema"]["required"]
        assert "guideline_id" in required
        assert "result" in required
        assert "reason" in required


class TestHandleRequestWithLogDecision:
    """Test handle_request routing to guardrails_log_decision."""

    @pytest.mark.asyncio
    async def test_tools_call_log_decision(self, server, mock_evaluator):
        """Test handling tools/call request for guardrails_log_decision."""
        # Arrange
        server._evaluator = mock_evaluator
        mock_evaluator.log_decision.return_value = "audit-entry-xyz"

        request = {
            "jsonrpc": "2.0",
            "id": 10,
            "method": "tools/call",
            "params": {
                "name": "guardrails_log_decision",
                "arguments": {
                    "guideline_id": "test-guideline",
                    "result": "approved",
                    "reason": "User approved",
                    "user_response": "yes",
                },
            },
        }

        # Act
        response = await server.handle_request(request)

        # Assert
        assert response is not None
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 10
        assert "result" in response
        assert "content" in response["result"]
        assert len(response["result"]["content"]) == 1
        content = response["result"]["content"][0]
        assert content["type"] == "text"

        # Parse the JSON text to verify structure
        result_data = json.loads(content["text"])
        assert result_data["success"] is True
        assert result_data["audit_id"] == "audit-entry-xyz"


# ---------------------------------------------------------------------------
# Tests for disabled guardrails
# ---------------------------------------------------------------------------


class TestDisabledGuardrails:
    """Test behavior when guardrails are disabled via config."""

    @pytest.mark.asyncio
    async def test_get_context_disabled_returns_permissive_empty(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """Test that get_context returns permissive empty result when disabled."""
        # Arrange - disable guardrails
        monkeypatch.setenv("GUARDRAILS_ENABLED", "false")
        server = GuardrailsMCPServer()

        # Act
        result = await server.guardrails_get_context(
            agent="backend",
            domain="P01",
            action="implement",
        )

        # Assert - permissive empty result
        assert result["success"] is True
        assert result["matched_count"] == 0
        assert result["combined_instruction"] == ""
        assert result["tools_allowed"] == []
        assert result["tools_denied"] == []
        assert result["hitl_gates"] == []
        assert result["guidelines"] == []

        # Ensure evaluator was never initialized
        assert server._evaluator is None

    @pytest.mark.asyncio
    async def test_log_decision_disabled_returns_noop(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """Test that log_decision returns no-op success when disabled."""
        # Arrange - disable guardrails
        monkeypatch.setenv("GUARDRAILS_ENABLED", "false")
        server = GuardrailsMCPServer()

        # Act
        result = await server.guardrails_log_decision(
            guideline_id="test-guideline",
            result="approved",
            reason="test",
        )

        # Assert - no-op success
        assert result["success"] is True
        assert result["audit_id"] == "disabled"

        # Ensure evaluator was never initialized
        assert server._evaluator is None

    @pytest.mark.asyncio
    async def test_disabled_via_zero(self, monkeypatch: pytest.MonkeyPatch):
        """Test that GUARDRAILS_ENABLED=0 disables guardrails."""
        # Arrange
        monkeypatch.setenv("GUARDRAILS_ENABLED", "0")
        server = GuardrailsMCPServer()

        # Act
        result = await server.guardrails_get_context(agent="backend")

        # Assert
        assert result["success"] is True
        assert result["matched_count"] == 0

    @pytest.mark.asyncio
    async def test_disabled_via_false_string(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """Test that GUARDRAILS_ENABLED=false (lowercase) disables."""
        # Arrange
        monkeypatch.setenv("GUARDRAILS_ENABLED", "false")
        server = GuardrailsMCPServer()

        # Act
        result = await server.guardrails_get_context(agent="backend")

        # Assert
        assert result["success"] is True
        assert result["matched_count"] == 0

    @pytest.mark.asyncio
    async def test_enabled_by_default(self, monkeypatch: pytest.MonkeyPatch):
        """Test that guardrails are enabled by default if env var not set."""
        # Arrange - clear GUARDRAILS_ENABLED
        monkeypatch.delenv("GUARDRAILS_ENABLED", raising=False)
        server = GuardrailsMCPServer()

        # Assert - config should show enabled=True
        assert server._config.enabled is True


class TestMCPServerShutdown:
    """Test that the MCP server properly cleans up ES connections on shutdown."""

    @pytest.mark.asyncio
    async def test_shutdown_closes_store(self, server, mock_store):
        """Test that shutdown calls close() on the store."""
        server._store = mock_store
        mock_store.close = AsyncMock()

        await server.shutdown()

        mock_store.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_shutdown_when_store_is_none(self, server):
        """Test that shutdown is safe when store was never initialized."""
        assert server._store is None
        # Should not raise
        await server.shutdown()

    @pytest.mark.asyncio
    async def test_shutdown_clears_evaluator_and_store(self, server, mock_store):
        """Test that shutdown resets the evaluator and store references."""
        server._store = mock_store
        server._evaluator = AsyncMock()
        mock_store.close = AsyncMock()

        await server.shutdown()

        assert server._store is None
        assert server._evaluator is None

    @pytest.mark.asyncio
    @patch("elasticsearch.AsyncElasticsearch")
    @patch("src.infrastructure.guardrails.guardrails_store.GuardrailsStore")
    @patch("src.core.guardrails.evaluator.GuardrailsEvaluator")
    async def test_lazy_init_then_shutdown_closes_es(
        self, mock_evaluator_class, mock_store_class, mock_es_class, server
    ):
        """Test that lazy init creates ES client and shutdown closes the store."""
        mock_es = AsyncMock()
        mock_es_class.return_value = mock_es
        mock_store_inst = AsyncMock()
        mock_store_inst.close = AsyncMock()
        mock_store_class.return_value = mock_store_inst
        mock_evaluator = AsyncMock()
        mock_evaluator_class.return_value = mock_evaluator

        context = TaskContext(agent="backend")
        evaluated_context = EvaluatedContext(
            context=context,
            matched_guidelines=(),
            combined_instruction="",
            tools_allowed=(),
            tools_denied=(),
            hitl_gates=(),
        )
        mock_evaluator.get_context.return_value = evaluated_context

        # Trigger lazy init
        await server.guardrails_get_context(agent="backend")
        assert server._store is not None

        # Shutdown
        await server.shutdown()

        mock_store_inst.close.assert_awaited_once()
        assert server._store is None
        assert server._evaluator is None
