# aSDLC Architecture v3.0 - Crystal Clear Design

## CRITICAL CLARIFICATION: Agent SDK = Claude Code CLI

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    AGENT SDK IS CLAUDE CODE CLI AS A LIBRARY                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   When you install Agent SDK:                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │   pip install claude-agent-sdk                                                 ││
│   │   npm install -g @anthropic-ai/claude-code    ◀── REQUIRED: installs CLI      ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   The Python/TypeScript SDK wraps Claude Code CLI:                                   │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │   from claude_agent_sdk import query                                           ││
│   │                                                                                 ││
│   │   async for message in query(prompt="Fix the bug", options=options):           ││
│   │       #                                                                         ││
│   │       #  Internally: spawns `claude` CLI process                               ││
│   │       #  Same tools: Read, Write, Edit, Bash, Glob, Grep                       ││
│   │       #  Same agent loop as interactive Claude Code                            ││
│   │       #                                                                         ││
│   │       print(message)                                                           ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   SO: "Agent SDK container" = "Claude Code CLI container" = SAME THING              │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Answer 1: ALL Agents Use Claude Code CLI (via Agent SDK)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│              ALL AGENTS RUN CLAUDE CODE CLI (via Agent SDK wrapper)                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Container Image: All agents share the same base image                              │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │   # Dockerfile.agent-base                                                      ││
│   │                                                                                 ││
│   │   FROM python:3.11-slim                                                        ││
│   │                                                                                 ││
│   │   # Install Node.js (REQUIRED for Claude Code CLI)                             ││
│   │   RUN apt-get update && apt-get install -y nodejs npm git                      ││
│   │                                                                                 ││
│   │   # Install Claude Code CLI                                                    ││
│   │   RUN npm install -g @anthropic-ai/claude-code                                 ││
│   │                                                                                 ││
│   │   # Install Python Agent SDK                                                   ││
│   │   RUN pip install claude-agent-sdk redis chromadb anthropic                    ││
│   │                                                                                 ││
│   │   # Copy agent runner code                                                     ││
│   │   COPY agent_runner/ /app/agent_runner/                                        ││
│   │   COPY mcp_servers/ /app/mcp_servers/                                          ││
│   │                                                                                 ││
│   │   WORKDIR /app                                                                 ││
│   │   ENTRYPOINT ["python", "-m", "agent_runner.main"]                             ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   ALL agents use this image:                                                         │
│                                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│   │  Discovery  │  │   Design    │  │ Development │  │    Test     │               │
│   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │               │
│   │             │  │             │  │             │  │             │               │
│   │  Claude     │  │  Claude     │  │  Claude     │  │  Claude     │               │
│   │  Code CLI   │  │  Code CLI   │  │  Code CLI   │  │  Code CLI   │               │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│   │  Validator  │  │  Security   │  │  Evaluator  │  │  Reviewer   │               │
│   │   Agent     │  │   Agent     │  │   Agent     │  │   Agent     │               │
│   │             │  │             │  │             │  │             │               │
│   │  Claude     │  │  Claude     │  │  Claude     │  │  Claude     │               │
│   │  Code CLI   │  │  Code CLI   │  │  Code CLI   │  │  Code CLI   │               │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                                      │
│   Why Claude Code CLI for Evaluator and Security too?                                │
│   • Evaluator needs to READ feedback files, READ code that was reviewed             │
│   • Security needs to READ code, RUN SAST tools (Bash), WRITE reports               │
│   • Enterprise grade = consistent tooling across all agents                          │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Answer 2: How Agents Call RLM/RAG (The Integration Loop)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    HOW AGENTS CALL RLM/RAG: MCP TOOL PATTERN                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   The Agent (Claude Code CLI) calls MCP tools → MCP server calls Anthropic API      │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   AGENT CONTAINER                         MCP SERVER (in same container)    │   │
│   │   ┌─────────────────┐                    ┌─────────────────────────────┐    │   │
│   │   │                 │                    │                              │    │   │
│   │   │  Claude Code    │   stdio pipe       │  RLM MCP Server (Python)    │    │   │
│   │   │  CLI            │ ◀═══════════════▶  │                              │    │   │
│   │   │                 │                    │  @app.tool()                 │    │   │
│   │   │  Agent decides: │                    │  async def deep_analyze():   │    │   │
│   │   │  "I need deep   │                    │      # Calls Anthropic API   │    │   │
│   │   │  analysis..."   │                    │      # with Extended Thinking│    │   │
│   │   │                 │                    │      client.messages.create( │    │   │
│   │   │  Uses tool:     │                    │          thinking={...}      │    │   │
│   │   │  mcp__rlm__     │                    │      )                       │    │   │
│   │   │  deep_analyze   │                    │      return result           │    │   │
│   │   │                 │                    │                              │    │   │
│   │   └─────────────────┘                    └─────────────────────────────┘    │   │
│   │                                                       │                      │   │
│   │                                                       │ HTTPS                │   │
│   │                                                       ▼                      │   │
│   │                                          ┌─────────────────────────────┐    │   │
│   │                                          │   Anthropic API             │    │   │
│   │                                          │   api.anthropic.com         │    │   │
│   │                                          │                              │    │   │
│   │                                          │   Extended Thinking          │    │   │
│   │                                          │   Prompt Caching             │    │   │
│   │                                          │   Batch Processing           │    │   │
│   │                                          └─────────────────────────────┘    │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│   COMPLETE FLOW EXAMPLE: Design Agent needs architecture analysis                    │
│                                                                                      │
│   1. User task: "Design authentication system"                                       │
│   2. Design Agent (Claude Code CLI) thinks: "I need to understand trade-offs"       │
│   3. Agent calls: mcp__rlm__deep_analyze(problem="OAuth vs JWT vs Session")         │
│   4. MCP server receives call, makes Anthropic API request with Extended Thinking   │
│   5. Anthropic API returns deep analysis with thinking tokens                        │
│   6. MCP server returns result to Agent                                              │
│   7. Agent continues with the analysis result in context                             │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Concrete Code: RLM MCP Server

```python
# /app/mcp_servers/rlm_server.py

"""
RLM MCP Server - Provides deep analysis via Extended Thinking.
Runs as a subprocess, communicates with Claude Code CLI via stdio.
"""

from mcp.server import Server
from mcp.types import TextContent
import anthropic
import asyncio

app = Server("rlm-server")
client = anthropic.AsyncAnthropic()  # Uses ANTHROPIC_API_KEY from env

@app.tool()
async def deep_analyze(
    problem: str,
    context: str = "",
    thinking_budget: int = 10000
) -> list[TextContent]:
    """
    Deep analysis using Extended Thinking.
    
    Use this for:
    - Architecture decisions
    - Complex debugging  
    - Trade-off analysis
    - Security vulnerability analysis
    
    Args:
        problem: The problem to analyze
        context: Additional context (code, requirements, etc.)
        thinking_budget: Token budget for thinking (default 10000)
    """
    
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=16000,
        thinking={
            "type": "enabled",
            "budget_tokens": thinking_budget
        },
        messages=[{
            "role": "user",
            "content": f"""Problem: {problem}

Context:
{context}

Analyze this deeply. Consider:
1. Multiple approaches and alternatives
2. Trade-offs of each approach
3. Risks and mitigations
4. Your recommended solution with rationale
"""
        }]
    )
    
    # Extract thinking and response
    thinking_summary = ""
    answer = ""
    for block in response.content:
        if block.type == "thinking":
            # Summarize thinking (first 1000 chars)
            thinking_summary = block.thinking[:1000] + "..."
        elif block.type == "text":
            answer = block.text
    
    # Calculate cost
    input_cost = response.usage.input_tokens * 0.003 / 1000
    output_cost = response.usage.output_tokens * 0.015 / 1000
    thinking_cost = (response.usage.cache_creation_input_tokens or 0) * 0.00375 / 1000
    total_cost = input_cost + output_cost + thinking_cost
    
    return [TextContent(
        type="text",
        text=f"""## Deep Analysis Result

### Analysis
{answer}

### Thinking Summary
{thinking_summary}

### Metadata
- Thinking tokens used: {response.usage.cache_creation_input_tokens or 'N/A'}
- Total tokens: {response.usage.input_tokens + response.usage.output_tokens}
- Estimated cost: ${total_cost:.4f}
"""
    )]


@app.tool()
async def analyze_security_vulnerability(
    code: str,
    vulnerability_type: str = "general"
) -> list[TextContent]:
    """
    Deep security analysis for complex vulnerabilities.
    
    Use this for vulnerabilities that need deep reasoning,
    not simple pattern matching.
    """
    
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=8000,
        thinking={
            "type": "enabled",
            "budget_tokens": 5000
        },
        messages=[{
            "role": "user", 
            "content": f"""Analyze this code for {vulnerability_type} vulnerabilities:

```
{code}
```

Provide:
1. Identified vulnerabilities with severity
2. Attack vectors
3. Remediation steps
4. Secure code examples
"""
        }]
    )
    
    answer = ""
    for block in response.content:
        if block.type == "text":
            answer = block.text
    
    return [TextContent(type="text", text=answer)]


if __name__ == "__main__":
    from mcp.server.stdio import stdio_server
    asyncio.run(stdio_server(app))
```

### Concrete Code: RAG MCP Server

```python
# /app/mcp_servers/rag_server.py

"""
RAG MCP Server - Provides codebase queries with prompt caching.
Uses ChromaDB for embeddings, Anthropic API with caching for generation.
"""

from mcp.server import Server
from mcp.types import TextContent
import anthropic
import chromadb
import asyncio
import os

app = Server("rag-server")
client = anthropic.AsyncAnthropic()
chroma = chromadb.HttpClient(
    host=os.environ.get("CHROMADB_HOST", "chromadb"),
    port=int(os.environ.get("CHROMADB_PORT", "8000"))
)

@app.tool()
async def query_codebase(
    question: str,
    collection_name: str = "codebase",
    max_chunks: int = 10
) -> list[TextContent]:
    """
    Query the codebase using RAG with prompt caching.
    
    Use this to find:
    - How something is implemented
    - Related code patterns
    - Existing utilities or helpers
    - Documentation references
    
    Args:
        question: Natural language question about the codebase
        collection_name: ChromaDB collection to search
        max_chunks: Maximum code chunks to retrieve
    """
    
    # Get collection
    try:
        collection = chroma.get_collection(collection_name)
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error: Collection '{collection_name}' not found. Available collections may need to be indexed first."
        )]
    
    # Query embeddings
    results = collection.query(
        query_texts=[question],
        n_results=max_chunks,
        include=["documents", "metadatas", "distances"]
    )
    
    if not results['documents'][0]:
        return [TextContent(
            type="text",
            text="No relevant code found for your query."
        )]
    
    # Build context from retrieved chunks
    context_parts = []
    sources = []
    for doc, meta, distance in zip(
        results['documents'][0],
        results['metadatas'][0],
        results['distances'][0]
    ):
        file_path = meta.get('file_path', 'unknown')
        sources.append(file_path)
        context_parts.append(f"""
### File: {file_path}
```
{doc}
```
""")
    
    context = "\n".join(context_parts)
    
    # Query with prompt caching (90% cost reduction on cache hit)
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4000,
        system=[
            {
                "type": "text",
                "text": """You are a codebase expert. Answer questions based on the retrieved code context.
Be specific and reference the actual code when answering.
If the context doesn't contain enough information, say so."""
            },
            {
                "type": "text",
                "text": context,
                "cache_control": {"type": "ephemeral"}  # 5-minute cache
            }
        ],
        messages=[{
            "role": "user",
            "content": question
        }]
    )
    
    answer = response.content[0].text
    usage = response.usage
    
    # Determine cache status
    if usage.cache_read_input_tokens > 0:
        cache_status = f"CACHE HIT - Read {usage.cache_read_input_tokens} cached tokens (90% savings)"
    elif usage.cache_creation_input_tokens > 0:
        cache_status = f"CACHE MISS - Cached {usage.cache_creation_input_tokens} tokens for next query"
    else:
        cache_status = "NO CACHE"
    
    return [TextContent(
        type="text",
        text=f"""## RAG Query Result

{answer}

### Sources Referenced
{chr(10).join(f"- {s}" for s in set(sources))}

### Cache Status
{cache_status}
"""
    )]


@app.tool()
async def find_similar_code(
    code_snippet: str,
    collection_name: str = "codebase",
    max_results: int = 5
) -> list[TextContent]:
    """
    Find code similar to the given snippet.
    
    Use this to:
    - Find duplicate code
    - Find patterns to follow
    - Check if something already exists
    """
    
    collection = chroma.get_collection(collection_name)
    
    results = collection.query(
        query_texts=[code_snippet],
        n_results=max_results,
        include=["documents", "metadatas", "distances"]
    )
    
    output_parts = ["## Similar Code Found\n"]
    
    for i, (doc, meta, distance) in enumerate(zip(
        results['documents'][0],
        results['metadatas'][0],
        results['distances'][0]
    )):
        similarity = 1 - distance  # Convert distance to similarity
        output_parts.append(f"""
### {i+1}. {meta.get('file_path', 'unknown')} (similarity: {similarity:.2%})
```
{doc[:500]}{'...' if len(doc) > 500 else ''}
```
""")
    
    return [TextContent(type="text", text="\n".join(output_parts))]


if __name__ == "__main__":
    from mcp.server.stdio import stdio_server
    asyncio.run(stdio_server(app))
```

---

## Answer 3: Agent SDK Streaming to Redis

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    AGENT SDK STREAMING TO REDIS - COMPLETE FLOW                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   Agent SDK provides async iterator → Agent Runner publishes to Redis Streams       │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                              │   │
│   │   CONTAINER                                                                  │   │
│   │   ┌─────────────────────────────────────────────────────────────────────┐   │   │
│   │   │                                                                      │   │   │
│   │   │   Agent Runner (Python)                                             │   │   │
│   │   │   ┌─────────────────────────────────────────────────────────────┐   │   │   │
│   │   │   │                                                              │   │   │   │
│   │   │   │   async for message in query(prompt, options):               │   │   │   │
│   │   │   │       │                                                      │   │   │   │
│   │   │   │       │  ┌──────────────────────────────────┐               │   │   │   │
│   │   │   │       │  │ Message Types:                   │               │   │   │   │
│   │   │   │       │  │ • AssistantMessage (text, tools) │               │   │   │   │
│   │   │   │       │  │ • SystemMessage (status)         │               │   │   │   │
│   │   │   │       │  │ • ResultMessage (completion)     │               │   │   │   │
│   │   │   │       │  └──────────────────────────────────┘               │   │   │   │
│   │   │   │       │                                                      │   │   │   │
│   │   │   │       ▼                                                      │   │   │   │
│   │   │   │   await redis.xadd("asdlc:agent:stream", {                   │   │   │   │
│   │   │   │       "task_id": task_id,                                    │   │   │   │
│   │   │   │       "type": message_type,                                  │   │   │   │
│   │   │   │       "payload": json.dumps(message)                         │   │   │   │
│   │   │   │   })                                                         │   │   │   │
│   │   │   │                                                              │   │   │   │
│   │   │   └─────────────────────────────────────────────────────────────┘   │   │   │
│   │   │                                                                      │   │   │
│   │   └─────────────────────────────────────────────────────────────────────┘   │   │
│   │                                          │                                   │   │
│   └──────────────────────────────────────────│───────────────────────────────────┘   │
│                                              │                                       │
│                                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                           REDIS STREAMS                                      │   │
│   │                                                                              │   │
│   │   Stream: asdlc:agent:stream                                                │   │
│   │   ┌────────────────────────────────────────────────────────────────────┐    │   │
│   │   │ ID: 1706123456789-0                                                 │    │   │
│   │   │ task_id: "task-abc-123"                                            │    │   │
│   │   │ type: "AssistantMessage"                                           │    │   │
│   │   │ payload: {"content": [{"type": "text", "text": "..."}]}           │    │   │
│   │   ├────────────────────────────────────────────────────────────────────┤    │   │
│   │   │ ID: 1706123456790-0                                                 │    │   │
│   │   │ task_id: "task-abc-123"                                            │    │   │
│   │   │ type: "ToolUse"                                                    │    │   │
│   │   │ payload: {"tool": "Write", "input": {...}}                        │    │   │
│   │   ├────────────────────────────────────────────────────────────────────┤    │   │
│   │   │ ID: 1706123456800-0                                                 │    │   │
│   │   │ task_id: "task-abc-123"                                            │    │   │
│   │   │ type: "TodoUpdate"                                                 │    │   │
│   │   │ payload: {"todos": [...], "stats": {...}}                         │    │   │
│   │   └────────────────────────────────────────────────────────────────────┘    │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                              │                                       │
│              ┌───────────────────────────────┼───────────────────────────────┐      │
│              ▼                               ▼                               ▼      │
│   ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐  │
│   │  Coordinator    │           │  HITL Gateway   │           │  SPA WebSocket  │  │
│   │  (Consumer)     │           │  (Consumer)     │           │  (Consumer)     │  │
│   │                 │           │                 │           │                 │  │
│   │  • Phase mgmt   │           │  • Gate detect  │           │  • Real-time UI │  │
│   │  • Job spawning │           │  • Notifications│           │  • Progress bar │  │
│   └─────────────────┘           └─────────────────┘           └─────────────────┘  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Concrete Code: Agent Runner with Redis Streaming

```python
# /app/agent_runner/main.py

"""
Agent Runner - Wraps Claude Code CLI (Agent SDK) with Redis streaming.
Each agent container runs this as the entrypoint.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AgentDefinition,
    HookMatcher,
    HookContext,
    AssistantMessage,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
)


class AgentRunner:
    """
    Runs Claude Code CLI via Agent SDK and streams all messages to Redis.
    """
    
    def __init__(self):
        # Load configuration from environment
        self.redis_url = os.environ["REDIS_URL"]
        self.task = json.loads(os.environ["TASK_JSON"])
        self.agent_type = os.environ["AGENT_TYPE"]
        self.epic_id = self.task["epic_id"]
        self.task_id = self.task["id"]
        
        # Redis streams
        self.progress_stream = f"asdlc:agent:progress:{self.task_id}"
        self.phase_stream = f"asdlc:phase:{self.task['phase']}"
        self.hitl_stream = "asdlc:hitl:requests"
        
        # Redis client (initialized in run)
        self.redis: redis.Redis = None
    
    async def run(self):
        """Main entry point"""
        
        # Connect to Redis
        self.redis = redis.from_url(self.redis_url)
        
        try:
            # Publish start event
            await self.publish_event("AgentStarted", {
                "agent_type": self.agent_type,
                "task": self.task
            })
            
            # Build options for this agent type
            options = self.build_options()
            
            # Run Claude Code CLI via Agent SDK
            # This is the streaming loop!
            async for message in query(
                prompt=self.task["spec"],
                options=options
            ):
                # Publish each message to Redis stream
                await self.publish_message(message)
                
                # Check for completion
                if isinstance(message, ResultMessage):
                    await self.handle_completion(message)
        
        except Exception as e:
            await self.publish_event("AgentFailed", {
                "error": str(e),
                "type": type(e).__name__
            })
            raise
        
        finally:
            await self.redis.close()
    
    async def publish_message(self, message: Any):
        """Publish a message to Redis stream"""
        
        event_data = {
            "task_id": self.task_id,
            "epic_id": self.epic_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        if isinstance(message, AssistantMessage):
            # Extract content for streaming
            content_items = []
            for block in message.content:
                if isinstance(block, TextBlock):
                    content_items.append({
                        "type": "text",
                        "text": block.text[:500]  # Truncate for Redis
                    })
                elif isinstance(block, ToolUseBlock):
                    content_items.append({
                        "type": "tool_use",
                        "tool": block.name,
                        "input_preview": str(block.input)[:200]
                    })
                elif isinstance(block, ToolResultBlock):
                    content_items.append({
                        "type": "tool_result",
                        "tool_use_id": block.tool_use_id,
                        "is_error": block.is_error
                    })
            
            event_data["type"] = "AssistantMessage"
            event_data["content"] = json.dumps(content_items)
            event_data["model"] = message.model
        
        elif isinstance(message, SystemMessage):
            event_data["type"] = "SystemMessage"
            event_data["subtype"] = message.subtype
            event_data["data"] = json.dumps(message.data)
            
            # Check for todo updates
            if message.subtype == "todo_update":
                await self.publish_todo_update(message.data)
        
        elif isinstance(message, ResultMessage):
            event_data["type"] = "ResultMessage"
            event_data["is_error"] = str(message.is_error)
            event_data["duration_ms"] = str(message.duration_ms)
            event_data["num_turns"] = str(message.num_turns)
            event_data["total_cost_usd"] = str(message.total_cost_usd or 0)
            event_data["session_id"] = message.session_id
            if message.result:
                event_data["result_preview"] = message.result[:500]
        
        else:
            event_data["type"] = "Unknown"
            event_data["raw"] = str(message)[:500]
        
        # Publish to progress stream
        await self.redis.xadd(self.progress_stream, event_data)
    
    async def publish_todo_update(self, todo_data: dict):
        """Publish todo list updates for UI display"""
        
        await self.redis.xadd(
            f"asdlc:agent:todos:{self.task_id}",
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "todos": json.dumps(todo_data.get("todos", [])),
                "stats": json.dumps(todo_data.get("stats", {}))
            }
        )
    
    async def publish_event(self, event_type: str, data: dict):
        """Publish a lifecycle event"""
        
        await self.redis.xadd(
            self.progress_stream,
            {
                "type": event_type,
                "task_id": self.task_id,
                "epic_id": self.epic_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": json.dumps(data)
            }
        )
    
    async def handle_completion(self, result: ResultMessage):
        """Handle agent completion - publish to phase stream"""
        
        status = "success" if not result.is_error else "failed"
        
        # Publish to phase stream for Coordinator
        await self.redis.xadd(
            self.phase_stream,
            {
                "event": "PhaseTaskCompleted",
                "epic_id": self.epic_id,
                "task_id": self.task_id,
                "phase": self.task["phase"],
                "agent_type": self.agent_type,
                "status": status,
                "session_id": result.session_id,
                "duration_ms": str(result.duration_ms),
                "cost_usd": str(result.total_cost_usd or 0),
                "num_turns": str(result.num_turns)
            }
        )
        
        # Check if HITL gate required
        if self.requires_hitl_gate():
            await self.request_hitl_gate(result)
    
    def requires_hitl_gate(self) -> bool:
        """Check if this phase requires HITL approval"""
        hitl_phases = {
            "discovery": "HITL-1",
            "design": "HITL-2", 
            "development": "HITL-4",
            "validation": "HITL-5",
            "deployment": "HITL-6"
        }
        return self.task["phase"] in hitl_phases
    
    async def request_hitl_gate(self, result: ResultMessage):
        """Request HITL approval"""
        
        gate_mapping = {
            "discovery": ("HITL-1", "Backlog Approval"),
            "design": ("HITL-2", "Design Sign-off"),
            "development": ("HITL-4", "Implementation Review"),
            "validation": ("HITL-5", "Quality Gate"),
            "deployment": ("HITL-6", "Release Authorization")
        }
        
        gate_id, gate_name = gate_mapping.get(
            self.task["phase"],
            ("HITL-X", "Unknown Gate")
        )
        
        await self.redis.xadd(
            self.hitl_stream,
            {
                "event": "GateRequired",
                "epic_id": self.epic_id,
                "task_id": self.task_id,
                "gate_id": gate_id,
                "gate_name": gate_name,
                "phase": self.task["phase"],
                "session_id": result.session_id,
                "artifacts": json.dumps(self.task.get("expected_artifacts", [])),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    
    def build_options(self) -> ClaudeAgentOptions:
        """Build Agent SDK options based on agent type"""
        
        # MCP servers available to all agents
        mcp_servers = {
            "rlm": {
                "type": "stdio",
                "command": "python",
                "args": ["/app/mcp_servers/rlm_server.py"]
            },
            "rag": {
                "type": "stdio",
                "command": "python",
                "args": ["/app/mcp_servers/rag_server.py"]
            },
            "git": {
                "type": "stdio",
                "command": "mcp-server-git",
                "args": ["--repository", "/workspace"]
            }
        }
        
        # Common hooks for all agents
        common_hooks = {
            "PostToolUse": [
                HookMatcher(hooks=[self.hook_log_tool_use])
            ],
            "Stop": [
                HookMatcher(hooks=[self.hook_on_stop])
            ]
        }
        
        # Agent-specific configuration
        if self.agent_type == "development":
            return self._build_development_options(mcp_servers, common_hooks)
        elif self.agent_type == "design":
            return self._build_design_options(mcp_servers, common_hooks)
        elif self.agent_type == "security":
            return self._build_security_options(mcp_servers, common_hooks)
        elif self.agent_type == "evaluator":
            return self._build_evaluator_options(mcp_servers, common_hooks)
        else:
            return self._build_default_options(mcp_servers, common_hooks)
    
    def _build_development_options(self, mcp_servers, hooks) -> ClaudeAgentOptions:
        """Development agent with TDD subagents and todo tracking"""
        
        return ClaudeAgentOptions(
            cwd="/workspace",
            setting_sources=["project"],  # Load .claude/CLAUDE.md
            allowed_tools=[
                # Built-in tools
                "Read", "Write", "Edit", "Bash", "Glob", "Grep",
                # Subagent tool
                "Task",
                # Todo tracking
                "TodoWrite",
                # MCP tools
                "mcp__rlm__deep_analyze",
                "mcp__rag__query_codebase",
                "mcp__rag__find_similar_code",
                "mcp__git__commit",
                "mcp__git__branch",
                "mcp__git__diff"
            ],
            permission_mode="acceptEdits",
            enable_file_checkpointing=True,
            mcp_servers=mcp_servers,
            agents={
                "test-first": AgentDefinition(
                    description="Writes failing tests before implementation (TDD red phase)",
                    prompt="""You implement Test-Driven Development - RED phase.
Your job is to write a failing test that validates the requirement.

Steps:
1. Read the task specification
2. Create a test file if needed
3. Write a test that will FAIL (because code doesn't exist yet)
4. Run the test to confirm it fails
5. Report the test file path

DO NOT write any implementation code.""",
                    tools=["Read", "Write", "Bash", "mcp__rag__query_codebase"],
                    model="sonnet"
                ),
                "implementer": AgentDefinition(
                    description="Implements code to pass failing tests (TDD green phase)",
                    prompt="""You implement Test-Driven Development - GREEN phase.
Your job is to write minimal code to make the failing test pass.

Steps:
1. Read the failing test
2. Implement just enough code to pass
3. Run the test
4. If it fails, iterate
5. Report when green

DO NOT add extra features not covered by tests.""",
                    tools=["Read", "Write", "Edit", "Bash"],
                    model="sonnet"
                ),
                "debugger": AgentDefinition(
                    description="Debug complex failures using deep analysis",
                    prompt="""You are a debugging expert. When tests fail repeatedly:

1. Analyze the error deeply
2. Use mcp__rlm__deep_analyze for complex issues
3. Check similar code with mcp__rag__find_similar_code
4. Fix the root cause
5. Verify the fix""",
                    tools=[
                        "Read", "Write", "Edit", "Bash", "Grep",
                        "mcp__rlm__deep_analyze",
                        "mcp__rag__query_codebase"
                    ],
                    model="opus"  # Use Opus for hard debugging
                )
            },
            hooks=hooks
        )
    
    def _build_design_options(self, mcp_servers, hooks) -> ClaudeAgentOptions:
        """Design agent with architecture analysis"""
        
        return ClaudeAgentOptions(
            cwd="/workspace",
            setting_sources=["project"],
            allowed_tools=[
                "Read", "Write", "Glob", "Grep",
                "Task", "TodoWrite",
                "mcp__rlm__deep_analyze",  # For architecture decisions
                "mcp__rag__query_codebase",  # For understanding existing code
                "mcp__rag__find_similar_code"
            ],
            permission_mode="acceptEdits",
            mcp_servers=mcp_servers,
            agents={
                "surveyor": AgentDefinition(
                    description="Survey existing codebase architecture",
                    prompt="Analyze the codebase structure, patterns, and conventions.",
                    tools=["Read", "Glob", "Grep", "mcp__rag__query_codebase"]
                ),
                "architect": AgentDefinition(
                    description="Design system architecture with deep analysis",
                    prompt="Design architecture. Use deep_analyze for trade-off decisions.",
                    tools=["Read", "Write", "mcp__rlm__deep_analyze"]
                )
            },
            hooks=hooks
        )
    
    def _build_security_options(self, mcp_servers, hooks) -> ClaudeAgentOptions:
        """Security agent with SAST tools and deep vulnerability analysis"""
        
        return ClaudeAgentOptions(
            cwd="/workspace",
            setting_sources=["project"],
            allowed_tools=[
                "Read", "Bash", "Glob", "Grep", "Write",
                "TodoWrite",
                "mcp__rlm__deep_analyze",  # For complex vulnerability analysis
                "mcp__rlm__analyze_security_vulnerability",
                "mcp__rag__query_codebase"
            ],
            permission_mode="acceptEdits",
            mcp_servers=mcp_servers,
            hooks=hooks
        )
    
    def _build_evaluator_options(self, mcp_servers, hooks) -> ClaudeAgentOptions:
        """Evaluator agent for feedback analysis"""
        
        return ClaudeAgentOptions(
            cwd="/workspace",
            setting_sources=["project"],
            allowed_tools=[
                "Read", "Write", "Glob", "Grep",
                "mcp__rag__query_codebase",  # Find related past patterns
            ],
            permission_mode="acceptEdits",
            mcp_servers=mcp_servers,
            hooks=hooks
        )
    
    def _build_default_options(self, mcp_servers, hooks) -> ClaudeAgentOptions:
        """Default options for other agent types"""
        
        return ClaudeAgentOptions(
            cwd="/workspace",
            setting_sources=["project"],
            allowed_tools=[
                "Read", "Write", "Edit", "Bash", "Glob", "Grep",
                "TodoWrite",
                "mcp__rag__query_codebase"
            ],
            permission_mode="acceptEdits",
            mcp_servers=mcp_servers,
            hooks=hooks
        )
    
    # Hook callbacks
    async def hook_log_tool_use(
        self,
        input_data: dict,
        tool_use_id: str | None,
        context: HookContext
    ) -> dict:
        """Log tool usage to Redis for observability"""
        
        tool_name = input_data.get("tool_name", "unknown")
        
        await self.redis.xadd(
            f"asdlc:agent:tools:{self.task_id}",
            {
                "tool": tool_name,
                "tool_use_id": tool_use_id or "",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
        
        return {}  # Allow tool execution
    
    async def hook_on_stop(
        self,
        input_data: dict,
        tool_use_id: str | None,
        context: HookContext
    ) -> dict:
        """Handle agent stop"""
        
        await self.publish_event("AgentStopping", {
            "stop_hook_active": input_data.get("stop_hook_active", False)
        })
        
        return {}


async def main():
    runner = AgentRunner()
    await runner.run()


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Answer 4: Where to Use Claude Todo List

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           TODO TRACKING: WHERE AND HOW                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   TodoWrite is a BUILT-IN tool in Claude Code CLI / Agent SDK                        │
│   Perfect for multi-step workflows where progress tracking matters                   │
│                                                                                      │
│   ┌────────────────────────────────────────────────────────────────────────────────┐│
│   │                                                                                 ││
│   │   AGENTS THAT USE TODO TRACKING                                                ││
│   │                                                                                 ││
│   │   ┌─────────────────────────────────────────────────────────────────────────┐ ││
│   │   │ Development Agent                                                        │ ││
│   │   │                                                                          │ ││
│   │   │ Task: "Implement OAuth token refresh"                                    │ ││
│   │   │                                                                          │ ││
│   │   │ Agent creates todo at start:                                             │ ││
│   │   │ ┌──────────────────────────────────────────────────────────────────┐    │ ││
│   │   │ │ TodoWrite([                                                       │    │ ││
│   │   │ │   {content: "Read task spec", status: "completed"},              │    │ ││
│   │   │ │   {content: "Query RAG for auth patterns", status: "completed"}, │    │ ││
│   │   │ │   {content: "Write failing test", status: "completed"},          │    │ ││
│   │   │ │   {content: "Implement refresh logic", status: "in_progress"},   │    │ ││
│   │   │ │   {content: "Run tests", status: "pending"},                     │    │ ││
│   │   │ │   {content: "Refactor", status: "pending"},                      │    │ ││
│   │   │ │   {content: "Commit changes", status: "pending"}                 │    │ ││
│   │   │ │ ])                                                                │    │ ││
│   │   │ └──────────────────────────────────────────────────────────────────┘    │ ││
│   │   │                                                                          │ ││
│   │   │ UI shows real-time progress:                                             │ ││
│   │   │ ┌──────────────────────────────────────────────────────────────────┐    │ ││
│   │   │ │ Task: Implement OAuth token refresh                               │    │ ││
│   │   │ │ ════════════════════════════════════════════════════════ 43%     │    │ ││
│   │   │ │                                                                   │    │ ││
│   │   │ │ [✓] Read task spec                                               │    │ ││
│   │   │ │ [✓] Query RAG for auth patterns                                  │    │ ││
│   │   │ │ [✓] Write failing test                                           │    │ ││
│   │   │ │ [→] Implement refresh logic                                      │    │ ││
│   │   │ │ [ ] Run tests                                                    │    │ ││
│   │   │ │ [ ] Refactor                                                     │    │ ││
│   │   │ │ [ ] Commit changes                                               │    │ ││
│   │   │ └──────────────────────────────────────────────────────────────────┘    │ ││
│   │   └─────────────────────────────────────────────────────────────────────────┘ ││
│   │                                                                                 ││
│   │   ┌─────────────────────────────────────────────────────────────────────────┐ ││
│   │   │ Design Agent                                                             │ ││
│   │   │                                                                          │ ││
│   │   │ [✓] Survey existing architecture                                        │ ││
│   │   │ [✓] Identify integration points                                         │ ││
│   │   │ [→] Analyze trade-offs (using RLM)                                      │ ││
│   │   │ [ ] Write architecture.md                                               │ ││
│   │   │ [ ] Create task breakdown                                               │ ││
│   │   └─────────────────────────────────────────────────────────────────────────┘ ││
│   │                                                                                 ││
│   │   ┌─────────────────────────────────────────────────────────────────────────┐ ││
│   │   │ Security Agent                                                           │ ││
│   │   │                                                                          │ ││
│   │   │ [✓] Run dependency scan (npm audit)                                     │ ││
│   │   │ [✓] Run SAST scan (semgrep)                                             │ ││
│   │   │ [→] Analyze critical findings (using RLM)                               │ ││
│   │   │ [ ] Write security report                                               │ ││
│   │   │ [ ] Create remediation tickets                                          │ ││
│   │   └─────────────────────────────────────────────────────────────────────────┘ ││
│   │                                                                                 ││
│   │   ┌─────────────────────────────────────────────────────────────────────────┐ ││
│   │   │ Validator Agent                                                          │ ││
│   │   │                                                                          │ ││
│   │   │ [✓] Run unit tests                                                      │ ││
│   │   │ [✓] Run integration tests                                               │ ││
│   │   │ [→] Run E2E tests                                                       │ ││
│   │   │ [ ] Generate coverage report                                            │ ││
│   │   │ [ ] Create validation summary                                           │ ││
│   │   └─────────────────────────────────────────────────────────────────────────┘ ││
│   │                                                                                 ││
│   └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│   HOW TODO UPDATES FLOW TO UI:                                                       │
│                                                                                      │
│   Agent uses TodoWrite ──▶ Agent SDK emits SystemMessage ──▶ Agent Runner           │
│                                                               publishes to Redis     │
│                                                                      │               │
│                                                                      ▼               │
│                                                        ┌─────────────────────┐      │
│                                                        │ Redis Stream:       │      │
│                                                        │ asdlc:agent:todos   │      │
│                                                        │ :task-123           │      │
│                                                        └─────────────────────┘      │
│                                                                      │               │
│                                                                      ▼               │
│                                                        ┌─────────────────────┐      │
│                                                        │ SPA subscribes via  │      │
│                                                        │ WebSocket, updates  │      │
│                                                        │ progress bar        │      │
│                                                        └─────────────────────┘      │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   aSDLC ARCHITECTURE v3.0                                            │
│                         ALL AGENTS = CLAUDE CODE CLI (via Agent SDK)                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                         USER LAYER                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│  │  │   SPA (Next.js)                                                                           │ │ │
│  │  │   • Epic management          • Todo progress bars (from Redis)                           │ │ │
│  │  │   • HITL review UI           • Real-time agent streaming (WebSocket)                     │ │ │
│  │  │   • Artifact viewer          • Cost tracking dashboard                                    │ │ │
│  │  └──────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                               │                                                      │
│                                               ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                  ORCHESTRATION LAYER                                           │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │ │
│  │  │   Coordinator    │  │  HITL Gateway    │  │   Git Gateway    │  │  WebSocket Relay │      │ │
│  │  │                  │  │                  │  │                  │  │                  │      │ │
│  │  │ • Redis consumer │  │ • REST API       │  │ • Clone repos    │  │ • Subscribe to   │      │ │
│  │  │ • Spawn K8s Jobs │  │ • Gate workflow  │  │ • Store artifacts│  │   Redis streams  │      │ │
│  │  │ • Phase routing  │  │ • Feedback store │  │ • Version ctrl   │  │ • Push to SPA    │      │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘      │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                               │                                                      │
│                                               ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                           AGENT CONTAINERS (Kubernetes Jobs)                                   │ │
│  │                                                                                                 │ │
│  │   Each container = Agent Runner (Python) + Claude Code CLI + MCP Servers                       │ │
│  │                                                                                                 │ │
│  │   ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│  │   │                              CONTAINER INTERNALS                                         │ │ │
│  │   │                                                                                          │ │ │
│  │   │   ┌─────────────────────────────────────────────────────────────────────────────────┐  │ │ │
│  │   │   │   Agent Runner (Python)                                                          │  │ │ │
│  │   │   │                                                                                   │  │ │ │
│  │   │   │   async for message in query(prompt, options):  ◀── Claude Code CLI streaming   │  │ │ │
│  │   │   │       await redis.xadd(stream, message)         ◀── Publish to Redis            │  │ │ │
│  │   │   │                                                                                   │  │ │ │
│  │   │   └─────────────────────────────────────────────────────────────────────────────────┘  │ │ │
│  │   │                         │                                                               │ │ │
│  │   │                         │ stdio                                                         │ │ │
│  │   │                         ▼                                                               │ │ │
│  │   │   ┌─────────────────────────────────────────────────────────────────────────────────┐  │ │ │
│  │   │   │   MCP Servers (in-process)                                                       │  │ │ │
│  │   │   │                                                                                   │  │ │ │
│  │   │   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │  │ │ │
│  │   │   │   │ RLM Server  │  │ RAG Server  │  │ Git Server  │  │ Jira Server │           │  │ │ │
│  │   │   │   │             │  │             │  │             │  │             │           │  │ │ │
│  │   │   │   │ deep_analyze│  │ query_code  │  │ commit      │  │ create_issue│           │  │ │ │
│  │   │   │   │             │  │ find_similar│  │ branch      │  │ update      │           │  │ │ │
│  │   │   │   │      │      │  │      │      │  │             │  │             │           │  │ │ │
│  │   │   │   │      ▼      │  │      ▼      │  │             │  │             │           │  │ │ │
│  │   │   │   │  Anthropic  │  │  ChromaDB + │  │             │  │             │           │  │ │ │
│  │   │   │   │  API        │  │  Anthropic  │  │             │  │             │           │  │ │ │
│  │   │   │   │  (Extended  │  │  API        │  │             │  │             │           │  │ │ │
│  │   │   │   │  Thinking)  │  │  (Caching)  │  │             │  │             │           │  │ │ │
│  │   │   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘           │  │ │ │
│  │   │   │                                                                                   │  │ │ │
│  │   │   └─────────────────────────────────────────────────────────────────────────────────┘  │ │ │
│  │   │                                                                                          │ │ │
│  │   └─────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                                                 │ │
│  │   Agent Types (all use same container image, different config):                                │ │
│  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│  │   │Discovery│ │ Design  │ │  Dev    │ │  Test   │ │Validator│ │Security │ │Evaluator│        │ │
│  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │ │
│  │                                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                               │                                                      │
│                                               ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                      REDIS STREAMS                                             │ │
│  │                                                                                                 │ │
│  │   asdlc:agent:progress:{task_id}  ◀── All agent messages (text, tool use, results)            │ │
│  │   asdlc:agent:todos:{task_id}     ◀── Todo list updates                                       │ │
│  │   asdlc:agent:tools:{task_id}     ◀── Tool usage log                                          │ │
│  │   asdlc:phase:{phase}             ◀── Phase completion events                                 │ │
│  │   asdlc:hitl:requests             ◀── HITL gate requests                                      │ │
│  │   asdlc:hitl:decisions            ◀── HITL approvals/rejections                               │ │
│  │   asdlc:feedback:events           ◀── Feedback for evaluator                                  │ │
│  │                                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                               │                                                      │
│                                               ▼                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                      INFRASTRUCTURE                                            │ │
│  │                                                                                                 │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │ │
│  │   │   Redis     │  │ PostgreSQL  │  │    Git      │  │  ChromaDB   │  │  Anthropic  │         │ │
│  │   │  (Streams)  │  │   (State)   │  │   (Repos)   │  │ (Embeddings)│  │    API      │         │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │ │
│  │                                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary: Key Points

| Question | Answer |
|----------|--------|
| **Use Claude Code CLI for agents?** | YES - Agent SDK IS Claude Code CLI as a library |
| **Evaluator/Security use Client SDK?** | NO - They also use Agent SDK (need file access, tools) |
| **How agents call RLM/RAG?** | Via MCP tools that wrap Anthropic API internally |
| **How streaming to Redis?** | Agent Runner wraps SDK streaming, publishes via xadd() |
| **Where to use Todo tracking?** | All multi-step agents: Dev, Design, Security, Validator |

## Integration Flow Summary

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            COMPLETE INTEGRATION FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  1. Coordinator spawns K8s Job with TASK_JSON                                        │
│                    │                                                                  │
│                    ▼                                                                  │
│  2. Agent Runner starts, builds ClaudeAgentOptions with MCP servers                  │
│                    │                                                                  │
│                    ▼                                                                  │
│  3. Agent SDK (Claude Code CLI) starts agent loop                                    │
│                    │                                                                  │
│                    ├──────────────────────────────────────────────────────┐          │
│                    │                                                       │          │
│                    ▼                                                       ▼          │
│  4a. Built-in tools        4b. MCP tools                     4c. TodoWrite           │
│      (Read, Write,              │                                  │                  │
│       Bash, etc.)               ▼                                  ▼                  │
│           │              ┌─────────────────┐              Progress published         │
│           │              │ MCP Server      │              to Redis                   │
│           │              │ (RLM/RAG)       │                   │                      │
│           │              │      │          │                   │                      │
│           │              │      ▼          │                   │                      │
│           │              │ Anthropic API   │                   │                      │
│           │              │ (Extended Think │                   │                      │
│           │              │  or Caching)    │                   │                      │
│           │              │      │          │                   │                      │
│           │              │      ▼          │                   │                      │
│           │              │ Returns result  │                   │                      │
│           │              │ to agent        │                   │                      │
│           │              └─────────────────┘                   │                      │
│           │                     │                              │                      │
│           └──────────────┬──────┘                              │                      │
│                          │                                     │                      │
│                          ▼                                     ▼                      │
│  5. Agent continues with results, updates todos                                      │
│                    │                                                                  │
│                    ▼                                                                  │
│  6. Each message streamed to Redis by Agent Runner                                   │
│                    │                                                                  │
│                    ▼                                                                  │
│  7. SPA receives via WebSocket, updates UI (progress, todos, artifacts)              │
│                    │                                                                  │
│                    ▼                                                                  │
│  8. On completion, HITL gate requested if needed                                     │
│                    │                                                                  │
│                    ▼                                                                  │
│  9. Human approves in SPA, Coordinator continues to next phase                       │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
