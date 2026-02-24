import { useWorkflowStore } from '../../stores/workflowStore';
import { TagInput } from '../shared/TagInput';

export function WorkflowRulesBar(): JSX.Element {
  const rules = useWorkflowStore((s) => s.workflow?.rules ?? []);
  const addWorkflowRule = useWorkflowStore((s) => s.addWorkflowRule);
  const removeWorkflowRule = useWorkflowStore((s) => s.removeWorkflowRule);

  function handleChange(newTags: string[]): void {
    // Determine if a tag was added or removed
    if (newTags.length > rules.length) {
      // Tag was added — the new one is the last element
      const added = newTags[newTags.length - 1];
      addWorkflowRule(added);
    } else {
      // Tag was removed — find the removed index
      for (let i = 0; i < rules.length; i++) {
        if (i >= newTags.length || rules[i] !== newTags[i]) {
          removeWorkflowRule(i);
          return;
        }
      }
    }
  }

  return (
    <div
      data-testid="workflow-rules-bar"
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid #374151',
        backgroundColor: '#111827',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Rules
      </label>
      <div data-testid="add-rule-input" style={{ flex: 1 }}>
        <TagInput
          tags={rules}
          onChange={handleChange}
          placeholder="Add workflow rule..."
        />
      </div>
    </div>
  );
}
