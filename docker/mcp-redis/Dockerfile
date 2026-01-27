FROM python:3.11-slim

# Create non-root user
RUN groupadd -g 1000 mcp && useradd -u 1000 -g mcp -m mcp

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY server.py .

# Set ownership
RUN chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

EXPOSE 9000

CMD ["python", "server.py"]
