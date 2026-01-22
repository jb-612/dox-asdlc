"""Tests for RepoMapper main class."""
from pathlib import Path
import json
import pytest
from src.workers.repo_mapper.mapper import RepoMapper
from src.workers.repo_mapper.models import ContextPack

@pytest.fixture
def simple_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "test_repo"
    repo.mkdir()
    (repo / "main.py").write_text('def main():\n    print("Hello")\n')
    return repo

class TestRepoMapperInit:
    def test_init_with_repo_path(self, simple_repo: Path) -> None:
        mapper = RepoMapper(repo_path=str(simple_repo))
        assert mapper.repo_path == str(simple_repo) and mapper.config is not None

class TestRefreshASTContext:
    @pytest.mark.asyncio
    async def test_refresh_parses_repository(self, simple_repo: Path) -> None:
        mapper = RepoMapper(repo_path=str(simple_repo))
        context = await mapper.refresh_ast_context(str(simple_repo))
        assert context is not None and len(context.files) > 0 and "main.py" in context.files

class TestGenerateContextPack:
    @pytest.mark.asyncio
    async def test_generate_basic_context_pack(self, simple_repo: Path) -> None:
        mapper = RepoMapper(repo_path=str(simple_repo))
        result = await mapper.generate_context_pack(task_id="task-123", task_description="Implement main function", target_files=["main.py"], role="coding", token_budget=10000)
        assert isinstance(result, ContextPack) and result.task_id == "task-123" and len(result.files) > 0

    @pytest.mark.asyncio
    async def test_generate_respects_token_budget(self, simple_repo: Path) -> None:
        mapper = RepoMapper(repo_path=str(simple_repo))
        result = await mapper.generate_context_pack(task_id="task-budget", task_description="Test", target_files=["main.py"], role="coding", token_budget=500)
        assert result.token_count <= 500

class TestSaveContextPack:
    @pytest.mark.asyncio
    async def test_save_writes_json_file(self, simple_repo: Path, tmp_path: Path) -> None:
        mapper = RepoMapper(repo_path=str(simple_repo))
        context_pack = await mapper.generate_context_pack(task_id="task-save", task_description="Test", target_files=["main.py"], role="coding", token_budget=10000)
        output_path = tmp_path / "context_pack.json"
        await mapper.save_context_pack(context_pack, str(output_path))
        assert output_path.exists()
        with open(output_path) as f:
            data = json.load(f)
        assert data["task_id"] == "task-save"

    @pytest.mark.asyncio
    async def test_save_creates_parent_directories(self, simple_repo: Path, tmp_path: Path) -> None:
        mapper = RepoMapper(repo_path=str(simple_repo))
        context_pack = await mapper.generate_context_pack(task_id="task-dirs", task_description="Test", target_files=["main.py"], role="coding", token_budget=10000)
        output_path = tmp_path / "nested" / "dir" / "pack.json"
        await mapper.save_context_pack(context_pack, str(output_path))
        assert output_path.exists()
