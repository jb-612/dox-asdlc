/**
 * TypeScript types for DevOps Activity Monitoring (P06-F07)
 *
 * These types define the data structures for tracking DevOps operations,
 * including deployment progress, step status, and activity history.
 */

// ============================================================================
// DevOps Status Types
// ============================================================================

/**
 * Overall status of a DevOps activity/operation
 * - in_progress: Operation is currently running
 * - completed: Operation finished successfully
 * - failed: Operation encountered an error and stopped
 */
export type DevOpsActivityStatus = 'in_progress' | 'completed' | 'failed';

/**
 * Status of an individual step within a DevOps operation
 * - pending: Step has not started yet
 * - running: Step is currently executing
 * - completed: Step finished successfully
 * - failed: Step encountered an error
 */
export type DevOpsStepStatus = 'pending' | 'running' | 'completed' | 'failed';

// ============================================================================
// DevOps Step Types
// ============================================================================

/**
 * Individual step within a DevOps operation
 */
export interface DevOpsStep {
  /** Step name/description (e.g., "Pull images", "Apply manifests") */
  name: string;
  /** Current status of this step */
  status: DevOpsStepStatus;
  /** ISO timestamp when step started (undefined if pending) */
  startedAt?: string;
  /** ISO timestamp when step completed (undefined if not completed) */
  completedAt?: string;
  /** Error message if step failed (undefined if not failed) */
  error?: string;
}

// ============================================================================
// DevOps Activity Types
// ============================================================================

/**
 * A DevOps activity represents a complete operation (e.g., deployment, rollback)
 */
export interface DevOpsActivity {
  /** Unique identifier for this activity */
  id: string;
  /** Operation description (e.g., "Deploy workers chart v2.1.0") */
  operation: string;
  /** Current status of the overall operation */
  status: DevOpsActivityStatus;
  /** ISO timestamp when operation started */
  startedAt: string;
  /** ISO timestamp when operation completed (undefined if still running) */
  completedAt?: string;
  /** Array of steps in this operation */
  steps: DevOpsStep[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from GET /api/devops/activity
 * Contains current and recent DevOps operations
 */
export interface DevOpsActivityResponse {
  /** Currently running operation (undefined if no operation in progress) */
  current?: DevOpsActivity;
  /** Recent operations (last 10), most recent first */
  recent: DevOpsActivity[];
}
