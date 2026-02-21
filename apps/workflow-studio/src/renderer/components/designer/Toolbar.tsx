import React, { useCallback, useMemo, useState } from 'react';
import {
  DocumentPlusIcon,
  FolderOpenIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  CheckCircleIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { useWorkflowStore } from '../../stores/workflowStore';
import { validateWorkflow } from '../../utils/validation';

/** Props accepted from the parent designer layout for zoom integration. */
export interface ToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
}

/**
 * Horizontal toolbar at the top of the designer area.
 *
 * Features:
 *  - Inline-editable workflow name
 *  - New / Save / Load buttons
 *  - Undo / Redo buttons (disabled when stacks are empty)
 *  - Validate button (shows error count badge)
 *  - Zoom controls (zoom in, zoom out, fit view)
 */
export function Toolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onSave,
  onLoad,
}: ToolbarProps): JSX.Element {
  const workflow = useWorkflowStore((s) => s.workflow);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const undoStack = useWorkflowStore((s) => s.undoStack);
  const redoStack = useWorkflowStore((s) => s.redoStack);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const updateMetadata = useWorkflowStore((s) => s.updateMetadata);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);

  const [isEditingName, setIsEditingName] = useState(false);
  const [validationCount, setValidationCount] = useState<number | null>(null);

  // -----------------------------------------------------------------------
  // Inline name editing
  // -----------------------------------------------------------------------

  const handleNameDoubleClick = useCallback(() => {
    if (workflow) setIsEditingName(true);
  }, [workflow]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateMetadata({ name: e.target.value });
    },
    [updateMetadata],
  );

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setIsEditingName(false);
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  const handleValidate = useCallback(() => {
    if (!workflow) return;
    const result = validateWorkflow(workflow);
    setValidationCount(result.errors.length + result.warnings.length);
  }, [workflow]);

  // -----------------------------------------------------------------------
  // Button state
  // -----------------------------------------------------------------------

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const workflowName = useMemo(
    () => workflow?.metadata.name ?? 'No Workflow',
    [workflow?.metadata.name],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="h-10 bg-gray-800 border-b border-gray-700 flex items-center px-3 gap-1 shrink-0">
      {/* Workflow name (inline editable) */}
      <div className="flex items-center min-w-0 mr-2">
        {isEditingName && workflow ? (
          <input
            type="text"
            value={workflowName}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
            className="bg-gray-700 border border-blue-500 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none w-48"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={handleNameDoubleClick}
            className="text-sm font-medium text-gray-200 truncate max-w-[200px] hover:text-white cursor-text"
            title="Double-click to rename"
          >
            {workflowName}
            {isDirty && (
              <span className="text-gray-500 ml-1" title="Unsaved changes">
                *
              </span>
            )}
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* New */}
      <ToolbarButton
        icon={<DocumentPlusIcon className="w-4 h-4" />}
        label="New"
        onClick={() => newWorkflow()}
      />

      {/* Save */}
      <ToolbarButton
        icon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 7.5l4.5-4.5m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        }
        label="Save"
        onClick={onSave}
        disabled={!workflow}
      />

      {/* Load */}
      <ToolbarButton
        icon={<FolderOpenIcon className="w-4 h-4" />}
        label="Load"
        onClick={onLoad}
      />

      {/* Separator */}
      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Undo */}
      <ToolbarButton
        icon={<ArrowUturnLeftIcon className="w-4 h-4" />}
        label="Undo"
        onClick={undo}
        disabled={!canUndo}
      />

      {/* Redo */}
      <ToolbarButton
        icon={<ArrowUturnRightIcon className="w-4 h-4" />}
        label="Redo"
        onClick={redo}
        disabled={!canRedo}
      />

      {/* Separator */}
      <div className="w-px h-5 bg-gray-600 mx-1" />

      {/* Validate */}
      <div className="relative">
        <ToolbarButton
          icon={<CheckCircleIcon className="w-4 h-4" />}
          label="Validate"
          onClick={handleValidate}
          disabled={!workflow}
        />
        {validationCount !== null && validationCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {validationCount > 9 ? '9+' : validationCount}
          </span>
        )}
        {validationCount === 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            0
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <ToolbarButton
        icon={<MagnifyingGlassMinusIcon className="w-4 h-4" />}
        label="Zoom Out"
        onClick={onZoomOut}
      />
      <ToolbarButton
        icon={<MagnifyingGlassPlusIcon className="w-4 h-4" />}
        label="Zoom In"
        onClick={onZoomIn}
      />
      <ToolbarButton
        icon={<ArrowsPointingOutIcon className="w-4 h-4" />}
        label="Fit View"
        onClick={onFitView}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal reusable toolbar button
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
}: ToolbarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`
        inline-flex items-center justify-center w-7 h-7 rounded
        transition-colors
        ${
          disabled
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
        }
      `}
    >
      {icon}
    </button>
  );
}
