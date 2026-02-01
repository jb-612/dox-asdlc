"""Unit tests for secrets migration script."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestLoadSecretsFromJson:
    """Tests for reading secrets from JSON file."""

    def test_load_secrets_from_json_file(self, tmp_path: Path):
        """Test reading secrets from a JSON file."""
        from scripts.secrets.migrate_secrets import load_secrets_from_json

        # Create test JSON file
        json_file = tmp_path / "secrets.json"
        secrets_data = [
            {
                "id": "cred-slack-abc",
                "name": "SLACK_BOT_TOKEN",
                "value": "xoxb-test-token",
                "integration_type": "slack",
            },
            {
                "id": "cred-anthropic-def",
                "name": "ANTHROPIC_API_KEY",
                "value": "sk-ant-test",
                "integration_type": "anthropic",
            },
        ]
        json_file.write_text(json.dumps(secrets_data))

        result = load_secrets_from_json(str(json_file))

        assert result["success"] is True
        assert len(result["secrets"]) == 2
        assert result["secrets"][0]["name"] == "SLACK_BOT_TOKEN"
        assert result["secrets"][0]["value"] == "xoxb-test-token"

    def test_load_secrets_from_missing_file(self, tmp_path: Path):
        """Test reading from missing file returns error."""
        from scripts.secrets.migrate_secrets import load_secrets_from_json

        result = load_secrets_from_json(str(tmp_path / "nonexistent.json"))

        assert result["success"] is False
        assert "not found" in result["error"].lower()

    def test_load_secrets_from_invalid_json(self, tmp_path: Path):
        """Test reading from invalid JSON returns error."""
        from scripts.secrets.migrate_secrets import load_secrets_from_json

        json_file = tmp_path / "invalid.json"
        json_file.write_text("not valid json")

        result = load_secrets_from_json(str(json_file))

        assert result["success"] is False
        assert "invalid json" in result["error"].lower()


class TestExportSecretsMetadata:
    """Tests for exporting secrets metadata to JSON file."""

    def test_export_secrets_metadata(self, tmp_path: Path):
        """Test exporting secrets metadata to JSON file."""
        from scripts.secrets.migrate_secrets import export_secrets_metadata

        secrets = [
            {
                "id": "cred-slack-abc",
                "name": "SLACK_BOT_TOKEN",
                "key_encrypted": "encrypted-value-123",
                "key_masked": "xoxb...abc",
                "integration_type": "slack",
            },
            {
                "id": "cred-anthropic-def",
                "name": "ANTHROPIC_API_KEY",
                "key_encrypted": "encrypted-value-456",
                "key_masked": "sk-a...def",
                "integration_type": "anthropic",
            },
        ]
        output_file = tmp_path / "export.json"

        result = export_secrets_metadata(secrets, str(output_file))

        assert result["success"] is True
        assert result["count"] == 2

        # Read back and verify
        with open(output_file) as f:
            exported = json.load(f)

        assert len(exported) == 2
        # Encrypted values should NOT be in the export
        assert "encrypted-value-123" not in str(exported)
        assert "key_encrypted" not in str(exported)


class TestExportSecretsWithValues:
    """Tests for exporting secrets with decrypted values."""

    def test_export_secrets_with_values(self, tmp_path: Path):
        """Test exporting secrets with values to JSON file."""
        from scripts.secrets.migrate_secrets import export_secrets_with_values

        secrets = [
            {
                "id": "cred-slack-abc",
                "name": "SLACK_BOT_TOKEN",
                "key_encrypted": "encrypted-value-123",
                "integration_type": "slack",
            },
        ]
        decrypted_values = {
            "cred-slack-abc": "xoxb-actual-token-value",
        }
        output_file = tmp_path / "export.json"

        result = export_secrets_with_values(secrets, decrypted_values, str(output_file))

        assert result["success"] is True
        assert result["count"] == 1

        # Read back and verify
        with open(output_file) as f:
            exported = json.load(f)

        assert exported[0]["value"] == "xoxb-actual-token-value"
        # Encrypted values should NOT be in the export
        assert "key_encrypted" not in str(exported)


class TestImportToTarget:
    """Tests for writing secrets to target backend."""

    @pytest.mark.asyncio
    async def test_import_to_target_success(self):
        """Test importing secrets to target backend."""
        from scripts.secrets.migrate_secrets import import_to_target

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(return_value=True)

        secrets = [
            {"id": "cred-1", "integration_type": "slack", "credential_type": "bot_token"},
            {"id": "cred-2", "integration_type": "llm", "credential_type": "api_key", "provider": "anthropic"},
        ]
        decrypted_values = {
            "cred-1": "value1",
            "cred-2": "value2",
        }

        result = await import_to_target(
            secrets=secrets,
            decrypted_values=decrypted_values,
            target_client=mock_client,
            environment="dev",
        )

        assert result["success"] is True
        assert result["imported"] == 2
        assert result["failed"] == 0
        assert mock_client.set_secret.call_count == 2

    @pytest.mark.asyncio
    async def test_import_handles_missing_values(self):
        """Test that import skips secrets with missing values."""
        from scripts.secrets.migrate_secrets import import_to_target

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(return_value=True)

        secrets = [
            {"id": "cred-1", "integration_type": "slack", "credential_type": "bot_token"},
            {"id": "cred-2", "integration_type": "slack", "credential_type": "app_token"},
        ]
        # Only provide value for first secret
        decrypted_values = {
            "cred-1": "value1",
        }

        result = await import_to_target(
            secrets=secrets,
            decrypted_values=decrypted_values,
            target_client=mock_client,
            environment="dev",
        )

        assert result["imported"] == 1
        assert result["failed"] == 1
        assert "cred-2" in result["failed_secrets"]

    @pytest.mark.asyncio
    async def test_import_handles_client_failure(self):
        """Test that import handles individual failures gracefully."""
        from scripts.secrets.migrate_secrets import import_to_target

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(side_effect=[True, False, True])

        secrets = [
            {"id": "cred-1", "integration_type": "slack", "credential_type": "bot_token"},
            {"id": "cred-2", "integration_type": "slack", "credential_type": "app_token"},
            {"id": "cred-3", "integration_type": "slack", "credential_type": "signing_secret"},
        ]
        decrypted_values = {
            "cred-1": "value1",
            "cred-2": "value2",
            "cred-3": "value3",
        }

        result = await import_to_target(
            secrets=secrets,
            decrypted_values=decrypted_values,
            target_client=mock_client,
            environment="dev",
        )

        assert result["imported"] == 2
        assert result["failed"] == 1


class TestVerifyMigration:
    """Tests for verifying secrets after migration."""

    @pytest.mark.asyncio
    async def test_verify_all_secrets_accessible(self):
        """Test verifying all secrets are accessible after migration."""
        from scripts.secrets.migrate_secrets import verify_migration

        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(return_value="some-value")

        secrets = [
            {"id": "cred-1", "integration_type": "slack", "credential_type": "bot_token"},
            {"id": "cred-2", "integration_type": "slack", "credential_type": "app_token"},
        ]

        result = await verify_migration(secrets, mock_client, "dev")

        assert result["success"] is True
        assert result["verified"] == 2
        assert result["missing"] == 0

    @pytest.mark.asyncio
    async def test_verify_reports_missing_secrets(self):
        """Test that verify reports missing secrets."""
        from scripts.secrets.migrate_secrets import verify_migration

        mock_client = AsyncMock()
        mock_client.get_secret = AsyncMock(side_effect=["value1", None, "value3"])

        secrets = [
            {"id": "cred-1", "integration_type": "slack", "credential_type": "bot_token"},
            {"id": "cred-2", "integration_type": "slack", "credential_type": "app_token"},
            {"id": "cred-3", "integration_type": "slack", "credential_type": "signing_secret"},
        ]

        result = await verify_migration(secrets, mock_client, "dev")

        assert result["success"] is False
        assert result["verified"] == 2
        assert result["missing"] == 1
        assert "cred-2" in result["missing_secrets"]


class TestCLIArgs:
    """Tests for CLI argument parsing."""

    def test_parse_args_defaults(self):
        """Test that parse_args has correct defaults."""
        from scripts.secrets.migrate_secrets import parse_args

        args = parse_args([])

        assert args.source == "redis"
        assert args.target == "infisical"
        assert args.environment == "dev"
        assert args.dry_run is False

    def test_parse_args_all_options(self):
        """Test parsing all CLI options."""
        from scripts.secrets.migrate_secrets import parse_args

        args = parse_args([
            "--source", "json-file",
            "--source-file", "/tmp/secrets.json",
            "--target", "gcp",
            "--environment", "staging",
            "--dry-run",
            "--export-only",
            "--export-file", "/tmp/export.json",
            "--verify",
        ])

        assert args.source == "json-file"
        assert args.source_file == "/tmp/secrets.json"
        assert args.target == "gcp"
        assert args.environment == "staging"
        assert args.dry_run is True
        assert args.export_only is True
        assert args.export_file == "/tmp/export.json"
        assert args.verify is True


class TestCredentialMapping:
    """Tests for credential to secret name mapping."""

    def test_map_slack_bot_token(self):
        """Test mapping slack bot_token credential."""
        from scripts.secrets.migrate_secrets import map_credential_to_secret_name

        result = map_credential_to_secret_name("slack", "bot_token")

        assert result == "SLACK_BOT_TOKEN"

    def test_map_slack_app_token(self):
        """Test mapping slack app_token credential."""
        from scripts.secrets.migrate_secrets import map_credential_to_secret_name

        result = map_credential_to_secret_name("slack", "app_token")

        assert result == "SLACK_APP_TOKEN"

    def test_map_llm_key_with_provider(self):
        """Test mapping LLM API key with provider."""
        from scripts.secrets.migrate_secrets import map_credential_to_secret_name

        result = map_credential_to_secret_name("llm", "api_key", "anthropic")

        assert result == "ANTHROPIC_API_KEY"

    def test_map_unknown_generates_name(self):
        """Test mapping unknown credentials generates a name."""
        from scripts.secrets.migrate_secrets import map_credential_to_secret_name

        result = map_credential_to_secret_name("custom", "my_token")

        assert result == "CUSTOM_MY_TOKEN"


class TestMigrateSecrets:
    """Tests for the migrate_secrets function."""

    def test_migrate_dry_run_returns_counts(self):
        """Test that dry run returns expected counts."""
        from scripts.secrets.migrate_secrets import migrate_secrets

        mock_client = MagicMock()

        secrets = [
            {"id": "cred-1", "integration_type": "slack", "credential_type": "bot_token"},
            {"id": "cred-2", "integration_type": "slack", "credential_type": "app_token"},
        ]
        decrypted_values = {
            "cred-1": "value1",
            "cred-2": "value2",
        }

        result = migrate_secrets(
            secrets=secrets,
            decrypted_values=decrypted_values,
            target_client=mock_client,
            environment="dev",
            dry_run=True,
        )

        assert result["dry_run"] is True
        assert result["would_migrate"] == 2
        assert result["migrated"] == 0


class TestGetTargetClient:
    """Tests for getting target client."""

    def test_get_infisical_client(self):
        """Test getting Infisical client."""
        from scripts.secrets.migrate_secrets import get_target_client

        # Patch where it's imported, not where it's defined
        with patch("src.infrastructure.secrets.infisical_client.InfisicalSecretsClient") as mock_cls:
            mock_cls.return_value = MagicMock()

            client = get_target_client("infisical")

            mock_cls.assert_called_once()
            assert client is mock_cls.return_value

    def test_get_gcp_client(self):
        """Test getting GCP client."""
        from scripts.secrets.migrate_secrets import get_target_client

        # Patch where it's imported, not where it's defined
        with patch("src.infrastructure.secrets.gcp_client.GCPSecretsClient") as mock_cls:
            mock_cls.return_value = MagicMock()

            client = get_target_client("gcp")

            mock_cls.assert_called_once()
            assert client is mock_cls.return_value

    def test_get_unknown_client_raises(self):
        """Test that unknown backend raises error."""
        from scripts.secrets.migrate_secrets import get_target_client

        with pytest.raises(ValueError, match="Unknown target"):
            get_target_client("unknown")
