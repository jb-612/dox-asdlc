/**
 * SendTestMessageDialog Component
 *
 * Dialog for sending a test message to Slack using a bot token credential.
 * Allows the user to specify a channel and shows the result.
 */

import { Fragment, useState, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import clsx from 'clsx';
import {
  XMarkIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  HashtagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { SendTestMessageResponse } from '../../types/llmConfig';
import Spinner from '../common/Spinner';

export interface SendTestMessageDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback to send the test message */
  onSend: (channel: string) => Promise<SendTestMessageResponse>;
  /** Name of the credential being used */
  credentialName?: string;
  /** Whether sending is in progress */
  isSending?: boolean;
}

export default function SendTestMessageDialog({
  isOpen,
  onClose,
  onSend,
  credentialName = 'Slack Bot',
  isSending = false,
}: SendTestMessageDialogProps) {
  const [channel, setChannel] = useState('general');
  const [result, setResult] = useState<SendTestMessageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSending, setLocalSending] = useState(false);

  const handleSend = useCallback(async () => {
    setLocalSending(true);
    setError(null);
    setResult(null);
    try {
      const response = await onSend(channel);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test message');
    } finally {
      setLocalSending(false);
    }
  }, [channel, onSend]);

  const handleClose = useCallback(() => {
    setResult(null);
    setError(null);
    setChannel('general');
    onClose();
  }, [onClose]);

  const sending = isSending || localSending;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    <div className="p-2 rounded-full bg-accent-purple/10">
                      <ChatBubbleLeftIcon className="h-6 w-6 text-accent-purple" />
                    </div>
                    <div>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold text-text-primary"
                      >
                        Send Test Message
                      </Dialog.Title>
                      <p className="text-sm text-text-secondary">{credentialName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Channel Input (only show if no result yet) */}
                {!result && (
                  <div className="mb-4">
                    <label
                      htmlFor="channel"
                      className="block text-sm font-medium text-text-secondary mb-2"
                    >
                      Channel
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                        #
                      </span>
                      <input
                        id="channel"
                        type="text"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        placeholder="general"
                        disabled={sending}
                        className={clsx(
                          'w-full pl-7 pr-4 py-2 rounded-lg border border-border-primary',
                          'bg-bg-tertiary text-text-primary placeholder-text-muted',
                          'focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:border-accent-purple',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      Enter the channel name without the # prefix. The bot must be a member of this channel.
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error/20">
                    <div className="flex items-center gap-2">
                      <XCircleIcon className="h-5 w-5 text-status-error" />
                      <p className="text-sm text-status-error">{error}</p>
                    </div>
                  </div>
                )}

                {/* Result Display */}
                {result && (
                  <div className="space-y-3">
                    {/* Status */}
                    <div
                      className={clsx(
                        'p-3 rounded-lg',
                        result.success
                          ? 'bg-status-success/10 border border-status-success/20'
                          : 'bg-status-error/10 border border-status-error/20'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircleIcon className="h-5 w-5 text-status-success" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-status-error" />
                        )}
                        <p
                          className={clsx(
                            'text-sm font-medium',
                            result.success ? 'text-status-success' : 'text-status-error'
                          )}
                        >
                          {result.message}
                        </p>
                      </div>
                      {result.error && (
                        <p className="mt-2 text-xs text-status-error">{result.error}</p>
                      )}
                    </div>

                    {/* Details (on success) */}
                    {result.success && (
                      <div className="grid grid-cols-2 gap-3">
                        {result.channel && (
                          <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                            <HashtagIcon className="h-4 w-4 text-text-muted" />
                            <div>
                              <p className="text-xs text-text-muted">Channel</p>
                              <p className="text-sm text-text-primary font-medium">
                                #{result.channel}
                              </p>
                            </div>
                          </div>
                        )}

                        {result.timestamp && (
                          <div className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                            <ClockIcon className="h-4 w-4 text-text-muted" />
                            <div>
                              <p className="text-xs text-text-muted">Timestamp</p>
                              <code className="text-xs text-text-secondary font-mono">
                                {result.timestamp}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tested at timestamp */}
                    <div className="pt-3 border-t border-border-primary">
                      <p className="text-xs text-text-muted">
                        Sent at: {new Date(result.testedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    )}
                  >
                    {result ? 'Close' : 'Cancel'}
                  </button>
                  {!result && (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !channel.trim()}
                      className={clsx(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        'bg-accent-purple text-white hover:bg-accent-purple/90',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'flex items-center gap-2'
                      )}
                    >
                      {sending ? (
                        <>
                          <Spinner className="h-4 w-4" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <ChatBubbleLeftIcon className="h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  )}
                  {result && !result.success && (
                    <button
                      type="button"
                      onClick={() => setResult(null)}
                      className={clsx(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        'bg-accent-purple text-white hover:bg-accent-purple/90'
                      )}
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
