/**
 * GuidelinePreview - Evaluate context against guidelines (P11-F01 T27)
 *
 * Allows users to test which guidelines would match a given context.
 * Provides input fields for agent, domain, action, event, and gate_type,
 * calls the evaluate mutation, and displays matching results.
 */

import { useState } from 'react';
import { useEvaluateContext } from '@/api/guardrails';
import type { EvaluatedContextResponse } from '@/api/types/guardrails';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GuidelinePreviewProps {
  // No required props - self-contained evaluation panel
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuidelinePreview(_props: GuidelinePreviewProps) {
  const [agent, setAgent] = useState('');
  const [domain, setDomain] = useState('');
  const [action, setAction] = useState('');
  const [event, setEvent] = useState('');
  const [gateType, setGateType] = useState('');

  const { mutateAsync, isPending, data } = useEvaluateContext();

  const result = data as EvaluatedContextResponse | undefined;

  async function handleEvaluate() {
    await mutateAsync({
      agent: agent || null,
      domain: domain || null,
      action: action || null,
      event: event || null,
      gate_type: gateType || null,
    });
  }

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      data-testid="guideline-preview"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Evaluate Context
        </h2>
      </div>

      {/* Context Input Fields */}
      <div className="p-4 space-y-3">
        <InputField
          label="Agent"
          testId="preview-agent"
          value={agent}
          onChange={setAgent}
          placeholder="e.g. planner, backend, frontend"
        />
        <InputField
          label="Domain"
          testId="preview-domain"
          value={domain}
          onChange={setDomain}
          placeholder="e.g. planning, ui, infrastructure"
        />
        <InputField
          label="Action"
          testId="preview-action"
          value={action}
          onChange={setAction}
          placeholder="e.g. create, implement, deploy"
        />
        <InputField
          label="Event"
          testId="preview-event"
          value={event}
          onChange={setEvent}
          placeholder="e.g. pre_tool_use, post_commit"
        />
        <InputField
          label="Gate Type"
          testId="preview-gate-type"
          value={gateType}
          onChange={setGateType}
          placeholder="e.g. destructive_operation"
        />

        <button
          data-testid="preview-evaluate-btn"
          disabled={isPending}
          onClick={handleEvaluate}
          className="w-full mt-2 px-4 py-2 rounded-md text-sm font-medium text-white
            bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors"
        >
          {isPending ? 'Evaluating...' : 'Evaluate'}
        </button>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div
          data-testid="preview-loading"
          className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
        >
          Evaluating guidelines...
        </div>
      )}

      {/* Results */}
      {result && (
        <div data-testid="preview-results">
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            {result.matched_count === 0 ? (
              <div
                data-testid="preview-no-matches"
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                No guidelines matched this context.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Match count */}
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Results:{' '}
                  <span
                    data-testid="preview-matched-count"
                    className="font-semibold"
                  >
                    {result.matched_count}
                  </span>{' '}
                  guideline{result.matched_count !== 1 ? 's' : ''} matched
                </div>

                {/* Combined Instruction */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Combined Instruction
                  </h3>
                  <div
                    data-testid="preview-combined-instruction"
                    className="p-2 rounded bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
                  >
                    {result.combined_instruction}
                  </div>
                </div>

                {/* Tools Allowed */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Tools Allowed
                  </h3>
                  <div
                    data-testid="preview-tools-allowed"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {result.tools_allowed.length > 0
                      ? result.tools_allowed.join(', ')
                      : '(none)'}
                  </div>
                </div>

                {/* Tools Denied */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Tools Denied
                  </h3>
                  <div
                    data-testid="preview-tools-denied"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {result.tools_denied.length > 0
                      ? result.tools_denied.join(', ')
                      : '(none)'}
                  </div>
                </div>

                {/* HITL Gates */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    HITL Gates
                  </h3>
                  <div
                    data-testid="preview-hitl-gates"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {result.hitl_gates.length > 0
                      ? result.hitl_gates.join(', ')
                      : '(none)'}
                  </div>
                </div>

                {/* Matched Guidelines */}
                <div>
                  <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">
                    Matched Guidelines
                  </h3>
                  <div className="space-y-2">
                    {result.guidelines.map((g, idx) => (
                      <div
                        key={g.guideline_id}
                        data-testid={`preview-guideline-${g.guideline_id}`}
                        className="p-2 rounded bg-gray-50 dark:bg-gray-800 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {idx + 1}. {g.guideline_name} (p:{g.priority})
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Score: {g.match_score}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          [{g.matched_fields.join(', ')}]
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal InputField helper
// ---------------------------------------------------------------------------

interface InputFieldProps {
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function InputField({
  label,
  testId,
  value,
  onChange,
  placeholder,
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <input
        data-testid={testId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

export default GuidelinePreview;
