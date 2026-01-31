/**
 * RawConfigEditor Component (P05-F13 T29)
 *
 * JSON editor for advanced configuration editing.
 * Provides syntax highlighting, validation, and formatting.
 */

import { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import {
  ExclamationTriangleIcon,
  CheckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import type { AgentLLMConfig } from '../../types/llmConfig';

export interface RawConfigEditorProps {
  /** Current agent configurations */
  configs: AgentLLMConfig[];
  /** Callback when config changes */
  onChange?: (configs: AgentLLMConfig[]) => void;
  /** Callback to validate JSON */
  onValidate?: () => Promise<boolean>;
  /** Whether editor is read-only */
  readOnly?: boolean;
  /** Custom class name */
  className?: string;
}

interface ValidationState {
  isValid: boolean;
  error?: string;
}

export default function RawConfigEditor({
  configs,
  onChange,
  onValidate,
  readOnly = false,
  className,
}: RawConfigEditorProps) {
  // Format config for display
  const formattedConfig = useMemo(() => {
    const configObj = {
      agents: configs.reduce((acc, config) => {
        acc[config.role] = {
          provider: config.provider,
          model: config.model,
          apiKeyId: config.apiKeyId,
          temperature: config.settings.temperature,
          maxTokens: config.settings.maxTokens,
          topP: config.settings.topP,
          topK: config.settings.topK,
          enabled: config.enabled,
        };
        return acc;
      }, {} as Record<string, unknown>),
    };
    return JSON.stringify(configObj, null, 2);
  }, [configs]);

  const [rawValue, setRawValue] = useState(formattedConfig);
  const [validation, setValidation] = useState<ValidationState>({ isValid: true });

  // Validate JSON and update state
  const validateAndParse = useCallback((value: string): ValidationState => {
    try {
      const parsed = JSON.parse(value);
      if (!parsed.agents || typeof parsed.agents !== 'object') {
        return { isValid: false, error: 'Missing or invalid "agents" object' };
      }
      return { isValid: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Invalid JSON';
      return { isValid: false, error };
    }
  }, []);

  // Handle text changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setRawValue(newValue);
      const validationResult = validateAndParse(newValue);
      setValidation(validationResult);
    },
    [validateAndParse]
  );

  // Handle validate button click
  const handleValidate = useCallback(async () => {
    const validationResult = validateAndParse(rawValue);
    setValidation(validationResult);

    if (validationResult.isValid && onValidate) {
      const externalValid = await onValidate();
      if (!externalValid) {
        setValidation({
          isValid: false,
          error: 'Configuration validation failed',
        });
      }
    }
  }, [rawValue, validateAndParse, onValidate]);

  // Handle format button click
  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(rawValue);
      const formatted = JSON.stringify(parsed, null, 2);
      setRawValue(formatted);
      setValidation({ isValid: true });
    } catch {
      // Keep current value if invalid
      setValidation(validateAndParse(rawValue));
    }
  }, [rawValue, validateAndParse]);

  // Handle apply changes
  const handleApply = useCallback(() => {
    if (!validation.isValid || !onChange) return;

    try {
      const parsed = JSON.parse(rawValue);
      const newConfigs: AgentLLMConfig[] = Object.entries(parsed.agents).map(
        ([role, config]: [string, unknown]) => {
          const c = config as Record<string, unknown>;
          return {
            role: role as AgentLLMConfig['role'],
            provider: c.provider as AgentLLMConfig['provider'],
            model: c.model as string,
            apiKeyId: c.apiKeyId as string,
            settings: {
              temperature: (c.temperature as number) ?? 0.7,
              maxTokens: (c.maxTokens as number) ?? 4096,
              topP: c.topP as number | undefined,
              topK: c.topK as number | undefined,
            },
            enabled: (c.enabled as boolean) ?? true,
          };
        }
      );
      onChange(newConfigs);
    } catch {
      setValidation({
        isValid: false,
        error: 'Failed to apply configuration',
      });
    }
  }, [rawValue, validation.isValid, onChange]);

  return (
    <div
      data-testid="raw-config-editor"
      className={clsx('space-y-4', className)}
    >
      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
        <ExclamationTriangleIcon className="h-5 w-5 text-status-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-status-warning">Advanced Users Only</p>
          <p className="text-text-secondary mt-1">
            Direct editing may cause configuration errors. Changes here override UI settings.
          </p>
        </div>
      </div>

      {/* Validation Status */}
      {!validation.isValid && validation.error && (
        <div
          data-testid="validation-error"
          className="flex items-center gap-2 p-2 rounded-lg bg-status-error/10 border border-status-error/30"
        >
          <ExclamationTriangleIcon className="h-4 w-4 text-status-error" />
          <span className="text-sm text-status-error">{validation.error}</span>
        </div>
      )}

      {validation.isValid && rawValue !== formattedConfig && (
        <div
          data-testid="validation-success"
          className="flex items-center gap-2 p-2 rounded-lg bg-status-success/10 border border-status-success/30"
        >
          <CheckIcon className="h-4 w-4 text-status-success" />
          <span className="text-sm text-status-success">JSON is valid</span>
        </div>
      )}

      {/* JSON Editor */}
      <textarea
        data-testid="raw-config-textarea"
        value={rawValue}
        onChange={handleChange}
        readOnly={readOnly}
        spellCheck={false}
        className={clsx(
          'w-full h-96 p-4 rounded-lg',
          'font-mono text-sm leading-relaxed',
          'bg-bg-primary border',
          validation.isValid
            ? 'border-border-primary focus:border-accent-teal'
            : 'border-status-error',
          'text-text-primary',
          'focus:outline-none focus:ring-1',
          validation.isValid ? 'focus:ring-accent-teal' : 'focus:ring-status-error',
          'resize-y',
          readOnly && 'opacity-75 cursor-not-allowed'
        )}
      />

      {/* Action Buttons */}
      {!readOnly && (
        <div className="flex items-center gap-3">
          <button
            data-testid="validate-json-button"
            type="button"
            onClick={handleValidate}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'border border-border-primary',
              'bg-bg-primary text-text-primary',
              'hover:bg-bg-tertiary transition-colors'
            )}
          >
            <CheckIcon className="h-4 w-4" />
            Validate JSON
          </button>

          <button
            data-testid="format-json-button"
            type="button"
            onClick={handleFormat}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'border border-border-primary',
              'bg-bg-primary text-text-primary',
              'hover:bg-bg-tertiary transition-colors'
            )}
          >
            <DocumentTextIcon className="h-4 w-4" />
            Format JSON
          </button>

          <button
            data-testid="apply-config-button"
            type="button"
            onClick={handleApply}
            disabled={!validation.isValid}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-accent-teal text-white',
              'hover:bg-accent-teal/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <CheckIcon className="h-4 w-4" />
            Apply Changes
          </button>
        </div>
      )}
    </div>
  );
}
