"""AST Context caching for Repo Mapper.

Provides persistent caching of parsed AST contexts with TTL and Git SHA validation.
"""

import hashlib
import json
import logging
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from src.workers.repo_mapper.models import ASTContext

logger = logging.getLogger(__name__)


class ASTContextCache:
    """Persistent cache for AST contexts with TTL and validation.

    Attributes:
        cache_dir: Directory where cache files are stored
        ttl_hours: Time-to-live for cache entries in hours (0 = no expiry)
    """

    def __init__(self, cache_dir: str, ttl_hours: int = 24):
        """Initialize the cache.

        Args:
            cache_dir: Path to cache storage directory
            ttl_hours: Hours before cache entries expire (0 for no expiry)
        """
        self.cache_dir = Path(cache_dir)
        self.ttl_hours = ttl_hours

        # Create cache directory if it doesn't exist
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get(
        self, repo_path: str, validate_sha: bool = False
    ) -> Optional[ASTContext]:
        """Retrieve cached AST context for a repository.

        Args:
            repo_path: Path to the repository
            validate_sha: If True, validate cached SHA matches current Git SHA

        Returns:
            Cached ASTContext if valid, None otherwise
        """
        cache_file = self.cache_dir / self._get_cache_filename(repo_path)

        # Check if cache file exists
        if not cache_file.exists():
            logger.debug(f"Cache miss: {repo_path}")
            return None

        try:
            # Load cache data
            with open(cache_file, "r") as f:
                data = json.load(f)

            # Parse context
            context = ASTContext.from_dict(data)

            # Check TTL
            if self.ttl_hours > 0:
                age = datetime.now() - context.created_at
                if age > timedelta(hours=self.ttl_hours):
                    logger.debug(f"Cache expired: {repo_path}")
                    return None

            # Validate Git SHA if requested
            if validate_sha:
                current_sha = self._get_current_git_sha(repo_path)
                if current_sha != context.git_sha:
                    logger.debug(
                        f"SHA mismatch: cached={context.git_sha}, "
                        f"current={current_sha}"
                    )
                    return None

            logger.debug(f"Cache hit: {repo_path}")
            return context

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Corrupted cache file for {repo_path}: {e}")
            # Remove corrupted cache
            cache_file.unlink(missing_ok=True)
            return None

    def save(self, context: ASTContext) -> None:
        """Save AST context to cache.

        Args:
            context: AST context to cache
        """
        cache_file = self.cache_dir / self._get_cache_filename(context.repo_path)

        try:
            # Serialize context
            data = context.to_dict()

            # Write to cache
            with open(cache_file, "w") as f:
                json.dump(data, f, indent=2, default=str)

            logger.debug(f"Cached context for {context.repo_path}")

        except (OSError, TypeError) as e:
            logger.error(f"Failed to save cache for {context.repo_path}: {e}")

    def invalidate(self, repo_path: str) -> None:
        """Invalidate cached context for a repository.

        Args:
            repo_path: Path to the repository
        """
        cache_file = self.cache_dir / self._get_cache_filename(repo_path)
        cache_file.unlink(missing_ok=True)
        logger.debug(f"Invalidated cache for {repo_path}")

    def partial_invalidate(
        self, repo_path: str, changed_files: list[str]
    ) -> None:
        """Partially invalidate cache by removing specific files.

        Args:
            repo_path: Path to the repository
            changed_files: List of file paths that changed
        """
        context = self.get(repo_path)

        if context is None:
            return

        # Remove changed files from context
        for file_path in changed_files:
            context.files.pop(file_path, None)

        # Update token estimate (rough approximation)
        context.token_estimate = sum(
            len(pf.raw_content) // 4 for pf in context.files.values()
        )

        # Save updated context
        self.save(context)
        logger.debug(
            f"Partially invalidated {len(changed_files)} files for {repo_path}"
        )

    def _get_cache_filename(self, repo_path: str) -> str:
        """Generate cache filename from repository path.

        Args:
            repo_path: Path to the repository

        Returns:
            Cache filename
        """
        # Use hash of repo path to avoid filesystem issues
        path_hash = hashlib.sha256(repo_path.encode()).hexdigest()[:16]
        return f"ast_context_{path_hash}.json"

    def _get_current_git_sha(self, repo_path: str) -> str:
        """Get current Git SHA for a repository.

        Args:
            repo_path: Path to the repository

        Returns:
            Current Git commit SHA
        """
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to get Git SHA for {repo_path}: {e}")
            return ""
