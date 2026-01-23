"""Unit tests for RLM file tools."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from src.core.exceptions import RLMToolError
from src.workers.rlm.tools.file_tools import FileTools


@pytest.fixture
def temp_repo():
    """Create a temporary repository structure for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        # Create directory structure
        (root / "src").mkdir()
        (root / "src" / "core").mkdir()
        (root / "tests").mkdir()

        # Create files
        (root / "README.md").write_text("# Test Repo\n\nThis is a test.\n")
        (root / "src" / "main.py").write_text(
            "#!/usr/bin/env python\n"
            "# Main module\n"
            "\n"
            "def main():\n"
            "    print('Hello')\n"
            "\n"
            "if __name__ == '__main__':\n"
            "    main()\n"
        )
        (root / "src" / "utils.py").write_text(
            "# Utils module\n"
            "# TODO: Add more utilities\n"
            "\n"
            "def helper():\n"
            "    pass\n"
        )
        (root / "src" / "core" / "__init__.py").write_text("")
        (root / "src" / "core" / "config.py").write_text(
            "# Configuration\n"
            "DEBUG = True\n"
            "# TODO: Load from env\n"
        )
        (root / "tests" / "test_main.py").write_text(
            "# Tests\n"
            "def test_main():\n"
            "    pass\n"
        )

        yield str(root)


class TestFileToolsInit:
    """Tests for FileTools initialization."""

    def test_init_with_valid_path(self, temp_repo: str) -> None:
        """Test initialization with valid path."""
        tools = FileTools(repo_root=temp_repo)
        assert tools.repo_root == temp_repo

    def test_init_with_invalid_path(self) -> None:
        """Test initialization with non-existent path."""
        with pytest.raises(RLMToolError, match="does not exist"):
            FileTools(repo_root="/nonexistent/path")

    def test_init_with_file_path(self, temp_repo: str) -> None:
        """Test initialization with file instead of directory."""
        file_path = Path(temp_repo) / "README.md"
        with pytest.raises(RLMToolError, match="does not exist"):
            FileTools(repo_root=str(file_path))


class TestPathValidation:
    """Tests for path validation."""

    def test_validate_relative_path(self, temp_repo: str) -> None:
        """Test validation of relative paths."""
        tools = FileTools(repo_root=temp_repo)
        # Should not raise
        validated = tools._validate_path("src/main.py")
        assert validated.is_file()

    def test_validate_absolute_path_within_root(self, temp_repo: str) -> None:
        """Test validation of absolute paths within root."""
        tools = FileTools(repo_root=temp_repo)
        abs_path = str(Path(temp_repo) / "src" / "main.py")
        validated = tools._validate_path(abs_path)
        assert validated.is_file()

    def test_reject_path_escape_with_dotdot(self, temp_repo: str) -> None:
        """Test rejection of path traversal attempts."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="escapes repository root"):
            tools._validate_path("../../../etc/passwd")

    def test_reject_absolute_path_outside_root(self, temp_repo: str) -> None:
        """Test rejection of absolute paths outside root."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="escapes repository root"):
            tools._validate_path("/etc/passwd")


class TestListFiles:
    """Tests for list_files method."""

    def test_list_files_in_directory(self, temp_repo: str) -> None:
        """Test listing files in a directory."""
        tools = FileTools(repo_root=temp_repo)
        files = tools.list_files("src/")
        assert "src/main.py" in files
        assert "src/utils.py" in files

    def test_list_files_with_pattern(self, temp_repo: str) -> None:
        """Test listing files with pattern."""
        tools = FileTools(repo_root=temp_repo)
        files = tools.list_files("src/", pattern="*.py")
        assert all(f.endswith(".py") for f in files)

    def test_list_files_recursive(self, temp_repo: str) -> None:
        """Test recursive file listing."""
        tools = FileTools(repo_root=temp_repo)
        files = tools.list_files("src/", pattern="*.py", recursive=True)
        assert "src/main.py" in files
        assert "src/core/config.py" in files

    def test_list_files_non_recursive_excludes_subdirs(
        self, temp_repo: str
    ) -> None:
        """Test non-recursive listing excludes subdirectories."""
        tools = FileTools(repo_root=temp_repo)
        files = tools.list_files("src/", pattern="*.py", recursive=False)
        assert "src/main.py" in files
        assert "src/core/config.py" not in files

    def test_list_files_max_results(self, temp_repo: str) -> None:
        """Test max_results limit."""
        tools = FileTools(repo_root=temp_repo)
        files = tools.list_files(".", pattern="*", recursive=True, max_results=2)
        assert len(files) == 2

    def test_list_files_invalid_directory(self, temp_repo: str) -> None:
        """Test listing non-existent directory."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Not a directory"):
            tools.list_files("nonexistent/")

    def test_list_files_on_file_path(self, temp_repo: str) -> None:
        """Test listing with file path instead of directory."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Not a directory"):
            tools.list_files("README.md")


class TestReadFile:
    """Tests for read_file method."""

    def test_read_entire_file(self, temp_repo: str) -> None:
        """Test reading entire file."""
        tools = FileTools(repo_root=temp_repo)
        content = tools.read_file("README.md")
        assert "# Test Repo" in content
        assert "This is a test" in content

    def test_read_file_line_range(self, temp_repo: str) -> None:
        """Test reading specific line range."""
        tools = FileTools(repo_root=temp_repo)
        content = tools.read_file("src/main.py", start_line=4, end_line=5)
        assert "def main():" in content
        assert "print" in content
        assert "#!/usr/bin/env" not in content

    def test_read_file_start_only(self, temp_repo: str) -> None:
        """Test reading from start line to end."""
        tools = FileTools(repo_root=temp_repo)
        content = tools.read_file("src/main.py", start_line=7)
        assert "if __name__" in content
        assert "def main():" not in content

    def test_read_file_end_only(self, temp_repo: str) -> None:
        """Test reading from beginning to end line."""
        tools = FileTools(repo_root=temp_repo)
        content = tools.read_file("src/main.py", end_line=2)
        assert "#!/usr/bin/env" in content
        assert "# Main module" in content
        assert "def main():" not in content

    def test_read_nonexistent_file(self, temp_repo: str) -> None:
        """Test reading non-existent file."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Not a file"):
            tools.read_file("nonexistent.txt")

    def test_read_directory_as_file(self, temp_repo: str) -> None:
        """Test reading directory as file."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Not a file"):
            tools.read_file("src/")

    def test_read_file_too_large(self, temp_repo: str) -> None:
        """Test reading file exceeding size limit."""
        tools = FileTools(repo_root=temp_repo)
        # Create a file that would exceed a small limit
        large_file = Path(temp_repo) / "large.txt"
        large_file.write_text("x" * 100)

        with pytest.raises(RLMToolError, match="File too large"):
            tools.read_file("large.txt", max_size_bytes=50)

    def test_read_file_invalid_line_range(self, temp_repo: str) -> None:
        """Test reading with start > end returns empty."""
        tools = FileTools(repo_root=temp_repo)
        content = tools.read_file("src/main.py", start_line=100, end_line=50)
        assert content == ""


class TestGrep:
    """Tests for grep method."""

    def test_grep_simple_pattern(self, temp_repo: str) -> None:
        """Test grep with simple pattern."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep("TODO", ["src/"])
        assert len(matches) >= 2  # utils.py and core/config.py
        assert any("utils.py" in m.file_path for m in matches)

    def test_grep_regex_pattern(self, temp_repo: str) -> None:
        """Test grep with regex pattern."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep(r"def \w+\(\):", ["src/"])
        assert len(matches) >= 2  # main() and helper()

    def test_grep_context_lines(self, temp_repo: str) -> None:
        """Test grep includes context lines."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep("TODO", ["src/utils.py"], context_lines=1)
        assert len(matches) == 1
        match = matches[0]
        assert len(match.context_before) <= 1
        assert len(match.context_after) <= 1

    def test_grep_case_insensitive(self, temp_repo: str) -> None:
        """Test case-insensitive grep."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep("todo", ["src/"], case_insensitive=True)
        assert len(matches) >= 2

    def test_grep_case_sensitive_no_match(self, temp_repo: str) -> None:
        """Test case-sensitive grep doesn't match wrong case."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep("todo", ["src/"], case_insensitive=False)
        assert len(matches) == 0

    def test_grep_max_matches(self, temp_repo: str) -> None:
        """Test grep respects max_matches."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep(".", ["src/"], max_matches=3)
        assert len(matches) == 3

    def test_grep_invalid_regex(self, temp_repo: str) -> None:
        """Test grep with invalid regex."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Invalid regex"):
            tools.grep("[invalid", ["src/"])

    def test_grep_single_file(self, temp_repo: str) -> None:
        """Test grep on single file."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep("print", ["src/main.py"])
        assert len(matches) == 1
        assert matches[0].file_path == "src/main.py"
        assert "print" in matches[0].line_content

    def test_grep_match_line_number(self, temp_repo: str) -> None:
        """Test grep returns correct line numbers."""
        tools = FileTools(repo_root=temp_repo)
        matches = tools.grep("def main", ["src/main.py"])
        assert len(matches) == 1
        assert matches[0].line_number == 4  # 1-indexed


class TestFileExists:
    """Tests for file_exists method."""

    def test_file_exists_true(self, temp_repo: str) -> None:
        """Test file_exists returns True for existing file."""
        tools = FileTools(repo_root=temp_repo)
        assert tools.file_exists("README.md") is True

    def test_file_exists_false_nonexistent(self, temp_repo: str) -> None:
        """Test file_exists returns False for non-existent file."""
        tools = FileTools(repo_root=temp_repo)
        assert tools.file_exists("nonexistent.txt") is False

    def test_file_exists_false_directory(self, temp_repo: str) -> None:
        """Test file_exists returns False for directory."""
        tools = FileTools(repo_root=temp_repo)
        assert tools.file_exists("src/") is False

    def test_file_exists_false_outside_root(self, temp_repo: str) -> None:
        """Test file_exists returns False for path outside root."""
        tools = FileTools(repo_root=temp_repo)
        assert tools.file_exists("/etc/passwd") is False


class TestGetFileInfo:
    """Tests for get_file_info method."""

    def test_get_file_info(self, temp_repo: str) -> None:
        """Test getting file info."""
        tools = FileTools(repo_root=temp_repo)
        info = tools.get_file_info("README.md")

        assert info["path"] == "README.md"
        assert info["name"] == "README.md"
        assert info["extension"] == ".md"
        assert info["size_bytes"] > 0
        assert info["line_count"] == 3

    def test_get_file_info_python_file(self, temp_repo: str) -> None:
        """Test getting info for Python file."""
        tools = FileTools(repo_root=temp_repo)
        info = tools.get_file_info("src/main.py")

        assert info["extension"] == ".py"
        assert info["line_count"] == 8

    def test_get_file_info_nonexistent(self, temp_repo: str) -> None:
        """Test get_file_info for non-existent file."""
        tools = FileTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Not a file"):
            tools.get_file_info("nonexistent.txt")


class TestToDict:
    """Tests for to_dict method."""

    def test_to_dict(self, temp_repo: str) -> None:
        """Test to_dict includes all fields."""
        tools = FileTools(repo_root=temp_repo)
        d = tools.to_dict()

        assert "repo_root" in d
        assert "resolved_root" in d
        assert d["repo_root"] == temp_repo
