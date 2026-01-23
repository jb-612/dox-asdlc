"""Unit tests for RLM symbol tools."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from src.core.exceptions import RLMToolError
from src.workers.rlm.tools.symbol_tools import SymbolTools
from src.workers.repo_mapper.models import SymbolKind


@pytest.fixture
def temp_repo():
    """Create a temporary repository with Python files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        # Create directory structure
        (root / "src").mkdir()
        (root / "src" / "core").mkdir()

        # Create valid Python file
        (root / "src" / "main.py").write_text(
            '''"""Main module."""

from pathlib import Path
from typing import Optional
import os

class Application:
    """Main application class."""

    def __init__(self, name: str):
        """Initialize application."""
        self.name = name

    def run(self) -> None:
        """Run the application."""
        print(f"Running {self.name}")

def main(args: Optional[list[str]] = None) -> int:
    """Entry point function.

    Args:
        args: Command line arguments

    Returns:
        Exit code
    """
    app = Application("test")
    app.run()
    return 0

if __name__ == "__main__":
    main()
'''
        )

        # Create another Python file
        (root / "src" / "core" / "utils.py").write_text(
            '''"""Utility functions."""

def helper(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y

def _private_helper():
    """Private helper function."""
    pass

class Config:
    """Configuration class."""
    DEBUG = True
'''
        )

        # Create file with syntax error
        (root / "src" / "broken.py").write_text(
            '''# This file has a syntax error
def broken(
    # Missing closing paren
'''
        )

        # Create non-Python file
        (root / "src" / "data.txt").write_text("Just some data\n")

        yield str(root)


class TestSymbolToolsInit:
    """Tests for SymbolTools initialization."""

    def test_init_with_valid_path(self, temp_repo: str) -> None:
        """Test initialization with valid path."""
        tools = SymbolTools(repo_root=temp_repo)
        assert tools.repo_root == temp_repo

    def test_init_with_invalid_path(self) -> None:
        """Test initialization with non-existent path."""
        with pytest.raises(RLMToolError, match="does not exist"):
            SymbolTools(repo_root="/nonexistent/path")


class TestGetSupportedExtensions:
    """Tests for get_supported_extensions method."""

    def test_returns_python_extension(self, temp_repo: str) -> None:
        """Test that Python is supported."""
        tools = SymbolTools(repo_root=temp_repo)
        extensions = tools.get_supported_extensions()
        assert ".py" in extensions


class TestIsSupported:
    """Tests for is_supported method."""

    def test_python_file_supported(self, temp_repo: str) -> None:
        """Test Python files are supported."""
        tools = SymbolTools(repo_root=temp_repo)
        assert tools.is_supported("src/main.py") is True

    def test_txt_file_not_supported(self, temp_repo: str) -> None:
        """Test text files are not supported."""
        tools = SymbolTools(repo_root=temp_repo)
        assert tools.is_supported("src/data.txt") is False

    def test_case_insensitive(self, temp_repo: str) -> None:
        """Test extension matching is case insensitive."""
        tools = SymbolTools(repo_root=temp_repo)
        assert tools.is_supported("file.PY") is True


class TestExtractSymbols:
    """Tests for extract_symbols method."""

    def test_extract_symbols_from_python(self, temp_repo: str) -> None:
        """Test extracting symbols from Python file."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        assert len(symbols) > 0
        names = [s.name for s in symbols]
        assert "Application" in names
        assert "main" in names

    def test_extract_class_symbols(self, temp_repo: str) -> None:
        """Test extracting class symbols."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        classes = [s for s in symbols if s.kind == SymbolKind.CLASS]
        assert len(classes) == 1
        assert classes[0].name == "Application"

    def test_extract_function_symbols(self, temp_repo: str) -> None:
        """Test extracting function symbols."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        functions = [s for s in symbols if s.kind == SymbolKind.FUNCTION]
        assert any(f.name == "main" for f in functions)

    def test_extract_method_symbols(self, temp_repo: str) -> None:
        """Test extracting method symbols."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        methods = [s for s in symbols if s.kind == SymbolKind.METHOD]
        method_names = [m.name for m in methods]
        assert "__init__" in method_names
        assert "run" in method_names

    def test_symbols_have_line_numbers(self, temp_repo: str) -> None:
        """Test that symbols have correct line numbers."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        main_func = next(s for s in symbols if s.name == "main")
        assert main_func.start_line > 0
        assert main_func.end_line >= main_func.start_line

    def test_symbols_have_signatures(self, temp_repo: str) -> None:
        """Test that symbols have signatures."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        main_func = next(s for s in symbols if s.name == "main")
        assert main_func.signature is not None
        assert "def main" in main_func.signature

    def test_symbols_have_docstrings(self, temp_repo: str) -> None:
        """Test that symbols have docstrings."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/main.py")

        main_func = next(s for s in symbols if s.name == "main")
        assert main_func.docstring is not None
        assert "Entry point" in main_func.docstring

    def test_extract_from_unsupported_file(self, temp_repo: str) -> None:
        """Test extracting from unsupported file type."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/data.txt")
        assert symbols == []

    def test_extract_from_file_with_syntax_error(self, temp_repo: str) -> None:
        """Test extracting from file with syntax error returns empty."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.extract_symbols("src/broken.py")
        assert symbols == []

    def test_extract_from_nonexistent_file(self, temp_repo: str) -> None:
        """Test extracting from non-existent file."""
        tools = SymbolTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="Not a file"):
            tools.extract_symbols("src/nonexistent.py")

    def test_extract_from_path_outside_root(self, temp_repo: str) -> None:
        """Test extracting from path outside root."""
        tools = SymbolTools(repo_root=temp_repo)
        with pytest.raises(RLMToolError, match="escapes repository root"):
            tools.extract_symbols("/etc/passwd")


class TestParseAST:
    """Tests for parse_ast method."""

    def test_parse_python_file(self, temp_repo: str) -> None:
        """Test parsing Python file."""
        tools = SymbolTools(repo_root=temp_repo)
        parsed = tools.parse_ast("src/main.py")

        assert parsed is not None
        assert parsed.language == "python"
        assert len(parsed.symbols) > 0
        assert len(parsed.imports) > 0

    def test_parse_has_imports(self, temp_repo: str) -> None:
        """Test parsed file has import info."""
        tools = SymbolTools(repo_root=temp_repo)
        parsed = tools.parse_ast("src/main.py")

        assert parsed is not None
        import_sources = [imp.source for imp in parsed.imports]
        assert "pathlib" in import_sources
        assert "os" in import_sources

    def test_parse_has_exports(self, temp_repo: str) -> None:
        """Test parsed file has exports."""
        tools = SymbolTools(repo_root=temp_repo)
        parsed = tools.parse_ast("src/main.py")

        assert parsed is not None
        assert "Application" in parsed.exports
        assert "main" in parsed.exports

    def test_parse_unsupported_file(self, temp_repo: str) -> None:
        """Test parsing unsupported file type returns None."""
        tools = SymbolTools(repo_root=temp_repo)
        parsed = tools.parse_ast("src/data.txt")
        assert parsed is None

    def test_parse_file_with_syntax_error(self, temp_repo: str) -> None:
        """Test parsing file with syntax error returns minimal ParsedFile."""
        tools = SymbolTools(repo_root=temp_repo)
        parsed = tools.parse_ast("src/broken.py")

        assert parsed is not None
        assert parsed.symbols == []
        assert "Syntax error" in parsed.raw_content


class TestFindSymbol:
    """Tests for find_symbol method."""

    def test_find_symbol_by_name(self, temp_repo: str) -> None:
        """Test finding symbol by name."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.find_symbol(
            "helper",
            ["src/core/utils.py"],
        )

        assert len(symbols) == 1
        assert symbols[0].name == "helper"

    def test_find_symbol_across_files(self, temp_repo: str) -> None:
        """Test finding symbol across multiple files."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.find_symbol(
            "Config",
            ["src/main.py", "src/core/utils.py"],
        )

        assert len(symbols) == 1
        assert symbols[0].name == "Config"

    def test_find_symbol_not_found(self, temp_repo: str) -> None:
        """Test finding non-existent symbol."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.find_symbol(
            "NotExists",
            ["src/main.py"],
        )

        assert symbols == []


class TestFindSymbolsByKind:
    """Tests for find_symbols_by_kind method."""

    def test_find_classes(self, temp_repo: str) -> None:
        """Test finding all classes in a file."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.find_symbols_by_kind("src/main.py", "class")

        assert len(symbols) == 1
        assert symbols[0].name == "Application"

    def test_find_functions(self, temp_repo: str) -> None:
        """Test finding all functions in a file."""
        tools = SymbolTools(repo_root=temp_repo)
        symbols = tools.find_symbols_by_kind("src/core/utils.py", "function")

        names = [s.name for s in symbols]
        assert "helper" in names
        assert "_private_helper" in names


class TestGetFunctionSignature:
    """Tests for get_function_signature method."""

    def test_get_signature(self, temp_repo: str) -> None:
        """Test getting function signature."""
        tools = SymbolTools(repo_root=temp_repo)
        sig = tools.get_function_signature("src/core/utils.py", "helper")

        assert sig is not None
        assert "def helper" in sig
        assert "int" in sig

    def test_get_signature_not_found(self, temp_repo: str) -> None:
        """Test getting signature of non-existent function."""
        tools = SymbolTools(repo_root=temp_repo)
        sig = tools.get_function_signature("src/main.py", "nonexistent")

        assert sig is None


class TestGetImports:
    """Tests for get_imports method."""

    def test_get_imports(self, temp_repo: str) -> None:
        """Test getting imports from file."""
        tools = SymbolTools(repo_root=temp_repo)
        imports = tools.get_imports("src/main.py")

        assert len(imports) > 0
        sources = [imp["source"] for imp in imports]
        assert "pathlib" in sources
        assert "os" in sources

    def test_get_imports_unsupported(self, temp_repo: str) -> None:
        """Test getting imports from unsupported file."""
        tools = SymbolTools(repo_root=temp_repo)
        imports = tools.get_imports("src/data.txt")

        assert imports == []


class TestToDict:
    """Tests for to_dict method."""

    def test_to_dict(self, temp_repo: str) -> None:
        """Test to_dict includes all fields."""
        tools = SymbolTools(repo_root=temp_repo)
        d = tools.to_dict()

        assert "repo_root" in d
        assert "supported_extensions" in d
        assert d["repo_root"] == temp_repo
        assert ".py" in d["supported_extensions"]
