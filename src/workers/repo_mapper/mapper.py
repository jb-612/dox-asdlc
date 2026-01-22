"""RepoMapper - Main interface for context pack generation.

The RepoMapper orchestrates all components to generate context packs for agent tasks.
"""

import logging
import subprocess
from pathlib import Path
from typing import Optional

from src.core.exceptions import RepoMapperError
from src.core.models import AgentRole, ContextPack, FileContent
from src.workers.repo_mapper.cache import ASTContextCache
from src.workers.repo_mapper.config import get_repo_mapper_config
from src.workers.repo_mapper.context_builder import ContextBuilder
from src.workers.repo_mapper.dependency_graph import DependencyGraph
from src.workers.repo_mapper.models import ASTContext
from src.workers.repo_mapper.parsers import ParserRegistry
from src.workers.repo_mapper.symbol_extractor import SymbolExtractor
from src.workers.repo_mapper.token_counter import TokenCounter

logger = logging.getLogger(__name__)


class RepoMapper:
    """Generates context packs for agent tasks.

    Attributes:
        repo_path: Path to the repository root
        cache_dir: Directory for caching AST contexts
        config: RepoMapper configuration
        cache: AST context cache instance
        token_counter: Token counting utility
        symbol_extractor: Symbol extraction utility
    """

    def __init__(
        self,
        repo_path: str,
        cache_dir: Optional[str] = None,
    ):
        """Initialize RepoMapper.

        Args:
            repo_path: Path to the repository root
            cache_dir: Optional cache directory (defaults to config value)
        """
        self.repo_path = Path(repo_path).resolve()
        self.config = get_repo_mapper_config()

        if not self.repo_path.exists():
            raise RepoMapperError(f"Repository path does not exist: {repo_path}")

        # Initialize components
        cache_path = cache_dir or str(self.config.context_pack_dir / ".cache")
        self.cache = ASTContextCache(
            cache_dir=cache_path,
            ttl_hours=self.config.ast_cache_ttl // 3600,  # Convert seconds to hours
        )
        self.token_counter = TokenCounter()
        self.symbol_extractor = SymbolExtractor()

        logger.info(f"RepoMapper initialized for {self.repo_path}")

    def generate_context_pack(
        self,
        task_description: str,
        target_files: Optional[list[str]] = None,
        role: AgentRole = AgentRole.CODING,
        token_budget: int = 100_000,
        include_dependencies: bool = True,
        dependency_depth: int = 2,
    ) -> ContextPack:
        """Generate a context pack for the given task.

        Args:
            task_description: Natural language description of the task
            target_files: Files directly relevant to the task (optional)
            role: Agent role for role-specific context selection
            token_budget: Maximum tokens for context pack
            include_dependencies: Whether to include file dependencies
            dependency_depth: Maximum depth for dependency traversal

        Returns:
            ContextPack with relevant code and symbols

        Raises:
            RepoMapperError: If context generation fails
        """
        logger.info(f"Generating context pack for task: {task_description[:100]}")

        try:
            # Get or build AST context
            ast_context = self._get_or_build_ast_context()

            # Build dependency graph
            dep_graph = DependencyGraph.from_dict(ast_context.dependency_graph)

            # Create context builder
            builder = ContextBuilder(
                dependency_graph=dep_graph,
                symbol_extractor=self.symbol_extractor,
                token_counter=self.token_counter,
            )

            # Add all parsed files to builder
            for parsed_file in ast_context.files.values():
                builder.add_parsed_file(parsed_file)

            # Select relevant files
            if target_files:
                # Convert to absolute paths
                target_paths = [
                    str((self.repo_path / f).resolve()) for f in target_files
                ]
            else:
                target_paths = []

            # Build context (returns dict[str, ParsedFile])
            selected_files = builder.build_context(
                target_files=target_paths,
                task_description=task_description,
                token_budget=token_budget,
                role=role.value if isinstance(role, AgentRole) else role,
            )

            # Get relevance scores
            relevance_scores = builder.get_relevance_scores(
                target_paths, task_description
            )

            # Convert to FileContent objects
            file_contents = []
            for file_path, parsed_file in selected_files.items():
                score = relevance_scores.get(file_path, 0.5)
                file_content = FileContent(
                    file_path=file_path,
                    content=parsed_file.raw_content,
                    relevance_score=score,
                    symbols=[s.name for s in parsed_file.symbols],
                )
                file_contents.append(file_content)

            # Calculate actual token count
            total_tokens = sum(
                self.token_counter.count_tokens(fc.content) for fc in file_contents
            )

            # Get current Git SHA
            git_sha = self._get_git_sha()

            # Create context pack
            context_pack = ContextPack(
                task_description=task_description,
                files=file_contents,
                role=role,
                token_count=total_tokens,
                token_budget=token_budget,
                metadata={
                    "repo_path": str(self.repo_path),
                    "git_sha": git_sha,
                    "generated_at": ast_context.created_at.isoformat(),
                    "dependency_depth": dependency_depth,
                    "include_dependencies": include_dependencies,
                },
            )

            logger.info(
                f"Context pack generated: {len(file_contents)} files, "
                f"{total_tokens} tokens"
            )

            return context_pack

        except Exception as e:
            logger.error(f"Failed to generate context pack: {e}")
            raise RepoMapperError(f"Context generation failed: {e}") from e

    def refresh_ast_context(self) -> ASTContext:
        """Refresh the cached AST context for the repository.

        Called when repository content changes significantly.

        Returns:
            Newly generated ASTContext

        Raises:
            RepoMapperError: If refresh fails
        """
        logger.info(f"Refreshing AST context for {self.repo_path}")

        try:
            # Invalidate existing cache
            self.cache.invalidate(str(self.repo_path))

            # Build new context
            ast_context = self._build_ast_context()

            # Cache it
            self.cache.save(ast_context)

            logger.info("AST context refreshed successfully")
            return ast_context

        except Exception as e:
            logger.error(f"Failed to refresh AST context: {e}")
            raise RepoMapperError(f"AST context refresh failed: {e}") from e

    def save_context_pack(self, context_pack: ContextPack, output_path: str) -> None:
        """Save a context pack to a JSON file.

        Args:
            context_pack: Context pack to save
            output_path: Path to output file

        Raises:
            RepoMapperError: If save fails
        """
        try:
            import json

            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)

            with open(output_file, "w") as f:
                json.dump(context_pack.to_dict(), f, indent=2, default=str)

            logger.info(f"Context pack saved to {output_path}")

        except Exception as e:
            logger.error(f"Failed to save context pack: {e}")
            raise RepoMapperError(f"Save failed: {e}") from e

    def _get_or_build_ast_context(self) -> ASTContext:
        """Get AST context from cache or build if not cached.

        Returns:
            ASTContext instance
        """
        # Try to get from cache
        cached = self.cache.get(str(self.repo_path), validate_sha=False)

        if cached is not None:
            logger.debug("Using cached AST context")
            return cached

        logger.debug("Building new AST context")
        ast_context = self._build_ast_context()

        # Save to cache
        self.cache.save(ast_context)

        return ast_context

    def _build_ast_context(self) -> ASTContext:
        """Build AST context by parsing repository files.

        Returns:
            ASTContext with parsed files and dependency graph
        """
        from datetime import datetime

        registry = ParserRegistry.default()
        parsed_files = {}
        dep_graph = DependencyGraph()

        # Find all supported files
        supported_extensions = set(registry.list_supported_extensions())

        files_to_parse = []
        for ext in supported_extensions:
            files_to_parse.extend(self.repo_path.rglob(f"*{ext}"))

        logger.info(f"Parsing {len(files_to_parse)} files")

        # Parse each file
        for file_path in files_to_parse:
            parser = registry.get_parser_for_file(str(file_path))
            if parser is None:
                continue

            try:
                parsed = parser.parse_file(str(file_path))
                parsed_files[str(file_path)] = parsed
                dep_graph.add_file(parsed)

            except (SyntaxError, IOError, OSError) as e:
                logger.debug(f"Skipping {file_path}: {e}")
                continue

        # Estimate total tokens
        token_estimate = sum(
            self.token_counter.count_parsed_file(pf)
            for pf in parsed_files.values()
        )

        # Get Git SHA
        git_sha = self._get_git_sha()

        # Create AST context
        ast_context = ASTContext(
            repo_path=str(self.repo_path),
            git_sha=git_sha,
            files=parsed_files,
            dependency_graph=dep_graph.to_dict(),
            created_at=datetime.now(),
            token_estimate=token_estimate,
        )

        logger.info(
            f"AST context built: {len(parsed_files)} files, "
            f"{token_estimate} estimated tokens"
        )

        return ast_context

    def _get_git_sha(self) -> str:
        """Get the current Git SHA for the repository.

        Returns:
            Git commit SHA or 'unknown' if not a git repo
        """
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            logger.warning("Not a git repository or git not available")
            return "unknown"
