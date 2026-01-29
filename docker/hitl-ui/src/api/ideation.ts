/**
 * Ideation Studio API endpoints (P05-F11 T04)
 *
 * Handles chat interactions, maturity tracking, and PRD submission
 * for the PRD Ideation Studio feature.
 *
 * Backend endpoints (from src/orchestrator/routes/ideation_api.py):
 * - POST /api/studio/ideation/chat - Send message, get response with maturity update
 * - POST /api/studio/ideation/submit-prd - Submit for PRD generation
 * - GET /api/studio/ideation/{sessionId}/maturity - Get current maturity
 * - POST /api/studio/ideation/{sessionId}/draft - Save draft
 */

import { apiClient } from './client';
import { config } from '../config';
import type {
  IdeationChatRequest,
  IdeationChatResponse,
  PRDSubmission,
  PRDSubmissionResult,
  MaturityState,
  MaturityLevel,
  IdeationMessage,
  Requirement,
  CategoryMaturity,
} from '../types/ideation';
import { MATURITY_LEVELS, REQUIRED_CATEGORIES } from '../types/ideation';

// Import mock implementations for development
import { areMocksEnabled } from './mocks/index';
import * as mockIdeation from './mocks/ideation';

// ============================================================================
// Backend Response Types (may differ from frontend types)
// ============================================================================

/**
 * Backend maturity state has level as string, not object
 */
interface BackendMaturityState {
  score: number;
  level: string;
  categories: BackendCategoryMaturity[];
  canSubmit: boolean;
  gaps: string[];
}

/**
 * Backend category maturity may not have weight field
 */
interface BackendCategoryMaturity {
  id: string;
  name: string;
  score: number;
  requiredForSubmit: boolean;
  sections?: Array<{ id: string; name: string; score: number }>;
}

/**
 * Backend PRD submission response (SubmitPRDResponse)
 */
interface BackendSubmitPRDResponse {
  gateId: string;
  prdDraft: {
    id: string;
    title: string;
    version: string;
    sections: Array<{ id: string; heading: string; content: string; order: number }>;
    createdAt: string;
    status: string;
  };
  userStories: Array<{
    id: string;
    title: string;
    asA: string;
    iWant: string;
    soThat: string;
    acceptanceCriteria: string[];
    linkedRequirements: string[];
    priority: string;
  }>;
  status: string;
}

/**
 * Backend chat response
 */
interface BackendChatResponse {
  message: {
    id: string;
    role: string;
    content: string;
    timestamp: string;
    maturityDelta?: number;
    extractedRequirements?: Requirement[];
    suggestedFollowups?: string[];
  };
  maturityUpdate: BackendMaturityState;
  extractedRequirements: Requirement[];
  suggestedFollowups: string[];
}

// ============================================================================
// Type Transformation Functions
// ============================================================================

/**
 * Get MaturityLevel object from level string
 */
function getMaturityLevelFromString(levelStr: string): MaturityLevel {
  const level = MATURITY_LEVELS.find(l => l.level === levelStr);
  return level || MATURITY_LEVELS[0];
}

/**
 * Get MaturityLevel object from score
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

/**
 * Transform backend maturity state to frontend type
 */
function transformMaturityState(backend: BackendMaturityState): MaturityState {
  // Get level object from string or derive from score
  const level = typeof backend.level === 'string'
    ? getMaturityLevelFromString(backend.level)
    : getMaturityLevelFromScore(backend.score);

  // Transform categories, adding weight from REQUIRED_CATEGORIES if missing
  const categories: CategoryMaturity[] = backend.categories.map(cat => {
    const categoryConfig = REQUIRED_CATEGORIES.find(c => c.id === cat.id);
    return {
      id: cat.id,
      name: cat.name,
      score: cat.score,
      weight: categoryConfig?.weight || 10,
      requiredForSubmit: cat.requiredForSubmit,
      sections: cat.sections?.map(s => ({
        id: s.id,
        name: s.name,
        score: s.score,
        captured: [],
      })) || [],
    };
  });

  return {
    score: backend.score,
    level,
    categories,
    canSubmit: backend.canSubmit,
    gaps: backend.gaps,
  };
}

/**
 * Transform backend chat response to frontend type
 */
function transformChatResponse(backend: BackendChatResponse): IdeationChatResponse {
  return {
    message: {
      id: backend.message.id,
      role: backend.message.role as 'user' | 'assistant' | 'system',
      content: backend.message.content,
      timestamp: backend.message.timestamp,
      maturityDelta: backend.message.maturityDelta,
      extractedRequirements: backend.message.extractedRequirements,
      suggestedFollowups: backend.message.suggestedFollowups,
    },
    maturityUpdate: transformMaturityState(backend.maturityUpdate),
    extractedRequirements: backend.extractedRequirements,
    suggestedFollowups: backend.suggestedFollowups,
  };
}

/**
 * Transform backend PRD submission response to frontend type
 */
function transformSubmitPRDResponse(backend: BackendSubmitPRDResponse): PRDSubmissionResult {
  return {
    success: true,
    gateId: backend.gateId,
    prdDraft: {
      id: backend.prdDraft.id,
      title: backend.prdDraft.title,
      version: backend.prdDraft.version,
      sections: backend.prdDraft.sections,
      createdAt: backend.prdDraft.createdAt,
      status: backend.prdDraft.status as 'draft' | 'pending_review' | 'approved',
    },
    userStories: backend.userStories.map(story => ({
      id: story.id,
      title: story.title,
      asA: story.asA,
      iWant: story.iWant,
      soThat: story.soThat,
      acceptanceCriteria: story.acceptanceCriteria,
      linkedRequirements: story.linkedRequirements,
      priority: story.priority as 'must_have' | 'should_have' | 'could_have',
    })),
  };
}

/**
 * Transform frontend PRD submission to backend request format
 */
function transformToPRDSubmitRequest(frontend: PRDSubmission): {
  sessionId: string;
  maturityState: {
    score: number;
    level: string;
    categories: BackendCategoryMaturity[];
    canSubmit: boolean;
    gaps: string[];
  };
  includeUserStories: boolean;
} {
  // Backend expects maturityState object, not just score
  // We need to construct it from available data
  return {
    sessionId: frontend.sessionId,
    maturityState: {
      score: frontend.maturityScore,
      level: frontend.maturityScore >= 80 ? 'complete' : 'refined',
      categories: frontend.extractedRequirements.reduce((acc, req) => {
        const existing = acc.find(c => c.id === req.categoryId);
        if (!existing) {
          acc.push({
            id: req.categoryId,
            name: req.categoryId,
            score: frontend.maturityScore,
            requiredForSubmit: true,
          });
        }
        return acc;
      }, [] as BackendCategoryMaturity[]),
      canSubmit: frontend.maturityScore >= 80,
      gaps: [],
    },
    includeUserStories: true,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Send a chat message in an ideation session and receive AI response.
 * The response includes updated maturity scoring and any extracted requirements.
 *
 * @param request - Chat request with session ID, message, and current maturity
 * @returns Response with AI message, maturity update, and extracted requirements
 * @throws Error if API call fails
 */
export async function sendIdeationMessage(
  request: IdeationChatRequest
): Promise<IdeationChatResponse> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.generateMockIdeationResponse(request);
  }

  try {
    const response = await apiClient.post<BackendChatResponse>(
      '/studio/ideation/chat',
      request
    );
    return transformChatResponse(response.data);
  } catch (error) {
    if (config.isDev) {
      console.error('[Ideation API] sendIdeationMessage failed:', error);
    }
    throw error;
  }
}

/**
 * Submit the ideation session for PRD generation.
 * Requires maturity score >= 80% to submit successfully.
 *
 * @param request - Submission data including session, maturity, and requirements
 * @returns Result with success status, PRD draft, and user stories
 * @throws Error if maturity below threshold or API call fails
 */
export async function submitForPRD(
  request: PRDSubmission
): Promise<PRDSubmissionResult> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.submitMockPRD(request);
  }

  try {
    // Transform frontend request to backend format
    const backendRequest = transformToPRDSubmitRequest(request);
    const response = await apiClient.post<BackendSubmitPRDResponse>(
      '/studio/ideation/submit-prd',
      backendRequest
    );
    return transformSubmitPRDResponse(response.data);
  } catch (error: unknown) {
    if (config.isDev) {
      console.error('[Ideation API] submitForPRD failed:', error);
    }
    // Handle HTTP 400 error for maturity threshold
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { detail?: string } } };
      if (axiosError.response?.status === 400) {
        return {
          success: false,
          error: axiosError.response.data?.detail || 'Maturity score below required threshold',
        };
      }
    }
    throw error;
  }
}

/**
 * Get the current maturity state for a session.
 * Useful for resuming sessions or refreshing state.
 *
 * @param sessionId - The session ID to query
 * @returns Current maturity state with score, level, and categories
 * @throws Error if session not found or API call fails
 */
export async function getSessionMaturity(
  sessionId: string
): Promise<MaturityState> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.getMockSessionMaturity(sessionId);
  }

  try {
    const response = await apiClient.get<BackendMaturityState>(
      `/studio/ideation/${sessionId}/maturity`
    );
    return transformMaturityState(response.data);
  } catch (error) {
    if (config.isDev) {
      console.error('[Ideation API] getSessionMaturity failed:', error);
    }
    throw error;
  }
}

/**
 * Backend save draft request format
 */
interface BackendSaveDraftRequest {
  messages: IdeationMessage[];
  maturityState: {
    score: number;
    level: string;
    categories: BackendCategoryMaturity[];
    canSubmit: boolean;
    gaps: string[];
  };
  extractedRequirements: Requirement[];
}

/**
 * Transform frontend draft to backend save request format
 */
function transformToSaveDraftRequest(
  draft: {
    messages: IdeationMessage[];
    maturity: MaturityState;
    requirements: Requirement[];
  }
): BackendSaveDraftRequest {
  return {
    messages: draft.messages,
    maturityState: {
      score: draft.maturity.score,
      level: draft.maturity.level.level,
      categories: draft.maturity.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        score: cat.score,
        requiredForSubmit: cat.requiredForSubmit,
        sections: cat.sections?.map(s => ({
          id: s.id,
          name: s.name,
          score: s.score,
        })),
      })),
      canSubmit: draft.maturity.canSubmit,
      gaps: draft.maturity.gaps,
    },
    extractedRequirements: draft.requirements,
  };
}

/**
 * Save a draft of the ideation session.
 * Used for auto-save and manual draft saving.
 *
 * @param sessionId - The session ID
 * @param draft - Draft data including messages, maturity, and requirements
 * @throws Error if API call fails
 */
export async function saveIdeationDraft(
  sessionId: string,
  draft: {
    messages: IdeationMessage[];
    maturity: MaturityState;
    requirements: Requirement[];
  }
): Promise<void> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.saveMockDraft(sessionId, draft);
  }

  try {
    const backendRequest = transformToSaveDraftRequest(draft);
    await apiClient.post(`/studio/ideation/${sessionId}/draft`, backendRequest);
  } catch (error) {
    if (config.isDev) {
      console.error('[Ideation API] saveIdeationDraft failed:', error);
    }
    throw error;
  }
}

/**
 * Backend load draft response format
 */
interface BackendLoadDraftResponse {
  messages: IdeationMessage[];
  maturityState: BackendMaturityState;
  extractedRequirements: Requirement[];
}

/**
 * Load a saved draft for a session.
 *
 * @param sessionId - The session ID to load
 * @returns Draft data or null if not found
 */
export async function loadIdeationDraft(
  sessionId: string
): Promise<{
  messages: IdeationMessage[];
  maturity: MaturityState;
  requirements: Requirement[];
} | null> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.loadMockDraft(sessionId);
  }

  try {
    const response = await apiClient.get<BackendLoadDraftResponse>(
      `/studio/ideation/${sessionId}/draft`
    );
    return {
      messages: response.data.messages,
      maturity: transformMaturityState(response.data.maturityState),
      requirements: response.data.extractedRequirements,
    };
  } catch (error: unknown) {
    // Return null if draft not found (404)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
    }
    if (config.isDev) {
      console.error('[Ideation API] loadIdeationDraft failed:', error);
    }
    throw error;
  }
}

/**
 * Delete a saved draft.
 *
 * @param sessionId - The session ID whose draft to delete
 * @throws Error if API call fails
 */
export async function deleteIdeationDraft(sessionId: string): Promise<void> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.deleteMockDraft(sessionId);
  }

  try {
    await apiClient.delete(`/studio/ideation/${sessionId}/draft`);
  } catch (error) {
    if (config.isDev) {
      console.error('[Ideation API] deleteIdeationDraft failed:', error);
    }
    throw error;
  }
}

/**
 * List all saved drafts for the current user.
 *
 * @returns List of saved draft summaries
 * @throws Error if API call fails
 */
export async function listIdeationDrafts(): Promise<
  Array<{
    sessionId: string;
    projectName: string;
    maturityScore: number;
    lastModified: string;
  }>
> {
  // Use mocks in development if enabled
  if (areMocksEnabled()) {
    return mockIdeation.listMockDrafts();
  }

  try {
    const response = await apiClient.get<
      Array<{
        sessionId: string;
        projectName: string;
        maturityScore: number;
        lastModified: string;
      }>
    >('/studio/ideation/drafts');
    return response.data;
  } catch (error) {
    if (config.isDev) {
      console.error('[Ideation API] listIdeationDrafts failed:', error);
    }
    throw error;
  }
}
