import type { WorkflowDefinition, AgentNode } from '../../shared/types/workflow';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateWorkflow(workflow: WorkflowDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const node of workflow.nodes) {
    if (node.kind === 'control') {
      validateControlFlowNode(node, workflow, errors, warnings);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateControlFlowNode(
  node: AgentNode,
  workflow: WorkflowDefinition,
  errors: string[],
  warnings: string[],
): void {
  switch (node.config.blockType) {
    case 'condition':
      validateConditionNode(node, workflow, warnings);
      break;
    case 'forEach':
      validateForEachNode(node, warnings);
      break;
    case 'subWorkflow':
      validateSubWorkflowNode(node, errors);
      break;
  }
}

function validateConditionNode(
  node: AgentNode,
  workflow: WorkflowDefinition,
  warnings: string[],
): void {
  const outgoing = workflow.transitions.filter((t) => t.sourceNodeId === node.id);
  if (outgoing.length < 2) {
    warnings.push(`Condition node ${node.id} has fewer than 2 outgoing edges`);
  }
}

function validateForEachNode(node: AgentNode, warnings: string[]): void {
  const cfg = node.config.forEachConfig;
  if (!cfg || cfg.bodyNodeIds.length === 0) {
    warnings.push(`ForEach node ${node.id} has empty bodyNodeIds`);
  }
}

function validateSubWorkflowNode(node: AgentNode, errors: string[]): void {
  const cfg = node.config.subWorkflowConfig;
  if (!cfg || !cfg.workflowId) {
    errors.push(`SubWorkflow node ${node.id} is missing workflowId`);
  }
}
