import { useState, useEffect, useCallback } from 'react';
import type { GateOption } from '../../../shared/types/workflow';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GateDecisionFormProps {
  gateId: string;
  prompt: string;
  context?: string;
  options: GateOption[];
  timeoutSeconds?: number;
  onSubmit: (gateId: string, selectedOption: string, reason?: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Prominent card shown when execution pauses at a HITL gate.
 *
 * Displays the gate prompt, context info, option buttons, an optional
 * feedback textarea, and an optional countdown timer.
 */
export default function GateDecisionForm({
  gateId,
  prompt,
  context,
  options,
  timeoutSeconds,
  onSubmit,
}: GateDecisionFormProps): JSX.Element {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeoutSeconds ?? null,
  );

  // ---- Countdown timer -------------------------------------------------------

  useEffect(() => {
    if (timeoutSeconds == null || timeoutSeconds <= 0) return;

    setRemainingSeconds(timeoutSeconds);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeoutSeconds]);

  // ---- Handlers --------------------------------------------------------------

  const handleSubmit = useCallback(() => {
    if (!selectedOption) return;
    onSubmit(gateId, selectedOption, feedback.trim() || undefined);
  }, [gateId, selectedOption, feedback, onSubmit]);

  // ---- Determine which option is approve vs reject for color coding ----------

  function buttonStyleForOption(opt: GateOption): string {
    const isApprove =
      opt.value === 'approve' ||
      opt.value === 'yes' ||
      opt.value === 'accept' ||
      opt.isDefault === true;
    const isReject =
      opt.value === 'reject' ||
      opt.value === 'no' ||
      opt.value === 'deny';

    const isSelected = selectedOption === opt.value;

    if (isSelected) {
      if (isApprove) return 'bg-green-600 text-white border-green-500 ring-2 ring-green-500/40';
      if (isReject) return 'bg-red-600 text-white border-red-500 ring-2 ring-red-500/40';
      return 'bg-blue-600 text-white border-blue-500 ring-2 ring-blue-500/40';
    }

    if (isApprove)
      return 'bg-green-600/20 text-green-400 border-green-500/40 hover:bg-green-600/30';
    if (isReject)
      return 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30';
    return 'bg-gray-700/50 text-gray-300 border-gray-600 hover:bg-gray-700';
  }

  // ---- Format remaining time -------------------------------------------------

  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="rounded-lg border-2 border-amber-500/60 bg-gray-800 p-4 shadow-xl shadow-amber-500/5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <h3 className="text-sm font-semibold text-amber-300">
          Gate Decision Required
        </h3>

        {/* Countdown */}
        {remainingSeconds != null && remainingSeconds > 0 && (
          <span
            className={`
              ml-auto text-xs font-mono tabular-nums px-2 py-0.5 rounded
              ${remainingSeconds < 30
                ? 'bg-red-600/20 text-red-400'
                : 'bg-gray-700 text-gray-400'
              }
            `}
          >
            {formatCountdown(remainingSeconds)}
          </span>
        )}
        {remainingSeconds === 0 && (
          <span className="ml-auto text-xs text-red-400 font-medium">
            Timed out
          </span>
        )}
      </div>

      {/* Prompt text */}
      <p className="text-sm text-gray-200 leading-relaxed mb-2">
        {prompt}
      </p>

      {/* Context info */}
      {context && (
        <div className="text-xs text-gray-400 bg-gray-900/50 rounded p-2 mb-3 border border-gray-700">
          {context}
        </div>
      )}

      {/* Option buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelectedOption(opt.value)}
            className={`
              px-3 py-1.5 rounded-md text-xs font-medium border transition-all
              ${buttonStyleForOption(opt)}
            `}
            title={opt.description}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Feedback textarea */}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback or notes..."
        rows={2}
        className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-xs text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 mb-3"
      />

      {/* Submit */}
      <button
        type="button"
        disabled={!selectedOption}
        onClick={handleSubmit}
        className={`
          w-full py-2 rounded-md text-sm font-semibold transition-colors
          ${selectedOption
            ? 'bg-amber-600 text-white hover:bg-amber-500'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        Submit Decision
      </button>
    </div>
  );
}
