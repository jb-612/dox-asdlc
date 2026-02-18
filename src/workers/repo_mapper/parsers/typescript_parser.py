"""TypeScript/JavaScript AST parser implementation using tree-sitter."""

from __future__ import annotations

from pathlib import Path
import tree_sitter_javascript as ts_js
import tree_sitter_typescript as ts_ts
from tree_sitter import Language, Node, Parser

from src.workers.repo_mapper.models import (
    ImportInfo,
    ParsedFile,
    SymbolInfo,
    SymbolKind,
)


class TypeScriptParser:
    """Parser for TypeScript/JavaScript source files using tree-sitter."""

    def __init__(self) -> None:
        """Initialize the TypeScript parser with tree-sitter grammars."""
        self._ts_language = Language(ts_ts.language_typescript())
        self._tsx_language = Language(ts_ts.language_tsx())
        self._js_language = Language(ts_js.language())

    def get_supported_extensions(self) -> list[str]:
        """Return file extensions this parser handles.

        Returns:
            List containing ".ts", ".tsx", ".js", ".jsx"
        """
        return [".ts", ".tsx", ".js", ".jsx"]

    def parse_file(self, file_path: str) -> ParsedFile:
        """Parse a TypeScript/JavaScript file and extract symbols and imports.

        Args:
            file_path: Path to the file

        Returns:
            ParsedFile with extracted symbols and imports

        Raises:
            FileNotFoundError: If file does not exist
            SyntaxError: If file has syntax errors that prevent parsing
        """
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        content = path.read_text(encoding="utf-8")
        content_bytes = content.encode("utf-8")

        # Select appropriate language based on file extension
        extension = path.suffix.lower()
        language = self._get_language_for_extension(extension)
        file_language = "javascript" if extension in [".js", ".jsx"] else "typescript"

        parser = Parser(language)
        tree = parser.parse(content_bytes)

        symbols: list[SymbolInfo] = []
        imports: list[ImportInfo] = []
        exports: list[str] = []

        # Walk the tree and extract symbols
        self._extract_from_node(
            tree.root_node, file_path, content_bytes, symbols, imports, exports
        )

        # Count lines
        line_count = len(content.splitlines())
        if content and not content.endswith("\n"):
            line_count += 1

        return ParsedFile(
            path=file_path,
            language=file_language,
            symbols=symbols,
            imports=imports,
            exports=exports,
            raw_content=content,
            line_count=line_count,
        )

    def _get_language_for_extension(self, extension: str) -> Language:
        """Get the tree-sitter language for a file extension.

        Args:
            extension: File extension (e.g., ".ts")

        Returns:
            Appropriate tree-sitter Language
        """
        if extension == ".tsx":
            return self._tsx_language
        elif extension == ".jsx":
            return self._tsx_language  # TSX language handles JSX
        elif extension == ".js":
            return self._js_language
        else:  # .ts
            return self._ts_language

    def _extract_from_node(
        self,
        node: Node,
        file_path: str,
        content: bytes,
        symbols: list[SymbolInfo],
        imports: list[ImportInfo],
        exports: list[str],
        in_class: str | None = None,
    ) -> None:
        """Recursively extract symbols and imports from AST nodes.

        Args:
            node: Current tree-sitter node
            file_path: Path to the file being parsed
            content: File content as bytes
            symbols: List to append extracted symbols
            imports: List to append extracted imports
            exports: List to append exported names
            in_class: Name of containing class if inside a class
        """
        node_type = node.type

        # Handle function declarations
        if node_type == "function_declaration":
            symbol = self._extract_function(node, file_path, content)
            symbols.append(symbol)
            if self._is_exported(node):
                exports.append(symbol.name)

        # Handle class declarations
        elif node_type == "class_declaration":
            symbol = self._extract_class(node, file_path, content)
            symbols.append(symbol)
            if self._is_exported(node):
                exports.append(symbol.name)
            # Extract methods from class body
            class_body = self._find_child_by_type(node, "class_body")
            if class_body:
                for child in class_body.children:
                    if child.type == "method_definition":
                        method = self._extract_method(child, file_path, content)
                        symbols.append(method)

        # Handle interface declarations (TypeScript)
        elif node_type == "interface_declaration":
            symbol = self._extract_interface(node, file_path, content)
            symbols.append(symbol)
            if self._is_exported(node):
                exports.append(symbol.name)

        # Handle variable declarations (for arrow functions and const exports)
        elif node_type == "lexical_declaration":
            self._extract_variable_declarations(
                node, file_path, content, symbols, exports
            )

        # Handle import statements
        elif node_type == "import_statement":
            import_info = self._extract_import(node, content)
            if import_info:
                imports.append(import_info)

        # Handle export statements
        elif node_type == "export_statement":
            self._handle_export_statement(
                node, file_path, content, symbols, imports, exports
            )

        # Recurse into children (but not into class bodies, we handle those specially)
        if node_type not in ["class_body", "class_declaration"]:
            for child in node.children:
                self._extract_from_node(
                    child, file_path, content, symbols, imports, exports, in_class
                )

    def _extract_function(
        self, node: Node, file_path: str, content: bytes
    ) -> SymbolInfo:
        """Extract function information from a function_declaration node.

        Args:
            node: function_declaration node
            file_path: Path to the file
            content: File content as bytes

        Returns:
            SymbolInfo for the function
        """
        name_node = self._find_child_by_type(node, "identifier")
        name = self._get_node_text(name_node, content) if name_node else "anonymous"

        signature = self._build_function_signature(node, content, name)

        return SymbolInfo(
            name=name,
            kind=SymbolKind.FUNCTION,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            signature=signature,
            docstring=self._extract_jsdoc(node, content),
            references=[],
        )

    def _extract_method(self, node: Node, file_path: str, content: bytes) -> SymbolInfo:
        """Extract method information from a method_definition node.

        Args:
            node: method_definition node
            file_path: Path to the file
            content: File content as bytes

        Returns:
            SymbolInfo for the method
        """
        name_node = self._find_child_by_type(node, "property_identifier")
        name = self._get_node_text(name_node, content) if name_node else "anonymous"

        signature = self._build_method_signature(node, content, name)

        return SymbolInfo(
            name=name,
            kind=SymbolKind.METHOD,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            signature=signature,
            docstring=self._extract_jsdoc(node, content),
            references=[],
        )

    def _extract_class(self, node: Node, file_path: str, content: bytes) -> SymbolInfo:
        """Extract class information from a class_declaration node.

        Args:
            node: class_declaration node
            file_path: Path to the file
            content: File content as bytes

        Returns:
            SymbolInfo for the class
        """
        name_node = self._find_child_by_type(node, "type_identifier")
        if name_node is None:
            name_node = self._find_child_by_type(node, "identifier")
        name = self._get_node_text(name_node, content) if name_node else "AnonymousClass"

        # Build signature with extends clause if present
        signature = f"class {name}"
        heritage = self._find_child_by_type(node, "class_heritage")
        if heritage:
            extends_clause = self._find_child_by_type(heritage, "extends_clause")
            if extends_clause:
                # Get the extended class name
                for child in extends_clause.children:
                    if child.type in ["type_identifier", "identifier"]:
                        base_name = self._get_node_text(child, content)
                        signature = f"class {name} extends {base_name}"
                        break

        return SymbolInfo(
            name=name,
            kind=SymbolKind.CLASS,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            signature=signature,
            docstring=self._extract_jsdoc(node, content),
            references=[],
        )

    def _extract_interface(
        self, node: Node, file_path: str, content: bytes
    ) -> SymbolInfo:
        """Extract interface information from an interface_declaration node.

        Args:
            node: interface_declaration node
            file_path: Path to the file
            content: File content as bytes

        Returns:
            SymbolInfo for the interface
        """
        name_node = self._find_child_by_type(node, "type_identifier")
        name = self._get_node_text(name_node, content) if name_node else "AnonymousInterface"

        signature = f"interface {name}"

        return SymbolInfo(
            name=name,
            kind=SymbolKind.INTERFACE,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            signature=signature,
            docstring=self._extract_jsdoc(node, content),
            references=[],
        )

    def _extract_variable_declarations(
        self,
        node: Node,
        file_path: str,
        content: bytes,
        symbols: list[SymbolInfo],
        exports: list[str],
    ) -> None:
        """Extract variable declarations (including arrow functions).

        Args:
            node: lexical_declaration node
            file_path: Path to the file
            content: File content as bytes
            symbols: List to append extracted symbols
            exports: List to append exported names
        """
        for child in node.children:
            if child.type == "variable_declarator":
                name_node = self._find_child_by_type(child, "identifier")
                if name_node is None:
                    continue

                name = self._get_node_text(name_node, content)

                # Check if the value is an arrow function
                value_node = None
                for c in child.children:
                    if c.type == "arrow_function":
                        value_node = c
                        break

                if value_node:
                    # This is an arrow function
                    signature = self._build_arrow_function_signature(
                        value_node, content, name
                    )
                    symbol = SymbolInfo(
                        name=name,
                        kind=SymbolKind.FUNCTION,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        signature=signature,
                        docstring=self._extract_jsdoc(node, content),
                        references=[],
                    )
                    symbols.append(symbol)

                    if self._is_exported(node):
                        exports.append(name)
                else:
                    # Regular variable - create a VARIABLE symbol
                    symbol = SymbolInfo(
                        name=name,
                        kind=SymbolKind.VARIABLE,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        signature=f"const {name}",
                        docstring=None,
                        references=[],
                    )
                    symbols.append(symbol)

                    if self._is_exported(node):
                        exports.append(name)

    def _extract_import(self, node: Node, content: bytes) -> ImportInfo | None:
        """Extract import information from an import_statement node.

        Args:
            node: import_statement node
            content: File content as bytes

        Returns:
            ImportInfo or None if extraction fails
        """
        names: list[str] = []
        source = ""
        is_relative = False

        for child in node.children:
            if child.type == "string":
                # Extract module path from string node
                source = self._get_node_text(child, content).strip("'\"")
                is_relative = source.startswith(".") or source.startswith("/")

            elif child.type == "import_clause":
                # Handle import clause (default import, named imports, namespace import)
                for clause_child in child.children:
                    if clause_child.type == "identifier":
                        # Default import
                        names.append(self._get_node_text(clause_child, content))

                    elif clause_child.type == "named_imports":
                        # Named imports: { a, b, c }
                        for spec in clause_child.children:
                            if spec.type == "import_specifier":
                                for spec_child in spec.children:
                                    if spec_child.type == "identifier":
                                        names.append(
                                            self._get_node_text(spec_child, content)
                                        )
                                        break

                    elif clause_child.type == "namespace_import":
                        # Namespace import: * as name
                        for ns_child in clause_child.children:
                            if ns_child.type == "identifier":
                                names.append(self._get_node_text(ns_child, content))
                                break

        if not source:
            return None

        return ImportInfo(
            source=source,
            names=names,
            is_relative=is_relative,
            line_number=node.start_point[0] + 1,
        )

    def _handle_export_statement(
        self,
        node: Node,
        file_path: str,
        content: bytes,
        symbols: list[SymbolInfo],
        imports: list[ImportInfo],
        exports: list[str],
    ) -> None:
        """Handle export statements and extract declarations.

        Args:
            node: export_statement node
            file_path: Path to the file
            content: File content as bytes
            symbols: List to append extracted symbols
            imports: List to append extracted imports
            exports: List to append exported names
        """
        for child in node.children:
            if child.type == "function_declaration":
                symbol = self._extract_function(child, file_path, content)
                symbols.append(symbol)
                exports.append(symbol.name)

            elif child.type == "class_declaration":
                symbol = self._extract_class(child, file_path, content)
                symbols.append(symbol)
                exports.append(symbol.name)
                # Extract methods from class body
                class_body = self._find_child_by_type(child, "class_body")
                if class_body:
                    for body_child in class_body.children:
                        if body_child.type == "method_definition":
                            method = self._extract_method(body_child, file_path, content)
                            symbols.append(method)

            elif child.type == "interface_declaration":
                symbol = self._extract_interface(child, file_path, content)
                symbols.append(symbol)
                exports.append(symbol.name)

            elif child.type == "lexical_declaration":
                self._extract_variable_declarations(
                    child, file_path, content, symbols, exports
                )

    def _build_function_signature(
        self, node: Node, content: bytes, name: str
    ) -> str:
        """Build a function signature string.

        Args:
            node: function_declaration node
            content: File content as bytes
            name: Function name

        Returns:
            Signature string
        """
        params = self._extract_parameters(node, content)
        return_type = self._extract_return_type(node, content)

        sig = f"function {name}({params})"
        if return_type:
            sig += f": {return_type}"
        return sig

    def _build_method_signature(self, node: Node, content: bytes, name: str) -> str:
        """Build a method signature string.

        Args:
            node: method_definition node
            content: File content as bytes
            name: Method name

        Returns:
            Signature string
        """
        params = self._extract_parameters(node, content)
        return_type = self._extract_return_type(node, content)

        sig = f"{name}({params})"
        if return_type:
            sig += f": {return_type}"
        return sig

    def _build_arrow_function_signature(
        self, node: Node, content: bytes, name: str
    ) -> str:
        """Build an arrow function signature string.

        Args:
            node: arrow_function node
            content: File content as bytes
            name: Variable name containing the arrow function

        Returns:
            Signature string
        """
        params = self._extract_parameters(node, content)
        return_type = self._extract_return_type(node, content)

        sig = f"const {name} = ({params})"
        if return_type:
            sig += f": {return_type}"
        sig += " => ..."
        return sig

    def _extract_parameters(self, node: Node, content: bytes) -> str:
        """Extract parameter list from a function-like node.

        Args:
            node: Node with formal_parameters child
            content: File content as bytes

        Returns:
            Parameter string
        """
        params_node = self._find_child_by_type(node, "formal_parameters")
        if params_node is None:
            return ""

        params = []
        for child in params_node.children:
            if child.type in [
                "required_parameter",
                "optional_parameter",
                "identifier",
            ]:
                param_text = self._get_node_text(child, content)
                params.append(param_text)

        return ", ".join(params)

    def _extract_return_type(self, node: Node, content: bytes) -> str | None:
        """Extract return type annotation from a function-like node.

        Args:
            node: Function-like node
            content: File content as bytes

        Returns:
            Return type string or None
        """
        for child in node.children:
            if child.type == "type_annotation":
                # Get the type from the annotation
                for type_child in child.children:
                    if type_child.type not in [":", "type_annotation"]:
                        return self._get_node_text(type_child, content)
        return None

    def _extract_jsdoc(self, node: Node, content: bytes) -> str | None:
        """Extract JSDoc comment preceding a node.

        Args:
            node: AST node
            content: File content as bytes

        Returns:
            JSDoc comment text or None
        """
        # Look for comment node before this one
        if node.prev_sibling and node.prev_sibling.type == "comment":
            comment = self._get_node_text(node.prev_sibling, content)
            if comment.startswith("/**"):
                # Extract content from JSDoc
                lines = comment.split("\n")
                cleaned = []
                for line in lines:
                    line = line.strip()
                    if line.startswith("/**"):
                        line = line[3:].strip()
                    if line.startswith("*/"):
                        continue
                    if line.startswith("*"):
                        line = line[1:].strip()
                    if line and not line.startswith("@"):
                        cleaned.append(line)
                return " ".join(cleaned) if cleaned else None
        return None

    def _is_exported(self, node: Node) -> bool:
        """Check if a node is part of an export statement.

        Args:
            node: AST node

        Returns:
            True if the node is exported
        """
        parent = node.parent
        while parent:
            if parent.type == "export_statement":
                return True
            parent = parent.parent
        return False

    def _find_child_by_type(self, node: Node, type_name: str) -> Node | None:
        """Find a child node by type.

        Args:
            node: Parent node
            type_name: Type of child to find

        Returns:
            Child node or None
        """
        for child in node.children:
            if child.type == type_name:
                return child
        return None

    def _get_node_text(self, node: Node, content: bytes) -> str:
        """Get the text content of a node.

        Args:
            node: AST node
            content: File content as bytes

        Returns:
            Node text as string
        """
        return content[node.start_byte : node.end_byte].decode("utf-8")
