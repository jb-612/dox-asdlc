"""Unit tests for context loader.

Tests the ContextLoader that loads context packs from the filesystem.
"""

from __future__ import annotations

import json
import pytest
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from src.workers.artifacts.context_loader import (
    ContextLoader,
    ContextPackNotFoundError,
    ContextPackFormatError,
)


class TestContextLoader:
    """Tests for ContextLoader class."""

    @pytest.fixture
    def workspace_path(self, tmp_path):
        """Create a temporary workspace."""
        return tmp_path

    @pytest.fixture
    def loader(self, workspace_path):
        """Create a ContextLoader."""
        return ContextLoader(workspace_path=str(workspace_path))

    def _create_context_pack(
        self,
        workspace: Path,
        task_id: str,
        content: dict[str, Any],
    ) -> Path:
        """Create a context pack file."""
        context_dir = workspace / "context_packs"
        context_dir.mkdir(parents=True, exist_ok=True)
        pack_file = context_dir / f"{task_id}.json"
        pack_file.write_text(json.dumps(content))
        return pack_file

    def test_loader_initialization(self, loader, workspace_path):
        """ContextLoader initializes with workspace path."""
        assert loader.workspace_path == str(workspace_path)

    async def test_load_context_pack_success(self, loader, workspace_path):
        """ContextLoader loads valid context pack."""
        content = {
            "task_id": "task-123",
            "files": [
                {"path": "src/main.py", "content": "print('hello')"},
                {"path": "src/utils.py", "content": "def helper(): pass"},
            ],
            "metadata": {"repo": "test-repo"},
        }
        self._create_context_pack(workspace_path, "task-123", content)

        result = await loader.load(task_id="task-123")

        assert result["task_id"] == "task-123"
        assert len(result["files"]) == 2
        assert result["metadata"]["repo"] == "test-repo"

    async def test_load_context_pack_not_found(self, loader):
        """ContextLoader raises error when pack not found."""
        with pytest.raises(ContextPackNotFoundError) as exc_info:
            await loader.load(task_id="nonexistent-task")

        assert "nonexistent-task" in str(exc_info.value)

    async def test_load_context_pack_invalid_json(self, loader, workspace_path):
        """ContextLoader raises error for invalid JSON."""
        context_dir = workspace_path / "context_packs"
        context_dir.mkdir(parents=True, exist_ok=True)
        pack_file = context_dir / "task-123.json"
        pack_file.write_text("invalid json {")

        with pytest.raises(ContextPackFormatError) as exc_info:
            await loader.load(task_id="task-123")

        assert "JSON" in str(exc_info.value) or "format" in str(exc_info.value).lower()

    async def test_load_context_pack_from_artifact_path(
        self, loader, workspace_path
    ):
        """ContextLoader loads pack from artifact path."""
        content = {"task_id": "task-456", "files": []}
        artifact_dir = workspace_path / "artifacts" / "session-123"
        artifact_dir.mkdir(parents=True, exist_ok=True)
        pack_file = artifact_dir / "context_pack.json"
        pack_file.write_text(json.dumps(content))

        result = await loader.load_from_path(str(pack_file))

        assert result["task_id"] == "task-456"

    async def test_load_from_path_not_found(self, loader):
        """ContextLoader raises error for missing path."""
        with pytest.raises(ContextPackNotFoundError):
            await loader.load_from_path("/nonexistent/path.json")

    def test_get_context_pack_path(self, loader, workspace_path):
        """ContextLoader returns correct pack path."""
        path = loader.get_context_pack_path("task-789")

        expected = str(workspace_path / "context_packs" / "task-789.json")
        assert path == expected

    async def test_exists_returns_true_when_exists(self, loader, workspace_path):
        """ContextLoader.exists returns True when pack exists."""
        self._create_context_pack(
            workspace_path, "task-123", {"task_id": "task-123", "files": []}
        )

        result = await loader.exists(task_id="task-123")

        assert result is True

    async def test_exists_returns_false_when_missing(self, loader):
        """ContextLoader.exists returns False when pack missing."""
        result = await loader.exists(task_id="nonexistent")

        assert result is False


class TestContextLoaderValidation:
    """Tests for context pack validation."""

    @pytest.fixture
    def workspace_path(self, tmp_path):
        """Create a temporary workspace."""
        return tmp_path

    @pytest.fixture
    def loader(self, workspace_path):
        """Create a ContextLoader with validation."""
        return ContextLoader(workspace_path=str(workspace_path), validate=True)

    async def test_validates_required_fields(self, loader, workspace_path):
        """ContextLoader validates required fields."""
        # Missing 'files' field
        content = {"task_id": "task-123"}
        context_dir = workspace_path / "context_packs"
        context_dir.mkdir(parents=True, exist_ok=True)
        pack_file = context_dir / "task-123.json"
        pack_file.write_text(json.dumps(content))

        with pytest.raises(ContextPackFormatError) as exc_info:
            await loader.load(task_id="task-123")

        assert "files" in str(exc_info.value).lower()

    async def test_validates_files_is_list(self, loader, workspace_path):
        """ContextLoader validates files is a list."""
        content = {"task_id": "task-123", "files": "not a list"}
        context_dir = workspace_path / "context_packs"
        context_dir.mkdir(parents=True, exist_ok=True)
        pack_file = context_dir / "task-123.json"
        pack_file.write_text(json.dumps(content))

        with pytest.raises(ContextPackFormatError):
            await loader.load(task_id="task-123")

    async def test_skips_validation_when_disabled(self, workspace_path):
        """ContextLoader skips validation when disabled."""
        loader = ContextLoader(workspace_path=str(workspace_path), validate=False)
        content = {"incomplete": "data"}
        context_dir = workspace_path / "context_packs"
        context_dir.mkdir(parents=True, exist_ok=True)
        pack_file = context_dir / "task-123.json"
        pack_file.write_text(json.dumps(content))

        # Should not raise
        result = await loader.load(task_id="task-123")

        assert result["incomplete"] == "data"
