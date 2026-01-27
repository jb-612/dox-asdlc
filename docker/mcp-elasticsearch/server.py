#!/usr/bin/env python3
"""Minimal MCP server for Elasticsearch access."""
import os
import json
from aiohttp import web
from elasticsearch import Elasticsearch

# Configuration from environment
ES_HOST = os.environ.get('ES_HOST', 'localhost')
ES_PORT = int(os.environ.get('ES_PORT', 9200))
ES_SCHEME = os.environ.get('ES_SCHEME', 'http')
ES_USER = os.environ.get('ES_USER', None)
ES_PASSWORD = os.environ.get('ES_PASSWORD', None)
ES_VERIFY_CERTS = os.environ.get('ES_VERIFY_CERTS', 'true').lower() == 'true'

# Elasticsearch client (lazy init)
_es_client = None


def get_elasticsearch():
    """Get or create Elasticsearch client."""
    global _es_client
    if _es_client is None:
        hosts = [{'host': ES_HOST, 'port': ES_PORT, 'scheme': ES_SCHEME}]
        if ES_USER and ES_PASSWORD:
            _es_client = Elasticsearch(
                hosts,
                basic_auth=(ES_USER, ES_PASSWORD),
                verify_certs=ES_VERIFY_CERTS
            )
        else:
            _es_client = Elasticsearch(hosts, verify_certs=ES_VERIFY_CERTS)
    return _es_client


async def health(request):
    """Health check endpoint."""
    try:
        client = get_elasticsearch()
        info = client.info()
        return web.json_response({
            'status': 'healthy',
            'elasticsearch': 'connected',
            'cluster_name': info.get('cluster_name', 'unknown')
        })
    except Exception as e:
        return web.json_response({'status': 'unhealthy', 'error': str(e)}, status=503)


async def mcp_list_tools(request):
    """List available MCP tools."""
    tools = [
        {
            'name': 'es_search',
            'description': 'Search documents in an index',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'index': {'type': 'string', 'description': 'Index name to search'},
                    'query': {'type': 'object', 'description': 'Elasticsearch query DSL'},
                    'size': {'type': 'integer', 'description': 'Number of results (default: 10)'}
                },
                'required': ['index', 'query']
            }
        },
        {
            'name': 'es_index',
            'description': 'Index a document',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'index': {'type': 'string', 'description': 'Index name'},
                    'document': {'type': 'object', 'description': 'Document to index'},
                    'id': {'type': 'string', 'description': 'Document ID (optional)'}
                },
                'required': ['index', 'document']
            }
        },
        {
            'name': 'es_get',
            'description': 'Get a document by ID',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'index': {'type': 'string', 'description': 'Index name'},
                    'id': {'type': 'string', 'description': 'Document ID'}
                },
                'required': ['index', 'id']
            }
        },
        {
            'name': 'es_delete',
            'description': 'Delete a document by ID',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'index': {'type': 'string', 'description': 'Index name'},
                    'id': {'type': 'string', 'description': 'Document ID'}
                },
                'required': ['index', 'id']
            }
        },
    ]
    return web.json_response({'tools': tools})


async def mcp_call_tool(request):
    """Call an MCP tool."""
    try:
        data = await request.json()
    except json.JSONDecodeError:
        return web.json_response({'error': 'Invalid JSON'}, status=400)

    tool_name = data.get('name')
    args = data.get('arguments', {})

    if not tool_name:
        return web.json_response({'error': 'Missing tool name'}, status=400)

    client = get_elasticsearch()

    try:
        if tool_name == 'es_search':
            index = args.get('index')
            query = args.get('query')
            if not index or not query:
                return web.json_response(
                    {'error': 'Missing required arguments: index, query'},
                    status=400
                )
            size = args.get('size', 10)
            result = client.search(index=index, query=query, size=size)
            # Extract hits for simpler response
            hits = result.get('hits', {}).get('hits', [])
            return web.json_response({
                'result': {
                    'total': result.get('hits', {}).get('total', {}).get('value', 0),
                    'hits': [{'id': h['_id'], 'source': h['_source']} for h in hits]
                }
            })

        elif tool_name == 'es_index':
            index = args.get('index')
            document = args.get('document')
            if not index or not document:
                return web.json_response(
                    {'error': 'Missing required arguments: index, document'},
                    status=400
                )
            doc_id = args.get('id')
            if doc_id:
                result = client.index(index=index, id=doc_id, document=document)
            else:
                result = client.index(index=index, document=document)
            return web.json_response({
                'result': {
                    'id': result['_id'],
                    'result': result['result']
                }
            })

        elif tool_name == 'es_get':
            index = args.get('index')
            doc_id = args.get('id')
            if not index or not doc_id:
                return web.json_response(
                    {'error': 'Missing required arguments: index, id'},
                    status=400
                )
            result = client.get(index=index, id=doc_id)
            return web.json_response({
                'result': {
                    'id': result['_id'],
                    'source': result['_source'],
                    'found': result['found']
                }
            })

        elif tool_name == 'es_delete':
            index = args.get('index')
            doc_id = args.get('id')
            if not index or not doc_id:
                return web.json_response(
                    {'error': 'Missing required arguments: index, id'},
                    status=400
                )
            result = client.delete(index=index, id=doc_id)
            return web.json_response({
                'result': {
                    'id': result['_id'],
                    'result': result['result']
                }
            })

        else:
            return web.json_response({'error': f'Unknown tool: {tool_name}'}, status=400)

    except Exception as e:
        error_type = type(e).__name__
        return web.json_response({'error': f'{error_type}: {str(e)}'}, status=500)


def create_app():
    """Create and configure the web application."""
    app = web.Application()
    app.router.add_get('/health', health)
    app.router.add_get('/mcp/list_tools', mcp_list_tools)
    app.router.add_post('/mcp/call_tool', mcp_call_tool)
    return app


if __name__ == '__main__':
    app = create_app()
    web.run_app(app, host='0.0.0.0', port=9000)
