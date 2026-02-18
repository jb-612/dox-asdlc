"""Python AST parser implementation."""

from __future__ import annotations

import ast
from pathlib import Path
from src.workers.repo_mapper.models import (
    ImportInfo,
    ParsedFile,
    SymbolInfo,
    SymbolKind,
)


class PythonParser:
    """Parser for Python source files using the ast module."""

    def get_supported_extensions(self) -> list[str]:
        """Return file extensions this parser handles.

        Returns:
            List containing ".py"
        """
        return [".py"]

    def parse_file(self, file_path: str) -> ParsedFile:
        """Parse a Python file and extract symbols and imports.

        Args:
            file_path: Path to the Python file

        Returns:
            ParsedFile with extracted symbols and imports

        Raises:
            FileNotFoundError: If file does not exist
            SyntaxError: If file has syntax errors
        """
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        content = path.read_text(encoding="utf-8")
        tree = ast.parse(content, filename=str(path))

        symbols: list[SymbolInfo] = []
        imports: list[ImportInfo] = []

        # Extract top-level functions and classes
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                symbol = self._extract_function(node, file_path)
                symbols.append(symbol)
            elif isinstance(node, ast.ClassDef):
                symbol = self._extract_class(node, file_path)
                symbols.append(symbol)

                # Extract methods from class
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        method = self._extract_method(item, file_path)
                        symbols.append(method)

            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                import_info = self._extract_import(node)
                imports.append(import_info)

        # Count lines
        line_count = len(content.splitlines())
        if content and not content.endswith("\n"):
            line_count += 1

        return ParsedFile(
            path=file_path,
            language="python",
            symbols=symbols,
            imports=imports,
            exports=self._extract_exports(symbols),
            raw_content=content,
            line_count=line_count,
        )

    def _extract_function(
        self, node: ast.FunctionDef, file_path: str
    ) -> SymbolInfo:
        """Extract function information from AST node.

        Args:
            node: FunctionDef AST node
            file_path: Path to the file

        Returns:
            SymbolInfo for the function
        """
        signature = self._build_signature(node)
        docstring = ast.get_docstring(node)

        return SymbolInfo(
            name=node.name,
            kind=SymbolKind.FUNCTION,
            file_path=file_path,
            start_line=node.lineno,
            end_line=node.end_lineno or node.lineno,
            signature=signature,
            docstring=docstring,
            references=[],
        )

    def _extract_method(self, node: ast.FunctionDef, file_path: str) -> SymbolInfo:
        """Extract method information from AST node.

        Args:
            node: FunctionDef AST node within a class
            file_path: Path to the file

        Returns:
            SymbolInfo for the method
        """
        signature = self._build_signature(node)
        docstring = ast.get_docstring(node)

        return SymbolInfo(
            name=node.name,
            kind=SymbolKind.METHOD,
            file_path=file_path,
            start_line=node.lineno,
            end_line=node.end_lineno or node.lineno,
            signature=signature,
            docstring=docstring,
            references=[],
        )

    def _extract_class(self, node: ast.ClassDef, file_path: str) -> SymbolInfo:
        """Extract class information from AST node.

        Args:
            node: ClassDef AST node
            file_path: Path to the file

        Returns:
            SymbolInfo for the class
        """
        docstring = ast.get_docstring(node)

        # Build class signature with base classes
        bases = [self._unparse(base) for base in node.bases]
        if bases:
            signature = f"class {node.name}({', '.join(bases)})"
        else:
            signature = f"class {node.name}"

        return SymbolInfo(
            name=node.name,
            kind=SymbolKind.CLASS,
            file_path=file_path,
            start_line=node.lineno,
            end_line=node.end_lineno or node.lineno,
            signature=signature,
            docstring=docstring,
            references=[],
        )

    def _extract_import(self, node: ast.Import | ast.ImportFrom) -> ImportInfo:
        """Extract import information from AST node.

        Args:
            node: Import or ImportFrom AST node

        Returns:
            ImportInfo for the import statement
        """
        if isinstance(node, ast.Import):
            # import os, sys
            source = node.names[0].name.split(".")[0] if node.names else ""
            names = [alias.name for alias in node.names]
            is_relative = False
        else:
            # from module import name
            source = node.module or ""
            names = [alias.name for alias in node.names]
            is_relative = node.level > 0

            # Add dots for relative imports
            if is_relative:
                source = "." * node.level + source

        return ImportInfo(
            source=source,
            names=names,
            is_relative=is_relative,
            line_number=node.lineno,
        )

    def _build_signature(self, node: ast.FunctionDef) -> str:
        """Build function signature string from AST node.

        Args:
            node: FunctionDef AST node

        Returns:
            String representation of the function signature
        """
        args_parts = []

        # Regular arguments
        for arg in node.args.args:
            arg_str = arg.arg
            if arg.annotation:
                arg_str += f": {self._unparse(arg.annotation)}"
            args_parts.append(arg_str)

        # Default values (we just note they exist)
        defaults_count = len(node.args.defaults)
        if defaults_count > 0:
            # Mark args with defaults
            for i in range(defaults_count):
                idx = len(args_parts) - defaults_count + i
                if idx >= 0 and idx < len(args_parts):
                    args_parts[idx] += " = ..."

        args_str = ", ".join(args_parts)

        # Return type
        returns = ""
        if node.returns:
            returns = f" -> {self._unparse(node.returns)}"

        return f"def {node.name}({args_str}){returns}"

    def _unparse(self, node: ast.AST) -> str:
        """Convert AST node to string.

        Args:
            node: AST node to convert

        Returns:
            String representation of the node
        """
        return ast.unparse(node)

    def _extract_exports(self, symbols: list[SymbolInfo]) -> list[str]:
        """Extract exported symbol names.

        Args:
            symbols: List of symbols in the file

        Returns:
            List of exported symbol names (top-level public symbols)
        """
        # In Python, all top-level symbols that don't start with _ are exported
        return [s.name for s in symbols if not s.name.startswith("_")]
