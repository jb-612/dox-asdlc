/**
 * aSDLC HITL UI Production Server
 * Serves the built React application and provides health check endpoint
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const SERVICE_NAME = process.env.SERVICE_NAME || 'hitl-ui';
const SERVICE_PORT = parseInt(process.env.PORT || process.env.SERVICE_PORT || '3000', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'infrastructure';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const API_BACKEND_URL = process.env.API_BACKEND_URL || 'http://dox-asdlc-orchestrator:8080';

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

// Proxy /api requests to orchestrator backend
// The mount path '/api' is stripped by Express, so we target /api on backend
app.use('/api', createProxyMiddleware({
  target: `${API_BACKEND_URL}/api`,
  changeOrigin: true,
  timeout: 30000,
  onProxyReq: (proxyReq, req) => {
    console.log(`[${SERVICE_NAME}] Proxying: ${req.method} ${req.originalUrl} -> ${API_BACKEND_URL}/api${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`[${SERVICE_NAME}] Proxy error:`, err.message);
    res.status(502).json({ error: 'Backend unavailable', message: err.message });
  },
}));

// Serve static files from the dist directory with proper cache headers
// Assets with hashes in filename: cache for 1 year (immutable)
// Index.html: no cache (always fetch fresh to get latest asset references)
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Other static files (favicon, etc.) with moderate caching
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // Never cache index.html
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// SPA fallback - serve index.html for all non-file routes
app.get('*', (req, res) => {
  // Don't serve index.html for files with extensions (likely missing assets)
  if (req.path.includes('.')) {
    res.status(404).json({ error: 'Not Found', path: req.path });
    return;
  }
  // Set no-cache headers for SPA fallback
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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
