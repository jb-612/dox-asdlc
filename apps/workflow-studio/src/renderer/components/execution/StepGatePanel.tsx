import { useState } from 'react';
import type {
  NodeExecutionState,
  BlockDeliverables,
  ScrutinyLevel,
} from '../../../shared/types/execution';
import ScrutinyLevelSelector from './ScrutinyLevelSelector';
import DeliverablesViewer from './DeliverablesViewer';
import ContinueReviseBar from './ContinueReviseBar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StepGatePanelProps {
  node: NodeExecutionState;
  nodeLabel: string;
  deliverables: BlockDeliverables | null;
  onContinue: () => void;
  onRevise: (feedback: string) => void;
  /** Override the default scrutiny level */
  defaultScrutinyLevel?: ScrutinyLevel;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Panel displayed when a block enters gate mode (waiting_gate).
 * Composes ScrutinyLevelSelector, DeliverablesViewer, and ContinueReviseBar.
 */
export default function StepGatePanel({
  node,
  nodeLabel,
  deliverables,
  onContinue,
  onRevise,
  defaultScrutinyLevel = 'summary',
}: StepGatePanelProps): JSX.Element {
  const [scrutinyLevel, setScrutinyLevel] = useState<ScrutinyLevel>(defaultScrutinyLevel);

  const blockType = deliverables?.blockType ?? 'generic';

  return (
    <div data-testid="step-gate-panel" className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-200">{nodeLabel}</h3>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-400">
            Awaiting Review
          </span>
        </div>
        <ScrutinyLevelSelector value={scrutinyLevel} onChange={setScrutinyLevel} />
      </div>

      {/* Deliverables content */}
      <div className="flex-1 overflow-y-auto">
        <DeliverablesViewer
          deliverables={deliverables}
          scrutinyLevel={scrutinyLevel}
          blockType={blockType}
        />
      </div>

      {/* Action bar */}
      <div className="px-4 py-3 border-t border-gray-700 flex-shrink-0">
        <ContinueReviseBar
          onContinue={onContinue}
          onRevise={onRevise}
          revisionCount={node.revisionCount ?? 0}
        />
      </div>
    </div>
  );
}
