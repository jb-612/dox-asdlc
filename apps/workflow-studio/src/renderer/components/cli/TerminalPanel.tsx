import { useRef, useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerminalPanelProps {
  /** Lines of output to display, or null/empty if no session selected. */
  outputLines: string[];
  /** Whether a session is currently selected. */
  hasSession: boolean;
  /** Whether the selected session is still running (enables stdin input). */
  isRunning: boolean;
  /** Callback to send text to stdin of the session. */
  onWrite: (data: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Terminal output panel with dark background, monospace text, and auto-scroll.
 *
 * Shows preformatted CLI output. When a running session is selected, an input
 * field at the bottom allows sending text to the session's stdin.
 */
export default function TerminalPanel({
  outputLines,
  hasSession,
  isRunning,
  onWrite,
}: TerminalPanelProps): JSX.Element {
  const outputRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines, autoScroll]);

  // Detect manual scrolling to disable auto-scroll temporarily
  const handleScroll = useCallback(() => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        onWrite(input + '\n');
        setInput('');
      }
    },
    [input, onWrite],
  );

  // Empty state -- no session selected
  if (!hasSession) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-sm text-gray-500 font-mono">No session selected</p>
          <p className="text-xs text-gray-600 mt-1">
            Select a session from the list or spawn a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Output area */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {outputLines.length === 0 ? (
          <span className="text-gray-600">Waiting for output...</span>
        ) : (
          outputLines.map((line, idx) => (
            <div key={idx} className="text-green-400 whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>

      {/* Stdin input */}
      {isRunning && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-800 px-3 py-2 flex items-center gap-2 shrink-0"
        >
          <span className="text-green-500 font-mono text-xs select-none">{'>'}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type command..."
            className="flex-1 bg-transparent text-green-300 font-mono text-xs placeholder-gray-600 outline-none border-none"
            autoFocus
          />
          <button
            type="submit"
            className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-800 text-gray-400 hover:text-green-400 transition-colors"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
