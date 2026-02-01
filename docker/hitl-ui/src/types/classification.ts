/**
 * Classification Types (P08-F03)
 *
 * Type definitions for auto-classification of ideas, including
 * classification results, requests, labels, and taxonomy management.
 * These types mirror the backend Python models in
 * src/orchestrator/api/models/classification.py
 */

// ============================================================================
// Classification Types
// ============================================================================

/**
 * Classification type for ideas.
 *
 * Indicates whether an idea is functional (user-facing feature),
 * non-functional (technical/quality concern), or undetermined.
 */
export type ClassificationType = 'functional' | 'non_functional' | 'undetermined';

/**
 * Status of a batch classification job.
 */
export type ClassificationJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ============================================================================
// Label Types
// ============================================================================

/**
 * Definition of a label in the taxonomy.
 */
export interface LabelDefinition {
  /** Unique identifier for the label (e.g., "feature", "bug") */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Optional description of when to use this label */
  description?: string;
  /** Keywords that help identify ideas for this label */
  keywords: string[];
  /** Optional hex color code for UI display (e.g., "#22c55e") */
  color?: string;
}

/**
 * A taxonomy of labels for idea classification.
 */
export interface LabelTaxonomy {
  /** Unique identifier for the taxonomy */
  id: string;
  /** Human-readable name for the taxonomy */
  name: string;
  /** Optional description of the taxonomy */
  description?: string;
  /** List of label definitions in this taxonomy */
  labels: LabelDefinition[];
  /** Version string for tracking taxonomy changes */
  version: string;
  /** When the taxonomy was created (ISO 8601 string) */
  created_at?: string;
  /** When the taxonomy was last modified (ISO 8601 string) */
  updated_at?: string;
}

// ============================================================================
// Classification Result Types
// ============================================================================

/**
 * Result of classifying an idea.
 */
export interface ClassificationResult {
  /** The ID of the classified idea */
  idea_id: string;
  /** The determined classification type */
  classification: ClassificationType;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** List of label IDs assigned to this idea */
  labels: string[];
  /** Optional explanation of the classification decision */
  reasoning?: string;
  /** Optional version of the classification model used */
  model_version?: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request to classify a single idea.
 */
export interface ClassificationRequest {
  /** The ID of the idea to classify */
  idea_id: string;
}

/**
 * Request to classify multiple ideas in a batch.
 */
export interface BatchClassificationRequest {
  /** List of idea IDs to classify */
  idea_ids: string[];
}

// ============================================================================
// Job Types
// ============================================================================

/**
 * A batch classification job.
 */
export interface ClassificationJob {
  /** Unique identifier for the job */
  job_id: string;
  /** Current status of the job */
  status: ClassificationJobStatus;
  /** Total number of ideas to classify */
  total: number;
  /** Number of ideas successfully classified */
  completed: number;
  /** Number of ideas that failed classification */
  failed: number;
  /** When the job was created (ISO 8601 string) */
  created_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for GET /api/ideas/{id}/classification
 */
export interface ClassificationResultResponse {
  result: ClassificationResult;
}

/**
 * Response for POST /api/ideas/classify/batch
 */
export interface BatchClassificationResponse {
  job: ClassificationJob;
}

/**
 * Response for GET /api/admin/labels/taxonomy
 */
export interface TaxonomyResponse {
  taxonomy: LabelTaxonomy;
}

/**
 * Response for GET /api/admin/labels/taxonomy/labels
 */
export interface LabelsResponse {
  labels: LabelDefinition[];
}

// ============================================================================
// UI Helper Constants
// ============================================================================

/** Classification type to color mapping for badges */
export const CLASSIFICATION_COLORS: Record<ClassificationType, string> = {
  functional: 'bg-status-success',
  non_functional: 'bg-accent-blue',
  undetermined: 'bg-status-info',
};

/** Classification type to label mapping */
export const CLASSIFICATION_LABELS: Record<ClassificationType, string> = {
  functional: 'Functional',
  non_functional: 'Non-Functional',
  undetermined: 'Undetermined',
};

/** Job status to color mapping for badges */
export const JOB_STATUS_COLORS: Record<ClassificationJobStatus, string> = {
  pending: 'bg-status-info',
  processing: 'bg-accent-blue',
  completed: 'bg-status-success',
  failed: 'bg-status-error',
};

/** Job status to label mapping */
export const JOB_STATUS_LABELS: Record<ClassificationJobStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for checking if a value is a valid ClassificationType
 */
export function isClassificationType(value: string): value is ClassificationType {
  return ['functional', 'non_functional', 'undetermined'].includes(value);
}

/**
 * Type guard for checking if a value is a valid ClassificationJobStatus
 */
export function isClassificationJobStatus(value: string): value is ClassificationJobStatus {
  return ['pending', 'processing', 'completed', 'failed'].includes(value);
}

// ============================================================================
// Default Values
// ============================================================================

/** Default taxonomy for new installations */
export const DEFAULT_LABELS: LabelDefinition[] = [
  {
    id: 'feature',
    name: 'Feature',
    description: 'New functionality or capability',
    keywords: ['add', 'new', 'create', 'implement', 'enable'],
    color: '#22c55e',
  },
  {
    id: 'enhancement',
    name: 'Enhancement',
    description: 'Improvement to existing functionality',
    keywords: ['improve', 'enhance', 'update', 'optimize', 'better'],
    color: '#3b82f6',
  },
  {
    id: 'bug',
    name: 'Bug',
    description: 'Something that is broken or not working correctly',
    keywords: ['fix', 'broken', 'error', 'issue', 'wrong'],
    color: '#ef4444',
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Speed, efficiency, or resource usage concerns',
    keywords: ['slow', 'fast', 'memory', 'cpu', 'latency', 'performance'],
    color: '#f59e0b',
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Security-related concerns or improvements',
    keywords: ['security', 'auth', 'permission', 'vulnerability', 'secure'],
    color: '#8b5cf6',
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Documentation updates or improvements',
    keywords: ['docs', 'documentation', 'readme', 'guide', 'help'],
    color: '#6b7280',
  },
];
