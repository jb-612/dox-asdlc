"""Test fixture: functions with moderate complexity (CC=2,3,5)."""


def single_if(x):
    """One if statement. CC = 2."""
    if x > 0:
        return "positive"
    return "non-positive"


def if_else_chain(x):
    """If-elif chain. CC = 3."""
    if x > 0:
        return "positive"
    elif x < 0:
        return "negative"
    return "zero"


def loop_with_condition(items):
    """For loop with inner if. CC = 3."""
    total = 0
    for item in items:
        if item > 0:
            total += item
    return total


def compound_condition(a, b, c):
    """Compound boolean with and/or. CC = 3."""
    if a and b:
        return True
    return c


def while_with_break(items):
    """While loop with break condition. CC = 3."""
    i = 0
    while i < len(items):
        if items[i] is None:
            break
        i += 1
    return i


def at_threshold(x, items):
    """Exactly at CC=5 threshold. CC = 5."""
    if x > 0:
        for item in items:
            if item > x:
                return item
            elif item == x:
                continue
    return None
