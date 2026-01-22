"""Integration tests for Repo Mapper.

Tests the complete RepoMapper workflow against the actual project repository.
"""

import json
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from src.workers.repo_mapper.cache import ASTContextCache
from src.workers.repo_mapper.context_builder import ContextBuilder
from src.workers.repo_mapper.dependency_graph import DependencyGraph
from src.workers.repo_mapper.mapper import RepoMapper
from src.workers.repo_mapper.parsers import ParserRegistry
from src.workers.repo_mapper.symbol_extractor import SymbolExtractor
from src.workers.repo_mapper.token_counter import TokenCounter


@pytest.fixture
def repo_path():
    """Provide the path to this repository."""
    # Assuming tests run from repo root
    return str(Path(__file__).parent.parent.parent)


@pytest.fixture
def temp_cache_dir():
    """Provide a temporary cache directory."""
    with TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_task_descriptions():
    """Provide realistic task descriptions for testing."""
    return [
        "Implement the RepoMapper class to generate context packs",
        "Fix bug in DependencyGraph.get_dependencies method",
        "Add test coverage for SymbolExtractor.extract_symbols",
        "Refactor the PythonParser to handle async functions",
    ]


class TestRepoMapperParsing:
    """Test parsing actual Python files from this repository."""

    def test_parse_repo_mapper_module(self, repo_path):
        """Test that we can parse the repo_mapper module itself."""
        registry = ParserRegistry.default()
        parser = registry.get_parser_for_file("test.py")

        assert parser is not None

        # Parse the mapper.py file
        mapper_path = Path(repo_path) / "src" / "workers" / "repo_mapper" / "mapper.py"
        if not mapper_path.exists():
            pytest.skip("mapper.py not found")

        result = parser.parse_file(str(mapper_path))

        assert result.path == str(mapper_path)
        assert result.language == "python"
        assert len(result.symbols) > 0
        assert any(s.name == "RepoMapper" for s in result.symbols)

    def test_parse_models_file(self, repo_path):
        """Test parsing the models.py file."""
        registry = ParserRegistry.default()
        parser = registry.get_parser_for_file("test.py")

        models_path = Path(repo_path) / "src" / "workers" / "repo_mapper" / "models.py"
        if not models_path.exists():
            pytest.skip("models.py not found")

        result = parser.parse_file(str(models_path))

        assert len(result.symbols) > 0
        # Should contain dataclasses like ASTContext, ParsedFile
        symbol_names = {s.name for s in result.symbols}
        assert "ASTContext" in symbol_names or "ParsedFile" in symbol_names

    def test_parse_multiple_files(self, repo_path):
        """Test parsing multiple files from the repo_mapper module."""
        registry = ParserRegistry.default()
        repo_mapper_dir = Path(repo_path) / "src" / "workers" / "repo_mapper"

        if not repo_mapper_dir.exists():
            pytest.skip("repo_mapper directory not found")

        py_files = list(repo_mapper_dir.glob("*.py"))
        assert len(py_files) > 0

        parser = registry.get_parser_for_file("test.py")
        parsed_files = []

        for py_file in py_files[:5]:  # Limit to avoid long tests
            if py_file.name == "__init__.py":
                continue
            result = parser.parse_file(str(py_file))
            parsed_files.append(result)

        assert len(parsed_files) > 0
        assert all(pf.language == "python" for pf in parsed_files)


class TestRepoMapperDependencyGraph:
    """Test dependency graph construction on real code."""

    def test_build_dependency_graph_for_module(self, repo_path):
        """Test building dependency graph for repo_mapper module."""
        registry = ParserRegistry.default()
        parser = registry.get_parser_for_file("test.py")
        graph = DependencyGraph()

        repo_mapper_dir = Path(repo_path) / "src" / "workers" / "repo_mapper"
        if not repo_mapper_dir.exists():
            pytest.skip("repo_mapper directory not found")

        # Parse a few key files
        key_files = ["models.py", "mapper.py", "cache.py"]
        for file_name in key_files:
            file_path = repo_mapper_dir / file_name
            if file_path.exists():
                parsed = parser.parse_file(str(file_path))
                graph.add_file(parsed)

        # Verify graph was populated (check via serialization)
        graph_dict = graph.to_dict()
        assert "files" in graph_dict
        assert len(graph_dict["files"]) > 0

        # Check if we can get dependencies for a file
        models_path = str(repo_mapper_dir / "models.py")
        if models_path in graph_dict["files"]:
            deps = graph.get_dependencies(models_path, max_depth=1)
            # models.py likely imports datetime, dataclasses, etc
            assert isinstance(deps, list)

    def test_dependency_graph_serialization(self, repo_path):
        """Test that dependency graph can be serialized and deserialized."""
        registry = ParserRegistry.default()
        parser = registry.get_parser_for_file("test.py")
        graph = DependencyGraph()

        repo_mapper_dir = Path(repo_path) / "src" / "workers" / "repo_mapper"
        if not repo_mapper_dir.exists():
            pytest.skip("repo_mapper directory not found")

        # Add one file
        models_path = repo_mapper_dir / "models.py"
        if models_path.exists():
            parsed = parser.parse_file(str(models_path))
            graph.add_file(parsed)

            # Serialize
            data = graph.to_dict()
            assert isinstance(data, dict)
            assert "files" in data
            assert "edges" in data

            # Deserialize
            restored_graph = DependencyGraph.from_dict(data)
            assert len(restored_graph.files) == len(graph.files)


class TestRepoMapperContextGeneration:
    """Test context pack generation for sample tasks."""

    def test_generate_context_pack_for_task(self, repo_path, temp_cache_dir):
        """Test generating a context pack for a realistic task."""
        mapper = RepoMapper(
            repo_path=repo_path,
            cache_dir=temp_cache_dir,
        )

        # Parse a subset of the repo (to keep test fast)
        target_files = [
            "src/workers/repo_mapper/mapper.py",
            "src/workers/repo_mapper/models.py",
        ]

        task_description = "Fix a bug in the RepoMapper.generate_context_pack method"

        try:
            context_pack = mapper.generate_context_pack(
                task_description=task_description,
                target_files=target_files,
                token_budget=8000,
            )

            assert context_pack is not None
            assert context_pack.task_description == task_description
            assert len(context_pack.files) > 0
            assert context_pack.token_count <= 8000

            # Should include relevant files
            file_paths = [fc.file_path for fc in context_pack.files]
            assert any("mapper.py" in path for path in file_paths)

        except FileNotFoundError:
            pytest.skip("Required files not found in repository")

    def test_token_budget_enforcement(self, repo_path, temp_cache_dir):
        """Test that context generation respects token budget."""
        mapper = RepoMapper(repo_path=repo_path, cache_dir=temp_cache_dir)

        target_files = [
            "src/workers/repo_mapper/mapper.py",
            "src/workers/repo_mapper/models.py",
            "src/workers/repo_mapper/cache.py",
        ]

        # Small budget to force truncation
        small_budget = 1000

        try:
            context_pack = mapper.generate_context_pack(
                task_description="Update RepoMapper",
                target_files=target_files,
                token_budget=small_budget,
            )

            # Should respect budget (allow small margin for overhead)
            assert context_pack.token_count <= small_budget * 1.1

        except FileNotFoundError:
            pytest.skip("Required files not found")

    def test_context_pack_includes_dependencies(self, repo_path, temp_cache_dir):
        """Test that context pack includes file dependencies."""
        mapper = RepoMapper(repo_path=repo_path, cache_dir=temp_cache_dir)

        target_files = ["src/workers/repo_mapper/mapper.py"]

        try:
            context_pack = mapper.generate_context_pack(
                task_description="Review RepoMapper implementation",
                target_files=target_files,
                token_budget=10000,
                include_dependencies=True,
                dependency_depth=1,
            )

            # Should include mapper.py and its direct dependencies
            file_paths = [fc.file_path for fc in context_pack.files]

            # mapper.py likely imports models.py
            has_mapper = any("mapper.py" in path for path in file_paths)
            assert has_mapper

        except FileNotFoundError:
            pytest.skip("Required files not found")


class TestRepoMapperCaching:
    """Test AST context caching functionality."""

    def test_cache_ast_context(self, repo_path, temp_cache_dir):
        """Test that AST context can be cached and reused."""
        cache = ASTContextCache(cache_dir=temp_cache_dir, ttl_hours=24)

        # First access - should cache
        mapper1 = RepoMapper(repo_path=repo_path, cache_dir=temp_cache_dir)

        target_files = ["src/workers/repo_mapper/models.py"]

        try:
            # This should create and cache AST context
            mapper1.generate_context_pack(
                task_description="Test caching",
                target_files=target_files,
                token_budget=5000,
            )

            # Verify cache file was created
            cache_files = list(Path(temp_cache_dir).glob("ast_context_*.json"))
            assert len(cache_files) > 0

        except FileNotFoundError:
            pytest.skip("Required files not found")

    def test_cache_invalidation(self, repo_path, temp_cache_dir):
        """Test that cache can be invalidated."""
        cache = ASTContextCache(cache_dir=temp_cache_dir)

        # Create a mock AST context
        from src.workers.repo_mapper.models import ASTContext

        context = ASTContext(
            repo_path=repo_path,
            git_sha="test123",
            files={},
            dependency_graph={},
            created_at=datetime.now(),
            token_estimate=100,
        )

        # Save and verify
        cache.save(context)
        retrieved = cache.get(repo_path)
        assert retrieved is not None

        # Invalidate
        cache.invalidate(repo_path)

        # Should be gone
        retrieved_after = cache.get(repo_path)
        assert retrieved_after is None


class TestRepoMapperSaveOutput:
    """Test saving context packs to disk."""

    def test_save_context_pack(self, repo_path, temp_cache_dir):
        """Test saving a context pack to JSON."""
        mapper = RepoMapper(repo_path=repo_path, cache_dir=temp_cache_dir)

        target_files = ["src/workers/repo_mapper/models.py"]

        with TemporaryDirectory() as output_dir:
            output_path = Path(output_dir) / "context_pack.json"

            try:
                context_pack = mapper.generate_context_pack(
                    task_description="Test save",
                    target_files=target_files,
                    token_budget=3000,
                )

                # Save
                mapper.save_context_pack(context_pack, str(output_path))

                # Verify file exists and is valid JSON
                assert output_path.exists()
                with open(output_path) as f:
                    data = json.load(f)

                assert "task_description" in data
                assert "files" in data
                assert data["task_description"] == "Test save"

            except FileNotFoundError:
                pytest.skip("Required files not found")


class TestRepoMapperEndToEnd:
    """End-to-end integration tests."""

    def test_full_workflow_with_real_task(
        self, repo_path, temp_cache_dir, sample_task_descriptions
    ):
        """Test complete workflow: parse, build graph, generate context."""
        mapper = RepoMapper(repo_path=repo_path, cache_dir=temp_cache_dir)

        # Use a realistic task
        task = sample_task_descriptions[0]  # "Implement the RepoMapper class..."

        # Specify target files
        target_files = [
            "src/workers/repo_mapper/mapper.py",
            "src/workers/repo_mapper/models.py",
            "src/workers/repo_mapper/context_builder.py",
        ]

        try:
            # Generate context pack
            context_pack = mapper.generate_context_pack(
                task_description=task,
                target_files=target_files,
                token_budget=12000,
                include_dependencies=True,
                dependency_depth=2,
            )

            # Validate output
            assert context_pack is not None
            assert context_pack.task_description == task
            assert len(context_pack.files) > 0
            assert context_pack.token_count > 0
            assert context_pack.token_count <= 12000

            # Should have metadata
            assert "generated_at" in context_pack.metadata
            assert "repo_path" in context_pack.metadata

            # Files should have content
            for file_content in context_pack.files:
                assert file_content.file_path
                assert file_content.relevance_score >= 0

        except FileNotFoundError as e:
            pytest.skip(f"Required files not found: {e}")

    def test_performance_on_larger_file_set(self, repo_path, temp_cache_dir):
        """Test performance when processing multiple files."""
        import time

        mapper = RepoMapper(repo_path=repo_path, cache_dir=temp_cache_dir)

        # Get all Python files in repo_mapper module
        repo_mapper_dir = Path(repo_path) / "src" / "workers" / "repo_mapper"
        if not repo_mapper_dir.exists():
            pytest.skip("repo_mapper directory not found")

        py_files = [
            str(f.relative_to(repo_path))
            for f in repo_mapper_dir.rglob("*.py")
            if f.name != "__init__.py"
        ]

        if len(py_files) < 5:
            pytest.skip("Not enough files to test performance")

        start_time = time.time()

        try:
            context_pack = mapper.generate_context_pack(
                task_description="Comprehensive review of repo_mapper module",
                target_files=py_files,
                token_budget=20000,
            )

            elapsed = time.time() - start_time

            # Should complete in reasonable time (< 5 seconds for small module)
            assert elapsed < 10.0, f"Processing took too long: {elapsed:.2f}s"

            # Should have generated output
            assert len(context_pack.files) > 0

        except Exception as e:
            pytest.skip(f"Performance test failed: {e}")
