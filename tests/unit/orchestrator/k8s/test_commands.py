"""Tests for K8s command security whitelist validation.

Tests the CommandValidator and execute_command functions for:
- Action whitelist validation
- Resource whitelist validation
- Namespace format validation
- Flag whitelist validation
- Command injection prevention
"""

from __future__ import annotations

import pytest

from src.orchestrator.k8s.commands import (
    ALLOWED_ACTIONS,
    ALLOWED_FLAGS,
    ALLOWED_RESOURCES,
    CommandNotAllowedError,
    CommandValidator,
    build_kubectl_command,
)
from src.orchestrator.k8s.models import CommandRequest


class TestCommandValidator:
    """Tests for CommandValidator."""

    @pytest.fixture
    def validator(self) -> CommandValidator:
        """Create a command validator instance."""
        return CommandValidator()

    def test_valid_get_pods_command(self, validator: CommandValidator) -> None:
        """Test that valid get pods command passes validation."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="default",
            flags=["-o", "json"],
        )
        # Should not raise
        validator.validate(request)

    def test_valid_describe_nodes_command(self, validator: CommandValidator) -> None:
        """Test that valid describe nodes command passes validation."""
        request = CommandRequest(
            action="describe",
            resource="nodes",
            namespace=None,
            flags=["--show-labels"],
        )
        validator.validate(request)

    def test_valid_logs_command(self, validator: CommandValidator) -> None:
        """Test that valid logs command passes validation."""
        request = CommandRequest(
            action="logs",
            resource="pods",
            namespace="kube-system",
            flags=["--tail", "100", "-f"],
        )
        validator.validate(request)

    def test_invalid_action_rejected(self, validator: CommandValidator) -> None:
        """Test that invalid actions are rejected."""
        request = CommandRequest(
            action="delete",  # Not in whitelist
            resource="pods",
            namespace="default",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "delete" in str(exc_info.value)

    def test_invalid_resource_rejected(self, validator: CommandValidator) -> None:
        """Test that invalid resources are rejected."""
        request = CommandRequest(
            action="get",
            resource="secrets",  # Not in whitelist
            namespace="default",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "secrets" in str(exc_info.value)

    def test_invalid_flag_rejected(self, validator: CommandValidator) -> None:
        """Test that invalid flags are rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="default",
            flags=["--delete-all"],  # Not in whitelist
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "--delete-all" in str(exc_info.value)

    def test_command_injection_semicolon_rejected(self, validator: CommandValidator) -> None:
        """Test that semicolon injection is rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="default; rm -rf /",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "disallowed characters" in str(exc_info.value)

    def test_command_injection_pipe_rejected(self, validator: CommandValidator) -> None:
        """Test that pipe injection is rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="default",
            flags=["-o | cat /etc/passwd"],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "disallowed characters" in str(exc_info.value)

    def test_command_injection_backtick_rejected(self, validator: CommandValidator) -> None:
        """Test that backtick injection is rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="`whoami`",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "disallowed characters" in str(exc_info.value)

    def test_command_injection_dollar_rejected(self, validator: CommandValidator) -> None:
        """Test that $ injection is rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="default",
            flags=["$(cat /etc/passwd)"],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "disallowed characters" in str(exc_info.value)

    def test_newline_in_namespace_rejected(self, validator: CommandValidator) -> None:
        """Test that newline injection is rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="default\nrm -rf /",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "newline" in str(exc_info.value)

    def test_invalid_namespace_format_rejected(self, validator: CommandValidator) -> None:
        """Test that invalid namespace format is rejected."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="Invalid-Namespace",  # Uppercase not allowed
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "DNS label" in str(exc_info.value)

    def test_empty_action_rejected(self, validator: CommandValidator) -> None:
        """Test that empty action is rejected."""
        request = CommandRequest(
            action="",
            resource="pods",
            namespace="default",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "empty" in str(exc_info.value).lower()

    def test_empty_resource_rejected(self, validator: CommandValidator) -> None:
        """Test that empty resource is rejected."""
        request = CommandRequest(
            action="get",
            resource="",
            namespace="default",
            flags=[],
        )
        with pytest.raises(CommandNotAllowedError) as exc_info:
            validator.validate(request)
        assert "empty" in str(exc_info.value).lower()


class TestBuildKubectlCommand:
    """Tests for build_kubectl_command function."""

    def test_basic_command(self) -> None:
        """Test basic command building."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace=None,
            flags=[],
        )
        cmd = build_kubectl_command(request)
        assert cmd == ["kubectl", "get", "pods"]

    def test_command_with_namespace(self) -> None:
        """Test command building with namespace."""
        request = CommandRequest(
            action="get",
            resource="pods",
            namespace="kube-system",
            flags=[],
        )
        cmd = build_kubectl_command(request)
        assert cmd == ["kubectl", "get", "pods", "-n", "kube-system"]

    def test_command_with_flags(self) -> None:
        """Test command building with flags."""
        request = CommandRequest(
            action="describe",
            resource="nodes",
            namespace=None,
            flags=["--show-labels", "-o", "wide"],
        )
        cmd = build_kubectl_command(request)
        assert cmd == ["kubectl", "describe", "nodes", "--show-labels", "-o", "wide"]

    def test_command_with_namespace_and_flags(self) -> None:
        """Test command building with namespace and flags."""
        request = CommandRequest(
            action="logs",
            resource="pods",
            namespace="default",
            flags=["--tail", "50", "-f"],
        )
        cmd = build_kubectl_command(request)
        assert cmd == ["kubectl", "logs", "pods", "-n", "default", "--tail", "50", "-f"]


class TestAllowedWhitelists:
    """Tests for the whitelist constants."""

    def test_allowed_actions_are_readonly(self) -> None:
        """Test that all allowed actions are read-only operations."""
        dangerous_actions = {"delete", "create", "apply", "patch", "edit", "replace"}
        assert ALLOWED_ACTIONS.isdisjoint(dangerous_actions)

    def test_allowed_resources_exclude_secrets(self) -> None:
        """Test that secrets and configmaps are not in allowed resources."""
        sensitive_resources = {"secrets", "configmaps"}
        assert ALLOWED_RESOURCES.isdisjoint(sensitive_resources)

    def test_allowed_flags_exclude_dangerous_flags(self) -> None:
        """Test that dangerous flags are not allowed."""
        dangerous_flags = {"--force", "--grace-period=0", "--now", "--cascade"}
        assert ALLOWED_FLAGS.isdisjoint(dangerous_flags)
