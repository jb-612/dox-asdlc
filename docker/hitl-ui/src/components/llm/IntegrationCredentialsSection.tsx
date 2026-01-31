/**
 * IntegrationCredentialsSection Component (P05-F13 Extension)
 *
 * Container section for integration credential management with table and add dialog.
 */

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { PlusIcon, LinkIcon } from '@heroicons/react/24/outline';
import IntegrationCredentialsTable from './IntegrationCredentialsTable';
import AddIntegrationCredentialDialog from './AddIntegrationCredentialDialog';
import type {
  IntegrationCredential,
  AddIntegrationCredentialRequest,
  IntegrationType,
} from '../../types/llmConfig';
import Button from '../common/Button';

export interface IntegrationCredentialsSectionProps {
  /** List of integration credentials */
  credentials: IntegrationCredential[];
  /** Whether credentials are loading */
  isLoading?: boolean;
  /** Available integration types for new credentials */
  integrationTypes?: IntegrationType[];
  /** Callback when adding a credential */
  onAddCredential?: (request: AddIntegrationCredentialRequest) => Promise<void>;
  /** Callback when deleting a credential */
  onDeleteCredential?: (credentialId: string) => Promise<void>;
  /** Callback when testing a credential */
  onTestCredential?: (credentialId: string) => Promise<void>;
  /** Custom class name */
  className?: string;
}

export default function IntegrationCredentialsSection({
  credentials,
  isLoading = false,
  integrationTypes = ['slack', 'teams', 'github'],
  onAddCredential,
  onDeleteCredential,
  onTestCredential,
  className,
}: IntegrationCredentialsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingCredentialId, setTestingCredentialId] = useState<string | null>(null);
  const [deletingCredentialId, setDeletingCredentialId] = useState<string | null>(null);

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleSubmitCredential = useCallback(
    async (request: AddIntegrationCredentialRequest) => {
      if (!onAddCredential) return;
      setIsSubmitting(true);
      try {
        await onAddCredential(request);
        setIsDialogOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAddCredential]
  );

  const handleTestCredential = useCallback(
    async (credentialId: string) => {
      if (!onTestCredential) return;
      setTestingCredentialId(credentialId);
      try {
        await onTestCredential(credentialId);
      } finally {
        setTestingCredentialId(null);
      }
    },
    [onTestCredential]
  );

  const handleDeleteCredential = useCallback(
    async (credentialId: string) => {
      if (!onDeleteCredential) return;
      setDeletingCredentialId(credentialId);
      try {
        await onDeleteCredential(credentialId);
      } finally {
        setDeletingCredentialId(null);
      }
    },
    [onDeleteCredential]
  );

  return (
    <section
      data-testid="integration-credentials-section"
      className={clsx('bg-bg-secondary rounded-lg border border-border-primary', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-purple/10">
            <LinkIcon className="h-5 w-5 text-accent-purple" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Integration Credentials</h2>
            <p className="text-sm text-text-secondary">
              Manage credentials for Slack, Teams, and GitHub integrations
            </p>
          </div>
        </div>
        <Button
          data-testid="add-credential-button"
          variant="primary"
          size="sm"
          onClick={handleOpenDialog}
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Credential
        </Button>
      </div>

      {/* Table */}
      <div className="p-4">
        <IntegrationCredentialsTable
          credentials={credentials}
          isLoading={isLoading}
          onTest={handleTestCredential}
          onDelete={handleDeleteCredential}
          testingCredentialId={testingCredentialId}
          deletingCredentialId={deletingCredentialId}
        />
      </div>

      {/* Add Credential Dialog */}
      <AddIntegrationCredentialDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmitCredential}
        isSubmitting={isSubmitting}
        integrationTypes={integrationTypes}
      />
    </section>
  );
}
