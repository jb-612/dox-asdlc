import clsx from 'clsx';

interface DiffViewerProps {
  content: string;
  className?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  lineNumber?: number;
}

function parseDiff(content: string): DiffLine[] {
  const lines = content.split('\n');
  const result: DiffLine[] = [];
  let lineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Diff header (hunk)
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) {
        lineNumber = parseInt(match[1], 10) - 1;
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNumber++;
      result.push({ type: 'add', content: line.slice(1), lineNumber });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({ type: 'remove', content: line.slice(1) });
    } else if (line.startsWith('diff') || line.startsWith('index') ||
               line.startsWith('---') || line.startsWith('+++')) {
      result.push({ type: 'header', content: line });
    } else {
      lineNumber++;
      result.push({ type: 'context', content: line.slice(1) || line, lineNumber });
    }
  }

  return result;
}

const lineStyles: Record<DiffLine['type'], string> = {
  add: 'bg-status-success/10 text-status-success',
  remove: 'bg-status-error/10 text-status-error',
  context: 'text-text-secondary',
  header: 'bg-bg-tertiary text-status-info font-medium',
};

const linePrefix: Record<DiffLine['type'], string> = {
  add: '+',
  remove: '-',
  context: ' ',
  header: '',
};

export default function DiffViewer({ content, className }: DiffViewerProps) {
  const lines = parseDiff(content);

  return (
    <div
      className={clsx(
        'font-mono text-sm overflow-x-auto bg-bg-primary rounded-lg border border-bg-tertiary',
        className
      )}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className={lineStyles[line.type]}>
              <td className="w-12 px-2 py-0.5 text-right text-text-tertiary select-none border-r border-bg-tertiary">
                {line.lineNumber || ''}
              </td>
              <td className="w-6 px-1 py-0.5 text-center select-none">
                {linePrefix[line.type]}
              </td>
              <td className="px-2 py-0.5 whitespace-pre">
                {line.content || ' '}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
