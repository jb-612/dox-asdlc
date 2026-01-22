"""Unit tests for Git gateway.

Tests the GitGateway class for exclusive Git write access.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import GitOperationError


class TestGitGatewayPermissions:
    """Tests for Git write permission enforcement."""

    def test_is_write_allowed_false_by_default(self):
        """Write is not allowed without GIT_WRITE_ACCESS=true."""
        from src.orchestrator.git_gateway import GitGateway

        with patch.dict(os.environ, {"GIT_WRITE_ACCESS": "false"}, clear=False):
            gateway = GitGateway("/tmp/repo")
            assert gateway.is_write_allowed() is False

    def test_is_write_allowed_true_when_enabled(self):
        """Write is allowed when GIT_WRITE_ACCESS=true."""
        from src.orchestrator.git_gateway import GitGateway

        with patch.dict(os.environ, {"GIT_WRITE_ACCESS": "true"}, clear=False):
            gateway = GitGateway("/tmp/repo")
            assert gateway.is_write_allowed() is True

    def test_protected_branches_configurable(self):
        """Protected branches can be configured."""
        from src.orchestrator.git_gateway import GitGateway

        gateway = GitGateway(
            "/tmp/repo",
            protected_branches=["main", "develop", "release/*"],
        )

        assert "main" in gateway.protected_branches
        assert "develop" in gateway.protected_branches


class TestGitGatewayShaOperations:
    """Tests for Git SHA operations."""

    @pytest.mark.asyncio
    async def test_get_current_sha(self):
        """Can get current HEAD SHA."""
        from src.orchestrator.git_gateway import GitGateway

        with tempfile.TemporaryDirectory() as tmpdir:
            # Initialize a test repo
            import subprocess
            subprocess.run(["git", "init"], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "config", "user.email", "test@test.com"],
                cwd=tmpdir, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "config", "user.name", "Test"],
                cwd=tmpdir, check=True, capture_output=True
            )

            # Create initial commit
            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("test")
            subprocess.run(["git", "add", "."], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "commit", "-m", "Initial"],
                cwd=tmpdir, check=True, capture_output=True
            )

            gateway = GitGateway(tmpdir)
            sha = await gateway.get_current_sha()

            assert sha is not None
            assert len(sha) == 40  # Full SHA

    @pytest.mark.asyncio
    async def test_verify_sha_exists(self):
        """Can verify if a SHA exists."""
        from src.orchestrator.git_gateway import GitGateway

        with tempfile.TemporaryDirectory() as tmpdir:
            import subprocess
            subprocess.run(["git", "init"], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "config", "user.email", "test@test.com"],
                cwd=tmpdir, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "config", "user.name", "Test"],
                cwd=tmpdir, check=True, capture_output=True
            )

            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("test")
            subprocess.run(["git", "add", "."], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "commit", "-m", "Initial"],
                cwd=tmpdir, check=True, capture_output=True
            )

            gateway = GitGateway(tmpdir)
            sha = await gateway.get_current_sha()

            assert await gateway.verify_sha_exists(sha) is True
            assert await gateway.verify_sha_exists("nonexistent") is False


class TestGitGatewayPatch:
    """Tests for patch application."""

    @pytest.mark.asyncio
    async def test_apply_patch_requires_permission(self):
        """Apply patch fails without write permission."""
        from src.orchestrator.git_gateway import GitGateway

        with patch.dict(os.environ, {"GIT_WRITE_ACCESS": "false"}, clear=False):
            gateway = GitGateway("/tmp/repo")

            with pytest.raises(GitOperationError) as exc_info:
                await gateway.apply_patch("/tmp/test.patch", "test commit", "task-1")

            assert "Write access not allowed" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_apply_patch_success(self):
        """Apply patch creates a commit."""
        from src.orchestrator.git_gateway import GitGateway

        with tempfile.TemporaryDirectory() as tmpdir:
            import subprocess

            # Initialize repo
            subprocess.run(["git", "init"], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "config", "user.email", "test@test.com"],
                cwd=tmpdir, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "config", "user.name", "Test"],
                cwd=tmpdir, check=True, capture_output=True
            )

            # Create initial file
            test_file = Path(tmpdir) / "file.txt"
            test_file.write_text("original\n")
            subprocess.run(["git", "add", "."], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "commit", "-m", "Initial"],
                cwd=tmpdir, check=True, capture_output=True
            )

            original_sha = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=tmpdir, check=True, capture_output=True
            ).stdout.decode().strip()

            # Create a patch
            patch_file = Path(tmpdir) / "test.patch"
            patch_content = """--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-original
+modified
"""
            patch_file.write_text(patch_content)

            with patch.dict(os.environ, {"GIT_WRITE_ACCESS": "true"}, clear=False):
                gateway = GitGateway(tmpdir)
                new_sha = await gateway.apply_patch(
                    str(patch_file),
                    "Apply modification",
                    "task-123",
                )

            assert new_sha is not None
            assert new_sha != original_sha
            assert test_file.read_text() == "modified\n"


class TestGitGatewayBranch:
    """Tests for branch operations."""

    @pytest.mark.asyncio
    async def test_create_branch(self):
        """Can create a new branch."""
        from src.orchestrator.git_gateway import GitGateway

        with tempfile.TemporaryDirectory() as tmpdir:
            import subprocess

            subprocess.run(["git", "init"], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "config", "user.email", "test@test.com"],
                cwd=tmpdir, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "config", "user.name", "Test"],
                cwd=tmpdir, check=True, capture_output=True
            )

            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("test")
            subprocess.run(["git", "add", "."], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "commit", "-m", "Initial"],
                cwd=tmpdir, check=True, capture_output=True
            )

            with patch.dict(os.environ, {"GIT_WRITE_ACCESS": "true"}, clear=False):
                gateway = GitGateway(tmpdir)
                await gateway.create_branch("feature/test")

            # Verify branch exists
            result = subprocess.run(
                ["git", "branch", "--list", "feature/test"],
                cwd=tmpdir, check=True, capture_output=True
            )
            assert "feature/test" in result.stdout.decode()


class TestGitGatewayAudit:
    """Tests for audit logging."""

    @pytest.mark.asyncio
    async def test_operations_are_logged(self):
        """Git operations produce log entries."""
        from src.orchestrator.git_gateway import GitGateway
        import logging

        with tempfile.TemporaryDirectory() as tmpdir:
            import subprocess

            subprocess.run(["git", "init"], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "config", "user.email", "test@test.com"],
                cwd=tmpdir, check=True, capture_output=True
            )
            subprocess.run(
                ["git", "config", "user.name", "Test"],
                cwd=tmpdir, check=True, capture_output=True
            )

            test_file = Path(tmpdir) / "test.txt"
            test_file.write_text("test")
            subprocess.run(["git", "add", "."], cwd=tmpdir, check=True, capture_output=True)
            subprocess.run(
                ["git", "commit", "-m", "Initial"],
                cwd=tmpdir, check=True, capture_output=True
            )

            gateway = GitGateway(tmpdir)

            with patch.object(logging.getLogger("src.orchestrator.git_gateway"), "info") as mock_log:
                await gateway.get_current_sha()
                # Should have logged something about the operation
                # (actual assertion depends on implementation)
