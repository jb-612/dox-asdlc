"""Kubernetes command execution with whitelist security.

Provides secure kubectl command execution with strict validation.
Commands are parameterized and reconstructed server-side.
Raw command strings are NEVER accepted.
"""

from __future__ import annotations

import logging
import re
import subprocess
import time
from typing import Final

from src.orchestrator.k8s.models import CommandRequest, CommandResponse

logger = logging.getLogger(__name__)

ALLOWED_ACTIONS: Final[frozenset[str]] = frozenset({
    "get", "describe", "logs", "top",
})

ALLOWED_RESOURCES: Final[frozenset[str]] = frozenset({
    "pods", "nodes", "services", "deployments", "events",
    "ingresses", "namespaces", "replicasets", "statefulsets",
    "daemonsets", "jobs", "cronjobs", "endpoints",
    "persistentvolumeclaims", "persistentvolumes", "componentstatuses",
})

ALLOWED_FLAGS: Final[frozenset[str]] = frozenset({
    "-o", "--output", "-n", "--namespace", "-l", "--selector",
    "-w", "--watch", "--all-namespaces", "-A", "--show-labels",
    "--tail", "--since", "--since-time", "-c", "--container",
    "-p", "--previous", "-f", "--follow", "--timestamps",
    "--sort-by", "--field-selector",
})

DISALLOWED_CHARS: Final[re.Pattern[str]] = re.compile(r"[;|&`(){}[\]<>!\\$]")
NAMESPACE_PATTERN: Final[re.Pattern[str]] = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")


class CommandNotAllowedError(Exception):
    """Raised when a command is not in the allowed whitelist."""
    pass


class CommandExecutionError(Exception):
    """Raised when command execution fails."""
    pass


class CommandValidator:
    """Validates kubectl commands against security whitelist."""

    def __init__(
        self,
        allowed_actions: frozenset[str] | None = None,
        allowed_resources: frozenset[str] | None = None,
        allowed_flags: frozenset[str] | None = None,
    ) -> None:
        self.allowed_actions = allowed_actions or ALLOWED_ACTIONS
        self.allowed_resources = allowed_resources or ALLOWED_RESOURCES
        self.allowed_flags = allowed_flags or ALLOWED_FLAGS

    def validate(self, request: CommandRequest) -> None:
        """Validate a command request against the whitelist."""
        self._validate_action(request.action)
        self._validate_resource(request.resource)
        self._validate_namespace(request.namespace)
        self._validate_flags(request.flags)

    def _validate_action(self, action: str) -> None:
        if not action:
            raise CommandNotAllowedError("Action cannot be empty")
        if action not in self.allowed_actions:
            raise CommandNotAllowedError(
                f"Action '{action}' is not allowed. Allowed: {sorted(self.allowed_actions)}"
            )

    def _validate_resource(self, resource: str) -> None:
        if not resource:
            raise CommandNotAllowedError("Resource cannot be empty")
        if resource not in self.allowed_resources:
            raise CommandNotAllowedError(
                f"Resource '{resource}' is not allowed. Allowed: {sorted(self.allowed_resources)}"
            )

    def _validate_namespace(self, namespace: str | None) -> None:
        if namespace is None:
            return
        if DISALLOWED_CHARS.search(namespace):
            raise CommandNotAllowedError(
                f"Invalid namespace '{namespace}': contains disallowed characters"
            )
        if "\n" in namespace or "\r" in namespace:
            raise CommandNotAllowedError(
                f"Invalid namespace '{namespace}': contains newline characters"
            )
        if not NAMESPACE_PATTERN.match(namespace):
            raise CommandNotAllowedError(
                f"Invalid namespace '{namespace}': must be a valid DNS label"
            )

    def _validate_flags(self, flags: list[str]) -> None:
        for flag in flags:
            if DISALLOWED_CHARS.search(flag):
                raise CommandNotAllowedError(
                    f"Flag '{flag}' contains disallowed characters"
                )
            if "\n" in flag or "\r" in flag:
                raise CommandNotAllowedError(
                    f"Flag '{flag}' contains newline characters"
                )
            if flag.startswith("-"):
                flag_name = flag.split("=")[0]
                if flag_name not in self.allowed_flags:
                    raise CommandNotAllowedError(
                        f"Flag '{flag_name}' is not allowed. Allowed: {sorted(self.allowed_flags)}"
                    )


def build_kubectl_command(request: CommandRequest) -> list[str]:
    """Build a kubectl command array from a validated request."""
    cmd = ["kubectl", request.action, request.resource]
    if request.namespace:
        cmd.extend(["-n", request.namespace])
    cmd.extend(request.flags)
    return cmd


async def execute_command(request: CommandRequest, timeout: int = 30) -> CommandResponse:
    """Execute a kubectl command safely.
    
    Args:
        request: The command request with action, resource, namespace, and flags.
        timeout: Maximum time in seconds to wait for command completion.
        
    Returns:
        CommandResponse with output, exit_code, duration, and any error.
        
    Raises:
        CommandNotAllowedError: If the command fails validation.
        CommandExecutionError: If command execution fails unexpectedly.
    """
    validator = CommandValidator()
    validator.validate(request)
    cmd = build_kubectl_command(request)
    logger.info(f"Executing command: {' '.join(cmd)}")
    start_time = time.monotonic()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        duration = int((time.monotonic() - start_time) * 1000)
        return CommandResponse(
            output=result.stdout,
            exit_code=result.returncode,
            duration=duration,
            error=result.stderr if result.returncode != 0 else None,
        )
    except subprocess.TimeoutExpired:
        duration = int((time.monotonic() - start_time) * 1000)
        return CommandResponse(
            output="",
            exit_code=-1,
            duration=duration,
            error=f"Command timed out after {timeout} seconds",
        )
    except Exception as e:
        duration = int((time.monotonic() - start_time) * 1000)
        raise CommandExecutionError(f"Command execution failed: {e}") from e
