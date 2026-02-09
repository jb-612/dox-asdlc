"""MCP server for Guardrails tools.

Exposes Guardrails functionality as MCP tools that can be invoked
by Claude Code hooks. This provides guardrails evaluation and gate
decision logging capabilities.

Tools exposed:
    - guardrails_get_context: Evaluate guardrails for a task context
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger(__name__)


class GuardrailsMCPServer:
    """MCP server providing Guardrails tools.

    Exposes the guardrails_get_context tool for Claude Code to evaluate
    which guidelines apply to a given task context.

    This server uses stdio transport and runs as a subprocess of Claude Code.

    Example:
        ```python
        server = GuardrailsMCPServer()
        await server.run_stdio()
        ```
    """

    def __init__(self) -> None:
        """Initialize the MCP server.

        Creates the server with lazy evaluator initialization. The evaluator
        is only created when first needed to avoid connection overhead
        if tools are never called.
        """
        from src.core.guardrails.config import GuardrailsConfig

        self._config = GuardrailsConfig.from_env()
        self._evaluator: Any = None
        self._store: Any = None

    async def _get_evaluator(self) -> Any:
        """Get or create the GuardrailsEvaluator.

        Lazy initialization: creates Elasticsearch client, GuardrailsStore,
        and GuardrailsEvaluator on first use.

        Returns:
            GuardrailsEvaluator: The evaluator instance for operations.
        """
        if self._evaluator is None:
            # Lazy import to avoid requiring elasticsearch at module load
            from elasticsearch import AsyncElasticsearch

            from src.core.guardrails.evaluator import GuardrailsEvaluator
            from src.infrastructure.guardrails.guardrails_store import (
                GuardrailsStore,
            )

            es_client = AsyncElasticsearch(hosts=[self._config.elasticsearch_url])

            self._store = GuardrailsStore(
                es_client=es_client, index_prefix=self._config.index_prefix
            )
            self._evaluator = GuardrailsEvaluator(
                store=self._store, cache_ttl=self._config.cache_ttl
            )
        return self._evaluator

    async def guardrails_get_context(
        self,
        agent: str | None = None,
        domain: str | None = None,
        action: str | None = None,
        paths: list[str] | None = None,
        event: str | None = None,
        gate_type: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Evaluate guardrails for given context.

        Evaluates which guidelines apply to the provided task context and
        returns matched guidelines with aggregated instructions and tool
        restrictions.

        Args:
            agent: Agent role name (e.g., "backend", "frontend").
            domain: Domain context (e.g., "P01", "P05").
            action: Action being performed (e.g., "implement", "review").
            paths: File paths involved in the action.
            event: Hook event type (e.g., "commit", "pre_tool_use").
            gate_type: HITL gate type (e.g., "devops_invocation").
            session_id: Session identifier for audit tracking.

        Returns:
            Dict with evaluation results:
                - success: True if evaluation completed
                - matched_count: Number of guidelines matched
                - combined_instruction: Merged instruction text
                - tools_allowed: List of allowed tool patterns
                - tools_denied: List of denied tool patterns
                - hitl_gates: List of required HITL gate types
                - guidelines: List of matched guidelines with metadata
                - error: Error message if evaluation failed

        Example response:
            {
                "success": true,
                "matched_count": 2,
                "combined_instruction": "Follow TDD protocol...",
                "tools_allowed": ["pytest", "git"],
                "tools_denied": ["rm"],
                "hitl_gates": ["devops_invocation"],
                "guidelines": [
                    {
                        "id": "tdd-backend",
                        "name": "TDD Protocol for Backend",
                        "priority": 100,
                        "match_score": 1.0,
                        "matched_fields": ["agents", "domains"]
                    }
                ]
            }
        """
        # Early return if guardrails are disabled - permissive mode
        if not self._config.enabled:
            return {
                "success": True,
                "matched_count": 0,
                "combined_instruction": "",
                "tools_allowed": [],
                "tools_denied": [],
                "hitl_gates": [],
                "guidelines": [],
            }

        try:
            from src.core.guardrails.models import TaskContext

            # Build TaskContext from parameters
            # Agent defaults to None if not provided
            task_context = TaskContext(
                agent=agent or "",
                domain=domain,
                action=action,
                paths=paths,
                event=event,
                gate_type=gate_type,
                session_id=session_id,
            )

            evaluator = await self._get_evaluator()
            evaluated_context = await evaluator.get_context(task_context)

            # Build response
            guidelines_list = []
            for eg in evaluated_context.matched_guidelines:
                guidelines_list.append(
                    {
                        "id": eg.guideline.id,
                        "name": eg.guideline.name,
                        "priority": eg.guideline.priority,
                        "match_score": eg.match_score,
                        "matched_fields": list(eg.matched_fields),
                    }
                )

            return {
                "success": True,
                "matched_count": len(evaluated_context.matched_guidelines),
                "combined_instruction": evaluated_context.combined_instruction,
                "tools_allowed": list(evaluated_context.tools_allowed),
                "tools_denied": list(evaluated_context.tools_denied),
                "hitl_gates": list(evaluated_context.hitl_gates),
                "guidelines": guidelines_list,
            }

        except Exception as e:
            logger.error(f"Guardrails evaluation failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def guardrails_log_decision(
        self,
        guideline_id: str,
        result: str,
        reason: str,
        gate_type: str | None = None,
        user_response: str | None = None,
        agent: str | None = None,
        domain: str | None = None,
        action: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Log a HITL gate decision for audit trail.

        Records a HITL gate decision including the guideline that triggered it,
        the user's decision, and optional context information.

        Args:
            guideline_id: The guideline that triggered the gate.
            result: Decision result: "approved", "rejected", or "skipped".
            reason: Reason for the decision.
            gate_type: HITL gate type (e.g., "devops_invocation") (optional).
            user_response: The user's response text (optional).
            agent: Agent role name (optional).
            domain: Domain context (optional).
            action: Action being performed (optional).
            session_id: Session identifier (optional).

        Returns:
            Dict with log result:
                - success: True if logging succeeded
                - audit_id: ID of the audit entry created
                - error: Error message if logging failed

        Example response:
            {
                "success": true,
                "audit_id": "audit-entry-123"
            }
        """
        # Early return if guardrails are disabled - no-op success
        if not self._config.enabled:
            return {
                "success": True,
                "audit_id": "disabled",
            }

        try:
            from src.core.guardrails.models import GateDecision, TaskContext

            # Build TaskContext from parameters if any are provided
            context = None
            if agent or domain or action or session_id:
                context = TaskContext(
                    agent=agent or "",
                    domain=domain,
                    action=action,
                    session_id=session_id,
                )

            # Build GateDecision
            decision = GateDecision(
                guideline_id=guideline_id,
                gate_type=gate_type or "",
                result=result,
                reason=reason,
                user_response=user_response or "",
                context=context,
            )

            evaluator = await self._get_evaluator()
            audit_id = await evaluator.log_decision(decision)

            return {
                "success": True,
                "audit_id": audit_id,
            }

        except Exception as e:
            logger.error(f"Guardrails decision logging failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    async def shutdown(self) -> None:
        """Shut down the MCP server and release resources.

        Closes the underlying GuardrailsStore (and its ES client) if
        it was lazily initialized. Resets internal references so the
        server could theoretically be re-initialized.
        """
        if self._store is not None:
            await self._store.close()
            logger.info("Guardrails store closed")
        self._store = None
        self._evaluator = None

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Get MCP tool schema definitions.

        Returns the schema definitions for all tools exposed by this
        server, in MCP tool format.

        Returns:
            List of tool schemas with name, description, and inputSchema.
        """
        return [
            {
                "name": "guardrails_get_context",
                "description": "Evaluate guardrails for a task context and get applicable guidelines",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "agent": {
                            "type": "string",
                            "description": "Agent role name (e.g., backend, frontend)",
                        },
                        "domain": {
                            "type": "string",
                            "description": "Domain context (e.g., P01, P05)",
                        },
                        "action": {
                            "type": "string",
                            "description": "Action being performed (e.g., implement, review)",
                        },
                        "paths": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "File paths involved in the action",
                        },
                        "event": {
                            "type": "string",
                            "description": "Hook event type (e.g., commit, pre_tool_use)",
                        },
                        "gate_type": {
                            "type": "string",
                            "description": "HITL gate type (e.g., devops_invocation)",
                        },
                        "session_id": {
                            "type": "string",
                            "description": "Session identifier for audit tracking",
                        },
                    },
                },
            },
            {
                "name": "guardrails_log_decision",
                "description": "Log a HITL gate decision for audit trail",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "guideline_id": {
                            "type": "string",
                            "description": "The guideline that triggered the gate",
                        },
                        "result": {
                            "type": "string",
                            "description": "Decision result: approved, rejected, or skipped",
                        },
                        "reason": {
                            "type": "string",
                            "description": "Reason for the decision",
                        },
                        "gate_type": {
                            "type": "string",
                            "description": "HITL gate type (e.g., devops_invocation)",
                        },
                        "user_response": {
                            "type": "string",
                            "description": "The user's response text",
                        },
                        "agent": {
                            "type": "string",
                            "description": "Agent role name",
                        },
                        "domain": {
                            "type": "string",
                            "description": "Domain context",
                        },
                        "action": {
                            "type": "string",
                            "description": "Action being performed",
                        },
                        "session_id": {
                            "type": "string",
                            "description": "Session identifier",
                        },
                    },
                    "required": ["guideline_id", "result", "reason"],
                },
            },
        ]

    async def handle_request(
        self, request: dict[str, Any]
    ) -> dict[str, Any] | None:
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
                            "name": "guardrails-mcp-server",
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

                if tool_name == "guardrails_get_context":
                    result = await self.guardrails_get_context(**arguments)
                elif tool_name == "guardrails_log_decision":
                    result = await self.guardrails_log_decision(**arguments)
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
        logger.info("Starting guardrails MCP server")

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

        # Cleanup - close the store and its ES client
        await self.shutdown()
        logger.info("Guardrails MCP server stopped")


async def main() -> None:
    """Entry point for the MCP server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stderr,
    )

    server = GuardrailsMCPServer()
    await server.run_stdio()


if __name__ == "__main__":
    asyncio.run(main())
