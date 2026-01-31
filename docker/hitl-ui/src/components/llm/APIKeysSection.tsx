/**
 * APIKeysSection Component (P05-F13 T07)
 *
 * Container section for API key management with table and add dialog.
 */

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { PlusIcon, KeyIcon } from '@heroicons/react/24/outline';
import APIKeyTable from './APIKeyTable';
import AddAPIKeyDialog from './AddAPIKeyDialog';
import type { APIKey, AddAPIKeyRequest, LLMProvider } from '../../types/llmConfig';
import Button from '../common/Button';

export interface APIKeysSectionProps {
  /** List of API keys */
  keys: APIKey[];
  /** Whether keys are loading */
  isLoading?: boolean;
  /** Available providers for new keys */
  providers?: LLMProvider[];
  /** Callback when adding a key */
  onAddKey?: (request: AddAPIKeyRequest) => Promise<void>;
  /** Callback when deleting a key */
  onDeleteKey?: (keyId: string) => Promise<void>;
  /** Callback when testing a key */
  onTestKey?: (keyId: string) => Promise<void>;
  /** Custom class name */
  className?: string;
}

export default function APIKeysSection({
  keys,
  isLoading = false,
  providers = ['anthropic', 'openai', 'google'],
  onAddKey,
  onDeleteKey,
  onTestKey,
  className,
}: APIKeysSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleSubmitKey = useCallback(
    async (request: AddAPIKeyRequest) => {
      if (!onAddKey) return;
      setIsSubmitting(true);
      try {
        await onAddKey(request);
        setIsDialogOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAddKey]
  );

  const handleTestKey = useCallback(
    async (keyId: string) => {
      if (!onTestKey) return;
      setTestingKeyId(keyId);
      try {
        await onTestKey(keyId);
      } finally {
        setTestingKeyId(null);
      }
    },
    [onTestKey]
  );

  const handleDeleteKey = useCallback(
    async (keyId: string) => {
      if (!onDeleteKey) return;
      setDeletingKeyId(keyId);
      try {
        await onDeleteKey(keyId);
      } finally {
        setDeletingKeyId(null);
      }
    },
    [onDeleteKey]
  );

  return (
    <section
      data-testid="api-keys-section"
      className={clsx('bg-bg-secondary rounded-lg border border-border-primary', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-teal/10">
            <KeyIcon className="h-5 w-5 text-accent-teal" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">API Keys</h2>
            <p className="text-sm text-text-secondary">
              Manage your LLM provider API keys
            </p>
          </div>
        </div>
        <Button
          data-testid="add-key-button"
          variant="primary"
          size="sm"
          onClick={handleOpenDialog}
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Key
        </Button>
      </div>

      {/* Table */}
      <div className="p-4">
        <APIKeyTable
          keys={keys}
          isLoading={isLoading}
          onTest={handleTestKey}
          onDelete={handleDeleteKey}
          testingKeyId={testingKeyId}
          deletingKeyId={deletingKeyId}
        />
      </div>

      {/* Add Key Dialog */}
      <AddAPIKeyDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitKey}
        isSubmitting={isSubmitting}
        providers={providers}
      />
    </section>
  );
}
