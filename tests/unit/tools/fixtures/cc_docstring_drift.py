"""Test fixture: functions with WRONG CC = N annotations (drift)."""


def claims_one_but_is_two(x):
    """This says CC = 1 but has a branch."""
    if x > 0:
        return x
    return 0


def claims_five_but_is_two(x):
    """Check something. CC = 5."""
    if x:
        return True
    return False


def no_annotation(x, y):
    """No CC annotation at all."""
    if x > y:
        return x
    return y


def correct_annotation(x):
    """This one is right. CC = 2."""
    if x:
        return x
    return None
