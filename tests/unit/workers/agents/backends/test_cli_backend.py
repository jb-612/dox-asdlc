"""Unit tests for CLI Agent Backend."""

from __future__ import annotations

import json

import pytest

from src.workers.agents.backends.base import BackendConfig, BackendResult
from src.workers.agents.backends.cli_backend import CLIAgentBackend


class TestCLIAgentBackendInit:
    """Tests for CLI backend initialization."""

    def test_default_cli(self) -> None:
        backend = CLIAgentBackend()
        assert backend.backend_name == "claude-cli"

    def test_codex_cli(self) -> None:
        backend = CLIAgentBackend(cli="codex")
        assert backend.backend_name == "codex-cli"

    def test_unsupported_cli_raises(self) -> None:
        with pytest.raises(ValueError, match="Unsupported CLI"):
            CLIAgentBackend(cli="unknown-cli")


class TestCLIAgentBackendBuildCommand:
    """Tests for command building."""

    def test_basic_claude_command(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        cmd = backend._build_command("Do something", BackendConfig())
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "Do something" in cmd
        assert "--output-format" in cmd
        assert "json" in cmd
        assert "--dangerously-skip-permissions" in cmd

    def test_claude_with_model(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        config = BackendConfig(model="opus")
        cmd = backend._build_command("prompt", config)
        assert "--model" in cmd
        idx = cmd.index("--model")
        assert cmd[idx + 1] == "opus"

    def test_claude_with_max_turns(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        config = BackendConfig(max_turns=20)
        cmd = backend._build_command("prompt", config)
        assert "--max-turns" in cmd
        idx = cmd.index("--max-turns")
        assert cmd[idx + 1] == "20"

    def test_claude_with_budget(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        config = BackendConfig(max_budget_usd=2.0)
        cmd = backend._build_command("prompt", config)
        assert "--max-budget-usd" in cmd

    def test_claude_with_schema(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        schema = {"type": "object", "properties": {}}
        config = BackendConfig(output_schema=schema)
        cmd = backend._build_command("prompt", config)
        assert "--json-schema" in cmd

    def test_claude_with_system_prompt(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        config = BackendConfig(system_prompt="Be helpful")
        cmd = backend._build_command("prompt", config)
        assert "--system-prompt" in cmd
        idx = cmd.index("--system-prompt")
        assert cmd[idx + 1] == "Be helpful"

    def test_claude_without_permissions_skip(self) -> None:
        backend = CLIAgentBackend(cli="claude", skip_permissions=False)
        cmd = backend._build_command("prompt", BackendConfig())
        assert "--dangerously-skip-permissions" not in cmd

    def test_codex_command(self) -> None:
        backend = CLIAgentBackend(cli="codex")
        cmd = backend._build_command("Do something", BackendConfig())
        assert cmd[0] == "codex"
        assert "exec" in cmd
        assert "--json" in cmd
        assert "--full-auto" in cmd
        # Prompt should be at the end for codex
        assert cmd[-1] == "Do something"

    def test_extra_flags(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        config = BackendConfig(extra_flags=["--verbose", "--no-session-persistence"])
        cmd = backend._build_command("prompt", config)
        assert "--verbose" in cmd
        assert "--no-session-persistence" in cmd


class TestCLIAgentBackendParseOutput:
    """Tests for output parsing."""

    def test_parse_claude_json_result(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        output = json.dumps({
            "type": "result",
            "subtype": "success",
            "result": "Found 3 issues",
            "session_id": "abc-123",
            "is_error": False,
            "total_cost_usd": 0.05,
            "num_turns": 5,
            "duration_ms": 45000,
            "usage": {"input_tokens": 1000, "output_tokens": 500},
        })

        result = backend._parse_output(output)

        assert result.success is True
        assert result.output == "Found 3 issues"
        assert result.session_id == "abc-123"
        assert result.cost_usd == 0.05
        assert result.turns == 5
        assert result.error is None

    def test_parse_claude_error_result(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        output = json.dumps({
            "result": "Rate limited",
            "is_error": True,
            "session_id": "abc-123",
        })

        result = backend._parse_output(output)

        assert result.success is False
        assert result.error == "Rate limited"

    def test_parse_claude_array_format(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        output = json.dumps([
            {"type": "system", "subtype": "init"},
            {
                "type": "result",
                "subtype": "success",
                "result": "Done",
                "session_id": "xyz",
                "is_error": False,
                "total_cost_usd": 0.02,
                "num_turns": 2,
            },
        ])

        result = backend._parse_output(output)

        assert result.success is True
        assert result.output == "Done"
        assert result.session_id == "xyz"

    def test_parse_raw_text(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        result = backend._parse_output("Just some text output\n")

        assert result.success is True
        assert result.output == "Just some text output"

    def test_parse_structured_output(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        output = json.dumps({
            "result": "Generated plan",
            "is_error": False,
            "structured_output": {"features": [{"id": "F01"}]},
            "session_id": "abc",
        })

        result = backend._parse_output(output)

        assert result.structured_output == {"features": [{"id": "F01"}]}


class TestCursorCLIProfile:
    """Tests for Cursor CLI profile (#273)."""

    def test_cursor_cli_init(self) -> None:
        backend = CLIAgentBackend(cli="cursor")
        assert backend.backend_name == "cursor-cli"

    def test_cursor_command_uses_agent_binary(self) -> None:
        backend = CLIAgentBackend(cli="cursor")
        cmd = backend._build_command("Do something", BackendConfig())
        # Binary must be 'agent', not 'cursor'
        assert cmd[0] == "agent"

    def test_cursor_command_uses_force_flag(self) -> None:
        backend = CLIAgentBackend(cli="cursor")
        cmd = backend._build_command("Do something", BackendConfig())
        assert "--force" in cmd
        assert "--dangerously-skip-permissions" not in cmd

    def test_cursor_command_has_json_output(self) -> None:
        backend = CLIAgentBackend(cli="cursor")
        cmd = backend._build_command("Do something", BackendConfig())
        assert "--output-format" in cmd
        idx = cmd.index("--output-format")
        assert cmd[idx + 1] == "json"

    def test_cursor_command_with_model(self) -> None:
        backend = CLIAgentBackend(cli="cursor")
        config = BackendConfig(model="claude-4")
        cmd = backend._build_command("prompt", config)
        assert "--model" in cmd
        idx = cmd.index("--model")
        assert cmd[idx + 1] == "claude-4"

    def test_cursor_max_turns_not_added(self) -> None:
        """Cursor CLI does not support --max-turns; the flag must be omitted."""
        backend = CLIAgentBackend(cli="cursor")
        config = BackendConfig(max_turns=10)
        cmd = backend._build_command("prompt", config)
        assert "--max-turns" not in cmd

    def test_cursor_budget_not_added(self) -> None:
        """Cursor CLI does not support --max-budget-usd; the flag must be omitted."""
        backend = CLIAgentBackend(cli="cursor")
        config = BackendConfig(max_budget_usd=5.0)
        cmd = backend._build_command("prompt", config)
        assert "--max-budget-usd" not in cmd

    def test_cursor_system_prompt_not_added(self) -> None:
        """Cursor uses .cursor/rules/ instead of --system-prompt."""
        backend = CLIAgentBackend(cli="cursor")
        config = BackendConfig(system_prompt="Be concise")
        cmd = backend._build_command("prompt", config)
        assert "--system-prompt" not in cmd

    @pytest.mark.asyncio
    async def test_cursor_health_check_returns_bool(self) -> None:
        backend = CLIAgentBackend(cli="cursor")
        # Returns False when 'agent' binary not on PATH in test environment
        result = await backend.health_check()
        assert isinstance(result, bool)


class TestCLIAgentBackendHealthCheck:
    """Tests for health check."""

    @pytest.mark.asyncio
    async def test_health_check_missing_cli(self) -> None:
        backend = CLIAgentBackend(cli="claude")
        # This will return False if claude is not installed
        result = await backend.health_check()
        assert isinstance(result, bool)
