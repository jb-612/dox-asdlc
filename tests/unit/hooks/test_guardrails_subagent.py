"""Tests for guardrails-subagent SubagentStart hook."""

import importlib.util
import json
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


def import_hook_module():
    """Import the guardrails-subagent hook script as a module."""
    hook_path = Path(__file__).resolve().parents[3] / ".claude" / "hooks" / "guardrails-subagent.py"
    if not hook_path.exists():
        pytest.skip(f"Hook script not found at {hook_path}")
    spec = importlib.util.spec_from_file_location("guardrails_subagent", str(hook_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestGuardrailsSubagentHook:
    """Test the guardrails-subagent hook helper functions."""

    @pytest.fixture
    def hook(self):
        """Import the hook module."""
        return import_hook_module()

    def test_read_parent_cache_valid(self, hook, tmp_path):
        """Test reading a valid parent cache file."""
        parent_session_id = "session-parent-123"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [{"guideline_id": "GR001"}],
                "combined_instruction": "Follow TDD protocol.",
                "tools_denied": ["Write"],
                "tools_allowed": ["Read"],
                "hitl_gates": ["protected_paths"],
            }
        }

        # Patch tempfile.gettempdir to use tmp_path
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)

        try:
            cache_path = tmp_path / f"guardrails-{parent_session_id}.json"
            cache_path.write_text(json.dumps(cache_data))

            result = hook.read_parent_cache(parent_session_id)

            assert result is not None
            assert result["tools_denied"] == ["Write"]
            assert result["tools_allowed"] == ["Read"]
            assert result["matched_guidelines"][0]["guideline_id"] == "GR001"
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_read_parent_cache_missing(self, hook, tmp_path):
        """Test that missing parent cache returns None."""
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)

        try:
            result = hook.read_parent_cache("nonexistent-session")

            assert result is None
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_read_parent_cache_expired(self, hook, tmp_path):
        """Test that expired parent cache returns None."""
        parent_session_id = "session-parent-456"
        old_time = datetime.now(timezone.utc) - timedelta(seconds=400)
        cache_data = {
            "timestamp": old_time.isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {"tools_denied": ["Write"]}
        }

        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)

        try:
            cache_path = tmp_path / f"guardrails-{parent_session_id}.json"
            cache_path.write_text(json.dumps(cache_data))

            result = hook.read_parent_cache(parent_session_id)

            assert result is None
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_format_agent_context_full(self, hook):
        """Test formatting with full evaluated result."""
        agent_name = "backend"
        evaluated = {
            "matched_guidelines": [
                {"guideline_id": "GR001", "content": "Test guideline"}
            ],
            "combined_instruction": "Follow TDD protocol.\nNever modify protected paths.",
            "tools_denied": ["Edit", "Write"],
            "tools_allowed": ["Read", "Bash"],
            "hitl_gates": ["protected_paths", "contract_change"],
        }

        result = hook.format_agent_context(agent_name, evaluated)

        assert f"## Guardrails for {agent_name} agent" in result
        assert "Follow TDD protocol." in result
        assert "Never modify protected paths." in result
        assert "**Tools denied:** Edit, Write" in result
        assert "**Tools allowed:** Read, Bash" in result
        assert "**HITL gates required:** protected_paths, contract_change" in result

    def test_format_agent_context_minimal(self, hook):
        """Test formatting with minimal evaluated result."""
        agent_name = "frontend"
        evaluated = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Basic instruction.",
            "tools_denied": [],
            "tools_allowed": [],
            "hitl_gates": [],
        }

        result = hook.format_agent_context(agent_name, evaluated)

        assert f"## Guardrails for {agent_name} agent" in result
        assert "Basic instruction." in result
        # Should not have empty lists
        assert "Tools denied:" not in result
        assert "Tools allowed:" not in result
        assert "HITL gates required:" not in result

    def test_format_agent_context_empty(self, hook):
        """Test formatting with empty evaluated result."""
        agent_name = "orchestrator"
        evaluated = {
            "matched_guidelines": [],
            "combined_instruction": "",
            "tools_denied": [],
            "tools_allowed": [],
            "hitl_gates": [],
        }

        result = hook.format_agent_context(agent_name, evaluated)

        # Should just have the header
        assert f"## Guardrails for {agent_name} agent" in result
        # Should be very minimal (just the header line)
        lines = result.strip().split("\n")
        assert len(lines) == 1

    def test_write_agent_cache(self, hook, tmp_path):
        """Test that write_agent_cache creates a valid JSON file."""
        session_id = "session-agent-123"
        agent_name = "backend"
        evaluated = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Test instruction",
            "tools_denied": ["Write"],
        }

        # Patch tempfile.gettempdir to use tmp_path
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)

        try:
            hook.write_agent_cache(session_id, agent_name, evaluated)

            cache_path = tmp_path / f"guardrails-{session_id}.json"
            assert cache_path.exists()

            data = json.loads(cache_path.read_text())
            assert "timestamp" in data
            assert data["ttl_seconds"] == 300
            assert data["context"]["agent"] == agent_name
            assert data["evaluated"] == evaluated

            # Verify timestamp is valid ISO format
            datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_write_agent_cache_error(self, hook):
        """Test that write_agent_cache handles errors gracefully."""
        session_id = "session-agent-456"
        agent_name = "backend"
        evaluated = {}

        # Point to a non-writable location
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: "/nonexistent/path"

        try:
            # Should not raise, just fail silently
            hook.write_agent_cache(session_id, agent_name, evaluated)
        finally:
            tf_module.gettempdir = original_gettempdir
