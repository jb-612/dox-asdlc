"""Tests for guardrails-inject UserPromptSubmit hook."""

import importlib.util
import json
import tempfile
from datetime import datetime
from pathlib import Path

import pytest


def import_hook_module():
    """Import the guardrails-inject hook script as a module."""
    hook_path = Path(__file__).resolve().parents[3] / ".claude" / "hooks" / "guardrails-inject.py"
    if not hook_path.exists():
        pytest.skip(f"Hook script not found at {hook_path}")
    spec = importlib.util.spec_from_file_location("guardrails_inject", str(hook_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestGuardrailsInjectHook:
    """Test the guardrails-inject hook helper functions."""
    
    @pytest.fixture
    def hook(self):
        """Import the hook module."""
        return import_hook_module()
    
    def test_format_additional_context_full(self, hook):
        """Test formatting with full evaluated result."""
        evaluated = {
            "matched_guidelines": [
                {"guideline_id": "GR001", "content": "Test guideline"}
            ],
            "combined_instruction": "Follow TDD protocol.\nNever modify protected paths.",
            "tools_denied": ["Edit", "Write"],
            "tools_allowed": ["Read", "Bash"],
            "hitl_gates": ["protected_paths", "contract_change"],
        }
        
        result = hook.format_additional_context(evaluated)
        
        assert "## Active Guardrails" in result
        assert "Follow TDD protocol." in result
        assert "Never modify protected paths." in result
        assert "**Tools denied:** Edit, Write" in result
        assert "**Tools allowed:** Read, Bash" in result
        assert "**HITL gates required:** protected_paths, contract_change" in result
    
    def test_format_additional_context_minimal(self, hook):
        """Test formatting with minimal evaluated result."""
        evaluated = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Basic instruction.",
            "tools_denied": [],
            "tools_allowed": [],
            "hitl_gates": [],
        }
        
        result = hook.format_additional_context(evaluated)
        
        assert "## Active Guardrails" in result
        assert "Basic instruction." in result
        # Should not have empty lists
        assert "Tools denied:" not in result
        assert "Tools allowed:" not in result
        assert "HITL gates required:" not in result
    
    def test_format_additional_context_empty(self, hook):
        """Test formatting with empty evaluated result."""
        evaluated = {
            "matched_guidelines": [],
            "combined_instruction": "",
            "tools_denied": [],
            "tools_allowed": [],
            "hitl_gates": [],
        }
        
        result = hook.format_additional_context(evaluated)
        
        # Should just have the header
        assert "## Active Guardrails" in result
        assert len(result.strip().split("\n")) <= 2  # Header + maybe blank line
    
    def test_write_cache_creates_valid_json(self, hook, tmp_path):
        """Test that write_cache creates a valid JSON file."""
        session_id = "test-session-123"
        context = {"agent": "backend", "domain": "workers"}
        guidelines = {
            "matched_guidelines": [{"guideline_id": "GR001"}],
            "combined_instruction": "Test instruction",
        }
        
        # Patch tempfile.gettempdir to use tmp_path
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)
        
        try:
            hook.write_cache(session_id, context, guidelines)
            
            cache_path = tmp_path / f"guardrails-{session_id}.json"
            assert cache_path.exists()
            
            data = json.loads(cache_path.read_text())
            assert "timestamp" in data
            assert data["ttl_seconds"] == 300
            assert data["context"] == context
            assert data["evaluated"] == guidelines
            
            # Verify timestamp is valid ISO format
            datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        finally:
            tf_module.gettempdir = original_gettempdir
    
    def test_write_cache_handles_none_guidelines(self, hook, tmp_path):
        """Test write_cache with None guidelines."""
        session_id = "test-session-456"
        context = {"agent": "backend"}
        guidelines = None
        
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: str(tmp_path)
        
        try:
            # Should not raise
            hook.write_cache(session_id, context, guidelines)
            
            cache_path = tmp_path / f"guardrails-{session_id}.json"
            assert cache_path.exists()
            
            data = json.loads(cache_path.read_text())
            assert data["evaluated"] is None
        finally:
            tf_module.gettempdir = original_gettempdir
    
    def test_write_cache_handles_write_errors_gracefully(self, hook):
        """Test that write_cache handles write errors without raising."""
        session_id = "test-session-789"
        context = {"agent": "backend"}
        guidelines = {}
        
        # Point to a non-writable location
        import tempfile as tf_module
        original_gettempdir = tf_module.gettempdir
        tf_module.gettempdir = lambda: "/nonexistent/path"
        
        try:
            # Should not raise, just fail silently
            hook.write_cache(session_id, context, guidelines)
        finally:
            tf_module.gettempdir = original_gettempdir
    
    def test_get_project_root_finds_claude_md(self, hook):
        """Test that get_project_root finds the project root."""
        root = hook.get_project_root()
        
        # Should find CLAUDE.md at root
        assert (root / "CLAUDE.md").exists()
        assert root.name in ["p11-guardrails", "dox-asdlc"]  # Worktree or main repo
    
    def test_ensure_project_on_path_adds_root(self, hook):
        """Test that ensure_project_on_path adds root to sys.path."""
        import sys
        
        # Remove project root if present
        root = hook.get_project_root()
        root_str = str(root)
        if root_str in sys.path:
            sys.path.remove(root_str)
        
        # Ensure it gets added
        hook.ensure_project_on_path()
        
        assert root_str in sys.path
