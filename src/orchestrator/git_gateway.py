"""Git gateway for exclusive write access.

Only the Manager Agent (orchestrator container) should have Git write
credentials. This module enforces that restriction.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from pathlib import Path

from src.core.exceptions import GitOperationError

logger = logging.getLogger(__name__)


class GitGateway:
    """Exclusive Git write access for the Manager Agent.

    This class enforces that only the orchestrator container
    can write to protected branches. It validates write permissions
    before any mutating operation.

    All operations are async-safe using subprocess for Git commands.
    """

    def __init__(
        self,
        repo_path: str,
        protected_branches: list[str] | None = None,
    ):
        """Initialize the Git gateway.

        Args:
            repo_path: Path to the Git repository.
            protected_branches: List of branches requiring gateway access.
                Defaults to ["main", "develop"].
        """
        self.repo_path = Path(repo_path)
        self.protected_branches = protected_branches or ["main", "develop"]

    def is_write_allowed(self) -> bool:
        """Check if this instance has Git write permissions.

        Write permission is controlled by the GIT_WRITE_ACCESS environment
        variable. Only the orchestrator container should have this set.

        Returns:
            True if write operations are allowed.
        """
        return os.getenv("GIT_WRITE_ACCESS", "false").lower() in ("true", "1", "yes")

    def _check_write_permission(self) -> None:
        """Verify write permission, raise if not allowed.

        Raises:
            GitOperationError: If write access is not allowed.
        """
        if not self.is_write_allowed():
            raise GitOperationError(
                "Write access not allowed. "
                "Set GIT_WRITE_ACCESS=true in orchestrator container.",
                details={"repo_path": str(self.repo_path)},
            )

    async def _run_git(
        self,
        *args: str,
        check: bool = True,
    ) -> subprocess.CompletedProcess:
        """Run a Git command asynchronously.

        Args:
            *args: Git command arguments (without 'git' prefix).
            check: Whether to raise on non-zero exit.

        Returns:
            CompletedProcess with stdout/stderr.

        Raises:
            GitOperationError: If command fails and check=True.
        """
        cmd = ["git", *args]
        logger.debug(f"Running: {' '.join(cmd)}")

        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    cmd,
                    cwd=str(self.repo_path),
                    capture_output=True,
                    text=True,
                    check=check,
                ),
            )
            return result
        except subprocess.CalledProcessError as e:
            raise GitOperationError(
                f"Git command failed: {' '.join(cmd)}",
                details={
                    "returncode": e.returncode,
                    "stdout": e.stdout,
                    "stderr": e.stderr,
                },
            ) from e

    async def get_current_sha(self, ref: str = "HEAD") -> str:
        """Get the current commit SHA.

        Args:
            ref: Git reference to resolve. Defaults to HEAD.

        Returns:
            The full 40-character SHA.
        """
        result = await self._run_git("rev-parse", ref)
        sha = result.stdout.strip()
        logger.info(f"Current SHA ({ref}): {sha}")
        return sha

    async def verify_sha_exists(self, sha: str) -> bool:
        """Verify that a commit SHA exists in the repository.

        Args:
            sha: The SHA to verify.

        Returns:
            True if the SHA exists.
        """
        try:
            result = await self._run_git("cat-file", "-t", sha, check=False)
            return result.returncode == 0 and "commit" in result.stdout
        except Exception:
            return False

    async def apply_patch(
        self,
        patch_path: str,
        commit_message: str,
        task_id: str,
    ) -> str:
        """Apply a patch file and commit.

        Args:
            patch_path: Path to the patch file.
            commit_message: Commit message.
            task_id: Task ID for audit trail.

        Returns:
            The new commit SHA.

        Raises:
            GitOperationError: If patch application fails or
                write access is not allowed.
        """
        self._check_write_permission()

        logger.info(f"Applying patch for task {task_id}: {patch_path}")

        # Verify patch file exists
        patch_file = Path(patch_path)
        if not patch_file.exists():
            raise GitOperationError(
                f"Patch file not found: {patch_path}",
                details={"task_id": task_id},
            )

        # Apply the patch
        try:
            await self._run_git("apply", str(patch_file))
        except GitOperationError as e:
            # Try with --3way for merge conflicts
            try:
                await self._run_git("apply", "--3way", str(patch_file))
            except GitOperationError:
                raise GitOperationError(
                    f"Failed to apply patch: {patch_path}",
                    details={
                        "task_id": task_id,
                        "original_error": str(e),
                    },
                ) from e

        # Stage all changes
        await self._run_git("add", "-A")

        # Commit with task context
        full_message = f"{commit_message}\n\nTask-ID: {task_id}"
        await self._run_git("commit", "-m", full_message)

        # Get new SHA
        new_sha = await self.get_current_sha()
        logger.info(f"Committed patch for task {task_id}: {new_sha}")

        return new_sha

    async def create_branch(
        self,
        branch_name: str,
        from_ref: str = "HEAD",
    ) -> None:
        """Create a new branch.

        Args:
            branch_name: Name of the branch to create.
            from_ref: Starting point for the branch.

        Raises:
            GitOperationError: If branch creation fails or
                write access is not allowed.
        """
        self._check_write_permission()

        logger.info(f"Creating branch: {branch_name} from {from_ref}")
        await self._run_git("branch", branch_name, from_ref)

    async def checkout_branch(self, branch_name: str) -> None:
        """Checkout a branch.

        Args:
            branch_name: Name of the branch to checkout.

        Raises:
            GitOperationError: If checkout fails or
                write access is not allowed.
        """
        self._check_write_permission()

        logger.info(f"Checking out branch: {branch_name}")
        await self._run_git("checkout", branch_name)

    async def merge_branch(
        self,
        source_branch: str,
        target_branch: str = "main",
        commit_message: str | None = None,
    ) -> str:
        """Merge source branch into target.

        Args:
            source_branch: Branch to merge from.
            target_branch: Branch to merge into.
            commit_message: Optional commit message for merge.

        Returns:
            The new commit SHA after merge.

        Raises:
            GitOperationError: If merge fails or
                write access is not allowed.
        """
        self._check_write_permission()

        logger.info(f"Merging {source_branch} into {target_branch}")

        # Checkout target
        await self._run_git("checkout", target_branch)

        # Merge
        merge_args = ["merge", source_branch]
        if commit_message:
            merge_args.extend(["-m", commit_message])

        await self._run_git(*merge_args)

        new_sha = await self.get_current_sha()
        logger.info(f"Merged {source_branch} into {target_branch}: {new_sha}")

        return new_sha

    async def get_diff(
        self,
        from_ref: str = "HEAD~1",
        to_ref: str = "HEAD",
    ) -> str:
        """Get diff between two refs.

        Args:
            from_ref: Starting ref.
            to_ref: Ending ref.

        Returns:
            The diff output as string.
        """
        result = await self._run_git("diff", from_ref, to_ref)
        return result.stdout

    async def get_status(self) -> dict[str, list[str]]:
        """Get repository status.

        Returns:
            Dict with 'staged', 'modified', 'untracked' file lists.
        """
        result = await self._run_git("status", "--porcelain")

        staged = []
        modified = []
        untracked = []

        for line in result.stdout.strip().split("\n"):
            if not line:
                continue

            status = line[:2]
            file_path = line[3:]

            if status[0] in ("A", "M", "D", "R"):
                staged.append(file_path)
            if status[1] == "M":
                modified.append(file_path)
            if status == "??":
                untracked.append(file_path)

        return {
            "staged": staged,
            "modified": modified,
            "untracked": untracked,
        }

    async def reset_hard(self, ref: str = "HEAD") -> None:
        """Hard reset to a ref.

        WARNING: This discards all uncommitted changes.

        Args:
            ref: Ref to reset to.

        Raises:
            GitOperationError: If reset fails or
                write access is not allowed.
        """
        self._check_write_permission()

        logger.warning(f"Hard reset to {ref}")
        await self._run_git("reset", "--hard", ref)

    async def clean_untracked(self) -> None:
        """Remove all untracked files.

        WARNING: This deletes files not in Git.

        Raises:
            GitOperationError: If clean fails or
                write access is not allowed.
        """
        self._check_write_permission()

        logger.warning("Cleaning untracked files")
        await self._run_git("clean", "-fd")
