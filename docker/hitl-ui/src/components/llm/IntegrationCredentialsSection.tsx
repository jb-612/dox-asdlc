/**
 * IntegrationCredentialsSection Component (P05-F13 Extension, P09-F01 T08-T10)
 *
 * Container section for integration credential management with table and add dialog.
 * Now includes secrets backend indicator, environment selector, enhanced test results,
 * and Send Test Message functionality for Slack bot tokens.
 */

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { PlusIcon, LinkIcon } from '@heroicons/react/24/outline';
import IntegrationCredentialsTable from './IntegrationCredentialsTable';
import AddIntegrationCredentialDialog from './AddIntegrationCredentialDialog';
import SecretsBackendBadge from './SecretsBackendBadge';
import EnvironmentSelector from './EnvironmentSelector';
import TestResultDialog from './TestResultDialog';
import SendTestMessageDialog from './SendTestMessageDialog';
import type {
  IntegrationCredential,
  AddIntegrationCredentialRequest,
  IntegrationType,
  SecretsHealthResponse,
  SecretsEnvironment,
  EnhancedTestIntegrationCredentialResponse,
  SendTestMessageResponse,
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
  /** Callback when testing a credential - returns enhanced result */
  onTestCredential?: (credentialId: string) => Promise<EnhancedTestIntegrationCredentialResponse | void>;
  /** Callback when sending a test message */
  onSendTestMessage?: (credentialId: string, channel: string) => Promise<SendTestMessageResponse>;
  /** Secrets backend health info */
  secretsHealth?: SecretsHealthResponse | null;
  /** Whether secrets health is loading */
  secretsHealthLoading?: boolean;
  /** Selected environment filter */
  selectedEnvironment?: SecretsEnvironment | 'all';
  /** Callback when environment changes */
  onEnvironmentChange?: (env: SecretsEnvironment | 'all') => void;
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
  onSendTestMessage,
  secretsHealth,
  secretsHealthLoading = false,
  selectedEnvironment = 'all',
  onEnvironmentChange,
  className,
}: IntegrationCredentialsSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingCredentialId, setTestingCredentialId] = useState<string | null>(null);
  const [sendingMessageCredentialId, setSendingMessageCredentialId] = useState<string | null>(null);
  const [deletingCredentialId, setDeletingCredentialId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<EnhancedTestIntegrationCredentialResponse | null>(null);
  const [testResultDialogOpen, setTestResultDialogOpen] = useState(false);
  const [testedCredential, setTestedCredential] = useState<IntegrationCredential | null>(null);
  const [sendMessageDialogOpen, setSendMessageDialogOpen] = useState(false);
  const [sendMessageCredential, setSendMessageCredential] = useState<IntegrationCredential | null>(null);

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
        const result = await onTestCredential(credentialId);
        // If we got a result back, show the dialog
        if (result) {
          const cred = credentials.find((c) => c.id === credentialId);
          setTestedCredential(cred || null);
          setTestResult(result);
          setTestResultDialogOpen(true);
        }
      } finally {
        setTestingCredentialId(null);
      }
    },
    [onTestCredential, credentials]
  );

  const handleCloseTestResultDialog = useCallback(() => {
    setTestResultDialogOpen(false);
    setTestResult(null);
    setTestedCredential(null);
  }, []);

  const handleOpenSendMessageDialog = useCallback(
    (credentialId: string) => {
      const cred = credentials.find((c) => c.id === credentialId);
      if (cred) {
        setSendMessageCredential(cred);
        setSendMessageDialogOpen(true);
      }
    },
    [credentials]
  );

  const handleCloseSendMessageDialog = useCallback(() => {
    setSendMessageDialogOpen(false);
    setSendMessageCredential(null);
  }, []);

  const handleSendTestMessage = useCallback(
    async (channel: string): Promise<SendTestMessageResponse> => {
      if (!onSendTestMessage || !sendMessageCredential) {
        return {
          success: false,
          message: 'Unable to send message',
          testedAt: new Date().toISOString(),
          error: 'No callback or credential available',
        };
      }
      setSendingMessageCredentialId(sendMessageCredential.id);
      try {
        return await onSendTestMessage(sendMessageCredential.id, channel);
      } finally {
        setSendingMessageCredentialId(null);
      }
    },
    [onSendTestMessage, sendMessageCredential]
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
        <div className="flex items-center gap-3">
          {/* Secrets Backend Badge (T08) */}
          <SecretsBackendBadge
            health={secretsHealth}
            isLoading={secretsHealthLoading}
          />
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
      </div>

      {/* Environment Selector (T10) */}
      {onEnvironmentChange && (
        <div className="px-6 py-3 border-b border-border-subtle bg-bg-tertiary/50">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Environment:</span>
            <EnvironmentSelector
              value={selectedEnvironment}
              onChange={onEnvironmentChange}
              className="w-48"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="p-4">
        <IntegrationCredentialsTable
          credentials={credentials}
          isLoading={isLoading}
          onTest={handleTestCredential}
          onSendTestMessage={handleOpenSendMessageDialog}
          onDelete={handleDeleteCredential}
          testingCredentialId={testingCredentialId}
          sendingMessageCredentialId={sendingMessageCredentialId}
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

      {/* Test Result Dialog (T09) */}
      <TestResultDialog
        isOpen={testResultDialogOpen}
        onClose={handleCloseTestResultDialog}
        result={testResult}
        credentialName={testedCredential?.name}
        integrationType={testedCredential?.integrationType}
      />

      {/* Send Test Message Dialog */}
      <SendTestMessageDialog
        isOpen={sendMessageDialogOpen}
        onClose={handleCloseSendMessageDialog}
        onSend={handleSendTestMessage}
        credentialName={sendMessageCredential?.name}
        isSending={sendingMessageCredentialId !== null}
      />
    </section>
  );
}
