/**
 * aSDLC HITL UI Production Server
 * Serves the built React application and provides health check endpoint
 */

const express = require('express');
const path = require('path');

const app = express();

const SERVICE_NAME = process.env.SERVICE_NAME || 'hitl-ui';
const SERVICE_PORT = parseInt(process.env.SERVICE_PORT || '3000', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'infrastructure';
const REDIS_PORT = process.env.REDIS_PORT || '6379';

/**
 * Generate health check response
 * @returns {Object} Health status object
 */
function getHealthStatus() {
  return {
    status: 'healthy',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '0.1.0',
    dependencies: {
      redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        status: 'unchecked',
      },
    },
  };
}

// Health check endpoint - must be before static files
app.get('/health', (req, res) => {
  const health = getHealthStatus();
  res.json(health);
});

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all non-file routes
app.get('*', (req, res) => {
  // Don't serve index.html for files with extensions (likely missing assets)
  if (req.path.includes('.')) {
    res.status(404).json({ error: 'Not Found', path: req.path });
    return;
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(SERVICE_PORT, '0.0.0.0', () => {
  console.log(`[${SERVICE_NAME}] Server running on port ${SERVICE_PORT}`);
  console.log(`[${SERVICE_NAME}] Health check: http://localhost:${SERVICE_PORT}/health`);
  console.log(`[${SERVICE_NAME}] UI: http://localhost:${SERVICE_PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[${SERVICE_NAME}] Received SIGTERM, shutting down gracefully`);
  process.exit(0);
});
