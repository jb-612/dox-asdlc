#!/bin/bash
# MCP server launcher for KnowledgeStore tools
#
# This script launches the KnowledgeStore MCP server which exposes
# semantic search and document retrieval tools for Claude Code.
#
# Tools provided:
#   - ks_health: Check knowledge store health
#   - ks_search: Semantic search for documents
#   - ks_get: Retrieve document by ID
#   - ks_index: Index a document
#
# Usage:
#   ./scripts/knowledge-store/mcp-server.sh
#
# Environment variables:
#   ELASTICSEARCH_URL - Elasticsearch connection URL (default: http://localhost:9200)
#   ELASTICSEARCH_API_KEY - Optional API key for authentication
#   ES_INDEX_PREFIX - Index name prefix (default: asdlc)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Set PYTHONPATH to include project root
export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

# Default Elasticsearch URL if not set
export ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"

# Execute the MCP server module
exec python3 -m src.infrastructure.knowledge_store.mcp_server
