"""Agent dispatcher for routing events to agents.

Routes AGENT_STARTED events to the appropriate agent implementation
based on the agent_type in the event metadata.
"""

from __future__ import annotations

import logging

from src.core.events import ASDLCEvent
from src.core.exceptions import AgentError
from src.workers.agents.protocols import AgentContext, AgentResult, BaseAgent

logger = logging.getLogger(__name__)


class AgentNotFoundError(AgentError):
    """Raised when no agent is registered for the requested type."""

    pass


class AgentDispatcher:
    """Dispatcher that routes events to registered agents.

    Agents are registered by type and dispatched based on the
    agent_type field in the event metadata.

    Example:
        dispatcher = AgentDispatcher()
        dispatcher.register(CodingAgent())
        dispatcher.register(ReviewerAgent())

        result = await dispatcher.dispatch(event, context)
    """

    def __init__(self) -> None:
        """Initialize the dispatcher."""
        self._agents: dict[str, BaseAgent] = {}

    @property
    def registered_agents(self) -> list[str]:
        """Return list of registered agent types."""
        return list(self._agents.keys())

    def register(self, agent: BaseAgent) -> None:
        """Register an agent for dispatching.

        Args:
            agent: The agent to register. Must implement BaseAgent protocol.
        """
        self._agents[agent.agent_type] = agent
        logger.info(f"Registered agent: {agent.agent_type}")

    def get_agent(self, agent_type: str) -> BaseAgent | None:
        """Get a registered agent by type.

        Args:
            agent_type: The type identifier of the agent.

        Returns:
            The registered agent, or None if not found.
        """
        return self._agents.get(agent_type)

    def get_agent_type_from_event(self, event: ASDLCEvent) -> str | None:
        """Extract the agent type from an event's metadata.

        Args:
            event: The event to extract agent type from.

        Returns:
            The agent type string, or None if not present.
        """
        return event.metadata.get("agent_type")

    async def dispatch(
        self,
        event: ASDLCEvent,
        context: AgentContext,
    ) -> AgentResult:
        """Dispatch an event to the appropriate agent.

        Looks up the agent by type from the event metadata, calls any
        validation method, executes the agent, and calls cleanup.

        Args:
            event: The AGENT_STARTED event to dispatch.
            context: The execution context for the agent.

        Returns:
            AgentResult: The result from the agent execution.

        Raises:
            AgentNotFoundError: If no agent is registered for the type.
        """
        agent_type = self.get_agent_type_from_event(event)

        if not agent_type:
            raise AgentNotFoundError(
                "Event metadata missing agent_type",
                details={"event_id": event.event_id},
            )

        agent = self.get_agent(agent_type)

        if not agent:
            raise AgentNotFoundError(
                f"No agent registered for type: {agent_type}",
                details={
                    "agent_type": agent_type,
                    "event_id": event.event_id,
                    "registered_agents": self.registered_agents,
                },
            )

        logger.info(f"Dispatching to agent: {agent_type} for task: {context.task_id}")

        try:
            # Call validate_context if the agent implements it
            if hasattr(agent, "validate_context"):
                is_valid = await agent.validate_context(context)
                if not is_valid:
                    logger.warning(f"Context validation failed for {agent_type}")
                    return AgentResult(
                        success=False,
                        agent_type=agent_type,
                        task_id=context.task_id,
                        error_message="Context validation failed",
                        should_retry=False,
                    )

            # Execute the agent
            result = await agent.execute(context, event.metadata)

            return result

        finally:
            # Call cleanup if the agent implements it
            if hasattr(agent, "cleanup"):
                try:
                    await agent.cleanup(context)
                except Exception as e:
                    logger.error(f"Cleanup failed for {agent_type}: {e}")
