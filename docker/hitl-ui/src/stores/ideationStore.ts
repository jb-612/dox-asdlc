/**
 * Zustand store for PRD Ideation Studio (P05-F11 T02)
 *
 * Manages state for ideation sessions including:
 * - Session tracking
 * - Chat messages
 * - Maturity scoring
 * - Requirements extraction
 * - PRD submission
 */

import { create } from 'zustand';
import type {
  IdeationMessage,
  MaturityState,
  Requirement,
  UserStory,
  PRDDocument,
  PRDSubmissionResult,
} from '../types/ideation';
import { createInitialMaturityState } from '../utils/maturityCalculator';
import * as ideationApi from '../api/ideation';

/**
 * Ideation store state interface
 */
export interface IdeationState {
  // Session
  sessionId: string | null;
  projectName: string;

  // Messages
  messages: IdeationMessage[];
  isLoading: boolean;

  // Maturity tracking
  maturity: MaturityState;

  // Requirements
  extractedRequirements: Requirement[];
  userStories: UserStory[];

  // PRD submission
  prdDraft: PRDDocument | null;
  submittedGateId: string | null;
  isSubmitting: boolean;

  // Error state
  error: string | null;

  // Actions
  startSession: (projectName: string) => void;
  addMessage: (message: Omit<IdeationMessage, 'id' | 'timestamp'>) => void;
  sendMessage: (content: string) => Promise<void>;
  updateMaturity: (update: Partial<MaturityState>) => void;
  addRequirement: (requirement: Requirement) => void;
  removeRequirement: (requirementId: string) => void;
  updateRequirement: (requirementId: string, updates: Partial<Requirement>) => void;
  submitForPRD: () => Promise<PRDSubmissionResult>;
  resetSession: () => void;
  setError: (error: string | null) => void;
}

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `ideation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create welcome message for new session
 */
function createWelcomeMessage(projectName: string): IdeationMessage {
  return {
    id: generateMessageId(),
    role: 'assistant',
    content: `Welcome to the PRD Ideation Studio for **${projectName}**!

I'll help you develop a comprehensive Product Requirements Document through a structured interview process.

We'll explore several key areas:
- **Problem Statement** - What problem are we solving?
- **Target Users** - Who will use this?
- **Functional Requirements** - What should the system do?
- **Non-Functional Requirements** - Performance, security, etc.
- **Scope & Constraints** - What's in and out of scope?
- **Success Criteria** - How will we measure success?
- **Risks & Assumptions** - What could go wrong?

As we discuss, I'll track our progress toward a complete PRD. Once we reach 80% maturity, you can submit for formal PRD generation.

Let's start! **What problem are you trying to solve with this project?**`,
    timestamp: new Date().toISOString(),
    suggestedFollowups: [
      'What specific problem are you trying to solve?',
      'Who experiences this problem the most?',
      'What is the current workaround?',
    ],
  };
}

/**
 * Default state
 */
const DEFAULT_STATE = {
  sessionId: null,
  projectName: '',
  messages: [],
  isLoading: false,
  maturity: createInitialMaturityState(),
  extractedRequirements: [],
  userStories: [],
  prdDraft: null,
  submittedGateId: null,
  isSubmitting: false,
  error: null,
};

/**
 * Ideation store
 */
export const useIdeationStore = create<IdeationState>((set, get) => ({
  ...DEFAULT_STATE,

  /**
   * Start a new ideation session
   */
  startSession: (projectName: string) => {
    const sessionId = generateSessionId();
    const welcomeMessage = createWelcomeMessage(projectName);

    set({
      sessionId,
      projectName,
      messages: [welcomeMessage],
      maturity: createInitialMaturityState(),
      extractedRequirements: [],
      userStories: [],
      prdDraft: null,
      submittedGateId: null,
      isSubmitting: false,
      error: null,
    });
  },

  /**
   * Add a message to the conversation
   */
  addMessage: (message) => {
    const fullMessage: IdeationMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, fullMessage],
    }));
  },

  /**
   * Send a message and get AI response
   */
  sendMessage: async (content: string) => {
    const { sessionId, maturity, addMessage } = get();

    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }

    // Add user message
    addMessage({ role: 'user', content });

    // Set loading state
    set({ isLoading: true, error: null });

    try {
      // Call API
      const response = await ideationApi.sendIdeationMessage({
        sessionId,
        message: content,
        currentMaturity: maturity.score,
      });

      // Add assistant response
      set((state) => ({
        messages: [...state.messages, response.message],
        maturity: response.maturityUpdate,
        isLoading: false,
      }));

      // Add any extracted requirements
      if (response.extractedRequirements.length > 0) {
        const currentRequirements = get().extractedRequirements;
        const newRequirements = response.extractedRequirements.filter(
          (req) => !currentRequirements.some((existing) => existing.id === req.id)
        );

        if (newRequirements.length > 0) {
          set((state) => ({
            extractedRequirements: [...state.extractedRequirements, ...newRequirements],
          }));
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  },

  /**
   * Update maturity state
   */
  updateMaturity: (update: Partial<MaturityState>) => {
    set((state) => {
      const newMaturity = { ...state.maturity, ...update };
      // Auto-calculate canSubmit based on score
      if (update.score !== undefined) {
        newMaturity.canSubmit = update.score >= 80;
      }
      return { maturity: newMaturity };
    });
  },

  /**
   * Add an extracted requirement
   */
  addRequirement: (requirement: Requirement) => {
    set((state) => {
      // Check for duplicates
      if (state.extractedRequirements.some((r) => r.id === requirement.id)) {
        return state;
      }
      return {
        extractedRequirements: [...state.extractedRequirements, requirement],
      };
    });
  },

  /**
   * Remove a requirement by ID
   */
  removeRequirement: (requirementId: string) => {
    set((state) => ({
      extractedRequirements: state.extractedRequirements.filter(
        (r) => r.id !== requirementId
      ),
    }));
  },

  /**
   * Update a requirement
   */
  updateRequirement: (requirementId: string, updates: Partial<Requirement>) => {
    set((state) => ({
      extractedRequirements: state.extractedRequirements.map((r) =>
        r.id === requirementId ? { ...r, ...updates } : r
      ),
    }));
  },

  /**
   * Submit for PRD generation
   */
  submitForPRD: async (): Promise<PRDSubmissionResult> => {
    const { sessionId, maturity, extractedRequirements, messages } = get();

    if (!sessionId) {
      return { success: false, error: 'No active session' };
    }

    set({ isSubmitting: true, error: null });

    try {
      // Generate conversation summary from messages
      const conversationSummary = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role}: ${m.content.substring(0, 200)}`)
        .join('\n\n');

      // FIXME: Replace 'anonymous-user' with actual auth context
      // This should integrate with the authentication system once available.
      // Tracked as a known limitation - see auth integration backlog.
      const getCurrentUser = () => 'anonymous-user';

      const result = await ideationApi.submitForPRD({
        sessionId,
        maturityScore: maturity.score,
        extractedRequirements,
        conversationSummary,
        requestedBy: getCurrentUser(),
      });

      if (result.success) {
        set({
          prdDraft: result.prdDraft || null,
          submittedGateId: result.gateId || null,
          userStories: result.userStories || [],
          isSubmitting: false,
        });
      } else {
        set({
          isSubmitting: false,
          error: result.error || 'Submission failed',
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      set({
        isSubmitting: false,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Reset the session
   */
  resetSession: () => {
    set(DEFAULT_STATE);
  },

  /**
   * Set error state
   */
  setError: (error: string | null) => {
    set({ error });
  },
}));
