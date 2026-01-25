"""MCP server for KnowledgeStore tools.

Exposes KnowledgeStore functionality as MCP tools that can be invoked
by Claude Code. This provides semantic search and document retrieval
capabilities through the KnowledgeStore interface.

Tools exposed:
    - ks_health: Check KnowledgeStore health status
    - ks_search: Semantic search for documents
    - ks_get: Retrieve document by ID
    - ks_index: Index a document
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any

from src.infrastructure.knowledge_store.config import KnowledgeStoreConfig
from src.infrastructure.knowledge_store.models import Document

logger = logging.getLogger(__name__)


class KnowledgeStoreMCPServer:
    """MCP server providing KnowledgeStore tools.

    Exposes four tools for Claude Code to interact with the KnowledgeStore:
    - ks_health: Check health status of the knowledge store backend
    - ks_search: Semantic search for documents using embeddings
    - ks_get: Retrieve a specific document by its ID
    - ks_index: Index a new document in the knowledge store

    This server uses stdio transport and runs as a subprocess of Claude Code.

    Example:
        ```python
        server = KnowledgeStoreMCPServer()
        await server.run_stdio()
        ```
    """

    def __init__(self) -> None:
        """Initialize the MCP server.

        Creates the server with lazy store initialization. The store
        is only created when first needed to avoid connection overhead
        if tools are never called.
        """
        self._store: Any = None
        self._config = KnowledgeStoreConfig.from_env()

    async def _get_store(self) -> Any:
        """Get or create the KnowledgeStore client.

        Returns:
            ElasticsearchStore: The store instance for operations.
        """
        if self._store is None:
            # Lazy import to avoid requiring elasticsearch at module load
            from src.infrastructure.knowledge_store.elasticsearch_store import (
                ElasticsearchStore,
            )

            self._store = ElasticsearchStore(self._config)
        return self._store

    async def ks_health(self) -> dict[str, Any]:
        """Check KnowledgeStore health status.

        Returns the health status of the Elasticsearch backend including
        cluster status, connection URL, and index information.

        Returns:
            Dict with health information:
                - success: True if health check completed
                - status: "healthy" or "unhealthy"
                - backend: Backend type (elasticsearch)
                - url: Connection URL
                - cluster_status: Elasticsearch cluster status
                - error: Error message if unhealthy

        Example response:
            {
                "success": true,
                "status": "healthy",
                "backend": "elasticsearch",
                "url": "http://localhost:9200",
                "cluster_status": "green"
            }
        """
        try:
            store = await self._get_store()
            health = await store.health_check()

            return {
                "success": True,
                **health,
            }

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def ks_search(
        self,
        query: str,
        top_k: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Search for documents similar to the query.

        Performs semantic search using embeddings to find documents
        that are semantically similar to the query text.

        Args:
            query: Natural language search query.
            top_k: Maximum number of results to return (default: 10).
            filters: Optional metadata filters to apply (e.g., file_type, path).

        Returns:
            Dict with search results:
                - success: True if search completed
                - count: Number of results found
                - results: List of matching documents with scores
                - error: Error message if search failed

        Example response:
            {
                "success": true,
                "count": 2,
                "results": [
                    {
                        "doc_id": "src/core/interfaces.py:0",
                        "content": "...",
                        "score": 0.89,
                        "metadata": {"file_path": "...", "file_type": ".py"}
                    }
                ]
            }
        """
        try:
            store = await self._get_store()
            results = await store.search(
                query=query,
                top_k=top_k,
                filters=filters,
            )

            return {
                "success": True,
                "count": len(results),
                "results": [result.to_dict() for result in results],
            }

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def ks_get(self, doc_id: str) -> dict[str, Any]:
        """Retrieve a document by its ID.

        Fetches a specific document from the knowledge store by its
        unique identifier.

        Args:
            doc_id: The document ID (format: path/to/file.py:chunk_index)

        Returns:
            Dict with document data:
                - success: True if document found
                - doc_id: The document ID
                - content: Document text content
                - metadata: Document metadata
                - error: Error message if not found

        Example response:
            {
                "success": true,
                "doc_id": "src/core/interfaces.py:0",
                "content": "class KnowledgeStore:...",
                "metadata": {"file_path": "src/core/interfaces.py"}
            }
        """
        try:
            store = await self._get_store()
            document = await store.get_by_id(doc_id)

            if document is None:
                return {
                    "success": False,
                    "error": f"Document not found: {doc_id}",
                }

            return {
                "success": True,
                "doc_id": document.doc_id,
                "content": document.content,
                "metadata": document.metadata,
            }

        except Exception as e:
            logger.error(f"Get document failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def ks_index(
        self,
        doc_id: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Index a document in the KnowledgeStore.

        Adds a new document or updates an existing document with the
        same doc_id. The document content is embedded and stored for
        semantic search.

        Args:
            doc_id: Unique document identifier.
            content: Document text content.
            metadata: Optional metadata (file_path, file_type, etc.).

        Returns:
            Dict with indexing result:
                - success: True if indexing succeeded
                - doc_id: The indexed document ID
                - error: Error message if indexing failed

        Example response:
            {
                "success": true,
                "doc_id": "custom-doc:0"
            }
        """
        try:
            store = await self._get_store()
            document = Document(
                doc_id=doc_id,
                content=content,
                metadata=metadata or {},
            )
            indexed_id = await store.index_document(document)

            return {
                "success": True,
                "doc_id": indexed_id,
            }

        except Exception as e:
            logger.error(f"Index document failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Get MCP tool schema definitions.

        Returns the schema definitions for all tools exposed by this
        server, in MCP tool format.

        Returns:
            List of tool schemas with name, description, and inputSchema.
        """
        return [
            {
                "name": "ks_health",
                "description": "Check knowledge store health status",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "ks_search",
                "description": "Semantic search for documents in the knowledge store",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query text",
                        },
                        "top_k": {
                            "type": "integer",
                            "description": "Maximum number of results",
                            "default": 10,
                        },
                        "filters": {
                            "type": "object",
                            "description": "Metadata filters (e.g., file_type, path)",
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "ks_get",
                "description": "Get a document by ID",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "doc_id": {
                            "type": "string",
                            "description": "Document ID",
                        },
                    },
                    "required": ["doc_id"],
                },
            },
            {
                "name": "ks_index",
                "description": "Index a document in the knowledge store",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "doc_id": {
                            "type": "string",
                            "description": "Unique document identifier",
                        },
                        "content": {
                            "type": "string",
                            "description": "Document content text",
                        },
                        "metadata": {
                            "type": "object",
                            "description": "Optional metadata (file_path, file_type)",
                        },
                    },
                    "required": ["doc_id", "content"],
                },
            },
        ]

    async def handle_request(self, request: dict[str, Any]) -> dict[str, Any] | None:
        """Handle an incoming MCP request.

        Routes MCP JSON-RPC requests to the appropriate handler based
        on the method field.

        Args:
            request: The MCP request object with method and params.

        Returns:
            MCP response object, or None for notifications.
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
                            "name": "knowledge-store-mcp-server",
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

                if tool_name == "ks_health":
                    result = await self.ks_health()
                elif tool_name == "ks_search":
                    result = await self.ks_search(**arguments)
                elif tool_name == "ks_get":
                    result = await self.ks_get(**arguments)
                elif tool_name == "ks_index":
                    result = await self.ks_index(**arguments)
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
        This is the main entry point for running as an MCP server subprocess.
        """
        logger.info("Starting knowledge store MCP server")

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
        if self._store is not None:
            await self._store.close()
        logger.info("Knowledge store MCP server stopped")


async def main() -> None:
    """Entry point for the MCP server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stderr,
    )

    server = KnowledgeStoreMCPServer()
    await server.run_stdio()


if __name__ == "__main__":
    asyncio.run(main())
