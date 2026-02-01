"""Tests for development secrets seeding script."""

import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml


class TestDevSecretsSeeding:
    """Test development secrets seeding functionality."""

    @pytest.fixture
    def temp_template_file(self):
        """Create a temporary template file."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False
        ) as f:
            template = {
                "secrets": [
                    {
                        "name": "SLACK_BOT_TOKEN",
                        "description": "Slack Bot OAuth Token",
                        "required": True,
                        "pattern": "^xoxb-.*$",
                        "env_var": "SLACK_BOT_TOKEN",
                    },
                    {
                        "name": "SLACK_APP_TOKEN",
                        "description": "Slack App-Level Token",
                        "required": True,
                        "pattern": "^xapp-.*$",
                        "env_var": "SLACK_APP_TOKEN",
                    },
                    {
                        "name": "ANTHROPIC_API_KEY",
                        "description": "Anthropic Claude API Key",
                        "required": True,
                        "pattern": "^sk-ant-.*$",
                        "env_var": "ANTHROPIC_API_KEY",
                    },
                    {
                        "name": "OPENAI_API_KEY",
                        "description": "OpenAI API Key",
                        "required": False,
                        "pattern": "^sk-.*$",
                        "env_var": "OPENAI_API_KEY",
                    },
                ],
            }
            yaml.dump(template, f)
            yield f.name
        # Cleanup
        if os.path.exists(f.name):
            os.unlink(f.name)

    def test_load_template(self, temp_template_file):
        """Test loading the secrets template file."""
        from scripts.secrets.seed_dev_secrets import load_template

        result = load_template(temp_template_file)

        assert result["success"] is True
        assert len(result["secrets"]) == 4
        assert result["secrets"][0]["name"] == "SLACK_BOT_TOKEN"
        assert result["secrets"][0]["required"] is True

    def test_load_template_not_found(self):
        """Test error when template file not found."""
        from scripts.secrets.seed_dev_secrets import load_template

        result = load_template("/nonexistent/template.yaml")

        assert result["success"] is False
        assert "not found" in result["error"].lower()

    def test_validate_secret_value(self):
        """Test secret value validation against pattern."""
        from scripts.secrets.seed_dev_secrets import validate_secret_value

        # Valid Slack bot token
        assert validate_secret_value("xoxb-123-456", "^xoxb-.*$") is True

        # Invalid Slack bot token
        assert validate_secret_value("invalid-token", "^xoxb-.*$") is False

        # Valid Anthropic key
        assert validate_secret_value("sk-ant-abc123", "^sk-ant-.*$") is True

        # No pattern means any value is valid
        assert validate_secret_value("anything", None) is True

    def test_get_secret_from_env(self, temp_template_file):
        """Test getting secret values from environment variables."""
        from scripts.secrets.seed_dev_secrets import get_secret_values_from_env

        # Set up environment
        with patch.dict(os.environ, {
            "SLACK_BOT_TOKEN": "xoxb-from-env",
            "ANTHROPIC_API_KEY": "sk-ant-from-env",
        }):
            result = get_secret_values_from_env([
                {"name": "SLACK_BOT_TOKEN", "env_var": "SLACK_BOT_TOKEN"},
                {"name": "SLACK_APP_TOKEN", "env_var": "SLACK_APP_TOKEN"},
                {"name": "ANTHROPIC_API_KEY", "env_var": "ANTHROPIC_API_KEY"},
            ])

        assert result["SLACK_BOT_TOKEN"] == "xoxb-from-env"
        assert result["ANTHROPIC_API_KEY"] == "sk-ant-from-env"
        assert "SLACK_APP_TOKEN" not in result  # Not in env

    def test_check_required_secrets(self, temp_template_file):
        """Test checking for missing required secrets."""
        from scripts.secrets.seed_dev_secrets import check_required_secrets

        template_secrets = [
            {"name": "SLACK_BOT_TOKEN", "required": True},
            {"name": "SLACK_APP_TOKEN", "required": True},
            {"name": "OPENAI_API_KEY", "required": False},
        ]

        provided = {
            "SLACK_BOT_TOKEN": "xoxb-123",
            # SLACK_APP_TOKEN missing!
        }

        result = check_required_secrets(template_secrets, provided)

        assert result["complete"] is False
        assert "SLACK_APP_TOKEN" in result["missing"]
        assert "OPENAI_API_KEY" not in result["missing"]  # Not required

    @pytest.mark.asyncio
    async def test_seed_secrets_to_client(self):
        """Test seeding secrets to the secrets client."""
        from scripts.secrets.seed_dev_secrets import seed_secrets

        mock_client = AsyncMock()
        mock_client.set_secret.return_value = True

        secrets = {
            "SLACK_BOT_TOKEN": "xoxb-123",
            "ANTHROPIC_API_KEY": "sk-ant-456",
        }

        result = await seed_secrets(
            secrets=secrets,
            client=mock_client,
            environment="dev",
        )

        assert result["success"] is True
        assert result["seeded"] == 2
        assert mock_client.set_secret.call_count == 2

    @pytest.mark.asyncio
    async def test_seed_secrets_partial_failure(self):
        """Test handling partial failure during seeding."""
        from scripts.secrets.seed_dev_secrets import seed_secrets

        mock_client = AsyncMock()
        mock_client.set_secret.side_effect = [True, False]

        secrets = {
            "SLACK_BOT_TOKEN": "xoxb-123",
            "ANTHROPIC_API_KEY": "sk-ant-456",
        }

        result = await seed_secrets(
            secrets=secrets,
            client=mock_client,
            environment="dev",
        )

        assert result["success"] is False
        assert result["seeded"] == 1
        assert result["failed"] == 1

    @pytest.mark.asyncio
    async def test_verify_seeded_secrets(self):
        """Test verification of seeded secrets."""
        from scripts.secrets.seed_dev_secrets import verify_seeded_secrets

        mock_client = AsyncMock()
        mock_client.get_secret.side_effect = ["xoxb-123", "sk-ant-456"]

        secret_names = ["SLACK_BOT_TOKEN", "ANTHROPIC_API_KEY"]

        result = await verify_seeded_secrets(
            secret_names=secret_names,
            client=mock_client,
            environment="dev",
        )

        assert result["success"] is True
        assert result["verified"] == 2
        assert result["missing"] == 0

    def test_no_secrets_logged(self, caplog):
        """Test that secret values are never logged during seeding."""
        from scripts.secrets.seed_dev_secrets import log_seed_progress

        secret_value = "sk-ant-super-secret"

        log_seed_progress(
            secret_name="ANTHROPIC_API_KEY",
            secret_value=secret_value,
            action="seeding",
        )

        assert secret_value not in caplog.text
        # Should see the name but not the value
        assert "ANTHROPIC_API_KEY" in caplog.text


class TestSeedDevSecretsCLI:
    """Test CLI argument parsing and execution."""

    def test_parse_args_defaults(self):
        """Test default argument values."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args([])

        assert args.environment == "dev"
        assert args.template is not None  # Has default path
        assert args.interactive is False

    def test_parse_args_interactive(self):
        """Test --interactive flag."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args(["--interactive"])

        assert args.interactive is True

    def test_parse_args_custom_template(self):
        """Test custom template path."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args([
            "--template", "/custom/template.yaml",
            "--environment", "staging",
        ])

        assert args.template == "/custom/template.yaml"
        assert args.environment == "staging"

    def test_parse_args_backend(self):
        """Test --backend flag."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args(["--backend", "infisical"])

        assert args.backend == "infisical"

    def test_parse_args_force(self):
        """Test --force flag for overwriting existing secrets."""
        from scripts.secrets.seed_dev_secrets import parse_args

        args = parse_args(["--force"])

        assert args.force is True


class TestDevSecretsTemplate:
    """Test the development secrets template file."""

    def test_template_structure(self):
        """Test the template file has required structure."""
        template_path = Path(__file__).parent.parent.parent.parent.parent / \
            "scripts/secrets/dev-secrets.template.yaml"

        if not template_path.exists():
            pytest.skip("Template file not yet created")

        with open(template_path) as f:
            template = yaml.safe_load(f)

        assert "secrets" in template
        assert len(template["secrets"]) > 0

        # Each secret should have required fields
        for secret in template["secrets"]:
            assert "name" in secret
            assert "description" in secret
            assert "required" in secret

    def test_template_has_required_secrets(self):
        """Test template includes all required secrets."""
        template_path = Path(__file__).parent.parent.parent.parent.parent / \
            "scripts/secrets/dev-secrets.template.yaml"

        if not template_path.exists():
            pytest.skip("Template file not yet created")

        with open(template_path) as f:
            template = yaml.safe_load(f)

        secret_names = [s["name"] for s in template["secrets"]]

        # Required secrets per task specification
        required = [
            "SLACK_BOT_TOKEN",
            "SLACK_APP_TOKEN",
            "SLACK_SIGNING_SECRET",
            "ANTHROPIC_API_KEY",
        ]

        for req in required:
            assert req in secret_names, f"Missing required secret: {req}"

        # Optional secrets should also be present
        optional = [
            "OPENAI_API_KEY",
            "GOOGLE_AI_API_KEY",
        ]

        for opt in optional:
            assert opt in secret_names, f"Missing optional secret: {opt}"
