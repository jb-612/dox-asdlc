#!/usr/bin/env python3
"""Minimal MCP server for Redis access."""
import os
import json
from aiohttp import web
import redis

# Configuration from environment
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', None)

# Redis client (lazy init)
_redis_client = None


def get_redis():
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD,
            decode_responses=True
        )
    return _redis_client


async def health(request):
    """Health check endpoint."""
    try:
        client = get_redis()
        client.ping()
        return web.json_response({'status': 'healthy', 'redis': 'connected'})
    except Exception as e:
        return web.json_response({'status': 'unhealthy', 'error': str(e)}, status=503)


async def mcp_list_tools(request):
    """List available MCP tools."""
    tools = [
        {
            'name': 'redis_get',
            'description': 'Get value by key',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'key': {'type': 'string', 'description': 'Redis key to get'}
                },
                'required': ['key']
            }
        },
        {
            'name': 'redis_set',
            'description': 'Set key-value pair',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'key': {'type': 'string', 'description': 'Redis key to set'},
                    'value': {'type': 'string', 'description': 'Value to store'},
                    'ttl': {'type': 'integer', 'description': 'Time to live in seconds (optional)'}
                },
                'required': ['key', 'value']
            }
        },
        {
            'name': 'redis_delete',
            'description': 'Delete a key',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'key': {'type': 'string', 'description': 'Redis key to delete'}
                },
                'required': ['key']
            }
        },
        {
            'name': 'redis_keys',
            'description': 'List keys matching pattern using SCAN (safe, non-blocking). Returns up to 1000 keys.',
            'inputSchema': {
                'type': 'object',
                'properties': {
                    'pattern': {'type': 'string', 'description': 'Pattern to match (default: *)'}
                },
                'required': []
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

    client = get_redis()

    try:
        if tool_name == 'redis_get':
            key = args.get('key')
            if not key:
                return web.json_response({'error': 'Missing required argument: key'}, status=400)
            result = client.get(key)
            return web.json_response({'result': result})

        elif tool_name == 'redis_set':
            key = args.get('key')
            value = args.get('value')
            if not key or value is None:
                return web.json_response({'error': 'Missing required arguments: key, value'}, status=400)
            ttl = args.get('ttl')
            if ttl:
                client.setex(key, ttl, value)
            else:
                client.set(key, value)
            return web.json_response({'result': 'OK'})

        elif tool_name == 'redis_delete':
            key = args.get('key')
            if not key:
                return web.json_response({'error': 'Missing required argument: key'}, status=400)
            result = client.delete(key)
            return web.json_response({'result': result})

        elif tool_name == 'redis_keys':
            pattern = args.get('pattern', '*')
            # Use SCAN instead of KEYS for production safety (non-blocking)
            keys = []
            cursor = 0
            max_keys = 1000
            while True:
                cursor, batch = client.scan(cursor=cursor, match=pattern, count=100)
                keys.extend(batch)
                if cursor == 0 or len(keys) >= max_keys:
                    break
            truncated = len(keys) > max_keys
            result = keys[:max_keys]
            return web.json_response({'result': result, 'truncated': truncated})

        else:
            return web.json_response({'error': f'Unknown tool: {tool_name}'}, status=400)

    except redis.RedisError as e:
        return web.json_response({'error': f'Redis error: {str(e)}'}, status=500)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


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
