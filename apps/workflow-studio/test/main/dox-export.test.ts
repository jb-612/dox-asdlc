// @vitest-environment node
// ---------------------------------------------------------------------------
// F17-T13: dox export CLI command
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'path';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import type { WorkflowDefinition } from '../../src/shared/types/workflow';

const sampleWorkflow: WorkflowDefinition = {
  id: 'wf-export',
  metadata: { name: 'Export Test', version: '1', createdAt: '', updatedAt: '', tags: [] },
  nodes: [
    { id: 'n1', type: 'backend' as const, label: 'Build', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
  ],
  transitions: [],
  gates: [],
  variables: [],
};

describe('F17-T13: dox export', { timeout: 30000 }, () => {
  let tmpDir: string;
  let wfPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'dox-export-'));
    wfPath = join(tmpDir, 'wf-export.json');
    writeFileSync(wfPath, JSON.stringify(sampleWorkflow));
  });

  it('--format json writes JSON', async () => {
    const { runExport } = await import('../../src/cli/export');
    const outPath = join(tmpDir, 'out.json');
    const exitCode = await runExport({
      workflowPath: wfPath,
      format: 'json',
      outPath,
    });

    expect(exitCode).toBe(0);
    const content = readFileSync(outPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.id).toBe('wf-export');
  });

  it('--format gha writes YAML', async () => {
    const { runExport } = await import('../../src/cli/export');
    const outPath = join(tmpDir, 'out.yml');
    const exitCode = await runExport({
      workflowPath: wfPath,
      format: 'gha',
      outPath,
    });

    expect(exitCode).toBe(0);
    const content = readFileSync(outPath, 'utf-8');
    expect(content).toContain('name:');
    expect(content).toContain('jobs:');
  });

  it('exits 3 on unknown workflow', async () => {
    const { runExport } = await import('../../src/cli/export');
    const exitCode = await runExport({
      workflowPath: '/nonexistent/wf.json',
      format: 'json',
      outPath: join(tmpDir, 'out.json'),
    });

    expect(exitCode).toBe(3);
  });

  it('writes to stdout when no --out', async () => {
    const { runExport } = await import('../../src/cli/export');
    const exitCode = await runExport({
      workflowPath: wfPath,
      format: 'json',
    });

    // When no outPath, writes to stdout and returns 0
    expect(exitCode).toBe(0);
  });
});
