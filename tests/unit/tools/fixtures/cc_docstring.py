"""Test fixture: functions with correct CC = N annotations."""


def simple_func():
    """Do something simple. CC = 1."""
    return 42


def branching_func(x):
    """Check a condition. CC = 2."""
    if x > 0:
        return x
    return 0


def loop_func(items):
    """Iterate with condition. CC = 3."""
    total = 0
    for item in items:
        if item > 0:
            total += item
    return total


class Annotated:
    """Class with annotated methods."""

    def method_one(self):
        """Simple method. CC = 1."""
        return self

    def method_two(self, x, y):
        """Method with branch. CC = 2."""
        if x > y:
            return x
        return y
