"""CLI-based agent backend using Claude Code, Codex, or Cursor.

Executes agent work by running a coding CLI tool as a subprocess
in headless mode. Supports Claude Code (-p), Codex (exec), and
Cursor (--print) with vendor-specific flag translation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
from typing import Any

from src.workers.agents.backends.base import (
    AgentBackend,
    BackendConfig,
    BackendResult,
)

logger = logging.getLogger(__name__)


# CLI-specific flag mappings
_CLI_PROFILES: dict[str, dict[str, Any]] = {
    "claude": {
        "print_flag": "-p",
        "output_flag": ["--output-format", "json"],
        "skip_permissions": "--dangerously-skip-permissions",
        "max_turns_flag": "--max-turns",
        "budget_flag": "--max-budget-usd",
        "model_flag": "--model",
        "schema_flag": "--json-schema",
        "system_prompt_flag": "--system-prompt",
        "allowed_tools_flag": "--allowedTools",
    },
    "codex": {
        "print_flag": "exec",
        "output_flag": ["--json"],
        "skip_permissions": "--full-auto",
        "max_turns_flag": None,
        "budget_flag": None,
        "model_flag": "--model",
        "schema_flag": None,
        "system_prompt_flag": None,
        "allowed_tools_flag": None,
    },
}


class CLIAgentBackend:
    """Agent backend that delegates to a coding CLI tool.

    Runs the CLI in headless/non-interactive mode and captures
    structured JSON output. Works in Docker containers with
    --dangerously-skip-permissions for zero-touch execution.

    Example:
        backend = CLIAgentBackend(cli="claude")
        result = await backend.execute(
            prompt="Break this PRD into features",
            workspace_path="/workspace",
            config=BackendConfig(max_turns=20, model="sonnet"),
        )
    """

    def __init__(
        self,
        cli: str = "claude",
        skip_permissions: bool = True,
    ) -> None:
        """Initialize CLI backend.

        Args:
            cli: CLI tool name ("claude" or "codex").
            skip_permissions: Auto-approve all tool operations.
        """
        if cli not in _CLI_PROFILES:
            raise ValueError(
                f"Unsupported CLI: {cli}. Supported: {list(_CLI_PROFILES)}"
            )
        self._cli = cli
        self._profile = _CLI_PROFILES[cli]
        self._skip_permissions = skip_permissions

    @property
    def backend_name(self) -> str:
        """Return the backend identifier."""
        return f"{self._cli}-cli"

    def _build_command(
        self,
        prompt: str,
        config: BackendConfig,
    ) -> list[str]:
        """Build the CLI command with flags.

        Args:
            prompt: The task prompt.
            config: Execution configuration.

        Returns:
            Command as a list of strings.
        """
        cmd = [self._cli]
        profile = self._profile

        # Print/exec flag + prompt
        cmd.append(profile["print_flag"])
        if self._cli != "codex":
            cmd.append(prompt)
        else:
            # codex exec takes prompt as positional arg after flags
            pass

        # Output format
        cmd.extend(profile["output_flag"])

        # Skip permissions
        if self._skip_permissions and profile["skip_permissions"]:
            cmd.append(profile["skip_permissions"])

        # System prompt
        if config.system_prompt and profile.get("system_prompt_flag"):
            cmd.extend([profile["system_prompt_flag"], config.system_prompt])

        # Model override
        if config.model and profile.get("model_flag"):
            cmd.extend([profile["model_flag"], config.model])

        # Max turns
        if config.max_turns and profile.get("max_turns_flag"):
            cmd.extend([profile["max_turns_flag"], str(config.max_turns)])

        # Budget
        if config.max_budget_usd and profile.get("budget_flag"):
            cmd.extend([profile["budget_flag"], str(config.max_budget_usd)])

        # JSON schema
        if config.output_schema and profile.get("schema_flag"):
            cmd.extend([
                profile["schema_flag"],
                json.dumps(config.output_schema),
            ])

        # Allowed tools
        if config.allowed_tools and profile.get("allowed_tools_flag"):
            cmd.extend([
                profile["allowed_tools_flag"],
                ",".join(config.allowed_tools),
            ])

        # Extra flags
        cmd.extend(config.extra_flags)

        # For codex, prompt goes last
        if self._cli == "codex":
            cmd.append(prompt)

        return cmd

    async def execute(
        self,
        prompt: str,
        workspace_path: str,
        config: BackendConfig | None = None,
    ) -> BackendResult:
        """Execute a prompt via the CLI tool.

        Args:
            prompt: The task prompt.
            workspace_path: Working directory.
            config: Execution configuration.

        Returns:
            BackendResult with parsed CLI output.
        """
        config = config or BackendConfig()
        cmd = self._build_command(prompt, config)

        logger.info(
            f"Executing {self._cli} CLI in {workspace_path} "
            f"(max_turns={config.max_turns})"
        )
        logger.debug(f"Command: {' '.join(cmd[:3])}... ({len(cmd)} args)")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=workspace_path,
            )

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=config.timeout_seconds,
            )

            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")

            if process.returncode != 0:
                logger.error(
                    f"{self._cli} CLI failed (rc={process.returncode}): "
                    f"{stderr[:500]}"
                )
                return BackendResult(
                    success=False,
                    output=stdout,
                    error=f"CLI exited with code {process.returncode}: {stderr[:500]}",
                )

            return self._parse_output(stdout)

        except asyncio.TimeoutError:
            logger.error(
                f"{self._cli} CLI timed out after {config.timeout_seconds}s"
            )
            return BackendResult(
                success=False,
                error=f"CLI timed out after {config.timeout_seconds}s",
            )
        except FileNotFoundError:
            logger.error(f"{self._cli} CLI not found in PATH")
            return BackendResult(
                success=False,
                error=f"{self._cli} not found. Install it or check PATH.",
            )

    def _parse_output(self, stdout: str) -> BackendResult:
        """Parse CLI JSON output into BackendResult.

        Claude Code --output-format json returns a JSON object with:
        - result: text output
        - session_id: session identifier
        - is_error: boolean
        - total_cost_usd: float
        - num_turns: int
        - structured_output: dict (if --json-schema was used)

        Args:
            stdout: Raw stdout from CLI.

        Returns:
            Parsed BackendResult.
        """
        try:
            data = json.loads(stdout)
        except json.JSONDecodeError:
            # Not JSON — treat as raw text output
            return BackendResult(
                success=True,
                output=stdout.strip(),
            )

        # Handle Claude Code JSON format
        if isinstance(data, dict) and "result" in data:
            return BackendResult(
                success=not data.get("is_error", False),
                output=data.get("result", ""),
                structured_output=data.get("structured_output"),
                session_id=data.get("session_id"),
                cost_usd=data.get("total_cost_usd"),
                turns=data.get("num_turns"),
                error=data.get("result") if data.get("is_error") else None,
                metadata={
                    "duration_ms": data.get("duration_ms"),
                    "duration_api_ms": data.get("duration_api_ms"),
                    "usage": data.get("usage", {}),
                    "subtype": data.get("subtype"),
                },
            )

        # Handle array format (older Claude Code versions)
        if isinstance(data, list):
            result_msg = next(
                (m for m in data if isinstance(m, dict) and m.get("type") == "result"),
                None,
            )
            if result_msg:
                return BackendResult(
                    success=not result_msg.get("is_error", False),
                    output=result_msg.get("result", ""),
                    structured_output=result_msg.get("structured_output"),
                    session_id=result_msg.get("session_id"),
                    cost_usd=result_msg.get("total_cost_usd"),
                    turns=result_msg.get("num_turns"),
                    error=result_msg.get("result") if result_msg.get("is_error") else None,
                )

        # Fallback: treat entire JSON as structured output
        return BackendResult(
            success=True,
            output=json.dumps(data),
            structured_output=data if isinstance(data, dict) else None,
        )

    async def health_check(self) -> bool:
        """Check if the CLI tool is available.

        Returns:
            True if the CLI binary is found in PATH.
        """
        return shutil.which(self._cli) is not None
