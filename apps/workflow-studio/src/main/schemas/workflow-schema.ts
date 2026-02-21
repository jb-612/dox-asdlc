import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas that mirror the TypeScript interfaces in shared/types/workflow.ts
// ---------------------------------------------------------------------------

export const AGENT_NODE_TYPES = [
  'planner',
  'backend',
  'frontend',
  'reviewer',
  'orchestrator',
  'devops',
  'ideation',
  'architect',
  'surveyor',
  'prd',
  'acceptance',
  'coding',
  'utest',
  'debugger',
  'security',
  'validation',
  'deployment',
  'monitor',
  'release',
] as const;

export const AgentNodeTypeSchema = z.enum(AGENT_NODE_TYPES);

export const AgentNodeConfigSchema = z.object({
  model: z.string().optional(),
  maxTurns: z.number().positive().optional(),
  maxBudgetUsd: z.number().positive().optional(),
  allowedTools: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  timeoutSeconds: z.number().positive().optional(),
  extraFlags: z.array(z.string()).optional(),
});

export const PortSchemaSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['input', 'output']),
  dataType: z.string().min(1),
  required: z.boolean(),
  description: z.string().optional(),
});

export const AgentNodeSchema = z.object({
  id: z.string().uuid(),
  type: AgentNodeTypeSchema,
  label: z.string().min(1),
  config: AgentNodeConfigSchema,
  inputs: z.array(PortSchemaSchema),
  outputs: z.array(PortSchemaSchema),
  position: z.object({ x: z.number(), y: z.number() }),
  description: z.string().optional(),
});

export const TRANSITION_CONDITION_TYPES = [
  'always',
  'on_success',
  'on_failure',
  'expression',
] as const;

export const TransitionConditionSchema = z.object({
  type: z.enum(TRANSITION_CONDITION_TYPES),
  expression: z.string().optional(),
});

export const TransitionSchema = z.object({
  id: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  condition: TransitionConditionSchema,
  label: z.string().optional(),
});

export const GATE_TYPES = [
  'approval',
  'review',
  'decision',
  'confirmation',
] as const;

export const GateOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const HITLGateDefinitionSchema = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  gateType: z.enum(GATE_TYPES),
  prompt: z.string().min(1),
  options: z.array(GateOptionSchema),
  timeoutSeconds: z.number().positive().optional(),
  required: z.boolean(),
});

export const VARIABLE_TYPES = [
  'string',
  'number',
  'boolean',
  'json',
] as const;

export const WorkflowVariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(VARIABLE_TYPES),
  defaultValue: z.unknown().optional(),
  description: z.string().optional(),
  required: z.boolean(),
});

export const WorkflowMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  tags: z.array(z.string()),
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string().uuid(),
  metadata: WorkflowMetadataSchema,
  nodes: z.array(AgentNodeSchema),
  transitions: z.array(TransitionSchema),
  gates: z.array(HITLGateDefinitionSchema),
  variables: z.array(WorkflowVariableSchema),
});

// ---------------------------------------------------------------------------
// Type inference helpers (useful in IPC handlers)
// ---------------------------------------------------------------------------

export type ValidatedWorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type ValidatedAgentNode = z.infer<typeof AgentNodeSchema>;
export type ValidatedTransition = z.infer<typeof TransitionSchema>;
