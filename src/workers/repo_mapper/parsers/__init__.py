"""AST parsers for different programming languages."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Protocol

from src.workers.repo_mapper.models import ParsedFile


class ASTParser(Protocol):
    """Protocol for language-specific AST parsers."""

    def parse_file(self, file_path: str) -> ParsedFile:
        """Parse a single file and extract symbols.

        Args:
            file_path: Path to the file to parse

        Returns:
            ParsedFile containing extracted symbols and imports

        Raises:
            FileNotFoundError: If file does not exist
            SyntaxError: If file has syntax errors
        """
        ...

    def get_supported_extensions(self) -> list[str]:
        """Return file extensions this parser handles.

        Returns:
            List of file extensions (e.g., [".py"])
        """
        ...


class ParserRegistry:
    """Registry for AST parsers by file extension.

    Manages mapping of file extensions to their corresponding parsers.
    """

    def __init__(self) -> None:
        """Initialize an empty parser registry."""
        self._parsers: dict[str, ASTParser] = {}

    def register_parser(self, extension: str, parser: ASTParser) -> None:
        """Register a parser for a file extension.

        Args:
            extension: File extension (e.g., ".py")
            parser: Parser instance to handle this extension
        """
        self._parsers[extension] = parser

    def get_parser(self, extension: str) -> ASTParser | None:
        """Get parser for a file extension.

        Args:
            extension: File extension (e.g., ".py")

        Returns:
            Parser instance, or None if no parser registered
        """
        return self._parsers.get(extension)

    def get_parser_for_file(self, file_path: str | Path) -> ASTParser | None:
        """Get parser for a file path based on its extension.

        Args:
            file_path: Path to the file

        Returns:
            Parser instance, or None if no parser registered for this extension
        """
        path = Path(file_path)
        extension = path.suffix
        return self.get_parser(extension)

    def list_supported_extensions(self) -> list[str]:
        """List all supported file extensions.

        Returns:
            List of registered file extensions
        """
        return list(self._parsers.keys())

    @classmethod
    @lru_cache(maxsize=1)
    def default(cls) -> ParserRegistry:
        """Get the default parser registry with pre-registered parsers.

        Returns:
            ParserRegistry with Python and TypeScript parsers registered
        """
        from src.workers.repo_mapper.parsers.python_parser import PythonParser
        from src.workers.repo_mapper.parsers.typescript_parser import TypeScriptParser

        registry = cls()

        # Register Python parser
        python_parser = PythonParser()
        for ext in python_parser.get_supported_extensions():
            registry.register_parser(ext, python_parser)

        # Register TypeScript parser for .ts, .tsx, .js, .jsx files
        typescript_parser = TypeScriptParser()
        for ext in typescript_parser.get_supported_extensions():
            registry.register_parser(ext, typescript_parser)

        return registry


def get_parser_for_file(file_path: str | Path) -> ASTParser | None:
    """Get parser for a file using the default registry.

    Args:
        file_path: Path to the file

    Returns:
        Parser instance, or None if no parser available
    """
    return ParserRegistry.default().get_parser_for_file(file_path)


__all__ = [
    "ASTParser",
    "ParserRegistry",
    "get_parser_for_file",
]
