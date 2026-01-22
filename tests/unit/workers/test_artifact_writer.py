"""Unit tests for artifact writer.

Tests the ArtifactWriter that writes patches and reports to workspace.
"""

from __future__ import annotations

import json
import pytest
from pathlib import Path
from typing import Any

from src.workers.artifacts.writer import ArtifactWriter, ArtifactType


class TestArtifactWriter:
    """Tests for ArtifactWriter class."""

    @pytest.fixture
    def workspace_path(self, tmp_path):
        """Create a temporary workspace."""
        return tmp_path

    @pytest.fixture
    def writer(self, workspace_path):
        """Create an ArtifactWriter."""
        return ArtifactWriter(workspace_path=str(workspace_path))

    def test_writer_initialization(self, writer, workspace_path):
        """ArtifactWriter initializes with workspace path."""
        assert writer.workspace_path == str(workspace_path)

    async def test_write_patch(self, writer, workspace_path):
        """ArtifactWriter writes patch files."""
        patch_content = """
--- a/src/main.py
+++ b/src/main.py
@@ -1,3 +1,4 @@
+# Added comment
 def main():
     pass
"""
        path = await writer.write_patch(
            session_id="session-123",
            task_id="task-456",
            content=patch_content,
        )

        assert Path(path).exists()
        assert Path(path).read_text() == patch_content
        assert "session-123" in path
        assert "task-456" in path
        assert path.endswith(".patch")

    async def test_write_report(self, writer, workspace_path):
        """ArtifactWriter writes report files."""
        report_content = {
            "status": "success",
            "summary": "All tests passed",
            "details": {"tests_run": 10, "passed": 10},
        }
        path = await writer.write_report(
            session_id="session-123",
            task_id="task-456",
            content=report_content,
        )

        assert Path(path).exists()
        written = json.loads(Path(path).read_text())
        assert written["status"] == "success"
        assert path.endswith(".json")

    async def test_write_text_artifact(self, writer, workspace_path):
        """ArtifactWriter writes text artifacts."""
        path = await writer.write_artifact(
            session_id="session-123",
            task_id="task-456",
            content="Some text content",
            artifact_type=ArtifactType.TEXT,
            filename="output.txt",
        )

        assert Path(path).exists()
        assert Path(path).read_text() == "Some text content"
        assert path.endswith(".txt")

    async def test_write_creates_directory_structure(self, writer, workspace_path):
        """ArtifactWriter creates necessary directories."""
        await writer.write_patch(
            session_id="new-session",
            task_id="new-task",
            content="patch content",
        )

        artifact_dir = workspace_path / "artifacts" / "new-session"
        assert artifact_dir.exists()

    async def test_write_with_custom_filename(self, writer, workspace_path):
        """ArtifactWriter uses custom filename when provided."""
        path = await writer.write_patch(
            session_id="session-123",
            task_id="task-456",
            content="patch content",
            filename="custom_patch.patch",
        )

        assert path.endswith("custom_patch.patch")

    async def test_write_binary_artifact(self, writer, workspace_path):
        """ArtifactWriter writes binary artifacts."""
        binary_content = b"\x00\x01\x02\x03"
        path = await writer.write_artifact(
            session_id="session-123",
            task_id="task-456",
            content=binary_content,
            artifact_type=ArtifactType.BINARY,
            filename="data.bin",
        )

        assert Path(path).exists()
        assert Path(path).read_bytes() == binary_content

    async def test_list_artifacts(self, writer, workspace_path):
        """ArtifactWriter lists artifacts for a session."""
        await writer.write_patch(
            session_id="session-123",
            task_id="task-1",
            content="patch 1",
        )
        await writer.write_report(
            session_id="session-123",
            task_id="task-2",
            content={"status": "ok"},
        )

        artifacts = await writer.list_artifacts(session_id="session-123")

        assert len(artifacts) >= 2

    async def test_list_artifacts_empty_session(self, writer):
        """ArtifactWriter returns empty list for empty session."""
        artifacts = await writer.list_artifacts(session_id="nonexistent")

        assert artifacts == []

    async def test_get_artifact_directory(self, writer, workspace_path):
        """ArtifactWriter returns correct artifact directory."""
        artifact_dir = writer.get_artifact_directory("session-123")

        expected = str(workspace_path / "artifacts" / "session-123")
        assert artifact_dir == expected

    async def test_write_returns_relative_path_option(self, writer):
        """ArtifactWriter can return relative paths."""
        path = await writer.write_patch(
            session_id="session-123",
            task_id="task-456",
            content="patch content",
            return_relative=True,
        )

        assert not path.startswith("/")
        assert "artifacts" in path


class TestArtifactType:
    """Tests for ArtifactType enum."""

    def test_artifact_types_defined(self):
        """All expected artifact types are defined."""
        assert ArtifactType.PATCH
        assert ArtifactType.REPORT
        assert ArtifactType.TEXT
        assert ArtifactType.BINARY
        assert ArtifactType.LOG

    def test_artifact_type_extensions(self):
        """Artifact types have correct default extensions."""
        assert ArtifactType.PATCH.extension == ".patch"
        assert ArtifactType.REPORT.extension == ".json"
        assert ArtifactType.TEXT.extension == ".txt"
        assert ArtifactType.LOG.extension == ".log"
