import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExecutionStatus } from '../../shared/types/execution';
import { useExecutionStore } from '../stores/executionStore';
import ExecutionCanvas from '../components/execution/ExecutionCanvas';
import ExecutionDetailsPanel from '../components/execution/ExecutionDetailsPanel';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ExecutionStatus, { color: string; label: string; bg: string }> = {
  pending: { color: 'text-gray-400', label: 'Pending', bg: 'bg-gray-600' },
  running: { color: 'text-blue-400', label: 'Running', bg: 'bg-blue-600' },
  paused: { color: 'text-yellow-400', label: 'Paused', bg: 'bg-yellow-600' },
  waiting_gate: { color: 'text-orange-400', label: 'Waiting for Gate', bg: 'bg-orange-600' },
  completed: { color: 'text-green-400', label: 'Completed', bg: 'bg-green-600' },
  failed: { color: 'text-red-400', label: 'Failed', bg: 'bg-red-600' },
  aborted: { color: 'text-gray-400', label: 'Aborted', bg: 'bg-gray-600' },
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

/**
 * ExecutionWalkthroughPage -- full-screen layout for active execution monitoring.
 *
 * Layout:
 *  - Left: ExecutionCanvas (70% width) -- read-only React Flow view
 *  - Right: ExecutionDetailsPanel with tabs (Current Node, Event Log, Variables, Gate Decision)
 *  - Top: Header with execution status, controls, and back button
 *
 * Reads from executionStore backed by IPC events from the main process.
 */
export default function ExecutionWalkthroughPage(): JSX.Element {
  const navigate = useNavigate();

  // --- Store subscriptions ---
  const subscribe = useExecutionStore((s) => s.subscribe);
  const unsubscribe = useExecutionStore((s) => s.unsubscribe);

  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // --- Execution state from store ---
  const execution = useExecutionStore((s) => s.execution);
  const isRunning = useExecutionStore((s) => s.isRunning);
  const isPaused = useExecutionStore((s) => s.isPaused);
  const lastError = useExecutionStore((s) => s.lastError);

  // --- Store actions ---
  const pauseExecution = useExecutionStore((s) => s.pauseExecution);
  const resumeExecution = useExecutionStore((s) => s.resumeExecution);
  const abortExecution = useExecutionStore((s) => s.abortExecution);
  const submitGateDecision = useExecutionStore((s) => s.submitGateDecision);

  // --- Local UI state ---
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // --- Derived ---
  const statusStyle = execution
    ? STATUS_STYLES[execution.status]
    : STATUS_STYLES.pending;

  const elapsedSeconds = useMemo(() => {
    if (!execution?.startedAt) return 0;
    const start = new Date(execution.startedAt).getTime();
    const end = execution.completedAt
      ? new Date(execution.completedAt).getTime()
      : Date.now();
    return Math.floor((end - start) / 1000);
  }, [execution?.startedAt, execution?.completedAt]);

  // --- Handlers ---
  const handleBack = useCallback(() => {
    navigate('/execute');
  }, [navigate]);

  const handlePause = useCallback(() => {
    void pauseExecution();
  }, [pauseExecution]);

  const handleResume = useCallback(() => {
    void resumeExecution();
  }, [resumeExecution]);

  const handleAbort = useCallback(() => {
    void abortExecution();
  }, [abortExecution]);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleGateDecision = useCallback(
    (gateId: string, selectedOption: string, reason?: string) => {
      if (!execution?.currentNodeId) return;
      void submitGateDecision(execution.currentNodeId, gateId, selectedOption, reason);
    },
    [execution?.currentNodeId, submitGateDecision],
  );

  const formatElapsed = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, []);

  // --- No active execution ---
  if (!execution) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900">
        <svg
          className="w-16 h-16 text-gray-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <h2 className="text-lg font-semibold text-gray-300 mb-2">No Active Execution</h2>
        <p className="text-sm text-gray-500 mb-6">
          Start an execution from the launcher to monitor it here.
        </p>
        {lastError && (
          <p className="text-sm text-red-400 mb-4 max-w-md text-center">
            Error: {lastError}
          </p>
        )}
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Back to Launcher
        </button>
      </div>
    );
  }

  // --- Active execution ---
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3 shrink-0">
        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          title="Back to execution launcher"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        {/* Execution info */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-100 truncate">
            {execution.workflow.metadata.name}
          </h2>
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusStyle.bg} text-white`}>
            {statusStyle.label}
          </span>
          <span className="text-xs text-gray-500">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Error indicator */}
        {lastError && (
          <span className="text-xs text-red-400 truncate max-w-[200px]" title={lastError}>
            {lastError}
          </span>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={handlePause}
              className="px-3 py-1 text-xs font-medium rounded bg-yellow-600 hover:bg-yellow-500 text-white transition-colors"
            >
              Pause
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={handleResume}
              className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Resume
            </button>
          )}
          {(isRunning || isPaused) && (
            <button
              type="button"
              onClick={handleAbort}
              className="px-3 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Abort
            </button>
          )}
        </div>
      </div>

      {/* Main Content -- Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: ExecutionCanvas (70%) */}
        <div className="flex-[7] min-w-0">
          <ExecutionCanvas
            execution={execution}
            onNodeSelect={handleNodeSelect}
          />
        </div>

        {/* Right: Details Panel (30%) */}
        <div className="w-[340px] min-w-[280px] overflow-hidden">
          <ExecutionDetailsPanel
            execution={execution}
            selectedNodeId={selectedNodeId}
            onGateDecision={handleGateDecision}
          />
        </div>
      </div>
    </div>
  );
}
