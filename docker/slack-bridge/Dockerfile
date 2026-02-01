# aSDLC Slack Bridge Container
# Slack HITL Bridge for gate notifications and decision capture
# Uses Socket Mode for secure, outbound-only connections

FROM python:3.11-slim

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -s /bin/bash asdlc && \
    chown -R asdlc:asdlc /app

# Copy requirements first for better caching
COPY docker/slack-bridge/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
# Only copy the slack_bridge module and its dependencies
COPY src/infrastructure/slack_bridge/ /app/src/infrastructure/slack_bridge/
COPY src/infrastructure/redis_streams.py /app/src/infrastructure/redis_streams.py
COPY src/infrastructure/secrets/ /app/src/infrastructure/secrets/
COPY src/core/ /app/src/core/
COPY src/orchestrator/api/models/ /app/src/orchestrator/api/models/
COPY src/orchestrator/services/ideas_service.py /app/src/orchestrator/services/ideas_service.py

# Create __init__.py files for proper Python package structure
RUN touch /app/src/__init__.py && \
    mkdir -p /app/src/orchestrator/api /app/src/orchestrator/services && \
    touch /app/src/orchestrator/__init__.py && \
    touch /app/src/orchestrator/api/__init__.py && \
    touch /app/src/orchestrator/services/__init__.py && \
    touch /app/src/infrastructure/__init__.py && \
    echo 'from src.infrastructure.secrets.client import SecretsClient, EnvironmentSecretsClient, get_secrets_client' > /app/src/infrastructure/secrets/__init__.py

# Set ownership
RUN chown -R asdlc:asdlc /app

# Switch to non-root user
USER asdlc

# Environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    SERVICE_NAME=slack-bridge \
    HEALTH_PORT=8085

# Default environment variables for configuration
# These should be overridden at runtime
ENV SLACK_BOT_TOKEN="" \
    SLACK_APP_TOKEN="" \
    SLACK_SIGNING_SECRET="" \
    REDIS_URL="redis://redis:6379"

# Expose health check port
EXPOSE 8085

# Health check
# Uses the HTTP health endpoint provided by the bridge
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD curl -f http://localhost:8085/health || exit 1

# Start the Slack Bridge
CMD ["python", "-m", "src.infrastructure.slack_bridge.bridge"]
