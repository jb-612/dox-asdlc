"""Unit tests for Encryption Service.

Tests the EncryptionService class for encrypting and decrypting API keys
and masking sensitive data.
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from src.orchestrator.utils.encryption import EncryptionService


class TestEncryptionServiceInit:
    """Tests for EncryptionService initialization."""

    def test_init_creates_service(self) -> None:
        """Test that EncryptionService can be instantiated."""
        service = EncryptionService()
        assert service is not None

    def test_init_with_env_key(self) -> None:
        """Test that service uses key from environment variable."""
        # Generate a valid Fernet key (32 bytes base64)
        import base64
        test_key = base64.urlsafe_b64encode(os.urandom(32)).decode()
        
        with patch.dict(os.environ, {"LLM_CONFIG_ENCRYPTION_KEY": test_key}):
            service = EncryptionService()
            assert service is not None

    def test_init_generates_key_if_missing(self) -> None:
        """Test that service generates a key if not in environment."""
        env_copy = os.environ.copy()
        if "LLM_CONFIG_ENCRYPTION_KEY" in env_copy:
            del env_copy["LLM_CONFIG_ENCRYPTION_KEY"]
        
        with patch.dict(os.environ, env_copy, clear=True):
            service = EncryptionService()
            assert service is not None


class TestEncryptDecrypt:
    """Tests for encrypt and decrypt methods."""

    @pytest.fixture
    def service(self) -> EncryptionService:
        """Create an encryption service instance."""
        return EncryptionService()

    def test_encrypt_returns_string(self, service: EncryptionService) -> None:
        """Test that encrypt returns a string."""
        result = service.encrypt("test-api-key")
        assert isinstance(result, str)

    def test_encrypt_produces_different_output(self, service: EncryptionService) -> None:
        """Test that encrypted value is different from plaintext."""
        plaintext = "sk-ant-api03-secret-key-12345"
        encrypted = service.encrypt(plaintext)
        assert encrypted != plaintext

    def test_decrypt_returns_original(self, service: EncryptionService) -> None:
        """Test that decrypt returns the original plaintext."""
        plaintext = "sk-ant-api03-secret-key-12345"
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_decrypt_roundtrip(self, service: EncryptionService) -> None:
        """Test multiple encrypt/decrypt roundtrips."""
        test_values = [
            "sk-ant-api03-short",
            "sk-ant-api03-" + "x" * 100,
            "special-chars-!@#$%^&*()",
            "",  # Empty string
            " ",  # Single space
            "unicode-test-\u00e9\u00e8\u00ea",
        ]
        for plaintext in test_values:
            encrypted = service.encrypt(plaintext)
            decrypted = service.decrypt(encrypted)
            assert decrypted == plaintext, f"Failed for: {plaintext!r}"

    def test_same_plaintext_produces_different_ciphertext(
        self, service: EncryptionService
    ) -> None:
        """Test that encrypting same value produces different ciphertext (due to IV)."""
        plaintext = "sk-ant-api03-secret-key"
        encrypted1 = service.encrypt(plaintext)
        encrypted2 = service.encrypt(plaintext)
        # Fernet uses random IV, so ciphertexts should differ
        assert encrypted1 != encrypted2

    def test_decrypt_invalid_ciphertext_raises(
        self, service: EncryptionService
    ) -> None:
        """Test that decrypting invalid ciphertext raises an exception."""
        with pytest.raises(Exception):  # InvalidToken from cryptography
            service.decrypt("not-valid-encrypted-data")

    def test_decrypt_tampered_ciphertext_raises(
        self, service: EncryptionService
    ) -> None:
        """Test that decrypting tampered ciphertext raises an exception."""
        plaintext = "sk-ant-api03-secret-key"
        encrypted = service.encrypt(plaintext)
        # Tamper with the ciphertext
        tampered = encrypted[:-5] + "xxxxx"
        with pytest.raises(Exception):
            service.decrypt(tampered)


class TestMaskKey:
    """Tests for mask_key static method."""

    def test_mask_standard_key(self) -> None:
        """Test masking a standard length API key."""
        key = "sk-ant-api03-12345678-abcdefgh"
        masked = EncryptionService.mask_key(key)
        assert masked == "sk-ant-...fgh"
        assert len(masked) < len(key)

    def test_mask_short_key(self) -> None:
        """Test masking a short key returns masked placeholder."""
        key = "short123"
        masked = EncryptionService.mask_key(key)
        assert masked == "***"

    def test_mask_exactly_10_chars(self) -> None:
        """Test masking a key exactly 10 characters."""
        key = "1234567890"
        masked = EncryptionService.mask_key(key)
        assert masked == "***"

    def test_mask_11_chars(self) -> None:
        """Test masking a key with 11 characters."""
        key = "12345678901"
        masked = EncryptionService.mask_key(key)
        assert masked == "1234567...901"

    def test_mask_empty_key(self) -> None:
        """Test masking an empty key."""
        masked = EncryptionService.mask_key("")
        assert masked == "***"

    def test_mask_preserves_first_7(self) -> None:
        """Test that first 7 characters are preserved."""
        key = "sk-ant-api03-12345678-abcdefgh-xyz"
        masked = EncryptionService.mask_key(key)
        assert masked.startswith("sk-ant-")

    def test_mask_preserves_last_3(self) -> None:
        """Test that last 3 characters are preserved."""
        key = "sk-ant-api03-12345678-abcdefgh-xyz"
        masked = EncryptionService.mask_key(key)
        assert masked.endswith("xyz")


class TestEncryptionServiceSingleton:
    """Tests for encryption service instance management."""

    def test_consistent_encryption_within_instance(self) -> None:
        """Test that same instance can encrypt/decrypt consistently."""
        service = EncryptionService()
        
        plaintext = "test-key-12345"
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        
        assert decrypted == plaintext

    def test_different_instances_with_same_key(self) -> None:
        """Test that different instances with same key can share encrypted data."""
        import base64
        shared_key = base64.urlsafe_b64encode(os.urandom(32)).decode()
        
        with patch.dict(os.environ, {"LLM_CONFIG_ENCRYPTION_KEY": shared_key}):
            service1 = EncryptionService()
            service2 = EncryptionService()
            
            plaintext = "shared-secret-key"
            encrypted = service1.encrypt(plaintext)
            decrypted = service2.decrypt(encrypted)
            
            assert decrypted == plaintext
