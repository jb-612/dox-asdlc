import { useState, type ChangeEvent, type KeyboardEvent } from 'react';

export interface PromptHarnessEditorProps {
  systemPromptPrefix: string;
  outputChecklist: string[];
  onPrefixChange: (prefix: string) => void;
  onChecklistChange: (checklist: string[]) => void;
}

export function PromptHarnessEditor({
  systemPromptPrefix,
  outputChecklist,
  onPrefixChange,
  onChecklistChange,
}: PromptHarnessEditorProps): JSX.Element {
  const [newItem, setNewItem] = useState('');

  function addChecklistItem(): void {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChecklistChange([...outputChecklist, trimmed]);
    setNewItem('');
  }

  function removeChecklistItem(index: number): void {
    onChecklistChange(outputChecklist.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* System Prompt Prefix */}
      <div>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          System Prompt Prefix
        </label>
        <textarea
          data-testid="prompt-prefix-input"
          value={systemPromptPrefix}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onPrefixChange(e.target.value)}
          placeholder="Instructions prepended to the agent's system prompt..."
          rows={4}
          style={{
            width: '100%',
            backgroundColor: '#111827',
            color: '#e5e7eb',
            border: '1px solid #4b5563',
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Output Checklist */}
      <div data-testid="output-checklist">
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          Output Checklist
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {outputChecklist.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                backgroundColor: '#1f2937',
                borderRadius: 4,
                fontSize: 12,
                color: '#d1d5db',
              }}
            >
              <span style={{ color: '#6b7280', fontSize: 11, minWidth: 18 }}>{index + 1}.</span>
              <span style={{ flex: 1 }}>{item}</span>
              <button
                type="button"
                onClick={() => removeChecklistItem(index)}
                aria-label={`Remove item ${index + 1}`}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add checklist item..."
            style={{
              flex: 1,
              backgroundColor: '#111827',
              color: '#e5e7eb',
              border: '1px solid #4b5563',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={addChecklistItem}
            disabled={!newItem.trim()}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              backgroundColor: newItem.trim() ? '#2563eb' : '#374151',
              color: newItem.trim() ? '#ffffff' : '#6b7280',
              fontSize: 12,
              cursor: newItem.trim() ? 'pointer' : 'default',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
