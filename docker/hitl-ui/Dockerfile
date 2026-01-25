# aSDLC HITL Web UI Container
# Container 4: Human-in-the-Loop Web Interface
# Gate request viewer and evidence explorer
# Multi-stage build: Build React app, then serve with Node

# Stage 1: Build the React application
FROM node:20-alpine AS builder

# Build-time arguments for Vite environment variables
ARG VITE_USE_MOCKS=false
ARG VITE_API_BASE_URL=/api

# Set environment variables for the build
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

# Copy package files
COPY docker/hitl-ui/package.json docker/hitl-ui/package-lock.json* ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source files
COPY docker/hitl-ui/ ./

# Build the application (Vite will embed VITE_* env vars at build time)
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine

# Install health check dependencies
RUN apk add --no-cache wget

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -S asdlc && adduser -S asdlc -G asdlc && \
    chown -R asdlc:asdlc /app

# Environment variables
ENV NODE_ENV=production \
    SERVICE_NAME=hitl-ui \
    SERVICE_PORT=3000

# Copy package files for production dependencies
COPY docker/hitl-ui/package.json ./

# Install only express for serving static files
RUN npm install express@4 --save && \
    chown -R asdlc:asdlc /app

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy production server
COPY docker/hitl-ui/server.js ./

# Set ownership
RUN chown -R asdlc:asdlc /app

# Switch to non-root user
USER asdlc

# Expose web port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
    CMD wget -q --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "server.js"]
