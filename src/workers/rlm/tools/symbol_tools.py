"""Symbol operation tools for RLM exploration.

Provides AST parsing and symbol extraction using P03-F02 parsers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.core.exceptions import RLMToolError
from src.workers.repo_mapper.models import ParsedFile, SymbolInfo
from src.workers.repo_mapper.parsers.python_parser import PythonParser

logger = logging.getLogger(__name__)


# Language to parser mapping
_PARSERS = {
    ".py": PythonParser,
}


@dataclass
class SymbolTools:
    """Symbol operation tools for RLM exploration.

    Provides AST parsing and symbol extraction capabilities using
    the parsers from P03-F02.

    Attributes:
        repo_root: Root path of the repository

    Example:
        tools = SymbolTools(repo_root="/path/to/repo")
        symbols = tools.extract_symbols("src/main.py")
        parsed = tools.parse_ast("src/main.py")
    """

    repo_root: str

    def __post_init__(self) -> None:
        """Validate and normalize repo root."""
        self._root = Path(self.repo_root).resolve()
        if not self._root.is_dir():
            raise RLMToolError(f"Repository root does not exist: {self.repo_root}")
        self._parsers: dict[str, Any] = {}

    def _get_parser(self, extension: str) -> Any:
        """Get parser for file extension.

        Args:
            extension: File extension (e.g., ".py")

        Returns:
            Parser instance or None if unsupported

        Raises:
            RLMToolError: If extension is not supported
        """
        if extension in self._parsers:
            return self._parsers[extension]

        parser_cls = _PARSERS.get(extension)
        if parser_cls is None:
            return None

        parser = parser_cls()
        self._parsers[extension] = parser
        return parser

    def _validate_path(self, path: str) -> Path:
        """Validate path is within repository root.

        Args:
            path: Path to validate

        Returns:
            Resolved absolute path

        Raises:
            RLMToolError: If path is outside repo root
        """
        if not path.startswith("/"):
            full_path = self._root / path
        else:
            full_path = Path(path)

        try:
            resolved = full_path.resolve()
        except (OSError, RuntimeError) as e:
            raise RLMToolError(f"Cannot resolve path: {path}") from e

        try:
            resolved.relative_to(self._root)
        except ValueError:
            raise RLMToolError(f"Path escapes repository root: {path}")

        return resolved

    def get_supported_extensions(self) -> list[str]:
        """Get list of supported file extensions.

        Returns:
            List of supported extensions (e.g., [".py"])
        """
        return list(_PARSERS.keys())

    def is_supported(self, path: str) -> bool:
        """Check if file type is supported for parsing.

        Args:
            path: File path to check

        Returns:
            True if the file type is supported
        """
        extension = Path(path).suffix.lower()
        return extension in _PARSERS

    def extract_symbols(self, path: str) -> list[SymbolInfo]:
        """Extract symbols from a source file.

        Args:
            path: Path to file (relative to repo root)

        Returns:
            List of SymbolInfo objects

        Raises:
            RLMToolError: If file doesn't exist, is outside root, or unsupported
        """
        file_path = self._validate_path(path)

        if not file_path.is_file():
            raise RLMToolError(f"Not a file: {path}")

        extension = file_path.suffix.lower()
        parser = self._get_parser(extension)

        if parser is None:
            logger.warning(f"Unsupported file type for symbol extraction: {extension}")
            return []

        try:
            parsed = parser.parse_file(str(file_path))
            logger.debug(
                f"Extracted {len(parsed.symbols)} symbols from {path}"
            )
            return parsed.symbols
        except SyntaxError as e:
            logger.warning(f"Syntax error parsing {path}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            raise RLMToolError(f"Failed to parse file: {path}") from e

    def parse_ast(self, path: str) -> ParsedFile | None:
        """Parse file and return full AST information.

        Args:
            path: Path to file (relative to repo root)

        Returns:
            ParsedFile with full AST information, or None if unsupported

        Raises:
            RLMToolError: If file doesn't exist or is outside root
        """
        file_path = self._validate_path(path)

        if not file_path.is_file():
            raise RLMToolError(f"Not a file: {path}")

        extension = file_path.suffix.lower()
        parser = self._get_parser(extension)

        if parser is None:
            logger.warning(f"Unsupported file type for AST parsing: {extension}")
            return None

        try:
            parsed = parser.parse_file(str(file_path))
            logger.debug(
                f"Parsed AST for {path}: "
                f"{len(parsed.symbols)} symbols, {len(parsed.imports)} imports"
            )
            return parsed
        except SyntaxError as e:
            logger.warning(f"Syntax error parsing {path}: {e}")
            # Return minimal ParsedFile with error
            return ParsedFile(
                path=path,
                language=extension[1:],  # Remove dot
                symbols=[],
                imports=[],
                exports=[],
                raw_content=f"# Syntax error: {e}",
                line_count=0,
            )
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            raise RLMToolError(f"Failed to parse file: {path}") from e

    def find_symbol(
        self,
        name: str,
        paths: list[str],
    ) -> list[SymbolInfo]:
        """Find symbols by name across multiple files.

        Args:
            name: Symbol name to search for (exact match)
            paths: List of file paths to search

        Returns:
            List of matching SymbolInfo objects
        """
        results: list[SymbolInfo] = []

        for path in paths:
            try:
                symbols = self.extract_symbols(path)
                for symbol in symbols:
                    if symbol.name == name:
                        results.append(symbol)
            except RLMToolError:
                continue  # Skip files that can't be parsed

        return results

    def find_symbols_by_kind(
        self,
        path: str,
        kind: str,
    ) -> list[SymbolInfo]:
        """Find symbols of a specific kind in a file.

        Args:
            path: Path to file
            kind: Symbol kind (function, class, method, etc.)

        Returns:
            List of matching SymbolInfo objects
        """
        try:
            symbols = self.extract_symbols(path)
            return [s for s in symbols if s.kind.value == kind]
        except RLMToolError:
            return []

    def get_function_signature(self, path: str, name: str) -> str | None:
        """Get the signature of a function by name.

        Args:
            path: Path to file containing the function
            name: Function name

        Returns:
            Function signature string, or None if not found
        """
        try:
            symbols = self.extract_symbols(path)
            for symbol in symbols:
                if symbol.name == name and symbol.signature:
                    return symbol.signature
            return None
        except RLMToolError:
            return None

    def get_imports(self, path: str) -> list[dict[str, Any]]:
        """Get all imports from a file.

        Args:
            path: Path to file

        Returns:
            List of import information dictionaries
        """
        try:
            parsed = self.parse_ast(path)
            if parsed is None:
                return []
            return [imp.to_dict() for imp in parsed.imports]
        except RLMToolError:
            return []

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "repo_root": self.repo_root,
            "supported_extensions": self.get_supported_extensions(),
        }
