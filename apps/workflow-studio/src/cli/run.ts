import { readFileSync, existsSync } from 'fs';
import { NullWindow } from './null-window';
import { ExecutionEngine } from '../main/services/execution-engine';
import type { HeadlessRunConfig } from './types';
import type { WorkflowDefinition } from '../shared/types/workflow';

export async function runHeadless(config: HeadlessRunConfig): Promise<number> {
  const { workflowPath, mock, json, gateMode, variables } = config;

  if (!existsSync(workflowPath)) {
    if (json) {
      process.stderr.write(JSON.stringify({ error: `Workflow not found: ${workflowPath}` }) + '\n');
    } else {
      process.stderr.write(`Error: Workflow not found: ${workflowPath}\n`);
    }
    return 3;
  }

  let workflow: WorkflowDefinition;
  try {
    const raw = readFileSync(workflowPath, 'utf-8');
    workflow = JSON.parse(raw) as WorkflowDefinition;
  } catch {
    return 3;
  }

  // Inject variables
  if (workflow.variables && Object.keys(variables).length > 0) {
    for (const v of workflow.variables) {
      if (variables[v.name] !== undefined) {
        v.defaultValue = variables[v.name];
      }
    }
  }

  const host = new NullWindow({ json, stdout: process.stdout, stderr: process.stderr });

  const gateHandler = gateMode === 'fail'
    ? () => '__gate_fail__'
    : () => 'approve';

  const engine = new ExecutionEngine(host, { mockMode: mock, gateHandler });

  try {
    const result = await engine.start(workflow);
    if (result.status === 'completed') return 0;
    if (result.status === 'failed') return gateMode === 'fail' ? 4 : 1;
    if (result.status === 'aborted') return 2;
    return 1;
  } catch {
    return 1;
  }
}
