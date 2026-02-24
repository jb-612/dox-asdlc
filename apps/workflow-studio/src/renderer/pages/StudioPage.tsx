import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkflowStore } from '../stores/workflowStore';
import { BlockPalette } from '../components/studio/BlockPalette';
import { StudioCanvas } from '../components/studio/StudioCanvas';
import { BlockConfigPanel } from '../components/studio/BlockConfigPanel';
import { WorkflowRulesBar } from '../components/studio/WorkflowRulesBar';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';

export default function StudioPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('templateId');

  const workflow = useWorkflowStore((s) => s.workflow);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const markClean = useWorkflowStore((s) => s.markClean);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Ensure there is always a workflow loaded
  useEffect(() => {
    if (!workflow) {
      newWorkflow();
    }
  }, [workflow, newWorkflow]);

  // Load template if templateId is provided
  useEffect(() => {
    if (templateId) {
      void (async () => {
        try {
          const loaded = await window.electronAPI.template.load(templateId);
          if (loaded) {
            setWorkflow(loaded);
          }
        } catch (err) {
          console.error('Failed to load template:', err);
        }
      })();
    }
  }, [templateId, setWorkflow]);

  // Clear save indicator after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      const t = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!workflow || !templateName.trim()) return;

    setSaveStatus('saving');
    setShowSaveDialog(false);

    try {
      const toSave = {
        ...workflow,
        metadata: {
          ...workflow.metadata,
          name: templateName.trim(),
          tags: Array.from(new Set([...workflow.metadata.tags, 'studio-block-composer'])),
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await window.electronAPI.template.save(toSave);
      if (result.success) {
        markClean();
        setSaveStatus('saved');
      } else {
        console.error('Template save failed:', result.error);
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Template save error:', err);
      setSaveStatus('error');
    }

    setTemplateName('');
  }, [workflow, templateName, markClean]);

  function openSaveDialog(): void {
    setTemplateName(workflow?.metadata.name ?? '');
    setShowSaveDialog(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar: rules + save button */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #374151' }}>
        <div style={{ flex: 1 }}>
          <WorkflowRulesBar />
        </div>
        <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 11, color: '#10b981' }}>Saved</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: 11, color: '#ef4444' }}>Save failed</span>
          )}
          <button
            data-testid="save-as-template-btn"
            type="button"
            onClick={openSaveDialog}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Save as Template
          </button>
        </div>
      </div>

      {/* Main content: palette + canvas + config panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <BlockPalette />
        <StudioCanvas />
        <BlockConfigPanel />
      </div>

      {/* Save as Template dialog */}
      {showSaveDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000,
          }}
          onClick={() => setShowSaveDialog(false)}
          role="presentation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: 8,
              padding: 24,
              maxWidth: 400,
              width: '90%',
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>
              Save as Template
            </h2>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSaveAsTemplate();
                }
              }}
              style={{
                width: '100%',
                backgroundColor: '#111827',
                color: '#e5e7eb',
                border: '1px solid #4b5563',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                outline: 'none',
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid #4b5563',
                  backgroundColor: 'transparent',
                  color: '#d1d5db',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAsTemplate()}
                disabled={!templateName.trim()}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: templateName.trim() ? '#2563eb' : '#374151',
                  color: templateName.trim() ? '#ffffff' : '#6b7280',
                  fontSize: 13,
                  cursor: templateName.trim() ? 'pointer' : 'default',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
