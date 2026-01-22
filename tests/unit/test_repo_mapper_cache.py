"""Unit tests for AST Context Cache."""

from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

import pytest

from src.workers.repo_mapper.cache import ASTContextCache
from src.workers.repo_mapper.models import ASTContext, ParsedFile


@pytest.fixture
def temp_cache_dir():
    """Provide a temporary directory for cache storage."""
    with TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_ast_context():
    """Provide a sample AST context for testing."""
    return ASTContext(
        repo_path="/test/repo",
        git_sha="abc123def456",
        files={
            "test.py": ParsedFile(
                path="test.py",
                language="python",
                symbols=[],
                imports=[],
                exports=[],
                raw_content="# test file",
                line_count=10,
            )
        },
        dependency_graph={},
        created_at=datetime.now(),
        token_estimate=500,
    )


class TestASTContextCache:
    """Test suite for ASTContextCache."""

    def test_cache_miss_returns_none(self, temp_cache_dir):
        """Test that get() returns None when cache is empty."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir))
        result = cache.get("/nonexistent/repo")
        assert result is None

    def test_save_and_get_context(self, temp_cache_dir, sample_ast_context):
        """Test that saved context can be retrieved."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir))

        # Save context
        cache.save(sample_ast_context)

        # Retrieve context
        result = cache.get("/test/repo")

        assert result is not None
        assert result.repo_path == sample_ast_context.repo_path
        assert result.git_sha == sample_ast_context.git_sha
        assert len(result.files) == 1
        assert "test.py" in result.files

    def test_get_with_expired_ttl_returns_none(
        self, temp_cache_dir, sample_ast_context
    ):
        """Test that expired cache entries return None."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir), ttl_hours=1)

        # Save context
        cache.save(sample_ast_context)

        # Simulate time passing by modifying created_at in saved data
        old_context = sample_ast_context
        old_context.created_at = datetime.now() - timedelta(hours=2)
        cache.save(old_context)

        # Attempt to retrieve - should be expired
        result = cache.get("/test/repo")

        assert result is None

    def test_get_with_valid_ttl_returns_context(
        self, temp_cache_dir, sample_ast_context
    ):
        """Test that non-expired cache entries are returned."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir), ttl_hours=24)

        # Save context with recent timestamp
        sample_ast_context.created_at = datetime.now()
        cache.save(sample_ast_context)

        # Retrieve - should be valid
        result = cache.get("/test/repo")

        assert result is not None
        assert result.git_sha == "abc123def456"

    def test_invalidate_on_sha_change(self, temp_cache_dir, sample_ast_context):
        """Test that cache invalidates when Git SHA changes."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir))

        # Save context with old SHA
        cache.save(sample_ast_context)

        # Mock git SHA check to return different SHA
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(
                stdout="new_sha_789\n", returncode=0
            )

            # Get should detect SHA mismatch and return None
            result = cache.get("/test/repo", validate_sha=True)

            assert result is None

    def test_invalidate_clears_cache(self, temp_cache_dir, sample_ast_context):
        """Test that invalidate() removes cached data."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir))

        # Save context
        cache.save(sample_ast_context)
        assert cache.get("/test/repo") is not None

        # Invalidate
        cache.invalidate("/test/repo")

        # Should be gone
        assert cache.get("/test/repo") is None

    def test_partial_invalidation_for_changed_files(
        self, temp_cache_dir, sample_ast_context
    ):
        """Test that partial invalidation removes only specified files."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir))

        # Add multiple files to context
        sample_ast_context.files["test2.py"] = ParsedFile(
            path="test2.py",
            language="python",
            symbols=[],
            imports=[],
            exports=[],
            raw_content="# test file 2",
            line_count=20,
        )
        cache.save(sample_ast_context)

        # Partially invalidate one file
        cache.partial_invalidate("/test/repo", ["test.py"])

        # Get context
        result = cache.get("/test/repo")

        # test.py should be removed, test2.py should remain
        assert result is not None
        assert "test.py" not in result.files
        assert "test2.py" in result.files

    def test_cache_dir_created_if_missing(self):
        """Test that cache directory is created if it doesn't exist."""
        with TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "cache" / "nested"
            cache = ASTContextCache(cache_dir=str(cache_path))

            # Cache dir should be created
            assert cache_path.exists()
            assert cache_path.is_dir()

    def test_malformed_cache_file_returns_none(
        self, temp_cache_dir, sample_ast_context
    ):
        """Test that corrupted cache files are handled gracefully."""
        cache = ASTContextCache(cache_dir=str(temp_cache_dir))

        # Save valid context
        cache.save(sample_ast_context)

        # Corrupt the cache file
        cache_file = temp_cache_dir / cache._get_cache_filename("/test/repo")
        cache_file.write_text("invalid json {{{")

        # Should handle corruption gracefully
        result = cache.get("/test/repo")
        assert result is None
