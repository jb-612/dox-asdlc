"""Tests for secrets migration script."""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Import the module under test (will be created after tests)
# We patch the imports to test the script logic


class TestSecretsMigration:
    """Test secrets migration functionality."""

    @pytest.fixture
    def mock_redis_secrets(self):
        """Mock secrets stored in Redis via SecretsService."""
        return [
            {
                "id": "cred-slack-abc123",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Production Slack",
                "key_masked": "xoxb-****-****",
                "created_at": "2026-01-15T10:00:00Z",
                "last_used": "2026-01-30T15:30:00Z",
                "is_valid": True,
            },
            {
                "id": "cred-slack-def456",
                "integration_type": "slack",
                "credential_type": "app_token",
                "name": "Production Slack App",
                "key_masked": "xapp-****-****",
                "created_at": "2026-01-15T10:00:00Z",
                "last_used": None,
                "is_valid": True,
            },
            {
                "id": "cred-llm-ghi789",
                "integration_type": "llm",
                "credential_type": "api_key",
                "name": "Anthropic API Key",
                "key_masked": "sk-ant-****",
                "created_at": "2026-01-20T08:00:00Z",
                "last_used": "2026-01-31T12:00:00Z",
                "is_valid": True,
            },
        ]

    @pytest.fixture
    def mock_decrypted_values(self):
        """Mock decrypted secret values."""
        return {
            "cred-slack-abc123": "xoxb-1234567890-abcdefghij",
            "cred-slack-def456": "xapp-1234-abcdefghij",
            "cred-llm-ghi789": "sk-ant-1234567890abcdef",
        }

    @pytest.fixture
    def temp_export_file(self):
        """Create a temporary file for export testing."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as f:
            yield f.name
        # Cleanup
        if os.path.exists(f.name):
            os.unlink(f.name)

    def test_export_secrets_to_json_no_values(
        self, mock_redis_secrets, temp_export_file
    ):
        """Test exporting secrets metadata to JSON (without values)."""
        from scripts.secrets.migrate_secrets import export_secrets_metadata

        # Export metadata only
        result = export_secrets_metadata(mock_redis_secrets, temp_export_file)

        assert result["success"] is True
        assert result["count"] == 3

        # Verify file contents
        with open(temp_export_file) as f:
            exported = json.load(f)

        assert len(exported) == 3
        assert exported[0]["id"] == "cred-slack-abc123"
        # Should NOT contain decrypted values
        assert "value" not in exported[0]
        assert "key_encrypted" not in exported[0]

    def test_export_secrets_with_values(
        self, mock_redis_secrets, mock_decrypted_values, temp_export_file
    ):
        """Test exporting secrets with decrypted values for migration."""
        from scripts.secrets.migrate_secrets import export_secrets_with_values

        # Export with values
        result = export_secrets_with_values(
            mock_redis_secrets,
            mock_decrypted_values,
            temp_export_file,
        )

        assert result["success"] is True
        assert result["count"] == 3

        # Verify file contains values
        with open(temp_export_file) as f:
            exported = json.load(f)

        assert len(exported) == 3
        assert exported[0]["value"] == "xoxb-1234567890-abcdefghij"

    def test_dry_run_mode(self, mock_redis_secrets, mock_decrypted_values):
        """Test dry run mode does not write or import."""
        from scripts.secrets.migrate_secrets import migrate_secrets

        mock_target_client = AsyncMock()

        # Run migration in dry-run mode
        result = migrate_secrets(
            secrets=mock_redis_secrets,
            decrypted_values=mock_decrypted_values,
            target_client=mock_target_client,
            environment="dev",
            dry_run=True,
        )

        assert result["success"] is True
        assert result["migrated"] == 0
        assert result["would_migrate"] == 3
        # Target client should NOT be called in dry-run
        mock_target_client.set_secret.assert_not_called()

    @pytest.mark.asyncio
    async def test_import_to_infisical(
        self, mock_redis_secrets, mock_decrypted_values
    ):
        """Test importing secrets to Infisical backend."""
        from scripts.secrets.migrate_secrets import import_to_target

        mock_client = AsyncMock()
        mock_client.set_secret.return_value = True

        result = await import_to_target(
            secrets=mock_redis_secrets,
            decrypted_values=mock_decrypted_values,
            target_client=mock_client,
            environment="dev",
        )

        assert result["success"] is True
        assert result["imported"] == 3
        assert result["failed"] == 0

        # Verify set_secret was called for each secret
        assert mock_client.set_secret.call_count == 3

    @pytest.mark.asyncio
    async def test_import_partial_failure(
        self, mock_redis_secrets, mock_decrypted_values
    ):
        """Test handling of partial import failure."""
        from scripts.secrets.migrate_secrets import import_to_target

        mock_client = AsyncMock()
        # First two succeed, third fails
        mock_client.set_secret.side_effect = [True, True, False]

        result = await import_to_target(
            secrets=mock_redis_secrets,
            decrypted_values=mock_decrypted_values,
            target_client=mock_client,
            environment="dev",
        )

        assert result["success"] is False  # Overall failure due to partial
        assert result["imported"] == 2
        assert result["failed"] == 1
        assert len(result["failed_secrets"]) == 1

    @pytest.mark.asyncio
    async def test_verify_migration(self, mock_redis_secrets, mock_decrypted_values):
        """Test verification that all secrets are accessible after migration."""
        from scripts.secrets.migrate_secrets import verify_migration

        mock_client = AsyncMock()
        # All secrets are accessible
        mock_client.get_secret.side_effect = [
            "xoxb-1234567890-abcdefghij",
            "xapp-1234-abcdefghij",
            "sk-ant-1234567890abcdef",
        ]

        result = await verify_migration(
            secrets=mock_redis_secrets,
            target_client=mock_client,
            environment="dev",
        )

        assert result["success"] is True
        assert result["verified"] == 3
        assert result["missing"] == 0

    @pytest.mark.asyncio
    async def test_verify_migration_with_missing(
        self, mock_redis_secrets, mock_decrypted_values
    ):
        """Test verification detects missing secrets."""
        from scripts.secrets.migrate_secrets import verify_migration

        mock_client = AsyncMock()
        # One secret is missing
        mock_client.get_secret.side_effect = [
            "xoxb-1234567890-abcdefghij",
            None,  # Missing!
            "sk-ant-1234567890abcdef",
        ]

        result = await verify_migration(
            secrets=mock_redis_secrets,
            target_client=mock_client,
            environment="dev",
        )

        assert result["success"] is False
        assert result["verified"] == 2
        assert result["missing"] == 1
        assert "cred-slack-def456" in result["missing_secrets"]

    def test_secret_name_mapping(self):
        """Test mapping credential IDs to secret names."""
        from scripts.secrets.migrate_secrets import map_credential_to_secret_name

        # Test mappings
        assert (
            map_credential_to_secret_name("slack", "bot_token")
            == "SLACK_BOT_TOKEN"
        )
        assert (
            map_credential_to_secret_name("slack", "app_token")
            == "SLACK_APP_TOKEN"
        )
        assert (
            map_credential_to_secret_name("slack", "signing_secret")
            == "SLACK_SIGNING_SECRET"
        )
        assert (
            map_credential_to_secret_name("llm", "api_key", "anthropic")
            == "ANTHROPIC_API_KEY"
        )
        assert (
            map_credential_to_secret_name("llm", "api_key", "openai")
            == "OPENAI_API_KEY"
        )

    def test_no_secret_values_in_logs(self, caplog):
        """Test that secret values are never logged."""
        from scripts.secrets.migrate_secrets import log_migration_progress

        secret_value = "sk-ant-super-secret-key"

        # Log migration progress
        log_migration_progress(
            secret_id="cred-llm-abc123",
            secret_name="ANTHROPIC_API_KEY",
            secret_value=secret_value,
            action="importing",
        )

        # Check logs do not contain the secret value
        assert secret_value not in caplog.text
        assert "****" in caplog.text or "ANTHROPIC_API_KEY" in caplog.text

    def test_load_from_json_file(self, temp_export_file):
        """Test loading secrets from JSON file for import."""
        from scripts.secrets.migrate_secrets import load_secrets_from_json

        # Create a test JSON file
        test_data = [
            {
                "id": "cred-test-1",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Test Token",
                "value": "xoxb-test-value",
            }
        ]
        with open(temp_export_file, "w") as f:
            json.dump(test_data, f)

        result = load_secrets_from_json(temp_export_file)

        assert result["success"] is True
        assert len(result["secrets"]) == 1
        assert result["secrets"][0]["value"] == "xoxb-test-value"


class TestMigrationCLI:
    """Test CLI argument parsing and execution."""

    def test_parse_source_redis(self):
        """Test parsing --source redis option."""
        from scripts.secrets.migrate_secrets import parse_args

        args = parse_args([
            "--source", "redis",
            "--target", "infisical",
            "--environment", "dev",
        ])

        assert args.source == "redis"
        assert args.target == "infisical"
        assert args.environment == "dev"

    def test_parse_source_json(self):
        """Test parsing --source json-file option."""
        from scripts.secrets.migrate_secrets import parse_args

        args = parse_args([
            "--source", "json-file",
            "--source-file", "/path/to/secrets.json",
            "--target", "gcp",
            "--environment", "staging",
        ])

        assert args.source == "json-file"
        assert args.source_file == "/path/to/secrets.json"
        assert args.target == "gcp"
        assert args.environment == "staging"

    def test_dry_run_flag(self):
        """Test --dry-run flag."""
        from scripts.secrets.migrate_secrets import parse_args

        args = parse_args([
            "--source", "redis",
            "--target", "infisical",
            "--dry-run",
        ])

        assert args.dry_run is True

    def test_export_only_flag(self):
        """Test --export-only flag."""
        from scripts.secrets.migrate_secrets import parse_args

        args = parse_args([
            "--source", "redis",
            "--target", "infisical",
            "--export-only",
            "--export-file", "/tmp/export.json",
        ])

        assert args.export_only is True
        assert args.export_file == "/tmp/export.json"
