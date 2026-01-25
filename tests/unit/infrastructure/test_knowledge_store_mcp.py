"""Tests for KnowledgeStore MCP server.

Tests cover:
- Tool schema definitions (T12)
- ks_health tool (T14)
- ks_search tool (T16)
- ks_get tool (T18)
- ks_index tool (T20)
- Request handling (T21)
"""

from unittest.mock import AsyncMock

import pytest

from src.infrastructure.knowledge_store.models import Document, SearchResult


class TestKnowledgeStoreMCPServerSchemas:
    """Tests for MCP server schema definitions (T12)."""

    @pytest.fixture
    def server(self):
        """Create test server."""
        from src.infrastructure.knowledge_store.mcp_server import (
            KnowledgeStoreMCPServer,
        )

        return KnowledgeStoreMCPServer()

    def test_get_tool_schemas_returns_list(self, server) -> None:
        """Test that tool schemas are returned as a list."""
        schemas = server.get_tool_schemas()

        assert isinstance(schemas, list)
        assert len(schemas) == 4

    def test_get_tool_schemas_contains_expected_tools(self, server) -> None:
        """Test that all expected tools are present."""
        schemas = server.get_tool_schemas()
        tool_names = [s["name"] for s in schemas]

        assert "ks_health" in tool_names
        assert "ks_search" in tool_names
        assert "ks_get" in tool_names
        assert "ks_index" in tool_names

    def test_ks_search_schema_structure(self, server) -> None:
        """Test ks_search schema has required fields."""
        schemas = server.get_tool_schemas()
        search_schema = next(s for s in schemas if s["name"] == "ks_search")

        assert "inputSchema" in search_schema
        assert "properties" in search_schema["inputSchema"]
        assert "query" in search_schema["inputSchema"]["properties"]
        assert "required" in search_schema["inputSchema"]
        assert "query" in search_schema["inputSchema"]["required"]

    def test_ks_get_schema_structure(self, server) -> None:
        """Test ks_get schema requires doc_id."""
        schemas = server.get_tool_schemas()
        get_schema = next(s for s in schemas if s["name"] == "ks_get")

        assert "doc_id" in get_schema["inputSchema"]["required"]

    def test_ks_index_schema_structure(self, server) -> None:
        """Test ks_index schema requires doc_id and content."""
        schemas = server.get_tool_schemas()
        index_schema = next(s for s in schemas if s["name"] == "ks_index")

        assert "doc_id" in index_schema["inputSchema"]["required"]
        assert "content" in index_schema["inputSchema"]["required"]

    def test_ks_health_schema_structure(self, server) -> None:
        """Test ks_health schema has no required fields."""
        schemas = server.get_tool_schemas()
        health_schema = next(s for s in schemas if s["name"] == "ks_health")

        assert "inputSchema" in health_schema
        # ks_health has no required fields
        assert "required" not in health_schema["inputSchema"] or len(
            health_schema["inputSchema"].get("required", [])
        ) == 0


class TestKnowledgeStoreMCPServerHealth:
    """Tests for ks_health tool (T14)."""

    @pytest.fixture
    def server(self):
        """Create test server."""
        from src.infrastructure.knowledge_store.mcp_server import (
            KnowledgeStoreMCPServer,
        )

        return KnowledgeStoreMCPServer()

    @pytest.fixture
    def mock_store(self) -> AsyncMock:
        """Create mock store."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_ks_health_healthy_response(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test health check returns healthy status."""
        mock_store.health_check = AsyncMock(
            return_value={
                "status": "healthy",
                "backend": "elasticsearch",
                "url": "http://localhost:9200",
                "cluster_status": "green",
            }
        )
        server._store = mock_store

        result = await server.ks_health()

        assert result["success"] is True
        assert result["status"] == "healthy"
        assert result["backend"] == "elasticsearch"
        mock_store.health_check.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ks_health_unhealthy_response(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test health check returns unhealthy status."""
        mock_store.health_check = AsyncMock(
            return_value={
                "status": "unhealthy",
                "backend": "elasticsearch",
                "error": "Connection refused",
            }
        )
        server._store = mock_store

        result = await server.ks_health()

        assert result["success"] is True
        assert result["status"] == "unhealthy"
        assert "error" in result

    @pytest.mark.asyncio
    async def test_ks_health_connection_error(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test health check handles connection error."""
        mock_store.health_check = AsyncMock(
            side_effect=Exception("Connection failed")
        )
        server._store = mock_store

        result = await server.ks_health()

        assert result["success"] is False
        assert "Connection failed" in result["error"]


class TestKnowledgeStoreMCPServerSearch:
    """Tests for ks_search tool (T16)."""

    @pytest.fixture
    def server(self):
        """Create test server."""
        from src.infrastructure.knowledge_store.mcp_server import (
            KnowledgeStoreMCPServer,
        )

        return KnowledgeStoreMCPServer()

    @pytest.fixture
    def mock_store(self) -> AsyncMock:
        """Create mock store."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_ks_search_basic_query(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test basic search query."""
        mock_results = [
            SearchResult(
                doc_id="src/core/interfaces.py:0",
                content="class KnowledgeStore:",
                score=0.95,
                metadata={"file_path": "src/core/interfaces.py", "file_type": ".py"},
            ),
        ]
        mock_store.search = AsyncMock(return_value=mock_results)
        server._store = mock_store

        result = await server.ks_search(query="KnowledgeStore interface")

        assert result["success"] is True
        assert result["count"] == 1
        assert len(result["results"]) == 1
        assert result["results"][0]["doc_id"] == "src/core/interfaces.py:0"
        mock_store.search.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ks_search_with_filters(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test search with file_type filter."""
        mock_store.search = AsyncMock(return_value=[])
        server._store = mock_store

        result = await server.ks_search(
            query="test query",
            top_k=5,
            filters={"file_type": ".py"},
        )

        assert result["success"] is True
        call_args = mock_store.search.call_args
        assert call_args[1].get("top_k") == 5 or call_args[0][1] == 5
        # Verify filters were passed
        call_kwargs = call_args[1] if call_args[1] else {}
        if "filters" in call_kwargs:
            assert call_kwargs["filters"]["file_type"] == ".py"

    @pytest.mark.asyncio
    async def test_ks_search_empty_results(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test search with no results."""
        mock_store.search = AsyncMock(return_value=[])
        server._store = mock_store

        result = await server.ks_search(query="nonexistent term xyz123")

        assert result["success"] is True
        assert result["count"] == 0
        assert result["results"] == []

    @pytest.mark.asyncio
    async def test_ks_search_error_handling(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test search error handling."""
        from src.core.exceptions import SearchError

        mock_store.search = AsyncMock(side_effect=SearchError("Search failed"))
        server._store = mock_store

        result = await server.ks_search(query="test")

        assert result["success"] is False
        assert "Search failed" in result["error"]


class TestKnowledgeStoreMCPServerGet:
    """Tests for ks_get tool (T18)."""

    @pytest.fixture
    def server(self):
        """Create test server."""
        from src.infrastructure.knowledge_store.mcp_server import (
            KnowledgeStoreMCPServer,
        )

        return KnowledgeStoreMCPServer()

    @pytest.fixture
    def mock_store(self) -> AsyncMock:
        """Create mock store."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_ks_get_success(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test successful document retrieval."""
        mock_doc = Document(
            doc_id="src/core/interfaces.py:0",
            content="class KnowledgeStore:",
            metadata={"file_path": "src/core/interfaces.py"},
        )
        mock_store.get_by_id = AsyncMock(return_value=mock_doc)
        server._store = mock_store

        result = await server.ks_get(doc_id="src/core/interfaces.py:0")

        assert result["success"] is True
        assert result["doc_id"] == "src/core/interfaces.py:0"
        assert "class KnowledgeStore:" in result["content"]
        mock_store.get_by_id.assert_awaited_once_with("src/core/interfaces.py:0")

    @pytest.mark.asyncio
    async def test_ks_get_not_found(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test document not found."""
        mock_store.get_by_id = AsyncMock(return_value=None)
        server._store = mock_store

        result = await server.ks_get(doc_id="nonexistent:0")

        assert result["success"] is False
        assert "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_ks_get_error_handling(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test get error handling."""
        from src.core.exceptions import BackendConnectionError

        mock_store.get_by_id = AsyncMock(
            side_effect=BackendConnectionError("Connection lost")
        )
        server._store = mock_store

        result = await server.ks_get(doc_id="test:0")

        assert result["success"] is False
        assert "Connection lost" in result["error"]


class TestKnowledgeStoreMCPServerIndex:
    """Tests for ks_index tool (T20)."""

    @pytest.fixture
    def server(self):
        """Create test server."""
        from src.infrastructure.knowledge_store.mcp_server import (
            KnowledgeStoreMCPServer,
        )

        return KnowledgeStoreMCPServer()

    @pytest.fixture
    def mock_store(self) -> AsyncMock:
        """Create mock store."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_ks_index_success(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test successful document indexing."""
        mock_store.index_document = AsyncMock(return_value="test-doc:0")
        server._store = mock_store

        result = await server.ks_index(
            doc_id="test-doc:0",
            content="Test content for indexing",
        )

        assert result["success"] is True
        assert result["doc_id"] == "test-doc:0"
        mock_store.index_document.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ks_index_with_metadata(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test indexing with metadata."""
        mock_store.index_document = AsyncMock(return_value="test-doc:0")
        server._store = mock_store

        result = await server.ks_index(
            doc_id="test-doc:0",
            content="Test content",
            metadata={"file_path": "test.py", "file_type": ".py"},
        )

        assert result["success"] is True
        # Verify document was created with metadata
        call_args = mock_store.index_document.call_args
        doc = call_args[0][0]
        assert doc.metadata["file_path"] == "test.py"

    @pytest.mark.asyncio
    async def test_ks_index_error_handling(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test index error handling."""
        from src.core.exceptions import IndexingError

        mock_store.index_document = AsyncMock(
            side_effect=IndexingError("Indexing failed")
        )
        server._store = mock_store

        result = await server.ks_index(
            doc_id="test:0",
            content="Content",
        )

        assert result["success"] is False
        assert "Indexing failed" in result["error"]


class TestKnowledgeStoreMCPServerRequestHandling:
    """Tests for MCP request handling (T21)."""

    @pytest.fixture
    def server(self):
        """Create test server."""
        from src.infrastructure.knowledge_store.mcp_server import (
            KnowledgeStoreMCPServer,
        )

        return KnowledgeStoreMCPServer()

    @pytest.fixture
    def mock_store(self) -> AsyncMock:
        """Create mock store."""
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_handle_initialize(self, server) -> None:
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
        assert response["result"]["serverInfo"]["name"] == "knowledge-store-mcp-server"

    @pytest.mark.asyncio
    async def test_handle_tools_list(self, server) -> None:
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
    async def test_handle_tools_call_health(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test handling tools/call for ks_health."""
        mock_store.health_check = AsyncMock(
            return_value={"status": "healthy", "backend": "elasticsearch"}
        )
        server._store = mock_store

        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "ks_health",
                "arguments": {},
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 3
        assert "result" in response
        assert response["result"]["content"][0]["type"] == "text"

    @pytest.mark.asyncio
    async def test_handle_tools_call_search(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test handling tools/call for ks_search."""
        mock_store.search = AsyncMock(return_value=[])
        server._store = mock_store

        request = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "ks_search",
                "arguments": {"query": "test query"},
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 4
        assert "result" in response

    @pytest.mark.asyncio
    async def test_handle_tools_call_get(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test handling tools/call for ks_get."""
        mock_doc = Document(
            doc_id="test:0",
            content="Test content",
            metadata={},
        )
        mock_store.get_by_id = AsyncMock(return_value=mock_doc)
        server._store = mock_store

        request = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "ks_get",
                "arguments": {"doc_id": "test:0"},
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 5
        assert "result" in response

    @pytest.mark.asyncio
    async def test_handle_tools_call_index(
        self,
        server,
        mock_store: AsyncMock,
    ) -> None:
        """Test handling tools/call for ks_index."""
        mock_store.index_document = AsyncMock(return_value="test:0")
        server._store = mock_store

        request = {
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "ks_index",
                "arguments": {
                    "doc_id": "test:0",
                    "content": "Test content",
                },
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 6
        assert "result" in response

    @pytest.mark.asyncio
    async def test_handle_unknown_tool(self, server) -> None:
        """Test handling unknown tool call."""
        request = {
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "unknown_tool",
                "arguments": {},
            },
        }

        response = await server.handle_request(request)

        assert response["id"] == 7
        assert "error" in response
        assert "Unknown tool" in response["error"]["message"]

    @pytest.mark.asyncio
    async def test_handle_unknown_method(self, server) -> None:
        """Test handling unknown method."""
        request = {
            "jsonrpc": "2.0",
            "id": 8,
            "method": "unknown/method",
            "params": {},
        }

        response = await server.handle_request(request)

        assert response["id"] == 8
        assert "error" in response
        assert "Unknown method" in response["error"]["message"]

    @pytest.mark.asyncio
    async def test_handle_notification(self, server) -> None:
        """Test handling notification (no response needed)."""
        request = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        }

        response = await server.handle_request(request)

        assert response is None
