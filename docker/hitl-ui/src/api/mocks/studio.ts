/**
 * Mock data for Discovery Studio
 */

import type {
  ChatMessage,
  WorkingOutline,
  ContextPack,
  StudioChatResponse,
} from '../types';

// Helper functions
const now = new Date();
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString();

// Mock chat history
export const mockChatHistory: ChatMessage[] = [
  {
    id: 'msg_001',
    role: 'user',
    content: 'I want to build a user authentication system with OAuth2.0 support.',
    timestamp: minutesAgo(30),
  },
  {
    id: 'msg_002',
    role: 'assistant',
    content: `Great! I'll help you define the requirements for an OAuth2.0 authentication system. Let me ask a few clarifying questions:

1. **User Types**: Will this system support multiple user types (e.g., admin, regular user, guest)?

2. **OAuth Providers**: Which OAuth2.0 providers do you want to support? Common options include:
   - Google
   - GitHub
   - Microsoft
   - Facebook

3. **Session Management**: Do you need support for:
   - Remember me functionality
   - Multi-device sessions
   - Session timeout customization

4. **Security Requirements**:
   - Do you need MFA (Multi-Factor Authentication)?
   - Password complexity requirements?
   - Account lockout after failed attempts?

Let me know your preferences and I'll update the PRD outline accordingly.`,
    timestamp: minutesAgo(28),
  },
  {
    id: 'msg_003',
    role: 'user',
    content: 'Support Google and GitHub OAuth. Yes to MFA. Two user types: admin and regular.',
    timestamp: minutesAgo(25),
  },
  {
    id: 'msg_004',
    role: 'assistant',
    content: `Perfect! I've captured those requirements. Here's what I'm adding to the PRD:

**Authentication Providers:**
- Google OAuth2.0
- GitHub OAuth2.0

**User Types:**
- Admin (full access)
- Regular User (standard access)

**Security:**
- MFA support (TOTP-based)
- Session management with configurable timeout

I've updated the Working Outline with these sections. Would you like me to elaborate on any specific area, or should we move on to defining the user flows?`,
    timestamp: minutesAgo(23),
  },
];

// Mock working outline
export const mockWorkingOutline: WorkingOutline = {
  sections: [
    {
      name: 'Overview',
      status: 'complete',
      content: 'User authentication system with OAuth2.0 integration',
    },
    {
      name: 'User Types',
      status: 'complete',
      content: 'Admin and Regular User roles defined',
    },
    {
      name: 'Authentication Methods',
      status: 'complete',
      content: 'Google OAuth, GitHub OAuth, MFA (TOTP)',
    },
    {
      name: 'User Flows',
      status: 'in_progress',
      content: 'Login, Registration, Password Reset flows',
    },
    {
      name: 'Security Requirements',
      status: 'in_progress',
      content: null,
    },
    {
      name: 'API Endpoints',
      status: 'pending',
      content: null,
    },
    {
      name: 'Data Models',
      status: 'pending',
      content: null,
    },
    {
      name: 'Non-Functional Requirements',
      status: 'pending',
      content: null,
    },
  ],
  completeness: 45,
};

// Mock context pack
export const mockContextPack: ContextPack = {
  files: [
    { path: 'src/auth/oauth.py', relevance_score: 0.98, tokens: 2500 },
    { path: 'src/auth/middleware.py', relevance_score: 0.95, tokens: 1800 },
    { path: 'src/models/user.py', relevance_score: 0.92, tokens: 1200 },
    { path: 'src/auth/jwt.py', relevance_score: 0.88, tokens: 1500 },
    { path: 'tests/auth/test_oauth.py', relevance_score: 0.75, tokens: 2000 },
    { path: 'docs/api/auth.md', relevance_score: 0.70, tokens: 800 },
  ],
  total_tokens: 9800,
  cost_estimate_usd: 0.029,
};

// Simulated streaming responses
const streamingResponses: Record<string, string[]> = {
  default: [
    'Let me analyze that...',
    ' Based on the codebase context,',
    ' I can see the existing authentication',
    ' patterns and suggest appropriate',
    ' integrations for your requirements.',
  ],
  security: [
    'For security requirements,',
    ' I recommend implementing:',
    '\n\n1. **Password Hashing**: bcrypt with cost factor 12',
    '\n2. **Rate Limiting**: 5 attempts per 15 minutes',
    '\n3. **Session Tokens**: JWT with 15-minute expiry',
    '\n4. **MFA**: TOTP with backup codes',
  ],
};

// Mock chat response generator
export function generateMockChatResponse(
  userMessage: string
): StudioChatResponse {
  const timestamp = new Date().toISOString();
  const messageId = `msg_${Date.now()}`;

  // Determine response type based on keywords
  let responseContent = '';
  let outlineUpdate: Partial<WorkingOutline> | null = null;

  if (userMessage.toLowerCase().includes('security')) {
    responseContent = streamingResponses.security.join('');
    outlineUpdate = {
      sections: mockWorkingOutline.sections.map((s) =>
        s.name === 'Security Requirements'
          ? { ...s, status: 'complete' as const, content: 'Comprehensive security measures defined' }
          : s
      ),
      completeness: 55,
    };
  } else if (userMessage.toLowerCase().includes('api')) {
    responseContent = `Here's the proposed API structure for authentication:

\`\`\`
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/oauth/google
POST /api/auth/oauth/github
POST /api/auth/mfa/setup
POST /api/auth/mfa/verify
\`\`\`

Shall I elaborate on the request/response schemas?`;
    outlineUpdate = {
      sections: mockWorkingOutline.sections.map((s) =>
        s.name === 'API Endpoints'
          ? { ...s, status: 'in_progress' as const, content: '8 endpoints defined' }
          : s
      ),
      completeness: 60,
    };
  } else {
    responseContent = `I understand. Let me help you with that.

Based on the context from your codebase, I can see the existing patterns and will ensure consistency with your current architecture.

Would you like me to:
1. Generate a detailed specification
2. Create acceptance criteria
3. Identify potential edge cases

Let me know which direction you'd like to take.`;
  }

  return {
    message: {
      id: messageId,
      role: 'assistant',
      content: responseContent,
      timestamp,
    },
    outline_update: outlineUpdate,
    artifacts: null,
  };
}

// Mock PRD preview
export const mockPRDPreview = `# User Authentication System PRD

## Overview
A comprehensive user authentication system with OAuth2.0 integration, supporting multiple identity providers and multi-factor authentication.

## User Types
- **Admin**: Full system access, user management capabilities
- **Regular User**: Standard access with self-service account management

## Authentication Methods
1. **Google OAuth2.0**: Primary social login
2. **GitHub OAuth2.0**: Developer-focused authentication
3. **TOTP MFA**: Optional second factor for enhanced security

## User Flows
### Login Flow
1. User visits login page
2. Selects authentication method
3. Completes OAuth flow or enters credentials
4. Optional MFA verification
5. Session created, user redirected

### Registration Flow
1. User clicks "Sign Up"
2. Enters basic information or uses OAuth
3. Email verification sent
4. Account activated upon verification

## Security Requirements
- Password hashing: bcrypt (cost factor 12)
- Rate limiting: 5 attempts per 15 minutes
- Session tokens: JWT with 15-minute access token expiry
- Refresh tokens: 7-day validity with rotation
- MFA: TOTP with 6 backup codes

## Status
- Completeness: 45%
- Sections complete: 4/8
- Last updated: ${new Date().toISOString()}
`;
