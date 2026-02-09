"""Integration tests for the guardrails hook pipeline.

Tests that the three hooks (inject, enforce, subagent) work together
through the shared cache mechanism at /tmp/guardrails-{sessionId}.json.
"""

import importlib.util
import json
import tempfile
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest


# Load hook modules via importlib
def load_hook_module(name: str, filename: str):
    """Load a hook module from .claude/hooks/ directory."""
    hooks_dir = Path(__file__).resolve().parents[3] / ".claude" / "hooks"
    spec = importlib.util.spec_from_file_location(name, str(hooks_dir / filename))
    if spec is None or spec.loader is None:
        pytest.skip(f"Hook not found: {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def inject_mod():
    """Load the guardrails-inject hook module."""
    return load_hook_module("guardrails_inject", "guardrails-inject.py")


@pytest.fixture(scope="module")
def enforce_mod():
    """Load the guardrails-enforce hook module."""
    return load_hook_module("guardrails_enforce", "guardrails-enforce.py")


@pytest.fixture(scope="module")
def subagent_mod():
    """Load the guardrails-subagent hook module."""
    return load_hook_module("guardrails_subagent", "guardrails-subagent.py")


@pytest.fixture
def unique_session_id():
    """Generate a unique session ID for each test."""
    return f"test-session-{uuid.uuid4()}"


@pytest.fixture
def cleanup_cache_files(unique_session_id):
    """Clean up cache files after each test."""
    yield
    # Cleanup
    cache_path = Path(tempfile.gettempdir()) / f"guardrails-{unique_session_id}.json"
    if cache_path.exists():
        cache_path.unlink()


@pytest.fixture
def sample_evaluated():
    """Sample evaluated context data."""
    return {
        "matched_guidelines": [
            {"guideline_id": "GR001", "content": "Follow TDD protocol"}
        ],
        "combined_instruction": "Follow TDD protocol.\nNever modify protected paths.",
        "tools_denied": ["Write"],
        "tools_allowed": ["Read", "Bash"],
        "hitl_gates": ["protected_paths"],
    }


class TestInjectToEnforcePipeline:
    """Test the inject → enforce cache pipeline."""

    def test_inject_writes_enforce_reads(
        self, inject_mod, enforce_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that data written by inject can be read by enforce."""
        # Inject writes cache
        context = {"agent": "backend", "domain": "workers"}
        inject_mod.write_cache(unique_session_id, context, sample_evaluated)

        # Enforce reads cache
        cached = enforce_mod.read_cache(unique_session_id)

        assert cached is not None
        assert cached["matched_guidelines"] == sample_evaluated["matched_guidelines"]
        assert cached["combined_instruction"] == sample_evaluated["combined_instruction"]
        assert cached["tools_denied"] == sample_evaluated["tools_denied"]
        assert cached["tools_allowed"] == sample_evaluated["tools_allowed"]

    def test_tool_restrictions_from_inject_available_in_enforce(
        self, inject_mod, enforce_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that tool restrictions from inject are accessible in enforce."""
        # Inject writes cache with tool restrictions
        context = {"agent": "backend"}
        inject_mod.write_cache(unique_session_id, context, sample_evaluated)

        # Enforce reads and checks tool restrictions
        cached = enforce_mod.read_cache(unique_session_id)
        assert cached is not None

        # Check denied tool
        reason, is_mandatory = enforce_mod.check_tool_restriction("Write", cached)
        assert reason is not None
        assert is_mandatory is True
        assert "denied" in reason.lower()

        # Check allowed tool
        reason, is_mandatory = enforce_mod.check_tool_restriction("Read", cached)
        assert reason is None
        assert is_mandatory is False

    def test_cache_expiry_between_inject_and_enforce(
        self, inject_mod, enforce_mod, unique_session_id, cleanup_cache_files
    ):
        """Test that expired cache is not returned by enforce."""
        # Write cache with old timestamp
        cache_path = Path(tempfile.gettempdir()) / f"guardrails-{unique_session_id}.json"
        old_timestamp = (datetime.now(timezone.utc) - timedelta(seconds=400)).isoformat()
        cache_data = {
            "timestamp": old_timestamp,
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {"tools_denied": ["Write"]},
        }
        cache_path.write_text(json.dumps(cache_data))

        # Enforce should get None (expired)
        cached = enforce_mod.read_cache(unique_session_id)
        assert cached is None


class TestInjectToSubagentPipeline:
    """Test the inject → subagent cache pipeline."""

    def test_inject_writes_subagent_reads_parent_cache(
        self, inject_mod, subagent_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that subagent can read parent session cache from inject."""
        parent_session = unique_session_id

        # Inject writes cache for parent session
        context = {"agent": "backend"}
        inject_mod.write_cache(parent_session, context, sample_evaluated)

        # Subagent reads parent cache
        parent_evaluated = subagent_mod.read_parent_cache(parent_session)

        assert parent_evaluated is not None
        assert parent_evaluated["combined_instruction"] == sample_evaluated["combined_instruction"]
        assert parent_evaluated["tools_denied"] == sample_evaluated["tools_denied"]

    def test_subagent_writes_own_cache_for_enforce(
        self, subagent_mod, enforce_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that subagent writes its own cache that enforce can read."""
        child_session = f"child-{unique_session_id}"

        # Subagent writes its own cache
        subagent_mod.write_agent_cache(child_session, "backend", sample_evaluated)

        # Enforce reads from child session
        cached = enforce_mod.read_cache(child_session)

        assert cached is not None
        assert cached["tools_denied"] == sample_evaluated["tools_denied"]
        assert cached["tools_allowed"] == sample_evaluated["tools_allowed"]

        # Cleanup child cache
        child_cache_path = Path(tempfile.gettempdir()) / f"guardrails-{child_session}.json"
        if child_cache_path.exists():
            child_cache_path.unlink()

    def test_parent_cache_expiry_for_subagent(
        self, subagent_mod, unique_session_id, cleanup_cache_files
    ):
        """Test that subagent gets None for expired parent cache."""
        parent_session = unique_session_id

        # Write expired parent cache
        cache_path = Path(tempfile.gettempdir()) / f"guardrails-{parent_session}.json"
        old_timestamp = (datetime.now(timezone.utc) - timedelta(seconds=400)).isoformat()
        cache_data = {
            "timestamp": old_timestamp,
            "ttl_seconds": 300,
            "context": {"agent": "backend"},
            "evaluated": {"tools_denied": ["Write"]},
        }
        cache_path.write_text(json.dumps(cache_data))

        # Subagent should get None
        parent_evaluated = subagent_mod.read_parent_cache(parent_session)
        assert parent_evaluated is None


class TestFullPipelineIntegration:
    """Test the complete inject → enforce → subagent → enforce flow."""

    def test_full_pipeline_parent_and_child(
        self, inject_mod, enforce_mod, subagent_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test complete pipeline: inject → enforce (parent) → subagent → enforce (child)."""
        parent_session = unique_session_id
        child_session = f"child-{unique_session_id}"

        # Step 1: Inject writes cache for parent session
        context = {"agent": "backend", "domain": "workers"}
        inject_mod.write_cache(parent_session, context, sample_evaluated)

        # Step 2: Enforce reads cache for parent session
        parent_cached = enforce_mod.read_cache(parent_session)
        assert parent_cached is not None
        assert parent_cached["tools_denied"] == ["Write"]

        # Step 3: Subagent reads parent cache and writes child cache
        parent_eval = subagent_mod.read_parent_cache(parent_session)
        assert parent_eval is not None

        # Subagent writes agent-specific cache
        agent_evaluated = {
            **sample_evaluated,
            "tools_denied": ["Write", "Edit"],  # Child has additional restrictions
        }
        subagent_mod.write_agent_cache(child_session, "backend", agent_evaluated)

        # Step 4: Enforce reads cache for child session
        child_cached = enforce_mod.read_cache(child_session)
        assert child_cached is not None
        assert child_cached["tools_denied"] == ["Write", "Edit"]

        # Cleanup child cache
        child_cache_path = Path(tempfile.gettempdir()) / f"guardrails-{child_session}.json"
        if child_cache_path.exists():
            child_cache_path.unlink()


class TestEnforceToolRestrictions:
    """Test enforce hook with different tool restriction scenarios."""

    def test_enforce_blocks_denied_tool(
        self, inject_mod, enforce_mod, unique_session_id, cleanup_cache_files
    ):
        """Test that enforce blocks a tool explicitly denied."""
        evaluated = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Test",
            "tools_denied": ["Write"],
            "tools_allowed": ["Read", "Bash"],
            "hitl_gates": [],
        }

        # Inject writes cache
        inject_mod.write_cache(unique_session_id, {"agent": "backend"}, evaluated)

        # Enforce checks the denied tool
        cached = enforce_mod.read_cache(unique_session_id)
        reason, is_mandatory = enforce_mod.check_tool_restriction("Write", cached)

        assert reason is not None
        assert is_mandatory is True
        assert "denied" in reason.lower()

    def test_enforce_warns_unlisted_tool(
        self, inject_mod, enforce_mod, unique_session_id, cleanup_cache_files
    ):
        """Test that enforce warns for tool not in allowed list."""
        evaluated = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Test",
            "tools_denied": [],
            "tools_allowed": ["Read", "Bash"],
            "hitl_gates": [],
        }

        # Inject writes cache
        inject_mod.write_cache(unique_session_id, {"agent": "backend"}, evaluated)

        # Enforce checks an unlisted tool (advisory warning)
        cached = enforce_mod.read_cache(unique_session_id)
        reason, is_mandatory = enforce_mod.check_tool_restriction("Write", cached)

        assert reason is not None
        assert is_mandatory is False  # Advisory, not mandatory
        assert "not in the allowed tools list" in reason.lower()

    def test_enforce_allows_tool_in_allowed_list(
        self, inject_mod, enforce_mod, unique_session_id, cleanup_cache_files
    ):
        """Test that enforce allows tool in the allowed list."""
        evaluated = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Test",
            "tools_denied": [],
            "tools_allowed": ["Read", "Bash"],
            "hitl_gates": [],
        }

        # Inject writes cache
        inject_mod.write_cache(unique_session_id, {"agent": "backend"}, evaluated)

        # Enforce checks an allowed tool
        cached = enforce_mod.read_cache(unique_session_id)
        reason, is_mandatory = enforce_mod.check_tool_restriction("Read", cached)

        assert reason is None
        assert is_mandatory is False


class TestPathSanitization:
    """Test path sanitization in enforce hook."""

    def test_path_traversal_blocked(self, enforce_mod):
        """Test that path traversal attempts are blocked."""
        unsafe_paths = [
            "../etc/passwd",
            "../../root/.ssh/id_rsa",
            "src/../../../etc/hosts",
            "./../../sensitive/data",
        ]

        for path in unsafe_paths:
            result = enforce_mod.sanitize_path(path)
            assert result is None, f"Path should be rejected: {path}"

    def test_safe_paths_allowed(self, enforce_mod):
        """Test that safe paths are allowed."""
        safe_paths = [
            "src/core/models.py",
            "tests/unit/test_example.py",
            "docs/README.md",
            "./src/infrastructure/config.py",
        ]

        for path in safe_paths:
            result = enforce_mod.sanitize_path(path)
            assert result is not None, f"Path should be allowed: {path}"

    def test_empty_path_rejected(self, enforce_mod):
        """Test that empty paths are rejected."""
        result = enforce_mod.sanitize_path("")
        assert result is None


class TestFormatConsistency:
    """Test that formatting is consistent across hooks."""

    def test_inject_and_subagent_format_similarity(
        self, inject_mod, subagent_mod, sample_evaluated
    ):
        """Test that inject and subagent produce similar formatted output."""
        # Format from inject
        inject_output = inject_mod.format_additional_context(sample_evaluated)

        # Format from subagent
        subagent_output = subagent_mod.format_agent_context("backend", sample_evaluated)

        # Both should contain key elements
        assert "Follow TDD protocol" in inject_output
        assert "Follow TDD protocol" in subagent_output

        assert "Tools denied" in inject_output or "tools_denied" in inject_output
        assert "Tools denied" in subagent_output or "tools_denied" in subagent_output

        # Subagent should include agent name
        assert "backend" in subagent_output.lower()


class TestGracefulDegradation:
    """Test graceful degradation when cache is missing."""

    def test_enforce_handles_missing_cache(
        self, enforce_mod, unique_session_id
    ):
        """Test that enforce handles missing cache gracefully."""
        # Don't write any cache
        cached = enforce_mod.read_cache(unique_session_id)

        # Should get None, not raise exception
        assert cached is None

    def test_enforce_allows_through_without_cache(
        self, enforce_mod, unique_session_id
    ):
        """Test that enforce allows tools through when no cache exists."""
        # No cache written
        cached = enforce_mod.read_cache(unique_session_id)
        assert cached is None

        # In the real hook, this would exit 0 (allow)
        # Here we just verify reading cache doesn't raise

    def test_subagent_handles_missing_parent_cache(
        self, subagent_mod, unique_session_id
    ):
        """Test that subagent handles missing parent cache gracefully."""
        # Don't write parent cache
        parent_eval = subagent_mod.read_parent_cache(unique_session_id)

        # Should get None, not raise exception
        assert parent_eval is None


class TestCacheMetadata:
    """Test cache metadata handling."""

    def test_cache_includes_timestamp(
        self, inject_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that cache includes a valid timestamp."""
        inject_mod.write_cache(unique_session_id, {"agent": "backend"}, sample_evaluated)

        cache_path = Path(tempfile.gettempdir()) / f"guardrails-{unique_session_id}.json"
        data = json.loads(cache_path.read_text())

        assert "timestamp" in data
        # Verify it's valid ISO format
        datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))

    def test_cache_includes_ttl(
        self, inject_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that cache includes TTL."""
        inject_mod.write_cache(unique_session_id, {"agent": "backend"}, sample_evaluated)

        cache_path = Path(tempfile.gettempdir()) / f"guardrails-{unique_session_id}.json"
        data = json.loads(cache_path.read_text())

        assert "ttl_seconds" in data
        assert data["ttl_seconds"] == 300

    def test_cache_includes_context(
        self, inject_mod, unique_session_id, sample_evaluated, cleanup_cache_files
    ):
        """Test that cache includes original context."""
        context = {"agent": "backend", "domain": "workers"}
        inject_mod.write_cache(unique_session_id, context, sample_evaluated)

        cache_path = Path(tempfile.gettempdir()) / f"guardrails-{unique_session_id}.json"
        data = json.loads(cache_path.read_text())

        assert "context" in data
        assert data["context"] == context
