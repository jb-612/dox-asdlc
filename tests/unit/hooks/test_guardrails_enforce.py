"""Tests for guardrails-enforce PreToolUse hook."""

import importlib.util
import json
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


def import_hook_module():
    """Import the guardrails-enforce hook script as a module."""
    hook_path = Path(__file__).resolve().parents[3] / ".claude" / "hooks" / "guardrails-enforce.py"
    if not hook_path.exists():
        pytest.skip(f"Hook script not found at {hook_path}")
    spec = importlib.util.spec_from_file_location("guardrails_enforce", str(hook_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestGuardrailsEnforceHook:
    """Test the guardrails-enforce hook helper functions."""

    @pytest.fixture
    def hook(self):
        """Import the hook module."""
        return import_hook_module()

    def test_read_cache_valid(self, hook, tmp_path):
        """Test reading a valid cache file."""
        session_id = "test-session-123"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [{"guideline_id": "GR001"}],
                "tools_denied": ["Write"],
            }
        }

        # Patch tempfile.gettempdir to use tmp_path
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)

        try:
            cache_path = tmp_path / f"guardrails-{session_id}.json"
            cache_path.write_text(json.dumps(cache_data))

            result = hook.read_cache(session_id)

            assert result is not None
            assert result["tools_denied"] == ["Write"]
            assert result["matched_guidelines"][0]["guideline_id"] == "GR001"
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_read_cache_expired(self, hook, tmp_path):
        """Test that expired cache returns None."""
        session_id = "test-session-456"
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
            cache_path = tmp_path / f"guardrails-{session_id}.json"
            cache_path.write_text(json.dumps(cache_data))

            result = hook.read_cache(session_id)

            assert result is None
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_read_cache_missing(self, hook, tmp_path):
        """Test that missing cache returns None."""
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)

        try:
            result = hook.read_cache("nonexistent-session")

            assert result is None
        finally:
            tf_module.gettempdir = original_gettempdir

    def test_sanitize_path_normal(self, hook):
        """Test that normal paths pass through."""
        paths = [
            "src/workers/pool.py",
            "src/hitl_ui/components/App.tsx",
            "/absolute/path/to/file.py",
            "relative/path.md",
        ]

        for path in paths:
            result = hook.sanitize_path(path)
            assert result == path.replace("\\", "/")

    def test_sanitize_path_traversal(self, hook):
        """Test that paths with .. return None."""
        paths = [
            "../outside/file.py",
            "src/../../../etc/passwd",
            "src/workers/../../secret.txt",
        ]

        for path in paths:
            result = hook.sanitize_path(path)
            assert result is None, f"Path {path} should be rejected"

    def test_sanitize_path_backslash(self, hook):
        """Test that backslashes are normalized."""
        path = "src\\workers\\pool.py"
        result = hook.sanitize_path(path)

        assert result == "src/workers/pool.py"

    def test_sanitize_path_empty(self, hook):
        """Test that empty path returns None."""
        result = hook.sanitize_path("")
        assert result is None

    def test_extract_paths_file_path(self, hook):
        """Test extracting from file_path argument."""
        tool = "Write"
        arguments = {"file_path": "src/workers/pool.py", "content": "..."}

        paths = hook.extract_paths_from_arguments(tool, arguments)

        assert len(paths) == 1
        assert paths[0] == "src/workers/pool.py"

    def test_extract_paths_multiple(self, hook):
        """Test extracting from multiple path fields."""
        tool = "Edit"
        arguments = {
            "file_path": "src/core/models.py",
            "path": "src/core/interfaces.py",  # Could be another field
        }

        paths = hook.extract_paths_from_arguments(tool, arguments)

        # Should extract both
        assert len(paths) >= 1
        assert "src/core/models.py" in paths

    def test_extract_paths_unsafe(self, hook):
        """Test that unsafe paths are not extracted."""
        tool = "Write"
        arguments = {"file_path": "../outside/file.py"}

        paths = hook.extract_paths_from_arguments(tool, arguments)

        # Should not extract unsafe path
        assert len(paths) == 0

    def test_check_tool_denied(self, hook):
        """Test tool in denied list returns mandatory block."""
        evaluated = {
            "tools_denied": ["Write", "Edit"],
            "tools_allowed": [],
        }

        reason, is_mandatory = hook.check_tool_restriction("Write", evaluated)

        assert reason is not None
        assert is_mandatory is True
        assert "Write" in reason
        assert "denied" in reason.lower()

    def test_check_tool_allowed(self, hook):
        """Test tool in allowed list passes."""
        evaluated = {
            "tools_denied": [],
            "tools_allowed": ["Read", "Bash"],
        }

        reason, is_mandatory = hook.check_tool_restriction("Read", evaluated)

        assert reason is None
        assert is_mandatory is False

    def test_check_tool_not_in_allowed(self, hook):
        """Test tool not in allowed list returns advisory warning."""
        evaluated = {
            "tools_denied": [],
            "tools_allowed": ["Read"],  # Only Read allowed
        }

        reason, is_mandatory = hook.check_tool_restriction("Write", evaluated)

        assert reason is not None
        assert is_mandatory is False  # Advisory, not mandatory
        assert "not in the allowed" in reason.lower()

    def test_check_tool_no_restrictions(self, hook):
        """Test empty tool lists return no restriction."""
        evaluated = {
            "tools_denied": [],
            "tools_allowed": [],
        }

        reason, is_mandatory = hook.check_tool_restriction("Write", evaluated)

        assert reason is None
        assert is_mandatory is False

    def test_check_path_restriction_allowed(self, hook):
        """Test path restriction allows backend agent to modify backend paths."""
        evaluated = {
            "matched_guidelines": [],
            "tools_denied": [],
        }
        context = {"agent": "backend"}
        paths = ["src/workers/pool.py"]

        reason, is_mandatory = hook.check_path_restriction(paths, evaluated, context)

        assert reason is None
        assert is_mandatory is False

    def test_check_path_restriction_blocked(self, hook):
        """Test path restriction blocks backend agent from modifying frontend paths."""
        evaluated = {
            "matched_guidelines": [],
            "tools_denied": [],
        }
        context = {"agent": "backend"}
        paths = ["src/hitl_ui/components/App.tsx"]

        reason, is_mandatory = hook.check_path_restriction(paths, evaluated, context)

        assert reason is not None
        assert is_mandatory is True
        assert "backend" in reason
        assert "hitl_ui" in reason

    def test_check_path_restriction_no_context(self, hook):
        """Test path restriction allows when no context is available."""
        evaluated = {
            "matched_guidelines": [],
            "tools_denied": [],
        }
        paths = ["src/hitl_ui/components/App.tsx"]

        reason, is_mandatory = hook.check_path_restriction(paths, evaluated, None)

        assert reason is None
        assert is_mandatory is False

    def test_check_path_restriction_test_writer(self, hook):
        """Test that test-writer agent can only write test files."""
        evaluated = {
            "matched_guidelines": [],
            "tools_denied": [],
        }
        context = {"agent": "test-writer"}

        # Allowed: test files
        reason, _ = hook.check_path_restriction(
            ["tests/unit/test_something.py"], evaluated, context
        )
        assert reason is None

        # Blocked: non-test source files
        reason, is_mandatory = hook.check_path_restriction(
            ["src/core/models.py"], evaluated, context
        )
        assert reason is not None
        assert is_mandatory is True


class TestGuardrailsEnforceSubprocess:
    """Subprocess-based end-to-end tests for guardrails-enforce.py hook.

    These tests verify the hook's stdin/stdout/exit-code contract by
    running it as a real subprocess, piping JSON to stdin, and capturing
    stdout, stderr, and exit code.
    """

    HOOK_PATH = str(
        Path(__file__).resolve().parents[3] / ".claude" / "hooks" / "guardrails-enforce.py"
    )
    PROJECT_ROOT = str(Path(__file__).resolve().parents[3])

    @pytest.fixture(autouse=True)
    def _skip_if_hook_missing(self):
        """Skip all tests in this class if the hook script is not present."""
        if not Path(self.HOOK_PATH).exists():
            pytest.skip(f"Hook script not found at {self.HOOK_PATH}")

    def _run_hook(
        self, stdin_data: dict, env_overrides: dict | None = None
    ) -> tuple[int, str, str]:
        """Run the guardrails-enforce.py hook as a subprocess.

        Args:
            stdin_data: Dictionary to serialize as JSON and pipe to stdin.
            env_overrides: Additional environment variables.

        Returns:
            Tuple of (exit_code, stdout, stderr).
        """
        import os
        import subprocess

        env = os.environ.copy()
        # Ensure the project root is on PYTHONPATH so the hook can
        # import from src/
        python_path = env.get("PYTHONPATH", "")
        if self.PROJECT_ROOT not in python_path:
            env["PYTHONPATH"] = (
                f"{self.PROJECT_ROOT}:{python_path}" if python_path else self.PROJECT_ROOT
            )
        if env_overrides:
            env.update(env_overrides)

        result = subprocess.run(
            [sys.executable, self.HOOK_PATH],
            input=json.dumps(stdin_data),
            capture_output=True,
            text=True,
            env=env,
            timeout=10,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()

    def test_clean_pass_no_cache(self):
        """With no guardrails cache, hook exits 0 with no output."""
        stdin_data = {
            "tool": "Read",
            "arguments": {"file_path": "src/core/models.py"},
            "sessionId": "nonexistent-session-no-cache-xyz",
        }
        exit_code, stdout, stderr = self._run_hook(stdin_data)

        assert exit_code == 0
        assert stdout == ""
        assert stderr == ""

    def test_tool_denied_exits_2(self, tmp_path):
        """When tool is in tools_denied, hook exits 2 with reason on stderr."""
        session_id = "test-subprocess-deny"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [{"guideline_id": "g-deny-write"}],
                "tools_denied": ["Write", "Edit"],
                "tools_allowed": [],
            },
        }
        cache_path = tmp_path / f"guardrails-{session_id}.json"
        cache_path.write_text(json.dumps(cache_data))

        stdin_data = {
            "tool": "Write",
            "arguments": {"file_path": "src/foo.py", "content": "bar"},
            "sessionId": session_id,
        }

        # Override TMPDIR so the hook reads our tmp_path
        exit_code, stdout, stderr = self._run_hook(
            stdin_data, env_overrides={"TMPDIR": str(tmp_path)}
        )

        assert exit_code == 2, f"Expected exit 2 (block), got {exit_code}. stderr={stderr}"
        assert "denied" in stderr.lower() or "Write" in stderr

    def test_tool_allowed_exits_0(self, tmp_path):
        """When tool is in tools_allowed and not denied, hook exits 0."""
        session_id = "test-subprocess-allow"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [{"guideline_id": "g-allow-read"}],
                "tools_denied": [],
                "tools_allowed": ["Read", "Grep", "Glob"],
            },
        }
        cache_path = tmp_path / f"guardrails-{session_id}.json"
        cache_path.write_text(json.dumps(cache_data))

        stdin_data = {
            "tool": "Read",
            "arguments": {"file_path": "src/core/models.py"},
            "sessionId": session_id,
        }

        exit_code, stdout, stderr = self._run_hook(
            stdin_data, env_overrides={"TMPDIR": str(tmp_path)}
        )

        assert exit_code == 0
        # No error on stderr
        assert stderr == ""

    def test_tool_not_in_allowed_list_exits_0_with_warning(self, tmp_path):
        """When tool is not in tools_allowed but not denied, hook exits 0 with warning."""
        session_id = "test-subprocess-warn"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [{"guideline_id": "g-restrict"}],
                "tools_denied": [],
                "tools_allowed": ["Read"],  # Only Read allowed
            },
        }
        cache_path = tmp_path / f"guardrails-{session_id}.json"
        cache_path.write_text(json.dumps(cache_data))

        stdin_data = {
            "tool": "Write",
            "arguments": {"file_path": "src/foo.py", "content": "bar"},
            "sessionId": session_id,
        }

        exit_code, stdout, stderr = self._run_hook(
            stdin_data, env_overrides={"TMPDIR": str(tmp_path)}
        )

        assert exit_code == 0, f"Expected exit 0 (advisory), got {exit_code}. stderr={stderr}"
        # stdout should contain JSON with additionalContext warning
        if stdout:
            output_data = json.loads(stdout)
            assert "additionalContext" in output_data
            assert "WARNING" in output_data["additionalContext"]

    def test_directory_traversal_exits_2(self, tmp_path):
        """Path with '..' directory traversal exits 2 (block)."""
        session_id = "test-subprocess-traversal"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [],
                "tools_denied": [],
                "tools_allowed": [],
            },
        }
        cache_path = tmp_path / f"guardrails-{session_id}.json"
        cache_path.write_text(json.dumps(cache_data))

        stdin_data = {
            "tool": "Write",
            "arguments": {"file_path": "../../../etc/passwd", "content": "evil"},
            "sessionId": session_id,
        }

        exit_code, stdout, stderr = self._run_hook(
            stdin_data, env_overrides={"TMPDIR": str(tmp_path)}
        )

        assert exit_code == 2, f"Expected exit 2 (block), got {exit_code}. stderr={stderr}"
        assert "traversal" in stderr.lower() or "sanitization" in stderr.lower()

    def test_invalid_json_exits_0(self):
        """Invalid JSON input should not crash the hook - exits 0 (fail-open)."""
        import os
        import subprocess

        env = os.environ.copy()
        python_path = env.get("PYTHONPATH", "")
        if self.PROJECT_ROOT not in python_path:
            env["PYTHONPATH"] = (
                f"{self.PROJECT_ROOT}:{python_path}" if python_path else self.PROJECT_ROOT
            )

        result = subprocess.run(
            [sys.executable, self.HOOK_PATH],
            input="this is not valid json {{{",
            capture_output=True,
            text=True,
            env=env,
            timeout=10,
        )

        assert result.returncode == 0, "Invalid JSON should fail-open (exit 0)"

    def test_stdout_json_contract(self, tmp_path):
        """Verify that when hook outputs JSON, it matches the expected contract."""
        session_id = "test-subprocess-contract"
        cache_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {
                "matched_guidelines": [{"guideline_id": "g-contract-test"}],
                "tools_denied": [],
                "tools_allowed": ["Read"],  # Write not in allowed list -> warning
            },
        }
        cache_path = tmp_path / f"guardrails-{session_id}.json"
        cache_path.write_text(json.dumps(cache_data))

        stdin_data = {
            "tool": "Write",
            "arguments": {"file_path": "src/foo.py", "content": "bar"},
            "sessionId": session_id,
        }

        exit_code, stdout, stderr = self._run_hook(
            stdin_data, env_overrides={"TMPDIR": str(tmp_path)}
        )

        assert exit_code == 0
        # Parse stdout and verify contract
        if stdout:
            output_data = json.loads(stdout)
            # The only expected key is "additionalContext"
            assert set(output_data.keys()) <= {"additionalContext"}
            assert isinstance(output_data["additionalContext"], str)
