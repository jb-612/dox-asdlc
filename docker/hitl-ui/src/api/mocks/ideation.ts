/**
 * Mock data for PRD Ideation Studio (P05-F11 T05)
 *
 * Provides realistic mock implementations for development without backend.
 * Simulates progressive maturity increase and requirement extraction.
 */

import type {
  IdeationChatRequest,
  IdeationChatResponse,
  PRDSubmission,
  PRDSubmissionResult,
  MaturityState,
  IdeationMessage,
  Requirement,
  UserStory,
  PRDDocument,
  CategoryMaturity,
  MaturityLevel,
  SavedProject,
  ProjectStatus,
} from '../../types/ideation';
import { MATURITY_LEVELS, REQUIRED_CATEGORIES } from '../../types/ideation';

// ============================================================================
// Helper Functions
// ============================================================================

const now = new Date();
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString();

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simulate network delay
 */
export async function delay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get maturity level from score
 */
function getMaturityLevelFromScore(score: number): MaturityLevel {
  const clampedScore = Math.max(0, Math.min(100, score));
  for (let i = MATURITY_LEVELS.length - 1; i >= 0; i--) {
    if (clampedScore >= MATURITY_LEVELS[i].minScore) {
      return MATURITY_LEVELS[i];
    }
  }
  return MATURITY_LEVELS[0];
}

// ============================================================================
// Mock Data
// ============================================================================

/**
 * Sample chat conversation for an authentication system PRD
 */
export const mockChatHistory: IdeationMessage[] = [
  {
    id: 'msg_001',
    role: 'assistant',
    content: `Welcome to the PRD Ideation Studio!

I'll help you develop a comprehensive Product Requirements Document. Let's start by understanding the problem you're trying to solve.

**What problem are you trying to solve with this project?**`,
    timestamp: minutesAgo(30),
    suggestedFollowups: [
      'What specific problem are you trying to solve?',
      'Who experiences this problem?',
      'What is the current workaround?',
    ],
  },
  {
    id: 'msg_002',
    role: 'user',
    content: 'We need a modern authentication system with OAuth support for our SaaS platform.',
    timestamp: minutesAgo(28),
  },
  {
    id: 'msg_003',
    role: 'assistant',
    content: `Great! I understand you need a modern authentication system for a SaaS platform with OAuth support.

I've captured this as part of your problem statement. Let me ask a few follow-up questions:

1. **Current Pain Points**: What issues are you experiencing with your current authentication approach?
2. **Scale**: How many users do you expect to authenticate?
3. **OAuth Providers**: Which OAuth providers are highest priority (Google, GitHub, Microsoft, etc.)?`,
    timestamp: minutesAgo(26),
    maturityDelta: 10,
    extractedRequirements: [
      {
        id: 'req_001',
        description: 'System must support OAuth authentication',
        type: 'functional',
        priority: 'must_have',
        categoryId: 'functional',
        createdAt: minutesAgo(26),
      },
    ],
    suggestedFollowups: [
      'What OAuth providers should be supported?',
      'What is your expected user volume?',
      'Are there specific security requirements?',
    ],
  },
  {
    id: 'msg_004',
    role: 'user',
    content: 'Current system has poor UX and no SSO. We expect 50k users initially, growing to 500k. Google and GitHub are priority.',
    timestamp: minutesAgo(24),
  },
  {
    id: 'msg_005',
    role: 'assistant',
    content: `Excellent details! I've extracted several requirements from your response:

**Problem Statement (Updated)**:
- Current authentication has poor UX
- No Single Sign-On (SSO) capability
- Need to scale from 50k to 500k users

**Extracted Requirements**:
- Support Google OAuth
- Support GitHub OAuth
- Implement SSO functionality
- Handle scale of 500k users

Let's dive deeper into your target users. **Who are the primary users of this system? Are there different user roles?**`,
    timestamp: minutesAgo(22),
    maturityDelta: 10,
    extractedRequirements: [
      {
        id: 'req_002',
        description: 'Support Google OAuth integration',
        type: 'functional',
        priority: 'must_have',
        categoryId: 'functional',
        createdAt: minutesAgo(22),
      },
      {
        id: 'req_003',
        description: 'Support GitHub OAuth integration',
        type: 'functional',
        priority: 'must_have',
        categoryId: 'functional',
        createdAt: minutesAgo(22),
      },
      {
        id: 'req_004',
        description: 'System must scale to 500,000 concurrent users',
        type: 'non_functional',
        priority: 'must_have',
        categoryId: 'nfr',
        createdAt: minutesAgo(22),
      },
    ],
  },
];

/**
 * Create initial category maturity structure
 */
function createInitialCategories(): CategoryMaturity[] {
  return REQUIRED_CATEGORIES.map((config) => ({
    id: config.id,
    name: config.name,
    score: 0,
    weight: config.weight,
    requiredForSubmit: config.requiredForSubmit,
    sections: [],
  }));
}

/**
 * Mock maturity state at various progression levels
 */
export const mockMaturityStates: Record<string, MaturityState> = {
  initial: {
    score: 0,
    level: MATURITY_LEVELS[0],
    categories: createInitialCategories(),
    canSubmit: false,
    gaps: [
      'Problem Statement has not been addressed',
      'Target Users has not been addressed',
      'Functional Requirements has not been addressed',
      'Scope & Constraints has not been addressed',
    ],
  },
  exploration: {
    score: 25,
    level: MATURITY_LEVELS[1],
    categories: [
      { id: 'problem', name: 'Problem Statement', score: 60, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'users', name: 'Target Users', score: 30, weight: 10, requiredForSubmit: true, sections: [] },
      { id: 'functional', name: 'Functional Requirements', score: 25, weight: 25, requiredForSubmit: true, sections: [] },
      { id: 'nfr', name: 'Non-Functional Requirements', score: 10, weight: 15, requiredForSubmit: false, sections: [] },
      { id: 'scope', name: 'Scope & Constraints', score: 15, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'success', name: 'Success Criteria', score: 0, weight: 10, requiredForSubmit: false, sections: [] },
      { id: 'risks', name: 'Risks & Assumptions', score: 0, weight: 10, requiredForSubmit: false, sections: [] },
    ],
    canSubmit: false,
    gaps: [
      'Target Users needs more detail',
      'Functional Requirements needs more detail',
      'Scope & Constraints needs more detail',
    ],
  },
  defined: {
    score: 50,
    level: MATURITY_LEVELS[2],
    categories: [
      { id: 'problem', name: 'Problem Statement', score: 80, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'users', name: 'Target Users', score: 70, weight: 10, requiredForSubmit: true, sections: [] },
      { id: 'functional', name: 'Functional Requirements', score: 50, weight: 25, requiredForSubmit: true, sections: [] },
      { id: 'nfr', name: 'Non-Functional Requirements', score: 40, weight: 15, requiredForSubmit: false, sections: [] },
      { id: 'scope', name: 'Scope & Constraints', score: 40, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'success', name: 'Success Criteria', score: 30, weight: 10, requiredForSubmit: false, sections: [] },
      { id: 'risks', name: 'Risks & Assumptions', score: 20, weight: 10, requiredForSubmit: false, sections: [] },
    ],
    canSubmit: false,
    gaps: ['Functional Requirements needs more detail', 'Scope & Constraints could be improved'],
  },
  refined: {
    score: 70,
    level: MATURITY_LEVELS[3],
    categories: [
      { id: 'problem', name: 'Problem Statement', score: 90, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'users', name: 'Target Users', score: 85, weight: 10, requiredForSubmit: true, sections: [] },
      { id: 'functional', name: 'Functional Requirements', score: 70, weight: 25, requiredForSubmit: true, sections: [] },
      { id: 'nfr', name: 'Non-Functional Requirements', score: 65, weight: 15, requiredForSubmit: false, sections: [] },
      { id: 'scope', name: 'Scope & Constraints', score: 70, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'success', name: 'Success Criteria', score: 50, weight: 10, requiredForSubmit: false, sections: [] },
      { id: 'risks', name: 'Risks & Assumptions', score: 40, weight: 10, requiredForSubmit: false, sections: [] },
    ],
    canSubmit: false,
    gaps: ['Success Criteria could be improved', 'Risks & Assumptions could be improved'],
  },
  complete: {
    score: 85,
    level: MATURITY_LEVELS[4],
    categories: [
      { id: 'problem', name: 'Problem Statement', score: 95, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'users', name: 'Target Users', score: 90, weight: 10, requiredForSubmit: true, sections: [] },
      { id: 'functional', name: 'Functional Requirements', score: 85, weight: 25, requiredForSubmit: true, sections: [] },
      { id: 'nfr', name: 'Non-Functional Requirements', score: 80, weight: 15, requiredForSubmit: false, sections: [] },
      { id: 'scope', name: 'Scope & Constraints', score: 85, weight: 15, requiredForSubmit: true, sections: [] },
      { id: 'success', name: 'Success Criteria', score: 80, weight: 10, requiredForSubmit: false, sections: [] },
      { id: 'risks', name: 'Risks & Assumptions', score: 75, weight: 10, requiredForSubmit: false, sections: [] },
    ],
    canSubmit: true,
    gaps: [],
  },
};

/**
 * Sample extracted requirements
 */
export const mockRequirements: Requirement[] = [
  {
    id: 'req_001',
    description: 'System must support OAuth2 authentication with Google',
    type: 'functional',
    priority: 'must_have',
    categoryId: 'functional',
    createdAt: minutesAgo(60),
  },
  {
    id: 'req_002',
    description: 'System must support OAuth2 authentication with GitHub',
    type: 'functional',
    priority: 'must_have',
    categoryId: 'functional',
    createdAt: minutesAgo(55),
  },
  {
    id: 'req_003',
    description: 'System must support Multi-Factor Authentication (MFA)',
    type: 'functional',
    priority: 'should_have',
    categoryId: 'functional',
    createdAt: minutesAgo(50),
  },
  {
    id: 'req_004',
    description: 'Authentication must complete within 2 seconds under normal load',
    type: 'non_functional',
    priority: 'must_have',
    categoryId: 'nfr',
    createdAt: minutesAgo(45),
  },
  {
    id: 'req_005',
    description: 'System must scale to handle 500,000 concurrent users',
    type: 'non_functional',
    priority: 'must_have',
    categoryId: 'nfr',
    createdAt: minutesAgo(40),
  },
];

/**
 * Sample user stories
 */
export const mockUserStories: UserStory[] = [
  {
    id: 'story_001',
    title: 'OAuth Login with Google',
    asA: 'registered user',
    iWant: 'to log in using my Google account',
    soThat: 'I can access the platform without creating a new password',
    acceptanceCriteria: [
      'User can click "Sign in with Google" button',
      'User is redirected to Google OAuth consent screen',
      'Upon approval, user is logged into the platform',
      'User profile is populated from Google account data',
    ],
    linkedRequirements: ['req_001'],
    priority: 'must_have',
  },
  {
    id: 'story_002',
    title: 'OAuth Login with GitHub',
    asA: 'developer user',
    iWant: 'to log in using my GitHub account',
    soThat: 'I can quickly access developer-focused features',
    acceptanceCriteria: [
      'User can click "Sign in with GitHub" button',
      'User is redirected to GitHub OAuth consent screen',
      'Upon approval, user is logged into the platform',
      'User profile is populated from GitHub account data',
    ],
    linkedRequirements: ['req_002'],
    priority: 'must_have',
  },
  {
    id: 'story_003',
    title: 'Enable MFA',
    asA: 'security-conscious user',
    iWant: 'to enable multi-factor authentication on my account',
    soThat: 'my account is protected even if my password is compromised',
    acceptanceCriteria: [
      'User can navigate to security settings',
      'User can enable TOTP-based MFA',
      'User receives backup codes',
      'MFA is required on subsequent logins',
    ],
    linkedRequirements: ['req_003'],
    priority: 'should_have',
  },
];

/**
 * Sample PRD document
 */
export const mockPRDDocument: PRDDocument = {
  id: 'prd_001',
  title: 'Modern Authentication System PRD',
  version: '1.0',
  sections: [
    {
      id: 'overview',
      heading: 'Overview',
      content: `This document outlines the requirements for a modern authentication system for our SaaS platform. The system will provide secure, user-friendly authentication with support for OAuth2 providers and multi-factor authentication.`,
      order: 1,
    },
    {
      id: 'problem',
      heading: 'Problem Statement',
      content: `The current authentication system suffers from poor user experience and lacks modern features like Single Sign-On (SSO). Users frequently abandon the signup process due to friction, and IT administrators lack visibility into authentication patterns.

**Key Pain Points:**
- High signup abandonment rate (estimated 35%)
- No SSO capability increases password fatigue
- Limited audit logging makes security investigations difficult
- Poor mobile experience`,
      order: 2,
    },
    {
      id: 'users',
      heading: 'Target Users',
      content: `**Primary Users:**
- End users (B2C customers) - 90% of user base
- Enterprise users (B2B customers) - 10% of user base

**Secondary Users:**
- IT administrators
- Security teams
- Support staff

**User Volume:**
- Initial: 50,000 users
- Target: 500,000 users within 18 months`,
      order: 3,
    },
    {
      id: 'requirements',
      heading: 'Functional Requirements',
      content: `**Authentication Methods:**
- FR-001: OAuth2 integration with Google (Must Have)
- FR-002: OAuth2 integration with GitHub (Must Have)
- FR-003: TOTP-based MFA (Should Have)
- FR-004: Email/password authentication (Must Have)

**Session Management:**
- FR-005: Configurable session timeout
- FR-006: Device management
- FR-007: Remember me functionality`,
      order: 4,
    },
    {
      id: 'nfr',
      heading: 'Non-Functional Requirements',
      content: `**Performance:**
- NFR-001: Authentication must complete within 2 seconds
- NFR-002: System must handle 1,000 auth requests/second

**Scalability:**
- NFR-003: Support 500,000 concurrent users
- NFR-004: Horizontal scaling capability

**Security:**
- NFR-005: All credentials encrypted at rest
- NFR-006: TLS 1.3 required for all connections
- NFR-007: Rate limiting to prevent brute force`,
      order: 5,
    },
  ],
  createdAt: new Date().toISOString(),
  status: 'pending_review',
};

// ============================================================================
// Mock API Implementations
// ============================================================================

/**
 * Track session state for progressive maturity
 */
const sessionState: Map<string, { messageCount: number; maturity: MaturityState }> = new Map();

/**
 * Response templates based on keywords
 */
const responseTemplates: Record<string, { response: string; delta: number; category: string }> = {
  problem: {
    response: `I've noted that as part of the problem statement. To better understand the impact:

1. **Frequency**: How often do users encounter this problem?
2. **Impact**: What happens when users face this issue?
3. **Current Workaround**: How do users deal with this today?`,
    delta: 8,
    category: 'problem',
  },
  users: {
    response: `Great insight into your users! Let me capture these details:

**User Personas Identified:**
- [Based on your description]

A few follow-up questions:
1. **Primary User**: Who uses this most frequently?
2. **Permissions**: What different access levels are needed?
3. **Volume**: How many users in each category?`,
    delta: 7,
    category: 'users',
  },
  functional: {
    response: `I've extracted some functional requirements from your description. Let me verify:

**Requirements Captured:**
- [Based on your message]

Can you help me understand:
1. **Priority**: Which features are must-have vs. nice-to-have?
2. **Dependencies**: Do any features depend on others?
3. **Integrations**: What external systems need to connect?`,
    delta: 10,
    category: 'functional',
  },
  security: {
    response: `Security requirements are critical. I've noted:

**Security Considerations:**
- [Based on your message]

Additional questions:
1. **Compliance**: Are there regulatory requirements (GDPR, SOC2, HIPAA)?
2. **Authentication**: What methods should be supported?
3. **Audit**: What events need to be logged?`,
    delta: 6,
    category: 'nfr',
  },
  performance: {
    response: `Good performance requirements. I've captured:

**Performance Requirements:**
- [Based on your message]

To complete this section:
1. **Response Time**: What are acceptable latencies?
2. **Throughput**: Expected requests per second?
3. **Availability**: What uptime is required (99.9%)?`,
    delta: 5,
    category: 'nfr',
  },
  scope: {
    response: `Understanding scope is important. I've noted:

**In Scope:**
- [Based on your message]

To clarify boundaries:
1. **Out of Scope**: What should NOT be included?
2. **Phase 2**: What could be deferred to later?
3. **Dependencies**: What external constraints exist?`,
    delta: 7,
    category: 'scope',
  },
  success: {
    response: `Success criteria help us measure outcomes. I've captured:

**Success Metrics:**
- [Based on your message]

Let's define measurable goals:
1. **KPIs**: What metrics will you track?
2. **Targets**: What numbers indicate success?
3. **Timeline**: When should we measure?`,
    delta: 5,
    category: 'success',
  },
  risks: {
    response: `Identifying risks early is valuable. I've noted:

**Risks Identified:**
- [Based on your message]

Additional risk assessment:
1. **Technical Risks**: What could fail technically?
2. **Business Risks**: What market/business factors?
3. **Mitigation**: How can we reduce these risks?`,
    delta: 5,
    category: 'risks',
  },
};

/**
 * Generate mock ideation response
 */
export async function generateMockIdeationResponse(
  request: IdeationChatRequest
): Promise<IdeationChatResponse> {
  await delay(800 + Math.random() * 400); // Simulate network delay

  const message = request.message.toLowerCase();

  // Get or create session state
  let state = sessionState.get(request.sessionId);
  if (!state) {
    state = { messageCount: 0, maturity: mockMaturityStates.initial };
    sessionState.set(request.sessionId, state);
  }

  state.messageCount++;

  // Determine response based on keywords
  let responseTemplate = responseTemplates.functional; // Default
  let detectedCategory = 'functional';

  for (const [keyword, template] of Object.entries(responseTemplates)) {
    if (message.includes(keyword)) {
      responseTemplate = template;
      detectedCategory = keyword;
      break;
    }
  }

  // Check for other keywords
  if (message.includes('oauth') || message.includes('login') || message.includes('authentication')) {
    responseTemplate = responseTemplates.security;
    detectedCategory = 'functional';
  }
  if (message.includes('user') || message.includes('admin') || message.includes('role')) {
    responseTemplate = responseTemplates.users;
    detectedCategory = 'users';
  }
  if (message.includes('scale') || message.includes('performance') || message.includes('fast')) {
    responseTemplate = responseTemplates.performance;
    detectedCategory = 'nfr';
  }

  // Calculate new maturity
  const newScore = Math.min(100, request.currentMaturity + responseTemplate.delta);
  const newLevel = getMaturityLevelFromScore(newScore);

  // Update categories based on detected topic
  const updatedCategories = state.maturity.categories.map((cat) => {
    if (cat.id === detectedCategory || (detectedCategory === 'security' && cat.id === 'nfr')) {
      return { ...cat, score: Math.min(100, cat.score + 15) };
    }
    return cat;
  });

  const newMaturity: MaturityState = {
    score: newScore,
    level: newLevel,
    categories: updatedCategories,
    canSubmit: newScore >= 80,
    gaps: newScore >= 80 ? [] : ['Continue discussing requirements to increase maturity'],
  };

  state.maturity = newMaturity;

  // Generate extracted requirements occasionally
  const extractedRequirements: Requirement[] = [];
  if (Math.random() > 0.5 && message.length > 20) {
    extractedRequirements.push({
      id: generateId('req'),
      description: `Requirement extracted from: "${message.substring(0, 50)}..."`,
      type: detectedCategory === 'nfr' ? 'non_functional' : 'functional',
      priority: 'should_have',
      categoryId: detectedCategory === 'security' ? 'functional' : detectedCategory,
      createdAt: new Date().toISOString(),
    });
  }

  const responseMessage: IdeationMessage = {
    id: generateId('msg'),
    role: 'assistant',
    content: responseTemplate.response,
    timestamp: new Date().toISOString(),
    maturityDelta: responseTemplate.delta,
    extractedRequirements,
    suggestedFollowups: [
      'Tell me more about your users',
      'What are the security requirements?',
      'What defines success for this project?',
    ],
  };

  return {
    message: responseMessage,
    maturityUpdate: newMaturity,
    extractedRequirements,
    suggestedFollowups: responseMessage.suggestedFollowups || [],
  };
}

/**
 * Submit mock PRD
 */
export async function submitMockPRD(
  request: PRDSubmission
): Promise<PRDSubmissionResult> {
  await delay(1500); // Simulate longer processing

  if (request.maturityScore < 80) {
    return {
      success: false,
      error: `Maturity score (${request.maturityScore}%) is below the required threshold of 80%`,
    };
  }

  return {
    success: true,
    gateId: generateId('gate'),
    prdDraft: {
      ...mockPRDDocument,
      id: generateId('prd'),
      createdAt: new Date().toISOString(),
    },
    userStories: mockUserStories,
  };
}

/**
 * Get mock session maturity
 */
export async function getMockSessionMaturity(sessionId: string): Promise<MaturityState> {
  await delay(300);

  const state = sessionState.get(sessionId);
  if (state) {
    return state.maturity;
  }

  return mockMaturityStates.initial;
}

// ============================================================================
// Draft Storage (in-memory for mock)
// ============================================================================

interface MockDraft {
  messages: IdeationMessage[];
  maturity: MaturityState;
  requirements: Requirement[];
  projectName: string;
  status: ProjectStatus;
  dataSource: 'mock' | 'configured';
  lastModified: string;
}

const mockDrafts: Map<string, MockDraft> = new Map();

// Seed with some example projects for demo purposes
function initializeMockDrafts() {
  if (mockDrafts.size > 0) return;

  const now = new Date();
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  mockDrafts.set('demo-auth-system', {
    messages: mockChatHistory,
    maturity: mockMaturityStates.complete,
    requirements: mockRequirements,
    projectName: 'Authentication System',
    status: 'approved',
    dataSource: 'configured',
    lastModified: daysAgo(2),
  });

  mockDrafts.set('demo-inventory-mgmt', {
    messages: [mockChatHistory[0], mockChatHistory[1]],
    maturity: mockMaturityStates.exploration,
    requirements: [mockRequirements[0]],
    projectName: 'Inventory Management',
    status: 'draft',
    dataSource: 'mock',
    lastModified: daysAgo(1),
  });

  mockDrafts.set('demo-notification-service', {
    messages: mockChatHistory.slice(0, 4),
    maturity: mockMaturityStates.defined,
    requirements: mockRequirements.slice(0, 3),
    projectName: 'Notification Service',
    status: 'in_build',
    dataSource: 'configured',
    lastModified: daysAgo(5),
  });
}

// Initialize on module load
initializeMockDrafts();

/**
 * Save mock draft
 */
export async function saveMockDraft(
  sessionId: string,
  draft: {
    messages: IdeationMessage[];
    maturity: MaturityState;
    requirements: Requirement[];
    projectName?: string;
    status?: ProjectStatus;
    dataSource?: 'mock' | 'configured';
  }
): Promise<void> {
  await delay(200);
  const existing = mockDrafts.get(sessionId);
  const projectName = draft.projectName || existing?.projectName || 'Untitled Project';
  const status = draft.status || existing?.status || 'draft';
  const dataSource = draft.dataSource || existing?.dataSource || 'mock';

  mockDrafts.set(sessionId, {
    messages: draft.messages,
    maturity: draft.maturity,
    requirements: draft.requirements,
    projectName,
    status,
    dataSource,
    lastModified: new Date().toISOString(),
  });
}

/**
 * Load mock draft
 */
export async function loadMockDraft(
  sessionId: string
): Promise<{
  messages: IdeationMessage[];
  maturity: MaturityState;
  requirements: Requirement[];
  projectName: string;
  status: ProjectStatus;
  dataSource: 'mock' | 'configured';
} | null> {
  await delay(200);
  // Initialize if needed
  initializeMockDrafts();
  const draft = mockDrafts.get(sessionId);
  if (!draft) return null;
  return {
    messages: draft.messages,
    maturity: draft.maturity,
    requirements: draft.requirements,
    projectName: draft.projectName,
    status: draft.status,
    dataSource: draft.dataSource,
  };
}

/**
 * Delete mock draft
 */
export async function deleteMockDraft(sessionId: string): Promise<void> {
  await delay(100);
  mockDrafts.delete(sessionId);
}

/**
 * List mock drafts
 */
export async function listMockDrafts(): Promise<SavedProject[]> {
  await delay(200);
  // Initialize if needed
  initializeMockDrafts();
  return Array.from(mockDrafts.entries()).map(([sessionId, draft]) => ({
    sessionId,
    projectName: draft.projectName,
    maturityScore: draft.maturity.score,
    status: draft.status,
    lastModified: draft.lastModified,
  }));
}
