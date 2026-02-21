import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkflowDefinition } from '../../shared/types/workflow';
import { NODE_TYPE_METADATA } from '../../shared/constants';
import { useWorkflowStore } from '../stores/workflowStore';
import TemplateCard from '../components/templates/TemplateCard';

// ---------------------------------------------------------------------------
// Mock templates -- will be replaced by IPC calls when persistence is ready
// ---------------------------------------------------------------------------

function createMockTemplates(): WorkflowDefinition[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'tpl-tdd-cycle',
      metadata: {
        name: 'TDD Cycle',
        description: 'Standard TDD workflow: write tests, implement, debug, review.',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['tdd', 'development'],
      },
      nodes: [
        { id: 'n1', type: 'utest', label: 'Unit Test', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'n2', type: 'coding', label: 'Coder', config: {}, inputs: [], outputs: [], position: { x: 200, y: 0 } },
        { id: 'n3', type: 'debugger', label: 'Debugger', config: {}, inputs: [], outputs: [], position: { x: 400, y: 0 } },
        { id: 'n4', type: 'reviewer', label: 'Reviewer', config: {}, inputs: [], outputs: [], position: { x: 600, y: 0 } },
      ],
      transitions: [
        { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', condition: { type: 'always' } },
        { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', condition: { type: 'on_failure' } },
        { id: 'e3', sourceNodeId: 'n2', targetNodeId: 'n4', condition: { type: 'on_success' } },
        { id: 'e4', sourceNodeId: 'n3', targetNodeId: 'n2', condition: { type: 'always' } },
      ],
      gates: [],
      variables: [],
    },
    {
      id: 'tpl-full-pipeline',
      metadata: {
        name: 'Full Pipeline',
        description: 'End-to-end pipeline: ideation, architecture, implementation, validation, and deployment.',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['full', 'pipeline', 'e2e'],
      },
      nodes: [
        { id: 'n1', type: 'ideation', label: 'Ideation', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'n2', type: 'architect', label: 'Architect', config: {}, inputs: [], outputs: [], position: { x: 200, y: 0 } },
        { id: 'n3', type: 'planner', label: 'Planner', config: {}, inputs: [], outputs: [], position: { x: 400, y: 0 } },
        { id: 'n4', type: 'coding', label: 'Coder', config: {}, inputs: [], outputs: [], position: { x: 600, y: 0 } },
        { id: 'n5', type: 'validation', label: 'Validation', config: {}, inputs: [], outputs: [], position: { x: 800, y: 0 } },
        { id: 'n6', type: 'deployment', label: 'Deployment', config: {}, inputs: [], outputs: [], position: { x: 1000, y: 0 } },
      ],
      transitions: [
        { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', condition: { type: 'always' } },
        { id: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', condition: { type: 'always' } },
        { id: 'e3', sourceNodeId: 'n3', targetNodeId: 'n4', condition: { type: 'always' } },
        { id: 'e4', sourceNodeId: 'n4', targetNodeId: 'n5', condition: { type: 'always' } },
        { id: 'e5', sourceNodeId: 'n5', targetNodeId: 'n6', condition: { type: 'on_success' } },
      ],
      gates: [
        {
          id: 'g1',
          nodeId: 'n5',
          gateType: 'approval',
          prompt: 'Approve validation results?',
          options: [
            { label: 'Approve', value: 'approve', isDefault: true },
            { label: 'Reject', value: 'reject' },
          ],
          required: true,
        },
      ],
      variables: [],
    },
    {
      id: 'tpl-code-review',
      metadata: {
        name: 'Code Review',
        description: 'Surveyor analyzes codebase, reviewer evaluates, security scans for vulnerabilities.',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        tags: ['review', 'security'],
      },
      nodes: [
        { id: 'n1', type: 'surveyor', label: 'Surveyor', config: {}, inputs: [], outputs: [], position: { x: 0, y: 0 } },
        { id: 'n2', type: 'reviewer', label: 'Reviewer', config: {}, inputs: [], outputs: [], position: { x: 200, y: 0 } },
        { id: 'n3', type: 'security', label: 'Security', config: {}, inputs: [], outputs: [], position: { x: 200, y: 150 } },
      ],
      transitions: [
        { id: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', condition: { type: 'always' } },
        { id: 'e2', sourceNodeId: 'n1', targetNodeId: 'n3', condition: { type: 'always' } },
      ],
      gates: [],
      variables: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Save Template Dialog
// ---------------------------------------------------------------------------

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

function SaveTemplateDialog({ isOpen, onClose, onSave }: SaveDialogProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
    setName('');
    setDescription('');
    onClose();
  }, [name, description, onSave, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-[420px] bg-gray-800 rounded-xl border border-gray-600 shadow-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          Save as Template
        </h2>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow Template"
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template does..."
              rows={3}
              className="w-full text-sm bg-gray-900 text-gray-200 placeholder-gray-500 border border-gray-600 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${
                name.trim()
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * TemplateManagerPage -- grid layout showing template cards.
 *
 * Features:
 *  - Template cards with name, description, node count, mini preview
 *  - "Use Template" loads into designer and navigates to /
 *  - "Save as Template" from current workflow (opens name dialog)
 *  - Empty state if no templates
 */
export default function TemplateManagerPage(): JSX.Element {
  const navigate = useNavigate();
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);

  const [templates, setTemplates] = useState<WorkflowDefinition[]>(createMockTemplates);
  const [isSaveOpen, setIsSaveOpen] = useState(false);

  const handleUseTemplate = useCallback(
    (template: WorkflowDefinition) => {
      // Deep clone so the template itself is not mutated
      const clone: WorkflowDefinition = JSON.parse(JSON.stringify(template));
      clone.id = `wf-${Date.now()}`;
      clone.metadata.createdAt = new Date().toISOString();
      clone.metadata.updatedAt = new Date().toISOString();
      setWorkflow(clone);
      navigate('/');
    },
    [setWorkflow, navigate],
  );

  const handleDeleteTemplate = useCallback(
    (workflowId: string) => {
      setTemplates((prev) => prev.filter((t) => t.id !== workflowId));
    },
    [],
  );

  const handleSaveAsTemplate = useCallback(
    (name: string, description: string) => {
      if (!workflow) return;
      const template: WorkflowDefinition = {
        ...JSON.parse(JSON.stringify(workflow)),
        id: `tpl-${Date.now()}`,
        metadata: {
          ...workflow.metadata,
          name,
          description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      setTemplates((prev) => [...prev, template]);
    },
    [workflow],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Templates</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Pre-built workflow templates to get started quickly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsSaveOpen(true)}
          disabled={!workflow}
          className={`
            px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${
              workflow
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
          title={workflow ? 'Save current workflow as template' : 'Open a workflow first'}
        >
          Save Current as Template
        </button>
      </div>

      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3 opacity-40">
              {/* document stack icon as text */}
              <svg className="w-12 h-12 text-gray-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-400 mb-1">No templates yet</h3>
            <p className="text-sm text-gray-500">
              Create a workflow in the designer, then save it as a template.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                workflow={template}
                onUse={handleUseTemplate}
                onDelete={handleDeleteTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Save Dialog */}
      <SaveTemplateDialog
        isOpen={isSaveOpen}
        onClose={() => setIsSaveOpen(false)}
        onSave={handleSaveAsTemplate}
      />
    </div>
  );
}
