# P03-F02: Repo Mapper - Context Pack Generation - Tasks

## Overview

Task breakdown for implementing the Repo Mapper context pack generator.

## Dependencies

- **P03-F01**: ContextPack model, AgentRole - (implement in parallel)
- **P01-F02**: AST tool wrapper - COMPLETE

## Task List

### T01: Define Repo Mapper data models

**File:** `src/workers/repo_mapper/models.py`
**Test:** `tests/unit/test_repo_mapper_models.py`

- [x] Define `SymbolKind` enum (FUNCTION, CLASS, INTERFACE, VARIABLE, etc.)
- [x] Define `SymbolInfo` dataclass
- [x] Define `ImportInfo` dataclass
- [x] Define `ParsedFile` dataclass
- [x] Define `DependencyInfo` dataclass
- [x] Define `ASTContext` dataclass
- [x] Add JSON serialization methods
- [x] Write unit tests for all models

**Estimate:** 1h

---

### T02: Implement Python AST Parser

**File:** `src/workers/repo_mapper/parsers/python_parser.py`
**Test:** `tests/unit/test_python_parser.py`

- [x] Create `PythonParser` class implementing `ASTParser` protocol
- [x] Parse functions with signatures and docstrings
- [x] Parse classes with methods and bases
- [x] Parse import statements (absolute and relative)
- [x] Extract type hints from annotations
- [x] Handle syntax errors gracefully
- [x] Write unit tests with Python fixtures

**Estimate:** 2h

---

### T03: Implement TypeScript AST Parser

**File:** `src/workers/repo_mapper/parsers/typescript_parser.py`
**Test:** `tests/unit/test_typescript_parser.py`

- [x] Create `TypeScriptParser` class implementing `ASTParser` protocol
- [x] Install and configure tree-sitter with TypeScript grammar
- [x] Parse functions and arrow functions
- [x] Parse classes and interfaces
- [x] Parse import/export statements
- [x] Handle JSX components
- [x] Write unit tests with TypeScript fixtures

**Estimate:** 2h

---

### T04: Implement Parser Registry

**File:** `src/workers/repo_mapper/parsers/__init__.py`
**Test:** `tests/unit/test_parser_registry.py`

- [x] Create `ParserRegistry` class
- [x] Register Python parser for `.py` files
- [x] Register TypeScript parser for `.ts`, `.tsx`, `.js`, `.jsx`
- [x] Implement `get_parser_for_file()` method
- [x] Handle unknown file types gracefully
- [x] Write unit tests

**Estimate:** 30min

---

### T05: Implement DependencyGraph

**File:** `src/workers/repo_mapper/dependency_graph.py`
**Test:** `tests/unit/test_dependency_graph.py`

- [x] Create `DependencyGraph` class
- [x] Implement `add_file()` to build graph from parsed files
- [x] Implement `get_dependencies()` with depth limit
- [x] Implement `get_dependents()` with depth limit
- [x] Resolve relative imports to absolute paths
- [x] Handle circular dependencies
- [x] Implement graph serialization
- [x] Write unit tests with graph fixtures

**Estimate:** 2h

---

### T06: Implement SymbolExtractor

**File:** `src/workers/repo_mapper/symbol_extractor.py`
**Test:** `tests/unit/test_symbol_extractor.py`

- [x] Create `SymbolExtractor` class
- [x] Extract symbols from task description (regex + heuristics)
- [x] Match symbols against parsed repository
- [x] Find related symbols (implementations, usages)
- [x] Score symbol relevance
- [x] Write unit tests

**Estimate:** 1.5h

---

### T07: Implement TokenCounter

**File:** `src/workers/repo_mapper/token_counter.py`
**Test:** `tests/unit/test_token_counter.py`

- [x] Create `TokenCounter` class using tiktoken
- [x] Count tokens for text content
- [x] Count tokens for ContextPack
- [x] Provide estimates for symbol signatures
- [x] Cache counts for repeated content
- [x] Write unit tests

**Estimate:** 1h

---

### T08: Implement ContextBuilder

**File:** `src/workers/repo_mapper/context_builder.py`
**Test:** `tests/unit/test_context_builder.py`

- [x] Create `ContextBuilder` class
- [x] Inject DependencyGraph, SymbolExtractor, TokenCounter
- [x] Implement relevance scoring algorithm
- [x] Implement content selection with budget
- [x] Support role-specific filtering
- [x] Truncate low-relevance content when over budget
- [x] Write unit tests with complex scenarios

**Estimate:** 2h

---

### T09: Implement RepoMapper main class

**File:** `src/workers/repo_mapper/mapper.py`
**Test:** `tests/unit/test_repo_mapper.py`

- [x] Create `RepoMapper` class
- [x] Implement `generate_context_pack()` method
- [x] Implement `refresh_ast_context()` method
- [x] Implement `save_context_pack()` to write JSON
- [x] Load AST context from cache when available
- [x] Validate inputs and outputs
- [x] Write unit tests

**Estimate:** 1.5h

---

### T10: Implement AST Context Caching

**File:** `src/workers/repo_mapper/cache.py`
**Test:** `tests/unit/test_repo_mapper_cache.py`

- [x] Create `ASTContextCache` class
- [x] Implement `get()` with TTL check
- [x] Implement `save()` to persist cache
- [x] Implement `invalidate()` on Git SHA change
- [x] Support partial invalidation for changed files
- [x] Write unit tests

**Estimate:** 1h

---

### T11: Integration tests for Repo Mapper

**File:** `tests/integration/test_repo_mapper.py`

- [x] Test parsing this repository's Python files
- [x] Test dependency graph for real code
- [x] Test context pack generation for sample tasks
- [x] Verify token budget enforcement
- [x] Test cache invalidation

**Estimate:** 2h

---

### T12: Add Repo Mapper exceptions and configuration

**Files:** `src/core/exceptions.py`, `src/workers/repo_mapper/config.py`

- [x] Add `RepoMapperError` exception
- [x] Add `ParseError` exception
- [x] Add `DependencyResolutionError` exception
- [x] Create `RepoMapperConfig` dataclass
- [x] Load from environment variables
- [x] Document configuration options

**Estimate:** 30min

---

## Progress

- **Started**: 2026-01-22
- **Completed**: 2026-01-24
- **Tasks Complete**: 12/12
- **Percentage**: 100%
- **Status**: COMPLETE
- **Blockers**: None

## Task Summary

| Task | Description | Estimate | Status |
|------|-------------|----------|--------|
| T01 | Data models | 1h | [x] |
| T02 | Python AST Parser | 2h | [x] |
| T03 | TypeScript AST Parser | 2h | [x] |
| T04 | Parser Registry | 30min | [x] |
| T05 | DependencyGraph | 2h | [x] |
| T06 | SymbolExtractor | 1.5h | [x] |
| T07 | TokenCounter | 1h | [x] |
| T08 | ContextBuilder | 2h | [x] |
| T09 | RepoMapper main class | 1.5h | [x] |
| T10 | AST Context Caching | 1h | [x] |
| T11 | Integration tests | 2h | [x] |
| T12 | Exceptions and configuration | 30min | [x] |

**Total Estimated Time**: 16 hours

## Completion Checklist

- [x] All tasks in Task List are marked complete
- [x] All unit tests pass: `./tools/test.sh tests/unit/`
- [x] All integration tests pass: `./tools/test.sh tests/integration/`
- [ ] Linter passes: `./tools/lint.sh src/`
- [ ] No type errors: `mypy src/`
- [ ] Documentation updated
- [ ] Interface contracts verified against design.md
- [x] Progress marked as 100% in tasks.md
