/**
 * TestResultDialog Component (P09-F01 T09)
 *
 * Dialog that shows the result of testing an integration credential.
 * For Slack bot tokens, shows additional details like channel and timestamp.
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import clsx from 'clsx';
import {
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  HashtagIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import type { EnhancedTestIntegrationCredentialResponse } from '../../types/llmConfig';

export interface TestResultDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Test result data */
  result?: EnhancedTestIntegrationCredentialResponse | null;
  /** Name of the credential being tested */
  credentialName?: string;
  /** Integration type (slack, github, teams) */
  integrationType?: string;
}

export default function TestResultDialog({
  isOpen,
  onClose,
  result,
  credentialName = 'Credential',
  integrationType = 'unknown',
}: TestResultDialogProps) {
  if (!result) return null;

  const isSlackBotToken = integrationType === 'slack' && result.details?.channel;
  const hasTeamInfo = result.details?.team;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-bg-secondary border border-border-primary p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {result.valid ? (
                      <div className="p-2 rounded-full bg-status-success/10">
                        <CheckCircleIcon className="h-6 w-6 text-status-success" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-full bg-status-error/10">
                        <XCircleIcon className="h-6 w-6 text-status-error" />
                      </div>
                    )}
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold text-text-primary"
                      >
                        {result.valid ? 'Test Successful' : 'Test Failed'}
                      </Dialog.Title>
                      <p className="text-sm text-text-secondary">{credentialName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Message */}
                <div className="mb-4 p-3 rounded-lg bg-bg-tertiary">
                  <p className="text-sm text-text-primary">{result.message}</p>
                </div>

                {/* Slack-specific details */}
                {isSlackBotToken && result.valid && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <ChatBubbleLeftIcon className="h-4 w-4 text-accent-purple" />
                      <span className="text-sm">Test message sent successfully</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {hasTeamInfo && (
                        <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                          <BuildingOffice2Icon className="h-4 w-4 text-text-muted" />
                          <div>
                            <p className="text-xs text-text-muted">Workspace</p>
                            <p className="text-sm text-text-primary font-medium">
                              {result.details?.team}
                            </p>
                          </div>
                        </div>
                      )}

                      {result.details?.channel && (
                        <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                          <HashtagIcon className="h-4 w-4 text-text-muted" />
                          <div>
                            <p className="text-xs text-text-muted">Channel</p>
                            <p className="text-sm text-text-primary font-medium">
                              {result.details.channel}
                            </p>
                          </div>
                        </div>
                      )}

                      {result.details?.timestamp && (
                        <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary col-span-2">
                          <ClockIcon className="h-4 w-4 text-text-muted" />
                          <div>
                            <p className="text-xs text-text-muted">Message Timestamp</p>
                            <code className="text-xs text-text-secondary font-mono">
                              {result.details.timestamp}
                            </code>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* GitHub-specific details */}
                {integrationType === 'github' && result.valid && result.details && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {result.details.login && (
                        <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                          <div>
                            <p className="text-xs text-text-muted">Username</p>
                            <p className="text-sm text-text-primary font-medium">
                              @{result.details.login}
                            </p>
                          </div>
                        </div>
                      )}
                      {result.details.name && (
                        <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                          <div>
                            <p className="text-xs text-text-muted">Name</p>
                            <p className="text-sm text-text-primary font-medium">
                              {result.details.name}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tested at timestamp */}
                <div className="mt-4 pt-4 border-t border-border-primary">
                  <p className="text-xs text-text-muted">
                    Tested at: {new Date(result.testedAt).toLocaleString()}
                  </p>
                </div>

                {/* Close button */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      'bg-accent-purple text-white hover:bg-accent-purple/90'
                    )}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
