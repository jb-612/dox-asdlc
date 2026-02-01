"""Unit tests for dev secrets seeding script."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestSeedConfig:
    """Tests for SeedConfig dataclass."""

    def test_config_defaults(self):
        """Test that SeedConfig has sensible defaults."""
        from scripts.secrets.seed_dev_secrets import SeedConfig

        config = SeedConfig()

        assert config.environment == "dev"
        assert config.backend == "infisical"
        assert config.template_file is None
        assert config.skip_existing is False

    def test_config_with_values(self):
        """Test that SeedConfig accepts custom values."""
        from scripts.secrets.seed_dev_secrets import SeedConfig

        config = SeedConfig(
            environment="staging",
            backend="gcp",
            template_file="/tmp/template.yaml",
            skip_existing=True,
        )

        assert config.environment == "staging"
        assert config.backend == "gcp"
        assert config.template_file == "/tmp/template.yaml"
        assert config.skip_existing is True


class TestSeedStats:
    """Tests for SeedStats dataclass."""

    def test_stats_defaults_to_zero(self):
        """Test that SeedStats defaults all counts to zero."""
        from scripts.secrets.seed_dev_secrets import SeedStats

        stats = SeedStats()

        assert stats.secrets_required == 0
        assert stats.secrets_seeded == 0
        assert stats.secrets_skipped == 0
        assert stats.secrets_failed == 0

    def test_stats_summary(self):
        """Test that stats summary produces readable output."""
        from scripts.secrets.seed_dev_secrets import SeedStats

        stats = SeedStats(
            secrets_required=6,
            secrets_seeded=4,
            secrets_skipped=2,
            secrets_failed=0,
        )

        summary = stats.summary()

        assert "6" in summary
        assert "4" in summary
        assert "seeded" in summary.lower()


class TestLoadTemplate:
    """Tests for loading secrets template file."""

    def test_load_yaml_template(self, tmp_path: Path):
        """Test loading YAML template file."""
        from scripts.secrets.seed_dev_secrets import load_template

        template_file = tmp_path / "template.yaml"
        template_content = """
secrets:
  - name: SLACK_BOT_TOKEN
    description: Slack bot OAuth token
    required: true
    example: xoxb-your-bot-token
  - name: ANTHROPIC_API_KEY
    description: Anthropic API key for Claude
    required: true
    example: sk-ant-api-key
  - name: OPENAI_API_KEY
    description: OpenAI API key (optional)
    required: false
    example: sk-openai-key
"""
        template_file.write_text(template_content)

        secrets = load_template(str(template_file))

        assert len(secrets) == 3
        assert secrets[0]["name"] == "SLACK_BOT_TOKEN"
        assert secrets[0]["required"] is True
        assert secrets[2]["required"] is False

    def test_load_template_missing_file(self, tmp_path: Path):
        """Test loading from missing file raises FileNotFoundError."""
        from scripts.secrets.seed_dev_secrets import load_template

        with pytest.raises(FileNotFoundError):
            load_template(str(tmp_path / "nonexistent.yaml"))

    def test_load_template_invalid_yaml(self, tmp_path: Path):
        """Test loading from invalid YAML raises ValueError."""
        from scripts.secrets.seed_dev_secrets import load_template

        template_file = tmp_path / "invalid.yaml"
        template_file.write_text("this: is: not: valid: yaml:")

        with pytest.raises(ValueError):
            load_template(str(template_file))


class TestGetSecretValue:
    """Tests for getting secret values from env or prompting."""

    def test_get_value_from_env(self, monkeypatch):
        """Test getting value from environment variable."""
        from scripts.secrets.seed_dev_secrets import get_secret_value

        monkeypatch.setenv("MY_SECRET", "env-value")

        value = get_secret_value("MY_SECRET", required=True, example="example")

        assert value == "env-value"

    def test_get_value_returns_none_when_missing_optional(self, monkeypatch):
        """Test returns None for missing optional secret."""
        from scripts.secrets.seed_dev_secrets import get_secret_value

        monkeypatch.delenv("MISSING_SECRET", raising=False)

        # Mock input to return empty string
        with patch("builtins.input", return_value=""):
            value = get_secret_value(
                "MISSING_SECRET",
                required=False,
                example="example",
                interactive=False,
            )

        assert value is None


class TestSeedSecrets:
    """Tests for seeding secrets to backend."""

    @pytest.mark.asyncio
    async def test_seed_secrets_creates_all(self):
        """Test seeding creates all required secrets."""
        from scripts.secrets.seed_dev_secrets import seed_secrets, SeedStats

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(return_value=True)
        mock_client.get_secret = AsyncMock(return_value=None)  # No existing

        secrets = [
            {"name": "SECRET_1", "value": "value1"},
            {"name": "SECRET_2", "value": "value2"},
        ]
        stats = SeedStats()

        await seed_secrets(
            secrets=secrets,
            client=mock_client,
            environment="dev",
            skip_existing=False,
            stats=stats,
        )

        assert stats.secrets_seeded == 2
        assert mock_client.set_secret.call_count == 2

    @pytest.mark.asyncio
    async def test_seed_secrets_skips_existing(self):
        """Test seeding skips existing secrets when flag is set."""
        from scripts.secrets.seed_dev_secrets import seed_secrets, SeedStats

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(return_value=True)
        # First secret exists, second doesn't
        mock_client.get_secret = AsyncMock(side_effect=["existing-value", None])

        secrets = [
            {"name": "EXISTING_SECRET", "value": "value1"},
            {"name": "NEW_SECRET", "value": "value2"},
        ]
        stats = SeedStats()

        await seed_secrets(
            secrets=secrets,
            client=mock_client,
            environment="dev",
            skip_existing=True,
            stats=stats,
        )

        assert stats.secrets_seeded == 1
        assert stats.secrets_skipped == 1
        assert mock_client.set_secret.call_count == 1

    @pytest.mark.asyncio
    async def test_seed_secrets_overwrites_when_not_skipping(self):
        """Test seeding overwrites existing when skip_existing is False."""
        from scripts.secrets.seed_dev_secrets import seed_secrets, SeedStats

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(return_value=True)
        mock_client.get_secret = AsyncMock(return_value="existing-value")

        secrets = [
            {"name": "EXISTING_SECRET", "value": "new-value"},
        ]
        stats = SeedStats()

        await seed_secrets(
            secrets=secrets,
            client=mock_client,
            environment="dev",
            skip_existing=False,
            stats=stats,
        )

        assert stats.secrets_seeded == 1
        assert stats.secrets_skipped == 0

    @pytest.mark.asyncio
    async def test_seed_secrets_handles_failure(self):
        """Test seeding handles failures gracefully."""
        from scripts.secrets.seed_dev_secrets import seed_secrets, SeedStats

        mock_client = AsyncMock()
        mock_client.set_secret = AsyncMock(side_effect=[True, False])
        mock_client.get_secret = AsyncMock(return_value=None)

        secrets = [
            {"name": "SECRET_1", "value": "value1"},
            {"name": "SECRET_2", "value": "value2"},
        ]
        stats = SeedStats()

        await seed_secrets(
            secrets=secrets,
            client=mock_client,
            environment="dev",
            skip_existing=False,
            stats=stats,
        )

        assert stats.secrets_seeded == 1
        assert stats.secrets_failed == 1


class TestCLIArgs:
    """Tests for CLI argument parsing."""

    def test_parse_args_defaults(self):
        """Test that parse_args has correct defaults."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args([])

        assert args.environment == "dev"
        assert args.backend == "infisical"
        assert args.template_file is None
        assert args.skip_existing is False
        assert args.interactive is True

    def test_parse_args_all_options(self):
        """Test parsing all CLI options."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args([
            "--environment", "staging",
            "--backend", "gcp",
            "--template-file", "/tmp/template.yaml",
            "--skip-existing",
            "--no-interactive",
        ])

        assert args.environment == "staging"
        assert args.backend == "gcp"
        assert args.template_file == "/tmp/template.yaml"
        assert args.skip_existing is True
        assert args.interactive is False


class TestRequiredSecrets:
    """Tests for required secrets list."""

    def test_required_secrets_includes_slack(self):
        """Test that required secrets include Slack tokens."""
        from scripts.secrets.seed_dev_secrets import REQUIRED_SECRETS

        slack_secrets = [s for s in REQUIRED_SECRETS if "SLACK" in s["name"]]

        assert len(slack_secrets) >= 3  # BOT_TOKEN, APP_TOKEN, SIGNING_SECRET

    def test_required_secrets_includes_anthropic(self):
        """Test that required secrets include Anthropic key."""
        from scripts.secrets.seed_dev_secrets import REQUIRED_SECRETS

        anthropic_secrets = [s for s in REQUIRED_SECRETS if "ANTHROPIC" in s["name"]]

        assert len(anthropic_secrets) >= 1

    def test_required_secrets_have_descriptions(self):
        """Test that all required secrets have descriptions."""
        from scripts.secrets.seed_dev_secrets import REQUIRED_SECRETS

        for secret in REQUIRED_SECRETS:
            assert "description" in secret
            assert len(secret["description"]) > 0


class TestDefaultTemplate:
    """Tests for default template file."""

    def test_default_template_path_exists(self):
        """Test that DEFAULT_TEMPLATE_PATH is defined."""
        from scripts.secrets.seed_dev_secrets import DEFAULT_TEMPLATE_PATH

        assert DEFAULT_TEMPLATE_PATH is not None
        assert "template" in DEFAULT_TEMPLATE_PATH.lower()
