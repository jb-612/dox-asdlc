import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exportToGHA } from './gha-exporter';
import type { WorkflowDefinition } from '../shared/types/workflow';

export interface ExportConfig {
  workflowPath: string;
  format: 'json' | 'gha';
  outPath?: string;
}

export async function runExport(config: ExportConfig): Promise<number> {
  if (!existsSync(config.workflowPath)) {
    process.stderr.write(`Error: Workflow not found: ${config.workflowPath}\n`);
    return 3;
  }

  let workflow: WorkflowDefinition;
  try {
    workflow = JSON.parse(readFileSync(config.workflowPath, 'utf-8'));
  } catch {
    return 3;
  }

  let output: string;
  if (config.format === 'gha') {
    output = exportToGHA(workflow);
  } else {
    output = JSON.stringify(workflow, null, 2) + '\n';
  }

  if (config.outPath) {
    writeFileSync(config.outPath, output, 'utf-8');
  } else {
    process.stdout.write(output);
  }

  return 0;
}
