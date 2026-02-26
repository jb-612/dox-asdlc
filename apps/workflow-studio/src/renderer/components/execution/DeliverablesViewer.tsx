import type {
  BlockDeliverables,
  PlanBlockDeliverables,
  CodeBlockDeliverables,
  GenericBlockDeliverables,
  TestBlockDeliverables,
  ReviewBlockDeliverables,
  DevopsBlockDeliverables,
  ScrutinyLevel,
} from '../../../shared/types/execution';
import DiffViewer from './DiffViewer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeliverablesViewerProps {
  deliverables: BlockDeliverables | null;
  scrutinyLevel: ScrutinyLevel;
  blockType: string;
}

// ---------------------------------------------------------------------------
// Sub-renderers per block type and scrutiny level
// ---------------------------------------------------------------------------

function renderSummary(deliverables: BlockDeliverables): JSX.Element {
  if (deliverables.blockType === 'test') {
    return renderTestSummary(deliverables as TestBlockDeliverables);
  }
  if (deliverables.blockType === 'review') {
    return renderReviewSummary(deliverables as ReviewBlockDeliverables);
  }
  if (deliverables.blockType === 'devops') {
    return renderDevopsSummary(deliverables as DevopsBlockDeliverables);
  }

  let summary: string | undefined;

  if (deliverables.blockType === 'generic') {
    summary = (deliverables as GenericBlockDeliverables).summary;
  } else if (deliverables.blockType === 'code') {
    summary = (deliverables as CodeBlockDeliverables).diffSummary ?? 'Code changes completed.';
  } else if (deliverables.blockType === 'plan') {
    const plan = deliverables as PlanBlockDeliverables;
    summary = plan.taskList
      ? `${plan.taskList.length} tasks planned`
      : 'Planning completed.';
  }

  return (
    <p data-testid="deliverables-summary" className="text-sm text-gray-300">
      {summary ?? 'No summary available'}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Test block rendering
// ---------------------------------------------------------------------------

function renderTestSummary(d: TestBlockDeliverables): JSX.Element {
  const r = d.testResults ?? { passed: 0, failed: 0, skipped: 0 };
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm">
        <span className="text-green-400">Passed: <strong>{r.passed}</strong></span>
        <span className="text-red-400">Failed: <strong>{r.failed}</strong></span>
        <span className="text-yellow-400">Skipped: <strong>{r.skipped}</strong></span>
      </div>
      {d.summary && <p className="text-sm text-gray-300">{d.summary}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review block rendering
// ---------------------------------------------------------------------------

function renderReviewSummary(d: ReviewBlockDeliverables): JSX.Element {
  return (
    <div className="space-y-2">
      <span
        className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
          d.approved ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}
      >
        {d.approved ? 'Approved' : 'Rejected'}
      </span>
      {d.summary && <p className="text-sm text-gray-300">{d.summary}</p>}
    </div>
  );
}

function renderReviewContent(d: ReviewBlockDeliverables): JSX.Element {
  return (
    <div className="space-y-3">
      {renderReviewSummary(d)}
      {(!d.findings || d.findings.length === 0) ? (
        <p className="text-sm text-gray-500">No findings</p>
      ) : (
        <ul className="space-y-1">
          {d.findings.map((f, i) => (
            <li key={i} className="text-xs text-gray-300 px-2 py-1 bg-gray-800 rounded font-mono">
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DevOps block rendering
// ---------------------------------------------------------------------------

function renderDevopsSummary(d: DevopsBlockDeliverables): JSX.Element {
  return (
    <div className="space-y-2">
      {d.status && (
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-900/50 text-blue-300">
          {d.status}
        </span>
      )}
      {d.summary && <p className="text-sm text-gray-300">{d.summary}</p>}
    </div>
  );
}

function renderDevopsContent(d: DevopsBlockDeliverables): JSX.Element {
  return (
    <div className="space-y-3">
      {renderDevopsSummary(d)}
      {(!d.operations || d.operations.length === 0) ? (
        <p className="text-sm text-gray-500">No operations</p>
      ) : (
        <ul className="space-y-1">
          {d.operations.map((op, i) => (
            <li key={i} className="text-xs text-gray-300 px-2 py-1 bg-gray-800 rounded font-mono">
              {op}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderFileList(deliverables: BlockDeliverables): JSX.Element {
  let files: string[] = [];

  if (deliverables.blockType === 'code') {
    files = (deliverables as CodeBlockDeliverables).filesChanged ?? [];
  } else if (deliverables.blockType === 'plan') {
    const plan = deliverables as PlanBlockDeliverables;
    files = plan.taskList ?? [];
  }

  if (files.length === 0) {
    return (
      <div data-testid="deliverables-file-list">
        <p className="text-sm text-gray-500">No files to display</p>
      </div>
    );
  }

  return (
    <ul data-testid="deliverables-file-list" className="space-y-1">
      {files.map((file, i) => (
        <li
          key={`${file}-${i}`}
          className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 font-mono"
        >
          <span className="text-gray-500">{i + 1}.</span>
          <span>{file}</span>
        </li>
      ))}
    </ul>
  );
}

function renderFullContent(deliverables: BlockDeliverables): JSX.Element {
  if (deliverables.blockType === 'test') {
    return renderTestSummary(deliverables as TestBlockDeliverables);
  }
  if (deliverables.blockType === 'review') {
    return renderReviewContent(deliverables as ReviewBlockDeliverables);
  }
  if (deliverables.blockType === 'devops') {
    return renderDevopsContent(deliverables as DevopsBlockDeliverables);
  }

  if (deliverables.blockType === 'code') {
    const code = deliverables as CodeBlockDeliverables;
    if (code.fileDiffs && code.fileDiffs.length > 0) {
      return (
        <div className="space-y-3">
          {renderFileList(deliverables)}
          <DiffViewer diffs={code.fileDiffs} />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {renderFileList(deliverables)}
        {code.diffSummary && (
          <div className="px-3 py-2 bg-gray-800/60 rounded border border-gray-700">
            <p className="text-xs text-gray-300 font-mono">{code.diffSummary}</p>
          </div>
        )}
      </div>
    );
  }

  if (deliverables.blockType === 'plan') {
    const plan = deliverables as PlanBlockDeliverables;
    return (
      <div className="space-y-3">
        {plan.markdownDocument && (
          <pre className="text-xs text-gray-300 bg-gray-800/60 rounded p-3 border border-gray-700 overflow-x-auto whitespace-pre-wrap">
            {plan.markdownDocument}
          </pre>
        )}
        {renderFileList(deliverables)}
      </div>
    );
  }

  return renderSummary(deliverables);
}

function renderFullDetail(deliverables: BlockDeliverables): JSX.Element {
  if (deliverables.blockType === 'plan') {
    const plan = deliverables as PlanBlockDeliverables;
    return (
      <div className="space-y-4">
        {plan.markdownDocument && (
          <details open className="group">
            <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200">
              Document
            </summary>
            <pre className="mt-2 text-xs text-gray-300 bg-gray-800/60 rounded p-3 border border-gray-700 overflow-x-auto whitespace-pre-wrap">
              {plan.markdownDocument}
            </pre>
          </details>
        )}
        {plan.taskList && plan.taskList.length > 0 && (
          <details open className="group">
            <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200">
              Task List ({plan.taskList.length} items)
            </summary>
            <div className="mt-2">
              {renderFileList(deliverables)}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (deliverables.blockType === 'code') {
    const code = deliverables as CodeBlockDeliverables;
    if (code.fileDiffs && code.fileDiffs.length > 0) {
      return (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Full Detail View
          </h4>
          {renderFileList(deliverables)}
          <DiffViewer diffs={code.fileDiffs} />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Full Detail View
        </h4>
        {renderFullContent(deliverables)}
      </div>
    );
  }

  return renderSummary(deliverables);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders block deliverables at the requested scrutiny level.
 * Falls back gracefully when deliverables is null.
 */
export default function DeliverablesViewer({
  deliverables,
  scrutinyLevel,
  blockType: _blockType,
}: DeliverablesViewerProps): JSX.Element {
  if (!deliverables) {
    return (
      <div data-testid="deliverables-viewer" className="p-4">
        <p className="text-sm text-gray-500 text-center">
          No deliverables available
        </p>
      </div>
    );
  }

  let content: JSX.Element;

  switch (scrutinyLevel) {
    case 'summary':
      content = renderSummary(deliverables);
      break;
    case 'file_list':
      content = renderFileList(deliverables);
      break;
    case 'full_content':
      content = renderFullContent(deliverables);
      break;
    case 'full_detail':
      content = renderFullDetail(deliverables);
      break;
    default:
      content = renderSummary(deliverables);
  }

  return (
    <div data-testid="deliverables-viewer" className="p-4">
      {content}
    </div>
  );
}
