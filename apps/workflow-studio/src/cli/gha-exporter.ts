import type { WorkflowDefinition } from '../shared/types/workflow';

export interface GHAExportOptions {
  triggers?: string[];
  runner?: string;
}

// HIGH-1 fix: quote YAML strings that contain special characters
function yamlQuote(s: string): string {
  if (/[:\n\r#\[\]{}&*!|>'"%@`]/.test(s) || s.trim() !== s) {
    return JSON.stringify(s);
  }
  return s;
}

export function exportToGHA(workflow: WorkflowDefinition, options?: GHAExportOptions): string {
  const triggers = options?.triggers ?? ['workflow_dispatch'];
  const runner = options?.runner ?? 'ubuntu-latest';

  const lines: string[] = [];
  lines.push(`name: ${yamlQuote(workflow.metadata.name)}`);
  lines.push('');
  lines.push('on:');
  for (const trigger of triggers) {
    lines.push(`  ${yamlQuote(trigger)}:`);
  }
  lines.push('');
  lines.push('jobs:');
  lines.push('  workflow:');
  lines.push(`    runs-on: ${yamlQuote(runner)}`);
  lines.push('    steps:');

  for (const node of workflow.nodes) {
    if (node.type === 'gate') {
      lines.push(`      # MANUAL: Gate "${node.label}" requires manual approval`);
      lines.push(`      - name: ${yamlQuote(node.label)}`);
      lines.push('        run: echo "MANUAL gate - configure GitHub Environment protection rules"');
    } else {
      lines.push(`      - name: ${yamlQuote(node.label)}`);
      // WARN-7 fix: correct GHA template expression syntax
      lines.push('        run: dox run --workflow ${{ github.workspace }}/' + workflow.id + '.json --json');
    }
  }

  return lines.join('\n') + '\n';
}
