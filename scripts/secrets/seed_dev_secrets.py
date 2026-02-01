#!/usr/bin/env python
"""Seed development secrets for new developers.

This script creates initial development secrets for the aSDLC project.
It can read values from environment variables or prompt interactively.

Usage:
    # Interactive mode (prompts for missing values)
    python scripts/secrets/seed_dev_secrets.py

    # Non-interactive mode (use env vars only)
    python scripts/secrets/seed_dev_secrets.py --no-interactive

    # Use a custom template file
    python scripts/secrets/seed_dev_secrets.py --template-file custom-template.yaml

    # Skip existing secrets
    python scripts/secrets/seed_dev_secrets.py --skip-existing

    # Target different environment
    python scripts/secrets/seed_dev_secrets.py --environment staging
"""

import argparse
import asyncio
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Default template file path
DEFAULT_TEMPLATE_PATH = str(Path(__file__).parent / "dev-secrets.template.yaml")


# Required secrets for development
REQUIRED_SECRETS = [
    {
        "name": "SLACK_BOT_TOKEN",
        "description": "Slack bot OAuth token (xoxb-...)",
        "required": True,
        "example": "xoxb-your-bot-token-here",
    },
    {
        "name": "SLACK_APP_TOKEN",
        "description": "Slack app-level token for Socket Mode (xapp-...)",
        "required": True,
        "example": "xapp-your-app-token-here",
    },
    {
        "name": "SLACK_SIGNING_SECRET",
        "description": "Slack signing secret for request verification",
        "required": True,
        "example": "your-signing-secret-here",
    },
    {
        "name": "ANTHROPIC_API_KEY",
        "description": "Anthropic API key for Claude",
        "required": True,
        "example": "sk-ant-api-key-here",
    },
    {
        "name": "OPENAI_API_KEY",
        "description": "OpenAI API key (optional, for GPT models)",
        "required": False,
        "example": "sk-openai-key-here",
    },
    {
        "name": "GOOGLE_AI_API_KEY",
        "description": "Google AI API key (optional, for Gemini models)",
        "required": False,
        "example": "google-ai-key-here",
    },
]


@dataclass
class SeedConfig:
    """Configuration for secrets seeding."""

    environment: str = "dev"
    backend: str = "infisical"
    template_file: Optional[str] = None
    skip_existing: bool = False
    interactive: bool = True


@dataclass
class SeedStats:
    """Statistics for seeding progress tracking."""

    secrets_required: int = 0
    secrets_seeded: int = 0
    secrets_skipped: int = 0
    secrets_failed: int = 0
    failed_secrets: list[str] = field(default_factory=list)

    def summary(self) -> str:
        """Generate a summary string of the seeding stats."""
        lines = [
            "=" * 50,
            "Seeding Summary",
            "=" * 50,
            f"Secrets required:  {self.secrets_required}",
            f"Secrets seeded:    {self.secrets_seeded}",
            f"Secrets skipped:   {self.secrets_skipped}",
            f"Secrets failed:    {self.secrets_failed}",
            "=" * 50,
        ]
        if self.failed_secrets:
            lines.append("Failed secrets:")
            for name in self.failed_secrets:
                lines.append(f"  - {name}")
        return "\n".join(lines)


def load_template(file_path: str) -> list[dict[str, Any]]:
    """Load secrets template from a YAML file.

    Args:
        file_path: Path to the YAML template file.

    Returns:
        List of secret definitions.

    Raises:
        FileNotFoundError: If the file doesn't exist.
        ValueError: If the YAML is invalid.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Template file not found: {file_path}")

    try:
        with open(path) as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML in {file_path}: {e}")

    if not data or "secrets" not in data:
        raise ValueError(f"Template file must contain a 'secrets' key: {file_path}")

    return data["secrets"]


def get_secret_value(
    name: str,
    required: bool,
    example: str,
    description: str = "",
    interactive: bool = True,
) -> Optional[str]:
    """Get a secret value from environment or user input.

    Args:
        name: Name of the secret (also env var name).
        required: Whether the secret is required.
        example: Example value to show user.
        description: Description of the secret.
        interactive: Whether to prompt user for missing values.

    Returns:
        The secret value, or None if not provided.
    """
    # First, check environment variable
    value = os.environ.get(name)
    if value:
        logger.info(f"Found {name} in environment")
        return value

    # If not interactive, return None for missing
    if not interactive:
        if required:
            logger.warning(f"Required secret {name} not found in environment")
        return None

    # Prompt user
    print(f"\n{name}")
    if description:
        print(f"  Description: {description}")
    print(f"  Example: {example}")

    if not required:
        print("  (Optional - press Enter to skip)")

    value = input(f"  Enter value: ").strip()

    if not value:
        if required:
            logger.warning(f"No value provided for required secret {name}")
        return None

    return value


async def seed_secrets(
    secrets: list[dict[str, Any]],
    client: Any,
    environment: str,
    skip_existing: bool,
    stats: SeedStats,
) -> None:
    """Seed secrets to the target backend.

    Args:
        secrets: List of secrets with name and value.
        client: SecretsClient instance.
        environment: Target environment (dev, staging, prod).
        skip_existing: If True, skip secrets that already exist.
        stats: Stats object to update.
    """
    for secret in secrets:
        name = secret.get("name", "")
        value = secret.get("value", "")

        if not name:
            logger.warning("Skipping secret with missing name")
            stats.secrets_skipped += 1
            continue

        if not value:
            logger.info(f"Skipping {name} - no value provided")
            stats.secrets_skipped += 1
            continue

        # Check if secret already exists
        if skip_existing:
            try:
                existing = await client.get_secret(name, environment)
                if existing:
                    logger.info(f"Skipping {name} - already exists")
                    stats.secrets_skipped += 1
                    continue
            except Exception as e:
                logger.debug(f"Error checking existing {name}: {e}")

        # Set the secret
        try:
            success = await client.set_secret(name, value, environment)
            if success:
                logger.info(f"Seeded: {name}")
                stats.secrets_seeded += 1
            else:
                logger.error(f"Failed to seed: {name}")
                stats.secrets_failed += 1
                stats.failed_secrets.append(name)
        except Exception as e:
            logger.error(f"Error seeding {name}: {e}")
            stats.secrets_failed += 1
            stats.failed_secrets.append(name)


def parse_args(args: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command line arguments.

    Args:
        args: Optional list of arguments (for testing).

    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        description="Seed development secrets for new developers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--environment",
        default="dev",
        help="Target environment (default: dev)",
    )

    parser.add_argument(
        "--backend",
        choices=["infisical", "gcp", "env"],
        default="infisical",
        help="Target secrets backend (default: infisical)",
    )

    parser.add_argument(
        "--template-file",
        help="Path to YAML template file (optional)",
    )

    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip secrets that already exist",
    )

    parser.add_argument(
        "--no-interactive",
        action="store_false",
        dest="interactive",
        help="Don't prompt for missing values (use env vars only)",
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args(args)


def get_secrets_client(backend: str) -> Any:
    """Get the appropriate secrets client for the backend.

    Args:
        backend: Backend name (infisical, gcp, env).

    Returns:
        SecretsClient instance.
    """
    if backend == "infisical":
        from src.infrastructure.secrets.infisical_client import InfisicalSecretsClient
        return InfisicalSecretsClient()
    elif backend == "gcp":
        from src.infrastructure.secrets.gcp_client import GCPSecretsClient
        return GCPSecretsClient()
    elif backend == "env":
        from src.infrastructure.secrets.client import EnvironmentSecretsClient
        return EnvironmentSecretsClient()
    else:
        raise ValueError(f"Unknown backend: {backend}")


async def main_async(args: argparse.Namespace) -> int:
    """Async main function.

    Args:
        args: Parsed command line arguments.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    stats = SeedStats()

    # Load template or use default secrets
    if args.template_file:
        try:
            secrets_template = load_template(args.template_file)
            logger.info(f"Loaded template from {args.template_file}")
        except (FileNotFoundError, ValueError) as e:
            logger.error(f"Failed to load template: {e}")
            return 1
    else:
        secrets_template = REQUIRED_SECRETS
        logger.info("Using default required secrets list")

    stats.secrets_required = len(secrets_template)

    # Collect secret values
    secrets_to_seed = []
    for secret_def in secrets_template:
        name = secret_def["name"]
        required = secret_def.get("required", True)
        example = secret_def.get("example", "")
        description = secret_def.get("description", "")

        value = get_secret_value(
            name=name,
            required=required,
            example=example,
            description=description,
            interactive=args.interactive,
        )

        if value:
            secrets_to_seed.append({
                "name": name,
                "value": value,
            })
        elif required:
            logger.warning(f"Skipping required secret {name} - no value")
            stats.secrets_skipped += 1

    if not secrets_to_seed:
        logger.info("No secrets to seed")
        print(stats.summary())
        return 0

    # Get target client
    try:
        client = get_secrets_client(args.backend)
        logger.info(f"Using {args.backend} backend")
    except Exception as e:
        logger.error(f"Failed to initialize backend: {e}")
        return 1

    # Seed secrets
    await seed_secrets(
        secrets=secrets_to_seed,
        client=client,
        environment=args.environment,
        skip_existing=args.skip_existing,
        stats=stats,
    )

    # Print summary
    print(stats.summary())

    return 0 if stats.secrets_failed == 0 else 1


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    args = parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
