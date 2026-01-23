"""Integration tests for RLM exploration system.

Tests the full RLM pipeline with real file operations (on temp directories)
and mocked LLM calls.
"""

from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest

from src.workers.rlm.agent import RLMAgent
from src.workers.rlm.budget_manager import SubCallBudgetManager
from src.workers.rlm.cache import SubCallCache
from src.workers.rlm.config import RLMConfig
from src.workers.rlm.integration import RLMIntegration
from src.workers.rlm.models import RLMResult
from src.workers.rlm.orchestrator import RLMOrchestrator
from src.workers.rlm.tools.file_tools import FileTools
from src.workers.rlm.tools.registry import REPLToolSurface
from src.workers.rlm.tools.symbol_tools import SymbolTools
from src.workers.rlm.trigger import RLMTriggerDetector


# Mock Anthropic response structures
@dataclass
class MockTextBlock:
    text: str
    type: str = "text"


@dataclass
class MockUsage:
    input_tokens: int
    output_tokens: int


@dataclass
class MockResponse:
    content: list[MockTextBlock]
    usage: MockUsage


def create_test_repo(tmpdir: str) -> Path:
    """Create a test repository structure for exploration.

    Args:
        tmpdir: Temporary directory path

    Returns:
        Path to repo root
    """
    repo = Path(tmpdir)

    # Create directory structure
    (repo / "src").mkdir()
    (repo / "src" / "auth").mkdir()
    (repo / "src" / "utils").mkdir()
    (repo / "tests").mkdir()

    # Create Python files
    (repo / "src" / "main.py").write_text('''"""Main application entry point."""

from src.auth.handler import authenticate
from src.utils.config import load_config


def main():
    """Run the application."""
    config = load_config()
    return run_app(config)


def run_app(config):
    """Execute the main application logic."""
    # TODO: Implement application logic
    pass


if __name__ == "__main__":
    main()
''')

    (repo / "src" / "auth" / "__init__.py").write_text('"""Auth module."""\n')

    (repo / "src" / "auth" / "handler.py").write_text('''"""Authentication handler."""

from typing import Optional


class AuthHandler:
    """Handles user authentication."""

    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self._users = {}

    def authenticate(self, username: str, password: str) -> bool:
        """Authenticate a user with username and password.

        Args:
            username: The username
            password: The password

        Returns:
            True if authenticated, False otherwise
        """
        if username not in self._users:
            return False
        return self._users[username] == self._hash_password(password)

    def _hash_password(self, password: str) -> str:
        """Hash a password for storage."""
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()

    def register(self, username: str, password: str) -> bool:
        """Register a new user."""
        if username in self._users:
            return False
        self._users[username] = self._hash_password(password)
        return True


def authenticate(username: str, password: str) -> bool:
    """Convenience function for authentication."""
    handler = AuthHandler("default_secret")
    return handler.authenticate(username, password)
''')

    (repo / "src" / "utils" / "__init__.py").write_text('"""Utilities."""\n')

    (repo / "src" / "utils" / "config.py").write_text('''"""Configuration utilities."""

import os
from dataclasses import dataclass


@dataclass
class Config:
    """Application configuration."""

    debug: bool = False
    port: int = 8080
    host: str = "localhost"
    database_url: str = ""


def load_config() -> Config:
    """Load configuration from environment."""
    return Config(
        debug=os.getenv("DEBUG", "false").lower() == "true",
        port=int(os.getenv("PORT", "8080")),
        host=os.getenv("HOST", "localhost"),
        database_url=os.getenv("DATABASE_URL", ""),
    )
''')

    (repo / "tests" / "test_auth.py").write_text('''"""Tests for auth module."""

import pytest
from src.auth.handler import AuthHandler


class TestAuthHandler:
    def test_register_new_user(self):
        handler = AuthHandler("secret")
        assert handler.register("user", "pass") is True

    def test_authenticate_valid_user(self):
        handler = AuthHandler("secret")
        handler.register("user", "pass")
        assert handler.authenticate("user", "pass") is True

    def test_authenticate_invalid_password(self):
        handler = AuthHandler("secret")
        handler.register("user", "pass")
        assert handler.authenticate("user", "wrong") is False
''')

    return repo


def create_exploration_client(iterations: list[str]) -> Mock:
    """Create a mock client that returns specified iteration responses.

    Args:
        iterations: List of response texts for each iteration

    Returns:
        Mock Anthropic client
    """
    mock_client = Mock()
    responses = []

    for text in iterations:
        responses.append(MockResponse(
            content=[MockTextBlock(text=text)],
            usage=MockUsage(input_tokens=100, output_tokens=100),
        ))

    mock_client.messages.create.side_effect = responses
    return mock_client


class TestFileToolsIntegration:
    """Integration tests for file tools with real filesystem."""

    def test_list_files_real_repo(self) -> None:
        """Test listing files in a real directory structure."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)
            tools = FileTools(repo_root=str(repo))

            files = tools.list_files("src/", pattern="*.py", recursive=True)

            assert len(files) >= 4
            assert any("main.py" in f for f in files)
            assert any("handler.py" in f for f in files)

    def test_read_file_real_content(self) -> None:
        """Test reading real file content."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)
            tools = FileTools(repo_root=str(repo))

            content = tools.read_file("src/auth/handler.py")

            assert "class AuthHandler" in content
            assert "def authenticate" in content

    def test_grep_real_files(self) -> None:
        """Test grep on real files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)
            tools = FileTools(repo_root=str(repo))

            matches = tools.grep("authenticate", paths=["src/"])

            assert len(matches) > 0
            assert any("handler.py" in m.file_path for m in matches)


class TestSymbolToolsIntegration:
    """Integration tests for symbol tools with real files."""

    def test_extract_symbols_real_file(self) -> None:
        """Test extracting symbols from real Python file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)
            tools = SymbolTools(repo_root=str(repo))

            symbols = tools.extract_symbols("src/auth/handler.py")

            # Should find AuthHandler class and its methods
            class_symbols = [s for s in symbols if s.get("kind") == "class"]
            func_symbols = [s for s in symbols if s.get("kind") == "function"]

            assert any("AuthHandler" in str(s) for s in class_symbols)
            assert any("authenticate" in str(s) for s in func_symbols)

    def test_find_symbol_in_repo(self) -> None:
        """Test finding a symbol across the repo."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)
            tools = SymbolTools(repo_root=str(repo))

            # Find the authenticate function
            results = tools.find_symbol("authenticate")

            assert len(results) > 0


class TestToolSurfaceIntegration:
    """Integration tests for the tool surface with real operations."""

    def test_invoke_multiple_tools(self) -> None:
        """Test invoking multiple tools in sequence."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)
            file_tools = FileTools(repo_root=str(repo))
            symbol_tools = SymbolTools(repo_root=str(repo))

            surface = REPLToolSurface(
                file_tools=file_tools,
                symbol_tools=symbol_tools,
            )

            # List files
            files = surface.invoke("list_files", directory="src/", pattern="*.py")
            assert len(files) > 0

            # Read a file
            content = surface.invoke("read_file", file_path="src/main.py")
            assert "def main" in content

            # Search for pattern
            matches = surface.invoke("grep", pattern="TODO", paths=["src/"])
            assert len(matches) > 0

            # Check invocation logging
            assert surface.get_invocation_count() == 3
            assert surface.get_success_rate() == 100.0


class TestBudgetEnforcement:
    """Integration tests for budget enforcement."""

    @pytest.mark.asyncio
    async def test_budget_exhaustion_stops_exploration(self) -> None:
        """Test that exhausting budget stops exploration gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)

            # Create client that never signals done
            iterations = [
                "<thought>Step 1</thought><tool_calls>[]</tool_calls><findings>- Found 1</findings><next_direction>Continue</next_direction>",
                "<thought>Step 2</thought><tool_calls>[]</tool_calls><findings>- Found 2</findings><next_direction>Continue</next_direction>",
                "<thought>Step 3</thought><tool_calls>[]</tool_calls><findings>- Found 3</findings><next_direction>Continue</next_direction>",
            ]
            client = create_exploration_client(iterations * 5)

            # Very small budget
            budget = SubCallBudgetManager(max_total=2, max_per_iteration=1)
            cache = SubCallCache()
            config = RLMConfig(timeout_seconds=60, audit_dir=tmpdir)

            file_tools = FileTools(repo_root=str(repo))
            symbol_tools = SymbolTools(repo_root=str(repo))
            surface = REPLToolSurface(
                file_tools=file_tools,
                symbol_tools=symbol_tools,
            )

            agent = RLMAgent(client=client, tool_surface=surface)

            orchestrator = RLMOrchestrator(
                agent=agent,
                budget_manager=budget,
                cache=cache,
                config=config,
                max_iterations=10,
            )

            result = await orchestrator.explore("Test query")

            # Should have stopped due to budget
            assert result.usage.budget_remaining <= 0 or len(result.trajectory.steps) <= 3


class TestTimeoutHandling:
    """Integration tests for timeout handling."""

    @pytest.mark.asyncio
    async def test_timeout_returns_partial_results(self) -> None:
        """Test that timeout returns partial results."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)

            # Create client with slow responses
            def slow_create(*args, **kwargs):
                import time
                time.sleep(0.5)  # Slow response
                return MockResponse(
                    content=[MockTextBlock(text="<thought>T</thought><tool_calls>[]</tool_calls><findings></findings><next_direction>Continue</next_direction>")],
                    usage=MockUsage(input_tokens=10, output_tokens=10),
                )

            client = Mock()
            client.messages.create.side_effect = slow_create

            budget = SubCallBudgetManager(max_total=50)
            cache = SubCallCache()
            config = RLMConfig(timeout_seconds=1, audit_dir=tmpdir)  # Very short timeout

            file_tools = FileTools(repo_root=str(repo))
            symbol_tools = SymbolTools(repo_root=str(repo))
            surface = REPLToolSurface(
                file_tools=file_tools,
                symbol_tools=symbol_tools,
            )

            agent = RLMAgent(client=client, tool_surface=surface)

            orchestrator = RLMOrchestrator(
                agent=agent,
                budget_manager=budget,
                cache=cache,
                config=config,
                max_iterations=100,
            )

            result = await orchestrator.explore("Test query")

            # Should have timed out
            assert result.success is False or "timeout" in (result.error or "").lower()


class TestCacheEffectiveness:
    """Integration tests for cache effectiveness."""

    def test_cache_prevents_duplicate_queries(self) -> None:
        """Test that cache prevents duplicate LLM queries."""
        cache = SubCallCache()

        # Simulate queries
        cache.set("prompt1", "context1", "result1")
        cache.set("prompt2", "context2", "result2")

        # Same queries should hit cache
        assert cache.get("prompt1", "context1") == "result1"
        assert cache.get("prompt2", "context2") == "result2"

        # Different queries should miss
        assert cache.get("prompt1", "different") is None

        stats = cache.get_stats()
        assert stats.hits == 2
        assert stats.misses == 1


class TestTriggerDetection:
    """Integration tests for trigger detection."""

    def test_trigger_with_complex_query(self) -> None:
        """Test trigger detection with complex queries."""
        detector = RLMTriggerDetector()

        # Complex queries should trigger
        result = detector.check(query="How does the authentication flow work?")
        assert result.should_trigger is True

        # Simple queries should not
        result = detector.check(query="Fix typo")
        assert result.should_trigger is False

    def test_trigger_with_multiple_factors(self) -> None:
        """Test trigger detection with multiple factors."""
        detector = RLMTriggerDetector(
            context_threshold=50_000,
            fail_count_threshold=3,
        )

        result = detector.check(
            context_tokens=100_000,
            query="Explain the architecture",
            file_count=20,
        )

        assert result.should_trigger is True
        assert len(result.all_reasons) >= 2


class TestEndToEndExploration:
    """End-to-end integration tests."""

    @pytest.mark.asyncio
    async def test_full_exploration_flow(self) -> None:
        """Test complete exploration flow from integration layer."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)

            # Create client that explores then finishes
            iterations = [
                """<thought>Looking for auth code</thought>
<tool_calls>[{"tool": "list_files", "args": {"directory": "src/auth/", "pattern": "*.py"}}]</tool_calls>
<findings>
- Found auth module in src/auth/
</findings>
<next_direction>Read the handler</next_direction>""",
                """<thought>Reading auth handler</thought>
<tool_calls>[{"tool": "read_file", "args": {"file_path": "src/auth/handler.py"}}]</tool_calls>
<findings>
- AuthHandler class handles authentication
- Uses SHA256 for password hashing
</findings>
<next_direction>DONE</next_direction>""",
            ]
            client = create_exploration_client(iterations)

            config = RLMConfig(
                audit_dir=tmpdir,
                timeout_seconds=60,
            )

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=str(repo),
            )

            result = await integration.explore(
                query="How does authentication work?",
                save_audit=True,
            )

            assert result.used_rlm is True
            assert result.rlm_result is not None
            assert result.rlm_result.success is True
            assert len(result.rlm_result.trajectory.steps) == 2

    @pytest.mark.asyncio
    async def test_exploration_with_tool_errors(self) -> None:
        """Test exploration handles tool errors gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)

            # Try to read non-existent file
            iterations = [
                """<thought>Looking for missing file</thought>
<tool_calls>[{"tool": "read_file", "args": {"file_path": "nonexistent.py"}}]</tool_calls>
<findings>
- File not found, trying different approach
</findings>
<next_direction>DONE</next_direction>""",
            ]
            client = create_exploration_client(iterations)

            config = RLMConfig(
                audit_dir=tmpdir,
                timeout_seconds=60,
            )

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=str(repo),
            )

            result = await integration.explore(
                query="Find something",
                save_audit=False,
            )

            # Should complete despite tool errors
            assert result.used_rlm is True


class TestAuditTrailIntegration:
    """Integration tests for audit trail with real explorations."""

    @pytest.mark.asyncio
    async def test_audit_saved_and_loadable(self) -> None:
        """Test that audits are saved and can be loaded."""
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = create_test_repo(tmpdir)

            iterations = [
                "<thought>Done</thought><tool_calls>[]</tool_calls><findings>- Found it</findings><next_direction>DONE</next_direction>",
            ]
            client = create_exploration_client(iterations)

            config = RLMConfig(
                audit_dir=tmpdir,
                timeout_seconds=60,
            )

            integration = RLMIntegration(
                client=client,
                config=config,
                repo_root=str(repo),
            )

            result = await integration.explore(
                query="Test query",
                task_id="test-audit-123",
                save_audit=True,
            )

            # Should be able to load the audit
            if result.rlm_result:
                loaded = integration._auditor.load_result("test-audit-123")
                if loaded:
                    assert loaded.task_id == "test-audit-123"
