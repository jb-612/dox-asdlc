"""File operation tools for RLM exploration.

Provides read-only file operations within a sandboxed repository path.
"""

from __future__ import annotations

import fnmatch
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.core.exceptions import RLMToolError
from src.workers.rlm.models import GrepMatch

logger = logging.getLogger(__name__)


@dataclass
class FileTools:
    """Read-only file operation tools for RLM.

    All operations are sandboxed to the repository root to prevent
    access to files outside the allowed directory.

    Attributes:
        repo_root: Root path of the repository (sandbox boundary)

    Example:
        tools = FileTools(repo_root="/path/to/repo")
        files = tools.list_files("src/", pattern="*.py")
        content = tools.read_file("src/main.py")
        matches = tools.grep("TODO", ["src/"])
    """

    repo_root: str

    def __post_init__(self) -> None:
        """Validate and normalize repo root."""
        self._root = Path(self.repo_root).resolve()
        if not self._root.is_dir():
            raise RLMToolError(f"Repository root does not exist: {self.repo_root}")

    def _validate_path(self, path: str) -> Path:
        """Validate path is within repository root.

        Args:
            path: Path to validate (absolute or relative)

        Returns:
            Resolved absolute Path within repo root

        Raises:
            RLMToolError: If path is outside repo root
        """
        # Handle relative paths
        if not os.path.isabs(path):
            full_path = self._root / path
        else:
            full_path = Path(path)

        # Resolve to absolute path (handles .. and symlinks)
        try:
            resolved = full_path.resolve()
        except (OSError, RuntimeError) as e:
            raise RLMToolError(f"Cannot resolve path: {path}") from e

        # Check if within repo root
        try:
            resolved.relative_to(self._root)
        except ValueError:
            raise RLMToolError(
                f"Path escapes repository root: {path} "
                f"(resolved: {resolved}, root: {self._root})"
            )

        return resolved

    def list_files(
        self,
        directory: str = ".",
        pattern: str = "*",
        recursive: bool = False,
        max_results: int = 1000,
    ) -> list[str]:
        """List files in directory matching pattern.

        Args:
            directory: Directory to search in (relative to repo root)
            pattern: Glob pattern to match files against
            recursive: Whether to search recursively
            max_results: Maximum number of results to return

        Returns:
            List of file paths relative to repo root

        Raises:
            RLMToolError: If directory is outside repo root or doesn't exist
        """
        dir_path = self._validate_path(directory)

        if not dir_path.is_dir():
            raise RLMToolError(f"Not a directory: {directory}")

        results: list[str] = []

        try:
            if recursive:
                # Walk directory tree
                for root, _, files in os.walk(dir_path):
                    root_path = Path(root)
                    for file in files:
                        if fnmatch.fnmatch(file, pattern):
                            file_path = root_path / file
                            # Return relative path
                            rel_path = str(file_path.relative_to(self._root))
                            results.append(rel_path)
                            if len(results) >= max_results:
                                logger.warning(
                                    f"list_files hit max_results ({max_results})"
                                )
                                return results
            else:
                # Single directory only
                for item in dir_path.iterdir():
                    if item.is_file() and fnmatch.fnmatch(item.name, pattern):
                        rel_path = str(item.relative_to(self._root))
                        results.append(rel_path)
                        if len(results) >= max_results:
                            logger.warning(
                                f"list_files hit max_results ({max_results})"
                            )
                            return results
        except PermissionError as e:
            raise RLMToolError(f"Permission denied: {directory}") from e

        return sorted(results)

    def read_file(
        self,
        path: str,
        start_line: int | None = None,
        end_line: int | None = None,
        max_size_bytes: int = 1_000_000,
    ) -> str:
        """Read file content, optionally a specific line range.

        Args:
            path: Path to file (relative to repo root)
            start_line: Starting line number (1-indexed, inclusive)
            end_line: Ending line number (1-indexed, inclusive)
            max_size_bytes: Maximum file size to read

        Returns:
            File content (or specified line range)

        Raises:
            RLMToolError: If file doesn't exist, is too large, or outside root
        """
        file_path = self._validate_path(path)

        if not file_path.is_file():
            raise RLMToolError(f"Not a file: {path}")

        # Check file size
        try:
            size = file_path.stat().st_size
            if size > max_size_bytes:
                raise RLMToolError(
                    f"File too large: {path} ({size} bytes, max: {max_size_bytes})"
                )
        except OSError as e:
            raise RLMToolError(f"Cannot stat file: {path}") from e

        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except (OSError, UnicodeDecodeError) as e:
            raise RLMToolError(f"Cannot read file: {path}") from e

        # Handle line range
        if start_line is not None or end_line is not None:
            lines = content.splitlines(keepends=True)
            total_lines = len(lines)

            # Default values
            start = start_line if start_line is not None else 1
            end = end_line if end_line is not None else total_lines

            # Validate bounds
            if start < 1:
                start = 1
            if end > total_lines:
                end = total_lines
            if start > end:
                return ""

            # Convert to 0-indexed
            selected = lines[start - 1 : end]
            return "".join(selected)

        return content

    def grep(
        self,
        pattern: str,
        paths: list[str],
        context_lines: int = 2,
        max_matches: int = 100,
        case_insensitive: bool = False,
    ) -> list[GrepMatch]:
        """Search for pattern in files.

        Args:
            pattern: Regular expression pattern to search for
            paths: List of file paths or directories to search
            context_lines: Number of context lines before/after match
            max_matches: Maximum number of matches to return
            case_insensitive: Whether to do case-insensitive matching

        Returns:
            List of GrepMatch objects

        Raises:
            RLMToolError: If pattern is invalid or paths outside root
        """
        try:
            flags = re.IGNORECASE if case_insensitive else 0
            regex = re.compile(pattern, flags)
        except re.error as e:
            raise RLMToolError(f"Invalid regex pattern: {pattern}") from e

        matches: list[GrepMatch] = []

        # Collect files to search
        files_to_search: list[Path] = []
        for path in paths:
            validated = self._validate_path(path)
            if validated.is_file():
                files_to_search.append(validated)
            elif validated.is_dir():
                # Search all files in directory recursively
                for file_path in validated.rglob("*"):
                    if file_path.is_file():
                        files_to_search.append(file_path)

        # Search files
        for file_path in files_to_search:
            if len(matches) >= max_matches:
                break

            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                lines = content.splitlines()
            except (OSError, UnicodeDecodeError):
                continue  # Skip unreadable files

            for i, line in enumerate(lines):
                if regex.search(line):
                    # Get context lines
                    start = max(0, i - context_lines)
                    end = min(len(lines), i + context_lines + 1)

                    context_before = lines[start:i]
                    context_after = lines[i + 1 : end]

                    rel_path = str(file_path.relative_to(self._root))
                    match = GrepMatch(
                        file_path=rel_path,
                        line_number=i + 1,  # 1-indexed
                        line_content=line,
                        context_before=context_before,
                        context_after=context_after,
                    )
                    matches.append(match)

                    if len(matches) >= max_matches:
                        logger.warning(f"grep hit max_matches ({max_matches})")
                        break

        return matches

    def file_exists(self, path: str) -> bool:
        """Check if file exists.

        Args:
            path: Path to check

        Returns:
            True if file exists and is within repo root
        """
        try:
            validated = self._validate_path(path)
            return validated.is_file()
        except RLMToolError:
            return False

    def get_file_info(self, path: str) -> dict[str, Any]:
        """Get file metadata.

        Args:
            path: Path to file

        Returns:
            Dictionary with file info (size, line_count, extension)

        Raises:
            RLMToolError: If file doesn't exist or outside root
        """
        file_path = self._validate_path(path)

        if not file_path.is_file():
            raise RLMToolError(f"Not a file: {path}")

        try:
            stat = file_path.stat()
            content = file_path.read_text(encoding="utf-8", errors="replace")
            line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
        except (OSError, UnicodeDecodeError) as e:
            raise RLMToolError(f"Cannot read file info: {path}") from e

        return {
            "path": path,
            "size_bytes": stat.st_size,
            "line_count": line_count,
            "extension": file_path.suffix,
            "name": file_path.name,
        }

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "repo_root": self.repo_root,
            "resolved_root": str(self._root),
        }
