/**
 * ModelCostSelector - Model selection with cost estimation and RLM toggle
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronDownIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

/** Model option */
export interface ModelOption {
  /** Model ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Cost per token in USD */
  costPerToken: number;
  /** Maximum token limit */
  maxTokens: number;
}

export interface ModelCostSelectorProps {
  /** Available models */
  models: ModelOption[];
  /** Currently selected model ID */
  selectedModel: string;
  /** Estimated token count for cost calculation */
  estimatedTokens?: number;
  /** Show cost per token info */
  showCostPerToken?: boolean;
  /** Show RLM mode toggle */
  showRLMToggle?: boolean;
  /** RLM mode enabled state */
  rlmEnabled?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when model changes */
  onModelChange?: (modelId: string) => void;
  /** Callback when RLM mode changes */
  onRLMChange?: (enabled: boolean) => void;
}

// Format cost
function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export default function ModelCostSelector({
  models,
  selectedModel,
  estimatedTokens = 0,
  showCostPerToken = false,
  showRLMToggle = false,
  rlmEnabled = false,
  disabled = false,
  className,
  onModelChange,
  onRLMChange,
}: ModelCostSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRLMModal, setShowRLMModal] = useState(false);

  // Get selected model
  const selected = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel]
  );

  // Calculate estimated cost
  const estimatedCost = useMemo(() => {
    if (!selected) return 0;
    return estimatedTokens * selected.costPerToken;
  }, [selected, estimatedTokens]);

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Handle model selection
  const handleSelectModel = useCallback(
    (modelId: string) => {
      onModelChange?.(modelId);
      setIsOpen(false);
    },
    [onModelChange]
  );

  // Handle RLM toggle click
  const handleRLMToggleClick = useCallback(() => {
    if (disabled) return;

    if (!rlmEnabled) {
      // Show confirmation modal when enabling
      setShowRLMModal(true);
    } else {
      // Disable immediately without confirmation
      onRLMChange?.(false);
    }
  }, [disabled, rlmEnabled, onRLMChange]);

  // Handle RLM confirm
  const handleRLMConfirm = useCallback(() => {
    onRLMChange?.(true);
    setShowRLMModal(false);
  }, [onRLMChange]);

  // Handle RLM cancel
  const handleRLMCancel = useCallback(() => {
    setShowRLMModal(false);
  }, []);

  return (
    <div className={clsx('relative', className)} data-testid="model-cost-selector">
      {/* Model Selector */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-text-primary mb-1">Model</label>
        <button
          type="button"
          onClick={toggleDropdown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg',
            'border border-border-primary bg-bg-secondary',
            'text-left transition-colors',
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:border-accent-blue cursor-pointer'
          )}
          data-testid="model-dropdown-trigger"
        >
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-4 w-4 text-text-muted" />
            <span className="text-text-primary">{selected?.name || 'Select model'}</span>
          </div>
          <ChevronDownIcon
            className={clsx(
              'h-4 w-4 text-text-muted transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            role="listbox"
            className="absolute z-10 w-full mt-1 py-1 rounded-lg border border-border-primary bg-bg-secondary shadow-lg"
            data-testid="model-dropdown"
          >
            {models.map((model) => (
              <button
                key={model.id}
                role="option"
                aria-selected={model.id === selectedModel}
                onClick={() => handleSelectModel(model.id)}
                className={clsx(
                  'w-full px-3 py-2 text-left hover:bg-bg-tertiary transition-colors',
                  model.id === selectedModel && 'bg-accent-blue/10'
                )}
                data-testid={`model-option-${model.id}`}
              >
                <div className="font-medium text-text-primary">{model.name}</div>
                <div className="text-xs text-text-muted">{model.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cost Info */}
      {selected && (
        <div className="space-y-1 mb-3">
          {showCostPerToken && (
            <div className="text-xs text-text-muted" data-testid="cost-per-token">
              Cost: {formatCost(selected.costPerToken)}/token
            </div>
          )}
          {estimatedTokens > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Estimated cost:</span>
              <span className="font-medium text-text-primary" data-testid="cost-estimate">
                {formatCost(estimatedCost)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* RLM Toggle */}
      {showRLMToggle && (
        <div className="flex items-center justify-between pt-3 border-t border-border-primary">
          <div>
            <div className="text-sm font-medium text-text-primary">RLM Mode</div>
            <div className="text-xs text-text-muted">Recursive language model</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rlmEnabled}
            disabled={disabled}
            onClick={handleRLMToggleClick}
            className={clsx(
              'relative w-11 h-6 rounded-full transition-colors',
              rlmEnabled ? 'bg-accent-blue' : 'bg-bg-tertiary',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            data-testid="rlm-toggle"
          >
            <span
              className={clsx(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                rlmEnabled && 'translate-x-5'
              )}
            />
          </button>
        </div>
      )}

      {/* RLM Confirmation Modal */}
      {showRLMModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          data-testid="rlm-confirmation-modal"
        >
          <div className="bg-bg-secondary rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 rounded-full bg-status-warning/20">
                <ExclamationTriangleIcon className="h-6 w-6 text-status-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-1">Enable RLM Mode?</h3>
                <p className="text-sm text-text-muted">
                  RLM (Recursive Language Model) mode enables deeper reasoning through
                  recursive subcalls. This can result in significantly higher cost and
                  longer processing times.
                </p>
              </div>
            </div>

            <div className="bg-bg-tertiary rounded-lg p-3 mb-4">
              <div className="text-xs text-text-muted">Warning:</div>
              <ul className="text-sm text-text-secondary mt-1 space-y-1">
                <li>• Higher cost due to recursive subcalls</li>
                <li>• Longer processing time</li>
                <li>• May generate more comprehensive outputs</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleRLMCancel}
                className="px-4 py-2 text-sm rounded-lg bg-bg-tertiary hover:bg-bg-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRLMConfirm}
                className="px-4 py-2 text-sm rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
              >
                Enable RLM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
