"""Main Repo Mapper class for context pack generation."""

from __future__ import annotations

import json
import logging
import subprocess
from datetime import datetime
from pathlib import Path

from src.core.exceptions import RepoMapperError
from src.workers.repo_mapper.config import RepoMapperConfig
from src.workers.repo_mapper.context_builder import ContextBuilder
from src.workers.repo_mapper.dependency_graph import DependencyGraph
from src.workers.repo_mapper.models import ASTContext, ContextPack, FileContent
from src.workers.repo_mapper.parsers import ParserRegistry, get_parser_for_file
from src.workers.repo_mapper.token_counter import TokenCounter

logger = logging.getLogger(__name__)


class RepoMapper:
    """Main class for generating context packs from repository structure."""

    DEFAULT_EXCLUDE_PATTERNS = ["*.pyc", "__pycache__/*", ".git/*", "node_modules/*", ".venv/*", "venv/*", "*.egg-info/*", ".pytest_cache/*"]
    DEFAULT_MAX_FILE_SIZE_KB = 1024

    def __init__(self, repo_path: str, config: RepoMapperConfig | None = None, exclude_patterns: list[str] | None = None, max_file_size_kb: int | None = None) -> None:
        self.repo_path = repo_path
        self.config = config or RepoMapperConfig.from_env()
        self.exclude_patterns = exclude_patterns or self.DEFAULT_EXCLUDE_PATTERNS
        self.max_file_size_kb = max_file_size_kb or self.DEFAULT_MAX_FILE_SIZE_KB
        self._parser_registry = ParserRegistry.default()
        self._ast_context: ASTContext | None = None

    async def generate_context_pack(self, task_id: str, task_description: str, target_files: list[str], role: str, token_budget: int = 100_000) -> ContextPack:
        """Generate a context pack for the given task."""
        if self._ast_context is None:
            self._ast_context = await self.refresh_ast_context(self.repo_path)
        context_builder = ContextBuilder.with_defaults()
        for parsed_file in self._ast_context.files.values():
            context_builder.add_parsed_file(parsed_file)
        selected_files = context_builder.build_context(task_description=task_description, target_files=target_files, token_budget=token_budget, role=role)
        relevance_scores = context_builder.get_relevance_scores(target_files=target_files, task_description=task_description)
        files, symbols, token_counter, total_tokens = [], [], TokenCounter(), 0
        for file_path, parsed_file in selected_files.items():
            files.append(FileContent(path=file_path, content=parsed_file.raw_content, language=parsed_file.language))
            symbols.extend(parsed_file.symbols)
            total_tokens += token_counter.count_tokens(parsed_file.raw_content)
        return ContextPack(task_id=task_id, role=role, git_sha=self._ast_context.git_sha, files=files, symbols=symbols, dependencies=[], metadata={"task_description": task_description, "target_files": target_files, "repo_path": self.repo_path, "generated_at": datetime.now().isoformat()}, token_count=total_tokens, relevance_scores={fp: relevance_scores.get(fp, 0.0) for fp in selected_files.keys()})

    async def refresh_ast_context(self, repo_path: str) -> ASTContext:
        """Refresh the cached AST context for a repository."""
        repo = Path(repo_path)
        if not repo.exists():
            raise RepoMapperError(f"Repository path does not exist: {repo_path}")
        git_sha = await self._get_git_sha(repo_path)
        parsed_files, dependency_graph = {}, DependencyGraph()
        for file_path in repo.rglob("*"):
            if not file_path.is_file() or file_path.suffix not in self._parser_registry.list_supported_extensions():
                continue
            if self._is_excluded(file_path) or file_path.stat().st_size / 1024 > self.max_file_size_kb:
                continue
            try:
                parser = get_parser_for_file(file_path)
                if parser:
                    relative_path = str(file_path.relative_to(repo))
                    parsed_file = parser.parse_file(str(file_path))
                    parsed_file.path = relative_path
                    for symbol in parsed_file.symbols:
                        symbol.file_path = relative_path
                    parsed_files[relative_path] = parsed_file
                    dependency_graph.add_file(parsed_file)
            except Exception:
                pass
        token_counter = TokenCounter()
        token_estimate = sum(token_counter.count_tokens(pf.raw_content) for pf in parsed_files.values())
        self._ast_context = ASTContext(repo_path=repo_path, git_sha=git_sha, files=parsed_files, dependency_graph=dependency_graph.to_dict(), created_at=datetime.now(), token_estimate=token_estimate)
        return self._ast_context

    async def save_context_pack(self, context_pack: ContextPack, output_path: str) -> None:
        """Save a context pack to a JSON file."""
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        with open(output, "w") as f:
            json.dump(context_pack.to_dict(), f, indent=2)

    async def _get_git_sha(self, repo_path: str) -> str:
        """Get the current Git SHA for a repository."""
        try:
            result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo_path, capture_output=True, text=True, check=True)
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return "unknown"

    def _is_excluded(self, file_path: Path) -> bool:
        """Check if a file should be excluded."""
        return any(file_path.match(pattern) for pattern in self.exclude_patterns)
