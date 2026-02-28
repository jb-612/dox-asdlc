"""Test tool setup and configuration."""

import os
from pathlib import Path


def test_pyproject_has_dev_dependencies() -> None:
    """Test that pyproject.toml has dev dependencies configured."""
    project_root = Path(__file__).parent.parent.parent
    pyproject = project_root / "pyproject.toml"
    content = pyproject.read_text()

    assert "[project.optional-dependencies]" in content
    assert "dev = [" in content

    required_tools = ["ruff", "pytest", "pytest-json-report", "bandit", "pip-audit"]
    for tool in required_tools:
        assert tool in content, f"Tool {tool} not found in pyproject.toml"


def test_parsers_directory_exists() -> None:
    """Test that tools/lib/parsers directory exists."""
    project_root = Path(__file__).parent.parent.parent
    parsers_dir = project_root / "tools" / "lib" / "parsers"
    assert parsers_dir.exists(), "tools/lib/parsers directory not found"
    assert parsers_dir.is_dir(), "tools/lib/parsers is not a directory"
