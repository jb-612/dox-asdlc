/**
 * CommandTerminal - Terminal-style command execution for K8s Dashboard
 *
 * Features:
 * - Dark terminal aesthetic (monospace font, dark bg)
 * - Command history (up/down arrows)
 * - Output display with syntax highlighting
 * - Command whitelist validation (client-side UX only)
 * - Loading indicator during execution
 * - Error display in red
 * - Clear and copy buttons
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import {
  PlayIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useK8sStore } from '../../stores/k8sStore';
import { useExecuteCommand, getCommandValidationError } from '../../api/kubernetes';

export interface CommandTerminalProps {
  /** Allowed command prefixes for validation hint */
  allowedCommands?: string[];
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Custom class name */
  className?: string;
}

const DEFAULT_ALLOWED_COMMANDS = [
  'kubectl get',
  'kubectl describe',
  'kubectl logs',
  'kubectl top',
  'docker ps',
  'docker logs',
  'docker stats',
];

export default function CommandTerminal({
  allowedCommands = DEFAULT_ALLOWED_COMMANDS,
  maxHeight = 400,
  className,
}: CommandTerminalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Store state
  const {
    terminalHistory,
    terminalInput,
    setTerminalInput,
    addTerminalCommand,
    clearTerminal,
  } = useK8sStore();

  // Mutation hook
  const { mutate: executeCommand, isPending: isExecuting } = useExecuteCommand();

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  // Handle copy output
  const handleCopy = useCallback(async () => {
    const output = terminalHistory
      .map((entry) => `$ ${entry.command}\n${entry.output}`)
      .join('\n\n');

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(output);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = output;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('Failed to copy terminal output to clipboard');
    }
  }, [terminalHistory]);

  // Handle clear terminal
  const handleClear = useCallback(() => {
    clearTerminal();
    inputRef.current?.focus();
  }, [clearTerminal]);

  // Handle command execution
  const handleExecute = useCallback(() => {
    const command = terminalInput.trim();
    if (!command) return;

    // Client-side validation (UX only - server validates too)
    const validationError = getCommandValidationError(command);
    if (validationError) {
      addTerminalCommand(command, validationError, false, 0);
      return;
    }

    // Execute command
    const startTime = Date.now();
    executeCommand(
      { command, timeout: 30 },
      {
        onSuccess: (response) => {
          addTerminalCommand(
            command,
            response.output || response.error || 'Command completed',
            response.success,
            response.duration
          );
        },
        onError: (error) => {
          addTerminalCommand(
            command,
            `Error: ${error instanceof Error ? error.message : 'Command failed'}`,
            false,
            Date.now() - startTime
          );
        },
      }
    );

    setHistoryIndex(-1);
  }, [terminalInput, executeCommand, addTerminalCommand]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const commandHistory = terminalHistory.map((entry) => entry.command);

      if (e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
          setHistoryIndex(newIndex);
          setTerminalInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setTerminalInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setTerminalInput('');
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        handleClear();
      }
    },
    [terminalHistory, historyIndex, handleExecute, handleClear, setTerminalInput]
  );

  // Validation state
  const validationError = terminalInput ? getCommandValidationError(terminalInput) : null;
  const isValid = !validationError || !terminalInput;

  return (
    <div
      className={clsx(
        'flex flex-col rounded-lg overflow-hidden',
        'bg-[#0d1117] border border-[#30363d]',
        className
      )}
      data-testid="command-terminal"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
        <span className="text-xs text-[#8b949e] font-mono">Terminal</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={terminalHistory.length === 0}
            className="p-1.5 rounded hover:bg-[#30363d] text-[#8b949e] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy output"
            data-testid="copy-button"
          >
            {copied ? (
              <CheckIcon className="h-4 w-4 text-[#3fb950]" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleClear}
            disabled={terminalHistory.length === 0}
            className="p-1.5 rounded hover:bg-[#30363d] text-[#8b949e] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear terminal (Ctrl+L)"
            data-testid="clear-button"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
        style={{ maxHeight: maxHeight - 100 }}
        data-testid="terminal-output"
      >
        {terminalHistory.length === 0 ? (
          <div className="text-[#8b949e]">
            <p className="mb-2">Welcome to the K8s terminal. Allowed commands:</p>
            <ul className="list-disc list-inside text-[#58a6ff]">
              {allowedCommands.map((cmd) => (
                <li key={cmd}>{cmd}</li>
              ))}
            </ul>
          </div>
        ) : (
          terminalHistory.map((entry) => (
            <div key={entry.id} className="mb-4" data-testid="command-entry">
              {/* Command */}
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[#58a6ff]">$</span>
                <span className="text-[#c9d1d9]">{entry.command}</span>
              </div>
              {/* Output */}
              <pre
                className={clsx(
                  'whitespace-pre-wrap text-xs leading-relaxed',
                  entry.success ? 'text-[#c9d1d9]' : 'text-[#f85149]'
                )}
                data-testid={entry.success ? 'command-output' : 'command-error'}
              >
                {entry.output}
              </pre>
              {/* Duration */}
              {entry.duration > 0 && (
                <div className="text-[#8b949e] text-xs mt-1">
                  Completed in {entry.duration}ms
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isExecuting && (
          <div className="flex items-center gap-2 text-[#8b949e]" data-testid="loading-indicator">
            <div className="h-4 w-4 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
            <span>Executing...</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[#30363d] p-3">
        {/* Validation error hint */}
        {!isValid && (
          <div className="flex items-center gap-2 mb-2 text-xs text-[#f85149]" data-testid="validation-error">
            <XCircleIcon className="h-4 w-4" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[#58a6ff] font-mono">$</span>
          <input
            ref={inputRef}
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Enter command..."
            className={clsx(
              'flex-1 bg-transparent border-none outline-none font-mono text-sm',
              'text-[#c9d1d9] placeholder-[#484f58]',
              'disabled:opacity-50'
            )}
            autoFocus
            data-testid="command-input"
          />
          <button
            onClick={handleExecute}
            disabled={isExecuting || !isValid || !terminalInput.trim()}
            className={clsx(
              'p-2 rounded transition-colors',
              'bg-[#238636] hover:bg-[#2ea043]',
              'disabled:bg-[#30363d] disabled:cursor-not-allowed'
            )}
            title="Execute (Enter)"
            data-testid="execute-button"
          >
            <PlayIcon className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
