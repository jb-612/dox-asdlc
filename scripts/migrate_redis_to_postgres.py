#!/usr/bin/env python3
"""Migrate ideation data from Redis to PostgreSQL.

This script exports all ideation sessions and related data from Redis
and imports them to PostgreSQL using the repository layer.

Usage:
    python -m scripts.migrate_redis_to_postgres [--dry-run]

Options:
    --dry-run       Show what would be migrated without making changes.
    --skip-existing Skip sessions that already exist in PostgreSQL.
    --verbose       Show detailed progress information.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from dataclasses import dataclass

import redis.asyncio as redis

from src.core.models.ideation import (
    ChatMessage,
    ExtractedRequirement,
    IdeationSession,
    MaturityState,
    PRDDraft,
    UserStory,
)
from src.orchestrator.persistence.database import Database, DatabaseConfig
from src.orchestrator.repositories.postgres import (
    PostgresMaturityRepository,
    PostgresMessageRepository,
    PostgresPRDRepository,
    PostgresRequirementRepository,
    PostgresSessionRepository,
)
from src.orchestrator.repositories.redis import (
    RedisMaturityRepository,
    RedisMessageRepository,
    RedisPRDRepository,
    RedisRequirementRepository,
    RedisSessionRepository,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@dataclass
class MigrationStats:
    """Statistics for migration progress tracking."""

    sessions_found: int = 0
    sessions_migrated: int = 0
    sessions_skipped: int = 0
    sessions_failed: int = 0
    messages_migrated: int = 0
    requirements_migrated: int = 0
    maturity_migrated: int = 0
    prd_drafts_migrated: int = 0
    user_stories_migrated: int = 0


class MigrationError(Exception):
    """Exception raised during migration operations."""

    pass


async def get_all_session_ids(redis_client: redis.Redis) -> list[str]:
    """Scan Redis for all ideation session IDs.

    Args:
        redis_client: Async Redis client.

    Returns:
        List of session IDs found in Redis.
    """
    session_ids = set()
    cursor = 0

    # Scan for session keys
    while True:
        cursor, keys = await redis_client.scan(cursor, match="ideation:session:*")
        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            # Extract session ID from key
            session_id = key_str.replace("ideation:session:", "")
            session_ids.add(session_id)

        if cursor == 0:
            break

    return list(session_ids)


async def migrate_session(
    session_id: str,
    redis_repos: dict,
    postgres_repos: dict,
    stats: MigrationStats,
    dry_run: bool = False,
    skip_existing: bool = False,
    verbose: bool = False,
) -> bool:
    """Migrate a single session and all its related data.

    Args:
        session_id: The session ID to migrate.
        redis_repos: Dictionary of Redis repository instances.
        postgres_repos: Dictionary of PostgreSQL repository instances.
        stats: Migration statistics object.
        dry_run: If True, don't actually migrate data.
        skip_existing: If True, skip sessions that already exist.
        verbose: If True, log detailed progress.

    Returns:
        True if migration succeeded, False otherwise.
    """
    try:
        # Check if session already exists in PostgreSQL
        if skip_existing:
            existing = await postgres_repos["session"].get_by_id(session_id)
            if existing:
                if verbose:
                    logger.info(f"  Skipping existing session: {session_id}")
                stats.sessions_skipped += 1
                return True

        # Get session from Redis
        session: IdeationSession | None = await redis_repos["session"].get_by_id(
            session_id
        )
        if session is None:
            logger.warning(f"  Session not found in Redis: {session_id}")
            return False

        if verbose:
            logger.info(f"  Migrating session: {session.project_name}")

        if not dry_run:
            # Migrate session
            await postgres_repos["session"].create(session)

        # Get and migrate messages
        messages: list[ChatMessage] = await redis_repos["message"].get_by_session(
            session_id
        )
        if verbose:
            logger.info(f"    Found {len(messages)} messages")

        for msg in messages:
            if not dry_run:
                await postgres_repos["message"].create(msg)
            stats.messages_migrated += 1

        # Get and migrate requirements
        requirements: list[ExtractedRequirement] = await redis_repos[
            "requirement"
        ].get_by_session(session_id)
        if verbose:
            logger.info(f"    Found {len(requirements)} requirements")

        for req in requirements:
            if not dry_run:
                await postgres_repos["requirement"].create(req)
            stats.requirements_migrated += 1

        # Get and migrate maturity state
        maturity: MaturityState | None = await redis_repos["maturity"].get_by_session(
            session_id
        )
        if maturity:
            if verbose:
                logger.info(f"    Found maturity state (score: {maturity.score})")
            if not dry_run:
                await postgres_repos["maturity"].save(maturity)
            stats.maturity_migrated += 1

        # Get and migrate PRD draft
        prd: PRDDraft | None = await redis_repos["prd"].get_draft(session_id)
        if prd:
            if verbose:
                logger.info(f"    Found PRD draft: {prd.title}")
            if not dry_run:
                await postgres_repos["prd"].save_draft(prd)
            stats.prd_drafts_migrated += 1

        # Get and migrate user stories
        stories: list[UserStory] = await redis_repos["prd"].get_user_stories(session_id)
        if stories:
            if verbose:
                logger.info(f"    Found {len(stories)} user stories")
            if not dry_run:
                await postgres_repos["prd"].save_user_stories(session_id, stories)
            stats.user_stories_migrated += len(stories)

        stats.sessions_migrated += 1
        return True

    except Exception as e:
        logger.error(f"  Failed to migrate session {session_id}: {e}")
        stats.sessions_failed += 1
        return False


async def validate_migration(
    session_id: str,
    redis_repos: dict,
    postgres_repos: dict,
    verbose: bool = False,
) -> bool:
    """Validate that a session was migrated correctly.

    Args:
        session_id: The session ID to validate.
        redis_repos: Dictionary of Redis repository instances.
        postgres_repos: Dictionary of PostgreSQL repository instances.
        verbose: If True, log detailed validation info.

    Returns:
        True if validation passed, False otherwise.
    """
    try:
        # Compare session
        redis_session = await redis_repos["session"].get_by_id(session_id)
        pg_session = await postgres_repos["session"].get_by_id(session_id)

        if redis_session is None and pg_session is None:
            return True  # Both don't exist, OK

        if redis_session is None or pg_session is None:
            logger.error(f"Session mismatch for {session_id}")
            return False

        if redis_session.project_name != pg_session.project_name:
            logger.error(f"Project name mismatch for {session_id}")
            return False

        # Compare message counts
        redis_msgs = await redis_repos["message"].get_by_session(session_id)
        pg_msgs = await postgres_repos["message"].get_by_session(session_id)

        if len(redis_msgs) != len(pg_msgs):
            logger.error(
                f"Message count mismatch for {session_id}: "
                f"Redis={len(redis_msgs)}, PostgreSQL={len(pg_msgs)}"
            )
            return False

        # Compare requirement counts
        redis_reqs = await redis_repos["requirement"].get_by_session(session_id)
        pg_reqs = await postgres_repos["requirement"].get_by_session(session_id)

        if len(redis_reqs) != len(pg_reqs):
            logger.error(
                f"Requirement count mismatch for {session_id}: "
                f"Redis={len(redis_reqs)}, PostgreSQL={len(pg_reqs)}"
            )
            return False

        if verbose:
            logger.info(f"  Validation passed for session: {session_id}")

        return True

    except Exception as e:
        logger.error(f"Validation error for {session_id}: {e}")
        return False


async def run_migration(
    dry_run: bool = False,
    skip_existing: bool = False,
    verbose: bool = False,
) -> MigrationStats:
    """Run the full migration from Redis to PostgreSQL.

    Args:
        dry_run: If True, show what would be migrated without changes.
        skip_existing: If True, skip sessions already in PostgreSQL.
        verbose: If True, show detailed progress.

    Returns:
        MigrationStats with migration results.
    """
    stats = MigrationStats()

    # Initialize Redis client
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", "6379"))
    redis_client = redis.Redis(host=redis_host, port=redis_port)

    # Initialize PostgreSQL database
    db = Database(DatabaseConfig())

    logger.info("=" * 60)
    logger.info("Redis to PostgreSQL Migration")
    logger.info("=" * 60)
    logger.info(f"Redis: {redis_host}:{redis_port}")
    logger.info(f"PostgreSQL: {db.config.host}:{db.config.port}/{db.config.database}")
    logger.info(f"Dry run: {dry_run}")
    logger.info(f"Skip existing: {skip_existing}")
    logger.info("=" * 60)

    try:
        # Test Redis connection
        await redis_client.ping()
        logger.info("Connected to Redis")

        # Connect to PostgreSQL
        await db.connect()
        logger.info("Connected to PostgreSQL")

        # Initialize Redis repositories
        redis_repos = {
            "session": RedisSessionRepository(redis_client),
            "message": RedisMessageRepository(redis_client),
            "requirement": RedisRequirementRepository(redis_client),
            "maturity": RedisMaturityRepository(redis_client),
            "prd": RedisPRDRepository(redis_client),
        }

        # Get all session IDs
        session_ids = await get_all_session_ids(redis_client)
        stats.sessions_found = len(session_ids)
        logger.info(f"Found {len(session_ids)} sessions in Redis")

        if not session_ids:
            logger.info("No sessions to migrate")
            return stats

        # Create PostgreSQL session for migration
        async with db.session() as db_session:
            # Initialize PostgreSQL repositories
            postgres_repos = {
                "session": PostgresSessionRepository(db_session),
                "message": PostgresMessageRepository(db_session),
                "requirement": PostgresRequirementRepository(db_session),
                "maturity": PostgresMaturityRepository(db_session),
                "prd": PostgresPRDRepository(db_session),
            }

            # Migrate each session
            for i, session_id in enumerate(session_ids, 1):
                logger.info(f"[{i}/{len(session_ids)}] Processing session: {session_id}")
                await migrate_session(
                    session_id,
                    redis_repos,
                    postgres_repos,
                    stats,
                    dry_run=dry_run,
                    skip_existing=skip_existing,
                    verbose=verbose,
                )

            if not dry_run:
                # Commit all changes
                await db_session.commit()
                logger.info("Changes committed to PostgreSQL")

                # Validate migration
                logger.info("Validating migration...")
                validation_failed = 0
                for session_id in session_ids:
                    if not await validate_migration(
                        session_id, redis_repos, postgres_repos, verbose
                    ):
                        validation_failed += 1

                if validation_failed > 0:
                    logger.error(f"Validation failed for {validation_failed} sessions")
                else:
                    logger.info("All sessions validated successfully")

    except redis.ConnectionError as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise MigrationError(f"Redis connection failed: {e}")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise MigrationError(f"Migration failed: {e}")

    finally:
        await redis_client.aclose()
        await db.disconnect()

    return stats


def print_summary(stats: MigrationStats, dry_run: bool = False) -> None:
    """Print migration summary.

    Args:
        stats: Migration statistics.
        dry_run: Whether this was a dry run.
    """
    logger.info("")
    logger.info("=" * 60)
    logger.info("Migration Summary" + (" (DRY RUN)" if dry_run else ""))
    logger.info("=" * 60)
    logger.info(f"Sessions found:      {stats.sessions_found}")
    logger.info(f"Sessions migrated:   {stats.sessions_migrated}")
    logger.info(f"Sessions skipped:    {stats.sessions_skipped}")
    logger.info(f"Sessions failed:     {stats.sessions_failed}")
    logger.info("-" * 60)
    logger.info(f"Messages migrated:   {stats.messages_migrated}")
    logger.info(f"Requirements:        {stats.requirements_migrated}")
    logger.info(f"Maturity states:     {stats.maturity_migrated}")
    logger.info(f"PRD drafts:          {stats.prd_drafts_migrated}")
    logger.info(f"User stories:        {stats.user_stories_migrated}")
    logger.info("=" * 60)

    if stats.sessions_failed > 0:
        logger.warning("Some sessions failed to migrate. Check logs for details.")


async def main() -> int:
    """Main entry point for the migration script.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(
        description="Migrate ideation data from Redis to PostgreSQL."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip sessions that already exist in PostgreSQL.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed progress information.",
    )

    args = parser.parse_args()

    try:
        stats = await run_migration(
            dry_run=args.dry_run,
            skip_existing=args.skip_existing,
            verbose=args.verbose,
        )
        print_summary(stats, dry_run=args.dry_run)

        if stats.sessions_failed > 0:
            return 1
        return 0

    except MigrationError as e:
        logger.error(f"Migration failed: {e}")
        return 1

    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
