"""Prompts for Release agent.

Provides prompts for release manifest generation and changelog creation
with structured output format for version tracking and artifact management.
"""

from __future__ import annotations

from typing import Any


RELEASE_MANIFEST_PROMPT = """You are an expert release engineer generating release manifests.

Your task is to create a comprehensive release manifest that documents the version,
included features, artifacts, and rollback procedures for a software release.

## Release Manifest Requirements

1. **Version Information**: Semantic version following semver conventions
2. **Feature Documentation**: List all features included in this release
3. **Artifact Registry**: Document all deployable artifacts with checksums
4. **Rollback Plan**: Clear steps to revert to previous version if needed

## Artifact Types

- **docker_image**: Container images with registry location and tag
- **helm_chart**: Kubernetes Helm charts with version
- **binary**: Compiled executables with platform info
- **config**: Configuration files or ConfigMaps
- **documentation**: Release notes and documentation updates

## Manifest Structure

For each release, document:
- Release version and timestamp
- Git SHA or commit reference
- List of feature IDs (e.g., P01-F01, P02-F03)
- Changelog summary
- All artifacts with:
  - Name and type
  - Location (registry URL, path)
  - Checksum for integrity verification
- Rollback plan with specific commands

## Output Format

Provide your manifest as structured JSON:

```json
{
  "version": "1.2.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "git_sha": "abc123...",
  "features": [
    {
      "id": "P01-F01",
      "title": "Feature title",
      "description": "Brief description"
    }
  ],
  "changelog": "## Added\\n- Feature 1\\n## Fixed\\n- Bug 1",
  "artifacts": [
    {
      "name": "service-api",
      "artifact_type": "docker_image",
      "location": "registry.example.com/service-api:1.2.0",
      "checksum": "sha256:abc123..."
    }
  ],
  "rollback_plan": {
    "steps": [
      "kubectl rollout undo deployment/service-api",
      "helm rollback release-name 1"
    ],
    "previous_version": "1.1.0",
    "estimated_duration": "5 minutes"
  },
  "approvals": [],
  "notes": "Additional release notes"
}
```
"""


CHANGELOG_PROMPT = """You are an expert technical writer generating release changelogs.

Your task is to create a clear, well-organized changelog from commit messages,
following conventional changelog format and categorizing changes appropriately.

## Changelog Categories

Organize changes into these categories:

### Breaking Changes
- Changes that break backward compatibility
- API changes requiring consumer updates
- Removed features or deprecated functionality

### Features (feat)
- New functionality
- New API endpoints
- New configuration options

### Bug Fixes (fix)
- Resolved issues and defects
- Corrected behavior
- Security patches

### Performance
- Speed improvements
- Memory optimizations
- Resource efficiency gains

### Documentation
- README updates
- API documentation
- Code comments

### Maintenance
- Dependency updates
- Refactoring
- Internal improvements

## Changelog Guidelines

1. **Be concise**: One line per change
2. **Use present tense**: "Add feature" not "Added feature"
3. **Reference issues**: Include issue/PR numbers when available
4. **Highlight breaking changes**: Mark prominently with [BREAKING]
5. **Group by category**: Organize for easy scanning

## Output Format

Provide your changelog as structured JSON with markdown content:

```json
{
  "version": "1.2.0",
  "date": "2024-01-15",
  "sections": {
    "breaking": [
      "Remove deprecated API endpoint /v1/legacy"
    ],
    "features": [
      "Add user authentication via SSO (#123)",
      "Implement batch processing for orders"
    ],
    "fixes": [
      "Fix null pointer in payment processing (#456)",
      "Correct timezone handling in reports"
    ],
    "performance": [],
    "documentation": [
      "Update API documentation for v2 endpoints"
    ],
    "maintenance": [
      "Upgrade lodash to 4.17.21"
    ]
  },
  "markdown": "## [1.2.0] - 2024-01-15\\n\\n### Breaking Changes\\n- Remove deprecated API endpoint\\n\\n### Features\\n- Add user authentication...",
  "summary": "This release adds SSO authentication and fixes payment processing issues."
}
```
"""


def format_release_manifest_prompt(
    version: str,
    features: list[str],
    artifacts: list[dict[str, Any]],
    commits: list[str] | None = None,
    previous_version: str | None = None,
    git_sha: str | None = None,
) -> str:
    """Format the release manifest prompt with release information.

    Args:
        version: Semantic version of the release.
        features: List of feature IDs included in this release.
        artifacts: List of artifact dictionaries with name, type, location.
        commits: Optional list of commit messages for changelog.
        previous_version: Optional previous version for comparison.
        git_sha: Optional git SHA for the release commit.

    Returns:
        str: Formatted prompt for release manifest generation.
    """
    prompt_parts = [
        RELEASE_MANIFEST_PROMPT,
        "",
        "## Release Information",
        "",
        f"**Version:** {version}",
    ]

    if previous_version:
        prompt_parts.append(f"**Previous Version:** {previous_version}")

    if git_sha:
        prompt_parts.append(f"**Git SHA:** {git_sha}")

    prompt_parts.append("")

    # Add features
    if features:
        prompt_parts.extend(["## Features to Include", ""])
        for feature in features:
            prompt_parts.append(f"- {feature}")
        prompt_parts.append("")

    # Add artifacts
    if artifacts:
        prompt_parts.extend(["## Artifacts", ""])
        for artifact in artifacts:
            name = artifact.get("name", "unknown")
            artifact_type = artifact.get("type", "unknown")
            location = artifact.get("location", "unknown")
            prompt_parts.append(f"- **{name}** ({artifact_type}): {location}")
        prompt_parts.append("")

    # Add commits for changelog generation
    if commits:
        prompt_parts.extend(["## Commits", ""])
        for commit in commits:
            prompt_parts.append(f"- {commit}")
        prompt_parts.append("")

    prompt_parts.extend([
        "## Instructions",
        "",
        "Generate a complete release manifest following the output format above.",
        "Include all features and artifacts in the manifest.",
        "Create a clear rollback plan with specific commands.",
        "Return results as structured JSON.",
    ])

    return "\n".join(prompt_parts)


def format_changelog_prompt(
    commits: list[str],
    version: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    previous_changelog: str | None = None,
) -> str:
    """Format the changelog prompt with commit information.

    Args:
        commits: List of commit messages to process.
        version: Optional version for the changelog header.
        from_date: Optional start date for the changelog period.
        to_date: Optional end date for the changelog period.
        previous_changelog: Optional previous changelog for context.

    Returns:
        str: Formatted prompt for changelog generation.
    """
    prompt_parts = [
        CHANGELOG_PROMPT,
        "",
        "## Changelog Context",
        "",
    ]

    if version:
        prompt_parts.append(f"**Version:** {version}")

    if from_date or to_date:
        date_range = []
        if from_date:
            date_range.append(f"from {from_date}")
        if to_date:
            date_range.append(f"to {to_date}")
        prompt_parts.append(f"**Date Range:** {' '.join(date_range)}")

    prompt_parts.append("")

    # Add commits
    prompt_parts.extend(["## Commits to Process", ""])
    for commit in commits:
        prompt_parts.append(f"- {commit}")
    prompt_parts.append("")

    if previous_changelog:
        prompt_parts.extend([
            "## Previous Changelog (for context)",
            "",
            previous_changelog,
            "",
        ])

    prompt_parts.extend([
        "## Instructions",
        "",
        "Categorize the commits into appropriate changelog sections.",
        "Follow conventional changelog format.",
        "Highlight any breaking changes prominently.",
        "Generate both structured JSON and markdown output.",
        "Provide a brief summary of the release.",
    ])

    return "\n".join(prompt_parts)
