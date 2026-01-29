"""Unit tests for Release agent prompts.

Tests for release manifest generation and changelog creation prompts
with structured output format.
"""

from __future__ import annotations

import pytest

from src.workers.agents.deployment.prompts.release_prompts import (
    RELEASE_MANIFEST_PROMPT,
    CHANGELOG_PROMPT,
    format_release_manifest_prompt,
    format_changelog_prompt,
)


class TestReleaseManifestPrompt:
    """Tests for release manifest prompt."""

    def test_prompt_exists(self) -> None:
        """Test that release manifest prompt is defined."""
        assert RELEASE_MANIFEST_PROMPT is not None
        assert len(RELEASE_MANIFEST_PROMPT) > 100

    def test_prompt_mentions_release(self) -> None:
        """Test that prompt mentions release or manifest."""
        prompt_lower = RELEASE_MANIFEST_PROMPT.lower()
        assert "release" in prompt_lower or "manifest" in prompt_lower

    def test_prompt_mentions_version(self) -> None:
        """Test that prompt mentions version information."""
        prompt_lower = RELEASE_MANIFEST_PROMPT.lower()
        assert "version" in prompt_lower

    def test_prompt_mentions_artifacts(self) -> None:
        """Test that prompt mentions artifacts."""
        prompt_lower = RELEASE_MANIFEST_PROMPT.lower()
        assert "artifact" in prompt_lower

    def test_prompt_mentions_rollback(self) -> None:
        """Test that prompt mentions rollback plan."""
        prompt_lower = RELEASE_MANIFEST_PROMPT.lower()
        assert "rollback" in prompt_lower

    def test_prompt_has_structured_output(self) -> None:
        """Test that prompt includes structured output format."""
        assert "json" in RELEASE_MANIFEST_PROMPT.lower()


class TestChangelogPrompt:
    """Tests for changelog generation prompt."""

    def test_prompt_exists(self) -> None:
        """Test that changelog prompt is defined."""
        assert CHANGELOG_PROMPT is not None
        assert len(CHANGELOG_PROMPT) > 100

    def test_prompt_mentions_changelog(self) -> None:
        """Test that prompt mentions changelog."""
        prompt_lower = CHANGELOG_PROMPT.lower()
        assert "changelog" in prompt_lower or "change log" in prompt_lower

    def test_prompt_mentions_commits(self) -> None:
        """Test that prompt mentions commits or changes."""
        prompt_lower = CHANGELOG_PROMPT.lower()
        assert "commit" in prompt_lower or "change" in prompt_lower

    def test_prompt_mentions_categories(self) -> None:
        """Test that prompt mentions change categories."""
        prompt_lower = CHANGELOG_PROMPT.lower()
        # Should mention common changelog categories
        assert (
            "feat" in prompt_lower
            or "fix" in prompt_lower
            or "breaking" in prompt_lower
            or "categor" in prompt_lower
        )

    def test_prompt_has_structured_output(self) -> None:
        """Test that prompt includes structured output format."""
        assert "json" in CHANGELOG_PROMPT.lower()


class TestFormatReleaseManifestPrompt:
    """Tests for format_release_manifest_prompt function."""

    def test_formats_with_version_and_features(self) -> None:
        """Test that function formats prompt with version and features."""
        version = "1.2.0"
        features = ["P01-F01", "P01-F02"]
        artifacts = [
            {"name": "app", "type": "docker_image", "location": "registry/app:1.2.0"}
        ]

        result = format_release_manifest_prompt(
            version=version,
            features=features,
            artifacts=artifacts,
        )

        assert "1.2.0" in result
        assert "P01-F01" in result or "P01-F02" in result

    def test_includes_artifacts(self) -> None:
        """Test that function includes artifact information."""
        result = format_release_manifest_prompt(
            version="1.0.0",
            features=["F01"],
            artifacts=[
                {"name": "backend", "type": "docker_image", "location": "reg/backend:1.0.0"}
            ],
        )

        assert "backend" in result or "docker" in result.lower()

    def test_includes_optional_commits(self) -> None:
        """Test that function includes optional commit information."""
        result = format_release_manifest_prompt(
            version="1.0.0",
            features=["F01"],
            artifacts=[],
            commits=["feat: add login", "fix: password validation"],
        )

        assert "login" in result or "password" in result

    def test_includes_optional_previous_version(self) -> None:
        """Test that function includes optional previous version for comparison."""
        result = format_release_manifest_prompt(
            version="1.1.0",
            features=["F01"],
            artifacts=[],
            previous_version="1.0.0",
        )

        assert "1.0.0" in result

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_release_manifest_prompt(
            version="1.0.0",
            features=[],
            artifacts=[],
        )

        assert "json" in result.lower() or "structured" in result.lower()


class TestFormatChangelogPrompt:
    """Tests for format_changelog_prompt function."""

    def test_formats_with_commits(self) -> None:
        """Test that function formats prompt with commits."""
        commits = [
            "feat(auth): add SSO support",
            "fix(api): handle null responses",
            "docs: update README",
        ]

        result = format_changelog_prompt(commits=commits)

        assert "SSO" in result or "auth" in result

    def test_includes_version_info(self) -> None:
        """Test that function includes version information."""
        result = format_changelog_prompt(
            commits=["feat: new feature"],
            version="2.0.0",
        )

        assert "2.0.0" in result

    def test_includes_optional_date_range(self) -> None:
        """Test that function includes optional date range."""
        result = format_changelog_prompt(
            commits=["feat: change"],
            from_date="2024-01-01",
            to_date="2024-01-15",
        )

        assert "2024-01-01" in result or "2024-01-15" in result

    def test_output_mentions_categories(self) -> None:
        """Test that output mentions change categories."""
        result = format_changelog_prompt(commits=["feat: test"])

        prompt_lower = result.lower()
        assert (
            "feat" in prompt_lower
            or "fix" in prompt_lower
            or "breaking" in prompt_lower
            or "categor" in prompt_lower
        )

    def test_output_has_structured_format(self) -> None:
        """Test that output includes structured output format."""
        result = format_changelog_prompt(commits=["test"])

        assert "json" in result.lower() or "markdown" in result.lower()
