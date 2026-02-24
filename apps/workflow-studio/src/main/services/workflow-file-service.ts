import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import { WorkflowDefinitionSchema } from '../schemas/workflow-schema';

// ---------------------------------------------------------------------------
// WorkflowFileService
//
// Persists workflow definitions as JSON files on disk. Each workflow is stored
// as a separate .json file in the configured workflow directory. The service
// ensures the directory exists before every operation and validates workflow
// data against the Zod schema on load and save.
// ---------------------------------------------------------------------------

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  version?: string;
  updatedAt: string;
  nodeCount: number;
  tags?: string[];
  status?: 'active' | 'paused';
}

export class WorkflowFileService {
  private workflowDir: string;

  constructor(workflowDir: string) {
    this.workflowDir = workflowDir;
  }

  /**
   * Ensure the workflow directory exists, creating it recursively if needed.
   */
  async ensureDir(): Promise<void> {
    await mkdir(this.workflowDir, { recursive: true });
  }

  /**
   * List summaries of all workflow files in the directory.
   */
  async list(): Promise<WorkflowSummary[]> {
    await this.ensureDir();
    const files = await readdir(this.workflowDir);
    const workflows: WorkflowSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(this.workflowDir, file), 'utf-8');
        const workflow = JSON.parse(content);
        workflows.push({
          id: workflow.id,
          name: workflow.metadata?.name || file,
          description: workflow.metadata?.description,
          version: workflow.metadata?.version,
          updatedAt: workflow.metadata?.updatedAt || '',
          nodeCount: workflow.nodes?.length || 0,
          tags: workflow.metadata?.tags,
          status: workflow.metadata?.status,
        });
      } catch {
        /* skip invalid or unreadable files */
      }
    }
    return workflows;
  }

  /**
   * Load a workflow by its ID. Scans all .json files for a matching ID.
   * Returns null if no matching workflow is found.
   */
  async load(id: string): Promise<WorkflowDefinition | null> {
    await this.ensureDir();
    const files = await readdir(this.workflowDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(this.workflowDir, file), 'utf-8');
        const workflow = JSON.parse(content);
        if (workflow.id === id) {
          return WorkflowDefinitionSchema.parse(workflow) as WorkflowDefinition;
        }
      } catch {
        /* skip files that fail to parse or validate */
      }
    }
    return null;
  }

  /**
   * Save a workflow definition to disk. Validates against the Zod schema
   * and writes to a file named after the workflow's name (sanitised).
   */
  async save(workflow: WorkflowDefinition): Promise<{ success: boolean; id: string }> {
    await this.ensureDir();
    const validated = WorkflowDefinitionSchema.parse(workflow) as WorkflowDefinition;
    const filename = `${validated.metadata.name.replace(/[^a-zA-Z0-9-_]/g, '-')}.json`;
    await writeFile(
      join(this.workflowDir, filename),
      JSON.stringify(validated, null, 2),
      'utf-8',
    );
    return { success: true, id: validated.id };
  }

  /**
   * Delete a workflow by its ID. Returns true if the file was found and
   * removed, false if no matching workflow exists.
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureDir();
    const files = await readdir(this.workflowDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(this.workflowDir, file), 'utf-8');
        const workflow = JSON.parse(content);
        if (workflow.id === id) {
          await unlink(join(this.workflowDir, file));
          return true;
        }
      } catch {
        /* skip files that fail to parse */
      }
    }
    return false;
  }
}
