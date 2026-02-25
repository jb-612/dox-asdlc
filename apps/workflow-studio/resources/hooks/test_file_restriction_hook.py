#!/usr/bin/env python3
"""
Python unit tests for file-restriction-hook.py (P15-F03, T20)

Tests the main() function with controlled stdin and environment variables.
"""

import io
import json
import os
import sys
import unittest
from unittest.mock import patch

# Ensure the hook module is importable
sys.path.insert(0, os.path.dirname(__file__))

import importlib
file_restriction_hook = importlib.import_module("file-restriction-hook")
main = file_restriction_hook.main


class TestFileRestrictionHook(unittest.TestCase):
    """Unit tests for the file restriction PreToolUse hook."""

    def _run_with_stdin(self, payload: dict, restrictions=None):
        """Run main() with the given payload on stdin and optional restrictions."""
        stdin_data = json.dumps(payload)
        env_patch = {}
        if restrictions is not None:
            env_patch["FILE_RESTRICTIONS"] = json.dumps(restrictions)
        else:
            # Ensure the env var is NOT set
            env_patch["FILE_RESTRICTIONS"] = ""

        with patch("sys.stdin", io.StringIO(stdin_data)), \
             patch.dict(os.environ, env_patch, clear=False):
            # Remove FILE_RESTRICTIONS from env if we want it unset
            if restrictions is None and "FILE_RESTRICTIONS" in os.environ:
                del os.environ["FILE_RESTRICTIONS"]
            return main()

    def test_allows_write_when_pattern_matches(self):
        result = self._run_with_stdin(
            {"tool": "Write", "arguments": {"file_path": "src/main/index.ts"}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 0)

    def test_blocks_write_when_no_pattern_matches(self):
        result = self._run_with_stdin(
            {"tool": "Write", "arguments": {"file_path": "docs/README.md"}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 2)

    def test_allows_edit_when_pattern_matches(self):
        result = self._run_with_stdin(
            {"tool": "Edit", "arguments": {"file_path": "src/utils/helper.ts"}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 0)

    def test_blocks_edit_when_no_pattern_matches(self):
        result = self._run_with_stdin(
            {"tool": "Edit", "arguments": {"file_path": "config.json"}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 2)

    def test_allows_non_write_edit_tools_regardless(self):
        result = self._run_with_stdin(
            {"tool": "Read", "arguments": {"file_path": "docs/README.md"}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 0)

    def test_allows_all_when_restrictions_empty(self):
        result = self._run_with_stdin(
            {"tool": "Write", "arguments": {"file_path": "anything.txt"}},
            restrictions=[],
        )
        self.assertEqual(result, 0)

    def test_allows_all_when_restrictions_not_set(self):
        result = self._run_with_stdin(
            {"tool": "Write", "arguments": {"file_path": "anything.txt"}},
            restrictions=None,
        )
        self.assertEqual(result, 0)

    def test_multiple_patterns_or_logic(self):
        result = self._run_with_stdin(
            {"tool": "Write", "arguments": {"file_path": "test/main/foo.test.ts"}},
            restrictions=["src/**/*.ts", "test/**/*.ts"],
        )
        self.assertEqual(result, 0)

    def test_handles_missing_file_path(self):
        result = self._run_with_stdin(
            {"tool": "Write", "arguments": {}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 0)

    def test_handles_malformed_stdin(self):
        """Malformed JSON on stdin should fail-open (exit 0)."""
        with patch("sys.stdin", io.StringIO("not json")):
            result = main()
        self.assertEqual(result, 0)

    def test_handles_malformed_restrictions(self):
        """Malformed FILE_RESTRICTIONS env var should fail-open (exit 0)."""
        stdin_data = json.dumps(
            {"tool": "Write", "arguments": {"file_path": "src/foo.ts"}}
        )
        with patch("sys.stdin", io.StringIO(stdin_data)), \
             patch.dict(os.environ, {"FILE_RESTRICTIONS": "not json"}, clear=False):
            result = main()
        self.assertEqual(result, 0)

    def test_bash_tool_is_allowed(self):
        """Bash tool should not be restricted by file patterns."""
        result = self._run_with_stdin(
            {"tool": "Bash", "arguments": {"command": "rm -rf /"}},
            restrictions=["src/**/*.ts"],
        )
        self.assertEqual(result, 0)


if __name__ == "__main__":
    unittest.main()
