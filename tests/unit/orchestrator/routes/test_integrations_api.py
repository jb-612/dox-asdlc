"""Unit tests for integrations API routes."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.orchestrator.routes.integrations_api import router


@pytest.fixture
def app():
    """Create a test FastAPI app with the integrations router."""
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def mock_secrets_service():
    """Mock the secrets service."""
    with patch("src.orchestrator.routes.integrations_api.get_secrets_service") as mock:
        service = AsyncMock()
        mock.return_value = service
        yield service


class TestListIntegrationCredentials:
    """Tests for GET /api/integrations."""

    def test_list_returns_all_credentials(self, client, mock_secrets_service):
        """Test that list returns all credentials."""
        mock_secrets_service.list_credentials.return_value = [
            {
                "id": "cred-slack-abc",
                "integration_type": "slack",
                "credential_type": "bot_token",
                "name": "Test Bot",
                "key_masked": "xoxb...abc",
                "created_at": "2025-01-01T00:00:00Z",
                "last_used": None,
                "is_valid": True,
            }
        ]

        response = client.get("/api/integrations")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "cred-slack-abc"
        assert data[0]["integrationType"] == "slack"

    def test_list_filters_by_type(self, client, mock_secrets_service):
        """Test that list filters by integration type."""
        mock_secrets_service.list_credentials.return_value = []

        response = client.get("/api/integrations?integration_type=slack")

        assert response.status_code == 200
        mock_secrets_service.list_credentials.assert_called_once_with(
            integration_type="slack"
        )


class TestAddIntegrationCredential:
    """Tests for POST /api/integrations."""

    def test_add_creates_credential(self, client, mock_secrets_service):
        """Test that add creates a new credential."""
        mock_secrets_service.store.return_value = "cred-slack-new123"
        mock_secrets_service.get_credential_metadata.return_value = {
            "id": "cred-slack-new123",
            "integration_type": "slack",
            "credential_type": "bot_token",
            "name": "New Bot",
            "key_masked": "xoxb...new",
            "created_at": "2025-01-01T00:00:00Z",
            "last_used": None,
            "is_valid": True,
        }

        response = client.post(
            "/api/integrations",
            json={
                "integrationType": "slack",
                "credentialType": "bot_token",
                "name": "New Bot",
                "key": "xoxb-test-token",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "cred-slack-new123"
        assert data["status"] == "untested"

    def test_add_rejects_invalid_type(self, client, mock_secrets_service):
        """Test that add rejects invalid integration types."""
        response = client.post(
            "/api/integrations",
            json={
                "integrationType": "invalid",
                "credentialType": "token",
                "name": "Test",
                "key": "test-value",
            },
        )

        assert response.status_code == 400
        assert "Invalid integration type" in response.json()["detail"]


class TestDeleteIntegrationCredential:
    """Tests for DELETE /api/integrations/{id}."""

    def test_delete_removes_credential(self, client, mock_secrets_service):
        """Test that delete removes the credential."""
        mock_secrets_service.delete.return_value = True

        response = client.delete("/api/integrations/cred-slack-abc")

        assert response.status_code == 200
        assert response.json()["deleted"] is True

    def test_delete_returns_404_for_missing(self, client, mock_secrets_service):
        """Test that delete returns 404 for missing credential."""
        mock_secrets_service.delete.return_value = False

        response = client.delete("/api/integrations/nonexistent")

        assert response.status_code == 404


class TestTestIntegrationCredential:
    """Tests for POST /api/integrations/{id}/test."""

    def test_test_returns_result(self, client, mock_secrets_service):
        """Test that test returns the result."""
        mock_secrets_service.test.return_value = {
            "success": True,
            "message": "Valid bot token for team: TestTeam",
            "details": {"team": "TestTeam"},
        }

        response = client.post("/api/integrations/cred-slack-abc/test")

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert "TestTeam" in data["message"]

    def test_test_returns_404_for_missing(self, client, mock_secrets_service):
        """Test that test returns 404 for missing credential."""
        mock_secrets_service.test.side_effect = KeyError("Credential not found")

        response = client.post("/api/integrations/nonexistent/test")

        assert response.status_code == 404


class TestGetIntegrationCredential:
    """Tests for GET /api/integrations/{id}."""

    def test_get_returns_credential(self, client, mock_secrets_service):
        """Test that get returns the credential."""
        mock_secrets_service.get_credential_metadata.return_value = {
            "id": "cred-slack-abc",
            "integration_type": "slack",
            "credential_type": "bot_token",
            "name": "Test Bot",
            "key_masked": "xoxb...abc",
            "created_at": "2025-01-01T00:00:00Z",
            "last_used": None,
            "is_valid": True,
        }

        response = client.get("/api/integrations/cred-slack-abc")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "cred-slack-abc"
        assert data["integrationType"] == "slack"
        assert data["status"] == "valid"

    def test_get_returns_404_for_missing(self, client, mock_secrets_service):
        """Test that get returns 404 for missing credential."""
        mock_secrets_service.get_credential_metadata.return_value = None

        response = client.get("/api/integrations/nonexistent")

        assert response.status_code == 404
