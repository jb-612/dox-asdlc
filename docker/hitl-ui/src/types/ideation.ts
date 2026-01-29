/**
 * TypeScript types for PRD Ideation Studio (P05-F11)
 *
 * These types support the ideation workflow including:
 * - Maturity tracking and scoring
 * - Ideation chat messages
 * - Requirements extraction
 * - PRD document generation
 * - User story creation
 */

// ============================================================================
// Maturity Types
// ============================================================================

/**
 * Maturity level identifier
 * - concept: 0-20% - Basic idea captured
 * - exploration: 20-40% - Key areas identified
 * - defined: 40-60% - Core requirements clear
 * - refined: 60-80% - Details mostly complete
 * - complete: 80-100% - Ready for PRD generation
 */
export type MaturityLevelId = 'concept' | 'exploration' | 'defined' | 'refined' | 'complete';

/**
 * Maturity level definition with scoring thresholds
 */
export interface MaturityLevel {
  level: MaturityLevelId;
  minScore: number;
  maxScore: number;
  label: string;
  description: string;
}

/**
 * Section within a category showing individual coverage
 */
export interface SectionMaturity {
  id: string;
  name: string;
  score: number;       // 0-100
  captured: string[];  // Captured points from conversation
}

/**
 * Category maturity for major PRD sections
 */
export interface CategoryMaturity {
  id: string;
  name: string;
  score: number;              // 0-100
  weight: number;             // Percentage weight (e.g., 15 for 15%)
  requiredForSubmit: boolean;
  sections: SectionMaturity[];
}

/**
 * Overall maturity state for an ideation session
 */
export interface MaturityState {
  score: number;              // 0-100 weighted total
  level: MaturityLevel;
  categories: CategoryMaturity[];
  canSubmit: boolean;         // true when score >= 80
  gaps: string[];             // Missing or weak areas
}

/**
 * Gap identified in maturity assessment
 */
export interface Gap {
  categoryId: string;
  categoryName: string;
  severity: 'critical' | 'moderate' | 'minor';
  description: string;
  suggestedQuestions: string[];
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Ideation message - standalone interface (NOT extending ChatMessage)
 * to avoid type conflicts with existing ChatMessage definitions.
 * Uses ISO 8601 timestamp string format consistent with api/types.ts.
 */
export interface IdeationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;                      // ISO 8601 format
  maturityDelta?: number;                 // Change in maturity score
  extractedRequirements?: Requirement[];
  suggestedFollowups?: string[];          // Agent's suggested next questions
}

// ============================================================================
// Requirement Types
// ============================================================================

/**
 * Requirement type classification
 */
export type RequirementType = 'functional' | 'non_functional' | 'constraint';

/**
 * Requirement priority using MoSCoW method
 */
export type RequirementPriority = 'must_have' | 'should_have' | 'could_have';

/**
 * Requirement extracted from ideation conversation
 */
export interface Requirement {
  id: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  categoryId: string;
  sourceMessageId?: string;
  createdAt: string;                      // ISO 8601 format
}

// ============================================================================
// PRD Document Types
// ============================================================================

/**
 * PRD document status
 */
export type PRDStatus = 'draft' | 'pending_review' | 'approved';

/**
 * Section within a PRD document
 */
export interface PRDSection {
  id: string;
  heading: string;
  content: string;
  order: number;
}

/**
 * Complete PRD document
 */
export interface PRDDocument {
  id: string;
  title: string;
  version: string;
  sections: PRDSection[];
  createdAt: string;                      // ISO 8601 format
  status: PRDStatus;
}

// ============================================================================
// User Story Types
// ============================================================================

/**
 * User story following the "As a... I want... So that..." format
 */
export interface UserStory {
  id: string;
  title: string;
  asA: string;                            // "As a [user type]"
  iWant: string;                          // "I want to [action]"
  soThat: string;                         // "So that [benefit]"
  acceptanceCriteria: string[];
  linkedRequirements: string[];           // Requirement IDs
  priority: RequirementPriority;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Ideation session tracking all conversation and state
 */
export interface IdeationSession {
  id: string;
  projectName: string;
  createdAt: string;                      // ISO 8601 format
  updatedAt: string;                      // ISO 8601 format
  messages: IdeationMessage[];
  maturity: MaturityState;
  extractedRequirements: Requirement[];
  userStories: UserStory[];
  prdDraft: PRDDocument | null;
  submittedGateId: string | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to send a chat message in ideation
 */
export interface IdeationChatRequest {
  sessionId: string;
  message: string;
  currentMaturity: number;
  model?: 'sonnet' | 'opus' | 'haiku';
  rlmEnabled?: boolean;
}

/**
 * Response from ideation chat API
 */
export interface IdeationChatResponse {
  message: IdeationMessage;
  maturityUpdate: MaturityState;
  extractedRequirements: Requirement[];
  suggestedFollowups: string[];
}

/**
 * Request to submit for PRD generation
 */
export interface PRDSubmission {
  sessionId: string;
  maturityScore: number;
  extractedRequirements: Requirement[];
  conversationSummary: string;
  requestedBy: string;
}

/**
 * Response from PRD submission
 */
export interface PRDSubmissionResult {
  success: boolean;
  gateId?: string;
  prdDraft?: PRDDocument;
  userStories?: UserStory[];
  error?: string;
}

/**
 * Request to save a draft
 */
export interface SaveDraftRequest {
  sessionId: string;
  messages: IdeationMessage[];
  maturity: MaturityState;
  requirements: Requirement[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard maturity levels with scoring ranges
 */
export const MATURITY_LEVELS: MaturityLevel[] = [
  {
    level: 'concept',
    minScore: 0,
    maxScore: 20,
    label: 'General Concept',
    description: 'Basic idea captured',
  },
  {
    level: 'exploration',
    minScore: 20,
    maxScore: 40,
    label: 'Exploration',
    description: 'Key areas identified',
  },
  {
    level: 'defined',
    minScore: 40,
    maxScore: 60,
    label: 'Firm Understanding',
    description: 'Core requirements clear',
  },
  {
    level: 'refined',
    minScore: 60,
    maxScore: 80,
    label: 'Refined',
    description: 'Details mostly complete',
  },
  {
    level: 'complete',
    minScore: 80,
    maxScore: 100,
    label: 'Tightly Defined',
    description: 'Ready for PRD generation',
  },
];

/**
 * Required categories for PRD with weights (must sum to 100)
 */
export const REQUIRED_CATEGORIES = [
  { id: 'problem', name: 'Problem Statement', weight: 15, requiredForSubmit: true },
  { id: 'users', name: 'Target Users', weight: 10, requiredForSubmit: true },
  { id: 'functional', name: 'Functional Requirements', weight: 25, requiredForSubmit: true },
  { id: 'nfr', name: 'Non-Functional Requirements', weight: 15, requiredForSubmit: false },
  { id: 'scope', name: 'Scope & Constraints', weight: 15, requiredForSubmit: true },
  { id: 'success', name: 'Success Criteria', weight: 10, requiredForSubmit: false },
  { id: 'risks', name: 'Risks & Assumptions', weight: 10, requiredForSubmit: false },
] as const;

/**
 * Minimum maturity score required for PRD submission
 */
export const SUBMIT_THRESHOLD = 80;

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Type guard for checking if a value is a valid MaturityLevelId
 */
export function isMaturityLevelId(value: string): value is MaturityLevelId {
  return ['concept', 'exploration', 'defined', 'refined', 'complete'].includes(value);
}

/**
 * Type guard for checking if a value is a valid RequirementType
 */
export function isRequirementType(value: string): value is RequirementType {
  return ['functional', 'non_functional', 'constraint'].includes(value);
}

/**
 * Type guard for checking if a value is a valid RequirementPriority
 */
export function isRequirementPriority(value: string): value is RequirementPriority {
  return ['must_have', 'should_have', 'could_have'].includes(value);
}
