import { type DragEvent } from 'react';
import type { BlockType } from '../../../shared/types/workflow';
import {
  BLOCK_TYPE_METADATA,
  AVAILABLE_BLOCK_TYPES,
  NODE_TYPE_METADATA,
} from '../../../shared/constants';

const CONTROL_FLOW_TYPES: BlockType[] = ['condition', 'forEach', 'subWorkflow'];

const CONTROL_FLOW_COLORS: Record<string, { color: string; bgColor: string }> = {
  condition: { color: '#8B5CF6', bgColor: '#8B5CF620' },
  forEach: { color: '#3B82F6', bgColor: '#3B82F620' },
  subWorkflow: { color: '#22C55E', bgColor: '#22C55E20' },
};

interface BlockCardProps {
  blockType: BlockType;
}

function BlockCard({ blockType }: BlockCardProps): JSX.Element {
  const meta = BLOCK_TYPE_METADATA[blockType];
  const isControlFlow = CONTROL_FLOW_TYPES.includes(blockType);
  const nodeMeta = !isControlFlow && meta.agentNodeType
    ? NODE_TYPE_METADATA[meta.agentNodeType]
    : null;
  const colors = isControlFlow
    ? CONTROL_FLOW_COLORS[blockType]
    : { color: nodeMeta?.color ?? '#6B7280', bgColor: nodeMeta?.bgColor ?? '#6B728020' };

  function handleDragStart(event: DragEvent<HTMLDivElement>): void {
    const payload = JSON.stringify({
      nodeKind: isControlFlow ? 'control' : 'agent',
      agentType: meta.agentNodeType ?? blockType,
      blockType,
    });
    event.dataTransfer.setData('application/reactflow', payload);
    event.dataTransfer.setData('application/studio-block', blockType);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      data-testid={`palette-block-${blockType}`}
      draggable
      onDragStart={handleDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 6,
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        cursor: 'grab',
        transition: 'border-color 0.15s',
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = colors.color;
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#374151';
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: colors.bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: colors.color,
          }}
        />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.3 }}>
          {meta.description}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '8px 2px 4px',
        borderTop: '1px solid #374151',
        marginTop: 4,
      }}
    >
      {title}
    </div>
  );
}

export function BlockPalette(): JSX.Element {
  const agentBlocks = AVAILABLE_BLOCK_TYPES.filter((bt) => !CONTROL_FLOW_TYPES.includes(bt));
  const controlFlowBlocks = AVAILABLE_BLOCK_TYPES.filter((bt) => CONTROL_FLOW_TYPES.includes(bt));

  return (
    <div
      data-testid="block-palette"
      style={{
        width: 220,
        backgroundColor: '#111827',
        borderRight: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          padding: '12px 12px 8px',
          borderBottom: '1px solid #374151',
        }}
      >
        <h3
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          Block Palette
        </h3>
        <p style={{ fontSize: 10, color: '#4b5563', margin: '4px 0 0' }}>
          Drag blocks onto the canvas
        </p>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {agentBlocks.map((blockType) => (
          <BlockCard key={blockType} blockType={blockType} />
        ))}

        {controlFlowBlocks.length > 0 && (
          <>
            <SectionHeader title="Control Flow" />
            {controlFlowBlocks.map((blockType) => (
              <BlockCard key={blockType} blockType={blockType} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
