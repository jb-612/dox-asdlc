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
