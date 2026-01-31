/**
 * AddIntegrationCredentialDialog Component (P05-F13 Extension)
 *
 * Dialog for adding a new integration credential.
 */

import { useState, useCallback, useEffect } from 'react';
import { XMarkIcon, LinkIcon } from '@heroicons/react/24/outline';
import type {
  IntegrationType,
  AddIntegrationCredentialRequest,
} from '../../types/llmConfig';
import {
  INTEGRATION_NAMES,
  INTEGRATION_DESCRIPTIONS,
  INTEGRATION_CREDENTIAL_TYPES,
} from '../../types/llmConfig';
import Button from '../common/Button';
import Spinner from '../common/Spinner';

export interface AddIntegrationCredentialDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Submit handler */
  onSubmit: (request: AddIntegrationCredentialRequest) => Promise<void>;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Available integration types */
  integrationTypes?: IntegrationType[];
}

const DEFAULT_INTEGRATION_TYPES: IntegrationType[] = ['slack', 'teams', 'github'];

export default function AddIntegrationCredentialDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  integrationTypes = DEFAULT_INTEGRATION_TYPES,
}: AddIntegrationCredentialDialogProps) {
  const [integrationType, setIntegrationType] = useState<IntegrationType>(integrationTypes[0]);
  const [credentialType, setCredentialType] = useState<string>('');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or integration type changes
  useEffect(() => {
    if (isOpen) {
      setIntegrationType(integrationTypes[0]);
      setCredentialType(INTEGRATION_CREDENTIAL_TYPES[integrationTypes[0]][0]);
      setName('');
      setKey('');
      setError(null);
    }
  }, [isOpen, integrationTypes]);

  // Update credential type when integration changes
  useEffect(() => {
    const types = INTEGRATION_CREDENTIAL_TYPES[integrationType];
    if (types && types.length > 0) {
      setCredentialType(types[0]);
    }
  }, [integrationType]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validation
      if (!name.trim()) {
        setError('Name is required');
        return;
      }
      if (!key.trim()) {
        setError('Credential value is required');
        return;
      }

      try {
        await onSubmit({
          integrationType,
          credentialType,
          name: name.trim(),
          key: key.trim(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add credential');
      }
    },
    [integrationType, credentialType, name, key, onSubmit]
  );

  if (!isOpen) return null;

  const credentialTypes = INTEGRATION_CREDENTIAL_TYPES[integrationType] || [];

  return (
    <div
      data-testid="add-integration-credential-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-bg-secondary rounded-lg shadow-xl w-full max-w-md mx-4 border border-border-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-purple/10">
              <LinkIcon className="h-5 w-5 text-accent-purple" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">
              Add Integration Credential
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Integration Type */}
          <div>
            <label
              htmlFor="integration-type"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Integration
            </label>
            <select
              id="integration-type"
              data-testid="integration-type-select"
              value={integrationType}
              onChange={(e) => setIntegrationType(e.target.value as IntegrationType)}
              className="w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
            >
              {integrationTypes.map((type) => (
                <option key={type} value={type}>
                  {INTEGRATION_NAMES[type]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-muted">
              {INTEGRATION_DESCRIPTIONS[integrationType]}
            </p>
          </div>

          {/* Credential Type */}
          <div>
            <label
              htmlFor="credential-type"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Credential Type
            </label>
            <select
              id="credential-type"
              data-testid="credential-type-select"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
            >
              {credentialTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="credential-name"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Name
            </label>
            <input
              id="credential-name"
              data-testid="credential-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Slack Bot"
              className="w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple"
            />
          </div>

          {/* Key */}
          <div>
            <label
              htmlFor="credential-key"
              className="block text-sm font-medium text-text-primary mb-1"
            >
              Value
            </label>
            <input
              id="credential-key"
              data-testid="credential-key-input"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter credential value"
              className="w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-purple font-mono"
            />
            <p className="mt-1 text-xs text-text-muted">
              The value will be encrypted before storage
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-status-error bg-status-error/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              data-testid="submit-credential-button"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Adding...
                </>
              ) : (
                'Add Credential'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
