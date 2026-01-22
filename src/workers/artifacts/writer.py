"""Artifact writer for agent output.

Writes patches, reports, and other artifacts produced by agents
to the workspace filesystem.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class ArtifactType(Enum):
    """Types of artifacts that can be written."""

    PATCH = ("patch", ".patch")
    REPORT = ("report", ".json")
    TEXT = ("text", ".txt")
    BINARY = ("binary", ".bin")
    LOG = ("log", ".log")

    def __init__(self, type_name: str, ext: str) -> None:
        self._type_name = type_name
        self._extension = ext

    @property
    def extension(self) -> str:
        """Return the default file extension for this type."""
        return self._extension


class ArtifactWriter:
    """Writes artifacts to the workspace filesystem.

    Creates a structured directory layout for artifacts organized
    by session and task.

    Directory structure:
        workspace/
        └── artifacts/
            └── {session_id}/
                ├── {task_id}_patch.patch
                ├── {task_id}_report.json
                └── ...

    Example:
        writer = ArtifactWriter(workspace_path="/app/workspace")
        path = await writer.write_patch(
            session_id="session-123",
            task_id="task-456",
            content="diff content",
        )
    """

    ARTIFACTS_DIR = "artifacts"

    def __init__(self, workspace_path: str) -> None:
        """Initialize the artifact writer.

        Args:
            workspace_path: Path to the workspace directory.
        """
        self._workspace_path = Path(workspace_path)

    @property
    def workspace_path(self) -> str:
        """Return the workspace path as a string."""
        return str(self._workspace_path)

    def get_artifact_directory(self, session_id: str) -> str:
        """Get the artifact directory for a session.

        Args:
            session_id: The session identifier.

        Returns:
            str: Path to the artifact directory.
        """
        return str(self._workspace_path / self.ARTIFACTS_DIR / session_id)

    def _ensure_directory(self, session_id: str) -> Path:
        """Ensure the artifact directory exists.

        Args:
            session_id: The session identifier.

        Returns:
            Path: The artifact directory path.
        """
        artifact_dir = self._workspace_path / self.ARTIFACTS_DIR / session_id
        artifact_dir.mkdir(parents=True, exist_ok=True)
        return artifact_dir

    def _generate_filename(
        self,
        task_id: str,
        artifact_type: ArtifactType,
        custom_filename: str | None = None,
    ) -> str:
        """Generate a filename for an artifact.

        Args:
            task_id: The task identifier.
            artifact_type: Type of artifact.
            custom_filename: Optional custom filename.

        Returns:
            str: The generated filename.
        """
        if custom_filename:
            return custom_filename

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        return f"{task_id}_{artifact_type.value[0]}_{timestamp}{artifact_type.extension}"

    async def write_artifact(
        self,
        session_id: str,
        task_id: str,
        content: str | bytes | dict[str, Any],
        artifact_type: ArtifactType,
        filename: str | None = None,
        return_relative: bool = False,
    ) -> str:
        """Write an artifact to the workspace.

        Args:
            session_id: The session identifier.
            task_id: The task identifier.
            content: The artifact content.
            artifact_type: Type of artifact.
            filename: Optional custom filename.
            return_relative: Whether to return relative path.

        Returns:
            str: Path to the written artifact.
        """
        artifact_dir = self._ensure_directory(session_id)
        file_name = self._generate_filename(task_id, artifact_type, filename)
        file_path = artifact_dir / file_name

        # Write content based on type
        if isinstance(content, bytes):
            file_path.write_bytes(content)
        elif isinstance(content, dict):
            file_path.write_text(json.dumps(content, indent=2))
        else:
            file_path.write_text(content)

        logger.debug(f"Wrote artifact: {file_path}")

        if return_relative:
            return str(file_path.relative_to(self._workspace_path))
        return str(file_path)

    async def write_patch(
        self,
        session_id: str,
        task_id: str,
        content: str,
        filename: str | None = None,
        return_relative: bool = False,
    ) -> str:
        """Write a patch artifact.

        Args:
            session_id: The session identifier.
            task_id: The task identifier.
            content: The patch content.
            filename: Optional custom filename.
            return_relative: Whether to return relative path.

        Returns:
            str: Path to the written patch.
        """
        return await self.write_artifact(
            session_id=session_id,
            task_id=task_id,
            content=content,
            artifact_type=ArtifactType.PATCH,
            filename=filename,
            return_relative=return_relative,
        )

    async def write_report(
        self,
        session_id: str,
        task_id: str,
        content: dict[str, Any],
        filename: str | None = None,
        return_relative: bool = False,
    ) -> str:
        """Write a report artifact.

        Args:
            session_id: The session identifier.
            task_id: The task identifier.
            content: The report content as a dictionary.
            filename: Optional custom filename.
            return_relative: Whether to return relative path.

        Returns:
            str: Path to the written report.
        """
        return await self.write_artifact(
            session_id=session_id,
            task_id=task_id,
            content=content,
            artifact_type=ArtifactType.REPORT,
            filename=filename,
            return_relative=return_relative,
        )

    async def list_artifacts(self, session_id: str) -> list[str]:
        """List all artifacts for a session.

        Args:
            session_id: The session identifier.

        Returns:
            list[str]: List of artifact paths.
        """
        artifact_dir = self._workspace_path / self.ARTIFACTS_DIR / session_id

        if not artifact_dir.exists():
            return []

        return [str(p) for p in artifact_dir.iterdir() if p.is_file()]
