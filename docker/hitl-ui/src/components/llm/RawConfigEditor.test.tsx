/**
 * RawConfigEditor Component Tests (P05-F13 T29)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RawConfigEditor from './RawConfigEditor';
import type { AgentLLMConfig } from '../../types/llmConfig';

const mockConfigs: AgentLLMConfig[] = [
  {
    role: 'discovery',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-123',
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
    },
    enabled: true,
  },
  {
    role: 'coding',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-123',
    settings: {
      temperature: 0.3,
      maxTokens: 8192,
    },
    enabled: true,
  },
];

describe('RawConfigEditor', () => {
  it('renders with warning banner', () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    expect(screen.getByTestId('raw-config-editor')).toBeInTheDocument();
    expect(screen.getByText('Advanced Users Only')).toBeInTheDocument();
    expect(screen.getByText(/Direct editing may cause configuration errors/)).toBeInTheDocument();
  });

  it('displays config as formatted JSON', () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    const textarea = screen.getByTestId('raw-config-textarea');
    expect(textarea).toBeInTheDocument();

    const content = (textarea as HTMLTextAreaElement).value;
    expect(content).toContain('"agents"');
    expect(content).toContain('"discovery"');
    expect(content).toContain('"coding"');
  });

  it('shows validate and format buttons', () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    expect(screen.getByTestId('validate-json-button')).toBeInTheDocument();
    expect(screen.getByTestId('format-json-button')).toBeInTheDocument();
    expect(screen.getByTestId('apply-config-button')).toBeInTheDocument();
  });

  it('validates JSON when validate button clicked', async () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    // Modify the content first to trigger "unsaved" state
    const textarea = screen.getByTestId('raw-config-textarea') as HTMLTextAreaElement;
    const currentValue = textarea.value;
    fireEvent.change(textarea, { target: { value: currentValue + ' ' } });
    fireEvent.change(textarea, { target: { value: currentValue.replace('"discovery"', '"discovery_modified"') } });

    const validateButton = screen.getByTestId('validate-json-button');
    fireEvent.click(validateButton);

    // Should show success since JSON is valid
    await waitFor(() => {
      expect(screen.getByTestId('validation-success')).toBeInTheDocument();
    });
  });

  it('shows error for invalid JSON', async () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    const textarea = screen.getByTestId('raw-config-textarea');
    fireEvent.change(textarea, { target: { value: '{{ invalid json' } });

    await waitFor(() => {
      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
    });
  });

  it('formats JSON when format button clicked', async () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    const textarea = screen.getByTestId('raw-config-textarea') as HTMLTextAreaElement;

    // Set unformatted but valid JSON
    fireEvent.change(textarea, { target: { value: '{"agents":{"test":{"provider":"anthropic"}}}' } });

    const formatButton = screen.getByTestId('format-json-button');
    fireEvent.click(formatButton);

    // Should be formatted with indentation
    await waitFor(() => {
      expect(textarea.value).toContain('\n');
      expect(textarea.value).toContain('  ');
    });
  });

  it('calls onChange with parsed config when apply clicked', async () => {
    const onChange = vi.fn();
    render(<RawConfigEditor configs={mockConfigs} onChange={onChange} />);

    const applyButton = screen.getByTestId('apply-config-button');
    fireEvent.click(applyButton);

    expect(onChange).toHaveBeenCalled();
    const appliedConfigs = onChange.mock.calls[0][0];
    expect(appliedConfigs).toHaveLength(2);
  });

  it('disables apply button when JSON is invalid', async () => {
    render(<RawConfigEditor configs={mockConfigs} />);

    const textarea = screen.getByTestId('raw-config-textarea');
    fireEvent.change(textarea, { target: { value: 'invalid json' } });

    const applyButton = screen.getByTestId('apply-config-button');
    expect(applyButton).toBeDisabled();
  });

  it('respects readOnly prop', () => {
    render(<RawConfigEditor configs={mockConfigs} readOnly />);

    const textarea = screen.getByTestId('raw-config-textarea');
    expect(textarea).toHaveAttribute('readonly');

    // Buttons should not be rendered in readonly mode
    expect(screen.queryByTestId('validate-json-button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<RawConfigEditor configs={mockConfigs} className="custom-class" />);

    const editor = screen.getByTestId('raw-config-editor');
    expect(editor).toHaveClass('custom-class');
  });
});
