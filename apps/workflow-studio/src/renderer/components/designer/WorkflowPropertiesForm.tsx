import React, { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';

/**
 * Form for editing top-level workflow metadata (name, description, version,
 * tags).  Shown in the PropertiesPanel when nothing is selected.
 */
export function WorkflowPropertiesForm(): JSX.Element | null {
  const workflow = useWorkflowStore((s) => s.workflow);
  const updateMetadata = useWorkflowStore((s) => s.updateMetadata);

  const tags = useMemo(
    () => workflow?.metadata.tags ?? [],
    [workflow?.metadata.tags],
  );

  const tagsDisplay = useMemo(() => tags.join(', '), [tags]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateMetadata({ name: e.target.value });
    },
    [updateMetadata],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateMetadata({ description: e.target.value });
    },
    [updateMetadata],
  );

  const handleVersionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateMetadata({ version: e.target.value });
    },
    [updateMetadata],
  );

  const handleTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTags = e.target.value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      updateMetadata({ tags: newTags });
    },
    [updateMetadata],
  );

  if (!workflow) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
        Workflow Properties
      </h3>

      {/* Name */}
      <div>
        <label
          htmlFor="wf-name"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Name
        </label>
        <input
          id="wf-name"
          type="text"
          value={workflow.metadata.name}
          onChange={handleNameChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="wf-description"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Description
        </label>
        <textarea
          id="wf-description"
          rows={3}
          value={workflow.metadata.description ?? ''}
          onChange={handleDescriptionChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>

      {/* Version */}
      <div>
        <label
          htmlFor="wf-version"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Version
        </label>
        <input
          id="wf-version"
          type="text"
          value={workflow.metadata.version}
          onChange={handleVersionChange}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Tags */}
      <div>
        <label
          htmlFor="wf-tags"
          className="block text-xs font-medium text-gray-400 mb-1"
        >
          Tags (comma-separated)
        </label>
        <input
          id="wf-tags"
          type="text"
          value={tagsDisplay}
          onChange={handleTagsChange}
          placeholder="e.g. ci, backend, review"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-block bg-blue-600/30 text-blue-300 text-xs px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Read-only info */}
      <div className="pt-2 border-t border-gray-700 space-y-1">
        <p className="text-xs text-gray-500">
          ID: <span className="font-mono text-gray-400">{workflow.id}</span>
        </p>
        <p className="text-xs text-gray-500">
          Created:{' '}
          <span className="text-gray-400">
            {new Date(workflow.metadata.createdAt).toLocaleString()}
          </span>
        </p>
        <p className="text-xs text-gray-500">
          Updated:{' '}
          <span className="text-gray-400">
            {new Date(workflow.metadata.updatedAt).toLocaleString()}
          </span>
        </p>
      </div>
    </div>
  );
}
