/**
 * Mock data for Artifact Management
 */

import type {
  ArtifactDetail,
  ArtifactVersion,
  ArtifactProvenance,
  SpecIndex,
  ArtifactStatus,
  ArtifactType,
} from '../types';

// Helper functions
const now = new Date();
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

// Mock artifact details
export const mockArtifacts: ArtifactDetail[] = [
  {
    id: 'art_001',
    name: 'auth-system.prd.md',
    type: 'file',
    status: 'approved',
    epic_id: 'EPIC-001',
    created_at: daysAgo(5),
    created_by: 'discovery_agent',
    approved_at: daysAgo(4),
    approved_by: 'john.smith',
    sha: 'abc1234def5678901234567890abcdef12345678',
    content: `# User Authentication System PRD

## Overview
A comprehensive user authentication system with OAuth2.0 integration.

## Requirements
1. Support Google and GitHub OAuth providers
2. Implement MFA via TOTP
3. Two user types: Admin and Regular User

## Success Criteria
- [ ] OAuth flow completes within 3 seconds
- [ ] MFA enrollment < 5 steps
- [ ] Session timeout configurable per user type
`,
    content_type: 'text/markdown',
    size_bytes: 2500,
  },
  {
    id: 'art_002',
    name: 'auth-architecture.md',
    type: 'file',
    status: 'approved',
    epic_id: 'EPIC-001',
    created_at: daysAgo(4),
    created_by: 'design_agent',
    approved_at: daysAgo(3),
    approved_by: 'jane.doe',
    sha: 'def5678901234567890abcdef12345678abc1234',
    content: `# Authentication Architecture

## Components
- AuthService: Handles OAuth flow
- SessionManager: JWT token management
- MFAProvider: TOTP generation and validation

## Data Flow
\`\`\`
User -> Gateway -> AuthService -> OAuth Provider
                       |
                       v
                 SessionManager -> JWT
                       |
                       v
                  MFAProvider
\`\`\`
`,
    content_type: 'text/markdown',
    size_bytes: 1800,
  },
  {
    id: 'art_003',
    name: 'auth-service.py',
    type: 'file',
    status: 'pending_review',
    epic_id: 'EPIC-001',
    created_at: hoursAgo(6),
    created_by: 'coding_agent',
    approved_at: null,
    approved_by: null,
    sha: '901234567890abcdef12345678abc1234def5678',
    content: `"""Authentication service implementation."""

import asyncio
from typing import Optional
from datetime import datetime, timedelta

class AuthService:
    """Handles OAuth2.0 authentication flows."""

    def __init__(self, config: dict):
        self.config = config
        self.providers = {}

    async def authenticate(self, provider: str, code: str) -> dict:
        """Exchange OAuth code for user session."""
        oauth_provider = self.providers.get(provider)
        if not oauth_provider:
            raise ValueError(f"Unknown provider: {provider}")

        tokens = await oauth_provider.exchange_code(code)
        user_info = await oauth_provider.get_user_info(tokens['access_token'])

        return {
            'user_id': user_info['id'],
            'email': user_info['email'],
            'access_token': self._create_jwt(user_info),
        }

    def _create_jwt(self, user_info: dict) -> str:
        """Create JWT access token."""
        # Implementation details...
        pass
`,
    content_type: 'text/x-python',
    size_bytes: 1200,
  },
  {
    id: 'art_004',
    name: 'auth-tests-report.json',
    type: 'report',
    status: 'draft',
    epic_id: 'EPIC-001',
    created_at: hoursAgo(2),
    created_by: 'test_agent',
    approved_at: null,
    approved_by: null,
    sha: null,
    content: JSON.stringify({
      summary: {
        total: 25,
        passed: 23,
        failed: 2,
        skipped: 0,
      },
      failures: [
        {
          test: 'test_oauth_timeout',
          message: 'Timeout exceeded: 5000ms > 3000ms',
        },
        {
          test: 'test_mfa_backup_codes',
          message: 'Expected 6 backup codes, got 5',
        },
      ],
      coverage: 87.5,
    }, null, 2),
    content_type: 'application/json',
    size_bytes: 450,
  },
  {
    id: 'art_005',
    name: 'session-manager.diff',
    type: 'diff',
    status: 'pending_review',
    epic_id: 'EPIC-001',
    created_at: hoursAgo(4),
    created_by: 'coding_agent',
    approved_at: null,
    approved_by: null,
    sha: 'abcdef1234567890abcdef1234567890abcdef12',
    content: `--- a/src/auth/session.py
+++ b/src/auth/session.py
@@ -15,6 +15,12 @@ class SessionManager:
     def __init__(self, redis_client):
         self.redis = redis_client
         self.ttl = 900  # 15 minutes
+        self.refresh_ttl = 604800  # 7 days
+
+    async def refresh_session(self, refresh_token: str) -> dict:
+        """Refresh an expired access token."""
+        session = await self.redis.get(f"refresh:{refresh_token}")
+        if not session:
+            raise SessionExpiredError("Refresh token invalid or expired")
+        return await self._create_new_session(session['user_id'])
`,
    content_type: 'text/x-diff',
    size_bytes: 650,
  },
  {
    id: 'art_006',
    name: 'rate-limiter.py',
    type: 'file',
    status: 'approved',
    epic_id: 'EPIC-002',
    created_at: daysAgo(2),
    created_by: 'coding_agent',
    approved_at: daysAgo(1),
    approved_by: 'admin',
    sha: '567890abcdef1234567890abcdef1234567890ab',
    content: `"""Rate limiting middleware."""

from collections import defaultdict
from time import time

class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, rate: int = 5, period: int = 900):
        self.rate = rate
        self.period = period
        self.buckets = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time()
        # Clean old entries
        self.buckets[key] = [t for t in self.buckets[key] if now - t < self.period]

        if len(self.buckets[key]) < self.rate:
            self.buckets[key].append(now)
            return True
        return False
`,
    content_type: 'text/x-python',
    size_bytes: 580,
  },
];

// Get mock artifact by ID
export function getMockArtifact(id: string): ArtifactDetail | null {
  return mockArtifacts.find((a) => a.id === id) || null;
}

// Mock version history
export function getMockVersionHistory(artifactId: string): ArtifactVersion[] {
  const artifact = getMockArtifact(artifactId);
  if (!artifact) return [];

  // Generate mock version history
  return [
    {
      version: 3,
      timestamp: artifact.created_at,
      author: artifact.created_by,
      sha: artifact.sha || 'abc123',
      changes_summary: 'Added refresh token support',
    },
    {
      version: 2,
      timestamp: daysAgo(6),
      author: artifact.created_by,
      sha: 'prev789',
      changes_summary: 'Fixed token expiry calculation',
    },
    {
      version: 1,
      timestamp: daysAgo(7),
      author: artifact.created_by,
      sha: 'init456',
      changes_summary: 'Initial implementation',
    },
  ];
}

// Mock provenance data
export function getMockProvenance(artifactId: string): ArtifactProvenance | null {
  const artifact = getMockArtifact(artifactId);
  if (!artifact) return null;

  return {
    producing_run_id: 'run_002',
    input_artifacts: [
      { path: 'src/core/types.py', type: 'file', size_bytes: 1200 },
      { path: 'contracts/auth.json', type: 'file', size_bytes: 500 },
    ],
    approving_gate_id: artifact.status === 'approved' ? 'gate_001' : null,
    approval_info: artifact.status === 'approved'
      ? {
          approved_by: artifact.approved_by!,
          approved_at: artifact.approved_at!,
          feedback: 'Looks good. Approved with minor suggestions.',
        }
      : null,
    feedback: [
      'Consider adding more error handling',
      'Token refresh logic approved',
    ],
  };
}

// Mock spec index
export const mockSpecIndex: SpecIndex = {
  discovery: {
    artifacts: [
      { id: 'art_001', name: 'auth-system.prd.md', status: 'approved' },
      { id: 'art_007', name: 'api-endpoints.md', status: 'pending_review' },
    ],
    progress: {
      complete: 1,
      in_progress: 1,
      pending: 0,
      total: 2,
    },
  },
  design: {
    artifacts: [
      { id: 'art_002', name: 'auth-architecture.md', status: 'approved' },
      { id: 'art_008', name: 'data-models.md', status: 'approved' },
      { id: 'art_009', name: 'api-contracts.json', status: 'draft' },
    ],
    progress: {
      complete: 2,
      in_progress: 0,
      pending: 1,
      total: 3,
    },
  },
  development: {
    artifacts: [
      { id: 'art_003', name: 'auth-service.py', status: 'pending_review' },
      { id: 'art_005', name: 'session-manager.diff', status: 'pending_review' },
      { id: 'art_006', name: 'rate-limiter.py', status: 'approved' },
    ],
    progress: {
      complete: 1,
      in_progress: 2,
      pending: 0,
      total: 3,
    },
  },
  validation: {
    artifacts: [
      { id: 'art_004', name: 'auth-tests-report.json', status: 'draft' },
    ],
    progress: {
      complete: 0,
      in_progress: 1,
      pending: 0,
      total: 1,
    },
  },
};

// Filter artifacts by query params
export function filterMockArtifacts(params: {
  epic_id?: string;
  type?: ArtifactType;
  status?: ArtifactStatus;
  search?: string;
}): ArtifactDetail[] {
  let filtered = [...mockArtifacts];

  if (params.epic_id) {
    filtered = filtered.filter((a) => a.epic_id === params.epic_id);
  }
  if (params.type) {
    filtered = filtered.filter((a) => a.type === params.type);
  }
  if (params.status) {
    filtered = filtered.filter((a) => a.status === params.status);
  }
  if (params.search) {
    const search = params.search.toLowerCase();
    filtered = filtered.filter((a) => a.name.toLowerCase().includes(search));
  }

  return filtered;
}
