/**
 * Types for Brainflare Hub Ideas
 *
 * These types support the ideas management workflow including:
 * - Idea submission and capture
 * - Classification (functional/non-functional)
 * - Labeling and filtering
 * - Status tracking (active/archived)
 */

/**
 * Idea status for filtering and lifecycle management
 */
export type IdeaStatus = 'active' | 'archived';

/**
 * Idea classification for categorizing requirement types
 */
export type IdeaClassification = 'functional' | 'non_functional' | 'undetermined';

/**
 * Core Idea entity representing a captured idea
 */
export interface Idea {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  status: IdeaStatus;
  classification: IdeaClassification;
  labels: string[];
  created_at: string;
  updated_at: string;
  word_count: number;
}

/**
 * Request payload for creating a new idea
 */
export interface CreateIdeaRequest {
  content: string;
  author_id?: string;
  author_name?: string;
  classification?: IdeaClassification;
  labels?: string[];
}

/**
 * Request payload for updating an existing idea
 */
export interface UpdateIdeaRequest {
  content?: string;
  status?: IdeaStatus;
  classification?: IdeaClassification;
  labels?: string[];
}

/**
 * Response structure for paginated idea list
 */
export interface IdeaListResponse {
  ideas: Idea[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Filter options for querying ideas
 */
export interface IdeaFilters {
  status?: IdeaStatus;
  classification?: IdeaClassification;
  search?: string;
}

/**
 * Maximum word count for ideas (144 words, inspired by tweet constraints)
 */
export const MAX_IDEA_WORDS = 144;

/**
 * Type guard for checking if a value is a valid IdeaStatus
 */
export function isIdeaStatus(value: string): value is IdeaStatus {
  return ['active', 'archived'].includes(value);
}

/**
 * Type guard for checking if a value is a valid IdeaClassification
 */
export function isIdeaClassification(value: string): value is IdeaClassification {
  return ['functional', 'non_functional', 'undetermined'].includes(value);
}
