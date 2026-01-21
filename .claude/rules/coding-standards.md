# Coding Standards Rules

## Language: Python

Primary implementation language for this project is Python 3.11+.

### Style Guide

Follow PEP 8 with these project-specific additions:

1. **Line length**: 100 characters maximum
2. **Imports**: Use `isort` ordering (stdlib, third-party, local)
3. **Type hints**: Required for all function signatures
4. **Docstrings**: Google style for all public functions and classes

### File Organization

```python
"""Module docstring describing purpose."""

from __future__ import annotations

# Standard library imports
import asyncio
from pathlib import Path

# Third-party imports
import redis
from pydantic import BaseModel

# Local imports
from src.core.interfaces import KnowledgeStore

# Constants
DEFAULT_TIMEOUT = 30

# Type aliases
TaskId = str

# Classes and functions
class MyClass:
    """Class docstring."""
    pass
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Modules | snake_case | `repo_mapper.py` |
| Classes | PascalCase | `RepoMapperAgent` |
| Functions | snake_case | `generate_context_pack` |
| Constants | SCREAMING_SNAKE | `MAX_SUBCALLS` |
| Type aliases | PascalCase | `TaskId` |

### Error Handling

1. Use custom exception classes defined in `src/core/exceptions.py`
2. Never catch bare `Exception` unless re-raising
3. Log errors with context before raising
4. Use `Result` types for expected failure modes

```python
# Good
try:
    result = await process_task(task_id)
except TaskNotFoundError as e:
    logger.error(f"Task {task_id} not found: {e}")
    raise
except ProcessingError as e:
    return Result.failure(f"Processing failed: {e}")

# Bad
try:
    result = await process_task(task_id)
except Exception:
    pass  # Never do this
```

### Async Patterns

1. Use `asyncio` for I/O-bound operations
2. Use `anyio` for compatibility with multiple async backends
3. Always use `async with` for context managers
4. Avoid blocking calls in async functions

```python
# Good
async def fetch_document(doc_id: str) -> Document:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

# Bad - blocks the event loop
async def fetch_document(doc_id: str) -> Document:
    response = requests.get(url)  # Blocking!
    return response.json()
```

## Language: TypeScript (HITL UI)

For the HITL Web UI, use TypeScript with strict mode.

### Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### Style Guide

1. Use `prettier` for formatting
2. Use `eslint` with recommended rules
3. Prefer interfaces over type aliases for objects
4. Use `readonly` for immutable properties

## Bash Scripts

### Tool Wrapper Contract

All bash tool wrappers must follow this contract:

```bash
#!/bin/bash
set -euo pipefail

# Input: Arguments as specified per tool
# Output: JSON to stdout with schema:
#   { "success": true|false, "results": [...], "errors": [...] }
# Exit: 0 on wrapper success (even if tool reports failures in JSON)
#       1 on wrapper failure (unable to execute)
```

### Standard Template

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

main() {
    local input_path="${1:-}"
    
    if [[ -z "$input_path" ]]; then
        emit_error "Missing required argument: input_path"
        exit 1
    fi
    
    # Tool execution
    local result
    result=$(run_tool "$input_path") || true
    
    # Emit standardized JSON
    emit_result "$result"
}

main "$@"
```

## Testing Standards

### Unit Tests

1. One test file per module: `test_{module_name}.py`
2. Use `pytest` with async support
3. Test coverage minimum: 80%
4. Mock external dependencies

### Integration Tests

1. Test component interactions
2. Use real Redis instance (Docker)
3. Use test fixtures for data setup

### E2E Tests

1. Test full workflows
2. Run against containerized environment
3. Validate artifact generation

### Test Naming

```python
def test_{function_name}_{scenario}_{expected_outcome}():
    """Test that {function} {does what} when {condition}."""
    pass

# Example
def test_generate_context_pack_large_repo_respects_token_limit():
    """Test that generate_context_pack respects token limits for large repos."""
    pass
```
