---
description: Coding standards for Python, TypeScript, and Bash
paths:
  - src/**
  - tests/**
  - tools/**
  - docker/hitl-ui/src/**
---

# Coding Standards

## Python (src/, tests/)

- **Line length**: 100 chars max
- **Type hints**: Required for all function signatures
- **Docstrings**: Google style for public functions
- **Imports**: isort ordering (stdlib, third-party, local)
- **Exceptions**: Use classes from `src/core/exceptions.py`, never catch bare `Exception`
- **Async**: Use `asyncio`, avoid blocking calls in async functions

```python
"""Module docstring."""
from __future__ import annotations

import asyncio
from src.core.interfaces import KnowledgeStore

async def process(task_id: str) -> Result:
    """Process a task.

    Args:
        task_id: The task identifier.

    Returns:
        Processing result.
    """
    ...
```

## TypeScript (docker/hitl-ui/)

- **Strict mode**: Required
- **Formatting**: prettier
- **Linting**: eslint with recommended rules
- **Prefer**: interfaces over type aliases for objects

## Bash (tools/)

- Start with: `#!/bin/bash` and `set -euo pipefail`
- Output JSON: `{ "success": bool, "results": [], "errors": [] }`
- Exit 0 on success, 1 on wrapper failure

## Tests

- One file per module: `test_{module}.py`
- Naming: `test_{function}_{scenario}_{outcome}()`
- Coverage minimum: 80%
