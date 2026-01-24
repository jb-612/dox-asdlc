"""Unit tests for TypeScript AST Parser."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.workers.repo_mapper.models import SymbolKind
from src.workers.repo_mapper.parsers.typescript_parser import TypeScriptParser


class TestTypeScriptParserBasic:
    """Basic tests for TypeScriptParser."""

    def test_create_parser(self):
        """Test creating a TypeScriptParser instance."""
        parser = TypeScriptParser()
        assert parser is not None

    def test_supported_extensions(self):
        """Test that TypeScriptParser supports TS/JS file extensions."""
        parser = TypeScriptParser()
        extensions = parser.get_supported_extensions()
        assert ".ts" in extensions
        assert ".tsx" in extensions
        assert ".js" in extensions
        assert ".jsx" in extensions


class TestTypeScriptParserFunctions:
    """Tests for parsing TypeScript functions."""

    def test_parse_simple_function(self, tmp_path: Path):
        """Test parsing a simple function declaration."""
        content = '''function greet(): string {
    return "Hello";
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert parsed.path == str(file_path)
        assert parsed.language == "typescript"
        assert len(parsed.symbols) >= 1

        func = next(s for s in parsed.symbols if s.name == "greet")
        assert func.kind == SymbolKind.FUNCTION
        assert func.start_line == 1

    def test_parse_function_with_params(self, tmp_path: Path):
        """Test parsing a function with typed parameters."""
        content = '''function add(x: number, y: number): number {
    return x + y;
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        func = next(s for s in parsed.symbols if s.name == "add")
        assert func.name == "add"
        assert func.kind == SymbolKind.FUNCTION
        # Signature should include parameter types
        assert "number" in (func.signature or "")

    def test_parse_arrow_function_const(self, tmp_path: Path):
        """Test parsing an arrow function assigned to a const."""
        content = '''const multiply = (a: number, b: number): number => {
    return a * b;
};
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        # Should find the variable containing the arrow function
        func = next(s for s in parsed.symbols if s.name == "multiply")
        assert func is not None

    def test_parse_multiple_functions(self, tmp_path: Path):
        """Test parsing multiple functions in one file."""
        content = '''function first(): void {}
function second(): void {}
function third(): void {}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        func_symbols = [s for s in parsed.symbols if s.kind == SymbolKind.FUNCTION]
        assert len(func_symbols) == 3
        names = {s.name for s in func_symbols}
        assert names == {"first", "second", "third"}


class TestTypeScriptParserClasses:
    """Tests for parsing TypeScript classes."""

    def test_parse_simple_class(self, tmp_path: Path):
        """Test parsing a simple class."""
        content = '''class Person {
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        cls = next(s for s in parsed.symbols if s.kind == SymbolKind.CLASS)
        assert cls.name == "Person"
        assert cls.start_line == 1

    def test_parse_class_with_methods(self, tmp_path: Path):
        """Test parsing a class with methods."""
        content = '''class Calculator {
    add(x: number, y: number): number {
        return x + y;
    }

    subtract(x: number, y: number): number {
        return x - y;
    }
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        # Should find class and methods
        cls = next(s for s in parsed.symbols if s.kind == SymbolKind.CLASS)
        assert cls.name == "Calculator"

        methods = [s for s in parsed.symbols if s.kind == SymbolKind.METHOD]
        assert len(methods) == 2
        method_names = {m.name for m in methods}
        assert method_names == {"add", "subtract"}

    def test_parse_class_extending_base(self, tmp_path: Path):
        """Test parsing a class that extends another."""
        content = '''class Child extends Parent {
    constructor() {
        super();
    }
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        cls = next(s for s in parsed.symbols if s.kind == SymbolKind.CLASS)
        assert cls.name == "Child"
        # Signature should mention base class
        assert "Parent" in (cls.signature or "")


class TestTypeScriptParserInterfaces:
    """Tests for parsing TypeScript interfaces."""

    def test_parse_simple_interface(self, tmp_path: Path):
        """Test parsing a simple interface."""
        content = '''interface User {
    id: number;
    name: string;
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        iface = next(s for s in parsed.symbols if s.kind == SymbolKind.INTERFACE)
        assert iface.name == "User"
        assert iface.start_line == 1

    def test_parse_interface_with_methods(self, tmp_path: Path):
        """Test parsing an interface with method signatures."""
        content = '''interface Calculator {
    add(x: number, y: number): number;
    subtract(x: number, y: number): number;
}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        iface = next(s for s in parsed.symbols if s.kind == SymbolKind.INTERFACE)
        assert iface.name == "Calculator"


class TestTypeScriptParserImports:
    """Tests for parsing import statements."""

    def test_parse_named_imports(self, tmp_path: Path):
        """Test parsing named imports."""
        content = '''import { User, Role } from "./models";
import { helper } from "../utils";
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert len(parsed.imports) == 2

        models_import = next(i for i in parsed.imports if "models" in i.source)
        assert "User" in models_import.names
        assert "Role" in models_import.names
        assert models_import.is_relative

    def test_parse_default_import(self, tmp_path: Path):
        """Test parsing default imports."""
        content = '''import React from "react";
import express from "express";
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert len(parsed.imports) == 2

        react_import = next(i for i in parsed.imports if i.source == "react")
        assert "React" in react_import.names
        assert not react_import.is_relative

    def test_parse_star_import(self, tmp_path: Path):
        """Test parsing namespace (star) imports."""
        content = '''import * as fs from "fs";
import * as path from "path";
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert len(parsed.imports) >= 2

        fs_import = next(i for i in parsed.imports if i.source == "fs")
        assert "fs" in fs_import.names  # The alias name


class TestTypeScriptParserExports:
    """Tests for parsing export statements."""

    def test_exported_function(self, tmp_path: Path):
        """Test that exported functions are tracked."""
        content = '''export function greet(): string {
    return "Hello";
}

function helper(): void {}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert "greet" in parsed.exports
        # helper is not exported
        assert "helper" not in parsed.exports

    def test_exported_class(self, tmp_path: Path):
        """Test that exported classes are tracked."""
        content = '''export class User {
    name: string = "";
}

class InternalHelper {}
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert "User" in parsed.exports
        assert "InternalHelper" not in parsed.exports


class TestTypeScriptParserJSX:
    """Tests for parsing JSX/TSX components."""

    def test_parse_function_component(self, tmp_path: Path):
        """Test parsing a React function component."""
        content = '''import React from "react";

interface Props {
    name: string;
}

export function Greeting({ name }: Props): JSX.Element {
    return <div>Hello, {name}!</div>;
}
'''
        file_path = tmp_path / "test.tsx"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        # Should find the interface and the function
        iface = next((s for s in parsed.symbols if s.kind == SymbolKind.INTERFACE), None)
        assert iface is not None
        assert iface.name == "Props"

        func = next((s for s in parsed.symbols if s.name == "Greeting"), None)
        assert func is not None

    def test_parse_arrow_component(self, tmp_path: Path):
        """Test parsing an arrow function component."""
        content = '''import React from "react";

const Button: React.FC<{ label: string }> = ({ label }) => {
    return <button>{label}</button>;
};

export default Button;
'''
        file_path = tmp_path / "test.tsx"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        # Should find the Button component
        button = next((s for s in parsed.symbols if s.name == "Button"), None)
        assert button is not None


class TestTypeScriptParserEdgeCases:
    """Tests for edge cases and error handling."""

    def test_parse_empty_file(self, tmp_path: Path):
        """Test parsing an empty file."""
        file_path = tmp_path / "empty.ts"
        file_path.write_text("")

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert parsed.path == str(file_path)
        assert parsed.language == "typescript"
        assert parsed.symbols == []
        assert parsed.imports == []

    def test_parse_syntax_error_gracefully(self, tmp_path: Path):
        """Test that syntax errors are handled gracefully."""
        content = '''function broken( {
    // Missing closing paren and brace
    return "oops"
'''
        file_path = tmp_path / "broken.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()

        # Should handle syntax errors gracefully - either raise SyntaxError
        # or return partial results
        try:
            parsed = parser.parse_file(str(file_path))
            # If it doesn't raise, should still have valid structure
            assert parsed.path == str(file_path)
        except SyntaxError:
            # This is also acceptable behavior
            pass

    def test_file_not_found(self):
        """Test handling of non-existent files."""
        parser = TypeScriptParser()

        with pytest.raises(FileNotFoundError):
            parser.parse_file("/nonexistent/file.ts")

    def test_line_count(self, tmp_path: Path):
        """Test that line count is correct."""
        content = '''// line 1
// line 2
// line 3
// line 4
// line 5
'''
        file_path = tmp_path / "test.ts"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert parsed.line_count == 5

    def test_javascript_file(self, tmp_path: Path):
        """Test parsing a JavaScript file."""
        content = '''function greet(name) {
    return "Hello, " + name;
}

class Person {
    constructor(name) {
        this.name = name;
    }
}
'''
        file_path = tmp_path / "test.js"
        file_path.write_text(content)

        parser = TypeScriptParser()
        parsed = parser.parse_file(str(file_path))

        assert parsed.language == "javascript"
        assert len(parsed.symbols) >= 2

        func = next(s for s in parsed.symbols if s.name == "greet")
        assert func.kind == SymbolKind.FUNCTION

        cls = next(s for s in parsed.symbols if s.kind == SymbolKind.CLASS)
        assert cls.name == "Person"
