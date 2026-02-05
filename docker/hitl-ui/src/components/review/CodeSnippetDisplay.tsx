/**
 * CodeSnippetDisplay Component (T16)
 *
 * Displays code snippets with syntax highlighting and line numbers.
 * Features:
 * - Line numbers starting from specified line
 * - Copy to clipboard button
 * - Optional line highlighting
 * - Language label
 */

import clsx from 'clsx';

interface CodeSnippetDisplayProps {
  code: string;
  language?: string;
  lineStart?: number;
  highlightLines?: number[];
}

export function CodeSnippetDisplay({
  code,
  language = 'python',
  lineStart = 1,
  highlightLines = [],
}: CodeSnippetDisplayProps) {
  const lines = code.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div
      className="rounded-lg overflow-hidden bg-gray-900"
      data-testid="code-snippet-display"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400" data-testid="language-label">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white transition-colors"
          data-testid="copy-button"
          type="button"
        >
          Copy
        </button>
      </div>

      {/* Code content */}
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono">
          {lines.map((line, i) => {
            const lineNum = lineStart + i;
            const isHighlighted = highlightLines.includes(lineNum);

            return (
              <div
                key={i}
                className={clsx(
                  'flex',
                  isHighlighted && 'bg-yellow-500/20'
                )}
                data-testid={`code-line-${lineNum}`}
                data-highlighted={isHighlighted || undefined}
              >
                <span
                  className="w-12 pr-4 text-right text-gray-500 select-none flex-shrink-0"
                  data-testid={`line-number-${lineNum}`}
                >
                  {lineNum}
                </span>
                <span className="text-gray-200 whitespace-pre">{line}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

export default CodeSnippetDisplay;
