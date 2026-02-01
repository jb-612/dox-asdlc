#!/usr/bin/env python
"""Secrets migration script.

Migrates secrets from the current SecretsService (Redis-based) to a new
secrets backend (Infisical or GCP Secret Manager).

Usage:
    # Export from Redis and import to Infisical
    python scripts/secrets/migrate_secrets.py \
        --source redis \
        --target infisical \
        --environment dev

    # Dry run to see what would be migrated
    python scripts/secrets/migrate_secrets.py \
        --source redis \
        --target infisical \
        --dry-run

    # Export to JSON file only (for backup or manual import)
    python scripts/secrets/migrate_secrets.py \
        --source redis \
        --export-only \
        --export-file /tmp/secrets-export.json

    # Import from JSON file
    python scripts/secrets/migrate_secrets.py \
        --source json-file \
        --source-file /tmp/secrets-export.json \
        --target gcp \
        --environment staging
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Optional

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Credential type to secret name mapping
CREDENTIAL_MAPPING = {
    ("slack", "bot_token"): "SLACK_BOT_TOKEN",
    ("slack", "app_token"): "SLACK_APP_TOKEN",
    ("slack", "signing_secret"): "SLACK_SIGNING_SECRET",
    ("llm", "api_key", "anthropic"): "ANTHROPIC_API_KEY",
    ("llm", "api_key", "openai"): "OPENAI_API_KEY",
    ("llm", "api_key", "google"): "GOOGLE_AI_API_KEY",
    ("github", "personal_access_token"): "GITHUB_TOKEN",
}


def map_credential_to_secret_name(
    integration_type: str,
    credential_type: str,
    provider: Optional[str] = None,
) -> str:
    """Map a credential ID to its secret name.

    Args:
        integration_type: Type of integration (slack, llm, github)
        credential_type: Type of credential (bot_token, api_key, etc.)
        provider: Optional provider name for LLM keys

    Returns:
        Secret name in standard format (e.g., SLACK_BOT_TOKEN)
    """
    if provider:
        key = (integration_type, credential_type, provider)
        if key in CREDENTIAL_MAPPING:
            return CREDENTIAL_MAPPING[key]

    key = (integration_type, credential_type)
    if key in CREDENTIAL_MAPPING:
        return CREDENTIAL_MAPPING[key]

    # Fallback: generate a name
    return f"{integration_type.upper()}_{credential_type.upper()}"


def log_migration_progress(
    secret_id: str,
    secret_name: str,
    secret_value: str,
    action: str,
) -> None:
    """Log migration progress without exposing secret values.

    Args:
        secret_id: The credential ID
        secret_name: The secret name
        secret_value: The secret value (will NOT be logged)
        action: The action being performed
    """
    # Create a safe masked version
    if secret_value:
        masked = secret_value[:4] + "****" if len(secret_value) > 4 else "****"
    else:
        masked = "(empty)"

    logger.info(f"{action.capitalize()} secret: {secret_name} ({secret_id}) [{masked}]")


def export_secrets_metadata(
    secrets: list[dict[str, Any]],
    output_file: str,
) -> dict[str, Any]:
    """Export secrets metadata to JSON (without values).

    Args:
        secrets: List of secret metadata dictionaries
        output_file: Path to output JSON file

    Returns:
        Result dict with success status and count
    """
    try:
        # Remove sensitive fields
        safe_secrets = []
        for secret in secrets:
            safe_copy = {
                k: v for k, v in secret.items()
                if k not in ("key_encrypted", "value")
            }
            safe_secrets.append(safe_copy)

        with open(output_file, "w") as f:
            json.dump(safe_secrets, f, indent=2)

        logger.info(f"Exported {len(safe_secrets)} secrets metadata to {output_file}")
        return {"success": True, "count": len(safe_secrets)}

    except Exception as e:
        logger.error(f"Failed to export secrets metadata: {e}")
        return {"success": False, "error": str(e), "count": 0}


def export_secrets_with_values(
    secrets: list[dict[str, Any]],
    decrypted_values: dict[str, str],
    output_file: str,
) -> dict[str, Any]:
    """Export secrets with decrypted values to JSON for migration.

    WARNING: The output file will contain sensitive data.

    Args:
        secrets: List of secret metadata dictionaries
        decrypted_values: Mapping of credential ID to decrypted value
        output_file: Path to output JSON file

    Returns:
        Result dict with success status and count
    """
    try:
        export_data = []
        for secret in secrets:
            cred_id = secret["id"]
            export_entry = {
                k: v for k, v in secret.items()
                if k != "key_encrypted"
            }
            export_entry["value"] = decrypted_values.get(cred_id, "")
            export_data.append(export_entry)

        with open(output_file, "w") as f:
            json.dump(export_data, f, indent=2)

        # Set restrictive permissions on the file
        os.chmod(output_file, 0o600)

        logger.info(f"Exported {len(export_data)} secrets with values to {output_file}")
        logger.warning("SECURITY: Output file contains sensitive data - handle with care")

        return {"success": True, "count": len(export_data)}

    except Exception as e:
        logger.error(f"Failed to export secrets: {e}")
        return {"success": False, "error": str(e), "count": 0}


def load_secrets_from_json(file_path: str) -> dict[str, Any]:
    """Load secrets from a JSON export file.

    Args:
        file_path: Path to the JSON file

    Returns:
        Result dict with success status and secrets list
    """
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        with open(file_path) as f:
            secrets = json.load(f)

        logger.info(f"Loaded {len(secrets)} secrets from {file_path}")
        return {"success": True, "secrets": secrets}

    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Invalid JSON: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def migrate_secrets(
    secrets: list[dict[str, Any]],
    decrypted_values: dict[str, str],
    target_client: Any,
    environment: str = "dev",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Migrate secrets to target backend (sync wrapper).

    Args:
        secrets: List of secret metadata
        decrypted_values: Mapping of credential ID to value
        target_client: Target SecretsClient instance
        environment: Target environment
        dry_run: If True, don't actually import

    Returns:
        Result dict with migration status
    """
    if dry_run:
        logger.info("DRY RUN: No secrets will be imported")
        for secret in secrets:
            cred_id = secret["id"]
            secret_name = map_credential_to_secret_name(
                secret["integration_type"],
                secret["credential_type"],
                secret.get("provider"),
            )
            log_migration_progress(
                cred_id, secret_name, decrypted_values.get(cred_id, ""), "would import"
            )

        return {
            "success": True,
            "migrated": 0,
            "would_migrate": len(secrets),
            "dry_run": True,
        }

    # Run async import
    return asyncio.run(
        import_to_target(secrets, decrypted_values, target_client, environment)
    )


async def import_to_target(
    secrets: list[dict[str, Any]],
    decrypted_values: dict[str, str],
    target_client: Any,
    environment: str = "dev",
) -> dict[str, Any]:
    """Import secrets to target backend.

    Args:
        secrets: List of secret metadata
        decrypted_values: Mapping of credential ID to value
        target_client: Target SecretsClient instance
        environment: Target environment

    Returns:
        Result dict with import status
    """
    imported = 0
    failed = 0
    failed_secrets = []

    for secret in secrets:
        cred_id = secret["id"]
        value = decrypted_values.get(cred_id)

        if not value:
            logger.warning(f"No value found for {cred_id}, skipping")
            failed += 1
            failed_secrets.append(cred_id)
            continue

        secret_name = map_credential_to_secret_name(
            secret["integration_type"],
            secret["credential_type"],
            secret.get("provider"),
        )

        log_migration_progress(cred_id, secret_name, value, "importing")

        try:
            success = await target_client.set_secret(secret_name, value, environment)
            if success:
                imported += 1
                logger.info(f"Successfully imported {secret_name}")
            else:
                failed += 1
                failed_secrets.append(cred_id)
                logger.error(f"Failed to import {secret_name}")
        except Exception as e:
            failed += 1
            failed_secrets.append(cred_id)
            logger.error(f"Error importing {secret_name}: {e}")

    return {
        "success": failed == 0,
        "imported": imported,
        "failed": failed,
        "failed_secrets": failed_secrets,
    }


async def verify_migration(
    secrets: list[dict[str, Any]],
    target_client: Any,
    environment: str = "dev",
) -> dict[str, Any]:
    """Verify all secrets are accessible in the target backend.

    Args:
        secrets: List of secret metadata
        target_client: Target SecretsClient instance
        environment: Target environment

    Returns:
        Result dict with verification status
    """
    verified = 0
    missing = 0
    missing_secrets = []

    for secret in secrets:
        secret_name = map_credential_to_secret_name(
            secret["integration_type"],
            secret["credential_type"],
            secret.get("provider"),
        )

        try:
            value = await target_client.get_secret(secret_name, environment)
            if value:
                verified += 1
                logger.info(f"Verified: {secret_name}")
            else:
                missing += 1
                missing_secrets.append(secret["id"])
                logger.warning(f"Missing: {secret_name}")
        except Exception as e:
            missing += 1
            missing_secrets.append(secret["id"])
            logger.error(f"Error verifying {secret_name}: {e}")

    return {
        "success": missing == 0,
        "verified": verified,
        "missing": missing,
        "missing_secrets": missing_secrets,
    }


async def load_secrets_from_redis() -> tuple[list[dict], dict[str, str]]:
    """Load all secrets from Redis SecretsService.

    Returns:
        Tuple of (secrets metadata list, decrypted values dict)
    """
    from src.infrastructure.secrets.service import get_secrets_service

    service = get_secrets_service()
    secrets = await service.list_credentials()

    decrypted_values = {}
    for secret in secrets:
        cred_id = secret["id"]
        value = await service.retrieve(cred_id)
        if value:
            decrypted_values[cred_id] = value

    return secrets, decrypted_values


def get_target_client(target: str) -> Any:
    """Get the appropriate secrets client for the target.

    Args:
        target: Target backend name (infisical, gcp)

    Returns:
        SecretsClient instance
    """
    if target == "infisical":
        from src.infrastructure.secrets.infisical_client import InfisicalSecretsClient
        return InfisicalSecretsClient()
    elif target == "gcp":
        from src.infrastructure.secrets.gcp_client import GCPSecretsClient
        return GCPSecretsClient()
    else:
        raise ValueError(f"Unknown target backend: {target}")


def parse_args(args: Optional[list[str]] = None) -> argparse.Namespace:
    """Parse command line arguments.

    Args:
        args: Optional list of arguments (for testing)

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Migrate secrets between backends",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--source",
        choices=["redis", "json-file"],
        default="redis",
        help="Source of secrets (default: redis)",
    )

    parser.add_argument(
        "--source-file",
        help="Path to source JSON file (required when --source is json-file)",
    )

    parser.add_argument(
        "--target",
        choices=["infisical", "gcp"],
        default="infisical",
        help="Target secrets backend (default: infisical)",
    )

    parser.add_argument(
        "--environment",
        choices=["dev", "staging", "prod"],
        default="dev",
        help="Target environment (default: dev)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes",
    )

    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Only export secrets to JSON file, do not import",
    )

    parser.add_argument(
        "--export-file",
        help="Path to export JSON file",
    )

    parser.add_argument(
        "--include-values",
        action="store_true",
        help="Include secret values in export (use with caution)",
    )

    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify secrets are accessible after migration",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args(args)


async def main_async(args: argparse.Namespace) -> int:
    """Async main function.

    Args:
        args: Parsed command line arguments

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load secrets from source
    if args.source == "redis":
        logger.info("Loading secrets from Redis SecretsService...")
        secrets, decrypted_values = await load_secrets_from_redis()
        logger.info(f"Found {len(secrets)} secrets in Redis")
    else:
        if not args.source_file:
            logger.error("--source-file required when --source is json-file")
            return 1

        result = load_secrets_from_json(args.source_file)
        if not result["success"]:
            logger.error(f"Failed to load secrets: {result['error']}")
            return 1

        secrets = result["secrets"]
        decrypted_values = {s["id"]: s.get("value", "") for s in secrets}

    if not secrets:
        logger.warning("No secrets found to migrate")
        return 0

    # Export only mode
    if args.export_only:
        if not args.export_file:
            logger.error("--export-file required when --export-only is set")
            return 1

        if args.include_values:
            result = export_secrets_with_values(secrets, decrypted_values, args.export_file)
        else:
            result = export_secrets_metadata(secrets, args.export_file)

        return 0 if result["success"] else 1

    # Get target client
    try:
        target_client = get_target_client(args.target)
    except Exception as e:
        logger.error(f"Failed to initialize target client: {e}")
        return 1

    # Migrate secrets
    result = migrate_secrets(
        secrets=secrets,
        decrypted_values=decrypted_values,
        target_client=target_client,
        environment=args.environment,
        dry_run=args.dry_run,
    )

    if not result["success"] and not args.dry_run:
        logger.error(f"Migration completed with {result['failed']} failures")

    # Verify if requested
    if args.verify and not args.dry_run:
        logger.info("Verifying migration...")
        verify_result = await verify_migration(secrets, target_client, args.environment)
        if not verify_result["success"]:
            logger.error(f"Verification failed: {verify_result['missing']} secrets missing")
            return 1
        logger.info(f"Verification complete: {verify_result['verified']} secrets verified")

    # Summary
    if args.dry_run:
        logger.info(f"DRY RUN: Would migrate {result['would_migrate']} secrets")
    else:
        logger.info(f"Migration complete: {result['imported']} imported, {result['failed']} failed")

    return 0 if result["success"] or args.dry_run else 1


def main() -> int:
    """Main entry point.

    Returns:
        Exit code
    """
    args = parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
