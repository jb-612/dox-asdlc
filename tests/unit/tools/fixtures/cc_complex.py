"""Test fixture: complex function exceeding threshold (CC=7+)."""


def complex_dispatcher(event, config, mode):
    """Process events with multiple branches. CC = 8."""
    if not event:
        return None

    if mode == "strict":
        if event.get("type") == "error":
            if config.get("raise_on_error"):
                raise ValueError("strict error")
            return {"status": "error"}
        elif event.get("type") == "warning":
            return {"status": "warning"}
    else:
        for handler in config.get("handlers", []):
            if handler.matches(event):
                return handler.process(event)

    return {"status": "unhandled"}


def nested_try_except(data, retries):
    """Multiple exception handlers. CC = 5."""
    for attempt in range(retries):
        try:
            result = process(data)
            return result
        except ValueError:
            continue
        except TypeError:
            return None
        except Exception:
            break
    return "failed"


def comprehension_with_filters(items):
    """Comprehension with filter conditions. CC = 3."""
    return [
        x * 2
        for x in items
        if x > 0
        if x % 2 == 0
    ]


def ternary_chain(a, b, c):
    """Inline ternary expressions. CC = 3."""
    return a if a > 0 else (b if b > 0 else c)


def with_and_assert(path, expected):
    """With statement and assert. CC = 3."""
    with open(path) as f:
        data = f.read()
    assert data == expected
    return data


def process(data):
    """Stub. CC = 1."""
    return data
