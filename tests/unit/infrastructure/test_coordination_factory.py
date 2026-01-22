"""Tests for coordination factory functions."""

from unittest.mock import AsyncMock, patch

import pytest

from src.infrastructure.coordination.config import CoordinationConfig
from src.infrastructure.coordination.factory import (
    get_coordination_client,
    get_coordination_client_context,
    reset_coordination_client,
)


class TestGetCoordinationClient:
    """Tests for get_coordination_client factory."""

    @pytest.fixture(autouse=True)
    async def reset_singleton(self):
        """Reset singleton before and after each test."""
        await reset_coordination_client()
        yield
        await reset_coordination_client()

    @pytest.mark.asyncio
    async def test_creates_client(self) -> None:
        """Test that factory creates a client."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client = await get_coordination_client()

            assert client is not None
            assert client.redis is mock_redis

    @pytest.mark.asyncio
    async def test_returns_singleton(self) -> None:
        """Test that factory returns same instance."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client1 = await get_coordination_client()
            client2 = await get_coordination_client()

            assert client1 is client2

    @pytest.mark.asyncio
    async def test_with_instance_id(self) -> None:
        """Test factory with instance ID."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client = await get_coordination_client(instance_id="backend")

            assert client.instance_id == "backend"

    @pytest.mark.asyncio
    async def test_with_custom_config(self) -> None:
        """Test factory with custom config."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)
        custom_config = CoordinationConfig(key_prefix="custom")

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client = await get_coordination_client(config=custom_config)

            assert client.config.key_prefix == "custom"

    @pytest.mark.asyncio
    async def test_instance_id_ignored_on_subsequent_calls(self) -> None:
        """Test that instance_id is only set on first call."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client1 = await get_coordination_client(instance_id="first")
            client2 = await get_coordination_client(instance_id="second")

            assert client1.instance_id == "first"
            assert client2.instance_id == "first"  # Same instance


class TestResetCoordinationClient:
    """Tests for reset_coordination_client."""

    @pytest.fixture(autouse=True)
    async def reset_singleton(self):
        """Reset singleton before and after each test."""
        await reset_coordination_client()
        yield
        await reset_coordination_client()

    @pytest.mark.asyncio
    async def test_reset_clears_singleton(self) -> None:
        """Test that reset clears the singleton."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client1 = await get_coordination_client(instance_id="first")
            await reset_coordination_client()
            client2 = await get_coordination_client(instance_id="second")

            assert client1 is not client2
            assert client2.instance_id == "second"


class TestGetCoordinationClientContext:
    """Tests for get_coordination_client_context."""

    @pytest.fixture(autouse=True)
    async def reset_singleton(self):
        """Reset singleton before and after each test."""
        await reset_coordination_client()
        yield
        await reset_coordination_client()

    @pytest.mark.asyncio
    async def test_returns_connected_client(self) -> None:
        """Test that context returns connected client."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=True)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            client = await get_coordination_client_context()

            assert client is not None
            mock_redis.ping.assert_awaited()

    @pytest.mark.asyncio
    async def test_raises_on_disconnected(self) -> None:
        """Test that context raises when not connected."""
        mock_redis = AsyncMock()
        mock_redis.ping = AsyncMock(return_value=False)

        with patch(
            "src.infrastructure.coordination.factory.get_redis_client",
            return_value=mock_redis,
        ):
            from src.core.exceptions import CoordinationError

            with pytest.raises(CoordinationError) as exc_info:
                await get_coordination_client_context()

            assert "not connected" in str(exc_info.value)
