# aSDLC Review Swarm Container
# Parallel code review service using Claude SDK
# Runs 3 specialized reviewers (security, performance, style)
# Stores sessions and results in Redis

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN useradd -m -s /bin/bash asdlc && \
    mkdir -p /app/workspace && \
    chown -R asdlc:asdlc /app

# Copy requirements first for better caching
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY src/ /app/src/

# Set ownership
RUN chown -R asdlc:asdlc /app

# Switch to non-root user
USER asdlc

# Environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    SERVICE_NAME=review-swarm \
    SERVICE_PORT=8082 \
    GIT_WRITE_ACCESS=false

# Expose health check port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:8082/health || exit 1

# Start the review swarm service
CMD ["python", "-m", "src.workers.swarm.main"]
