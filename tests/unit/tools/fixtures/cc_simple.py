"""Test fixture: simple functions with CC=1 (no branching)."""


def linear_function():
    """A simple linear function. CC = 1."""
    x = 1
    y = 2
    return x + y


def another_linear():
    """Another linear function with assignments. CC = 1."""
    name = "hello"
    result = name.upper()
    parts = result.split("L")
    return parts


async def async_linear():
    """Async function with no branching. CC = 1."""
    value = await some_coroutine()
    return value


class SimpleClass:
    """Class with simple methods."""

    def __init__(self):
        """Initialize. CC = 1."""
        self.value = 0

    def get_value(self):
        """Return value. CC = 1."""
        return self.value


async def some_coroutine():
    """Stub coroutine. CC = 1."""
    return 42
