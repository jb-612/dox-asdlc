import { useState, type KeyboardEvent, type ChangeEvent } from 'react';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export function TagInput({
  tags,
  onChange,
  placeholder = 'Add tag...',
  maxTags,
}: TagInputProps): JSX.Element {
  const [input, setInput] = useState('');

  function addTag(raw: string): void {
    const value = raw.trim();
    if (!value) return;
    if (tags.includes(value)) return;
    if (maxTags != null && tags.length >= maxTags) return;
    onChange([...tags, value]);
    setInput('');
  }

  function removeTag(tag: string): void {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value;
    if (val.includes(',')) {
      addTag(val.replace(',', ''));
    } else {
      setInput(val);
    }
  }

  const atLimit = maxTags != null && tags.length >= maxTags;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        padding: 6,
        border: '1px solid #4b5563',
        borderRadius: 6,
        backgroundColor: '#111827',
        minHeight: 34,
        alignItems: 'center',
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 4,
            backgroundColor: '#374151',
            color: '#d1d5db',
            fontSize: 12,
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`Remove ${tag}`}
            style={{
              border: 'none',
              background: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: 0,
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            \u00d7
          </button>
        </span>
      ))}
      {!atLimit && (
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: 60,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#e5e7eb',
            fontSize: 12,
          }}
        />
      )}
    </div>
  );
}
