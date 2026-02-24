import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

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
  /** Callback to clear the terminal buffer (T09). */
  onClear?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Terminal output panel powered by xterm.js with ANSI color support,
 * cursor movement, and proper terminal rendering.
 *
 * When a running session is selected, an input field at the bottom allows
 * sending text to the session's stdin.
 */
export default function TerminalPanel({
  outputLines,
  hasSession,
  isRunning,
  onWrite,
  onClear,
}: TerminalPanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenIndexRef = useRef<number>(0);
  const [input, setInput] = useState('');

  // Initialize xterm.js terminal on mount
  useEffect(() => {
    if (!hasSession || !containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: 'monospace',
      fontSize: 12,
      cursorBlink: true,
      theme: {
        background: '#000000',
        foreground: '#4ade80',
        cursor: '#4ade80',
      },
      disableStdin: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    // Delay fit to allow container dimensions to settle
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Container may not be visible yet
      }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenIndexRef.current = 0;

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore fit errors during transitions
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      writtenIndexRef.current = 0;
    };
  }, [hasSession]);

  // Write new output lines to the terminal incrementally
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const start = writtenIndexRef.current;
    if (start < outputLines.length) {
      for (let i = start; i < outputLines.length; i++) {
        terminal.writeln(outputLines[i]);
      }
      writtenIndexRef.current = outputLines.length;
    }
  }, [outputLines]);

  // Reset written index when outputLines is replaced (e.g., session switch or clear)
  useEffect(() => {
    if (outputLines.length === 0) {
      const terminal = terminalRef.current;
      if (terminal) {
        terminal.clear();
      }
      writtenIndexRef.current = 0;
    }
  }, [outputLines.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Cmd+K / Ctrl+K to clear (T09)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleClear = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.clear();
    }
    writtenIndexRef.current = 0;
    onClear?.();
  }, [onClear]);

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
      {/* Toolbar with clear button (T09) */}
      <div className="flex items-center justify-end px-2 py-1 border-b border-gray-800 shrink-0">
        <button
          type="button"
          onClick={handleClear}
          className="px-2 py-0.5 text-[10px] font-medium rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title="Clear terminal (Cmd+K)"
        >
          Clear
        </button>
      </div>

      {/* xterm.js terminal container */}
      <div ref={containerRef} className="flex-1 min-h-0" />

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
