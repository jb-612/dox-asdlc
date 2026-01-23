/**
 * API Contract Schemas using Zod
 *
 * Provides runtime validation for API responses against defined contracts.
 */

import { z } from 'zod';

// =============================================================================
// Base Schemas
// =============================================================================

/** Paginated list response schema factory */
const paginatedList = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
  });

// =============================================================================
// Gate Schemas
// =============================================================================

/** Gate type enum */
export const GateTypeSchema = z.enum(['approval', 'review', 'decision', 'validation']);
export type GateType = z.infer<typeof GateTypeSchema>;

/** Gate status enum */
export const GateStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type GateStatus = z.infer<typeof GateStatusSchema>;

/** Gate priority enum */
export const GatePrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type GatePriority = z.infer<typeof GatePrioritySchema>;

/** Evidence schema */
export const EvidenceSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  summary: z.string(),
  timestamp: z.string(),
  artifact_id: z.string().optional(),
  run_id: z.string().optional(),
  content: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** Gate schema */
export const GateSchema = z.object({
  id: z.string(),
  gate_type: GateTypeSchema,
  status: GateStatusSchema,
  title: z.string(),
  description: z.string(),
  created_at: z.string(),
  priority: GatePrioritySchema,
  tenant: z.string(),
  resolved_at: z.string().optional(),
  resolved_by: z.string().optional(),
  decision: z.string().optional(),
  evidence: z.array(EvidenceSchema).optional(),
});
export type Gate = z.infer<typeof GateSchema>;

/** Gate list response schema */
export const GateListSchema = paginatedList(GateSchema);
export type GateList = z.infer<typeof GateListSchema>;

/** Feedback schema for gate decisions */
export const FeedbackSchema = z.object({
  tags: z.array(z.string()).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  summary: z.string().optional(),
  consider_for_improvement: z.boolean().optional(),
  duration_seconds: z.number().optional(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

/** Gate decision request schema */
export const GateDecisionSchema = z.object({
  gate_id: z.string(),
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().optional(),
  feedback: FeedbackSchema.optional(),
});
export type GateDecision = z.infer<typeof GateDecisionSchema>;

// =============================================================================
// Run Schemas
// =============================================================================

/** Run status enum */
export const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

/** Run schema */
export const RunSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: RunStatusSchema,
  started_at: z.string(),
  agent_type: z.string(),
  completed_at: z.string().optional().nullable(),
  duration_seconds: z.number().optional(),
  tokens_used: z.number().optional(),
  cost: z.number().optional(),
  error: z.string().optional().nullable(),
});
export type Run = z.infer<typeof RunSchema>;

/** Run list response schema */
export const RunListSchema = paginatedList(RunSchema);
export type RunList = z.infer<typeof RunListSchema>;

/** Run KPIs schema */
export const RunKPIsSchema = z.object({
  total_runs: z.number(),
  successful_runs: z.number(),
  failed_runs: z.number(),
  pending_runs: z.number(),
  average_duration_seconds: z.number(),
  success_rate: z.number(),
});
export type RunKPIs = z.infer<typeof RunKPIsSchema>;

// =============================================================================
// Artifact Schemas
// =============================================================================

/** Artifact status enum */
export const ArtifactStatusSchema = z.enum(['current', 'outdated', 'draft', 'archived']);
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;

/** Artifact schema */
export const ArtifactSchema = z.object({
  id: z.string(),
  artifact_type: z.string(),
  name: z.string(),
  path: z.string(),
  updated_at: z.string(),
  status: ArtifactStatusSchema,
  version: z.string().optional(),
  size: z.number().optional(),
  hash: z.string().optional(),
  created_by: z.string().optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

/** Artifact list response schema */
export const ArtifactListSchema = paginatedList(ArtifactSchema);
export type ArtifactList = z.infer<typeof ArtifactListSchema>;

// =============================================================================
// Session Schemas
// =============================================================================

/** Session status enum */
export const SessionStatusSchema = z.enum(['active', 'paused', 'completed', 'failed']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/** Session schema */
export const SessionSchema = z.object({
  id: z.string(),
  tenant: z.string(),
  environment: z.string(),
  created_at: z.string(),
  status: SessionStatusSchema,
  repo_url: z.string().optional(),
  epic_id: z.string().optional(),
  branch: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

// =============================================================================
// Event Schemas
// =============================================================================

/** Event schema */
export const EventSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.string(),
  data: z.record(z.string(), z.any()),
  tenant: z.string().optional(),
  session_id: z.string().optional(),
});
export type Event = z.infer<typeof EventSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates a gate object against the schema
 * @throws ZodError if validation fails
 */
export function validateGate(data: unknown): Gate {
  return GateSchema.parse(data);
}

/**
 * Validates a gate list response against the schema
 * @throws ZodError if validation fails
 */
export function validateGateList(data: unknown): GateList {
  return GateListSchema.parse(data);
}

/**
 * Validates a run object against the schema
 * @throws ZodError if validation fails
 */
export function validateRun(data: unknown): Run {
  return RunSchema.parse(data);
}

/**
 * Validates a run list response against the schema
 * @throws ZodError if validation fails
 */
export function validateRunList(data: unknown): RunList {
  return RunListSchema.parse(data);
}

/**
 * Validates an artifact object against the schema
 * @throws ZodError if validation fails
 */
export function validateArtifact(data: unknown): Artifact {
  return ArtifactSchema.parse(data);
}

/**
 * Validates an artifact list response against the schema
 * @throws ZodError if validation fails
 */
export function validateArtifactList(data: unknown): ArtifactList {
  return ArtifactListSchema.parse(data);
}

/**
 * Validates a session object against the schema
 * @throws ZodError if validation fails
 */
export function validateSession(data: unknown): Session {
  return SessionSchema.parse(data);
}

/**
 * Validates an event object against the schema
 * @throws ZodError if validation fails
 */
export function validateEvent(data: unknown): Event {
  return EventSchema.parse(data);
}

/**
 * Safe validation that returns undefined instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown
): T | undefined {
  const result = schema.safeParse(data);
  return result.success ? result.data : undefined;
}

/**
 * Validates and logs errors without throwing
 */
export function validateWithLogging<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`Contract validation failed for ${context}:`, result.error.issues);
    return null;
  }
  return result.data;
}
