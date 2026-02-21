import type { WorkflowDefinition } from '../../shared/types/workflow';
import {
  detectCycles,
  findStartNodes,
  findEndNodes,
  findDisconnectedNodes,
} from './graph-utils';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  rule: string;
  severity: ValidationSeverity;
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

/**
 * Run all validation rules against a workflow definition.
 *
 * Rules checked (9 total):
 *   1. min-nodes       -- Workflow must contain at least one agent node.
 *   2. start-node      -- At least one node with no incoming edges.
 *   3. end-node        -- At least one node with no outgoing edges.
 *   4. no-cycles       -- Directed graph must be acyclic.
 *   5. no-disconnected -- Warn if isolated nodes exist (multi-node workflows).
 *   6. valid-edge-source -- Every transition source references an existing node.
 *   7. valid-edge-target -- Every transition target references an existing node.
 *   8. unique-node-ids -- No duplicate node IDs.
 *   9. valid-gate-node -- Every gate references an existing node.
 *  10. workflow-name   -- Workflow should have a non-empty name (warning).
 *
 * Returns a ValidationResult with separated errors and warnings.
 */
export function validateWorkflow(workflow: WorkflowDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Rule 1: Must have at least one node
  if (workflow.nodes.length === 0) {
    issues.push({
      rule: 'min-nodes',
      severity: 'error',
      message: 'Workflow must contain at least one agent node.',
    });
  }

  // Rule 2: Must have at least one start node (no incoming edges)
  const startNodes = findStartNodes(workflow.nodes, workflow.transitions);
  if (startNodes.length === 0 && workflow.nodes.length > 0) {
    issues.push({
      rule: 'start-node',
      severity: 'error',
      message: 'Workflow must have at least one start node (no incoming edges).',
    });
  }

  // Rule 3: Must have at least one end node (no outgoing edges)
  const endNodes = findEndNodes(workflow.nodes, workflow.transitions);
  if (endNodes.length === 0 && workflow.nodes.length > 0) {
    issues.push({
      rule: 'end-node',
      severity: 'error',
      message: 'Workflow must have at least one end node (no outgoing edges).',
    });
  }

  // Rule 4: No cycles allowed
  const cycleNodes = detectCycles(workflow.nodes, workflow.transitions);
  if (cycleNodes.length > 0) {
    issues.push({
      rule: 'no-cycles',
      severity: 'error',
      message: `Workflow contains a cycle involving nodes: ${cycleNodes.join(', ')}.`,
      nodeIds: cycleNodes,
    });
  }

  // Rule 5: No disconnected nodes (warning, only for multi-node workflows)
  const disconnected = findDisconnectedNodes(workflow.nodes, workflow.transitions);
  if (disconnected.length > 0 && workflow.nodes.length > 1) {
    issues.push({
      rule: 'no-disconnected',
      severity: 'warning',
      message: `Disconnected nodes found: ${disconnected.map((n) => n.label).join(', ')}.`,
      nodeIds: disconnected.map((n) => n.id),
    });
  }

  // Rule 6 & 7: All transitions reference valid nodes
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));
  for (const t of workflow.transitions) {
    if (!nodeIds.has(t.sourceNodeId)) {
      issues.push({
        rule: 'valid-edge-source',
        severity: 'error',
        message: `Transition "${t.id}" references non-existent source node "${t.sourceNodeId}".`,
        edgeIds: [t.id],
      });
    }
    if (!nodeIds.has(t.targetNodeId)) {
      issues.push({
        rule: 'valid-edge-target',
        severity: 'error',
        message: `Transition "${t.id}" references non-existent target node "${t.targetNodeId}".`,
        edgeIds: [t.id],
      });
    }
  }

  // Rule 8: No duplicate node IDs
  const seenIds = new Set<string>();
  for (const node of workflow.nodes) {
    if (seenIds.has(node.id)) {
      issues.push({
        rule: 'unique-node-ids',
        severity: 'error',
        message: `Duplicate node ID: "${node.id}".`,
        nodeIds: [node.id],
      });
    }
    seenIds.add(node.id);
  }

  // Rule 9: All gates reference valid nodes
  for (const gate of workflow.gates) {
    if (!nodeIds.has(gate.nodeId)) {
      issues.push({
        rule: 'valid-gate-node',
        severity: 'error',
        message: `Gate "${gate.id}" references non-existent node "${gate.nodeId}".`,
        nodeIds: [gate.nodeId],
      });
    }
  }

  // Rule 10: Workflow must have a name
  if (!workflow.metadata.name || workflow.metadata.name.trim() === '') {
    issues.push({
      rule: 'workflow-name',
      severity: 'warning',
      message: 'Workflow should have a name.',
    });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
