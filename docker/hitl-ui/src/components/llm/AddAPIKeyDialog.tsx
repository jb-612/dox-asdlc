/**
 * AddAPIKeyDialog Component (P05-F13 T06)
 *
 * Modal dialog for adding a new API key.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import type { LLMProvider, AddAPIKeyRequest } from '../../types/llmConfig';
import { PROVIDER_NAMES } from '../../types/llmConfig';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

export interface AddAPIKeyDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when key is submitted */
  onSubmit: (request: AddAPIKeyRequest) => void;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Available providers */
  providers?: LLMProvider[];
  /** Custom class name */
  className?: string;
}

const DEFAULT_PROVIDERS: LLMProvider[] = ['anthropic', 'openai', 'google'];

export default function AddAPIKeyDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  providers = DEFAULT_PROVIDERS,
  className,
}: AddAPIKeyDialogProps) {
  const [provider, setProvider] = useState<LLMProvider>('anthropic');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; key?: string }>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setProvider('anthropic');
      setName('');
      setApiKey('');
      setShowKey(false);
      setErrors({});
      // Focus name input after a short delay
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose]
  );

  const validate = useCallback((): boolean => {
    const newErrors: { name?: string; key?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!apiKey.trim()) {
      newErrors.key = 'API key is required';
    } else if (apiKey.length < 10) {
      newErrors.key = 'API key seems too short';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, apiKey]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate() || isSubmitting) return;

      onSubmit({
        provider,
        name: name.trim(),
        key: apiKey.trim(),
      });
    },
    [provider, name, apiKey, validate, isSubmitting, onSubmit]
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="add-api-key-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        data-testid="add-api-key-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-key-title"
        className={clsx(
          'bg-bg-secondary rounded-lg shadow-xl border border-border-primary',
          'w-full max-w-md mx-4',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 id="add-key-title" className="text-lg font-semibold text-text-primary">
            Add API Key
          </h2>
          <button
            data-testid="close-dialog"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Provider Select */}
          <div>
            <label
              htmlFor="provider"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Provider
            </label>
            <select
              id="provider"
              data-testid="provider-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as LLMProvider)}
              disabled={isSubmitting}
              className={clsx(
                'w-full px-3 py-2 rounded-lg',
                'bg-bg-primary border border-border-primary',
                'text-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {providers.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_NAMES[p]}
                </option>
              ))}
            </select>
          </div>

          {/* Name Input */}
          <div>
            <label
              htmlFor="key-name"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Name
            </label>
            <input
              ref={nameInputRef}
              id="key-name"
              data-testid="key-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g., Production Key"
              className={clsx(
                'w-full px-3 py-2 rounded-lg',
                'bg-bg-primary border',
                errors.name ? 'border-status-error' : 'border-border-primary',
                'text-text-primary placeholder-text-muted',
                'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-status-error">{errors.name}</p>
            )}
          </div>

          {/* API Key Input */}
          <div>
            <label
              htmlFor="api-key"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              API Key
            </label>
            <div className="relative">
              <input
                id="api-key"
                data-testid="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isSubmitting}
                placeholder="sk-..."
                className={clsx(
                  'w-full px-3 py-2 pr-10 rounded-lg',
                  'bg-bg-primary border',
                  errors.key ? 'border-status-error' : 'border-border-primary',
                  'text-text-primary placeholder-text-muted font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-accent-teal focus:border-transparent',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              />
              <button
                type="button"
                data-testid="toggle-key-visibility"
                onClick={() => setShowKey(!showKey)}
                disabled={isSubmitting}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary"
              >
                {showKey ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.key && (
              <p className="mt-1 text-xs text-status-error">{errors.key}</p>
            )}
            <p className="mt-1 text-xs text-text-muted">
              Your key will be encrypted and stored securely
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-primary bg-bg-tertiary/30 rounded-b-lg">
          <Button
            data-testid="cancel-button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            data-testid="submit-button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || !apiKey.trim()}
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Adding...
              </>
            ) : (
              'Add Key'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
