"""Encryption service for API keys.

This module provides encryption and decryption services for API keys
using Fernet symmetric encryption (AES-128-CBC with HMAC-SHA256).
"""

from __future__ import annotations

import base64
import logging
import os

from cryptography.fernet import Fernet


logger = logging.getLogger(__name__)


class EncryptionService:
    """Service for encrypting and decrypting API keys.

    Uses Fernet symmetric encryption which provides:
    - AES-128-CBC encryption
    - HMAC-SHA256 authentication
    - Random IV for each encryption

    The encryption key is read from LLM_CONFIG_ENCRYPTION_KEY environment
    variable. If not set, a new key is generated (useful for development
    but not recommended for production).

    Usage:
        service = EncryptionService()
        encrypted = service.encrypt("my-api-key")
        decrypted = service.decrypt(encrypted)
        masked = EncryptionService.mask_key("sk-ant-api03-...")
    """

    def __init__(self) -> None:
        """Initialize the encryption service."""
        self._key = self._get_or_create_key()
        self._fernet = Fernet(self._key)

    def _get_or_create_key(self) -> bytes:
        """Get encryption key from environment or create a new one.

        Returns:
            bytes: The Fernet encryption key.
        """
        key_str = os.environ.get("LLM_CONFIG_ENCRYPTION_KEY")
        
        if key_str:
            # Key should be a valid Fernet key (32 bytes, URL-safe base64)
            try:
                key_bytes = key_str.encode("utf-8")
                # Validate the key by trying to create a Fernet instance
                Fernet(key_bytes)
                return key_bytes
            except Exception as e:
                logger.warning(
                    f"Invalid encryption key in environment, generating new: {e}"
                )
        
        # Generate a new key if not provided
        logger.warning(
            "LLM_CONFIG_ENCRYPTION_KEY not set, generating temporary key. "
            "This is not recommended for production."
        )
        return Fernet.generate_key()

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a plaintext string.

        Args:
            plaintext: The string to encrypt.

        Returns:
            str: The encrypted string (base64-encoded).
        """
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt an encrypted string.

        Args:
            ciphertext: The encrypted string (base64-encoded).

        Returns:
            str: The decrypted plaintext.

        Raises:
            InvalidToken: If the ciphertext is invalid or tampered with.
        """
        return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")

    @staticmethod
    def mask_key(key: str) -> str:
        """Mask an API key for display, showing first 7 and last 3 characters.

        Args:
            key: The API key to mask.

        Returns:
            str: The masked key (e.g., "sk-ant-...xyz") or "***" for short keys.
        """
        if len(key) <= 10:
            return "***"
        return f"{key[:7]}...{key[-3:]}"
