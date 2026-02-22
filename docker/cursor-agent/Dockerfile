FROM node:20-slim

# Install system dependencies
# - curl: download Cursor CLI installer
# - ca-certificates: HTTPS trust for the installer
# - wget: used by HEALTHCHECK
# - git + bash: workspace operations
RUN apt-get update && apt-get install -y \
    git \
    bash \
    curl \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Cursor CLI via official installer.
# The installer places the binary at /root/.cursor/bin/agent
RUN curl https://cursor.com/install -fsS | bash

# Make the binary available system-wide as 'agent'.
# server.ts resolves AGENT_BINARY env var (default: "agent") via PATH lookup.
RUN cp /root/.cursor/bin/agent /usr/local/bin/agent \
    && chmod +x /usr/local/bin/agent

RUN groupadd -r asdlc && useradd -r -g asdlc asdlc

WORKDIR /app

COPY docker/cursor-agent/package.json docker/cursor-agent/tsconfig.json ./
RUN npm install

COPY docker/cursor-agent/server.ts ./
RUN npx tsc

COPY docker/cursor-agent/.cursor /app/.cursor-defaults
COPY docker/cursor-agent/mcp.json /app/mcp-defaults.json

RUN mkdir -p /workspace && chown asdlc:asdlc /workspace

USER asdlc

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD wget -q --spider http://localhost:8090/health || exit 1

CMD ["node", "dist/server.js"]
