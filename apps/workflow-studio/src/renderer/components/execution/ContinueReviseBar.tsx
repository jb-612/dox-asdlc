import { useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ContinueReviseBarProps {
  onContinue: () => void;
  onRevise: (feedback: string) => void;
  revisionCount: number;
  /** Whether the bar is in an active gate state (controls keyboard shortcuts) */
  gateActive?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Action bar for step gate decisions. Provides Continue and Revise buttons.
 * Revise shows a textarea for feedback that must be at least 10 characters.
 *
 * Keyboard shortcuts (only when gateActive is true):
 *   - Ctrl+Enter / Cmd+Enter: Continue
 *   - Ctrl+Shift+R / Cmd+Shift+R: Toggle Revise textarea
 */
export default function ContinueReviseBar({
  onContinue,
  onRevise,
  revisionCount,
  gateActive = false,
}: ContinueReviseBarProps): JSX.Element {
  const [showReviseInput, setShowReviseInput] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSubmitRevise = useCallback(() => {
    if (feedback.trim().length >= 10) {
      onRevise(feedback);
      setFeedback('');
      setShowReviseInput(false);
    }
  }, [feedback, onRevise]);

  const handleCancelRevise = useCallback(() => {
    setFeedback('');
    setShowReviseInput(false);
  }, []);

  // Keyboard shortcuts (T16)
  useEffect(() => {
    if (!gateActive) return;

    function handleKeyDown(e: KeyboardEvent): void {
      const isModifier = e.ctrlKey || e.metaKey;

      // Ctrl+Enter or Cmd+Enter -> Continue
      if (isModifier && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onContinue();
        return;
      }

      // Ctrl+Shift+R or Cmd+Shift+R -> Toggle Revise
      if (isModifier && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        setShowReviseInput((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [gateActive, onContinue]);

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="continue-btn"
          onClick={onContinue}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
          title="Continue (Ctrl+Enter)"
        >
          Continue
        </button>

        <button
          type="button"
          data-testid="revise-btn"
          onClick={() => setShowReviseInput(!showReviseInput)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
          title="Revise (Ctrl+Shift+R)"
        >
          Revise
        </button>

        {revisionCount > 0 && (
          <span
            data-testid="revision-badge"
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold bg-amber-600/20 text-amber-400 rounded-full"
          >
            {revisionCount}
          </span>
        )}
      </div>

      {/* Revise textarea */}
      {showReviseInput && (
        <div className="space-y-2">
          <textarea
            data-testid="revise-textarea"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide feedback for revision (min 10 characters)..."
            className="w-full h-24 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="revise-submit-btn"
              disabled={feedback.trim().length < 10}
              onClick={handleSubmitRevise}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Submit Revision
            </button>
            <button
              type="button"
              onClick={handleCancelRevise}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <span className="text-[10px] text-gray-500 ml-auto">
              {feedback.trim().length}/10 min chars
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
