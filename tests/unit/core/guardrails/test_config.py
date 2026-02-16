"""Unit tests for guardrails configuration.

Tests cover GuardrailsConfig dataclass, from_env() loading,
to_dict() serialization, and environment variable parsing.
"""

from __future__ import annotations

import os

import pytest

from src.core.guardrails.config import GuardrailsConfig


# ---------------------------------------------------------------------------
# Test from_env() with defaults
# ---------------------------------------------------------------------------


def test_from_env_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that from_env() returns default values when no env vars are set."""
    # Clear all relevant env vars
    for key in [
        "GUARDRAILS_ENABLED",
        "ELASTICSEARCH_URL",
        "GUARDRAILS_INDEX_PREFIX",
        "GUARDRAILS_CACHE_TTL",
        "GUARDRAILS_FALLBACK_MODE",
        "GUARDRAILS_STATIC_FILE",
    ]:
        monkeypatch.delenv(key, raising=False)

    config = GuardrailsConfig.from_env()

    assert config.enabled is True
    assert config.elasticsearch_url == "http://localhost:9200"
    assert config.index_prefix == ""
    assert config.cache_ttl == 60.0
    assert config.fallback_mode == "static"
    assert config.static_file_path == ".claude/guardrails-static.json"


# ---------------------------------------------------------------------------
# Test from_env() with custom env vars
# ---------------------------------------------------------------------------


def test_from_env_custom_values(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that from_env() reads custom values from environment variables."""
    monkeypatch.setenv("GUARDRAILS_ENABLED", "false")
    monkeypatch.setenv("ELASTICSEARCH_URL", "http://es.example.com:9200")
    monkeypatch.setenv("GUARDRAILS_INDEX_PREFIX", "tenant1")
    monkeypatch.setenv("GUARDRAILS_CACHE_TTL", "120.5")
    monkeypatch.setenv("GUARDRAILS_FALLBACK_MODE", "restrictive")

    config = GuardrailsConfig.from_env()

    assert config.enabled is False
    assert config.elasticsearch_url == "http://es.example.com:9200"
    assert config.index_prefix == "tenant1"
    assert config.cache_ttl == 120.5
    assert config.fallback_mode == "restrictive"


def test_from_env_partial_custom(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that from_env() combines custom and default values."""
    # Only set some env vars
    monkeypatch.setenv("GUARDRAILS_ENABLED", "true")
    monkeypatch.setenv("GUARDRAILS_INDEX_PREFIX", "dev")
    # Leave others at defaults

    config = GuardrailsConfig.from_env()

    assert config.enabled is True
    assert config.elasticsearch_url == "http://localhost:9200"  # default
    assert config.index_prefix == "dev"
    assert config.cache_ttl == 60.0  # default
    assert config.fallback_mode == "static"  # default


# ---------------------------------------------------------------------------
# Test boolean parsing for GUARDRAILS_ENABLED
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "env_value,expected",
    [
        ("true", True),
        ("TRUE", True),
        ("True", True),
        ("1", True),
        ("false", False),
        ("FALSE", False),
        ("False", False),
        ("0", False),
        ("", False),
        ("no", False),
        ("yes", False),  # Not "true" or "1", so False
        ("anything", False),
    ],
)
def test_from_env_enabled_boolean_parsing(
    env_value: str, expected: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test that GUARDRAILS_ENABLED is parsed correctly.

    Accept "true"/"1" (case-insensitive) as True, everything else as False.
    """
    monkeypatch.setenv("GUARDRAILS_ENABLED", env_value)

    config = GuardrailsConfig.from_env()

    assert config.enabled is expected


# ---------------------------------------------------------------------------
# Test to_dict() round-trip
# ---------------------------------------------------------------------------


def test_to_dict_includes_all_fields() -> None:
    """Test that to_dict() includes all configuration fields."""
    config = GuardrailsConfig(
        enabled=False,
        elasticsearch_url="http://test:9200",
        index_prefix="test_prefix",
        cache_ttl=30.0,
        fallback_mode="restrictive",
        static_file_path="custom/path.json",
    )

    result = config.to_dict()

    assert result == {
        "enabled": False,
        "elasticsearch_url": "http://test:9200",
        "index_prefix": "test_prefix",
        "cache_ttl": 30.0,
        "fallback_mode": "restrictive",
        "static_file_path": "custom/path.json",
    }


def test_to_dict_round_trip() -> None:
    """Test that config can be serialized and reconstructed."""
    original = GuardrailsConfig(
        enabled=True,
        elasticsearch_url="http://custom:9200",
        index_prefix="tenant",
        cache_ttl=45.0,
        fallback_mode="permissive",
        static_file_path=".claude/guardrails-static.json",
    )

    # Serialize
    config_dict = original.to_dict()

    # Reconstruct
    reconstructed = GuardrailsConfig(**config_dict)

    assert reconstructed == original


# ---------------------------------------------------------------------------
# Test immutability (frozen=True)
# ---------------------------------------------------------------------------


def test_config_is_frozen() -> None:
    """Test that GuardrailsConfig is immutable (frozen dataclass)."""
    import dataclasses

    config = GuardrailsConfig()

    with pytest.raises(
        dataclasses.FrozenInstanceError, match="cannot assign to field"
    ):
        config.enabled = False  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Test enabled=False flag
# ---------------------------------------------------------------------------


def test_enabled_false() -> None:
    """Test that config can be created with enabled=False."""
    config = GuardrailsConfig(enabled=False)

    assert config.enabled is False
    # Other fields should still have defaults
    assert config.elasticsearch_url == "http://localhost:9200"
    assert config.index_prefix == ""
    assert config.cache_ttl == 60.0
    assert config.fallback_mode == "static"
    assert config.static_file_path == ".claude/guardrails-static.json"


# ---------------------------------------------------------------------------
# Test static fallback configuration
# ---------------------------------------------------------------------------


def test_from_env_static_file_custom(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that GUARDRAILS_STATIC_FILE env var is read correctly."""
    monkeypatch.setenv("GUARDRAILS_STATIC_FILE", "/custom/path/guidelines.json")

    config = GuardrailsConfig.from_env()

    assert config.static_file_path == "/custom/path/guidelines.json"


def test_from_env_static_fallback_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that fallback_mode=static is the default."""
    monkeypatch.delenv("GUARDRAILS_FALLBACK_MODE", raising=False)

    config = GuardrailsConfig.from_env()

    assert config.fallback_mode == "static"


def test_to_dict_includes_static_file_path() -> None:
    """Test that to_dict() includes static_file_path."""
    config = GuardrailsConfig(static_file_path="my/file.json")

    result = config.to_dict()

    assert result["static_file_path"] == "my/file.json"
