"""Unit tests for the RepoIngester service.

Tests cover:
- IngestionConfig dataclass and from_env method
- IngestionResult dataclass and to_dict method
- Chunking logic (_chunk_content)
- File filtering logic (_should_include_file)
- Path validation for security
- File size validation
- Single file ingestion
- Repository walk and batch indexing
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.exceptions import IngestionError
from src.infrastructure.repo_ingestion.config import IngestionConfig
from src.infrastructure.repo_ingestion.models import IngestionResult


class TestIngestionConfig:
    """Tests for IngestionConfig dataclass."""

    def test_default_include_extensions(self) -> None:
        """Test default include_extensions contains expected file types."""
        config = IngestionConfig()
        expected = {".py", ".ts", ".js", ".tsx", ".jsx", ".md", ".yaml", ".yml",
                    ".json", ".sh", ".toml", ".html", ".css"}
        assert expected.issubset(config.include_extensions)

    def test_default_exclude_patterns(self) -> None:
        """Test default exclude_patterns contains expected patterns."""
        config = IngestionConfig()
        expected_patterns = {
            "**/node_modules/**",
            "**/__pycache__/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
        }
        assert expected_patterns.issubset(config.exclude_patterns)

    def test_default_max_chunk_size(self) -> None:
        """Test default max_chunk_size is 4000 characters."""
        config = IngestionConfig()
        assert config.max_chunk_size == 4000

    def test_default_overlap_lines(self) -> None:
        """Test default overlap_lines is 5."""
        config = IngestionConfig()
        assert config.overlap_lines == 5

    def test_default_max_file_size_bytes(self) -> None:
        """Test default max_file_size_bytes is 10MB."""
        config = IngestionConfig()
        assert config.max_file_size_bytes == 10_000_000

    def test_config_is_frozen(self) -> None:
        """Test that IngestionConfig is immutable."""
        config = IngestionConfig()
        with pytest.raises(AttributeError):
            config.max_chunk_size = 8000  # type: ignore

    def test_from_env_default_values(self) -> None:
        """Test from_env returns defaults when env vars not set."""
        with patch.dict(os.environ, {}, clear=True):
            config = IngestionConfig.from_env()
            assert config.max_chunk_size == 4000
            assert config.overlap_lines == 5
            assert config.max_file_size_bytes == 10_000_000

    def test_from_env_with_custom_values(self) -> None:
        """Test from_env reads environment variables."""
        env_vars = {
            "INGESTION_MAX_CHUNK_SIZE": "8000",
            "INGESTION_OVERLAP_LINES": "10",
            "INGESTION_MAX_FILE_SIZE_BYTES": "5000000",
        }
        with patch.dict(os.environ, env_vars, clear=False):
            config = IngestionConfig.from_env()
            assert config.max_chunk_size == 8000
            assert config.overlap_lines == 10
            assert config.max_file_size_bytes == 5000000


class TestIngestionResult:
    """Tests for IngestionResult dataclass."""

    def test_to_dict_serialization(self) -> None:
        """Test to_dict returns proper dictionary structure."""
        result = IngestionResult(
            files_processed=10,
            documents_created=15,
            files_skipped=3,
            errors=[("path/to/file.py", "Permission denied")],
            duration_seconds=1.5,
        )
        d = result.to_dict()
        assert d["files_processed"] == 10
        assert d["documents_created"] == 15
        assert d["files_skipped"] == 3
        assert d["errors"] == [("path/to/file.py", "Permission denied")]
        assert d["duration_seconds"] == 1.5

    def test_empty_result(self) -> None:
        """Test result with zero counts."""
        result = IngestionResult(
            files_processed=0,
            documents_created=0,
            files_skipped=0,
            errors=[],
            duration_seconds=0.0,
        )
        d = result.to_dict()
        assert d["files_processed"] == 0
        assert d["errors"] == []

    def test_result_is_frozen(self) -> None:
        """Test that IngestionResult is immutable."""
        result = IngestionResult(
            files_processed=10,
            documents_created=15,
            files_skipped=3,
            errors=[],
            duration_seconds=1.5,
        )
        with pytest.raises(AttributeError):
            result.files_processed = 20  # type: ignore


class TestChunkContent:
    """Tests for _chunk_content method."""

    def test_small_content_no_chunking(self) -> None:
        """Test content smaller than max_chars returns single chunk."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig(max_chunk_size=4000, overlap_lines=5)
        ingester = RepoIngester(store=MagicMock(), config=config)

        content = "Line 1\nLine 2\nLine 3"
        chunks = ingester._chunk_content(content, max_chars=4000)
        assert len(chunks) == 1
        assert chunks[0] == content

    def test_large_content_multiple_chunks(self) -> None:
        """Test large content is split into multiple chunks."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig(max_chunk_size=100, overlap_lines=2)
        ingester = RepoIngester(store=MagicMock(), config=config)

        # Create content larger than max_chars
        lines = [f"Line {i} with some content" for i in range(20)]
        content = "\n".join(lines)
        chunks = ingester._chunk_content(content, max_chars=100)

        assert len(chunks) > 1
        # All content should be represented
        full_reconstructed = set()
        for chunk in chunks:
            for line in chunk.split("\n"):
                full_reconstructed.add(line)
        for line in lines:
            assert line in full_reconstructed

    def test_chunk_overlap_preservation(self) -> None:
        """Test that chunks have overlapping lines for context."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig(max_chunk_size=100, overlap_lines=2)
        ingester = RepoIngester(store=MagicMock(), config=config)

        lines = [f"Line {i}" for i in range(20)]
        content = "\n".join(lines)
        chunks = ingester._chunk_content(content, max_chars=100)

        # Check that there's overlap between consecutive chunks
        if len(chunks) > 1:
            chunk1_lines = chunks[0].split("\n")
            chunk2_lines = chunks[1].split("\n")
            # Last lines of chunk 1 should appear in chunk 2
            overlap_found = False
            for line in chunk1_lines[-2:]:
                if line in chunk2_lines:
                    overlap_found = True
                    break
            assert overlap_found, "Expected overlap between chunks"

    def test_chunk_respects_line_boundaries(self) -> None:
        """Test that chunks don't split in the middle of a line."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig(max_chunk_size=50, overlap_lines=1)
        ingester = RepoIngester(store=MagicMock(), config=config)

        content = "This is a long line that should not be split\nSecond line\nThird line"
        chunks = ingester._chunk_content(content, max_chars=50)

        for chunk in chunks:
            # Each chunk should contain complete lines only
            lines = chunk.split("\n")
            for line in lines:
                assert line in content.split("\n") or line == ""

    def test_empty_content(self) -> None:
        """Test empty content returns single empty chunk."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        chunks = ingester._chunk_content("", max_chars=4000)
        assert len(chunks) == 1
        assert chunks[0] == ""


class TestFileFiltering:
    """Tests for _should_include_file method."""

    def test_include_python_file(self) -> None:
        """Test Python files are included."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("src/module.py") is True

    def test_include_markdown_file(self) -> None:
        """Test Markdown files are included."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("docs/README.md") is True

    def test_include_typescript_file(self) -> None:
        """Test TypeScript files are included."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("src/app.ts") is True
        assert ingester._should_include_file("src/component.tsx") is True

    def test_exclude_pyc_file(self) -> None:
        """Test .pyc files are excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("module.pyc") is False

    def test_exclude_node_modules(self) -> None:
        """Test node_modules directory is excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("node_modules/package/index.js") is False

    def test_exclude_pycache(self) -> None:
        """Test __pycache__ directory is excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("src/__pycache__/module.cpython-311.pyc") is False

    def test_exclude_venv(self) -> None:
        """Test .venv and venv directories are excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file(".venv/lib/python3.11/site.py") is False
        assert ingester._should_include_file("venv/bin/activate") is False

    def test_exclude_unknown_extension(self) -> None:
        """Test files with unknown extensions are excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("file.xyz") is False
        assert ingester._should_include_file("binary.exe") is False

    def test_exclude_image_files(self) -> None:
        """Test image files are excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file("logo.png") is False
        assert ingester._should_include_file("icon.jpg") is False
        assert ingester._should_include_file("image.gif") is False

    def test_exclude_git_directory(self) -> None:
        """Test .git directory is excluded."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        assert ingester._should_include_file(".git/objects/pack/data") is False


class TestPathValidation:
    """Tests for path traversal prevention."""

    def test_valid_path_within_repo(self) -> None:
        """Test valid path inside repository returns True."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a file inside the repo
            file_path = os.path.join(tmpdir, "subdir", "file.py")
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            Path(file_path).touch()

            assert ingester._validate_path_within_repo(file_path, tmpdir) is True

    def test_invalid_path_outside_repo(self) -> None:
        """Test path outside repository returns False."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        with tempfile.TemporaryDirectory() as repo_dir:
            with tempfile.TemporaryDirectory() as outside_dir:
                outside_file = os.path.join(outside_dir, "secret.py")
                Path(outside_file).touch()

                assert ingester._validate_path_within_repo(outside_file, repo_dir) is False

    def test_path_traversal_attack_blocked(self) -> None:
        """Test path traversal with .. is blocked."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create repo structure
            repo_dir = os.path.join(tmpdir, "repo")
            os.makedirs(repo_dir)

            # Try to escape with ../
            traversal_path = os.path.join(repo_dir, "..", "secret.txt")

            # realpath resolves the ..
            assert ingester._validate_path_within_repo(traversal_path, repo_dir) is False

    def test_symlink_escape_blocked(self) -> None:
        """Test symlink pointing outside repo is blocked."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig()
        ingester = RepoIngester(store=MagicMock(), config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create repo and outside directories
            repo_dir = os.path.join(tmpdir, "repo")
            outside_dir = os.path.join(tmpdir, "outside")
            os.makedirs(repo_dir)
            os.makedirs(outside_dir)

            # Create a secret file outside
            secret_file = os.path.join(outside_dir, "secret.txt")
            Path(secret_file).write_text("secret")

            # Create symlink in repo pointing outside
            symlink_path = os.path.join(repo_dir, "link_to_secret.txt")
            os.symlink(secret_file, symlink_path)

            assert ingester._validate_path_within_repo(symlink_path, repo_dir) is False


class TestFileSizeValidation:
    """Tests for file size checking."""

    def test_file_within_size_limit(self) -> None:
        """Test file within size limit returns True."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig(max_file_size_bytes=1000)
        ingester = RepoIngester(store=MagicMock(), config=config)

        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 500)
            f.flush()
            try:
                assert ingester._check_file_size(f.name) is True
            finally:
                os.unlink(f.name)

    def test_file_exceeds_size_limit(self) -> None:
        """Test file exceeding size limit returns False."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        config = IngestionConfig(max_file_size_bytes=100)
        ingester = RepoIngester(store=MagicMock(), config=config)

        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 500)
            f.flush()
            try:
                assert ingester._check_file_size(f.name) is False
            finally:
                os.unlink(f.name)


class TestSingleFileIngestion:
    """Tests for ingest_file method."""

    @pytest.mark.asyncio
    async def test_ingest_small_file_single_document(self) -> None:
        """Test ingesting small file creates single document."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        mock_store.index_document = AsyncMock(return_value="doc-id")

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "test.py")
            Path(file_path).write_text("print('hello')")

            doc_ids = await ingester.ingest_file(file_path, tmpdir)

            assert len(doc_ids) == 1
            assert mock_store.index_document.called

    @pytest.mark.asyncio
    async def test_ingest_large_file_multiple_documents(self) -> None:
        """Test ingesting large file creates multiple documents."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        mock_store.index_document = AsyncMock(return_value="doc-id")

        config = IngestionConfig(max_chunk_size=50, overlap_lines=1)
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "large.py")
            content = "\n".join([f"line {i}" for i in range(50)])
            Path(file_path).write_text(content)

            doc_ids = await ingester.ingest_file(file_path, tmpdir)

            assert len(doc_ids) > 1

    @pytest.mark.asyncio
    async def test_doc_id_format(self) -> None:
        """Test document ID follows {relative_path}:{chunk_index} format."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        indexed_docs = []

        async def capture_doc(doc):
            indexed_docs.append(doc)
            return doc.doc_id

        mock_store.index_document = capture_doc

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            subdir = os.path.join(tmpdir, "src")
            os.makedirs(subdir)
            file_path = os.path.join(subdir, "module.py")
            Path(file_path).write_text("code")

            doc_ids = await ingester.ingest_file(file_path, tmpdir)

            assert len(doc_ids) == 1
            assert doc_ids[0] == "src/module.py:0"

    @pytest.mark.asyncio
    async def test_metadata_in_indexed_document(self) -> None:
        """Test indexed document contains proper metadata."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        indexed_docs = []

        async def capture_doc(doc):
            indexed_docs.append(doc)
            return doc.doc_id

        mock_store.index_document = capture_doc

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "test.py")
            Path(file_path).write_text("code")

            await ingester.ingest_file(file_path, tmpdir)

            assert len(indexed_docs) == 1
            doc = indexed_docs[0]
            assert doc.metadata["file_path"] == "test.py"
            assert doc.metadata["file_type"] == ".py"
            assert doc.metadata["chunk_index"] == 0
            assert doc.metadata["total_chunks"] == 1

    @pytest.mark.asyncio
    async def test_file_read_error_handling(self) -> None:
        """Test file read errors are handled gracefully."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "nonexistent.py")

            with pytest.raises(IngestionError) as exc_info:
                await ingester.ingest_file(file_path, tmpdir)

            assert exc_info.value.file_path == file_path


class TestEncodingHandling:
    """Tests for file encoding handling."""

    @pytest.mark.asyncio
    async def test_utf8_file_read(self) -> None:
        """Test UTF-8 encoded files are read correctly."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        indexed_docs = []

        async def capture_doc(doc):
            indexed_docs.append(doc)
            return doc.doc_id

        mock_store.index_document = capture_doc

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "utf8.py")
            content = "# Unicode: \u00e9\u00e0\u00fc\u00f1"
            Path(file_path).write_text(content, encoding="utf-8")

            await ingester.ingest_file(file_path, tmpdir)

            assert len(indexed_docs) == 1
            assert "\u00e9\u00e0\u00fc\u00f1" in indexed_docs[0].content

    @pytest.mark.asyncio
    async def test_latin1_fallback(self) -> None:
        """Test latin-1 fallback for non-UTF-8 files."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        indexed_docs = []

        async def capture_doc(doc):
            indexed_docs.append(doc)
            return doc.doc_id

        mock_store.index_document = capture_doc

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = os.path.join(tmpdir, "latin1.py")
            # Write latin-1 encoded content
            content_bytes = b"# Comment with \xe9\xe0\xfc"  # Invalid UTF-8
            with open(file_path, "wb") as f:
                f.write(content_bytes)

            await ingester.ingest_file(file_path, tmpdir)

            assert len(indexed_docs) == 1


class TestRepositoryWalk:
    """Tests for ingest_repository method."""

    @pytest.mark.asyncio
    async def test_process_all_matching_files(self) -> None:
        """Test all matching files are processed."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        mock_store.index_document = AsyncMock(return_value="doc-id")

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test files
            Path(os.path.join(tmpdir, "file1.py")).write_text("code1")
            Path(os.path.join(tmpdir, "file2.py")).write_text("code2")
            subdir = os.path.join(tmpdir, "subdir")
            os.makedirs(subdir)
            Path(os.path.join(subdir, "file3.py")).write_text("code3")

            result = await ingester.ingest_repository(tmpdir)

            assert result.files_processed == 3
            assert result.documents_created == 3

    @pytest.mark.asyncio
    async def test_skip_excluded_patterns(self) -> None:
        """Test excluded patterns are skipped."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        mock_store.index_document = AsyncMock(return_value="doc-id")

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create included file
            Path(os.path.join(tmpdir, "included.py")).write_text("code")

            # Create excluded files
            pycache = os.path.join(tmpdir, "__pycache__")
            os.makedirs(pycache)
            Path(os.path.join(pycache, "module.pyc")).write_text("bytecode")

            result = await ingester.ingest_repository(tmpdir)

            assert result.files_processed == 1
            assert result.files_skipped >= 1

    @pytest.mark.asyncio
    async def test_error_collection(self) -> None:
        """Test errors are collected properly."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()

        async def fail_on_specific_file(doc):
            if "fail" in doc.doc_id:
                raise Exception("Simulated failure")
            return doc.doc_id

        mock_store.index_document = fail_on_specific_file

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            Path(os.path.join(tmpdir, "good.py")).write_text("code")
            Path(os.path.join(tmpdir, "fail.py")).write_text("code")

            result = await ingester.ingest_repository(tmpdir)

            assert len(result.errors) == 1
            assert "fail.py" in result.errors[0][0]

    @pytest.mark.asyncio
    async def test_correct_result_counts(self) -> None:
        """Test result counts are accurate."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        mock_store.index_document = AsyncMock(return_value="doc-id")

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            # 2 Python files
            Path(os.path.join(tmpdir, "a.py")).write_text("code")
            Path(os.path.join(tmpdir, "b.py")).write_text("code")
            # 1 unknown extension (skipped)
            Path(os.path.join(tmpdir, "c.xyz")).write_text("data")

            result = await ingester.ingest_repository(tmpdir)

            assert result.files_processed == 2
            assert result.files_skipped == 1

    @pytest.mark.asyncio
    async def test_duration_tracking(self) -> None:
        """Test duration is tracked."""
        from src.infrastructure.repo_ingestion.ingester import RepoIngester

        mock_store = AsyncMock()
        mock_store.index_document = AsyncMock(return_value="doc-id")

        config = IngestionConfig()
        ingester = RepoIngester(store=mock_store, config=config)

        with tempfile.TemporaryDirectory() as tmpdir:
            Path(os.path.join(tmpdir, "test.py")).write_text("code")

            result = await ingester.ingest_repository(tmpdir)

            assert result.duration_seconds >= 0


class TestIngestionError:
    """Tests for IngestionError exception."""

    def test_ingestion_error_with_file_path(self) -> None:
        """Test IngestionError stores file_path."""
        error = IngestionError(
            "Failed to read file",
            file_path="/path/to/file.py",
        )
        assert error.file_path == "/path/to/file.py"
        assert error.message == "Failed to read file"

    def test_ingestion_error_with_cause(self) -> None:
        """Test IngestionError stores cause exception."""
        cause = ValueError("Invalid encoding")
        error = IngestionError(
            "Failed to process file",
            file_path="/path/to/file.py",
            cause=cause,
        )
        assert error.cause is cause

    def test_ingestion_error_inherits_from_asdlc_error(self) -> None:
        """Test IngestionError inherits from ASDLCError."""
        from src.core.exceptions import ASDLCError

        error = IngestionError("test")
        assert isinstance(error, ASDLCError)
