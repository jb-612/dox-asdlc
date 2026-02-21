export type AgentNodeType =
  | 'planner'
  | 'backend'
  | 'frontend'
  | 'reviewer'
  | 'orchestrator'
  | 'devops'
  | 'ideation'
  | 'architect'
  | 'surveyor'
  | 'prd'
  | 'acceptance'
  | 'coding'
  | 'utest'
  | 'debugger'
  | 'security'
  | 'validation'
  | 'deployment'
  | 'monitor'
  | 'release';

export interface PortSchema {
  name: string;
  type: 'input' | 'output';
  dataType: string;
  required: boolean;
  description?: string;
}

export interface AgentNodeConfig {
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  systemPrompt?: string;
  timeoutSeconds?: number;
  extraFlags?: string[];
}

export interface AgentNode {
  id: string;
  type: AgentNodeType;
  label: string;
  config: AgentNodeConfig;
  inputs: PortSchema[];
  outputs: PortSchema[];
  position: { x: number; y: number };
  description?: string;
}

export type TransitionConditionType = 'always' | 'on_success' | 'on_failure' | 'expression';

export interface TransitionCondition {
  type: TransitionConditionType;
  expression?: string;
}

export interface Transition {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition: TransitionCondition;
  label?: string;
}

export type GateType = 'approval' | 'review' | 'decision' | 'confirmation';

export interface GateOption {
  label: string;
  value: string;
  description?: string;
  isDefault?: boolean;
}

export interface HITLGateDefinition {
  id: string;
  nodeId: string;
  gateType: GateType;
  prompt: string;
  options: GateOption[];
  timeoutSeconds?: number;
  required: boolean;
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue?: unknown;
  description?: string;
  required: boolean;
}

export interface WorkflowMetadata {
  name: string;
  description?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags: string[];
}

export interface WorkflowDefinition {
  id: string;
  metadata: WorkflowMetadata;
  nodes: AgentNode[];
  transitions: Transition[];
  gates: HITLGateDefinition[];
  variables: WorkflowVariable[];
}
