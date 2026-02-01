"""API routes for integration credentials management.

Provides REST endpoints for managing third-party integration credentials
(Slack, Teams, GitHub) used by the HITL bridge and automation systems.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.infrastructure.secrets.client import get_secrets_client
from src.infrastructure.secrets.service import get_secrets_service, IntegrationType


logger = logging.getLogger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================


class IntegrationCredentialResponse(BaseModel):
    """Response model for an integration credential."""

    id: str
    integration_type: str = Field(alias="integrationType")
    name: str
    credential_type: str = Field(alias="credentialType")
    key_masked: str = Field(alias="keyMasked")
    created_at: str = Field(alias="createdAt")
    last_used: str | None = Field(alias="lastUsed")
    status: str
    last_test_message: str | None = Field(None, alias="lastTestMessage")

    class Config:
        populate_by_name = True


class AddIntegrationCredentialRequest(BaseModel):
    """Request to add a new integration credential."""

    integration_type: str = Field(alias="integrationType")
    name: str
    credential_type: str = Field(alias="credentialType")
    key: str

    class Config:
        populate_by_name = True


class TestCredentialResponse(BaseModel):
    """Response from testing a credential."""

    valid: bool
    message: str
    tested_at: str = Field(alias="testedAt")
    details: dict[str, str] | None = None

    class Config:
        populate_by_name = True


class SecretsHealthResponse(BaseModel):
    """Response for secrets backend health check."""

    status: str
    backend: str
    details: dict[str, Any] | None = None
    error: str | None = None


# ============================================================================
# Router
# ============================================================================


router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationCredentialResponse])
async def list_integration_credentials(
    integration_type: str | None = None,
) -> list[dict[str, Any]]:
    """List all integration credentials.

    Args:
        integration_type: Optional filter by integration type (slack, teams, github).

    Returns:
        List of credentials with masked values.
    """
    service = get_secrets_service()
    credentials = await service.list_credentials(integration_type=integration_type)

    # Map to response format
    result = []
    for cred in credentials:
        result.append({
            "id": cred["id"],
            "integrationType": cred["integration_type"],
            "name": cred["name"],
            "credentialType": cred["credential_type"],
            "keyMasked": cred["key_masked"],
            "createdAt": cred["created_at"],
            "lastUsed": cred.get("last_used"),
            "status": "valid" if cred.get("is_valid", True) else "invalid",
            "lastTestMessage": None,  # Not stored in current implementation
        })

    return result


@router.post("", response_model=IntegrationCredentialResponse)
async def add_integration_credential(
    request: AddIntegrationCredentialRequest,
) -> dict[str, Any]:
    """Add a new integration credential.

    The credential value is encrypted before storage.

    Args:
        request: The credential to add.

    Returns:
        The created credential with masked value.
    """
    # Validate integration type
    valid_types = [t.value for t in IntegrationType]
    if request.integration_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid integration type. Must be one of: {valid_types}",
        )

    service = get_secrets_service()

    # Store the credential
    cred_id = await service.store(
        integration_type=request.integration_type,
        credential_type=request.credential_type,
        name=request.name,
        value=request.key,
    )

    # Get the metadata to return
    metadata = await service.get_credential_metadata(cred_id)
    if not metadata:
        raise HTTPException(status_code=500, detail="Failed to retrieve created credential")

    return {
        "id": metadata["id"],
        "integrationType": metadata["integration_type"],
        "name": metadata["name"],
        "credentialType": metadata["credential_type"],
        "keyMasked": metadata["key_masked"],
        "createdAt": metadata["created_at"],
        "lastUsed": metadata.get("last_used"),
        "status": "untested",
        "lastTestMessage": None,
    }


@router.get("/health", response_model=SecretsHealthResponse)
async def secrets_health() -> dict[str, Any]:
    """Check the health of the secrets backend.

    Returns health status including:
    - Backend type (env, infisical, gcp)
    - Connection status
    - Any errors or warnings

    Returns:
        Health status response with backend details.
    """
    from fastapi.responses import JSONResponse

    try:
        client = get_secrets_client()
        backend_type = getattr(client, "backend_type", "unknown")

        # For environment backend, always healthy (no external dependencies)
        if backend_type == "env":
            return {
                "status": "healthy",
                "backend": backend_type,
                "details": {"source": "environment variables"},
                "error": None,
            }

        # For other backends, perform health check if available
        if hasattr(client, "health_check"):
            health_result = await client.health_check()
            # Check if there's a warning (degraded state)
            if health_result.get("quota_warning"):
                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "degraded",
                        "backend": backend_type,
                        "details": health_result,
                        "error": None,
                    },
                )
            return {
                "status": "healthy",
                "backend": backend_type,
                "details": health_result,
                "error": None,
            }
        else:
            # Backend doesn't support health check, assume healthy
            return {
                "status": "healthy",
                "backend": backend_type,
                "details": None,
                "error": None,
            }

    except Exception as e:
        logger.exception("Secrets backend health check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "backend": "unknown",
                "details": None,
                "error": str(e),
            },
        )


@router.delete("/{credential_id}")
async def delete_integration_credential(credential_id: str) -> dict[str, bool]:
    """Delete an integration credential.

    Args:
        credential_id: The ID of the credential to delete.

    Returns:
        Success status.
    """
    service = get_secrets_service()
    deleted = await service.delete(credential_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Credential not found")

    return {"deleted": True}


@router.post("/{credential_id}/test", response_model=TestCredentialResponse)
async def test_integration_credential(credential_id: str) -> dict[str, Any]:
    """Test an integration credential.

    Calls the integration's test endpoint (e.g., Slack auth.test)
    to verify the credential is valid.

    Args:
        credential_id: The ID of the credential to test.

    Returns:
        Test result with validity status and message.
    """
    service = get_secrets_service()

    try:
        result = await service.test(credential_id)
        return {
            "valid": result.get("success", False),
            "message": result.get("message", "Test completed"),
            "testedAt": datetime.now(timezone.utc).isoformat(),
            "details": result.get("details"),
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to test credential {credential_id}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


class TestMessageResponse(BaseModel):
    """Response from sending a test message."""

    success: bool
    message: str
    channel: str | None = None
    timestamp: str | None = None
    tested_at: str = Field(alias="testedAt")
    error: str | None = None

    class Config:
        populate_by_name = True


@router.post("/{credential_id}/test-message", response_model=TestMessageResponse)
async def send_test_message(credential_id: str, channel: str = "general") -> dict[str, Any]:
    """Send a test message to Slack using the bot token.

    This sends an actual message to verify the Slack integration is working.

    Args:
        credential_id: The ID of the bot_token credential.
        channel: The channel to send to (default: general).

    Returns:
        Result with success status, channel, and message timestamp.
    """
    service = get_secrets_service()

    try:
        # Get the credential metadata
        metadata = await service.get_credential_metadata(credential_id)
        if not metadata:
            raise HTTPException(status_code=404, detail="Credential not found")

        if metadata.get("credential_type") != "bot_token":
            raise HTTPException(
                status_code=400,
                detail="Test messages can only be sent with bot_token credentials"
            )

        # Get the actual token value
        token = await service.retrieve(credential_id)
        if not token:
            raise HTTPException(status_code=404, detail="Token value not found")

        # Send test message using Slack SDK
        from slack_sdk.web.async_client import AsyncWebClient

        client = AsyncWebClient(token=token)

        # Send the test message
        # Channel IDs start with C, don't add # prefix for those
        channel_ref = channel if channel.startswith("C") else f"#{channel}"
        response = await client.chat_postMessage(
            channel=channel_ref,
            text=f"🧪 *Test message from aSDLC Admin*\n\nThis is a test message sent at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} to verify Slack integration.",
        )

        if response.get("ok"):
            return {
                "success": True,
                "message": f"Test message sent successfully to #{channel}",
                "channel": response.get("channel"),
                "timestamp": response.get("ts"),
                "testedAt": datetime.now(timezone.utc).isoformat(),
            }
        else:
            return {
                "success": False,
                "message": "Failed to send message",
                "error": response.get("error", "Unknown error"),
                "testedAt": datetime.now(timezone.utc).isoformat(),
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to send test message with credential {credential_id}")
        return {
            "success": False,
            "message": "Failed to send test message",
            "error": str(e),
            "testedAt": datetime.now(timezone.utc).isoformat(),
        }


@router.get("/{credential_id}", response_model=IntegrationCredentialResponse)
async def get_integration_credential(credential_id: str) -> dict[str, Any]:
    """Get a single integration credential by ID.

    Args:
        credential_id: The ID of the credential.

    Returns:
        The credential with masked value.
    """
    service = get_secrets_service()
    metadata = await service.get_credential_metadata(credential_id)

    if not metadata:
        raise HTTPException(status_code=404, detail="Credential not found")

    return {
        "id": metadata["id"],
        "integrationType": metadata["integration_type"],
        "name": metadata["name"],
        "credentialType": metadata["credential_type"],
        "keyMasked": metadata["key_masked"],
        "createdAt": metadata["created_at"],
        "lastUsed": metadata.get("last_used"),
        "status": "valid" if metadata.get("is_valid", True) else "invalid",
        "lastTestMessage": None,
    }
